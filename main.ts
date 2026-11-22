// Tiny stack VM (make.fun tiny stack ISA v1). One run answers i001..i040:
// reads /input/<id>/{program,input}.bin, writes /output/<id>/{stdout.bin,exit.txt}.
import { readFileSync as R, mkdirSync as M, writeFileSync as W, readdirSync as D, existsSync as E } from "node:fs";
const IND = process.env.MAKEFUN_INPUT_DIR ?? "/input";
const OUTD = process.env.MAKEFUN_OUTPUT_DIR ?? "/output";
function run(p: Buffer, inp: Buffer): { o: Buffer; c: number } {
  const mem = new Int32Array(256), s = new Int32Array(256), cs = new Int32Array(64);
  const o: number[] = [];
  let sp = 0, cp = 0, pc = 0, t = 0, ip = 0, code = -1;
  const n = p.length;
  while (code < 0) {
    if (t >= 1e6) { code = 10; break; }
    if (pc < 0 || pc >= n) { code = 9; break; }
    switch (p[pc]) {
      case 0x00: return { o: Buffer.from(o), c: 0 };
      case 0x01:
        if (pc + 1 >= n) { code = 9; break; }
        if (sp >= 256) { code = 3; break; }
        { const v = p[pc + 1]; s[sp++] = v >= 128 ? v - 256 : v; }
        pc += 2; break;
      case 0x02:
        if (pc + 4 >= n) { code = 9; break; }
        if (sp >= 256) { code = 3; break; }
        s[sp++] = p[pc + 1] | (p[pc + 2] << 8) | (p[pc + 3] << 16) | (p[pc + 4] << 24);
        pc += 5; break;
      case 0x03:
        if (sp < 1) { code = 2; break; }
        sp--; pc++; break;
      case 0x04:
        if (sp < 1) { code = 2; break; }
        if (sp >= 256) { code = 3; break; }
        s[sp] = s[sp - 1]; sp++; pc++; break;
      case 0x05:
        if (sp < 2) { code = 2; break; }
        { const v = s[sp - 1]; s[sp - 1] = s[sp - 2]; s[sp - 2] = v; }
        pc++; break;
      case 0x06:
        if (sp < 2) { code = 2; break; }
        if (sp >= 256) { code = 3; break; }
        s[sp] = s[sp - 2]; sp++; pc++; break;
      case 0x07:
        if (sp < 3) { code = 2; break; }
        { const a = s[sp - 3], b = s[sp - 2], c = s[sp - 1]; s[sp - 3] = b; s[sp - 2] = c; s[sp - 1] = a; }
        pc++; break;
      case 0x10:
        if (sp < 2) { code = 2; break; }
        { const b = s[--sp]; s[sp - 1] = (s[sp - 1] + b) | 0; }
        pc++; break;
      case 0x11:
        if (sp < 2) { code = 2; break; }
        { const b = s[--sp]; s[sp - 1] = (s[sp - 1] - b) | 0; }
        pc++; break;
      case 0x12:
        if (sp < 2) { code = 2; break; }
        { const b = s[--sp]; s[sp - 1] = Math.imul(s[sp - 1], b); }
        pc++; break;
      case 0x13:
        if (sp < 2) { code = 2; break; }
        { const b = s[--sp]; if (b === 0) { code = 4; break; } s[sp - 1] = (s[sp - 1] / b) | 0; }
        pc++; break;
      case 0x14:
        if (sp < 2) { code = 2; break; }
        { const b = s[--sp]; if (b === 0) { code = 4; break; } s[sp - 1] = (s[sp - 1] % b) | 0; }
        pc++; break;
      case 0x15:
        if (sp < 2) { code = 2; break; }
        { const b = s[--sp] >>> 0; if (b === 0) { code = 4; break; } s[sp - 1] = ((s[sp - 1] >>> 0) / b) | 0; }
        pc++; break;
      case 0x16:
        if (sp < 2) { code = 2; break; }
        { const b = s[--sp] >>> 0; if (b === 0) { code = 4; break; } s[sp - 1] = ((s[sp - 1] >>> 0) % b) | 0; }
        pc++; break;
      case 0x17:
        if (sp < 1) { code = 2; break; }
        s[sp - 1] = (-s[sp - 1]) | 0; pc++; break;
      case 0x18:
        if (sp < 2) { code = 2; break; }
        { const b = s[--sp]; s[sp - 1] = s[sp - 1] & b; }
        pc++; break;
      case 0x19:
        if (sp < 2) { code = 2; break; }
        { const b = s[--sp]; s[sp - 1] = s[sp - 1] | b; }
        pc++; break;
      case 0x1a:
        if (sp < 2) { code = 2; break; }
        { const b = s[--sp]; s[sp - 1] = s[sp - 1] ^ b; }
        pc++; break;
      case 0x1b:
        if (sp < 1) { code = 2; break; }
        s[sp - 1] = ~s[sp - 1]; pc++; break;
      case 0x1c:
        if (sp < 2) { code = 2; break; }
        { const b = s[--sp]; s[sp - 1] = s[sp - 1] << (b & 31); }
        pc++; break;
      case 0x1d:
        if (sp < 2) { code = 2; break; }
        { const b = s[--sp]; s[sp - 1] = s[sp - 1] >> (b & 31); }
        pc++; break;
      case 0x1e:
        if (sp < 2) { code = 2; break; }
        { const b = s[--sp]; s[sp - 1] = (s[sp - 1] >>> (b & 31)) | 0; }
        pc++; break;
      case 0x20:
        if (sp < 2) { code = 2; break; }
        { const b = s[--sp]; s[sp - 1] = s[sp - 1] === b ? 1 : 0; }
        pc++; break;
      case 0x21:
        if (sp < 2) { code = 2; break; }
        { const b = s[--sp]; s[sp - 1] = s[sp - 1] < b ? 1 : 0; }
        pc++; break;
      case 0x22:
        if (sp < 2) { code = 2; break; }
        { const b = s[--sp]; s[sp - 1] = (s[sp - 1] >>> 0) < (b >>> 0) ? 1 : 0; }
        pc++; break;
      case 0x30:
        if (pc + 2 >= n) { code = 9; break; }
        { let f = p[pc + 1] | (p[pc + 2] << 8); pc = pc + 3 + ((f << 16) >> 16); }
        break;
      case 0x31:
        if (pc + 2 >= n) { code = 9; break; }
        if (sp < 1) { code = 2; break; }
        { const v = s[--sp]; let f = p[pc + 1] | (p[pc + 2] << 8); pc = v === 0 ? pc + 3 + ((f << 16) >> 16) : pc + 3; }
        break;
      case 0x32:
        if (pc + 2 >= n) { code = 9; break; }
        if (sp < 1) { code = 2; break; }
        { const v = s[--sp]; let f = p[pc + 1] | (p[pc + 2] << 8); pc = v !== 0 ? pc + 3 + ((f << 16) >> 16) : pc + 3; }
        break;
      case 0x33:
        if (pc + 2 >= n) { code = 9; break; }
        if (cp >= 64) { code = 7; break; }
        cs[cp++] = pc + 3; pc = p[pc + 1] | (p[pc + 2] << 8); break;
      case 0x34:
        if (cp < 1) { code = 8; break; }
        pc = cs[--cp]; break;
      case 0x40:
        if (sp < 1) { code = 2; break; }
        { const a = s[sp - 1]; if (a < 0 || a > 255) { code = 6; break; } s[sp - 1] = mem[a]; }
        pc++; break;
      case 0x41:
        if (sp < 2) { code = 2; break; }
        { const a = s[sp - 1]; if (a < 0 || a > 255) { code = 6; break; } mem[a] = s[sp - 2]; sp -= 2; }
        pc++; break;
      case 0x50:
        if (sp < 1) { code = 2; break; }
        { const d = String(s[--sp]); if (o.length + d.length > 65536) { code = 11; break; } for (let i = 0; i < d.length; i++) o.push(d.charCodeAt(i)); }
        pc++; break;
      case 0x51:
        if (sp < 1) { code = 2; break; }
        if (o.length + 1 > 65536) { code = 11; break; }
        o.push(s[--sp] & 255); pc++; break;
      case 0x52:
        if (sp >= 256) { code = 3; break; }
        s[sp++] = ip < inp.length ? inp[ip++] : -1; pc++; break;
      case 0x53:
        if (sp < 1) { code = 2; break; }
        return { o: Buffer.from(o), c: s[--sp] & 255 };
      default:
        code = 5; break;
    }
    t++;
  }
  return { o: Buffer.from(o), c: code };
}
for (const id of D(IND).sort()) {
  if (!E(`${IND}/${id}/program.bin`)) continue;
  const r = run(R(`${IND}/${id}/program.bin`), R(`${IND}/${id}/input.bin`));
  M(`${OUTD}/${id}`, { recursive: true });
  W(`${OUTD}/${id}/stdout.bin`, r.o);
  W(`${OUTD}/${id}/exit.txt`, `${r.c}\n`);
}
