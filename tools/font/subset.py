#!/usr/bin/env python3
"""Build the bundled monospace webfont.

The block and box-drawing characters the splash art is made of are missing from
several common system monospace fonts, notably the default on Android. When a
glyph is missing the browser substitutes another face for that one cell, and
the substitute's advance width does not match, which skews the whole row. The
fix is to ship a font we have verified rather than hope for a good system one.

This reads the characters the art actually uses, checks the source font covers
every one of them at a uniform advance width, and emits a subset containing
only what the app needs. Re-run it whenever the art changes; it exits non-zero
rather than quietly producing a font with a hole in it.

Usage:
  tools/font/subset.py \\
      /usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf \\
      src/ui/fonts/dejavu-sans-mono-subset.woff2
"""
import sys
from collections import Counter
from pathlib import Path

from fontTools.subset import Options, Subsetter
from fontTools.ttLib import TTFont

ART = Path("src/ui/art.ts")

# Codepoints the UI needs beyond whatever the art uses. Printable ASCII covers
# the interface text; the rest are written as HTML entities or are otherwise
# invisible to a source scan.
BASE = set(range(0x20, 0x7F)) | {
    0x00A0,  # no-break space
    0x00B0,  # degree sign, written as &deg;
    0x2019,  # right single quote, in case copy ever uses a typographic one
}


def art_codepoints() -> set[int]:
    if not ART.exists():
        sys.exit(f"cannot find {ART}; run this from the repository root")
    return {ord(c) for c in ART.read_text(encoding="utf-8") if ord(c) > 0x7F}


def verify(font: TTFont, codepoints: set[int]) -> None:
    cmap = font.getBestCmap()
    hmtx = font["hmtx"]
    cell = Counter(w for w, _ in hmtx.metrics.values()).most_common(1)[0][0]

    missing = sorted(cp for cp in codepoints if cp not in cmap)
    wrong = sorted(
        (cp, hmtx.metrics[cmap[cp]][0])
        for cp in codepoints
        if cp in cmap and hmtx.metrics[cmap[cp]][0] != cell
    )

    if missing or wrong:
        if missing:
            print("missing glyphs: "
                  + " ".join(f"U+{c:04X}" for c in missing), file=sys.stderr)
        if wrong:
            # Present but the wrong width skews a row exactly like a hole does.
            print("non-uniform advance width: "
                  + " ".join(f"U+{c:04X}={w} (cell {cell})" for c, w in wrong),
                  file=sys.stderr)
        sys.exit("source font does not cover the art; fix the art or the font")

    print(f"verified {len(codepoints)} codepoints at a uniform advance of {cell}")


def main(src: str, dst: str) -> None:
    codepoints = BASE | art_codepoints()

    verify(TTFont(src, fontNumber=0, lazy=True), codepoints)

    options = Options()
    options.flavor = "woff2"
    options.layout_features = []
    options.desubroutinize = True
    options.notdef_outline = True

    font = TTFont(src, fontNumber=0)
    subsetter = Subsetter(options=options)
    subsetter.populate(unicodes=codepoints)
    subsetter.subset(font)

    out = Path(dst)
    out.parent.mkdir(parents=True, exist_ok=True)
    font.save(out)
    print(f"wrote {out} ({out.stat().st_size / 1024:.1f} kB)")


if __name__ == "__main__":
    if len(sys.argv) != 3:
        sys.exit(__doc__)
    main(sys.argv[1], sys.argv[2])
