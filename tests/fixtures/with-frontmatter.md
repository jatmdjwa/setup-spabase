---
title: テスト用 frontmatter ノート
tags: [test, frontmatter, claude]
source_app: chatgpt
---

# Claude Skills のメモ

Claude Skills は `SKILL.md` 1 枚 + 補助スクリプトでドメイン知識をパッケージ化する仕組み。
Claude Code と claude.ai の両方で動くように書ければ、移植コストはほぼゼロになる。

ポイントは 3 つ:

- フロントマターの `name` と `description` で trigger される
- 補助スクリプトは標準ライブラリのみで書くと sandbox 制約に強い
- 外部 HTTP は claude.ai 側で allowlist が必要なので、Supabase MCP 経由を優先する
