# register-insight スキル 引継ぎドキュメント (v1.1)

最終更新: 2026-05-08 (claude.ai 移植対応)

このドキュメントは Claude Code 用スキル `register-insight` の **作業履歴・現状・残タスク** をまとめたもの。別端末でも `git pull` 後にこの 1 ファイルを読めば作業継続できる。

関連ドキュメント (必読):
- [`docs/insights-db-handover.md`](./insights-db-handover.md) — Insights DB 全体の handover (v4)。スキーマ・運用ルール・落とし穴の出典。

---

## 0. 結論サマリ

| 項目 | 状態 |
|---|---|
| スキル本体 (`SKILL.md`) | ✅ 作成済み (Claude Code / claude.ai 両対応) |
| チャンク分割スクリプト (`lib/chunk.py`) | ✅ 作成・スモークテスト済み (両環境共通) |
| 重複検知の前提 (既存 insights への `content_sha256` バックフィル) | ✅ 完了 (id=1, 3, 5 / 全 3 件) |
| claude.ai 用 ZIP ビルドスクリプト (`scripts/build-skill-zip.sh`) | ✅ 作成・実行確認済み |
| E2E 検証 (新規ファイル登録 → embedding → 検索) | ⏳ **未実施** (次セッションの最優先) |
| claude.ai へのアップロード (UI 操作) | ⏳ ユーザー作業 (下記 §5 参照) |

---

## 1. 何を作ったか

### 1-1. ファイル構成

```
.claude/skills/register-insight/
├── SKILL.md            # スキル定義 (Claude Code が読む手順書)
└── lib/
    └── chunk.py        # Markdown を H1/H2/H3/段落で分割する Python スクリプト
```

### 1-2. スキルの責務

ユーザーから渡された **ファイルパス** または **直接テキスト** を Insights DB (Supabase chatDB) に **間違いなく** 登録する。`docs/insights-db-handover.md` の運用ルール (原文不変・必須メタ・チャンク化) を守る。

### 1-3. 受付フォーマット (両対応)

- **(A) Claude Code**: 絶対パスを渡す → `Read` でファイル取得
- **(B) claude.ai 等 (将来)**: 本文を引数で直接渡す

ともに 1 つの SKILL.md で処理 (分岐するだけ)。

### 1-4. 自動化されているステップ

1. 本文取得 + frontmatter 分離
2. `sha256(content)` で重複検知 (`metadata->>'content_sha256'` で WHERE)
3. メタデータ抽出 (Claude 自身が本文を読む。50,000字超は先頭/中央/末尾サンプリング)
4. `insights` INSERT
5. 長文 (> 5,000字) なら `insight_documents` INSERT + `chunk.py` で分割 + `replace_document_chunks()`
6. embedding 生成完了の待機 (5秒間隔・最大5分)
7. サンプル検索 1 件で登録レコードがヒットするか確認
8. 完了報告

### 1-5. ユーザーへの事前確認

`source_app` / `source_type` / `title` が path・filename・frontmatter から推定できないときのみ **開始前に 1 度だけ** 聞く。
ユーザーが「おまかせ」と返したら全項目デフォルト (`source_app=manual`, `source_type=conversation`) で進める。

### 1-6. 不変ルール (SKILL.md 末尾に明記)

1. content / body の AI 整形・要約・誤字修正禁止
2. 物理 DELETE 禁止 (`is_archived = TRUE` のみ)
3. embedding は自分で計算しない (DB トリガ → Edge Function 経由のみ)
4. content_sha256 は登録前に必ず先にチェック
5. ユーザー指定メタは勝手に上書きしない

---

## 2. チャンク分割アルゴリズム

`lib/chunk.py` の仕様 (handover §タスク2 のルールに準拠):

- H1 / H2 で大章分割
- 各章 5,000字超は H3 で再分割 → さらに段落単位で分割
- 各 chunk の body は **原文ママの連続部分** (整形・正規化なし)

### 2-1. 動作確認結果

`docs/gemini-deepresearch.md` (32,267字) で実行:
- 出力: 10 chunks
- 最大 chunk: 5,000字 (制約遵守)
- 最小 chunk: 1,432字
- 合計 chunk chars: 31,838 (元 32,267 から -429字 ≒ 章境界の連続改行ストリップ分)

> -429字 の差は handover §落とし穴8 の「合計が一致しない」を緩く受容したもの。**logical な原文連続性は保たれている** (各 chunk は元の章セクションをそのまま切り出したもの)。
> 厳密に「合計バイト一致」が必要な場合は `chunk.py` の `.strip()` を外す改修が必要 (将来課題)。

### 2-2. 既存実装との比較

| 項目 | 既存 (claude.ai 手作業) | 新スキル (`chunk.py`) |
|---|---|---|
| id=5 のチャンク数 | 12 (preamble + 7章 + 第7章を5パートに分割) | 10 (6章 + 第7章を4パートに分割) |
| 文字差分 | -4字 | -429字 |
| アルゴリズム | Python H2/H3 ベース (再現コードなし) | Python H1/H2 + 5000字超で H3 + 段落 |

---

## 3. 既存データへのバックフィル (✅ 実施済み)

### 3-1. 動機

スキルの重複検知は `metadata->>'content_sha256'` を見る。スキル導入前に登録された 3 件 (id=1, 3, 5) には sha256 が無く、**そのままだと再登録時に二重登録が発生する**。

### 3-2. 実行 SQL (実行済み・記録)

```sql
UPDATE insights
SET metadata = metadata || jsonb_build_object(
  'content_sha256', encode(digest(content, 'sha256'), 'hex'),
  'sha256_backfilled_at', to_char(now(), 'YYYY-MM-DD"T"HH24:MI:SSOF')
)
WHERE metadata->>'content_sha256' IS NULL
  AND is_archived = FALSE;
```

実行日時: **2026-05-08**
影響: insights 3 件 (id=1, 3, 5) の metadata に `content_sha256` と `sha256_backfilled_at` が追加された。

### 3-3. 検証 (実行済み・記録)

```sql
SELECT COUNT(*) AS total,
       COUNT(*) FILTER (WHERE metadata->>'content_sha256' IS NOT NULL) AS with_sha256
FROM insights;
-- → total=3, with_sha256=3 ✅
```

### 3-4. 各 ID の sha256 (確認用)

| id | title (抜粋) | sha256 (先頭16字) |
|---|---|---|
| 1 | AI駆動DBは単一テーブル+JSON配列でシンプルに保つべき | `0410d6704030d01d` |
| 3 | AIとデータの分離による「マルチAI対応データ基盤」という新しい構造 | `944124b504a1bcd4` |
| 5 | 空港DXを加速させるマルチエージェントシステムの戦略的実装 | `f7391d9447b3df5b` |

### 3-5. content/body 不変性

このバックフィルは **`metadata` jsonb のみ更新**。`content` / `body` は一切変更していないので、原文不変ルールに違反しない。

---

## 4. 残タスク (優先度順)

### タスク #7 — E2E 検証 (最優先・次セッション)

スキルが期待通り動くかを **新規ファイル** で 1 度通す。

**手順案**:

1. テスト用 Markdown を `docs/test-insight.md` などに作成 (短文 1 件 + 長文 1 件、各 sha256 がユニークになる内容)
2. Claude Code でスキル起動: 「`docs/test-insight.md` を Insights DB に登録して」
3. 以下を確認:
   - 重複検知が正しく動く (2 度目の登録は abort される)
   - 短文ケース: `insights` のみ INSERT、embedding 生成
   - 長文ケース: `insights` + `insight_documents` + `document_chunks` の 3 段、全件 embedding
   - サンプル検索でヒット
4. 失敗時はステップ番号と Edge Function ログ (`mcp__claude_ai_Supabase__get_logs`) を確認
5. 検証完了後、テストレコードは `is_archived = TRUE` でソフト削除 (handover ルール)

**E2E 検証で不足が見つかった場合の改修候補**:
- `lib/chunk.py` の strip 緩和 (章境界の文字差分削減)
- 待機タイムアウト後のリトライロジック追加
- frontmatter 解析の堅牢化 (YAML エラー時の挙動)

### タスク #8 — claude.ai 移植 (✅ コード完了 / アップロードはユーザー作業)

#### 現状
- claude.ai の Skills は **sandbox 内で Python 標準ライブラリが実行可能** と確認 (Pro/Max/Team/Enterprise + Code Execution 有効化が前提)
- `chunk.py` は stdlib のみ使用なので **そのまま動く**
- Supabase MCP はチャット層から呼べる (Skill コードからは呼べないが、Skill を実行している Claude が呼べる)
- Edge Function 呼び出しは Python `urllib` (stdlib) で実装済み・curl 依存なし
- SKILL.md は Claude Code / claude.ai の両対応に書き換え済み (1 ファイルでメンテ)

#### claude.ai へのアップロード手順 (ユーザー作業)
```bash
# (1) ZIP を生成
bash scripts/build-skill-zip.sh
# → dist/register-insight-claude-ai.zip が出力される

# (2) claude.ai にログイン
# (3) Settings > Features > Skills (要 Code Execution 有効化)
# (4) "Upload skill" → dist/register-insight-claude-ai.zip を選択
# (5) スキル一覧に register-insight が出ればアップロード成功
```

#### claude.ai 側での使い方
- 新規チャットを開く → 添付ファイル投入 or 本文貼付
- 「register-insight でこれを登録して」と発言
- Claude が SKILL.md の手順に従って自動処理

### タスク #9 — handover §0 将来改善

(insights-db-handover.md に記載済み、引き続き保留):
- A. search_chunks 長さ重み付け
- B. ハイブリッド検索 OR/重み付け化
- C. `insights_writer` ロール JWT 切替
- D. Routine 統合 (朝サマリ・重複検知・タグ整理)

---

## 5. 別端末での作業継続手順

### 5-1. 必要環境

- macOS / Linux
- `git` / `python3` (3.10+) / `gh` CLI (任意)
- Claude Code (本リポジトリ用に `.claude/` 配下のスキルを認識)
- Supabase MCP 接続 (claude.ai 経由 or local CLI)

### 5-2. 初回 setup

```bash
git clone git@github.com:jatmdjwa/setup-spabase.git
cd setup-spabase
# .env / 秘匿情報は repo に含めていない (下記 5-3)
```

### 5-3. 必要な秘匿情報 (repo 外から手動で渡す)

| 名前 | 用途 | 取得元 |
|---|---|---|
| `SUPABASE_SERVICE_ROLE_KEY` | Edge Function を直接叩いて検証検索する場合 | Supabase Dashboard → Settings → API |
| `GCP_SA_KEY` (Vertex AI) | Edge Function 側 secret。**通常は触らない** | 既に `supabase secrets set` 済み (handover §タスク3) |
| `GCP_PROJECT_ID` | 同上 | 同上 (`insights-embedding`) |

ローカル shell に export しておけば SKILL.md ステップ6 の curl が通る。`.env` 等にコピーする場合は `.gitignore` 済みなので安全。

### 5-4. 動作確認 (継続前のスモークチェック)

```bash
cd setup-spabase
# チャンクスクリプトが動くか
python3 .claude/skills/register-insight/lib/chunk.py < /dev/null
# (空入力なら "[]" が返れば OK)

# Claude Code の Supabase MCP が繋がるか
# Claude Code 起動 → 「insights テーブルから 3 件出して」と依頼してみる
```

### 5-5. このドキュメントとセットで読むべきもの

1. **本ドキュメント** (`docs/skill-register-insight-handover.md`) — まずここ
2. `docs/insights-db-handover.md` — DB スキーマ・運用ルール (v4)
3. `.claude/skills/register-insight/SKILL.md` — スキル本体の手順書
4. `.claude/skills/register-insight/lib/chunk.py` — チャンク分割ロジック

### 5-6. 想定される最初のアクション (次セッション開始時)

1. 本ドキュメント §4 タスク #7 (E2E 検証) を読む
2. テスト用 Markdown を作成 (`docs/test-insight-short.md` と `docs/test-insight-long.md`)
3. Claude Code に「`docs/test-insight-short.md` を register-insight で登録して」と依頼
4. 動作確認 → 必要に応じて SKILL.md 修正

---

## 6. 設計上の判断記録

| # | 判断 | 理由 |
|---|---|---|
| J1 | チャンク max を 5,000字に固定 | handover §schema で `document_chunks.body` 上限 5,000字。Vertex AI 2,048 token 制限内に収まる |
| J2 | 重複検知は sha256 単独 (title fallback なし) | 偽陽性回避。title はユーザーが意図的に変えることがある |
| J3 | 言語は基本 ja 固定 | handover の前提。多言語化は将来課題 |
| J4 | 単一 SKILL.md で Claude Code / claude.ai 両対応 | 2 ファイルに分けるとメンテ二重化 |
| J5 | Python (Deno でなく) | プロジェクトに deno 未インストール。python3 はデフォルトで利用可。handover にも「Python での H2/H3 ベース」とある |
| J6 | embedding 待機は 5 分タイムアウト | 既存 backfill 実績で chunks 12 件 ≦ 30 秒。5 分なら Edge Function 障害切り分け可能 |
| J7 | claude.ai 移植は **同一 SKILL.md** で対応 (別ファイル化しない) | sandbox に Python が走り chunk.py がそのまま import できることを確認。Edge Function 呼出も urllib stdlib で書ける |
| J8 | ZIP は `dist/` (gitignore 済み)、ビルドは `scripts/build-skill-zip.sh` | バイナリ artifact を repo に入れない。再生成可能 |

---

## 7. メンテナンスのヒント

- スキルのバージョン: `metadata.skill_version` に書く (現在 `"1.0"`)。挙動を変えたら `1.1` に上げて、過去レコードの差分を将来追跡可能にする
- スキルが新しいメタ項目を要求するようになった場合は **既存レコードへのバックフィル戦略** を本ドキュメント §3 と同じ形式で記録する
- E2E 検証スクリプト化したくなったら `scripts/verify-skill.sh` を作って再現可能にする (現在は手動)
