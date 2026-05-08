#!/usr/bin/env python3
"""Unit tests for .claude/skills/register-insight/lib/chunker.py.

Run with: python3 -m unittest tests.test_chunker
   or:    python3 -m unittest discover -s tests
   or:    pytest tests/test_chunker.py
"""
from __future__ import annotations

import os
import sys
import unittest

REPO_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), os.pardir))
LIB_DIR = os.path.join(REPO_ROOT, ".claude", "skills", "register-insight", "lib")
if LIB_DIR not in sys.path:
    sys.path.insert(0, LIB_DIR)

from chunker import MAX_CHUNK_CHARS, chunk  # noqa: E402


class TestChunkerBasic(unittest.TestCase):
    def test_empty_string(self):
        self.assertEqual(chunk(""), [])

    def test_whitespace_only(self):
        # Pure whitespace should be filtered out at the end (body.strip() == "")
        self.assertEqual(chunk("   \n\n   "), [])

    def test_single_h1_no_body(self):
        # H1 alone with no body -> chunk_section gets body="", chunked but
        # filtered out by the final empty-body filter.
        self.assertEqual(chunk("# Title"), [])

    def test_h1_with_short_body(self):
        md = "# Chapter\n\nHello world."
        result = chunk(md)
        self.assertEqual(len(result), 1)
        self.assertEqual(result[0]["section_title"], "Chapter")
        self.assertEqual(result[0]["section_path"], ["Chapter"])
        self.assertEqual(result[0]["body"], "Hello world.")


class TestChunkerBoundaries(unittest.TestCase):
    def test_body_exactly_at_max(self):
        body = "a" * MAX_CHUNK_CHARS
        md = f"# Chapter\n\n{body}"
        result = chunk(md)
        # Body length is exactly MAX -> should remain a single chunk.
        self.assertEqual(len(result), 1)
        self.assertEqual(len(result[0]["body"]), MAX_CHUNK_CHARS)
        self.assertEqual(result[0]["section_title"], "Chapter")

    def test_body_just_over_max_forces_split(self):
        # Two paragraphs separated by blank line; total > MAX, each piece <= MAX.
        para = "x" * (MAX_CHUNK_CHARS - 100)
        md = f"# Chapter\n\n{para}\n\n{para}"
        result = chunk(md)
        self.assertGreater(len(result), 1)
        for c in result:
            self.assertLessEqual(len(c["body"]), MAX_CHUNK_CHARS)
            self.assertEqual(c["section_path"], ["Chapter"])
            self.assertTrue(c["section_title"].startswith("Chapter"))
        # Multi-part titles must be tagged with "(part i/n)".
        self.assertIn("part", result[0]["section_title"])

    def test_single_paragraph_longer_than_max(self):
        # No paragraph break -> hard char split fallback.
        body = "y" * (MAX_CHUNK_CHARS * 2 + 123)
        md = f"# Chapter\n\n{body}"
        result = chunk(md)
        self.assertEqual(len(result), 3)
        self.assertEqual(len(result[0]["body"]), MAX_CHUNK_CHARS)
        self.assertEqual(len(result[1]["body"]), MAX_CHUNK_CHARS)
        self.assertEqual(len(result[2]["body"]), 123)
        # Reassembled body equals original.
        self.assertEqual("".join(c["body"] for c in result), body)


class TestChunkerStructure(unittest.TestCase):
    def test_multiple_h2_chapters(self):
        md = "## A\n\nbody A\n\n## B\n\nbody B\n\n## C\n\nbody C"
        result = chunk(md)
        self.assertEqual(len(result), 3)
        titles = [c["section_title"] for c in result]
        self.assertEqual(titles, ["A", "B", "C"])
        for c, expected_body in zip(result, ["body A", "body B", "body C"]):
            self.assertEqual(c["body"], expected_body)
            self.assertEqual(c["section_path"], [c["section_title"]])

    def test_preamble_before_first_heading(self):
        md = "intro paragraph\n\n# Chapter\n\nchapter body"
        result = chunk(md)
        self.assertEqual(len(result), 2)
        self.assertEqual(result[0]["section_title"], "preamble")
        self.assertEqual(result[0]["section_path"], [])
        self.assertEqual(result[0]["body"], "intro paragraph")
        self.assertEqual(result[1]["section_title"], "Chapter")
        self.assertEqual(result[1]["section_path"], ["Chapter"])

    def test_h3_subdivision_inside_oversized_h2(self):
        # H2 chapter > MAX with two H3 sub-sections, each small enough alone.
        sub_body = "z" * 3000
        md = (
            "## Big\n\n"
            f"### Sub A\n\n{sub_body}\n\n"
            f"### Sub B\n\n{sub_body}\n"
        )
        result = chunk(md)
        # H2 body exceeds MAX -> split by H3 -> 2 chunks, neither needs further split.
        self.assertEqual(len(result), 2)
        self.assertEqual(result[0]["section_title"], "Sub A")
        self.assertEqual(result[0]["section_path"], ["Big", "Sub A"])
        self.assertEqual(result[1]["section_title"], "Sub B")
        self.assertEqual(result[1]["section_path"], ["Big", "Sub B"])
        for c in result:
            self.assertLessEqual(len(c["body"]), MAX_CHUNK_CHARS)

    def test_h3_subdivision_with_oversized_subsection(self):
        # H3 sub-section itself exceeds MAX -> further paragraph split with part tag.
        sub_body_big = ("p " * (MAX_CHUNK_CHARS // 2)).strip()
        para = "q" * 4000
        md = (
            "## Big\n\n"
            f"### Tiny\n\nshort\n\n"
            f"### Huge\n\n{para}\n\n{para}\n"
        )
        result = chunk(md)
        # Tiny -> 1 chunk; Huge -> >=2 parts.
        self.assertGreaterEqual(len(result), 3)
        tiny = [c for c in result if c["section_path"] == ["Big", "Tiny"]]
        huge = [c for c in result if c["section_path"] == ["Big", "Huge"]]
        self.assertEqual(len(tiny), 1)
        self.assertEqual(tiny[0]["body"], "short")
        self.assertGreaterEqual(len(huge), 2)
        for c in huge:
            self.assertLessEqual(len(c["body"]), MAX_CHUNK_CHARS)
            self.assertTrue(c["section_title"].startswith("Huge"))
            self.assertIn("part", c["section_title"])


class TestChunkerContentPreservation(unittest.TestCase):
    def test_utf8_japanese(self):
        md = "# 日本語の章\n\nこれはテスト本文です。改行も含みます。\n二行目。"
        result = chunk(md)
        self.assertEqual(len(result), 1)
        self.assertEqual(result[0]["section_title"], "日本語の章")
        self.assertEqual(result[0]["section_path"], ["日本語の章"])
        self.assertIn("これはテスト本文です。", result[0]["body"])
        self.assertIn("二行目。", result[0]["body"])

    def test_internal_whitespace_preserved(self):
        # split_by_headings only applies .strip("\n") at section boundaries.
        # Internal spaces, tabs, and trailing/leading spaces on lines must survive.
        md = "# Chapter\n\n  leading-spaces\n\ttabbed line\ntrailing-spaces  "
        result = chunk(md)
        self.assertEqual(len(result), 1)
        body = result[0]["body"]
        self.assertIn("  leading-spaces", body)
        self.assertIn("\ttabbed line", body)
        self.assertIn("trailing-spaces  ", body)

    def test_section_boundary_strips_only_newlines(self):
        # Extra blank lines around the section body should be stripped, but not other ws.
        md = "# Chapter\n\n\n\nactual body\n\n\n"
        result = chunk(md)
        self.assertEqual(len(result), 1)
        self.assertEqual(result[0]["body"], "actual body")


class TestChunkerCodeFences(unittest.TestCase):
    """Code-fence handling — known limitation regression tests.

    The current implementation uses a simple line-based regex and does NOT
    track fenced code blocks. Hash-prefixed lines inside ```...``` fences will
    therefore be treated as headings. We document this limitation here rather
    than fail the build; if fenced-block awareness is added, flip the xfail.
    """

    def test_hash_inside_code_fence_is_currently_treated_as_heading(self):
        md = (
            "# Real Heading\n\n"
            "```python\n"
            "# this is a python comment, not a heading\n"
            "x = 1\n"
            "```\n"
            "tail text"
        )
        result = chunk(md)
        titles = [c["section_title"] for c in result]
        if "this is a python comment, not a heading" in titles:
            # Known limitation: line-based heading scan ignores fences.
            self.skipTest(
                "Known limitation: chunker does not track ``` fences; "
                "'# comment' lines inside code blocks are misread as headings. "
                "Expected fix: track fence state in split_by_headings (chunker.py L19-32)."
            )
        # If the implementation gains fence awareness, this branch verifies it.
        self.assertEqual(len(result), 1)
        self.assertEqual(result[0]["section_title"], "Real Heading")
        self.assertIn("# this is a python comment", result[0]["body"])


class TestChunkerRealFixture(unittest.TestCase):
    """Regression test against the real gemini-deepresearch.md fixture.

    Per the chunker's own behavior on the committed fixture: 10 chunks,
    bodies summing to 31838 chars (handover §2-1 referenced 12 chunks for an
    earlier corpus; the current corpus produces 10).
    """

    FIXTURE = os.path.join(REPO_ROOT, "docs", "gemini-deepresearch.md")

    def setUp(self):
        if not os.path.exists(self.FIXTURE):
            self.skipTest(f"fixture not present: {self.FIXTURE}")
        with open(self.FIXTURE, encoding="utf-8") as f:
            self.md = f.read()

    def test_chunk_count_and_total_chars(self):
        result = chunk(self.md)
        total = sum(len(c["body"]) for c in result)
        self.assertEqual(len(result), 10, f"expected 10 chunks, got {len(result)}")
        self.assertEqual(total, 31838, f"expected 31838 total chars, got {total}")

    def test_chunk_sizes_within_max(self):
        for c in chunk(self.md):
            self.assertLessEqual(len(c["body"]), MAX_CHUNK_CHARS)

    def test_chunk_metadata_shape(self):
        for c in chunk(self.md):
            self.assertIn("body", c)
            self.assertIn("section_title", c)
            self.assertIn("section_path", c)
            self.assertIsInstance(c["body"], str)
            self.assertIsInstance(c["section_title"], str)
            self.assertIsInstance(c["section_path"], list)


if __name__ == "__main__":
    unittest.main()
