# Lemonade

A single-player web version of Lemonade, the BBS door game published by T&J
Software from 1996. An accurate recreation of the original formulas, random
events, and other behavior.

Background on the original: https://breakintochat.com/wiki/Lemonade

## Running it

```
npm install
npm run dev      # development server
npm test         # 93 tests
npm run build    # type check and production bundle
```

Deployment to GitHub Pages happens on push to `main`. Assets use a relative
base so the build works under the project path, at a domain root, and from a
locally opened `dist/`.

## How it fits together

```
src/engine/     The simulation. Pure, deterministic, no DOM or clock.
src/ui/         Screens, styling, and the bundled font.
src/storage/    Local storage, with an in memory fallback.
tools/re/       Reverse engineering the original binary.
tools/font/     Building the bundled font subset.
public/         Static assets, mainly favicons.
docs/           Design spec, implementation plan, recovered model.
```

The engine is a pure function of a seed and the player's decisions. It never
reads the clock or a global random source, which is what makes it trivially
testable and a run exactly replayable. A test fails the build if any engine
module reaches for ambient state.

Start with [`docs/recovered-model.md`](docs/recovered-model.md) to understand
what the game actually computes, including three original quirks preserved on
purpose and the one rule this port adds.

## Regenerating the analysis

The original game files are not in this repository. Put the distribution
archive at the root and extract it to `original/`, then:

```
pip install unicorn fonttools brotli
python tools/re/unpack.py original/LEMON.EXE work/dump.bin
python tools/re/annotate.py work/dump.bin 3400 1200 > work/dayloop.asm
```

`unpack.py` decompresses the executable by loading it into an emulated real
mode processor and letting its own packer stub run, then dumping memory once
the program's code is reached. `annotate.py` turns a region of that image into
readable disassembly: it rewrites Microsoft floating point emulator escapes
back into real x87 instructions, resolves string literals, and decodes
constants.

## Regenerating the font

The art is built from block and box drawing characters that several common
system monospace fonts lack, including Android's default. A missing glyph makes
the browser substitute another face for that one cell, and the mismatched
advance width skews the whole row. The app therefore ships its own subset.

After changing any the characters used in `src/ui/art.ts`, rebuild it with:

```
python tools/font/subset.py \
    /usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf \
    src/ui/fonts/dejavu-sans-mono-subset.woff2
```

It verifies that every codepoint the art and interface use is present at a
uniform advance width, and exits non-zero rather than writing a font with a
hole in it.

## Licensing and provenance

The code and artwork here were written for this project. The block art is drawn
in the style of the original's screens rather than copied from them.

The original game files are third party copyrighted material and are excluded
from version control.

The bundled font is a subset of DejaVu Sans Mono, distributed under the
Bitstream Vera license. Its notice is at
[`src/ui/fonts/LICENSE-DejaVu.txt`](src/ui/fonts/LICENSE-DejaVu.txt).
