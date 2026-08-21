#!/usr/bin/env python3
"""Decompress a packed DOS MZ executable by running its own unpacking stub.

LEMON.EXE is compressed by a self-relocating packer: the stub copies itself and
the compressed data to high memory, jumps there, decompresses the real image
back down, then hands off through a chain of far jumps to the program's entry
point. Rather than reimplement the compression format, this loads the file into
an emulated real-mode CPU, lets the stub do the work, and dumps memory once the
program's own code is reached (detected by its first DOS call).

Usage:  unpack.py original/LEMON.EXE work/dump.bin
"""
import struct
import sys

from unicorn import *
from unicorn.x86_const import *
from unicorn import x86_const

MEM_SIZE = 0x200000          # 2 MB, covers real mode + a little wraparound
PSP_SEG = 0x0100
LOAD_SEG = PSP_SEG + 0x10
TOP_OF_MEM_SEG = 0x9FFF


def load_mz(path):
    data = open(path, "rb").read()
    (sig, cblp, cp, crlc, cparhdr, minalloc, maxalloc,
     ss, sp, csum, ip, cs, lfarlc, ovno) = struct.unpack_from("<14H", data, 0)
    assert sig == 0x5A4D, "not an MZ file"
    hdr_size = cparhdr * 16
    img_size = (cp - 1) * 512 + cblp - hdr_size if cblp else cp * 512 - hdr_size
    image = bytearray(data[hdr_size:hdr_size + img_size])
    relocs = [struct.unpack_from("<HH", data, lfarlc + 4 * i) for i in range(crlc)]
    return dict(image=image, relocs=relocs, ss=ss, sp=sp, ip=ip, cs=cs,
                minalloc=minalloc, hdr_size=hdr_size, img_size=img_size)


def main(path, out_path):
    mz = load_mz(path)
    print(f"header: cs:ip={mz['cs']:04x}:{mz['ip']:04x} "
          f"ss:sp={mz['ss']:04x}:{mz['sp']:04x} "
          f"image={mz['img_size']} bytes minalloc={mz['minalloc']:04x} para")
    print(f"relocs: {[f'{s:04x}:{o:04x}' for o, s in mz['relocs']]}")

    image = mz["image"]
    for off, seg in mz["relocs"]:
        pos = seg * 16 + off
        val = struct.unpack_from("<H", image, pos)[0]
        struct.pack_into("<H", image, pos, (val + LOAD_SEG) & 0xFFFF)
        print(f"  reloc at image+{pos:05x}: {val:04x} -> {(val + LOAD_SEG) & 0xFFFF:04x}")

    uc = Uc(UC_ARCH_X86, UC_MODE_16)
    uc.mem_map(0, MEM_SIZE)

    # Minimal PSP: only the fields the stub actually reads.
    psp = bytearray(0x100)
    struct.pack_into("<H", psp, 0x00, 0x20CD)          # INT 20h
    struct.pack_into("<H", psp, 0x02, TOP_OF_MEM_SEG)  # top of memory segment
    uc.mem_write(PSP_SEG * 16, bytes(psp))
    uc.mem_write(LOAD_SEG * 16, bytes(image))

    cs = (LOAD_SEG + mz["cs"]) & 0xFFFF
    ss = (LOAD_SEG + mz["ss"]) & 0xFFFF
    for reg, val in ((UC_X86_REG_CS, cs), (UC_X86_REG_SS, ss),
                     (UC_X86_REG_DS, PSP_SEG), (UC_X86_REG_ES, PSP_SEG),
                     (UC_X86_REG_SP, mz["sp"]), (UC_X86_REG_IP, mz["ip"]),
                     (UC_X86_REG_AX, 0), (UC_X86_REG_BX, 0), (UC_X86_REG_CX, 0xFF),
                     (UC_X86_REG_DX, 0), (UC_X86_REG_SI, 0), (UC_X86_REG_DI, 0),
                     (UC_X86_REG_BP, 0)):
        uc.reg_write(reg, val)

    entry = cs * 16 + mz["ip"]
    print(f"entry linear = {entry:05x} (cs={cs:04x})")

    state = dict(count=0, written=set(), last_cs=cs, trace=[], stop=None)

    def hook_code(uc, address, size, _):
        state["count"] += 1
        cur_cs = uc.reg_read(UC_X86_REG_CS)
        if cur_cs != state["last_cs"]:
            state["trace"].append(
                (state["count"], state["last_cs"], cur_cs, address))
            state["last_cs"] = cur_cs
        if state["count"] > 200_000_000:
            state["stop"] = ("instruction budget exhausted", address)
            uc.emu_stop()

    def hook_mem_write(uc, access, address, size, value, _):
        for i in range(size):
            state["written"].add(address + i)

    def hook_intr(uc, intno, _):
        ip = uc.reg_read(UC_X86_REG_IP)
        cs_ = uc.reg_read(UC_X86_REG_CS)
        ah = (uc.reg_read(UC_X86_REG_AX) >> 8) & 0xFF
        state["stop"] = (f"INT {intno:02x}h (ah={ah:02x}) at {cs_:04x}:{ip:04x}", None)
        uc.emu_stop()

    uc.hook_add(UC_HOOK_CODE, hook_code)
    uc.hook_add(UC_HOOK_MEM_WRITE, hook_mem_write)
    uc.hook_add(UC_HOOK_INTR, hook_intr)

    try:
        uc.emu_start(entry, MEM_SIZE, count=0)
    except UcError as e:
        ip = uc.reg_read(UC_X86_REG_IP)
        cs_ = uc.reg_read(UC_X86_REG_CS)
        state["stop"] = (f"UcError {e} at {cs_:04x}:{ip:04x}", None)

    print(f"stopped after {state['count']} instructions: {state['stop']}")
    regs = ("CS", "DS", "ES", "SS", "IP", "SP", "BP", "AX", "BX", "CX", "DX", "SI", "DI")
    vals = {r: uc.reg_read(getattr(x86_const, f"UC_X86_REG_{r}")) for r in regs}
    print("regs: " + " ".join(f"{r}={v:04x}" for r, v in vals.items()))
    print(f"far transfers: {state['trace'][:20]}")
    if state["written"]:
        lo, hi = min(state["written"]), max(state["written"])
        print(f"written range: {lo:05x}..{hi:05x} ({hi - lo + 1} bytes span)")

    dump = uc.mem_read(PSP_SEG * 16, 0xA0000 - PSP_SEG * 16)
    open(out_path, "wb").write(dump)
    print(f"wrote {len(dump)} bytes to {out_path} (base linear {PSP_SEG * 16:05x})")


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
