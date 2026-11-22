// Tiny stack VM for make.fun tiny-stack-vm-01: exact interpreter of the kit ISA.
// For each /input/<id>/{program,input}.bin pair writes /output/<id>/{stdout.bin,exit.txt}.
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

// Opcode tables indexed by byte: OK flags valid opcodes, IM its immediate length,
// PO values popped, PU values pushed. An unlisted byte traps 5.
const OK = new Uint8Array(256), IM = new Uint8Array(256), PO = new Uint8Array(256), PU = new Uint8Array(256);
for (const [o, i, p, u] of [
  [0, 0, 0, 0], [1, 1, 0, 1], [2, 4, 0, 1], [3, 0, 1, 0], [4, 0, 1, 2], [5, 0, 2, 2],
  [6, 0, 2, 3], [7, 0, 3, 3], [23, 0, 1, 1], [27, 0, 1, 1], [48, 2, 0, 0], [49, 2, 1, 0],
  [50, 2, 1, 0], [51, 2, 0, 0], [52, 0, 0, 0], [64, 0, 1, 1], [65, 0, 2, 0], [80, 0, 1, 0],
  [81, 0, 1, 0], [82, 0, 0, 1], [83, 0, 1, 0],
] as const) { OK[o] = 1; IM[o] = i; PO[o] = p; PU[o] = u; }
for (const o of [16, 17, 18, 19, 20, 21, 22, 24, 25, 26, 28, 29, 30, 32, 33, 34]) { OK[o] = 1; PO[o] = 2; PU[o] = 1; }

const enc = new TextEncoder();
function run(p: Uint8Array, inp: Uint8Array): { out: Uint8Array; code: number } {
  const n = p.length, D = new Int32Array(256), C = new Int32Array(64), M = new Int32Array(256);
  const out = new Uint8Array(65536);
  let sp = 0, csp = 0, olen = 0, ip = 0, pc = 0, steps = 0;
  const end = (code: number) => ({ out: out.subarray(0, olen), code });
  for (;;) {
    if (steps === 1e6) return end(10);
    if (pc < 0 || pc >= n) return end(9);
    const op = p[pc];
    if (!OK[op]) return end(5);
    const imm = IM[op];
    if (pc + imm >= n) return end(9);
    steps++;
    if (sp < PO[op]) return end(2);
    if (sp - PO[op] + PU[op] > 256) return end(3);
    const nx = pc + 1 + imm;
    pc = nx;
    switch (op) {
      case 0: return end(0);
      case 1: D[sp++] = (p[nx - 1] << 24) >> 24; break;
      case 2: D[sp++] = p[nx - 4] | (p[nx - 3] << 8) | (p[nx - 2] << 16) | (p[nx - 1] << 24); break;
      case 3: sp--; break;
      case 4: D[sp] = D[sp - 1]; sp++; break;
      case 5: { const t = D[sp - 1]; D[sp - 1] = D[sp - 2]; D[sp - 2] = t; break; }
      case 6: D[sp] = D[sp - 2]; sp++; break;
      case 7: { const a = D[sp - 3]; D[sp - 3] = D[sp - 2]; D[sp - 2] = D[sp - 1]; D[sp - 1] = a; break; }
      case 23: D[sp - 1] = -D[sp - 1] | 0; break;
      case 27: D[sp - 1] = ~D[sp - 1]; break;
      case 16: case 17: case 18: case 19: case 20: case 21: case 22: case 24: case 25: case 26:
      case 28: case 29: case 30: case 32: case 33: case 34: {
        const b = D[sp - 1], a = D[sp - 2];
        let r: number;
        if (op === 16) r = (a + b) | 0;
        else if (op === 17) r = (a - b) | 0;
        else if (op === 18) r = Math.imul(a, b);
        else if (op === 19) { if (!b) return end(4); r = a === -2147483648 && b === -1 ? a : (a / b) | 0; }
        else if (op === 20) { if (!b) return end(4); r = b === -1 ? 0 : (a % b) | 0; }
        else if (op === 21) { if (!b) return end(4); r = Math.floor((a >>> 0) / (b >>> 0)) | 0; }
        else if (op === 22) { if (!b) return end(4); r = ((a >>> 0) % (b >>> 0)) | 0; }
        else if (op === 24) r = a & b;
        else if (op === 25) r = a | b;
        else if (op === 26) r = a ^ b;
        else if (op === 28) r = a << (b & 31);
        else if (op === 29) r = a >> (b & 31);
        else if (op === 30) r = (a >>> (b & 31)) | 0;
        else if (op === 32) r = a === b ? 1 : 0;
        else if (op === 33) r = a < b ? 1 : 0;
        else r = (a >>> 0) < (b >>> 0) ? 1 : 0;
        D[sp - 2] = r; sp--;
        break;
      }
      case 48: case 49: case 50: {
        const rel = ((p[nx - 2] | (p[nx - 1] << 8)) << 16) >> 16;
        // 48: jump always; 49: jump if popped value is 0; 50: jump if it is not 0.
        const take = op === 48 ? true : op === 49 ? D[--sp] === 0 : D[--sp] !== 0;
        if (take) pc = nx + rel;
        break;
      }
      case 51:
        if (csp === 64) return end(7);
        C[csp++] = nx; pc = p[nx - 2] | (p[nx - 1] << 8);
        break;
      case 52:
        if (!csp) return end(8);
        pc = C[--csp];
        break;
      case 64: {
        const a = D[sp - 1];
        if (a < 0 || a > 255) return end(6);
        D[sp - 1] = M[a];
        break;
      }
      case 65: {
        const a = D[sp - 1];
        if (a < 0 || a > 255) return end(6);
        M[a] = D[sp - 2]; sp -= 2;
        break;
      }
      case 80: {
        const s = enc.encode(String(D[sp - 1]));
        if (olen + s.length > 65536) return end(11);
        sp--; out.set(s, olen); olen += s.length;
        break;
      }
      case 81:
        if (olen + 1 > 65536) return end(11);
        out[olen++] = D[--sp] & 255;
        break;
      case 82: D[sp++] = ip < inp.length ? inp[ip++] : -1; break;
      case 83: return end(D[--sp] & 255);
    }
  }
}

const I = process.env.MAKEFUN_INPUT_DIR ?? '/input';
const O = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';
for (const id of readdirSync(I).sort()) {
  const r = run(readFileSync(join(I, id, 'program.bin')), readFileSync(join(I, id, 'input.bin')));
  mkdirSync(join(O, id), { recursive: true });
  writeFileSync(join(O, id, 'stdout.bin'), r.out);
  writeFileSync(join(O, id, 'exit.txt'), `${r.code}\n`);
}
