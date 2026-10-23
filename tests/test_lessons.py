import unittest
import importlib.util
from pathlib import Path
spec = importlib.util.spec_from_file_location("build_lessons", Path(__file__).resolve().parent.parent / "build-lessons.py")
lessons = importlib.util.module_from_spec(spec)
spec.loader.exec_module(lessons)

class TestExtractor(unittest.TestCase):
    """build-lessons.py against the note shapes the vault actually contains."""

    def claim(self, body):
        return lessons.claim_of(body)

    def test_reads_every_label_spelling(self):
        for body in (
            "**Principle:** Ship small changes often.",
            "**Principle.** Ship small changes often.",
            "- Principle: Ship small changes often.",
            "- **Principle:** Ship small changes often.",
            "Principle: Ship small changes often.",
            "### Principle\nShip small changes often.",
        ):
            with self.subTest(body=body):
                self.assertEqual(self.claim(body), "Ship small changes often.")

    def test_prefers_the_claim_over_its_commentary(self):
        body = (
            "**Status:** Explicit.\n"
            "**Meaning:** A gloss that is not the claim.\n"
            "**Principle:** The claim itself.\n"
        )
        self.assertEqual(self.claim(body), "The claim itself.")

    def test_falls_back_past_labels_it_will_not_quote(self):
        """A section with only commentary still has to yield something, but
        never the commentary label's text."""
        self.assertEqual(self.claim("**Status:** Explicit.\n"), None)
        self.assertEqual(self.claim("**Status:** Explicit.\n\nPlain prose.\n"),
                         "Plain prose.")

    def test_skips_blockquote_disclaimers(self):
        body = "> Educational reconstruction. Not advice.\n\nThe real claim.\n"
        self.assertEqual(self.claim(body), "The real claim.")

    def test_strips_citations_but_keeps_other_brackets(self):
        body = "**Principle:** A claim [Book, 1: Chapter, §1.3] with [brackets]."
        self.assertEqual(self.claim(body), "A claim with [brackets].")

    def test_label_lookup_survives_a_curly_apostrophe(self):
        self.assertEqual(lessons.norm("Author’s Reasoning"),
                         "author's reasoning")

    def test_numbered_sections_at_both_depths(self):
        text = "## 1. First\n**Principle:** One.\n\n### 2. Second\n**Principle:** Two.\n"
        self.assertEqual(
            [t for t, _ in lessons.sections(text)], ["First", "Second"]
        )

    def test_bold_lead_items_split_into_title_and_body(self):
        """Bulleted and numbered spellings both occur; Systematic Trading is
        entirely the numbered one."""
        for marker in ("-", "1."):
            text = (
                "## Core Principles\n"
                f"{marker} **Define a method.** Traders describe a setup.\n"
            )
            with self.subTest(marker=marker):
                self.assertEqual(
                    list(lessons.bold_lead(text)),
                    [("Define a method", "Traders describe a setup.")],
                )

    def test_bold_lead_only_reads_principle_sections(self):
        """The legend, the scope note and the evidence table are the same
        shape as a claim, so shape alone cannot tell them apart."""
        text = (
            "## Source Labels\n"
            "- **[Definition]** A definition stated in the book.\n"
            "\n## Evidence quality, assumptions, and limits\n"
            "- **Assumptions:** The principles can be used as questions.\n"
            "\n## Core Principles\n"
            "- **Standardise by volatility.** Risk adjustment makes it comparable.\n"
        )
        self.assertEqual(
            [t for t, _ in lessons.bold_lead(text)], ["Standardise by volatility"]
        )

    def test_bold_lead_skips_a_heading_that_disclaims(self):
        text = (
            "## What The Principles Do Not Establish\n"
            "- **Nothing here is advice.** These are not trade instructions.\n"
        )
        self.assertEqual(list(lessons.bold_lead(text)), [])

    def test_source_tags_are_dropped_from_the_body(self):
        text = (
            "## Core Principles\n"
            "1. **Standardise by volatility.** [Definition] Risk adjustment "
            "makes positions comparable.\n"
        )
        self.assertEqual(
            list(lessons.bold_lead(text)),
            [("Standardise by volatility",
              "Risk adjustment makes positions comparable.")],
        )

    def test_author_metadata_is_tidied(self):
        cases = {
            "Nassim Nicholas Taleb [Taleb, Nassim Nicholas]; chenjin5.com":
                "Nassim Nicholas Taleb",
            "Kahneman, Daniel": "Daniel Kahneman",
            "Kurt Vonnegut, Jr.": "Kurt Vonnegut, Jr.",
            "Brian Christian; Tom Griffiths": "Brian Christian, Tom Griffiths",
            "": "",
        }
        for raw, expected in cases.items():
            with self.subTest(raw=raw):
                self.assertEqual(lessons.tidy_author(raw), expected)
