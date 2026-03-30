// AVG (Analog Vector Generator) instruction types
// Based on MAME avgdvg.cpp implementation

export type AvgOpcode = 'VCTR' | 'HALT' | 'SVEC' | 'STAT' | 'SCAL' | 'CNTR' | 'JSRL' | 'RTSL' | 'JMPL';

// Map 3-bit opcode to instruction name
// Note: op=3 is STAT when dvy12=0, SCAL when dvy12=1
// Note: op=6 is RTSL (the word is read but RTSL pops the stack and returns)
export const OPCODE_NAMES: Record<number, AvgOpcode> = {
  0: 'VCTR',
  1: 'HALT',
  2: 'SVEC',
  3: 'STAT', // or SCAL, determined by dvy12 bit
  4: 'CNTR',
  5: 'JSRL',
  6: 'RTSL',
  7: 'JMPL',
};

// Instruction sizes in bytes
export const OPCODE_SIZES: Record<number, number> = {
  0: 4,  // VCTR: 2 words
  1: 2,  // HALT: 1 word
  2: 2,  // SVEC: 1 word
  3: 2,  // STAT/SCAL: 1 word
  4: 2,  // CNTR: 1 word
  5: 2,  // JSRL: 1 word
  6: 2,  // RTSL: 1 word
  7: 2,  // JMPL: 1 word
};

export interface AvgInstruction {
  /** Byte address in AVG address space */
  address: number;
  /** Decoded opcode */
  opcode: AvgOpcode;
  /** Raw 3-bit opcode number */
  opNum: number;
  /** Size in bytes */
  size: number;
  /** Raw word(s) as 16-bit LE values */
  rawWords: number[];
}

export interface VctrInstruction extends AvgInstruction {
  opcode: 'VCTR';
  /** 13-bit DY (bit 12 = sign: 1=positive, 0=negative) */
  dy: number;
  /** 13-bit DX (bit 12 = sign: 1=positive, 0=negative) */
  dx: number;
  /** 4-bit intensity latch (0 = beam off / move) */
  intLatch: number;
}

export interface SvecInstruction extends AvgInstruction {
  opcode: 'SVEC';
  /** 13-bit DY with only upper 5 bits populated (sign + 4 mag bits << 8) */
  dy: number;
  /** 13-bit DX with only upper 5 bits populated (sign + 4 mag bits << 8) */
  dx: number;
  /** 4-bit intensity latch (0 = beam off / move) */
  intLatch: number;
}

export interface StatInstruction extends AvgInstruction {
  opcode: 'STAT';
  /** 3-bit color (RGB: bit2=R, bit1=G, bit0=B) */
  color: number;
  /** 4-bit intensity */
  intensity: number;
}

export interface ScalInstruction extends AvgInstruction {
  opcode: 'SCAL';
  /** 3-bit binary scale */
  binScale: number;
  /** 8-bit linear scale */
  linScale: number;
}

export interface JsrlInstruction extends AvgInstruction {
  opcode: 'JSRL';
  /** Target byte address (dvy << 1) */
  targetAddr: number;
}

export interface JmplInstruction extends AvgInstruction {
  opcode: 'JMPL';
  /** Target byte address (dvy << 1) */
  targetAddr: number;
}

export interface CntrInstruction extends AvgInstruction {
  opcode: 'CNTR';
}

export interface HaltInstruction extends AvgInstruction {
  opcode: 'HALT';
}

export interface RtslInstruction extends AvgInstruction {
  opcode: 'RTSL';
}

export type DecodedInstruction =
  | VctrInstruction
  | SvecInstruction
  | StatInstruction
  | ScalInstruction
  | JsrlInstruction
  | JmplInstruction
  | CntrInstruction
  | HaltInstruction
  | RtslInstruction;

/** A line segment produced by the AVG simulator */
export interface VectorLine {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  color: number;      // 3-bit RGB (0-7)
  intensity: number;   // 0-15
}

/** A complete vector subroutine with its drawn lines */
export interface VectorSubroutine {
  /** Start byte address in AVG space */
  address: number;
  /** Size in bytes */
  size: number;
  /** Decoded instructions */
  instructions: DecodedInstruction[];
  /** Lines produced by simulating this subroutine */
  lines: VectorLine[];
  /** Classification */
  classification: 'terrain' | 'shape' | 'character' | 'table' | 'unknown';
}

/** ROM file mapping to AVG address space */
export interface RomMapping {
  filename: string;
  /** CPU address where ROM is loaded */
  cpuAddress: number;
  /** Size in bytes */
  size: number;
}

// Gravitar ROM mappings (CPU addresses, from MAME bwidow.cpp)
// AVG membase = 0x2000, so AVG address = CPU address - 0x2000
export const GRAVITAR_VECTOR_ROMS: RomMapping[] = [
  { filename: '136010-210.l7',  cpuAddress: 0x2800, size: 0x0800 },
  { filename: '136010-207.mn7', cpuAddress: 0x3000, size: 0x1000 },
  { filename: '136010-208.np7', cpuAddress: 0x4000, size: 0x1000 },
  { filename: '136010-309.r7',  cpuAddress: 0x5000, size: 0x1000 },
];

export const AVG_MEMBASE = 0x2000;

/** Convert CPU address to AVG byte address */
export function cpuToAvg(cpuAddr: number): number {
  return cpuAddr - AVG_MEMBASE;
}

/** Convert AVG byte address to CPU address */
export function avgToCpu(avgAddr: number): number {
  return avgAddr + AVG_MEMBASE;
}

// AVG vector ROM range in AVG address space
export const AVG_ROM_START = cpuToAvg(0x2800); // 0x0800
export const AVG_ROM_END = cpuToAvg(0x5FFF);   // 0x3FFF

// Color lookup: 3-bit RGB to hex color
export const COLOR_TABLE: Record<number, string> = {
  0: '#000000', // black (beam off)
  1: '#0000FF', // blue
  2: '#00FF00', // green
  3: '#00FFFF', // cyan
  4: '#FF0000', // red
  5: '#FF00FF', // magenta
  6: '#FFFF00', // yellow
  7: '#FFFFFF', // white
};
