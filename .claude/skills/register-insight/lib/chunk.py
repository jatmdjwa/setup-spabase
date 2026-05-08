#!/usr/bin/env python3
# Markdown チャンク分割 (handover §タスク2 のルールに準拠)
# 入力: stdin に markdown
# 出力: stdout に JSON 配列 [{body, section_title, section_path}]
# ルール:
#   - H1 / H2 で大章分割 (preamble は最初の見出し前テキスト)
#   - 5,000字を超える章はさらに H3 → 段落単位で分割
#   - 各 chunk の body は原文ママ (整形・正規化なし)

import json
import re
import sys

MAX_CHUNK_CHARS = 5000


def split_by_headings(md: str, levels: list[int]):
    sections = []
    cur = {"title": "preamble", "level": 0, "lines": []}
    for line in md.split("\n"):
        m = re.match(r"^(#{1,6})\s+(.+?)\s*$", line)
        if m and len(m.group(1)) in levels:
            sections.append(
                {"title": cur["title"], "level": cur["level"], "body": "\n".join(cur["lines"]).strip()}
            )
            cur = {"title": m.group(2).strip(), "level": len(m.group(1)), "lines": []}
        else:
            cur["lines"].append(line)
    sections.append({"title": cur["title"], "level": cur["level"], "body": "\n".join(cur["lines"]).strip()})
    return [s for s in sections if s["body"] or s["title"] != "preamble"]


def split_by_paragraph(text: str, max_chars: int) -> list[str]:
    paragraphs = re.split(r"\n\n+", text)
    out: list[str] = []
    buf = ""
    for p in paragraphs:
        candidate = (buf + "\n\n" + p) if buf else p
        if len(candidate) > max_chars and buf:
            out.append(buf)
            buf = p
        else:
            buf = candidate
    if buf:
        out.append(buf)
    final: list[str] = []
    for c in out:
        if len(c) <= max_chars:
            final.append(c)
        else:
            for i in range(0, len(c), max_chars):
                final.append(c[i : i + max_chars])
    return final


def chunk_section(body: str, parent_title: str, parent_path: list[str]):
    if len(body) <= MAX_CHUNK_CHARS:
        return [{"body": body, "section_title": parent_title, "section_path": parent_path}]
    sub = split_by_headings(body, [3])
    has_h3 = len(sub) > 1 or (len(sub) == 1 and sub[0]["title"] != "preamble")
    out = []
    if has_h3:
        for s in sub:
            path = parent_path if s["title"] == "preamble" else parent_path + [s["title"]]
            title = parent_title if s["title"] == "preamble" else s["title"]
            if len(s["body"]) <= MAX_CHUNK_CHARS:
                out.append({"body": s["body"], "section_title": title, "section_path": path})
            else:
                parts = split_by_paragraph(s["body"], MAX_CHUNK_CHARS)
                for i, part in enumerate(parts):
                    t = f"{title} (part {i + 1}/{len(parts)})" if len(parts) > 1 else title
                    out.append({"body": part, "section_title": t, "section_path": path})
        return out
    parts = split_by_paragraph(body, MAX_CHUNK_CHARS)
    return [
        {
            "body": p,
            "section_title": f"{parent_title} (part {i + 1}/{len(parts)})" if len(parts) > 1 else parent_title,
            "section_path": parent_path,
        }
        for i, p in enumerate(parts)
    ]


def chunk(md: str):
    top = split_by_headings(md, [1, 2])
    chunks = []
    for s in top:
        path = [] if s["title"] == "preamble" else [s["title"]]
        chunks.extend(chunk_section(s["body"], s["title"], path))
    return [c for c in chunks if c["body"].strip()]


if __name__ == "__main__":
    md = sys.stdin.read()
    print(json.dumps(chunk(md), ensure_ascii=False, indent=2))
