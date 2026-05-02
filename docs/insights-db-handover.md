# Insights DB プロジェクト引き継ぎドキュメント

> **作成日**: 2026-05-03
> **対象**: Claude Code での継続作業
> **作成元**: [claude.ai](http://claude.ai) (Claude Opus 4.7) との対話履歴より

---

## 0. このドキュメントの読み方

本ドキュメントは、[claude.ai](http://claude.ai)での対話を通じて構築した「気づき・学び保存DB」の設計判断と現状のスキーマ、運用ルールを網羅的にまとめたものです。Claude Codeで作業を継続する際は、まず本ドキュメント全体を読んだ上で、関連するセクションを参照してください。

**重要セクション(必読)**:
- [2. プロジェクト基本情報](#2-プロジェクト基本情報) — Supabase接続情報
- [3. 設計の前提と意思決定](#3-設計の前提と意思決定) — なぜこの設計になったか
- [5. 現在のスキーマ詳細](#5-現在のスキーマ詳細) — テーブル構造の正確な仕様
- [7. 運用ルール](#7-運用ルール) — 厳守事項
- [10. 次のアクション](#10-次のアクション) — 未着手のタスク

---

## 1. プロジェクト概要

### 目的

複数のAIアプリ([Claude.ai](http://Claude.ai) / ChatGPT / Perplexity / Claude Desktop / Codex 等)から、MCP経由で共通利用できる**個人用の気づき・学び保存データベース**を Supabase 上に構築する。

### 用途

- 仕事のメモ・ナレッジ蓄積
- 読書・学習の記録
- 日々の内省ジャーナル
- Deep Research結果の保存
- 上記すべてを統合管理

### 利用形態

- **基本前提**: AI駆動利用 (AIが書き、AIが読む)
- **想定アクセス元**: 複数AIアプリのMCPクライアント
- **想定スケール**: 個人利用 (10年で~36,500件規模)
- **検証〜本格運用**: 段階移行を想定

---

## 2. プロジェクト基本情報

### Supabase プロジェクト

| 項目 | 値 |
|---|---|
| **プロジェクト名** | chatDB |
| **Project Ref / ID** | `gntgcxdbcbywfboejimz` |
| **組織ID** | `hiiayixtpcazarfhpjyz` |
| **リージョン** | `ap-southeast-1` (Singapore) |
| **Postgres バージョン** | 17.6.1.111 |
| **プラン** | Free |
| **作成日** | 2026-05-02 |
| **DB ホスト** | `[db.gntgcxdbcbywfboejimz.supabase.co](http://db.gntgcxdbcbywfboejimz.supabase.co)` |
| **MCP Server URL** | `https://mcp.supabase.com/mcp?project_ref=gntgcxdbcbywfboejimz` |

### 拡張機能

- `vector` (pgvector) — セマンティック検索用
- `pg_trgm` — 日本語含むキーワード検索高速化用

---

## 3. 設計の前提と意思決定

### 3.1 機能要件 (ユーザー回答ベース)

| 質問 | 回答 |
|---|---|
| 用途 | 仕事メモ・読書・内省ジャーナル全部統合 |
| 必要機能 | タグ分類、出典記録、重要度、関連付け |
| 利用主体 | 基本AIから利用 (人が直接入力する想定は薄い) |
| 連携先 | Claude / ChatGPT / Perplexity / Codex 等の複数AI |
| 運用方針 | 検証用途だが継続使用想定。シンプル+最低限の制御 |

### 3.2 設計上の重要な判断

#### 判断1: 単一テーブル設計 vs 正規化

**最終判断: 単一テーブル + JSON配列に統一**

- AIが書き込み主体の場合、多対多正規化はINSERTで複数クエリ必要 = 重い
- タグは `TEXT[]` 配列 + GINインデックスで十分
- 関連付けは `embedding` のセマンティック検索で代替可能
- 後でデータ量が増えてから正規化するのは容易

#### 判断2: 原文保持 vs AI整形

**最終判断: 原文と整形版を別カラムで分離**

- `content`: ユーザーの原文 (不変・一次資料)
- `content_normalized`: AI整形版 (検索精度向上用)
- `ai_commentary`: AI解説 (価値ある時のみ付与)
- `summary`: AIによる短い要約

**経緯**: 当初は「contentにAIが整理して入れる」設計だったが、ユーザーから「自分が書いた言葉とAIの言葉が混ざる」と指摘され、4階層構造に分離。

#### 判断3: 長文への対応

**最終判断: 3階層構造 (insights → insight_documents → document_chunks)**

| 文字数 | 格納先 |
|---|---|
| 〜100,000字 | `insights.content` のみ |
| 100,000字超 | `insights.content`に要約 + `insight_documents.body` に全文 |
| Deep Research等 | 上記 + `document_chunks` でチャンク分割 |

**チャンク分割の役割**:
- 各チャンクは原文の該当部分そのまま(改変なし)
- 独立した embedding を持ちピンポイント検索可能
- ChatGPTやClaudeから「この部分」を抽出する用途

#### 判断4: AI解説の付与方針

**最終判断: AIが価値があると判断した時のみ付ける**

- デフォルトはNULL
- 「3つの段階を経た発想の転換」のような構造化や、関連知識の補強等、振り返りに役立つ場合に付与
- `metadata.commentary_added_reason` に付与理由を記録

#### 判断5: 正規化の整形範囲

**最終判断: 表記統一+誤字修正+文法修正まで含める**

- 半角スペース除去、表記ゆれ統一
- 明確な誤字修正、文法的におかしい箇所の修正
- 意味の補完も限定的に許容(原文が残っているため)
- ただし「読みにくい文章の再構成」は不可
- `metadata.normalized_changes` に変更内容を記録

#### 判断6: テキスト形式

**最終判断: Markdown を基本形式とする**

- AI出力は元々ほぼMarkdown形式
- プレーン化は情報損失
- HTMLタグはノイズが多い
- `content_format` カラムで明示 ('markdown' / 'plaintext' / 'html')

#### 判断7: セキュリティと運用工数のバランス

**最終判断: 最低限の整備で実用に耐える設定**

| 項目 | 採用 | 理由 |
|---|---|---|
| RLS有効化 | ✅ | 万一のキー漏洩保護 |
| 専用ロール `insights_writer` | ✅ | service_role直接利用回避 |
| 入力バリデーション | ✅ | AI暴走時の品質担保 |
| ソフト削除 | ✅ | AI誤操作対策 |
| PITR | ❌ | $25/月、検証フェーズには過剰 |
| 監査ログ | ❌ | 個人利用には過剰、source_appで十分 |
| Edge Functions経由API | ❌ | 工数が大きい、MCP直接で簡素化 |

---

## 4. データベース構造概観

### 全体構造

```
insights (気づき・学びのメタ情報・本体)
  ├─ insight_documents (長文ドキュメント本体・原文不変)
  │    └─ document_chunks (検索用チャンク・原文の該当部分そのまま)
  ↑
  最大100,000字までは insights.content だけで完結
```

### テーブル一覧

| テーブル | 行数(現時点) | 役割 |
|---|---|---|
| `insights` | 2 | 気づき・学びの本体テーブル(メタ情報・要約・タグ等) |
| `insight_documents` | 1 | 長文ドキュメント格納(Deep Research/書籍/トランスクリプト等) |
| `document_chunks` | 4 | 長文を意味的単位で分割したチャンク(検索用) |

---

## 5. 現在のスキーマ詳細

### 5.1 `insights` テーブル

**用途**: 気づき・学びの本体。メタ情報と本文を保持。

| カラム | 型 | NULL | デフォルト | 制約・説明 |
|---|---|---|---|---|
| `id` | bigint | NO | sequence | 主キー |
| `title` | text | NO | - | 1行タイトル(空文字禁止、最大500字) |
| `content` | text | NO | - | 本文(空文字禁止、最大100,000字)。**原文不変** |
| `content_normalized` | text | YES | - | AI整形版(最大100,000字)、検索精度向上用 |
| `ai_commentary` | text | YES | - | AI解説(最大10,000字)、価値ある時のみ |
| `summary` | text | YES | - | AI要約(最大1,000字) |
| `category` | text | YES | - | 大分類(例: work / learning / journal / idea / question) |
| `tags` | text[] | NO | `{}` | タグ配列(最大20個) |
| `importance` | smallint | NO | 3 | 重要度 1-5 |
| `confidence` | smallint | YES | - | 確信度 1-5 (1=仮説, 5=確信) |
| `source_app` | text | YES | - | 保存元: claude_ai / chatgpt / perplexity / claude_desktop / codex / manual |
| `source_model` | text | YES | - | AIモデル名 |
| `source_type` | text | YES | - | 出典種別: conversation / book / article / meeting / experience |
| `source_title` | text | YES | - | 出典タイトル |
| `source_url` | text | YES | - | 出典URL |
| `original_prompt` | text | YES | - | 気づきが生まれた元プロンプト |
| `session_ref` | text | YES | - | チャットセッション参照(ID/URL) |
| `language` | text | NO | `ja` | 言語コード |
| `content_format` | text | NO | `markdown` | 'markdown' / 'plaintext' / 'html' |
| `embedding` | vector(1536) | YES | - | セマンティック検索用ベクトル |
| `embedding_model` | text | YES | - | 埋め込みモデル名 |
| `metadata` | jsonb | NO | `{}` | AI拡張領域 |
| `is_archived` | boolean | NO | false | ソフト削除フラグ |
| `created_at` | timestamptz | NO | now() | - |
| `updated_at` | timestamptz | NO | now() | トリガで自動更新 |

**インデックス**:
- HNSW: `embedding` (ベクトル検索)
- GIN trgm: `title`, `content`, `content_normalized`, `ai_commentary`, `summary` (キーワード検索)
- GIN: `tags`, `metadata` (配列・JSONB検索)
- B-tree (部分): `category`, `source_app`, `importance DESC`, `created_at DESC` (※ `is_archived = FALSE` の条件付き)

### 5.2 `insight_documents` テーブル

**用途**: Deep Research等の長文ドキュメント本体格納。1 insight に 0..N 個関連付け。

| カラム | 型 | NULL | デフォルト | 制約・説明 |
|---|---|---|---|---|
| `id` | bigint | NO | sequence | 主キー |
| `insight_id` | bigint | NO | - | FK → [insights.id](http://insights.id) (CASCADE削除) |
| `doc_type` | text | NO | `fulltext` | 種別: fulltext / deep_research / transcript / reference / other |
| `title` | text | YES | - | ドキュメントタイトル |
| `body` | text | NO | - | 本文(空文字禁止、最大1,000,000字)。**原文不変** |
| `source_app` | text | YES | - | - |
| `source_model` | text | YES | - | - |
| `source_url` | text | YES | - | - |
| `content_format` | text | NO | `markdown` | - |
| `metadata` | jsonb | NO | `{}` | - |
| `created_at` | timestamptz | NO | now() | - |
| `updated_at` | timestamptz | NO | now() | - |

**インデックス**:
- B-tree: `insight_id`, `doc_type`
- GIN trgm: `body`

### 5.3 `document_chunks` テーブル

**用途**: 長文を意味的単位で分割。各チャンクが独立したembeddingを持ちピンポイント検索可能。

| カラム | 型 | NULL | デフォルト | 制約・説明 |
|---|---|---|---|---|
| `id` | bigint | NO | sequence | 主キー |
| `document_id` | bigint | NO | - | FK → insight_[documents.id](http://documents.id) (CASCADE削除) |
| `chunk_index` | int | NO | - | 順序(0始まり、`< chunk_total`) |
| `chunk_total` | int | NO | - | 総チャンク数 |
| `body` | text | NO | - | 本文(空文字禁止、最大5,000字)。**親ドキュメントの該当部分そのまま** |
| `section_title` | text | YES | - | 章・節タイトル |
| `section_path` | text[] | YES | - | 階層パス(例: `['第2部','第5章']`) |
| `embedding` | vector(1536) | YES | - | チャンクごとのembedding |
| `embedding_model` | text | YES | - | - |
| `metadata` | jsonb | NO | `{}` | - |
| `created_at` | timestamptz | NO | now() | - |

**ユニーク制約**: `(document_id, chunk_index)`

**インデックス**:
- B-tree: `(document_id, chunk_index)`
- HNSW: `embedding`
- GIN trgm: `body`
- B-tree (部分): `section_title` (NOT NULL条件)

---

## 6. 関数・ビュー一覧

### 6.1 検索関数

#### `search_insights()` — 統合検索

```sql
search_insights(
  query_text         TEXT          DEFAULT NULL,
  query_embedding    VECTOR(1536)  DEFAULT NULL,
  filter_category    TEXT          DEFAULT NULL,
  filter_tags        TEXT[]        DEFAULT NULL,
  filter_source_app  TEXT          DEFAULT NULL,
  min_importance     SMALLINT      DEFAULT NULL,
  match_count        INT           DEFAULT 10
) RETURNS TABLE(...)
```

- キーワード/ベクトル/フィルタを任意組み合わせ
- 検索対象: `title` + `content` + `content_normalized` + `ai_commentary` + `summary`
- ベクトル指定時はベクトル類似度優先、ない場合はテキストランクで並び替え

#### `search_chunks()` — チャンク検索

```sql
search_chunks(
  query_text          TEXT          DEFAULT NULL,
  query_embedding     VECTOR(1536)  DEFAULT NULL,
  filter_document_id  BIGINT        DEFAULT NULL,
  filter_insight_id   BIGINT        DEFAULT NULL,
  match_count         INT           DEFAULT 10
) RETURNS TABLE(...)
```

- 長文の中の特定段落だけをピンポイントで取得

#### `get_document_with_chunks()` — ドキュメント全文取得

```sql
get_document_with_chunks(
  p_document_id BIGINT
) RETURNS TABLE(...)
```

- 指定ドキュメントの全チャンクを `chunk_index` 順で取得
- 検索ヒット箇所の前後文脈を辿る用途

### 6.2 一覧・集計関数

#### `list_recent_insights()` — 最近の気づき一覧

```sql
list_recent_insights(
  days_back        INT      DEFAULT NULL,
  match_count      INT      DEFAULT 50,
  filter_category  TEXT     DEFAULT NULL,
  filter_tags      TEXT[]   DEFAULT NULL,
  min_importance   SMALLINT DEFAULT NULL,
  order_by         TEXT     DEFAULT 'recent'  -- 'recent' | 'importance'
) RETURNS TABLE(...)
```

- 期間・カテゴリ・タグ等で絞り込み
- 軽量(content_previewのみ、長文カラム除外)

#### `get_insights_stats()` — 統計情報

```sql
get_insights_stats() RETURNS TABLE(
  metric_type TEXT,
  metric_key  TEXT,
  count       BIGINT
)
```

- カテゴリ別、アプリ別、重要度別、タグ別、期間別の件数を一括取得

### 6.3 チャンク管理関数

#### `replace_document_chunks()` — チャンク全置換登録

```sql
replace_document_chunks(
  p_document_id BIGINT,
  p_chunks      JSONB
) RETURNS TABLE(inserted_count INT)
```

JSONB配列フォーマット例:
```json
[
  {
    "body": "チャンク本文...",
    "section_title": "序論",
    "section_path": ["第1部", "序論"],
    "embedding": [0.1, 0.2, ...],
    "embedding_model": "text-embedding-3-small",
    "metadata": {}
  }
]
```

- 既存チャンクは削除され全置換
- `chunk_index` は0始まりで自動採番、`chunk_total` は配列長で自動設定

### 6.4 ビュー

#### `insights_list_view`

- 一覧表示用の軽量ビュー
- 長文カラム(`content`/`ai_commentary`等)を除外
- `content_preview` (先頭200字) と `content_length` を提供
- `has_ai_commentary` フラグ、`document_count` も付与
- アーカイブ済みは自動除外

### 6.5 トリガ関数

#### `update_updated_at()`

- `insights` と `insight_documents` の `updated_at` を自動更新

---

## 7. 運用ルール

### 7.1 厳守事項 (AIが操作する際のルール)

#### ルール1: 原文不変

| カラム | ルール |
|---|---|
| `insights.content` | ユーザー入力をそのまま保存。AIによる加筆・整形・要約・誤字修正・文法修正は禁止 |
| `insight_documents.body` | 原文ママ保存。改変禁止 |
| `document_chunks.body` | 親ドキュメントの該当部分をそのまま切り出す。改変禁止 |

#### ルール2: 整形・解説の保存先

- 整形版 → `content_normalized`
- 解説 → `ai_commentary` (価値がある時のみ)
- 要約 → `summary`
- 自由メタ → `metadata`

#### ルール3: 物理削除の回避

- DELETEは原則使わず `is_archived = TRUE` でソフト削除
- データを蓄積資産として永続化

#### ルール4: 文字数による振り分け

| 文字数 | 格納先 |
|---|---|
| 〜100,000字 | `insights.content` のみ |
| 100,000字超 | `insights.content` に要約 + `insight_documents.body` に全文 |
| Deep Research等 | 上記 + チャンク分割 |

#### ルール5: 必須メタ情報

INSERT時には以下を可能な限り埋める:
- `source_app` (どのAIから保存されたか)
- `content_format` ('markdown' が基本)
- `language` ('ja' が基本)

### 7.2 入力バリデーション (DB制約として実装済み)

| 項目 | 制約 |
|---|---|
| `insights.title` | 空文字禁止、最大500字 |
| `insights.content` | 空文字禁止、最大100,000字 |
| `insights.summary` | 最大1,000字 |
| `insights.content_normalized` | 最大100,000字 |
| `[insights.ai](http://insights.ai)_commentary` | 最大10,000字 |
| `insights.tags` | 最大20個 |
| `insights.importance` | 1-5 |
| `insights.confidence` | 1-5 |
| `insights.content_format` | 'markdown' / 'plaintext' / 'html' のみ |
| `insight_documents.body` | 空文字禁止、最大1,000,000字 |
| `document_chunks.body` | 空文字禁止、最大5,000字 |
| `document_chunks.chunk_index` | 0以上、`chunk_total` 未満 |

### 7.3 RLS設定

| ロール | アクセス | 用途 |
|---|---|---|
| `service_role` | フルアクセス | 現状のMCP接続 |
| `insights_writer` | フルアクセス (insightsスキーマ内のみ) | 将来の制限付きキー運用 |
| `authenticated` | 拒否 | (未使用) |
| `anon` | 拒否 | (未使用) |

### 7.4 セキュリティ運用方針

**段階的アプローチ**:
1. **現在(検証フェーズ)**: `service_role` キーを各MCPクライアントに配布
2. **動作確認後**: `insights_writer` ロール用のJWTに切り替え
3. **将来**: 必要に応じてSupabase Auth + 細粒度RLSポリシー

**注意**: `insights_writer` ロール用のJWT発行は、Supabase Dashboard上での手動操作が必要(SQLからJWT secretは取得できない)。

---

## 8. マイグレーション履歴

時系列で適用したマイグレーション(全11本):

| # | バージョン | 名称 | 概要 |
|---|---|---|---|
| 1 | 20260502134820 | `create_insights_schema` | 初期スキーマ(insights/tags/insight_tags/insight_relations) |
| 2 | 20260502135223 | `extend_insights_for_multi_ai_integration` | pgvector追加、マルチAI連携用カラム追加 |
| 3 | 20260502135247 | `setup_rls_policies_personal_use` | RLS設定 |
| 4 | 20260502135849 | `reset_and_rebuild_ai_driven_schema` | **AI駆動前提に大規模再設計**(単一テーブル化) |
| 5 | 20260502140236 | `harden_operations_minimal` | 専用ロール `insights_writer` 作成、バリデーション制約 |
| 6 | 20260502140945 | `add_long_documents_support` | `insight_documents` テーブル追加、content上限拡大 |
| 7 | 20260502142425 | `clarify_content_verbatim_rule` | 原文不変ルールをスキーマコメントで明示 |
| 8 | 20260502143332 | `add_normalized_and_commentary_columns` | `content_normalized`, `ai_commentary` カラム追加 |
| 9 | 20260502144435 | `add_document_chunks_for_long_text` | `document_chunks` テーブル追加 |
| 10 | 20260502144511 | `add_chunk_management_functions` | チャンク管理・検索関数追加 |
| 11 | 20260502144920 | `add_format_listing_and_stats` | content_format、一覧ビュー、統計関数追加 |

---

## 9. AI駆動利用の典型パターン

### 9.1 短い気づきの保存

```sql
INSERT INTO insights (
  title, content, summary, category, tags,
  importance, confidence,
  source_app, source_model, source_type,
  language, content_format, metadata
) VALUES (
  '<タイトル>',
  '<原文そのまま>',
  '<要約>',
  'learning',
  ARRAY['タグ1', 'タグ2'],
  4, 4,
  'chatgpt', 'gpt-5', 'conversation',
  'ja', 'markdown',
  '{}'::jsonb
);
```

### 9.2 Deep Research結果の保存

```sql
-- Step 1: メタ情報をinsightsに保存(要約のみ)
WITH new_insight AS (
  INSERT INTO insights (
    title, content, summary, category, tags,
    importance, source_app, source_type, content_format
  ) VALUES (
    '<調査タイトル>',
    '【Deep Research結果のため要約のみ。全文はinsight_documentsに格納】<要約2000字程度>',
    '<さらに短い要約>',
    'learning',
    ARRAY['research', 'タグ'],
    5, 'chatgpt', 'conversation', 'markdown'
  )
  RETURNING id
),
-- Step 2: 全文をinsight_documentsに格納
new_doc AS (
  INSERT INTO insight_documents (
    insight_id, doc_type, title, body, content_format
  )
  SELECT id, 'deep_research', '<タイトル>', '<全文>', 'markdown'
  FROM new_insight
  RETURNING id
)
-- Step 3: チャンク登録
SELECT replace_document_chunks(
  (SELECT id FROM new_doc),
  '[
    {"body": "...", "section_title": "序論", "section_path": ["序論"]},
    {"body": "...", "section_title": "本論1", "section_path": ["本論", "1"]}
  ]'::jsonb
);
```

### 9.3 検索・取得パターン

```sql
-- 最近の学び一覧
SELECT * FROM list_recent_insights(days_back => 30);

-- 重要度4以上で絞り込み
SELECT * FROM list_recent_insights(
  min_importance => 4::smallint,
  order_by => 'importance'
);

-- 特定タグで絞り込み
SELECT * FROM list_recent_insights(filter_tags => ARRAY['DX']);

-- キーワード検索
SELECT * FROM search_insights(query_text => '組織論');

-- セマンティック検索(埋め込み生成後)
SELECT * FROM search_insights(query_embedding => '[0.1, 0.2, ...]'::vector);

-- ハイブリッド検索
SELECT * FROM search_insights(
  query_text => 'リーダーシップ',
  query_embedding => '[...]'::vector,
  filter_tags => ARRAY['組織論'],
  min_importance => 4::smallint
);

-- 長文の特定段落を抽出
SELECT * FROM search_chunks(
  query_text => 'AI駆動',
  filter_insight_id => 5
);

-- ドキュメント全文を再構成
SELECT * FROM get_document_with_chunks(2);

-- 統計
SELECT * FROM get_insights_stats();
```

### 9.4 ソフト削除

```sql
UPDATE insights SET is_archived = TRUE WHERE id = <ID>;
```

---

## 10. 次のアクション

### 10.1 短期 (Claude Codeで着手予定)

- [ ] **ChatGPTでのMCP接続テスト**
  - 設定 → コネクタ → カスタムコネクタ追加
  - URL: `https://mcp.supabase.com/mcp?project_ref=gntgcxdbcbywfboejimz&read_only=false&features=database,docs`
  - OAuth認証
  - Developer Mode を有効化
- [ ] **Deep Research保存の実テスト**
  - 既存の Deep Research 結果を貼り付けて保存
  - `source_app='chatgpt'` で記録
  - チャンク分割の品質確認
  - 原文保持の確認
- [ ] **動作確認後、`insights_writer` ロール用キーへの切替**
  - Supabase Dashboard で JWT 発行
  - 各MCPクライアントの認証情報を切替

### 10.2 中期

- [ ] **embedding 自動生成の仕組み**
  - 案A: AI側で生成して送る (実装シンプル、モデル不揃い問題あり)
  - 案B: Supabase Edge Functions で INSERT トリガ的に自動生成 (一元管理、推奨)
  - 案C: 当面手動 (検証フェーズ用)
- [ ] **embedding バックフィル**
  - 既存レコードへの埋め込み付与
- [ ] **Claude Desktop / Codex / Perplexity からの接続テスト**

### 10.3 長期

- [ ] **専用MCP Server の自作検討**
  - `save_insight` / `search_insights` / `get_recent` 等の専用ツール定義
  - Supabase Edge Functions 上に構築
  - AIが扱いやすく、誤操作リスクも下がる
- [ ] **データ量増加に応じた最適化**
  - ページング (LIMIT/OFFSET or `created_at` カーソル)
  - マテリアライズドビュー
  - 必要時の正規化
- [ ] **ベンダーロックイン回避**
  - 定期エクスポート(JSONLや別DB)

### 10.4 監視ポイント

- 無料プラン容量 (500MB) の使用状況
- バックアップ保持期間 (7日)
- 検索性能 (10,000件超えた時点で再評価)
- 埋め込みモデルの混在状況 (`embedding_model` カラムで追跡)

---

## 11. 既存データ (現時点で保存されているもの)

### insights テーブル

| id | title | source_app | importance | tags |
|---|---|---|---|---|
| 1 | AI駆動DBは単一テーブル+JSON配列でシンプルに保つべき | claude_ai | 4 | DB設計, AI駆動, スキーマ設計 |
| 3 | AIとデータの分離による「マルチAI対応データ基盤」という新しい構造 | claude_ai | 5 | AI連携, MCP, Supabase, データ基盤, マルチAI, ベンダーロックイン回避 |

> 注: id=2 は当初保存後に内容調整で再作成された結果欠番。

### insight_documents テーブル

| id | insight_id | doc_type | title |
|---|---|---|---|
| 1 | 1 | deep_research | AI駆動DB設計のベストプラクティス調査 |

### document_chunks テーブル

document_id=1 に対して4チャンク登録済み (序論 / 正規化の度合い / 長文の扱い / 結論)

---

## 12. 完全な再現用SQL (バックアップ)

新規環境で同じスキーマを再構築する場合、以下のマイグレーションを順次適用すれば完全再現できます。Supabaseの `supabase/migrations/` ディレクトリに各SQLを保存して `supabase db push` で適用するか、`apply_migration` で1本ずつ実行してください。

各マイグレーションのSQLは長大なため、本ドキュメントには概要のみ記載しています。完全なSQLが必要な場合は、Supabase Dashboard の Database → Migrations から各マイグレーションのSQLを取得してください。

主要マイグレーションのSQLは [付録A](#付録a-主要マイグレーションsql) を参照。

---

## 13. ChatGPT接続設定のメモ

### 接続URL (推奨)

```
https://mcp.supabase.com/mcp?project_ref=gntgcxdbcbywfboejimz&read_only=false&features=database,docs
```

**パラメータ意味**:
- `project_ref=gntgcxdbcbywfboejimz`: chatDBに限定
- `read_only=false`: 書き込み許可 (初回テストは `true` でも可)
- `features=database,docs`: DB操作とドキュメント検索のみ

### ChatGPTでの設定手順

1. ChatGPT → 設定 → コネクタ → 詳細設定 → Developer Mode を ON
2. コネクタ → カスタムコネクタ作成
3. 上記URLを MCP Server URL に設定
4. OAuth認証でSupabaseログイン → 組織アクセス許可
5. チャット画面で More → Developer Mode を有効化

### 注意事項

- ChatGPT Plus / Pro / Business / Enterprise プランが必要
- Developer Mode対応モデルでのみツール呼び出し可
- ツール実行は都度承認制を推奨
- プロンプトインジェクション対策として、外部から取り込んだデータには注意

### ChatGPTに渡す推奨プロンプト

```
SupabaseのMCP経由で、以下をDBに保存してください。

【保存先DB構造】
- insights: メタ情報と要約(必須)
- insight_documents: 全文を原文ママ保存(必須、doc_type='deep_research')
- document_chunks: 章・節単位で分割(replace_document_chunks関数を使用)

【厳守事項】
1. content_format='markdown' を指定
2. source_app='chatgpt' を指定
3. insights.contentには要約のみ、全文はinsight_documents.bodyへ
4. 原文の改変は禁止(要約以外)
5. 既存レコードのDELETE/UPDATEは行わない

【保存対象】
[ここに本文を貼る]

【期待する出力】
保存後、insightsテーブルから該当レコードのIDとタイトル、チャンク数を返してください。
```

---

## 14. トラブルシューティング・既知の課題

### 課題1: embedding 未生成

現状、`embedding` カラムはNULLのまま。セマンティック検索は実質機能しない。
→ 上記「次のアクション 10.2」でEdge Functions対応を予定。

### 課題2: id=2 の欠番

検証中の挿入と修正でid=2が欠番。実害なし。シーケンスはそのまま継続。

### 課題3: 文字数超過時の動作

100,000字超のcontentは制約で拒否される。Deep Researchの場合は要約をcontentに、全文をinsight_documents.bodyに分けて保存する必要がある。AIプロンプトに明示すること。

### 課題4: プロンプトインジェクション

外部データ(Deep Research結果等)に「全データ削除して」等の指示が含まれていると、AIが従ってしまう可能性。対策:
- ツール実行を都度承認制に
- ソフト削除運用 (DELETE禁止)
- プロジェクトスコープでアクセス制限済み

---

## 15. 参考情報・公式ドキュメント

- [Supabase MCP公式ドキュメント](https://supabase.com/docs/guides/getting-started/mcp)
- [Supabase MCP GitHubリポジトリ](https://github.com/supabase-community/supabase-mcp)
- [pgvector公式](https://github.com/pgvector/pgvector)
- [Model Context Protocol仕様](https://modelcontextprotocol.io/)

---

## 付録A: 主要マイグレーションSQL

### A-1. 最終スキーマの主要DDL

> 注: 以下は履歴的に複数マイグレーションで段階的に構築された最終形のDDL概要。新規環境で再構築する場合の参考用。

```sql
-- 拡張機能
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ========================================
-- insights テーブル
-- ========================================
CREATE TABLE insights (
  id                 BIGSERIAL PRIMARY KEY,
  title              TEXT NOT NULL,
  content            TEXT NOT NULL,
  content_normalized TEXT,
  ai_commentary      TEXT,
  summary            TEXT,
  category           TEXT,
  tags               TEXT[] NOT NULL DEFAULT '{}',
  importance         SMALLINT NOT NULL DEFAULT 3 CHECK (importance BETWEEN 1 AND 5),
  confidence         SMALLINT CHECK (confidence BETWEEN 1 AND 5),
  source_app         TEXT,
  source_model       TEXT,
  source_type        TEXT,
  source_title       TEXT,
  source_url         TEXT,
  original_prompt    TEXT,
  session_ref        TEXT,
  language           TEXT NOT NULL DEFAULT 'ja',
  content_format     TEXT NOT NULL DEFAULT 'markdown'
                     CHECK (content_format IN ('markdown', 'plaintext', 'html')),
  embedding          VECTOR(1536),
  embedding_model    TEXT,
  metadata           JSONB NOT NULL DEFAULT '{}'::JSONB,
  is_archived        BOOLEAN NOT NULL DEFAULT FALSE,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- バリデーション
  CONSTRAINT chk_title_not_empty           CHECK (LENGTH(TRIM(title)) > 0),
  CONSTRAINT chk_title_max_len             CHECK (LENGTH(title) <= 500),
  CONSTRAINT chk_content_not_empty         CHECK (LENGTH(TRIM(content)) > 0),
  CONSTRAINT chk_content_max_len           CHECK (LENGTH(content) <= 100000),
  CONSTRAINT chk_summary_max_len           CHECK (summary IS NULL OR LENGTH(summary) <= 1000),
  CONSTRAINT chk_content_normalized_max_len
    CHECK (content_normalized IS NULL OR LENGTH(content_normalized) <= 100000),
  CONSTRAINT chk_ai_commentary_max_len
    CHECK (ai_commentary IS NULL OR LENGTH(ai_commentary) <= 10000),
  CONSTRAINT chk_tags_max_count
    CHECK (array_length(tags, 1) IS NULL OR array_length(tags, 1) <= 20)
);

-- インデックス
CREATE INDEX idx_insights_embedding_hnsw
  ON insights USING HNSW (embedding vector_cosine_ops);
CREATE INDEX idx_insights_title_trgm              ON insights USING GIN (title              gin_trgm_ops);
CREATE INDEX idx_insights_content_trgm            ON insights USING GIN (content            gin_trgm_ops);
CREATE INDEX idx_insights_content_normalized_trgm ON insights USING GIN (content_normalized gin_trgm_ops);
CREATE INDEX idx_insights_ai_commentary_trgm      ON insights USING GIN (ai_commentary      gin_trgm_ops);
CREATE INDEX idx_insights_summary_trgm            ON insights USING GIN (summary            gin_trgm_ops);
CREATE INDEX idx_insights_tags                    ON insights USING GIN (tags);
CREATE INDEX idx_insights_metadata                ON insights USING GIN (metadata);
CREATE INDEX idx_insights_category   ON insights (category)        WHERE is_archived = FALSE;
CREATE INDEX idx_insights_source_app ON insights (source_app)      WHERE is_archived = FALSE;
CREATE INDEX idx_insights_importance ON insights (importance DESC) WHERE is_archived = FALSE;
CREATE INDEX idx_insights_created_at ON insights (created_at DESC) WHERE is_archived = FALSE;

-- updated_at トリガ
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_insights_updated_at
  BEFORE UPDATE ON insights
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ========================================
-- insight_documents テーブル
-- ========================================
CREATE TABLE insight_documents (
  id             BIGSERIAL PRIMARY KEY,
  insight_id     BIGINT NOT NULL REFERENCES insights (id) ON DELETE CASCADE,
  doc_type       TEXT NOT NULL DEFAULT 'fulltext',
  title          TEXT,
  body           TEXT NOT NULL,
  source_app     TEXT,
  source_model   TEXT,
  source_url     TEXT,
  content_format TEXT NOT NULL DEFAULT 'markdown'
                 CHECK (content_format IN ('markdown', 'plaintext', 'html')),
  metadata       JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT chk_doc_body_not_empty CHECK (LENGTH(TRIM(body)) > 0),
  CONSTRAINT chk_doc_body_max_len   CHECK (LENGTH(body) <= 1000000)
);

CREATE INDEX idx_insight_documents_insight_id ON insight_documents (insight_id);
CREATE INDEX idx_insight_documents_doc_type   ON insight_documents (doc_type);
CREATE INDEX idx_insight_documents_body_trgm  ON insight_documents USING GIN (body gin_trgm_ops);

CREATE TRIGGER trg_insight_documents_updated_at
  BEFORE UPDATE ON insight_documents
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ========================================
-- document_chunks テーブル
-- ========================================
CREATE TABLE document_chunks (
  id              BIGSERIAL PRIMARY KEY,
  document_id     BIGINT NOT NULL REFERENCES insight_documents (id) ON DELETE CASCADE,
  chunk_index     INT NOT NULL,
  chunk_total     INT NOT NULL,
  body            TEXT NOT NULL,
  section_title   TEXT,
  section_path    TEXT[],
  embedding       VECTOR(1536),
  embedding_model TEXT,
  metadata        JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT chk_chunk_body_not_empty CHECK (LENGTH(TRIM(body)) > 0),
  CONSTRAINT chk_chunk_body_max_len   CHECK (LENGTH(body) <= 5000),
  CONSTRAINT chk_chunk_index_valid    CHECK (chunk_index >= 0 AND chunk_index < chunk_total),
  CONSTRAINT uq_document_chunk_index  UNIQUE (document_id, chunk_index)
);

CREATE INDEX idx_document_chunks_document_id    ON document_chunks (document_id, chunk_index);
CREATE INDEX idx_document_chunks_embedding_hnsw ON document_chunks USING HNSW (embedding vector_cosine_ops);
CREATE INDEX idx_document_chunks_body_trgm      ON document_chunks USING GIN (body gin_trgm_ops);
CREATE INDEX idx_document_chunks_section_title  ON document_chunks (section_title) WHERE section_title IS NOT NULL;
```

### A-2. RLS設定

```sql
-- ロール作成
CREATE ROLE insights_writer NOLOGIN;
GRANT USAGE ON SCHEMA public TO insights_writer;

-- RLS有効化
ALTER TABLE insights          ENABLE ROW LEVEL SECURITY;
ALTER TABLE insight_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_chunks   ENABLE ROW LEVEL SECURITY;

-- service_role ポリシー
CREATE POLICY "service_role full access on insights"
  ON insights FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_role full access on insight_documents"
  ON insight_documents FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_role full access on document_chunks"
  ON document_chunks FOR ALL TO service_role USING (true) WITH CHECK (true);

-- insights_writer ポリシー
CREATE POLICY "insights_writer full access on insights"
  ON insights FOR ALL TO insights_writer USING (true) WITH CHECK (true);
CREATE POLICY "insights_writer full access on insight_documents"
  ON insight_documents FOR ALL TO insights_writer USING (true) WITH CHECK (true);
CREATE POLICY "insights_writer full access on document_chunks"
  ON document_chunks FOR ALL TO insights_writer USING (true) WITH CHECK (true);

-- 権限付与
GRANT SELECT, INSERT, UPDATE, DELETE ON insights          TO insights_writer;
GRANT SELECT, INSERT, UPDATE, DELETE ON insight_documents TO insights_writer;
GRANT SELECT, INSERT, UPDATE, DELETE ON document_chunks   TO insights_writer;
GRANT USAGE, SELECT ON SEQUENCE insights_id_seq          TO insights_writer;
GRANT USAGE, SELECT ON SEQUENCE insight_documents_id_seq TO insights_writer;
GRANT USAGE, SELECT ON SEQUENCE document_chunks_id_seq   TO insights_writer;
```

### A-3. 主要関数

> 関数の完全なSQLは長大なため、Supabase Dashboard の Database → Functions から個別に取得してください。
> 関数名一覧:
> - `update_updated_at()` (トリガ関数)
> - `search_insights(...)` (統合検索)
> - `search_chunks(...)` (チャンク検索)
> - `get_document_with_chunks(p_document_id BIGINT)` (ドキュメント全文取得)
> - `replace_document_chunks(p_document_id BIGINT, p_chunks JSONB)` (チャンク全置換)
> - `list_recent_insights(...)` (一覧取得)
> - `get_insights_stats()` (統計)

### A-4. ビュー

```sql
CREATE OR REPLACE VIEW insights_list_view AS
SELECT
  id, title, summary, category, tags,
  importance, confidence, source_app, source_type,
  source_title, source_url, language, content_format,
  CASE
    WHEN LENGTH(content) > 200 THEN SUBSTRING(content FROM 1 FOR 200) || '...'
    ELSE content
  END AS content_preview,
  LENGTH(content) AS content_length,
  (ai_commentary IS NOT NULL) AS has_ai_commentary,
  (SELECT COUNT(*) FROM insight_documents d WHERE d.insight_id = [i.id](http://i.id)) AS document_count,
  is_archived, created_at, updated_at
FROM insights i
WHERE is_archived = FALSE;

GRANT SELECT ON insights_list_view TO insights_writer;
GRANT SELECT ON insights_list_view TO service_role;
```

---

## 付録B: 用語集

| 用語 | 意味 |
|---|---|
| MCP | Model Context Protocol — AIアシスタントと外部サービスを繋ぐ標準プロトコル |
| RLS | Row Level Security — 行単位のアクセス制御 |
| HNSW | 高速近似最近傍検索アルゴリズム (ベクトル検索の標準) |
| pgvector | Postgres用のベクトル型・検索拡張機能 |
| pg_trgm | trigram (3-gram) ベースの類似検索拡張機能 |
| service_role | Supabaseの管理者権限ロール (RLSをバイパス) |
| PAT | Personal Access Token — Supabaseの個人用APIトークン |
| OAuth | 認可プロトコル (ChatGPT MCP接続で使用) |
| Edge Functions | Supabaseのサーバーレス関数実行環境 |
| Deep Research | ChatGPT/Perplexity等の深い調査機能 |
| ベンダーロックイン | 特定ベンダーへの依存により乗り換えが困難になる状態 |

---

**END OF DOCUMENT**
