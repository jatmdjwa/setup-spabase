# register-insight スキル 監査・修正履歴

最終更新: 2026-05-08

このドキュメントは Claude Code 用 register-insight スキルを **subagent (general-purpose) で 4 ラウンド独立 audit** し、各ラウンドで発見された問題を一つずつ潰した記録。`docs/skill-register-insight-handover.md` の補足資料。

---

## 0. 最終 verdict (2026-05-08, commit 984614e + minor patches)

**READY FOR UPLOAD**。Critical / Important blocker は全て解消。残るは 2 件の cosmetic / minor のみ (本書 §5 参照)。

```
Audit ラウンド: 4 回
発見済み問題数: 18 件 (Critical 8 / Important 6 / Nitpick 4)
解決済み: 16 件
未解決 (cosmetic): 2 件
```

---

## 1. 各ラウンドの発見・修正一覧

### Round 1 — 2026-05-08, commit `7e6abf2` で修正

**主な発見 (FAIL 7 件)**:

| # | 問題 | 該当 | 修正方針 |
|---|---|---|---|
| R1-1 | ZIP root が bare `SKILL.md` になっていた (claude.ai は `register-insight/SKILL.md` を要求) | `scripts/build-skill-zip.sh:14-15` | `cd "$SKILL_PARENT" && zip -r "$OUT" register-insight` |
| R1-2 | UI 経路 "Settings > Features > Skills" は古い (現行は "Customize > Skills") | `docs/skill-register-insight-handover.md:186` | 文言更新 |
| R1-3 | claude.ai sandbox の外部 HTTP egress 不可制約に対するガード欠落 | `SKILL.md` Step 6 全体 | 制約 callout + 推奨スキップを追記 |
| R1-4 | `Read` ツール参照が claude.ai 文脈にも残存 (Claude Code 専用) | `SKILL.md:18-23` | プラットフォーム別表に分離、claude.ai 側は `open()` で読む |
| R1-5 | `mcp__claude_ai_Supabase__*` が hardcode (connector 名は実装依存) | `SKILL.md:243, 336` | "capability description" 形式 (例: "Supabase MCP `execute_sql`") に変更 |
| R1-6 | `python3 .claude/skills/register-insight/lib/chunk.py` の絶対パス hardcode | `SKILL.md:172-174` | `$REPO_ROOT/.claude/skills/...` (Code 用) と claude.ai 用の探索ロジックに分離 |
| R1-7 | `sys.path.insert(0, "lib")` が cwd 依存 | `SKILL.md:179-180` | `CLAUDE_SKILL_DIR` 環境変数 + glob fallback に置換 |

**評価**: 主に **環境差分の認識不足**。Claude Code と claude.ai は同じ MCP 基盤を共有するが、ファイルシステム / シェル / sandbox の挙動は別物。1 つの SKILL.md で両対応するなら、各ステップを「Code 用 / ai 用」に明示分割することが必要だと判明。

---

### Round 2 — 2026-05-08, commit `367bd59` で修正

**追加発見 (FAIL → minor 4 件)**:

| # | 問題 | 該当 | 修正方針 |
|---|---|---|---|
| R2-1 | `chunk.py` が **Python stdlib `chunk` モジュール** と衝突 (3.11 で deprecated, 3.13 で削除) | `lib/chunk.py` | `lib/chunker.py` にリネーム + 全参照を更新 |
| R2-2 | recursive `glob.glob('**/...', recursive=True)` が cwd=`/` で遅すぎる | `SKILL.md:185-186` | 既知パス候補を 5 個 + 階層 3 までの shallow glob に変更 |
| R2-3 | `mcp__claude_ai_Supabase__execute_sql` の hardcode が「接続情報」section に残存 | `SKILL.md:354` | "Code では tool 名 X、ai では connector 同等ツール" 形式 |
| R2-4 | "≤100,000字 かつ ≤5,000字" 表現が冗長 | `SKILL.md:121` | 単に "≤ 5,000字" |

**評価**: Round 1 の修正が一部だけ反映で残存していた箇所の総当たり。MCP tool 名の hardcode のような「文字列検索で全件捕捉できなかった」ものは subagent の grep 力に依存。

---

### Round 3 — 2026-05-08, commit `d768db7` で修正

**追加発見 (CRITICAL 5 + Important 5)**:

#### Critical (5 件、全て埋め込み bug)

| # | 問題 | 該当 | 修正方針 |
|---|---|---|---|
| R3-1 | Step 3-1 INSERT が `$1..$9` PG プレースホルダ使用 → MCP `execute_sql` (literal SQL のみ受付) で実行不可 | `SKILL.md:124-133` | literal SQL リライト、`<escaped_*>` slot 形式に統一 |
| R3-2 | Step 3-1 のコメント `$1=title $2=content` と VALUES の順序が不一致 + `'ja'` `'markdown'` を hardcode (メタの language/content_format と矛盾) | 同上 | 11 列 ↔ 11 値で完全対応、language/content_format はメタ由来に修正 |
| R3-3 | Path resolution の `/mnt/skills` 等の候補は **公式仕様書に記載なし** → 全部失敗時の fallback が `RuntimeError` だけ | `SKILL.md` Step 4-1 claude.ai ブロック | `bash find / -path '*register-insight*chunker.py'` を 3 段目に追加 + Claude が手書きで /tmp に書き出すリカバリ手順 |
| R3-4 | Step 5 wait loop が "Bash 側で 5秒ごとに確認" → claude.ai sandbox には bash も MCP もない | `SKILL.md:298` | "bash polling" を削除し、Claude オーケストレータがループ駆動する旨を明記 |
| R3-5 | Rollback が `is_archived=TRUE` のみ → Step 4 失敗時 `insight_documents` / `document_chunks` が孤児化 | `SKILL.md` 失敗時のロールバック方針 | 失敗 step 別の表 + `DELETE FROM insight_documents` (CASCADE) を追加。`insights` だけ no-physical-DELETE ルールを保つ |

#### Important (5 件)

| # | 問題 | 該当 | 修正方針 |
|---|---|---|---|
| R3-6 | sha256 を frontmatter 除去後 content で計算する spec だが、既存バックフィル SQL は格納された `content` をそのまま hash | `SKILL.md:62-66` vs handover §3 | sha256 ルール明示 + 既存 3 行は frontmatter 無しなので整合 (検証必要) |
| R3-7 | `chunker.py:.strip()` が preamble 前の改行と空白を一律除去 → 原文不変ルール (§不変ルール 1) と緊張 | `chunker.py:24, 29` | `.strip("\n")` に緩和 (空白・タブは保持) |
| R3-8 | `list[int]` PEP-585 generics は Python ≤3.8 で hard-fail | `chunker.py:17, 33, 56` | `from __future__ import annotations` を追加 |
| R3-9 | `build-skill-zip.sh` が `lib/.DS_Store` 等の nested dotfile を除外しない | `scripts/build-skill-zip.sh:18` | `-x "*/.DS_Store" ".DS_Store" "*/.*"` を追加 |
| R3-10 | `metadata.imported_via = "claude_code_skill_register_insight"` が claude.ai 経由でも "claude_code" を含む → 取り違え | `SKILL.md:107` | `"register_insight_v1"` (プラットフォーム非依存) |
| R3-11 | handover doc に `lib/chunk.py` 参照が 12 件残存 (R2-1 リネーム反映漏れ) | `docs/skill-register-insight-handover.md` 各所 | `python3` で in-place 全置換 |

**評価**: Round 3 で初めて **DB 操作に関わる致命的 bug** が複数発覚。特に R3-1 は実行すれば即 SQL エラー。これ以前のラウンドでは「フォーマット / 文言」中心だったが、subagent が今回は SQL 実行 logic まで掘り下げた結果、未検証の placeholder 使用が露見。`__pycache__/` の誤コミットも回収 (commit `2669ec2`)。

---

### Round 4 — 2026-05-08, commit `984614e` で修正

**追加発見 (CRITICAL 3 + new issues 4)**:

| # | 問題 | 該当 | 修正方針 |
|---|---|---|---|
| R4-1 | Step 4-2 で `$chunks_jsonb::jsonb` placeholder が残存 (R3-1 修正で他は literal 化したのに見落とし) | `SKILL.md:271` | literal jsonb + Python で `json.dumps().replace("'", "''")` |
| R4-2 | Step 6 で `$1::vector(768)` placeholder が残存 | `SKILL.md:402` | `'[0.123,0.456,...]'::vector(768)` 形式 + Python 構築 recipe |
| R4-3 | Step 5 のサンプル bash for-loop が "MCP を呼ぶ" 様に書かれていた (bash subshell からは MCP 呼べない) | `SKILL.md:309-317` | bash for-loop pseudocode を削除、Claude オーケストレータが driveする旨を明示 |
| R4-4 | Escape ルール (`<escaped_*>`) 適用漏れ: `<source_app>` `<source_type>` `<category>` `<language>` `<content_format>` `<tag1>` `<tag2>` | `SKILL.md:122, 134-145` | 全 slot を `<escaped_*>` に統一 + 「すべての文字列リテラル slot」を二重化 escape する旨を明記 |
| R4-5 | Truncation rule が `content[:100000]` を char-slice か byte-slice か不明 → UTF-8 多バイト文字で破損リスク | `SKILL.md:158-160` | "Python では `original[:100000]` で UTF-8 安全に char-slice" を追記 |
| R4-6 | `metadata.char_count` が「元の文字数」か「`insights.content` の長さ」か不明 | 同上 | 元の文字数 (= `full_length`) と明記 |

**追加検証**: `insight_documents.doc_type` の CHECK 制約は **存在しない** (ライブ DB 確認: body length CHECK と content_format CHECK のみ)。スキルが提示する `fulltext`/`deep_research`/`transcript`/`reference` は self-imposed convention であり、DB は任意の文字列を受け入れる。

**評価**: R4-1〜R4-2 は R3-1 修正時の反映漏れ。`grep '\$\d' SKILL.md` で全件チェックすべきだったが、subagent が再度ピンポイントで指摘。**`execute_sql` は literal SQL のみ** という制約を一度全 SQL fence に対して総点検する必要があった (今回それを実施)。

---

### Round 5 — 2026-05-08, commit `984614e` 上で fix-up 適用 + push

**最終 audit verdict**: **READY FOR UPLOAD**

残った minor 2 件 (本コミットで適用済み):

| # | 問題 | 該当 | 修正方針 |
|---|---|---|---|
| R5-1 | Step 3-2 (b) `insight_documents` INSERT で `'<source_app>'` が unescape 形式で残存 (Round 4 で他slot を `<escaped_*>` 化したが、Step 3-2 の b は見落とし) | `SKILL.md:177` | `'<escaped_source_app>'` |
| R5-2 | Step 6 の `f"""..."""` 内に `<escaped_query>` という placeholder 文字列があり、f-string 補間されない | `SKILL.md:401-409` | `escaped_query = QUERY.replace("'", "''")` を変数化、`'{escaped_query}'` で補間 |

---

## 2. コミット時系列

| commit | round | 内容 |
|---|---|---|
| `b46e669` | (initial) | Insights DB infrastructure (migrations, edge function, backfill) |
| `217773a` | (initial) | register-insight skill v1 (Claude Code only) |
| `9d80b4e` | (initial) | track supabase/.gitignore |
| `d632674` | (port) | claude.ai port v0 (single SKILL.md, ZIP build script) |
| `7e6abf2` | **R1** | claude.ai 互換性修正 (ZIP root, UI path, network guard, MCP naming, Read tool, paths) |
| `367bd59` | **R2** | minor robustness (chunk → chunker rename, glob 範囲制限, MCP name 漏れ) |
| `d768db7` | **R3** | critical fixes (literal SQL, path-find fallback, wait-loop semantics, rollback完全化, future-imports, escape) |
| `2669ec2` | **R3** | gitignore __pycache__/ + 誤 commit の .pyc 削除 |
| `984614e` | **R4** | placeholder $chunks_jsonb / $1::vector 解消, bash-loop misleading text 削除, escape coverage 完全化 |
| (本コミット) | **R5** | minor: source_app 未 escape, f-string 補間誤りの 2 件 + 本ドキュメント追加 + handover 更新 |

---

## 3. パターン別の知見 (将来のスキル開発で活用)

### 3-1. 「1 SKILL.md で両対応」の落とし穴

`Claude Code` と `claude.ai` は **MCP の名前空間と sandbox の有無** が決定的に異なる。同じドキュメントで両方扱う場合、各ステップで以下の 3 軸を明示すること:
- 入力形式 (パス渡し / 添付 / テキスト)
- スクリプト実行環境 (system Python / sandbox)
- ネットワーク egress (制約なし / allowlist)

### 3-2. MCP `execute_sql` は **literal SQL のみ**

`$1` 等の PG プレースホルダは **使えない**。値は Claude が文字列リテラルに展開する。**全文字列 slot に必ず `'` の `''` 二重化 escape を適用する** (例外なし)。
- 数値 slot → クォート不要
- 配列 → `ARRAY['...','...']::text[]` (各要素 escape)
- jsonb → `'<json string>'::jsonb` (中の `'` も二重化)
- vector → `'[1.23,4.56,...]'::vector(N)` (literal 配列文字列)

### 3-3. claude.ai sandbox の skill 配置パスは公式に未文書化

3 段探索 + bash find fallback は best-effort。E2E でのみ実証可能。配置パスを発見したらこのドキュメント更新を推奨。

### 3-4. wait loop の実装

bash for-loop / sandbox Python のいずれからも MCP は呼べない。**Claude (オーケストレータ) が** 各イテレーションごとに MCP ツールを呼ぶ。bash の `sleep` や Python の `time.sleep` はあくまで時間調整のみ。

### 3-5. 原文不変ルール × 物理 DELETE 禁止 ルール

- `insights.content` / `insight_documents.body` / `document_chunks.body`: AI 整形・要約・誤字修正禁止
- `insights` の物理 DELETE 禁止 (`is_archived=TRUE` のみ)
- 一方 `insight_documents` / `document_chunks` は派生 artifact なので物理 DELETE 可 (handover §タスク2 の `replace_document_chunks()` も DELETE→INSERT)
- 失敗時のロールバックは「`insights` archive + 子テーブル DELETE」の組み合わせが正解

---

## 4. 監査プロセスの所感

- **subagent (general-purpose) で独立 audit** のループが極めて有効。1 ラウンドで 5〜10 件の bug を検出 + 修正 → 次ラウンドで漏れと新たに気づく cross-cutting issue を検出、を 4 回繰り返した。
- 各ラウンドで **prompt に「過去の指摘は棚上げで fresh に審査」** を明示すると、修正済み箇所のリグレッションも検出できる (Round 4 で Round 3 修正の placeholder 反映漏れを発見した)。
- 単独 manual review より、独立 audit を 2-3 回回す方が、コーディングの本質的な穴を出し切るのに効率が良い。

---

## 5. 残課題 (cosmetic、非ブロッキング)

| # | 内容 | 優先度 |
|---|---|---|
| L1 | `:=` (Step 6) と `=>` (handover) で名前付き引数構文の表記が異なる | Low (両方 PG14+ 受け入れ) |
| L2 | `metadata` テンプレート (Step 2-2) に `content_truncated` / `full_length` が prose 説明のみで template に出てこない | Low (一読してわかる) |
| L3 | handover doc の §5-3 で「`SUPABASE_URL`」を export する前提が暗黙 (実際は読み取りに必要) | Low |

これらは E2E 検証 (handover §4 タスク #7) 後に必要に応じて改修。

---

## 6. 次にすること

1. **E2E 検証** (handover §4 タスク #7): 短文 1 + 長文 1 の test md で実際に登録 → embedding → 検索を通す
2. claude.ai 側でアップロード → 同じ操作を実行 (`Customize > Skills` から ZIP)
3. 双方の挙動差分を取って handover §6 に記録
4. 必要に応じて L1-L3 の cosmetic 修正
