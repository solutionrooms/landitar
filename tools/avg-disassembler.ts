import { readFileSync } from 'fs';
import { join } from 'path';
import {
  type DecodedInstruction,
  type VctrInstruction,
  type SvecInstruction,
  type StatInstruction,
  type ScalInstruction,
  type JsrlInstruction,
  type JmplInstruction,
  type VectorLine,
  type VectorSubroutine,
  OPCODE_SIZES,
  GRAVITAR_VECTOR_ROMS,
  AVG_MEMBASE,
  AVG_ROM_START,
  AVG_ROM_END,
} from './avg-types.js';

const ROM_DIR = join(import.meta.dirname, '..', 'gravitar_rom');

/**
 * Load all Gravitar vector ROMs into a flat byte array
 * representing the AVG address space.
 */
export function loadVectorRoms(): Uint8Array {
  // AVG address space: 0x0000 to 0x3FFF (16K)
  // 0x0000-0x07FF = Vector RAM (not in ROM, leave as zeros)
  // 0x0800-0x3FFF = Vector ROM
  const mem = new Uint8Array(0x4000);

  for (const rom of GRAVITAR_VECTOR_ROMS) {
    const avgAddr = rom.cpuAddress - AVG_MEMBASE;
    const data = readFileSync(join(ROM_DIR, rom.filename));
    if (data.length !== rom.size) {
      throw new Error(`ROM ${rom.filename}: expected ${rom.size} bytes, got ${data.length}`);
    }
    mem.set(data, avgAddr);
  }

  return mem;
}

/**
 * Read a 16-bit little-endian word from AVG memory at the given byte address.
 */
function readWord(mem: Uint8Array, byteAddr: number): number {
  return mem[byteAddr] | (mem[byteAddr + 1] << 8);
}

/**
 * Decode a single AVG instruction at the given byte address.
 * Returns the decoded instruction.
 */
export function decodeInstruction(mem: Uint8Array, byteAddr: number): DecodedInstruction {
  const word0 = readWord(mem, byteAddr);
  const opNum = (word0 >> 13) & 7;
  const size = OPCODE_SIZES[opNum];

  const base = {
    address: byteAddr,
    opNum,
    size,
  };

  switch (opNum) {
    case 0: { // VCTR - 2 words
      const word1 = readWord(mem, byteAddr + 2);
      const dy = word0 & 0x1FFF;
      const intLatch = (word1 >> 12) & 0xF;
      const dx = word1 & 0x1FFF;
      return {
        ...base,
        opcode: 'VCTR',
        rawWords: [word0, word1],
        dy,
        dx,
        intLatch,
      } as VctrInstruction;
    }

    case 1: // HALT
      return { ...base, opcode: 'HALT', rawWords: [word0] };

    case 2: { // SVEC - 1 word, special encoding
      // High byte (handler_1): op[7:5]=010, dvy12=bit[4], dvy[11:8]=bits[3:0]
      // Low byte (handler_3): int_latch=bits[7:4], dx12=bit[4], dx[11:8]=bits[3:0]
      const highByte = (word0 >> 8) & 0xFF;
      const lowByte = word0 & 0xFF;
      const dvy12 = (highByte >> 4) & 1;
      const dyHigh = highByte & 0xF;
      const dy = (dvy12 << 12) | (dyHigh << 8); // DY[7:0] = 0

      const intLatch = (lowByte >> 4) & 0xF;
      const dx12 = intLatch & 1;
      const dxHigh = lowByte & 0xF;
      const dx = (dx12 << 12) | (dxHigh << 8); // DX[7:0] = 0

      return {
        ...base,
        opcode: 'SVEC',
        rawWords: [word0],
        dy,
        dx,
        intLatch,
      } as SvecInstruction;
    }

    case 3: { // STAT or SCAL (determined by dvy12 bit)
      const dvy12 = (word0 >> 12) & 1;
      const dvy = word0 & 0x1FFF;

      if (dvy12 === 0) {
        // STAT: set color and intensity
        const color = dvy & 0x7;
        const intensity = (dvy >> 4) & 0xF;
        return {
          ...base,
          opcode: 'STAT',
          rawWords: [word0],
          color,
          intensity,
        } as StatInstruction;
      } else {
        // SCAL: set scale
        const linScale = dvy & 0xFF;
        const binScale = (dvy >> 8) & 0x7;
        return {
          ...base,
          opcode: 'SCAL',
          rawWords: [word0],
          binScale,
          linScale,
        } as ScalInstruction;
      }
    }

    case 4: // CNTR
      return { ...base, opcode: 'CNTR', rawWords: [word0] };

    case 5: { // JSRL
      const dvy = word0 & 0x1FFF;
      return {
        ...base,
        opcode: 'JSRL',
        rawWords: [word0],
        targetAddr: dvy << 1,
      } as JsrlInstruction;
    }

    case 6: // RTSL
      return { ...base, opcode: 'RTSL', rawWords: [word0] };

    case 7: { // JMPL
      const dvy = word0 & 0x1FFF;
      return {
        ...base,
        opcode: 'JMPL',
        rawWords: [word0],
        targetAddr: dvy << 1,
      } as JmplInstruction;
    }

    default:
      throw new Error(`Unknown opcode ${opNum} at address 0x${byteAddr.toString(16)}`);
  }
}

/**
 * Disassemble instructions starting at byteAddr until hitting RTSL, JMPL, or HALT.
 */
export function disassembleSubroutine(mem: Uint8Array, startAddr: number): DecodedInstruction[] {
  const instructions: DecodedInstruction[] = [];
  let pc = startAddr;
  const maxAddr = Math.min(AVG_ROM_END + 1, mem.length);

  for (let safety = 0; safety < 1000 && pc < maxAddr; safety++) {
    const inst = decodeInstruction(mem, pc);
    instructions.push(inst);
    pc += inst.size;

    if (inst.opcode === 'RTSL' || inst.opcode === 'HALT' || inst.opcode === 'JMPL') {
      break;
    }
  }

  return instructions;
}

/**
 * AVG Simulator - executes subroutines and records drawn line segments.
 *
 * Faithfully replicates the MAME AVG state machine:
 * - Sign-magnitude 13-bit DX/DY values
 * - Normalization with timer tracking
 * - Binary scale + linear scale for displacement computation
 * - bit 12 = 1 means POSITIVE direction (opposite of 2's complement!)
 */
export class AvgSimulator {
  private mem: Uint8Array;
  private pc = 0;
  private sp = 0;
  private stack: number[] = [0, 0, 0, 0];

  private xpos = 0;
  private ypos = 0;

  private dvx = 0;
  private dvy = 0;
  private dvy12 = 0;
  private intLatch = 0;
  private timer = 0;

  private scale = 0;    // 8-bit linear scale
  private binScale = 0; // 3-bit binary scale
  private color = 7;    // 3-bit color (default white)
  private intensity = 0;

  private lines: VectorLine[] = [];
  private halt = false;

  constructor(mem: Uint8Array) {
    this.mem = mem;
  }

  /**
   * Execute a subroutine at the given address and return all drawn lines.
   * Optionally provide initial state (scale, color, etc).
   */
  executeSubroutine(
    startAddr: number,
    options?: {
      scale?: number;
      binScale?: number;
      color?: number;
      intensity?: number;
      startX?: number;
      startY?: number;
    }
  ): VectorLine[] {
    this.pc = startAddr;
    this.sp = 0;
    this.stack = [0, 0, 0, 0];
    this.xpos = options?.startX ?? 0;
    this.ypos = options?.startY ?? 0;
    this.scale = options?.scale ?? 0;
    this.binScale = options?.binScale ?? 0;
    this.color = options?.color ?? 7;
    this.intensity = options?.intensity ?? 7;
    this.intLatch = 0;
    this.timer = 0;
    this.lines = [];
    this.halt = false;

    // Simulate: push a fake return address so RTSL stops execution
    const SENTINEL = 0xFFFF;
    this.stack[0] = SENTINEL;
    this.sp = 1; // SP points past the pushed value (JSRL increments after push)

    for (let safety = 0; safety < 10000 && !this.halt; safety++) {
      if (this.pc >= this.mem.length || this.pc === SENTINEL) break;

      const word0 = readWord(this.mem, this.pc);
      const highByte = (word0 >> 8) & 0xFF;
      const lowByte = word0 & 0xFF;
      const opNum = (highByte >> 5) & 7;

      switch (opNum) {
        case 0: this.execVctr(); break;
        case 1: this.halt = true; break; // HALT
        case 2: this.execSvec(); break;
        case 3: this.execStatScal(); break;
        case 4: this.execCntr(); break;
        case 5: this.execJsrl(); break;
        case 6: this.execRtsl(); break;
        case 7: this.execJmpl(); break;
      }
    }

    return this.lines;
  }

  private readHighByte(): number {
    // handler_1: reads mem[pc ^ 1] which for even PC = PC+1 (high byte)
    const byte = this.mem[this.pc ^ 1];
    this.pc++;
    return byte;
  }

  private readLowByte(): number {
    // handler_0 or handler_2: reads mem[pc ^ 1] which for odd PC = PC-1 (low byte)
    const byte = this.mem[this.pc ^ 1];
    this.pc++;
    return byte;
  }

  private latch1(highByte: number) {
    // handler_1: extract opcode, DY high bits
    this.dvy12 = (highByte >> 4) & 1;
    this.intLatch = 0;
    this.dvy = (this.dvy12 << 12) | ((highByte & 0xF) << 8);
    this.dvx = 0;
  }

  private latch0(lowByte: number) {
    // handler_0: DY low bits
    this.dvy = (this.dvy & 0x1F00) | lowByte;
  }

  private latch3(highByte: number) {
    // handler_3: int_latch + DX high bits
    this.intLatch = highByte >> 4;
    this.dvx = ((this.intLatch & 1) << 12)
      | ((highByte & 0xF) << 8)
      | (this.dvx & 0xFF);
  }

  private latch2(lowByte: number) {
    // handler_2: DX low bits
    this.dvx = (this.dvx & 0x1F00) | lowByte;
  }

  private normalize(isShort: boolean) {
    // handler_4 (OP0=0): normalization
    let i = 0;
    while (
      ((this.dvy ^ (this.dvy << 1)) & 0x1000) === 0 &&
      ((this.dvx ^ (this.dvx << 1)) & 0x1000) === 0 &&
      i++ < 16
    ) {
      this.dvy = (this.dvy & 0x1000) | ((this.dvy << 1) & 0x1FFF);
      this.dvx = (this.dvx & 0x1000) | ((this.dvx << 1) & 0x1FFF);
      this.timer >>= 1;
      this.timer |= 0x4000 | (isShort ? 0x80 : 0);
    }
    if (isShort) {
      this.timer &= 0xFF;
    }
  }

  private applyBinScale(isShort: boolean) {
    // handler_5 (OP2=0): apply binary scale to timer
    for (let i = this.binScale; i > 0; i--) {
      this.timer >>= 1;
      this.timer |= 0x4000 | (isShort ? 0x80 : 0);
    }
    if (isShort) {
      this.timer &= 0xFF;
    }
  }

  private drawVector(isShort: boolean) {
    // handler_7 (OP0=0, OP2=0): draw/move vector
    const oldX = this.xpos;
    const oldY = this.ypos;

    let cycles: number;
    if (isShort) {
      cycles = 0x100 - (this.timer & 0xFF);
    } else {
      cycles = 0x8000 - this.timer;
    }
    this.timer = 0;

    // Compute displacement (xdac_xor and ydac_xor are 0 for standard AVG)
    const dxSigned = ((this.dvx >> 3) & 0x3FF) - 0x200;
    const dySigned = ((this.dvy >> 3) & 0x3FF) - 0x200;
    const scaleFactor = this.scale ^ 0xFF;

    this.xpos += (dxSigned * cycles * scaleFactor) >> 4;
    this.ypos -= (dySigned * cycles * scaleFactor) >> 4;

    // Record line if beam is on (intensity > 0)
    const drawIntensity = (this.intLatch >> 1) === 1
      ? this.intensity
      : this.intLatch & 0xE;

    if (drawIntensity > 0) {
      this.lines.push({
        x1: oldX,
        y1: oldY,
        x2: this.xpos,
        y2: this.ypos,
        color: this.color,
        intensity: drawIntensity,
      });
    }
  }

  // --- Instruction executors ---

  private execVctr() {
    // Sequence: 1, 0, 3, 2, 4, 5, 7
    const h = this.readHighByte();
    this.latch1(h);
    const l = this.readLowByte();
    this.latch0(l);
    const h2 = this.readHighByte();
    this.latch3(h2);
    const l2 = this.readLowByte();
    this.latch2(l2);
    this.normalize(false);
    this.applyBinScale(false);
    this.drawVector(false);
  }

  private execSvec() {
    // Sequence: 1, 3, 4, 5, 7
    const h = this.readHighByte();
    this.latch1(h);
    const l = this.readLowByte(); // goes to handler_3, not handler_0!
    this.latch3(l);
    this.normalize(true);
    this.applyBinScale(true);
    this.drawVector(true);
  }

  private execStatScal() {
    // Sequence: 1, 0, 6
    const h = this.readHighByte();
    this.latch1(h);
    const l = this.readLowByte();
    this.latch0(l);

    // handler_6: if dvy12=0 -> STAT, if dvy12=1 -> SCAL
    if (this.dvy12 === 0) {
      this.color = this.dvy & 0x7;
      this.intensity = (this.dvy >> 4) & 0xF;
    } else {
      this.scale = this.dvy & 0xFF;
      this.binScale = (this.dvy >> 8) & 0x7;
    }
  }

  private execCntr() {
    // Sequence: 1, 0, 4, 7
    const h = this.readHighByte();
    this.latch1(h);
    const l = this.readLowByte();
    this.latch0(l);
    // handler_4 would normalize, but for CNTR (OP0=0, OP2=1) the
    // strobe3 handler centers the beam
    // handler_7 (OP2=1): center beam
    this.xpos = 0;
    this.ypos = 0;
  }

  private execJsrl() {
    // Sequence: 1, 0, 4, 5, 6
    const h = this.readHighByte();
    this.latch1(h);
    const l = this.readLowByte();
    this.latch0(l);
    // handler_4 (OP0=1): push PC
    this.stack[this.sp & 3] = this.pc;
    // handler_5 (OP2=1): increment SP
    this.sp = (this.sp + 1) & 0xF;
    // handler_6 (OP2=1, OP0=1): jump
    this.pc = (this.dvy & 0x1FFF) << 1;
  }

  private execRtsl() {
    // Sequence: 1, 0, 5, 6
    const h = this.readHighByte();
    this.latch1(h);
    const l = this.readLowByte();
    this.latch0(l);
    // handler_5 (OP2=1, OP1=1): decrement SP
    this.sp = (this.sp - 1) & 0xF;
    // handler_6 (OP2=1, OP0=0): return
    this.pc = this.stack[this.sp & 3];
  }

  private execJmpl() {
    // Sequence: 1, 0, 6
    const h = this.readHighByte();
    this.latch1(h);
    const l = this.readLowByte();
    this.latch0(l);
    // handler_6 (OP2=1, OP0=1): jump (no stack)
    this.pc = (this.dvy & 0x1FFF) << 1;
  }
}

/**
 * Find all subroutine entry points by scanning for JSRL targets in the ROM.
 * Uses recursive descent to find all reachable subroutines.
 */
export function findSubroutineAddresses(mem: Uint8Array): Set<number> {
  const targets = new Set<number>();
  const visited = new Set<number>();

  // First pass: linear scan for JSRL instructions in the vector ROM range
  function scanRange(start: number, end: number) {
    let pc = start;
    while (pc < end) {
      const word = readWord(mem, pc);
      const op = (word >> 13) & 7;

      if (op === 5) {
        // JSRL: target address = (word & 0x1FFF) << 1
        const target = (word & 0x1FFF) << 1;
        if (target >= AVG_ROM_START && target <= AVG_ROM_END) {
          targets.add(target);
        }
      }

      // Advance by instruction size
      pc += OPCODE_SIZES[op];
    }
  }

  scanRange(AVG_ROM_START, AVG_ROM_END);

  // Also find subroutines called by other subroutines (recursive)
  function followCalls(addr: number) {
    if (visited.has(addr)) return;
    visited.add(addr);

    const instructions = disassembleSubroutine(mem, addr);
    for (const inst of instructions) {
      if (inst.opcode === 'JSRL') {
        const jsrl = inst as JsrlInstruction;
        if (jsrl.targetAddr >= AVG_ROM_START && jsrl.targetAddr <= AVG_ROM_END) {
          targets.add(jsrl.targetAddr);
          followCalls(jsrl.targetAddr);
        }
      }
    }
  }

  for (const target of [...targets]) {
    followCalls(target);
  }

  return targets;
}

/**
 * Classify a subroutine based on its instruction composition.
 */
export function classifySubroutine(
  instructions: DecodedInstruction[],
  lines: VectorLine[]
): VectorSubroutine['classification'] {
  let vctrCount = 0;
  let svecCount = 0;
  let jsrlCount = 0;
  let statCount = 0;
  let moveCount = 0; // moves (intensity=0)
  let drawCount = 0; // draws (intensity>0)

  for (const inst of instructions) {
    switch (inst.opcode) {
      case 'VCTR': {
        const v = inst as VctrInstruction;
        if (v.intLatch === 0) moveCount++;
        else drawCount++;
        vctrCount++;
        break;
      }
      case 'SVEC': {
        const s = inst as SvecInstruction;
        if (s.intLatch === 0) moveCount++;
        else drawCount++;
        svecCount++;
        break;
      }
      case 'JSRL': jsrlCount++; break;
      case 'STAT': statCount++; break;
    }
  }

  const totalDraw = vctrCount + svecCount;

  // Characters: mostly SVEC instructions (text glyphs)
  if (svecCount >= 5 && vctrCount === 0 && jsrlCount === 0) {
    return 'character';
  }

  // Terrain: many consecutive draws with few moves, no JSRL calls
  if (drawCount >= 8 && moveCount <= 3 && jsrlCount === 0) {
    return 'terrain';
  }

  // Shape: moderate draws with some moves (discrete objects)
  if (drawCount >= 3 && drawCount <= 30 && jsrlCount === 0) {
    return 'shape';
  }

  // Table: mostly JSRL calls (compositing subroutines)
  if (jsrlCount >= 2) {
    return 'table';
  }

  return 'unknown';
}

/**
 * Build complete subroutine data including simulation.
 */
export function buildSubroutine(
  mem: Uint8Array,
  address: number,
  sim: AvgSimulator
): VectorSubroutine {
  const instructions = disassembleSubroutine(mem, address);
  const lines = sim.executeSubroutine(address);

  // Calculate size
  const lastInst = instructions[instructions.length - 1];
  const size = lastInst ? (lastInst.address + lastInst.size - address) : 0;

  return {
    address,
    size,
    instructions,
    lines,
    classification: classifySubroutine(instructions, lines),
  };
}
