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

| プラットフォーム | 入力方法 | スクリプト実行 | DB 操作 |
|---|---|---|---|
| Claude Code | `Read` でファイルパス読み込み | `python3` 直接実行 | Supabase MCP |
| claude.ai (Skills) | 添付ファイル or 本文貼付 | code execution sandbox で `python` | Supabase MCP (チャット層) |

スクリプトは **すべて Python (標準ライブラリのみ)** で書かれており、両環境で同じコードが動く。シェルコマンド (`shasum` / `curl` 等) には依存しない。

## 入力の受付

呼び出し時に以下のいずれかが提供される:

- **(A) ファイルパス**: ローカルファイルを `Read` ツールで読む (Claude Code)
- **(B) 添付ファイル**: claude.ai の attachment として渡される
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
    "imported_via":     "claude_code_skill_register_insight",
    "skill_version":    "1.0",
    "char_count":       <LENGTH(content)>,
    "original_path":    "<絶対パス、path 指定の場合>",
    "frontmatter":      { ... }   // ファイルに frontmatter があれば
  }
}
```

---

## ステップ 3: insights INSERT

### 3-1. 短文 (content ≤ 100,000字 かつ ≤ 5,000字) の場合

```sql
-- $1=title $2=content $3=tags $4=category $5=summary $6=metadata $7=...
INSERT INTO insights (
  title, content, category, tags, summary, source_app, source_type,
  importance, language, content_format, metadata
) VALUES (
  $1, $2, $4, $3::text[], $5, $6, $7,
  $8, 'ja', 'markdown', $9::jsonb
)
RETURNING id;
```

→ 取得した `insight_id` を保持。

### 3-2. 長文 (> 5,000字) の場合 — insight_documents + チャンク化が **必須**

handover の落とし穴9: `insights.content` は max 100,000字。**100,000字超の場合は `content` に冒頭〜中盤の代表抜粋 (≤ 50,000字) を入れ、全文は `insight_documents.body` に保存する**。

```sql
-- (a) insights INSERT — content には全文 (≤100,000) または抜粋 (>100,000の場合)
INSERT INTO insights (...) VALUES (...) RETURNING id;

-- (b) insight_documents INSERT — body には常に全文 (≤1,000,000)
INSERT INTO insight_documents (
  insight_id, doc_type, title, body, source_app, content_format, metadata
) VALUES (
  <insight_id>,
  'fulltext',           -- または 'deep_research' / 'transcript' / 'reference'
  '<title>',
  $body_text,
  '<source_app>',
  'markdown',
  jsonb_build_object('imported_via', 'claude_code_skill_register_insight')
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

`lib/chunk.py` (本スキル同梱の Python スクリプト) を使う。スキルルートからの相対パスは `lib/chunk.py`。

**Claude Code の場合**:
```bash
python3 .claude/skills/register-insight/lib/chunk.py < /tmp/body.md > /tmp/chunks.json
```

**claude.ai の場合** (sandbox の Python から直接 import):
```python
# スキル ZIP は sandbox に展開済み。lib/chunk.py が読める
import sys
sys.path.insert(0, "lib")
from chunk import chunk
chunks = chunk(body_text)
import json
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

```sql
-- 待機ループ (Bash 側で 5秒ごとに確認、最大 5分)
SELECT
  (SELECT embedding IS NOT NULL FROM insights WHERE id = <insight_id>) AS insight_done,
  (SELECT COUNT(*) FROM document_chunks
   WHERE document_id = <document_id> AND embedding IS NULL) AS chunks_pending;
```

`insight_done = true` かつ `chunks_pending = 0` で完了。

タイムアウト (5分) しても未完なら:
1. Edge Function ログ確認: `mcp__claude_ai_Supabase__get_logs(service="edge-function")`
2. `scripts/backfill-embeddings.ts` で再実行可能な状態にする
3. ユーザーに報告

---

## ステップ 6: 検証 (サンプル検索 1 件)

登録した内容に最も関連しそうなクエリ語 (2-1 で抽出したタグの 1 つや title の主要キーワード) を選び、自身の登録レコードがヒットするか確認。

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

両プラットフォーム共通の Python (urllib のみ・標準ライブラリ):

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
- DB クエリは MCP `mcp__claude_ai_Supabase__execute_sql` を使用 (project_id: `gntgcxdbcbywfboejimz`)
- Edge Function 直接呼び出しが必要な場合のみ `SUPABASE_SERVICE_ROLE_KEY` (Claude Code: shell env, claude.ai: 会話で受け取る) を使う。
  - **Claude Code**: ユーザーに事前に `export SUPABASE_SERVICE_ROLE_KEY=...` してもらう
  - **claude.ai**: 検証検索を行う場合のみ、ユーザーから service role key を 1 回提示してもらう (skip 可)

---

## 失敗時のロールバック方針

ステップ 3 で insights INSERT 成功後にステップ 4 (チャンク登録) で失敗した場合:
- **物理 DELETE しない** (handover ルール)
- 代わりに `UPDATE insights SET is_archived = TRUE, metadata = metadata || '{"register_failed": true, "failed_step": "chunk"}'::jsonb WHERE id = <id>;`
- ユーザーに失敗 step とログを報告し、修正後に再開

---

## 不変ルール (絶対に違反しない)

1. `insights.content` / `insight_documents.body` / `document_chunks.body` を AI で整形・要約・誤字修正しない
2. 物理 DELETE 禁止 (`is_archived = TRUE` のみ)
3. embedding は自分で生成しない (DB トリガ経由のみ — handover §タスク3 の Edge Function を信頼)
4. content_sha256 の重複は **必ず先にチェック** (二重登録防止)
5. ユーザーが指定したメタ (source_app, tags, category 等) を勝手に上書きしない
