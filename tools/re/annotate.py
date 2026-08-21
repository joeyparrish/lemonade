#!/usr/bin/env python3
"""Produce an annotated disassembly of a range of the unpacked image.

Three things make the raw disassembly hard to read, and this fixes all of them:

1. Arithmetic is emitted as Microsoft floating-point *emulator* calls, where
   `INT 34h..3Bh` stands in for the x87 `ESC` opcodes `D8..DF`. Linking against
   the coprocessor library rewrites each to `90 Dx` (NOP + ESC), which is the
   same length, so doing that substitution here yields real FPU disassembly.

2. String constants live in DGROUP behind an 8-byte header (two self-referential
   pointers, a 0x4824 tag, and a length word) followed by inline text. Finding
   those lets operands be labelled with the string they refer to.

3. Everything else in the constant pool is a bare address. Those get decoded as
   float and integer so formula constants read directly.

Usage:  annotate.py work/dump.bin 3400 1200 > work/dayloop.asm
        (start and length are hex, start is a linear address)
"""
import re
import struct
import subprocess
import sys
import tempfile

DUMP_BASE = 0x1000        # linear address of dump.bin byte 0
DGROUP_SEG = 0x286D       # DS/SS for this image
IMAGE_END = 0x30B10       # linear, exclusive
TAG = 0x4824

# Runtime entry points identified so far. Extend as more are recognised.
NAMED_CALLS = {
    "0x1913:0xfd": "fp.store",
    "0x1913:0x309": "fp.toVar",
    "0x1913:0x2e5": "fp.push",
    "0x1913:0x23d": "fp.compare",
    "0x1913:0x10d": "fp.load",
    "0x1913:0x6b": "fp.testFlags",
    "0x1913:0x98": "basic.INT",
    "0x1a64:0x1708": "basic.RND",
    # Takes an offset in AX. Called both with code offsets (0x2bc2 is the
    # demand ladder at linear 0x3CC2, i.e. base 0x1100 + 0x2BC2) and with
    # offsets into the data area, so it is some kind of dispatch/display
    # trampoline. Exact role not yet pinned down; do not read the name as fact.
    "0x1a64:0x220a": "rt.dispatch?(ax)",
    "0x1a64:0x261e": "door.getField",
    "0x1a64:0x163a": "door.compare",
    "0xf4d:0x475": "door.writeAt",
    "0x921:0x1cf5": "door.input",
    "0x921:0x4f9c": "door.print",
}

LINE_RE = re.compile(r"^([0-9A-F]{8})\s+([0-9A-F]+)\s+(.*)$")
MEMREF_RE = re.compile(r"\[0x([0-9a-f]+)\]")
IMM_RE = re.compile(r"(?<!\[)\b0x([0-9a-f]+)\b(?!\])")


def patch_fp(data):
    """Rewrite emulator escapes CD 34..3B into NOP + real x87 ESC D8..DF."""
    out = bytearray(data)
    for i in range(len(out) - 1):
        if out[i] == 0xCD and 0x34 <= out[i + 1] <= 0x3B:
            out[i + 1] = out[i + 1] - 0x34 + 0xD8
            out[i] = 0x90
    return bytes(out)


def find_literals(data, dg, dg_end):
    """Map DGROUP offset of each string literal header -> its text."""
    literals = {}
    off = dg
    while off + 10 < dg_end:
        ds = off - dg
        w = lambda p: struct.unpack_from("<H", data, p)[0]
        if w(off) == ds + 4 and w(off + 2) == TAG and w(off + 4) == ds + 6:
            ln = w(off + 6)
            if 0 < ln < 4096 and off + 8 + ln <= dg_end:
                literals[ds] = data[off + 8:off + 8 + ln]
        off += 2
    return literals


def describe(off, data, dg, literals, min_lit):
    """Describe a DGROUP offset as a string, a constant, or a variable."""
    if off in literals:
        text = literals[off].decode("cp437", "replace")
        text = "".join(c if 32 <= ord(c) < 127 else "." for c in text)
        return f'"{text[:40]}"'
    p = dg + off
    if p + 8 > len(data):
        return None
    if off >= min_lit:
        f32 = struct.unpack_from("<f", data, p)[0]
        f64 = struct.unpack_from("<d", data, p)[0]
        i32 = struct.unpack_from("<i", data, p)[0]
        parts = []
        if 1e-6 < abs(f32) < 1e9:
            parts.append(f"f32={f32:g}")
        if 1e-6 < abs(f64) < 1e9:
            parts.append(f"f64={f64:g}")
        if 0 < abs(i32) < 10_000_000:
            parts.append(f"i32={i32}")
        return " ".join(parts) if parts else "0"
    return f"var_{off:04x}"


def main(path, start_hex, len_hex):
    start, length = int(start_hex, 16), int(len_hex, 16)
    data = patch_fp(open(path, "rb").read())
    dg = DGROUP_SEG * 16 - DUMP_BASE
    literals = find_literals(data, dg, IMAGE_END - DUMP_BASE)
    min_lit = min(literals) if literals else 0

    lo = start - DUMP_BASE
    with tempfile.NamedTemporaryFile(suffix=".bin") as tf:
        tf.write(data[lo:lo + length])
        tf.flush()
        out = subprocess.run(
            ["ndisasm", "-b16", f"-o0x{start:X}", tf.name],
            capture_output=True, text=True, check=True).stdout

    for line in out.splitlines():
        m = LINE_RE.match(line)
        if not m:
            print(line)
            continue
        addr, _, text = m.groups()
        if text.strip() == "nop":
            continue                      # artefact of the FP patch
        notes = []
        for far, name in NAMED_CALLS.items():
            if far in text:
                notes.append(name)
        for off in MEMREF_RE.findall(text):
            d = describe(int(off, 16), data, dg, literals, min_lit)
            if d:
                notes.append(f"[{off}] {d}")
        for imm in IMM_RE.findall(text):
            v = int(imm, 16)
            if v in literals:
                d = describe(v, data, dg, literals, min_lit)
                notes.append(f"{imm} -> {d}")
        print(f"{line:<52} ; {'  '.join(notes)}" if notes else line)


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2], sys.argv[3])
