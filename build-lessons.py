#!/usr/bin/env python3
"""Extract book principles from the 2nd brain into lessons.json.

    ./build-lessons.py              # default vault path, see VAULT
    ./build-lessons.py --vault DIR  # somewhere else
    ./build-lessons.py --list       # what it found, per book, no write

The extension ships no lessons of its own; it reads the file this writes.
Re-run it after reading a book. Nothing else depends on it, and the page
degrades to just the Tahoe wallpaper if the file is missing.

lessons.json is NOT tracked. It is a derivative of the reading notes, which are
in turn a derivative of copyrighted books - see the .gitignore entry. The vault
is the source of truth; this output is a cache, rebuilt per machine.

WHY THIS IS NOT A ONE-LINE GREP

A principles.md is a list of numbered sections, each holding several labelled
paragraphs. Both halves of that sentence drifted over the months the notes were
written, and every spelling below is still live in the vault:

    **Principle:** text        **Principle.** text        ### Principle
    - Principle: text          - **Principle:** text      text

The label is bold or plain, bulleted or not, closed by a colon or a full stop,
or promoted to its own h3. The *name* drifts too - Housel and Kahneman lead with
"Author states", the Graham/Zweig volumes with "Graham principle", Lost
Connections with "Author claim" - and those volumes also number their sections
with ### under a ## Core Principles heading rather than ##.

So matching is driven by the vocabulary in CLAIM and NOISE, not by shape. The
alternative - accepting any `Word:` or `Word.` as a label - silently swallows
ordinary prose whose first sentence happens to be short, which is how a
disclaimer ends up on the new tab page.

CLAIM is ordered by how close a label sits to "the claim itself". NOISE is
everything that is commentary ON a claim: "Meaning" explains it, "Qualification"
hedges it, "Connections" relates it to other sections, "Status" and "Register"
say how firmly the author held it. Those read as non-sequiturs with the claim
absent, so a section offering only those falls through to FALLBACK - its first
plain paragraph - and is skipped entirely if it has none.
"""

import argparse
import json
import os
import pathlib
import re
import sys
import unicodedata

VAULT = pathlib.Path.home() / (
    "Library/Mobile Documents/com~apple~CloudDocs/2nd-brain/300 resources/books"
)
OUT = pathlib.Path(__file__).parent / "lessons.json"

# First match wins, so this is a preference order, not a set.
CLAIM = [
    "principle",
    "principle — author states",
    "graham principle",
    "author claim",
    "author states",
    "interpretation",
    "strong interpretation",
    "meaning and use",
    "meaning and reasoning",
    "what it is for",
    "author's reasoning",
    "reasoning",
]

# Recognized, but never the claim. Listed rather than inferred so that a new
# label in the vault shows up as MISSING in --list instead of being guessed at.
NOISE = {
    "status", "register", "meaning", "connections", "connection", "critique",
    "qualification", "qualifications", "qualifications and limitations",
    "supporting sections", "supporting section", "overall assessment",
    "examples/evidence", "synthesis", "evidence quality", "limitations",
    "scope", "scope and method", "source labels", "interpretation key",
    "attribution key", "zweig extension", "buffett evidence", "read status",
}

LABELS = {*CLAIM, *NOISE}

# Both spellings of a numbered section. The Graham/Zweig books nest ### under a
# ## Core Principles heading; everything else numbers at ##. The number itself
# orders sections within one book and means nothing here, so it is discarded.
HEADING = re.compile(r"^#{2,3}\s+\d+\.\s+(.+?)\s*$", re.M)

# An inline label: optional bullet, optional bold, closed by ':' or '.'. The
# closer may fall inside or outside the bold - "**Principle:**" and
# "**Principle.**" both occur - so both markers are optional on each side.
# Bounded at 40 characters because every real label is far shorter, and the
# bound is what stops a runaway match on a paragraph with no label at all.
INLINE = re.compile(
    r"^[-*]?[ \t]*(?:\*\*)?([A-Za-z][^:*\n]{1,38}?)[:.](?:\*\*)?[ \t]+(\S.*?)[ \t]*$",
    re.M,
)

# A label promoted to its own heading, with the paragraph on the line below.
BLOCK = re.compile(r"^#{3,4}[ \t]*(?:\*\*)?([A-Za-z][^:*\n]{1,38}?)[:.]?(?:\*\*)?[ \t]*$"
                   r"\n+([^\n#>].*?)[ \t]*$", re.M)

# Any section heading, for scoping the bullet format below - as opposed to
# HEADING above, which only matches the numbered ones.
ANY_HEADING = re.compile(r"^#{2,3}\s+(.+?)\s*$", re.M)

# A list item whose bold opening sentence IS the claim, with the rest as body:
#   - **Define a method rather than improvising.** Kullamagi, Russo [...]
#   1. **Systematise commitment.** [Author principle] Objective rules [...]
# Both markers occur, and the numbered spelling is the whole of Systematic
# Trading. Used only for books with no numbered sections, where this is the
# entire format - so the digits here can never collide with a "## 1." heading.
BOLD_LEAD = re.compile(
    r"^(?:[-*]|\d+\.)[ \t]+\*\*(.+?)\.?\*\*[ \t]+(\S.*?)[ \t]*$", re.M
)

# A source tag opening the body of one of those items - "[Author heuristic]",
# "[Definition]", "[Implementation assumption]". It classifies the claim
# rather than saying anything, so it is dropped from the rendered text.
SOURCE_TAG = re.compile(r"^\[[^\]]{2,40}\][ \t]*")

# Last resort for a numbered section carrying no recognized label: its first
# ordinary paragraph. Excludes headings, bullets and blockquotes, which is what
# keeps the "these are not trade instructions" disclaimers off the page.
FALLBACK = re.compile(r"^(?![#>\-*\s])(\S.*?)[ \t]*$", re.M)

# "[Atomic Habits, 1: The Surprising Power of Atomic Habits, §1.3]" and friends.
# Anchored on the section mark so a bracket in the prose itself survives; every
# citation in the vault carries one. Some run "§1.3–§1.5", hence the lazy body.
CITATION = re.compile(r"\s*\[[^\[\]]*?§[^\[\]]*?\]")

# A lesson has to earn a full screen. The floor drops section stubs that are a
# pointer rather than a claim; the ceiling drops the handful of paragraphs that
# run past a readable block over a photograph - at 520 characters the page is
# already three dense lines at its smallest step. Raising the ceiling is safe;
# lowering it below ~300 starts cutting real content, as the median is 180.
MIN_LEN = 60
MAX_LEN = 520


def norm(raw):
    """Normalize a label for lookup: unicode form, case, apostrophe, spacing.

    The vault mixes U+2019 and U+0027 in "Author's reasoning"; matching the
    literal bytes silently drops a book.
    """
    s = unicodedata.normalize("NFKC", raw).lower().strip()
    return re.sub(r"\s+", " ", s.replace("’", "'").replace("‘", "'"))


def clean(text):
    """Strip citations and markdown emphasis; collapse whitespace."""
    text = CITATION.sub("", text)
    text = re.sub(r"\*\*(.+?)\*\*", r"\1", text)
    text = re.sub(r"(?<!\*)\*([^*\n]+)\*(?!\*)", r"\1", text)
    text = re.sub(r"\[\[[^\]|]+\|([^\]]+)\]\]", r"\1", text)    # [[link|label]]
    text = re.sub(r"\[\[([^\]]+)\]\]", r"\1", text)
    text = re.sub(r"`([^`]+)`", r"\1", text)
    return re.sub(r"\s+", " ", text).strip()


def frontmatter(text):
    """The leading YAML block as a flat dict. Good enough for scalar keys."""
    if not text.startswith("---"):
        return {}
    end = text.find("\n---", 3)
    if end == -1:
        return {}
    out = {}
    for line in text[3:end].splitlines():
        key, sep, value = line.partition(":")
        if sep and not key.startswith(" "):
            out[key.strip()] = value.strip().strip("\"'")
    return out


# Name suffixes that follow a comma without meaning "surname first", so that
# "Kurt Vonnegut, Jr." survives the flip that turns "Kahneman, Daniel" around.
SUFFIXES = {"jr", "jr.", "sr", "sr.", "ii", "iii", "iv", "phd", "ph.d.", "md"}


def tidy_author(raw):
    """Normalize an author line carried over from EPUB metadata.

    The vault takes these straight from the file, so they arrive in whatever
    shape the publisher left: a Calibre-style duplicate in brackets, a
    scanner's domain appended after a semicolon, or surname-first. Multiple
    authors are semicolon-separated and stay that way, joined with commas.
    """
    if not raw:
        return ""
    raw = re.sub(r"\s*\[[^\]]*\]", "", raw)            # [Taleb, Nassim Nicholas]
    parts = []
    for part in raw.split(";"):
        name = part.strip().strip(",")
        if not name or re.fullmatch(r"[\w.-]+\.(com|net|org|io)", name, re.I):
            continue                                    # "chenjin5.com"
        head, sep, tail = name.partition(",")
        if sep and tail.strip().lower().rstrip(".") not in SUFFIXES:
            if " " not in head.strip() and tail.strip():
                name = f"{tail.strip()} {head.strip()}"  # "Kahneman, Daniel"
        parts.append(name)
    return ", ".join(parts)


def author_for(path, meta):
    """Author from principles.md, else the book's index.md. May be ''.

    Seven of the 34 principles.md files carry no author key. Most sit beside
    an index.md that does; the Jiji shelf has no index.md at all and keeps its
    authorship in prose, which is not worth parsing. A lesson with no author
    still renders - the byline collapses to the book title - so this never
    fails.
    """
    if meta.get("author"):
        return tidy_author(meta["author"])
    index = path.parent / "index.md"
    if index.exists():
        side = frontmatter(index.read_text(encoding="utf-8", errors="replace"))
        return tidy_author(side.get("author", ""))
    return ""


def labelled(body):
    """{normalized label: text} for every recognized label in one section."""
    found = {}
    for pattern in (INLINE, BLOCK):
        for m in pattern.finditer(body):
            key = norm(m.group(1))
            if key in LABELS:
                found.setdefault(key, m.group(2))
    return found


def claim_of(body):
    """The best available claim paragraph in one section, or None."""
    found = labelled(body)
    for label in CLAIM:
        if label in found:
            return clean(found[label])
    # No recognized claim label. Take the first ordinary paragraph, unless it
    # is itself a labelled line we chose not to treat as a claim.
    for m in FALLBACK.finditer(body):
        line = m.group(1)
        inline = INLINE.match(line)
        if inline and norm(inline.group(1)) in LABELS:
            continue
        return clean(line)
    return None


def sections(text):
    """Yield (title, body) per numbered heading, body running to the next one."""
    marks = list(HEADING.finditer(text))
    for i, m in enumerate(marks):
        end = marks[i + 1].start() if i + 1 < len(marks) else len(text)
        yield clean(m.group(1)), text[m.end():end]


def headed(text):
    """Yield (heading, body) per ## or ### section, whether numbered or not."""
    marks = list(ANY_HEADING.finditer(text))
    for i, m in enumerate(marks):
        end = marks[i + 1].start() if i + 1 < len(marks) else len(text)
        yield clean(m.group(1)), text[m.end():end]


def bold_lead(text):
    """Yield (title, body) for the bold-opening-sentence bullet format.

    Scoped to sections that say they hold principles, because the files in
    this format put a legend ("## Source Labels"), a scope note and an
    evidence-quality table in exactly the same shape - bold opener, prose
    body - and shape alone cannot tell a claim from a table row. Without the
    scope, Systematic Trading contributes its three legend entries and
    nothing else, and "[Author heuristic]" lands on the new tab page.

    The negation guard is for "What The Principles Do Not Establish", the one
    heading that names principles in order to disclaim them.
    """
    for heading, body in headed(text):
        name = norm(heading)
        if "principle" not in name or re.search(r"\bnot\b", name):
            continue
        for m in BOLD_LEAD.finditer(body):
            title = clean(m.group(1))
            # A labelled bullet, or a legend key like "[Definition]".
            if norm(title) in LABELS or title.startswith("["):
                continue
            yield title, SOURCE_TAG.sub("", clean(m.group(2)))


def extract(vault):
    """Walk the vault. Returns (lessons, per-book stats)."""
    lessons, stats = [], []
    for path in sorted(vault.rglob("principles.md")):
        text = path.read_text(encoding="utf-8", errors="replace")
        meta = frontmatter(text)
        # The folder name is the book. The vault groups some under a shelf
        # directory ("Jiji - Investment & Trading/The Intelligent Investor")
        # and the shelf is not part of the title.
        book = path.parent.name
        author = author_for(path, meta)

        found = [(t, claim_of(b)) for t, b in sections(text)]
        if not found:
            # No numbered sections at all: the whole file is claim bullets.
            found = list(bold_lead(text))

        kept = missing = skipped = 0
        for title, claim in found:
            if not claim:
                missing += 1
                continue
            if not MIN_LEN <= len(claim) <= MAX_LEN:
                skipped += 1
                continue
            lessons.append(
                {"title": title, "body": claim, "book": book, "author": author}
            )
            kept += 1
        stats.append((book, kept, missing, skipped))
    return lessons, stats


def main():
    doc = (__doc__ or "").splitlines()
    ap = argparse.ArgumentParser(description=doc[0] if doc else "")
    ap.add_argument("--vault", type=pathlib.Path, default=VAULT)
    ap.add_argument("--out", type=pathlib.Path, default=OUT)
    ap.add_argument("--list", action="store_true", help="report only, write nothing")
    args = ap.parse_args()

    if not args.vault.is_dir():
        sys.exit(
            f"no book vault at {args.vault}\n"
            "iCloud Drive may not be signed in, or pass --vault."
        )

    lessons, stats = extract(args.vault)
    if not lessons:
        sys.exit(f"found no lessons under {args.vault} - has the note format changed?")

    if args.list:
        for book, kept, missing, skipped in sorted(stats):
            note = f"  MISSING {missing}" if missing else ""
            note += f"  length {skipped}" if skipped else ""
            print(f"{kept:4}  {book}{note}")
        print(f"\n{len(lessons)} lessons from {len(stats)} books")
        return

    # Sorted so an unchanged vault produces a byte-identical file and a real
    # diff is a real change; json.dump would otherwise follow the walk order.
    lessons.sort(key=lambda x: (x["book"], x["title"]))
    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(
        json.dumps(lessons, ensure_ascii=False, indent=1) + "\n", encoding="utf-8"
    )
    size = os.path.getsize(args.out) / 1024
    print(f"{len(lessons)} lessons from {len(stats)} books -> {args.out} ({size:.0f} KB)")


if __name__ == "__main__":
    main()
