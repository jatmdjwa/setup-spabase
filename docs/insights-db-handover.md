# Insights DB プロジェクト引き継ぎドキュメント v4

> **作成日**: 2026-05-03 (v4更新版)
> **対象**: Claude Code での継続作業 / 改善タスク管理
> **作成元**: claude.ai (Claude Opus 4.7) との対話履歴 + Claude Code セッション履歴より
>
> **v3からの変更点**:
> - Tasks 2〜6 が Claude Code セッションで**完了** ✅
> - Edge Function `generate-embedding` に **query mode** を追加 (検索用 embedding 生成)
> - 新マイグレーション 2本追加 (`enable_pg_net_extension` + `add_embedding_trigger`) → 計14本
> - Task 6 で発見した検索品質課題を §12 落とし穴に追記 (落とし穴10〜13)
> - 残タスクは mkさん操作の **ChatGPT 接続テスト (Task 7) のみ**

---

## 0. 最初に読むべきこと

### このプロジェクトの目的

複数のAIアプリ(Claude.ai / ChatGPT / Perplexity / Claude Desktop / Codex 等)から、MCP経由で共通利用できる**個人用の気づき・学び保存DB**を Supabase 上に構築する。

### Claude Codeで実施するタスク (現状)

| # | タスク | 状態 | 備考 |
|---|---|---|---|
| ~~1~~ | ~~embedding カラム次元数変更 (1536 → 768)~~ | ✅ **完了済み** | claude.ai 側で実施 |
| 2 | id=5 レコードの補正 (Deep Research本体保存) | ✅ **完了** | 2026-05-03 Claude Code |
| 3 | Edge Function 実装 (embedding自動生成) | ✅ **完了** | document mode + query mode |
| 4 | DBトリガー実装 (INSERT時にEdge Function呼出) | ✅ **完了** | pg_net + Vault |
| 5 | バックフィル実行 (既存レコードへのembedding付与) | ✅ **完了** | insights 3件 + chunks 16件 |
| 6 | 動作テスト (セマンティック検索が機能するか) | ✅ **完了** | 課題は §12 へ |
| 7 | ChatGPT接続テスト準備 | 🔲 未実施 | mkさん操作待ち |

### 将来の改善タスク (Claude Code で着手可)

| # | タスク | 優先度 | 関連 |
|---|---|---|---|
| A | **検索品質改善**: chunk長さ重み付け、ハイブリッド検索のOR化 | 中 | 落とし穴10, 11 |
| B | **`insights_writer` ロールへの切替** (判断7のフェーズ2移行) | 中 | 判断7 |
| C | **Routine併用** (朝のダイジェスト / 重複検出 / タグ整理) | 低 | 判断6 |
| D | Edge Function に入力長 guard 追加 (~3,000〜4,000字でtruncate) | 低 | 落とし穴12 |

---

## 1. プロジェクト基本情報

### Supabase

| 項目 | 値 |
|---|---|
| プロジェクト名 | chatDB |
| Project Ref / ID | `gntgcxdbcbywfboejimz` |
| 組織ID | `hiiayixtpcazarfhpjyz` |
| リージョン | `ap-southeast-1` (Singapore) |
| Postgres バージョン | 17.6.1.111 |
| プラン | Free |
| MCP Server URL | `https://mcp.supabase.com/mcp?project_ref=gntgcxdbcbywfboejimz` |

### GCP (embedding用)

| 項目 | 値 |
|---|---|
| プロジェクト | `insights-embedding` |
| 有効化済みAPI | `aiplatform.googleapis.com` (画面上「Agent Platform API」と表示) |
| サービスアカウント | `insights-embedding-sa@insights-embedding.iam.gserviceaccount.com` |
| 付与ロール | `roles/aiplatform.user` (Vertex AI ユーザー) |
| 使用モデル | `text-embedding-005` |
| 次元数 | **768** (DB側設定済み) |
| 推奨リージョン | `us-central1` |

### Supabase Secrets (登録済み)

| 名前 | 内容 |
|---|---|
| `GCP_SA_KEY` | サービスアカウントJSON全体 (改行含むJSON文字列) |
| `GCP_PROJECT_ID` | `insights-embedding` ← **登録済み** |

これらはSupabase Dashboard → Project Settings → Edge Functions → Secrets で確認可能。

---

## 2. 設計の前提と意思決定 (重要な経緯)

### 設計判断の概要

#### 判断1: 単一テーブル + JSON配列に統一
- AI駆動利用前提なので、INSERT 1回で完結する設計
- タグは `TEXT[]` 配列、関連付けは embedding/Claude判定で代替

#### 判断2: 原文と整形版を別カラムで分離
- `content`: ユーザー原文 (不変・一次資料)
- `content_normalized`: AI整形版 (検索精度向上用)
- `ai_commentary`: AI解説 (価値ある時のみ)
- `summary`: 短い要約

#### 判断3: 長文は3階層構造
```
insights → insight_documents (本体) → document_chunks (検索用)
```

#### 判断4: Markdown を基本形式
- AI出力は元々ほぼMarkdown
- `content_format` カラムで明示

#### 判断5: embedding は Google Vertex AI で生成
- 検討経緯:
  - Anthropicは embedding API を提供していない (公式)
  - OpenAI と Google を比較: コスト・性能ともGoogleが優位 (Google: $0.006/M, OpenAI: $0.02/M)
  - mkさんは既にGCPアカウント保有
  - 日本語コンテンツが中心なので、多言語性能の高いGoogleが好適
- **採用モデル**: `text-embedding-005` (768次元)

#### 判断6: Edge Function でリアルタイム生成
- INSERT/UPDATE トリガで Edge Function を呼ぶ
- pg_net 拡張を使用
- Claude Routine は別用途 (朝のダイジェスト等の判断処理) で活用予定

#### 判断7: セキュリティは段階的に強化
- **検証フェーズ (現状)**: service_role 使用
- **動作確認後 (将来)**: insights_writer ロールへ切り替え (改善タスクB)

---

## 3. 現在のスキーマ詳細

### テーブル構成

```
insights (id=1, 3, 5 が存在 / id=2, 4 は欠番)
  ├─ insight_documents
  │    ├─ id=1 (deep_research, 4 chunks for insight_id=1)
  │    └─ id=2 (deep_research, 32,263字, 12 chunks for insight_id=5)  ← 新規
  └─ document_chunks: 計16件 (4 + 12) すべて embedding 済み
```

→ **全レコード embedding 済み (insights 3件 / chunks 16件)。**

### insights テーブル

| カラム | 型 | 重要事項 |
|---|---|---|
| id | bigint | 主キー |
| title | text | 空文字禁止、最大500字 |
| content | text | **原文不変ルール**。空禁、最大100,000字 |
| content_normalized | text | AI整形版。最大100,000字 |
| ai_commentary | text | AI解説。最大10,000字 |
| summary | text | 要約。最大1,000字 |
| category | text | work/learning/journal/idea/question (自由) |
| tags | text[] | 最大20個 |
| importance | smallint | 1-5 (デフォルト3) |
| confidence | smallint | 1-5 |
| source_app | text | claude_ai/chatgpt/perplexity/claude_desktop/codex/manual |
| source_model | text | |
| source_type | text | conversation/book/article/meeting/experience |
| source_title | text | |
| source_url | text | |
| original_prompt | text | |
| session_ref | text | |
| language | text | デフォルト 'ja' |
| content_format | text | 'markdown'/'plaintext'/'html' |
| **embedding** | **vector(768)** | ✅ 768次元、全レコード生成済み |
| embedding_model | text | 'text-embedding-005' を記録 |
| metadata | jsonb | デフォルト '{}' |
| is_archived | boolean | デフォルト false (ソフト削除) |
| created_at | timestamptz | |
| updated_at | timestamptz | トリガで自動更新 |

### insight_documents テーブル

| カラム | 型 | 備考 |
|---|---|---|
| id | bigint | |
| insight_id | bigint | FK → insights.id (CASCADE) |
| doc_type | text | fulltext/deep_research/transcript/reference/other |
| title | text | |
| body | text | **原文不変**。空禁、最大1,000,000字 |
| source_app/source_model/source_url | text | |
| content_format | text | デフォルト 'markdown' |
| metadata | jsonb | |
| created_at/updated_at | timestamptz | |

### document_chunks テーブル

| カラム | 型 | 備考 |
|---|---|---|
| id | bigint | |
| document_id | bigint | FK → insight_documents.id (CASCADE) |
| chunk_index | int | 0始まり、 < chunk_total |
| chunk_total | int | |
| body | text | **親ドキュメントの該当部分そのまま**。最大5,000字 |
| section_title | text | |
| section_path | text[] | |
| **embedding** | **vector(768)** | ✅ 768次元、全16件生成済み |
| embedding_model | text | |
| metadata | jsonb | |
| created_at | timestamptz | |

UNIQUE: (document_id, chunk_index)

---

## 4. 既存の関数・ビュー一覧

| 名前 | 種別 | 用途 |
|---|---|---|
| `update_updated_at()` | トリガ関数 | updated_at自動更新 |
| `search_insights(...)` | 関数 | 統合検索 (引数 query_embedding は VECTOR(768)) |
| `search_chunks(...)` | 関数 | チャンク単位の検索 (VECTOR(768)) |
| `get_document_with_chunks(p_document_id)` | 関数 | ドキュメント全文取得 |
| `replace_document_chunks(p_document_id, p_chunks)` | 関数 | チャンク全置換登録 (VECTOR(768)) |
| `list_recent_insights(...)` | 関数 | 軽量な最近一覧 |
| `get_insights_stats()` | 関数 | カテゴリ/タグ/期間別統計 |
| `trigger_generate_embedding_insights()` | トリガ関数 | insights INSERT/UPDATE 時に Edge Function を非同期呼出 |
| `trigger_generate_embedding_chunks()` | トリガ関数 | document_chunks INSERT/UPDATE 時に Edge Function を非同期呼出 |
| `insights_list_view` | ビュー | 一覧表示用軽量ビュー |

### Edge Function: `generate-embedding`

**document mode と query mode の両対応** (Task 6 で query mode を追加)。

| mode | 入力 | 動作 |
|---|---|---|
| `document` (デフォルト) | `{table, id, text, task_type?}` | 768-dim embedding を生成し、該当レコードを UPDATE。`task_type` のデフォルトは `RETRIEVAL_DOCUMENT` |
| `query` | `{mode: "query", text, task_type?}` | 768-dim embedding を返すのみ (DB書込なし)。`task_type` のデフォルトは `RETRIEVAL_QUERY` |

`mode: "query"` を使うことで、検索クエリ側の embedding 生成を Edge Function 経由で統一できる。

---

## 5. 運用ルール (厳守事項)

### 原文不変
- `insights.content`: ユーザー入力をそのまま保存。AIによる加筆・整形・要約・誤字修正・文法修正は禁止
- `insight_documents.body`: 原文ママ
- `document_chunks.body`: 親ドキュメントの該当部分をそのまま切り出し

### 整形・解説の保存先
- 整形版 → `content_normalized`
- 解説 → `ai_commentary` (AIが価値あると判断した時のみ)
- 要約 → `summary`
- 自由メタ → `metadata`

### 物理削除の回避
- DELETEは原則使わず `is_archived = TRUE` でソフト削除

### 必須メタ情報
- `source_app` (どのAIから保存されたか)
- `content_format` ('markdown' が基本)
- `language` ('ja' が基本)

### embedding 生成ルール
- **対象**: `insights.content_normalized` (NULLなら `content`) を使用
- **document_chunks**: `body` を使用
- **モデル**: text-embedding-005 (768次元)
- **task_type**: RETRIEVAL_DOCUMENT (保存時) / RETRIEVAL_QUERY (検索時)
- **embedding_model カラム**: 'text-embedding-005' を必ず記録

---

## 6. 既存データの状況 (2026-05-03 時点)

### insights テーブル (3件、全件 embedding 済み)

| id | title | source_app | importance | embedding |
|---|---|---|---|---|
| 1 | AI駆動DBは単一テーブル+JSON配列でシンプルに保つべき | claude_ai | 4 | ✅ |
| 3 | AIとデータの分離による「マルチAI対応データ基盤」という新しい構造 | claude_ai | 5 | ✅ |
| 5 | 空港DXを加速させるマルチエージェントシステムの戦略的実装 | codex | 3 | ✅ (補正済) |

### insight_documents テーブル (2件)

| id | insight_id | doc_type | body 長 | chunks |
|---|---|---|---|---|
| 1 | 1 | deep_research | (既存) | 4 |
| 2 | 5 | deep_research | **32,263字** | **12** |

### document_chunks テーブル (16件、全件 embedding 済み)

- document_id=1 → 4 chunks
- document_id=2 → 12 chunks (preamble + 第1〜6章 + 第7章を5パートに分割)

### id=5 の課題 — **解決済み (2026-05-03 Claude Code セッション)**

> 履歴として残す。再構築時のリファレンス価値あり。

**経緯**: mkさんが Gemini Web の Deep Research で生成したレポートを、Claude.ai 上で **Haikuモデル**を介して保存テストした際、保存処理が**途中で完了したことになっていた**。実態:

| 項目 | 想定 | 実態 (補正前) | 補正後 |
|---|---|---|---|
| insights への要約保存 | ✅ 必要 | ✅ 339字保存済み | ✅ |
| insight_documents への全文保存 | ✅ 必要 | ❌ 未保存 | ✅ **32,263字保存** |
| document_chunks への章別チャンク保存 | ✅ 必要 (約7章) | ❌ 未保存 | ✅ **12 chunks** |

**文字数の補足**: 元 metadata の `char_count: 150892` は誤値。実体は **32,267字** (DB body は 32,263字、4字差は `\_` 等のエスケープ正規化由来)。Haiku セッション時の文字数推定に過大な誤差があったと判断される。

**元データ**: mkさん手元に保管済み (再現可能)

---

## 7. Claude Code で実施したタスク (履歴・リファレンス)

> 全タスク完了済み。以下は**再構築時の参照用**として残す。

### タスク2: id=5 レコードの補正 — ✅ 完了 (2026-05-03)

#### 概要
mkさんが手元に保管している Gemini Deep Research の元データ (Markdown形式) を、id=5 レコードに正しく紐付けて保存。

#### 手順 (実施済み)

**Step 2-1: 既存レコードの確認**
```sql
SELECT id, title, source_app, source_model, source_type, tags, metadata
FROM insights WHERE id = 5;
```

**Step 2-2: 不足メタ情報の補正**
```sql
UPDATE insights
SET
  source_model = 'gemini-deep-research',
  source_type  = 'research_report',
  tags         = ARRAY['空港DX', 'マルチエージェント', 'AI', 'Gemini', 'Deep Research', 'MAGS', 'A2Aプロトコル'],
  metadata     = metadata || jsonb_build_object(
    'original_source', 'gemini_web_deep_research',
    'haiku_save_incomplete', true,
    'corrected_at', NOW()::text,
    'corrected_by', 'claude_code'
  )
WHERE id = 5;
```

**Step 2-3: insight_documents に全文を保存**
```sql
INSERT INTO insight_documents (
  insight_id, doc_type, title, body, source_app, content_format, metadata
) VALUES (
  5,
  'deep_research',
  '空港DXを加速させるマルチエージェントシステムの戦略的実装と高度活用シナリオに関する包括的分析',
  $body_text,
  'gemini',
  'markdown',
  jsonb_build_object(
    'source_origin', 'gemini_web_deep_research',
    'imported_via', 'claude_code',
    'char_count', LENGTH($body_text)
  )
)
RETURNING id;
-- 実際: id=2 が返った
```

**Step 2-4: 章別チャンク分割**

下のSQL/擬似コードはサンプル。**実際のチャンク分割は Python での H2/H3 ベースのアルゴリズムで行った** (preamble + 7章 + 第7章を5パートに分割で計12チャンク)。

```typescript
// 擬似コード (リファレンス)
function splitIntoChunks(markdown: string): Chunk[] {
  // # / ## で大章を分割
  // 5,000字超の章は段落・節単位でさらに分割
  // 各 chunk: { body, section_title, section_path, metadata }
  return [];
}
```

**Step 2-5: replace_document_chunks() でチャンク登録**
```sql
SELECT replace_document_chunks(
  2,  -- 新document_id
  '[
    {"body": "...", "section_title": "preamble", "section_path": []},
    {"body": "...", "section_title": "第1章 序論", "section_path": ["第1章 序論"]},
    ...
  ]'::jsonb
);
```

**Step 2-6: 検証** (実行済み・OK)

---

### タスク3: Edge Function 実装 — ✅ 完了 (2026-05-03)

#### 仕様 (実装版)

**Function名**: `generate-embedding`

**役割**:
- document mode: 対象テーブル・ID・テキストを受け取り、Vertex AI で embedding 生成 → 該当レコードを UPDATE
- query mode: テキストを受け取り、embedding を返すのみ (DB書込なし)

**入力 (document mode)**:
```json
{
  "table": "insights" | "document_chunks",
  "id": 123,
  "text": "embedding対象テキスト",
  "task_type": "RETRIEVAL_DOCUMENT"
}
```

**入力 (query mode)**:
```json
{
  "mode": "query",
  "text": "検索クエリテキスト",
  "task_type": "RETRIEVAL_QUERY"
}
```

**出力 (document mode)**:
```json
{ "success": true, "embedding_dimensions": 768 }
```

**出力 (query mode)**:
```json
{ "success": true, "embedding": [0.1, 0.2, ...], "embedding_dimensions": 768 }
```

#### 認証

`GCP_SA_KEY` から Service Account JSON をパース。SA の `private_key` で JWT(RS256) 署名 → OAuth2 token endpoint で access_token 取得 → Vertex AI 呼び出し。

```typescript
const SA = JSON.parse(Deno.env.get("GCP_SA_KEY")!);

async function getAccessToken(): Promise<string> {
  // header: { alg: 'RS256', typ: 'JWT' }
  // payload: { iss: SA.client_email, scope, aud: 'https://oauth2.googleapis.com/token', exp, iat }
  // crypto.subtle.importKey + sign で RS256 署名
  // POST https://oauth2.googleapis.com/token
}

async function generateEmbedding(text: string, taskType: string): Promise<number[]> {
  const token = await getAccessToken();
  const projectId = Deno.env.get("GCP_PROJECT_ID")!;
  const url = `https://us-central1-aiplatform.googleapis.com/v1/projects/${projectId}/locations/us-central1/publishers/google/models/text-embedding-005:predict`;
  const res = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ instances: [{ content: text, task_type: taskType }] })
  });
  const data = await res.json();
  return data.predictions[0].embeddings.values; // 768
}
```

---

### タスク4: DBトリガー実装 — ✅ 完了 (2026-05-03)

#### pg_net 拡張の有効化
```sql
CREATE EXTENSION IF NOT EXISTS pg_net;
```

#### service_role key を Vault に保存
```sql
SELECT vault.create_secret(
  '<service_role_key>',
  'service_role_key',
  'Used by DB triggers to call Edge Functions'
);
```

#### insights 用トリガー
```sql
CREATE OR REPLACE FUNCTION trigger_generate_embedding_insights()
RETURNS TRIGGER AS $$
DECLARE
  text_to_embed TEXT;
  request_id BIGINT;
  service_key TEXT;
BEGIN
  text_to_embed := COALESCE(NEW.content_normalized, NEW.content);

  IF (TG_OP = 'INSERT') OR
     (OLD.content IS DISTINCT FROM NEW.content) OR
     (OLD.content_normalized IS DISTINCT FROM NEW.content_normalized) THEN

    SELECT decrypted_secret INTO service_key
    FROM vault.decrypted_secrets WHERE name = 'service_role_key';

    SELECT net.http_post(
      url := 'https://gntgcxdbcbywfboejimz.supabase.co/functions/v1/generate-embedding',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || service_key
      ),
      body := jsonb_build_object(
        'table', 'insights',
        'id', NEW.id,
        'text', text_to_embed,
        'task_type', 'RETRIEVAL_DOCUMENT'
      )
    ) INTO request_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_insights_generate_embedding
  AFTER INSERT OR UPDATE OF content, content_normalized ON insights
  FOR EACH ROW
  EXECUTE FUNCTION trigger_generate_embedding_insights();
```

#### document_chunks 用トリガー
同様に `body` カラム変更を検知して呼ぶ (`trigger_generate_embedding_chunks`)。

---

### タスク5: バックフィル — ✅ 完了 (2026-05-03)

既存の id=1, 3, 5 (insights) と全 16 chunks に対して、Edge Function 経由で embedding を生成。

```typescript
const { data: insights } = await supabase
  .from('insights')
  .select('id, content, content_normalized')
  .is('embedding', null);

for (const row of insights ?? []) {
  const text = row.content_normalized ?? row.content;
  await fetch(`${SUPABASE_URL}/functions/v1/generate-embedding`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${SERVICE_ROLE_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      table: 'insights', id: row.id, text, task_type: 'RETRIEVAL_DOCUMENT'
    })
  });
  // レート制限考慮で適宜スリープ
}
```

結果: insights 3件 + chunks 16件 全件 embedded。

---

### タスク6: 動作テスト — ✅ 完了 (2026-05-03)

#### 検証SQL
```sql
-- embedding 生成状況
SELECT id, title, (embedding IS NOT NULL) AS has_embedding, embedding_model
FROM insights ORDER BY id;

SELECT chunk_index, section_title, (embedding IS NOT NULL) AS has_embedding
FROM document_chunks ORDER BY document_id, chunk_index;

-- セマンティック検索: query mode で embedding 化 → search_chunks へ
```

#### 発見した課題
検索品質に関して以下を発見 → §12 落とし穴10〜13 として追記:
- 短いチャンクが抽象的なクエリで人為的に高スコアを示す
- `search_insights` のハイブリッド AND 動作で取りこぼし
- 入力長と pg_net 非同期ラグの注意点

---

## 8. 重要な教訓 (今回のテストから学んだこと)

### 教訓1: モデル選択の重要性

| モデル | 適性 | 理由 |
|---|---|---|
| Haiku | ❌ 不向き | 多段階処理を完遂しきれない、「準備完了」と誤認識して終わる傾向 |
| Sonnet | ⚪ 適している | 多くの作業に対応可能 |
| Opus | ◎ 推奨 | 複雑な処理・推論・大量データ処理 |
| Claude Code (Sonnet/Opus) | ◎ 最適 | ファイル操作・段階的検証で確実性高い |

**ルール**: 多段階で複雑な保存処理は **Sonnet 以上**を選択する。

### 教訓2: 「保存準備完了」と「実際に保存された」は別

AIが「✅ 保存完了」と言っても、実際にはINSERTが実行されていないことがある。**必ず以下で検証**:

```sql
SELECT COUNT(*) FROM <table>;

SELECT i.id, COUNT(d.id) AS doc_count
FROM insights i
LEFT JOIN insight_documents d ON d.insight_id = i.id
GROUP BY i.id;
```

### 教訓3: AI保存品質のばらつき

ChatGPT/Codex等から保存する際、AIによって以下のばらつきが発生する:
- タグ付与の有無
- メタ情報(source_model 等)の記録の有無
- 3階層構造の正しい使い分け
- 全文と要約の混同

**対策**:
- スキーマコメントを明確にする (済)
- AIに渡すプロンプトテンプレートを整備 (このドキュメントの「9. ChatGPT接続設定」参照)
- 定期的なデータ品質チェック(get_insights_stats等で異常検知)

### 教訓4: 元データは必ず手元に保管

AI経由の保存で失敗した場合、元データがあれば再保存できる。**手元保管は必須**。

---

## 9. ChatGPT接続設定 (mkさん操作 — Task 7)

### 接続URL
```
https://mcp.supabase.com/mcp?project_ref=gntgcxdbcbywfboejimz&read_only=false&features=database,docs
```

### 設定手順
1. ChatGPT → 設定 → コネクタ → 詳細設定 → Developer Mode を ON
2. コネクタ → カスタムコネクタ作成
3. 上記URLを MCP Server URL に設定
4. OAuth認証でSupabaseログイン
5. チャット画面で More → Developer Mode 有効化

### 推奨プロンプト (Deep Research保存時)

```
SupabaseのMCP経由で、以下のDeep Research結果をDBに保存してください。

【保存先DB構造】
- insights: メタ情報と要約 (必須、全レコード)
- insight_documents: 全文を原文ママ保存 (必須、全レコード、doc_type='deep_research')
- document_chunks: 章・節単位で分割 (必須、replace_document_chunks関数を使用)

【厳守事項 - 全て満たすこと】
1. insights.content_format='markdown' を指定
2. insights.source_app='chatgpt' を指定 (実態に合わせて)
3. insights.tags は配列で適切に設定 (NULL不可)
4. insights.content には要約のみ、全文は insight_documents.body へ
5. 原文の改変は禁止 (要約以外)
6. 既存レコードのDELETE/UPDATEは行わない
7. 各処理を完了したら結果のIDを返すこと

【重要 - 完了確認】
保存後、以下のSQLを実行して結果を返してください:

SELECT
  i.id AS insight_id,
  i.title,
  i.tags,
  d.id AS doc_id,
  LENGTH(d.body) AS body_length,
  (SELECT COUNT(*) FROM document_chunks WHERE document_id = d.id) AS chunk_count
FROM insights i
LEFT JOIN insight_documents d ON d.insight_id = i.id
WHERE i.id = <new_insight_id>;

【保存対象】
[ここに本文を貼る]
```

---

## 10. AI駆動利用の典型パターン (SQLサンプル)

### 短い気づきの保存
```sql
INSERT INTO insights (
  title, content, summary, category, tags,
  importance, source_app, source_model, source_type,
  language, content_format
) VALUES (
  'タイトル',
  '原文そのまま',
  'AIによる要約',
  'learning',
  ARRAY['タグ1', 'タグ2'],
  4, 'chatgpt', 'gpt-5', 'conversation',
  'ja', 'markdown'
);
-- ↑トリガで自動的にEdge Function呼び出し → embedding生成 (5-15秒のラグあり)
```

### Deep Research保存
```sql
WITH new_insight AS (
  INSERT INTO insights (title, content, summary, source_app, tags, content_format, ...)
  VALUES (...)
  RETURNING id
),
new_doc AS (
  INSERT INTO insight_documents (insight_id, doc_type, body, content_format, ...)
  SELECT id, 'deep_research', '<全文>', 'markdown', ... FROM new_insight
  RETURNING id
)
SELECT replace_document_chunks(
  (SELECT id FROM new_doc),
  '[ {"body": "...", "section_title": "..."}, ... ]'::jsonb
);
```

### 検索
```sql
-- キーワード検索
SELECT * FROM search_insights(query_text => '組織論');

-- セマンティック検索 (query mode で embedding 化したベクトルを投入)
SELECT * FROM search_insights(query_embedding => '[0.1, 0.2, ...]'::vector(768));

-- 一覧
SELECT * FROM list_recent_insights(days_back => 30);
```

### ソフト削除
```sql
UPDATE insights SET is_archived = TRUE WHERE id = <ID>;
```

---

## 11. マイグレーション履歴

時系列で**14本適用済み**:

| # | バージョン | 名称 |
|---|---|---|
| 1 | 20260502134820 | create_insights_schema |
| 2 | 20260502135223 | extend_insights_for_multi_ai_integration |
| 3 | 20260502135247 | setup_rls_policies_personal_use |
| 4 | 20260502135849 | reset_and_rebuild_ai_driven_schema |
| 5 | 20260502140236 | harden_operations_minimal |
| 6 | 20260502140945 | add_long_documents_support |
| 7 | 20260502142425 | clarify_content_verbatim_rule |
| 8 | 20260502143332 | add_normalized_and_commentary_columns |
| 9 | 20260502144435 | add_document_chunks_for_long_text |
| 10 | 20260502144511 | add_chunk_management_functions |
| 11 | 20260502144920 | add_format_listing_and_stats |
| 12 | 20260502...     | change_embedding_dimensions_to_768 |
| 13 | 20260503010000 | **enable_pg_net_extension** ← Task 4 |
| 14 | 20260503020000 | **add_embedding_trigger** ← Task 4 (最新) |

---

## 12. 注意点・既知の落とし穴

### 落とし穴1: pg_net とトリガーの非同期性
- pg_net は非同期なので、INSERT直後にembeddingがあるとは限らない
- 数秒〜数十秒のラグを想定
- 検索時にNULLを除外するか、リトライ機構が必要

### 落とし穴2: service_role keyの取り扱い
- Vault機能で保存することを推奨
- 平文でDBに置かない

### 落とし穴3: Vertex AI のJWT認証
- OpenAIのようなシンプルなAPIキーではない
- Service Account JSON の private_key を使ってJWT署名 → OAuth2 token endpoint で access_token を取得 → それを使ってAPI呼び出し
- access_tokenは1時間有効なので、Edge Function起動ごとに取得 (キャッシュ不要)

### 落とし穴4: text-embedding-005 のリージョン
- `us-central1` を推奨 (公式サンプルもこれ)

### 落とし穴5: task_type の使い分け
- 保存時: `RETRIEVAL_DOCUMENT`
- 検索時: `RETRIEVAL_QUERY`

### 落とし穴6: プロンプトインジェクション
- 外部データに「全データ削除して」が混入する可能性
- 対策: ツール実行を都度承認、ソフト削除運用

### 落とし穴7: id=2, 4 の欠番
- 検証中の修正で欠番。実害なし

### 落とし穴8: AIによる多段階保存処理の不完全性
- Haikuでは多段階処理が途中で止まることが多い
- Sonnet/Opus でも、必ず保存後の検証SQL実行で確認すること

### 落とし穴9: text-embedding-005 の入力上限
- 1リクエストの最大トークン: 約2,048
- 日本語の場合、目安として最大3,000-4,000字程度
- それ以上の場合はチャンク化が必須(本DBはチャンク化前提)

### 落とし穴10: `search_chunks` の短いチャンク偏重 ⚠️ (Task 6 で発見)
- cosine類似度は文の長さに対して中立だが、**極端に短いチャンク (34〜71字)** が抽象的なクエリで人為的に高スコアを示す傾向
- 短文は方向ベクトルのバラツキが小さく、平均的な意味ベクトルに近づきやすいため
- **対応案**:
  - クエリ側で `LENGTH(body) >= 100` フィルタを追加
  - length-aware な重み付け (例: `score * log(LENGTH(body))` 等)
  - 改善タスク A の一環として対応予定

### 落とし穴11: `search_insights` のハイブリッドモードは AND 動作 ⚠️ (Task 6 で発見)
- `query_text` と `query_embedding` の両方を指定した場合、**両方でヒットしないと返らない**可能性
- セマンティック類似だがキーワード一致しない件、あるいは逆のケースが取りこぼされる
- **対応案**: 用途によっては OR / 重み付け (e.g. `0.6 * vec_score + 0.4 * fts_score`) に変更検討
- 改善タスク A の一環として対応予定

### 落とし穴12: トリガー由来の embedding 生成における入力長 ⚠️ (Task 6 で発見)
- text-embedding-005 の上限 ~2,048トークン (~3,000〜4,000日本語字)
- 現状、`document_chunks.body` は 5,000字制約だが、これを超える `content_normalized` が `insights` に来ると **Vertex AI 側でエラー** になる可能性
- **対応案**: Edge Function 側に長さ guard (truncate or 分割) を入れる (改善タスク D)

### 落とし穴13: pg_net 非同期によるバックフィル時の挙動 ⚠️ (Task 6 で発見)
- INSERT/UPDATE 直後の SELECT では embedding がまだ NULL のことがある (**5〜15秒のラグ**)
- 落とし穴1 と本質は同じだが、**ユーザー操作の文脈で見えやすい問題**として明記
- 対策: 保存直後に embedding を確認したい場合はポーリング (例: `SELECT embedding IS NOT NULL ...` を数秒間隔で5回程度)

---

## 13. 設計の根拠 (より深く理解したい場合)

### なぜGoogle Vertex AIを選んだか
- **コスト**: $0.006/M tokens (OpenAIの1/3)
- **日本語性能**: 多言語モデルとして優秀
- **既存資産活用**: mkさんはGCPアカウント保有
- **十分な品質**: MTEB 63.8点

### なぜEdge Functionか (Routineではなく)
- **リアルタイム処理**: INSERT直後にembedding生成
- **コスト**: 無料枠内で十分 (50万回/月)
- **AI判断不要**: embedding生成は単純変換、Routineはオーバースペック
- **Claude使用量を消費しない**

### なぜ Routine も併用予定か
- AI判断が必要な処理 (朝のダイジェスト、重複検出、タグ整理) で活用

### なぜ Anthropic は embedding API を提供しないか
- 公式: <https://docs.claude.com/en/docs/build-with-claude/embeddings>
- 業界分析: 埋め込みモデルはコモディティ化、Anthropicは生成モデルに集中
- 推奨パートナー: Voyage AI

---

## 14. 用語集

| 用語 | 意味 |
|---|---|
| MCP | Model Context Protocol |
| RLS | Row Level Security |
| HNSW | 高速近似最近傍検索アルゴリズム |
| pgvector | Postgres用のベクトル型・検索拡張機能 |
| pg_trgm | trigramベースの類似検索拡張機能 |
| pg_net | PostgresからHTTPリクエストを送る拡張 |
| service_role | Supabaseの管理者権限ロール |
| Service Account | GCPのプログラム用認証アカウント |
| JWT | JSON Web Token |
| Edge Function | Supabaseのサーバーレス関数 (Deno runtime) |
| Routine | Claude Codeのクラウド定期実行 |
| Vertex AI | GCPの統合AI/MLプラットフォーム |
| text-embedding-005 | Google Vertex AI のテキスト埋め込みモデル (768次元) |
| Vault | Supabaseのシークレット保管機能 |
| query mode | Edge Function `generate-embedding` の検索クエリ用モード (DB書込なし、`RETRIEVAL_QUERY` がデフォルト) |
| document mode | Edge Function `generate-embedding` の保存用モード (該当レコードを UPDATE、`RETRIEVAL_DOCUMENT` がデフォルト) |

---

## 15. このドキュメントの使い方

**実装は完了済み**。本ドキュメントは**現状把握 + 改善タスク用**のリファレンス。

### 通常の現状把握
1. §0 でタスク状態と将来改善を確認
2. §3 でスキーマ概観
3. §6 で現在のデータ状況

### 改善タスク着手時の参照順
1. §0 「将来の改善タスク」 で対象タスクを選ぶ
2. §12 落とし穴 で関連する既知問題を確認
3. 関連する §7 タスク詳細 (履歴) で過去の実装パターンを参照
4. §13 設計の根拠 で背景・思想を確認

### 新規データ追加・運用時
- §10 SQLサンプル を参照
- §5 運用ルール (原文不変等) を遵守
- §9 ChatGPT接続 (Task 7 完了後)

### エラー発生時
- まず §12 落とし穴 を確認
- pg_net ラグ系: 落とし穴1, 13
- 検索品質系: 落とし穴10, 11
- 入力長系: 落とし穴9, 12

### 教訓の参照
- §8 重要な教訓 — 作業の進め方の指針 (時間とともに価値が増す)

---

**END OF DOCUMENT v4**
