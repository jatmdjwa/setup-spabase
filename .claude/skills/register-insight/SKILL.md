---
name: register-insight
description: 指定したファイル (またはテキスト) を Insights DB (Supabase chatDB) に間違いなく登録する。原文不変・重複検知・チャンク化・embedding 生成完了確認・サンプル検索までを自動化する。
---

# register-insight

ユーザーから渡された **ファイルパス** または **直接のテキスト** を Supabase の Insights DB に登録するスキル。

`docs/insights-db-handover.md` の運用ルール (原文不変・必須メタ・チャンク化前提) を厳守する。

---

## プラットフォーム

このスキルは **Claude Code と claude.ai の両方** で動く。

| プラットフォーム | 入力方法 | スクリプト実行 | DB 操作 | ネットワーク |
|---|---|---|---|---|
| Claude Code | `Read` ツールでファイルパス読込 | `python3` 直接実行 | Supabase MCP (`execute_sql` 等) | 制約なし |
| claude.ai (Skills) | 添付ファイルを sandbox の `open()` で読む / 本文貼付 | code execution sandbox の `python` | Supabase MCP (チャット層・ユーザー設定の connector 経由) | **既定で外部HTTP不可** (allowlist 制) |

スクリプトは **すべて Python (標準ライブラリのみ)** で書かれており、両環境で同じコードが動く。シェルコマンド (`shasum` / `curl` 等) には依存しない。

> **claude.ai 制約**: code execution sandbox は既定で外部 HTTP egress を許可しない。ステップ6 の Edge Function 直叩きは Supabase domain が allowlist に入っていない限り失敗する。**その場合は Supabase MCP (チャット層) 経由に切り替える** (本 SKILL.md に手順あり)。

## 入力の受付

呼び出し時に以下のいずれかが提供される:

- **(A) Claude Code でファイルパス**: `Read` ツールでファイル読込
- **(B) claude.ai で添付ファイル**: sandbox に展開済みのファイルを Python `open(path)` で読む
- **(C) 直接テキスト**: 引数や直前の会話に本文が貼り付けられている

どの場合も、**本文 (`content`) と "想定ファイル名 / タイトル候補"** を確保する。タイトル候補が不明なときは:
1. 本文の最初の H1 (`# ...`) を使う
2. それも無ければ最初の非空行 (≤ 200字) を使う
3. それも無ければユーザーに聞く

---

## ステップ 0: 事前にユーザーに確認すること

**以下が path/filename/frontmatter から推定できないときのみ、開始前にまとめて 1 度だけ聞く** (推定できれば聞かない):

| 項目 | 推定の根拠 | 推定不能時のデフォルト (確認のうえ採用) |
|---|---|---|
| `source_app` | パスに `gemini` `chatgpt` `claude` `perplexity` `codex` を含むか | `manual` |
| `source_type` | "deep_research" "transcript" などの語があるか | `conversation` |
| `title` | H1 / 最初の非空行 / frontmatter `title:` | (聞く) |

ユーザーが「おまかせ」で返したら全項目デフォルトで進めてよい。

---

## ステップ 1: 本文準備 & 重複検知

1. 入力に応じて本文を取得:
   - Claude Code: `Read` でファイル読み込み
   - claude.ai: 添付ファイル → sandbox の `open()` または会話本文
2. **content は原文ママ** (整形禁止)。ただし frontmatter 部分 (`---\n...\n---`) があれば content からは除外し、metadata に保存
3. `sha256` を計算 (両プラットフォーム共通の Python 1 行):
   ```python
   import hashlib
   sha256 = hashlib.sha256(content.encode("utf-8")).hexdigest()
   ```
4. 重複チェック (MCP `execute_sql`):

```sql
SELECT id, title, created_at
FROM insights
WHERE metadata->>'content_sha256' = '<sha256>'
  AND is_archived = FALSE
LIMIT 1;
```

ヒットしたら **登録を中断** し、既存 id と作成日時をユーザーに伝える。

---

## ステップ 2: メタデータ抽出

### 2-1. タグ・カテゴリの自動抽出

content のサイズに応じて読み方を変える (Vertex AI ではなく **Claude 自身が読んで** 判定):

| content 長 | 読み方 |
|---|---|
| ≤ 50,000 字 | 全文を読んでタグ 2〜5 個 + category 1 個を提案 |
| > 50,000 字 | 先頭 5,000字 + 中央 5,000字 + 末尾 5,000字 をサンプリングしてタグ提案 |

- `category`: `work` / `learning` / `journal` / `idea` / `question` のいずれか
- `tags`: 日本語 or 英語 2〜5 個 (例: `["AI", "MCP", "Supabase"]`)
- `summary`: 1〜3 文 (≤ 1,000字) で内容を要約 (任意)

### 2-2. 必須メタ確定

```jsonc
{
  "title":          "...",
  "content_format": "markdown",  // または plaintext / html
  "language":       "ja",        // 本文言語に合わせる
  "source_app":     "manual",    // ステップ0で確定
  "source_type":    "conversation",
  "importance":     3,           // 1-5、特に指定なければ 3
  "metadata": {
    "content_sha256":   "<sha256>",
    "imported_via":     "register_insight_v1",
    "skill_version":    "1.0",
    "char_count":       <LENGTH(content)>,
    "original_path":    "<絶対パス、path 指定の場合>",
    "frontmatter":      { ... }   // ファイルに frontmatter があれば
  }
}
```

---

## ステップ 3: insights INSERT

> **重要**: Supabase MCP の `execute_sql` は **単一の SQL 文字列** を受け取る (PG プレースホルダ `$1` は使えない)。
> 値は Claude が文字列リテラルとして埋め込むこと。**シングルクォート escape は `''` で 2 重化**。タグは `ARRAY['tag1','tag2']` 形式。jsonb は `'{"k":"v"}'::jsonb`。

### 3-1. 短文 (content ≤ 5,000字) の場合

literal SQL を組み立てる例 (Claude が値を埋める):

```sql
INSERT INTO insights (
  title, content, category, tags, summary,
  source_app, source_type, importance,
  language, content_format, metadata
) VALUES (
  '<escaped_title>',
  '<escaped_content>',
  '<category>',
  ARRAY['<tag1>','<tag2>']::text[],
  '<escaped_summary_or_NULL>',
  '<source_app>',
  '<source_type>',
  3,
  '<language>',         -- メタの language を使う ('ja' 等)
  '<content_format>',   -- メタの content_format ('markdown' 等)
  '<metadata_json>'::jsonb
)
RETURNING id;
```

→ 結果から `insight_id` を取り出して保持。

### 3-2. 長文 (> 5,000字) の場合 — insight_documents + チャンク化が **必須**

`insights.content` は schema 上 max 100,000字 (handover §schema)。**ただし原文不変 (§不変ルール 1) を厳守**するため:

| 元の長さ | `insights.content` | `insights.content_normalized` | `insight_documents.body` |
|---|---|---|---|
| ≤ 100,000字 | 原文そのまま | (任意。AI整形版を入れる場合のみ) | 原文そのまま |
| > 100,000字 | 原文の **先頭 100,000字をそのまま** (truncate flag を metadata に記録) | (任意) | 原文そのまま (≤1,000,000字) |

> 100,000字超の入力は `metadata.content_truncated = true` と `metadata.full_length` を立て、`content` には先頭 N 字をそのまま (整形・要約せずに) 入れる。原文不変ルールに違反しない最小限の妥協。

```sql
-- (a) insights INSERT
INSERT INTO insights ( ... ) VALUES ( ... ) RETURNING id;

-- (b) insight_documents INSERT — body には常に全文 (≤1,000,000)
INSERT INTO insight_documents (
  insight_id, doc_type, title, body, source_app, content_format, metadata
) VALUES (
  <insight_id>,
  'fulltext',           -- または 'deep_research' / 'transcript' / 'reference'
  '<escaped_title>',
  '<escaped_body>',     -- 原文ママ
  '<source_app>',
  'markdown',
  jsonb_build_object('imported_via', 'register_insight_v1')
)
RETURNING id;
```

`doc_type` の選び方:
- パスやタイトルに "deep" "research" "リサーチ" → `deep_research`
- "transcript" "議事" "文字起こし" → `transcript`
- 上記以外で長文 → `fulltext`

---

## ステップ 4: チャンク化と登録 (長文時のみ)

### 4-1. チャンク生成

`lib/chunker.py` (本スキル同梱の Python スクリプト) を使う。スキルルートからの相対パスは `lib/chunker.py`。
> ファイル名は **chunker.py** (stdlib の `chunk` モジュールとの衝突回避)。

**Claude Code の場合** — リポジトリ内の絶対パスで実行:
```bash
python3 "$REPO_ROOT/.claude/skills/register-insight/lib/chunker.py" < /tmp/body.md > /tmp/chunks.json
```

**claude.ai の場合** — sandbox での skill 配置パスは公式仕様書に明記が無い。**3 段階の探索 + 最終フォールバック (chunker 関数を inline 定義)** を行う:

```python
import os, sys, json, subprocess, glob

def _find_chunker_path():
    # (1) 環境変数 (Claude Code 互換)
    d = os.environ.get("CLAUDE_SKILL_DIR")
    if d:
        p = os.path.join(d, "lib", "chunker.py")
        if os.path.isfile(p):
            return p
    # (2) 既知候補 (claude.ai sandbox での想定配置・未公式)
    for base in ("/mnt/skills", "/mnt/user-data/skills",
                 os.path.expanduser("~/skills"),
                 os.path.expanduser("~/.claude/skills"), "."):
        p = os.path.join(base, "register-insight", "lib", "chunker.py")
        if os.path.isfile(p):
            return p
    # (3) bash find でフォールバック (1 回限り、タイムアウト 10s)
    try:
        r = subprocess.run(
            ["bash", "-c",
             "find / -path '*register-insight*chunker.py' 2>/dev/null | head -1"],
            capture_output=True, text=True, timeout=10,
        )
        out = r.stdout.strip()
        if out and os.path.isfile(out):
            return out
    except Exception:
        pass
    return None

chunker_path = _find_chunker_path()
if chunker_path:
    sys.path.insert(0, os.path.dirname(chunker_path))
    from chunker import chunk
else:
    # (4) フォールバック: SKILL.md には chunker のソースを inline で持っていないので、
    # 見つからない場合は **Claude が chunker.py の内容をこの sandbox に書き出す**:
    #   - スキル ZIP に含まれる lib/chunker.py の中身を Claude が知っているはず
    #   - Claude は `with open('/tmp/chunker.py','w') as f: f.write('''<source>''')` を実行
    #   - 上記 sys.path で /tmp を指して再 import
    raise RuntimeError(
        "chunker.py が見つかりません。Claude は lib/chunker.py の内容を "
        "/tmp/chunker.py に書き出してから再実行すること。"
    )

chunks = chunk(body_text)
print(json.dumps(chunks, ensure_ascii=False))
```

出力は:
```json
[
  {"body": "...", "section_title": "preamble", "section_path": []},
  {"body": "...", "section_title": "第1章 序論", "section_path": ["第1章 序論"]},
  ...
]
```

ルール:
- H1/H2 で大章分割
- 各章 5,000字 超は H3 → 段落単位でさらに分割
- 各 chunk body は **原文ママ** の連続部分 (handover 落とし穴8: chunks.body の合計 ≠ insight_documents.body は禁止 — 必ず原文の連続切り出しになる)

### 4-2. replace_document_chunks() で一括登録

```sql
SELECT replace_document_chunks(
  <document_id>,
  $chunks_jsonb::jsonb
);
```

ここで `$chunks_jsonb` は 4-1 の出力。トリガが発火し、各 chunk の embedding が **非同期** で生成される。

### 4-3. 整合性チェック (handover §タスク2の検証手順)

```sql
-- chunk数と body合計
SELECT COUNT(*) AS chunk_count, SUM(LENGTH(body)) AS total_chunk_chars
FROM document_chunks WHERE document_id = <document_id>;

-- insight_documents.body との照合
SELECT LENGTH(body) AS doc_body_chars
FROM insight_documents WHERE id = <document_id>;
```

`total_chunk_chars` ≈ `doc_body_chars` (改行・空白の差分のみ) を確認。

---

## ステップ 5: Embedding 生成完了の待機

トリガは `pg_net` で **非同期 HTTP**。完了まで通常 5〜30 秒。

**確認用 SQL** (両プラットフォーム共通):
```sql
SELECT
  (SELECT embedding IS NOT NULL FROM insights WHERE id = <insight_id>) AS insight_done,
  (SELECT COUNT(*) FROM document_chunks
   WHERE document_id = <document_id> AND embedding IS NULL) AS chunks_pending;
```

`insight_done = true` かつ `chunks_pending = 0` で完了。

### プラットフォーム別の実装

**Claude Code の場合** — bash の until-loop で MCP `execute_sql` をポーリング:
```bash
# 5 秒間隔・最大 60 回 = 5 分
for i in $(seq 1 60); do
  # MCP execute_sql 経由で上記 SQL を実行 → JSON 結果を判定
  # 完了したら break
  sleep 5
done
```

**claude.ai の場合** — sandbox 内では MCP を呼べない。**Claude (オーケストレータ) が** ループを駆動する:
1. Claude が MCP `execute_sql` を呼んで上記 SQL を実行
2. 結果が未完なら、Claude が **会話で「待機中…」と発話 → 数秒経過後に再度 MCP `execute_sql` を呼ぶ**
3. これを最大 12 回 (≒ 5 分相当) 繰り返す。sandbox の `time.sleep` は使わない (使ってもオーケストレータ層には影響しない)
4. 完了 or タイムアウトでループ終了

タイムアウト (5分) しても未完なら:
1. Edge Function ログ確認: Supabase MCP の `get_logs` ツール (`service="edge-function"`)。Claude Code では tool 名 `mcp__claude_ai_Supabase__get_logs`、claude.ai では connector が公開している同等ツール
2. `scripts/backfill-embeddings.ts` で再実行可能な状態にする (Claude Code のみ)
3. ユーザーに報告

---

## ステップ 6: 検証 (サンプル検索 1 件)

登録した内容に最も関連しそうなクエリ語 (2-1 で抽出したタグの 1 つや title の主要キーワード) を選び、自身の登録レコードがヒットするか確認。

> **claude.ai の場合の制約**: code execution sandbox は既定で `*.supabase.co` への HTTP egress を許可しない (allowlist 制)。
> - **対応 1 (推奨)**: Step 6 をスキップする。Step 5 で embedding 生成完了が確認できていれば、登録は成功している。
> - **対応 2**: ユーザーに「サンプル検索を行いたい」と伝え、ユーザーが claude.ai で `*.supabase.co` を allowlist に追加した場合のみ実行
> - **対応 3**: チャット層から Supabase MCP で `mcp__claude_ai_Supabase__execute_sql`(または connector が公開している同等ツール) を呼んで Edge Function を叩く方式は使えない (MCP は SQL 実行のみで HTTP は出せない)。Step 6 のサンプル検索は claude.ai では原則スキップが安全。
>
> **Claude Code の場合**: 制約なし。下記コードがそのまま動く。

```typescript
// (a) クエリ embedding 生成 — Edge Function の query mode
const queryEmbedding = await fetch(
  "https://gntgcxdbcbywfboejimz.supabase.co/functions/v1/generate-embedding",
  {
    method: "POST",
    headers: {
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ mode: "query", text: "<query>" }),
  },
).then((r) => r.json());
```

簡便版として MCP `execute_sql` から `search_insights` を呼ぶ場合は、別途 query embedding を渡す必要があるため、**Edge Function を 1 回叩いて取得 → SQL に埋める** のが最短。

両プラットフォーム共通の Python (urllib のみ・標準ライブラリ。claude.ai では sandbox の network allowlist が必要):

```python
import json, os, urllib.request

req = urllib.request.Request(
    f"{os.environ['SUPABASE_URL']}/functions/v1/generate-embedding",
    method="POST",
    headers={
        "Authorization": f"Bearer {os.environ['SUPABASE_SERVICE_ROLE_KEY']}",
        "Content-Type": "application/json",
    },
    data=json.dumps({"mode": "query", "text": QUERY}).encode("utf-8"),
)
resp = json.loads(urllib.request.urlopen(req, timeout=30).read())
qvec = resp["embedding"]   # list[float] 768-dim
```

Claude Code で curl を使いたい場合は:
```bash
curl -s -X POST "$SUPABASE_URL/functions/v1/generate-embedding" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d "$(jq -n --arg t "$QUERY" '{mode:"query", text:$t}')" \
  | jq -r '.embedding | tostring' > /tmp/qvec.json
```

```sql
-- 取得した vector で検索
SELECT id, title, similarity
FROM search_insights(
  query_text := '<query>',
  query_embedding := $1::vector(768),
  match_threshold := 0.0,
  match_count := 5
);
```

登録した `insight_id` が上位 5 件に入っていれば PASS。入らなければユーザーに警告 (登録は成功しているが、handover §0 落とし穴10/11 の length-bias / hybrid AND の影響の可能性)。

---

## ステップ 7: 完了報告

ユーザーに以下を返す:

```
✅ 登録完了
  insight_id      : <id>
  document_id     : <id>  (長文時のみ)
  chunks          : <n>   (長文時のみ)
  title           : <title>
  category / tags : <category> / <tags>
  source_app      : <source_app>
  embedding       : ✅ 完了 (insight + chunks 全件)
  検証検索        : ✅ 上位 <rank> 位でヒット (クエリ "<query>")
```

エラー時は **どのステップで** どう失敗したかを明示する。

---

## 接続情報 (固定)

- Supabase project ref: `gntgcxdbcbywfboejimz`
- Edge Function URL: `https://gntgcxdbcbywfboejimz.supabase.co/functions/v1/generate-embedding`
- DB クエリは Supabase MCP の `execute_sql` 同等ツールを使用 (project_id: `gntgcxdbcbywfboejimz`)。Claude Code では tool 名 `mcp__claude_ai_Supabase__execute_sql`、claude.ai では connector が公開している同等ツール (名称は connector 実装に依存)
- Edge Function 直接呼び出しが必要な場合のみ `SUPABASE_SERVICE_ROLE_KEY` (Claude Code: shell env, claude.ai: 会話で受け取る) を使う。
  - **Claude Code**: ユーザーに事前に `export SUPABASE_SERVICE_ROLE_KEY=...` してもらう
  - **claude.ai**: 検証検索を行う場合のみ、ユーザーから service role key を 1 回提示してもらう (skip 可)

---

## 失敗時のロールバック方針

handover の運用ルール: **`insights` の物理 DELETE は禁止** (`is_archived = TRUE` でソフト削除のみ)。
一方 `insight_documents` / `document_chunks` は `insights` から派生する artifact なので、**FK CASCADE 前提で物理 DELETE 可** (実際 `replace_document_chunks()` も内部で chunks を DELETE→INSERT している)。

### 失敗パターン別の対応

| 失敗 step | 状態 | やること |
|---|---|---|
| Step 3-1 (短文 INSERT) で失敗 | insights 0 件作成 | 何もしない (DB 変更なし)。ユーザーに報告 |
| Step 3-2 (a) (insights INSERT) で失敗 | insights 0 件作成 | 同上 |
| Step 3-2 (b) (insight_documents INSERT) で失敗 | insights 1 件あり、document 0 件 | 下記 SQL (1) |
| Step 4 (replace_document_chunks) で失敗 | insights 1 件、document 1 件、chunks 不完全 or 0 件 | 下記 SQL (2) |
| Step 5 (embedding 待機タイムアウト) | 全件作成済みだが embedding 未完 | **ロールバックしない** (バックフィル script で再生成可能)。ユーザーに警告のみ |

**SQL (1) — insight_documents 作成前にロールバック**:
```sql
UPDATE insights
SET is_archived = TRUE,
    metadata = metadata || '{"register_failed": true, "failed_step": "insight_documents"}'::jsonb
WHERE id = <insight_id>;
```

**SQL (2) — チャンク登録失敗時の完全ロールバック**:
```sql
-- (a) document_chunks を物理削除 (FK CASCADE)
DELETE FROM insight_documents WHERE id = <document_id>;
-- (b) insights をソフト削除
UPDATE insights
SET is_archived = TRUE,
    metadata = metadata || '{"register_failed": true, "failed_step": "chunks"}'::jsonb
WHERE id = <insight_id>;
```

ユーザーに失敗 step とログを報告し、原因修正後に最初から再登録 (sha256 重複検知が効くため `is_archived=TRUE` 行は引っかからない — §1 の WHERE 句に `AND is_archived = FALSE` あり)。

---

## 不変ルール (絶対に違反しない)

1. `insights.content` / `insight_documents.body` / `document_chunks.body` を AI で整形・要約・誤字修正しない
2. 物理 DELETE 禁止 (`is_archived = TRUE` のみ)
3. embedding は自分で生成しない (DB トリガ経由のみ — handover §タスク3 の Edge Function を信頼)
4. content_sha256 の重複は **必ず先にチェック** (二重登録防止)
5. ユーザーが指定したメタ (source_app, tags, category 等) を勝手に上書きしない
