import { type LevelData } from './level-data.js';
import { type TurretDef } from '../entities/turret.js';
import { type FuelDepotDef } from '../entities/fuel-depot.js';

const NAMES = [
  'ALPHA', 'BETA', 'GAMMA', 'DELTA', 'EPSILON', 'ZETA',
  'ETA', 'THETA', 'IOTA', 'KAPPA', 'LAMBDA', 'REACTOR',
];

/* ---------- seeded PRNG (unchanged API) ---------- */

class Rng {
  private s: number;
  constructor(seed: number) {
    this.s = (seed | 0) || 1;
  }
  next(): number {
    this.s |= 0;
    this.s = this.s + 0x6D2B79F5 | 0;
    let t = Math.imul(this.s ^ this.s >>> 15, 1 | this.s);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  }
  range(min: number, max: number): number {
    return min + this.next() * (max - min);
  }
  int(min: number, max: number): number {
    return min + Math.floor(this.next() * (max - min + 1));
  }
  /** Pick a random element from an array */
  pick<T>(arr: T[]): T {
    return arr[this.int(0, arr.length - 1)];
  }
}

/* ---------- helpers ---------- */

type Pt = { x: number; y: number };

function rn(v: number): number {
  return Math.round(v);
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function smoothstep(t: number): number {
  return t * t * (3 - 2 * t);
}

/** Compute terrain extents */
function terrainBounds(terrain: Pt[]): { minX: number; maxX: number; minY: number; maxY: number } {
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const p of terrain) {
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.y > maxY) maxY = p.y;
  }
  return { minX, maxX, minY, maxY };
}

/* ================================================================
   CAVE SHAPE GENERATORS
   Each returns a polyline (open, first point = top-left opening edge,
   last point = top-right opening edge). Y-up coordinate system.
   topY = 260 for the opening edge, ship spawns above at ~310.
   ================================================================ */

const TOP_Y = 260;

/* --- 1. Wide Bowl --- */
function genWideBowl(rng: Rng, difficulty: number): Pt[] {
  const halfW = rn(300 + (1 - difficulty) * 50 + rng.range(-20, 20));
  const openHalf = rn(Math.max(50, 100 - difficulty * 30 + rng.range(-10, 10)));
  const depth = rn(250 + difficulty * 50 + rng.range(-20, 20));
  const botY = TOP_Y - depth;
  const pts: Pt[] = [];

  // Left wall: gentle curve from opening down to bowl bottom
  const leftN = 8 + rng.int(0, 3);
  for (let i = 0; i <= leftN; i++) {
    const t = i / leftN;
    // Use smoothstep for gentle curve
    const st = smoothstep(t);
    const x = lerp(-openHalf, -halfW, st);
    const y = lerp(TOP_Y, botY, t);
    const wobble = (i > 0 && i < leftN) ? rng.range(-8, 8) : 0;
    pts.push({ x: rn(x + wobble), y: rn(y + wobble * 0.5) });
  }

  // Bottom: wide, gently undulating floor
  const botN = 12 + rng.int(0, 4);
  for (let i = 1; i < botN; i++) {
    const t = i / botN;
    const baseX = lerp(-halfW, halfW, t);
    const amp = 8 + rng.range(0, 12);
    const yOff = Math.sin(t * Math.PI * 2 + rng.range(0, Math.PI)) * amp;
    pts.push({ x: rn(baseX + rng.range(-5, 5)), y: rn(botY + yOff + rng.range(-3, 3)) });
  }

  // Right wall: mirror gentle curve
  const rightN = 8 + rng.int(0, 3);
  for (let i = 0; i <= rightN; i++) {
    const t = i / rightN;
    const st = smoothstep(t);
    const x = lerp(halfW, openHalf, st);
    const y = lerp(botY, TOP_Y, t);
    const wobble = (i > 0 && i < rightN) ? rng.range(-8, 8) : 0;
    pts.push({ x: rn(x + wobble), y: rn(y + wobble * 0.5) });
  }

  return pts;
}

/* --- 2. Deep Shaft --- */
function genDeepShaft(rng: Rng, difficulty: number): Pt[] {
  const halfW = rn(125 + (1 - difficulty) * 50 + rng.range(-15, 15));
  const openHalf = rn(Math.max(45, 80 - difficulty * 20 + rng.range(-8, 8)));
  const depth = rn(400 + difficulty * 100 + rng.range(-30, 30));
  const botY = TOP_Y - depth;
  const pts: Pt[] = [];

  // Left wall: nearly vertical with small ledges
  const leftN = 12 + rng.int(0, 4);
  for (let i = 0; i <= leftN; i++) {
    const t = i / leftN;
    const baseX = lerp(-openHalf, -halfW, Math.min(t * 3, 1));
    const y = lerp(TOP_Y, botY, t);
    let jitter = 0;
    if (i > 0 && i < leftN) {
      // Small ledges jutting inward occasionally
      jitter = (i % 3 === 0) ? rng.range(15, 30) : rng.range(-8, 5);
    }
    pts.push({ x: rn(baseX + jitter), y: rn(y + rng.range(-4, 4)) });
  }

  // Bottom: narrow floor
  const botN = 4 + rng.int(0, 3);
  for (let i = 1; i < botN; i++) {
    const t = i / botN;
    const amp = 10 + rng.range(0, 15) * difficulty;
    const yOff = (i % 2 === 0) ? rng.range(0, amp) : -rng.range(0, amp * 0.5);
    pts.push({ x: rn(lerp(-halfW, halfW, t)), y: rn(botY + yOff) });
  }

  // Right wall: nearly vertical with ledges
  const rightN = 12 + rng.int(0, 4);
  for (let i = 0; i <= rightN; i++) {
    const t = i / rightN;
    const baseX = lerp(halfW, openHalf, Math.min(t * 3, 1));
    const y = lerp(botY, TOP_Y, t);
    let jitter = 0;
    if (i > 0 && i < rightN) {
      jitter = (i % 3 === 0) ? -rng.range(15, 30) : rng.range(-5, 8);
    }
    pts.push({ x: rn(baseX + jitter), y: rn(y + rng.range(-4, 4)) });
  }

  return pts;
}

/* --- 3. Terraced / Stepped --- */
function genTerraced(rng: Rng, difficulty: number): Pt[] {
  const halfW = rn(250 + (1 - difficulty) * 50 + rng.range(-20, 20));
  const openHalf = rn(Math.max(50, 90 - difficulty * 25 + rng.range(-8, 8)));
  const depth = rn(350 + difficulty * 100 + rng.range(-20, 20));
  const botY = TOP_Y - depth;
  const numSteps = 4 + rng.int(0, 2);
  const stepH = depth / numSteps;
  const pts: Pt[] = [];

  // Start at top-left opening
  pts.push({ x: rn(-openHalf), y: TOP_Y });

  // Alternating ledges from left and right
  for (let s = 0; s < numSteps; s++) {
    const y1 = TOP_Y - s * stepH;
    const y2 = TOP_Y - (s + 1) * stepH;
    const yMid = (y1 + y2) / 2;
    const inset = rn(halfW * (0.3 + rng.range(0, 0.2)));

    if (s % 2 === 0) {
      // Ledge from left wall
      pts.push({ x: rn(-halfW + rng.range(-5, 5)), y: rn(yMid + rng.range(-5, 5)) });
      pts.push({ x: rn(-halfW + inset + rng.range(-8, 8)), y: rn(yMid - 5 + rng.range(-5, 5)) });
      pts.push({ x: rn(-halfW + inset + rng.range(-8, 8)), y: rn(y2 + rng.range(-5, 5)) });
    } else {
      // Ledge from right wall
      pts.push({ x: rn(halfW - inset + rng.range(-8, 8)), y: rn(yMid + rng.range(-5, 5)) });
      pts.push({ x: rn(halfW + rng.range(-5, 5)), y: rn(yMid - 5 + rng.range(-5, 5)) });
      pts.push({ x: rn(halfW + rng.range(-5, 5)), y: rn(y2 + rng.range(-5, 5)) });
    }
  }

  // Bottom floor
  const botN = 4 + rng.int(0, 3);
  for (let i = 0; i < botN; i++) {
    const t = i / Math.max(1, botN - 1);
    pts.push({
      x: rn(lerp(-halfW * 0.6, halfW * 0.6, t) + rng.range(-8, 8)),
      y: rn(botY + rng.range(-5, 10)),
    });
  }

  // Climb back up the other side to opening
  // Go from bottom-right area to top-right opening
  const returnSteps = 3 + rng.int(0, 2);
  for (let s = 0; s < returnSteps; s++) {
    const t = (s + 1) / (returnSteps + 1);
    pts.push({
      x: rn(lerp(halfW * 0.4, halfW, t) + rng.range(-10, 10)),
      y: rn(lerp(botY, TOP_Y, t) + rng.range(-10, 10)),
    });
  }

  pts.push({ x: rn(openHalf), y: TOP_Y });
  return pts;
}

/* --- 4. Mesa --- */
function genMesa(rng: Rng, difficulty: number): Pt[] {
  const halfW = rn(300 + (1 - difficulty) * 50 + rng.range(-20, 20));
  const openHalf = rn(Math.max(60, 100 - difficulty * 25 + rng.range(-8, 8)));
  const depth = rn(280 + difficulty * 60 + rng.range(-20, 20));
  const botY = TOP_Y - depth;
  // Mesa must stay short enough to not block passage — max 25% of depth
  const mesaHeight = rn(depth * (0.15 + rng.range(0, 0.10)));
  // Mesa should be narrow relative to cave width
  const mesaHalfW = rn(halfW * (0.12 + rng.range(0, 0.08)));
  const pts: Pt[] = [];

  // Left wall: gentle curve
  const leftN = 6 + rng.int(0, 3);
  for (let i = 0; i <= leftN; i++) {
    const t = i / leftN;
    const x = lerp(-openHalf, -halfW, smoothstep(Math.min(t * 2, 1)));
    const y = lerp(TOP_Y, botY, t);
    const wobble = (i > 0 && i < leftN) ? rng.range(-8, 8) : 0;
    pts.push({ x: rn(x + wobble), y: rn(y + wobble * 0.3) });
  }

  // Floor left of mesa — flat-ish
  const floorL = 3 + rng.int(0, 2);
  for (let i = 1; i <= floorL; i++) {
    const t = i / (floorL + 1);
    pts.push({
      x: rn(lerp(-halfW, -mesaHalfW - 20, t) + rng.range(-5, 5)),
      y: rn(botY + rng.range(0, 8)),
    });
  }

  // Mesa: gentle rise, flat top, gentle descent
  const mesaTopY = botY + mesaHeight;
  pts.push({ x: rn(-mesaHalfW - 10), y: rn(botY + rng.range(0, 5)) });
  pts.push({ x: rn(-mesaHalfW), y: rn(mesaTopY + rng.range(-3, 3)) });

  // Mesa top — some texture
  const mesaTopN = 2 + rng.int(0, 2);
  for (let i = 1; i < mesaTopN; i++) {
    const t = i / mesaTopN;
    pts.push({
      x: rn(lerp(-mesaHalfW, mesaHalfW, t) + rng.range(-3, 3)),
      y: rn(mesaTopY + rng.range(-5, 5)),
    });
  }

  pts.push({ x: rn(mesaHalfW), y: rn(mesaTopY + rng.range(-3, 3)) });
  pts.push({ x: rn(mesaHalfW + 10), y: rn(botY + rng.range(0, 5)) });

  // Floor right of mesa — flat-ish
  const floorR = 3 + rng.int(0, 2);
  for (let i = 1; i <= floorR; i++) {
    const t = i / (floorR + 1);
    pts.push({
      x: rn(lerp(mesaHalfW + 20, halfW, t) + rng.range(-5, 5)),
      y: rn(botY + rng.range(0, 8)),
    });
  }

  // Right wall: gentle curve
  const rightN = 6 + rng.int(0, 3);
  for (let i = 0; i <= rightN; i++) {
    const t = i / rightN;
    const x = lerp(halfW, openHalf, smoothstep(Math.min(t * 2, 1)));
    const y = lerp(botY, TOP_Y, t);
    const wobble = (i > 0 && i < rightN) ? rng.range(-8, 8) : 0;
    pts.push({ x: rn(x + wobble), y: rn(y + wobble * 0.3) });
  }

  return pts;
}

/* --- 5. Overhang (mushroom shape) --- */
function genOverhang(rng: Rng, difficulty: number): Pt[] {
  const neckHalfW = rn(80 + (1 - difficulty) * 30 + rng.range(-10, 10));
  const bulgeHalfW = rn(neckHalfW + 80 + rng.range(20, 60));
  const openHalf = rn(Math.max(45, neckHalfW - 10 + rng.range(-5, 5)));
  const depth = rn(350 + difficulty * 80 + rng.range(-20, 20));
  const botY = TOP_Y - depth;
  const neckEndY = TOP_Y - depth * 0.3;
  const bulgeStartY = neckEndY;
  const bulgeEndY = botY + depth * 0.15;
  const pts: Pt[] = [];

  // Left wall: neck portion (narrow)
  const neckN = 5 + rng.int(0, 2);
  for (let i = 0; i <= neckN; i++) {
    const t = i / neckN;
    const x = lerp(-openHalf, -neckHalfW, Math.min(t * 2, 1));
    const y = lerp(TOP_Y, bulgeStartY, t);
    const w = (i > 0 && i < neckN) ? rng.range(-6, 6) : 0;
    pts.push({ x: rn(x + w), y: rn(y) });
  }

  // Left wall: bulge outward
  const bulgeN = 5 + rng.int(0, 2);
  for (let i = 0; i <= bulgeN; i++) {
    const t = i / bulgeN;
    // Bulge follows a sine curve outward
    const bulgeAmount = Math.sin(t * Math.PI) * (bulgeHalfW - neckHalfW);
    const x = -neckHalfW - bulgeAmount;
    const y = lerp(bulgeStartY, bulgeEndY, t);
    pts.push({ x: rn(x + rng.range(-6, 6)), y: rn(y + rng.range(-4, 4)) });
  }

  // Bottom
  const botN = 6 + rng.int(0, 3);
  for (let i = 0; i <= botN; i++) {
    const t = i / botN;
    const x = lerp(-bulgeHalfW * 0.5, bulgeHalfW * 0.5, t);
    const amp = 8 + rng.range(0, 10);
    pts.push({ x: rn(x + rng.range(-5, 5)), y: rn(botY + Math.sin(t * Math.PI) * amp + rng.range(-3, 3)) });
  }

  // Right wall: bulge
  for (let i = 0; i <= bulgeN; i++) {
    const t = i / bulgeN;
    const bulgeAmount = Math.sin((1 - t) * Math.PI) * (bulgeHalfW - neckHalfW);
    const x = neckHalfW + bulgeAmount;
    const y = lerp(bulgeEndY, bulgeStartY, t);
    pts.push({ x: rn(x + rng.range(-6, 6)), y: rn(y + rng.range(-4, 4)) });
  }

  // Right wall: neck portion
  for (let i = 0; i <= neckN; i++) {
    const t = i / neckN;
    const x = lerp(neckHalfW, openHalf, Math.min(t * 2, 1));
    const y = lerp(bulgeStartY, TOP_Y, t);
    const w = (i > 0 && i < neckN) ? rng.range(-6, 6) : 0;
    pts.push({ x: rn(x + w), y: rn(y) });
  }

  return pts;
}

/* --- 6. Winding S-Curve --- */
function genWinding(rng: Rng, difficulty: number): Pt[] {
  const halfW = rn(220 + (1 - difficulty) * 40 + rng.range(-15, 15));
  const openHalf = rn(Math.max(50, 85 - difficulty * 20 + rng.range(-8, 8)));
  const depth = rn(380 + difficulty * 80 + rng.range(-25, 25));
  const botY = TOP_Y - depth;
  const passageHalfGap = rn(50 + (1 - difficulty) * 25 + rng.range(-8, 8));
  const pts: Pt[] = [];

  // Number of S-bends
  const bends = 2 + rng.int(0, 1);
  const segH = depth / (bends * 2 + 1);

  // Left wall: follows S-curve offset to the left
  pts.push({ x: rn(-openHalf), y: TOP_Y });
  const leftSteps = (bends * 2 + 1) * 3;
  for (let i = 1; i <= leftSteps; i++) {
    const t = i / leftSteps;
    const y = lerp(TOP_Y, botY, t);
    // S-curve: sine wave that shifts the center left/right
    const phase = t * bends * Math.PI;
    const centerX = Math.sin(phase) * (halfW - passageHalfGap) * 0.5;
    const x = centerX - passageHalfGap;
    pts.push({ x: rn(x + rng.range(-6, 6)), y: rn(y + rng.range(-3, 3)) });
  }

  // Bottom: short flat section
  const botCenterX = Math.sin(bends * Math.PI) * (halfW - passageHalfGap) * 0.5;
  pts.push({ x: rn(botCenterX - passageHalfGap * 0.3 + rng.range(-5, 5)), y: rn(botY + rng.range(-3, 5)) });
  pts.push({ x: rn(botCenterX + passageHalfGap * 0.3 + rng.range(-5, 5)), y: rn(botY + rng.range(-3, 5)) });

  // Right wall: follows S-curve offset to the right (going back up)
  const rightSteps = (bends * 2 + 1) * 3;
  for (let i = rightSteps; i >= 1; i--) {
    const t = i / rightSteps;
    const y = lerp(TOP_Y, botY, t);
    const phase = t * bends * Math.PI;
    const centerX = Math.sin(phase) * (halfW - passageHalfGap) * 0.5;
    const x = centerX + passageHalfGap;
    pts.push({ x: rn(x + rng.range(-6, 6)), y: rn(y + rng.range(-3, 3)) });
  }

  pts.push({ x: rn(openHalf), y: TOP_Y });
  return pts;
}

/* ================================================================
   TUNNEL GENERATORS (closed = true)
   Return a closed polyline — first point connects to last.
   ================================================================ */

/* --- 7a. Notched Tunnel (improved original) --- */
function genNotchedTunnel(rng: Rng, difficulty: number): Pt[] {
  const halfW = rn(350 + (1 - difficulty) * 100 + rng.range(-30, 30));
  const gap = rn(Math.max(70, 150 - difficulty * 50 + rng.range(-10, 10)));
  const ceilY = 100;
  const floorY = ceilY - gap;
  const pts: Pt[] = [];

  // Ceiling with varied features: notches, bumps, flat sections
  const numFeatures = 4 + rng.int(0, 3);
  const spacing = (halfW * 2) / (numFeatures + 1);

  pts.push({ x: rn(-halfW), y: ceilY });
  for (let i = 0; i < numFeatures; i++) {
    const cx = rn(-halfW + spacing * (i + 1));
    const featureType = rng.int(0, 2); // 0=notch, 1=bump, 2=step
    if (featureType === 0) {
      // Notch (stalactite)
      const w = rn(spacing * (0.12 + rng.range(0, 0.1)));
      const d = rn(25 + rng.range(0, 30) * (0.5 + difficulty * 0.5));
      pts.push({ x: cx - w, y: ceilY + rn(rng.range(-3, 3)) });
      pts.push({ x: cx, y: ceilY - d });
      pts.push({ x: cx + w, y: ceilY + rn(rng.range(-3, 3)) });
    } else if (featureType === 1) {
      // Bump (wide depression upward)
      const w = rn(spacing * (0.2 + rng.range(0, 0.15)));
      const d = rn(10 + rng.range(0, 15));
      pts.push({ x: cx - w, y: ceilY });
      pts.push({ x: cx - w * 0.5, y: ceilY + d });
      pts.push({ x: cx + w * 0.5, y: ceilY + d });
      pts.push({ x: cx + w, y: ceilY });
    } else {
      // Step
      const w = rn(spacing * (0.15 + rng.range(0, 0.1)));
      const d = rn(15 + rng.range(0, 20) * difficulty);
      pts.push({ x: cx - w, y: ceilY });
      pts.push({ x: cx - w, y: ceilY - d });
      pts.push({ x: cx + w, y: ceilY - d });
      pts.push({ x: cx + w, y: ceilY });
    }
  }
  pts.push({ x: rn(halfW), y: ceilY });

  // Right wall connector
  pts.push({ x: rn(halfW), y: floorY });

  // Floor: varied terrain going right-to-left
  const floorFeatures = 5 + rng.int(0, 4);
  const floorSpacing = (halfW * 2) / (floorFeatures + 1);
  for (let i = 0; i < floorFeatures; i++) {
    const cx = rn(halfW - floorSpacing * (i + 1));
    const fType = rng.int(0, 2);
    if (fType === 0) {
      // Stalagmite
      const w = rn(floorSpacing * (0.12 + rng.range(0, 0.1)));
      const h = rn(20 + rng.range(0, 25) * (0.5 + difficulty * 0.5));
      pts.push({ x: cx + w, y: floorY + rn(rng.range(-3, 3)) });
      pts.push({ x: cx, y: floorY + h });
      pts.push({ x: cx - w, y: floorY + rn(rng.range(-3, 3)) });
    } else if (fType === 1) {
      // Pit
      const w = rn(floorSpacing * (0.2 + rng.range(0, 0.1)));
      const d = rn(10 + rng.range(0, 15));
      pts.push({ x: cx + w, y: floorY });
      pts.push({ x: cx + w * 0.5, y: floorY - d });
      pts.push({ x: cx - w * 0.5, y: floorY - d });
      pts.push({ x: cx - w, y: floorY });
    } else {
      // Rolling hill
      const w = rn(floorSpacing * (0.25 + rng.range(0, 0.1)));
      const h = rn(12 + rng.range(0, 18));
      pts.push({ x: cx + w, y: floorY + rn(rng.range(-2, 2)) });
      pts.push({ x: cx, y: floorY + h });
      pts.push({ x: cx - w, y: floorY + rn(rng.range(-2, 2)) });
    }
  }

  // Left wall connector
  pts.push({ x: rn(-halfW), y: floorY });
  return pts;
}

/* --- 7b. Winding Tunnel --- */
function genWindingTunnel(rng: Rng, difficulty: number): Pt[] {
  const halfW = rn(380 + (1 - difficulty) * 80 + rng.range(-30, 30));
  const baseGap = rn(Math.max(65, 140 - difficulty * 45 + rng.range(-10, 10)));
  const centerY = 30;
  const pts: Pt[] = [];

  // Both ceiling and floor undulate, creating varying gap widths
  const numSections = 10 + rng.int(0, 4);

  // Ceiling (left to right)
  const ceilPts: Pt[] = [];
  for (let i = 0; i <= numSections; i++) {
    const t = i / numSections;
    const x = lerp(-halfW, halfW, t);
    const wave = Math.sin(t * Math.PI * (2 + rng.range(0, 1))) * (25 + rng.range(0, 15));
    const y = centerY + baseGap / 2 + wave + rng.range(-5, 5);
    ceilPts.push({ x: rn(x), y: rn(y) });
  }

  // Floor (left to right, but we'll reverse it for the closed polygon)
  const floorPts: Pt[] = [];
  for (let i = 0; i <= numSections; i++) {
    const t = i / numSections;
    const x = lerp(-halfW, halfW, t);
    const wave = Math.sin(t * Math.PI * (2 + rng.range(0, 1)) + Math.PI * 0.5) * (20 + rng.range(0, 12));
    const y = centerY - baseGap / 2 + wave + rng.range(-5, 5);
    floorPts.push({ x: rn(x), y: rn(y) });
  }

  // Build closed polygon: ceiling L->R, right wall, floor R->L, left wall
  for (const p of ceilPts) pts.push(p);
  pts.push({ x: rn(halfW), y: rn(floorPts[floorPts.length - 1].y) });
  for (let i = floorPts.length - 1; i >= 0; i--) pts.push(floorPts[i]);
  pts.push({ x: rn(-halfW), y: rn(ceilPts[0].y) });

  return pts;
}

/* --- 7c. Reactor Tunnel (special final level) --- */
function genReactorTunnel(rng: Rng, difficulty: number): Pt[] {
  const halfW = rn(300 + rng.range(-20, 20));
  const gap = rn(Math.max(60, 100 - difficulty * 20 + rng.range(-5, 5)));
  const centerY = 30;
  const pts: Pt[] = [];

  // Complex enclosed shape with narrow passages, chambers, and chokepoints
  const numChambers = 3;
  const chamberW = (halfW * 2) / numChambers;
  const chokeGap = gap * 0.5;

  // Ceiling: chambers separated by chokepoints
  const ceilPts: Pt[] = [];
  ceilPts.push({ x: rn(-halfW), y: rn(centerY + gap / 2) });
  for (let c = 0; c < numChambers; c++) {
    const cStart = -halfW + c * chamberW;
    const cEnd = cStart + chamberW;
    const cMid = (cStart + cEnd) / 2;

    // Chamber ceiling bulges up
    const bulge = rn(gap * (0.3 + rng.range(0, 0.2)));
    ceilPts.push({ x: rn(cStart + chamberW * 0.2), y: rn(centerY + gap / 2 + bulge * 0.5) });
    ceilPts.push({ x: rn(cMid + rng.range(-10, 10)), y: rn(centerY + gap / 2 + bulge) });
    ceilPts.push({ x: rn(cEnd - chamberW * 0.2), y: rn(centerY + gap / 2 + bulge * 0.5) });

    // Chokepoint (except at the end)
    if (c < numChambers - 1) {
      ceilPts.push({ x: rn(cEnd), y: rn(centerY + chokeGap / 2) });
    }
  }
  ceilPts.push({ x: rn(halfW), y: rn(centerY + gap / 2) });

  // Floor: inverse pattern
  const floorPts: Pt[] = [];
  floorPts.push({ x: rn(-halfW), y: rn(centerY - gap / 2) });
  for (let c = 0; c < numChambers; c++) {
    const cStart = -halfW + c * chamberW;
    const cEnd = cStart + chamberW;
    const cMid = (cStart + cEnd) / 2;

    const bulge = rn(gap * (0.3 + rng.range(0, 0.2)));
    floorPts.push({ x: rn(cStart + chamberW * 0.2), y: rn(centerY - gap / 2 - bulge * 0.5) });
    floorPts.push({ x: rn(cMid + rng.range(-10, 10)), y: rn(centerY - gap / 2 - bulge) });
    floorPts.push({ x: rn(cEnd - chamberW * 0.2), y: rn(centerY - gap / 2 - bulge * 0.5) });

    if (c < numChambers - 1) {
      floorPts.push({ x: rn(cEnd), y: rn(centerY - chokeGap / 2) });
    }
  }
  floorPts.push({ x: rn(halfW), y: rn(centerY - gap / 2) });

  // Build closed polygon
  for (const p of ceilPts) pts.push(p);
  pts.push({ x: rn(halfW), y: rn(floorPts[floorPts.length - 1].y) });
  for (let i = floorPts.length - 1; i >= 0; i--) pts.push(floorPts[i]);
  pts.push({ x: rn(-halfW), y: rn(ceilPts[0].y) });

  return pts;
}

/* ================================================================
   TURRET & DEPOT PLACEMENT
   ================================================================ */

function placeTurrets(
  rng: Rng,
  terrain: Pt[],
  count: number,
  closed: boolean,
  spawnX: number,
  spawnY: number,
): TurretDef[] {
  const nSegs = closed ? terrain.length : terrain.length - 1;

  const candidates: { x: number; y: number; angle: number; score: number }[] = [];
  for (let i = 0; i < nSegs; i++) {
    const a = terrain[i];
    const b = terrain[(i + 1) % terrain.length];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len = Math.sqrt(dx * dx + dy * dy);
    if (len < 15) continue;

    const mx = (a.x + b.x) / 2;
    const my = (a.y + b.y) / 2;

    // Two candidate normals
    const n1x = -dy / len;
    const n1y = dx / len;

    // Pick the normal that points toward the spawn point (interior)
    const dot = n1x * (spawnX - mx) + n1y * (spawnY - my);
    const nx = dot > 0 ? n1x : dy / len;
    const ny = dot > 0 ? n1y : -dx / len;

    const angle = Math.atan2(ny, nx);

    // Prefer flatter surfaces (lower slope) for turret placement
    const slope = Math.abs(dy / (Math.abs(dx) + 1));
    candidates.push({
      x: rn(mx + nx * 12),
      y: rn(my + ny * 12),
      angle,
      score: 1 / (1 + slope) + rng.next() * 0.4,
    });
  }

  candidates.sort((a, b) => b.score - a.score);
  const selected: TurretDef[] = [];
  for (const c of candidates) {
    if (selected.length >= count) break;
    if (selected.some(t => (t.x - c.x) ** 2 + (t.y - c.y) ** 2 < 55 * 55)) continue;
    selected.push({ x: c.x, y: c.y, angle: c.angle });
  }
  return selected;
}

function placeDepots(
  rng: Rng,
  terrain: Pt[],
  count: number,
  turrets: TurretDef[],
  closed: boolean,
  spawnX: number,
  spawnY: number,
): FuelDepotDef[] {
  const nSegs = closed ? terrain.length : terrain.length - 1;

  const candidates: Pt[] = [];
  for (let i = 0; i < nSegs; i++) {
    const a = terrain[i];
    const b = terrain[(i + 1) % terrain.length];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len = Math.sqrt(dx * dx + dy * dy);
    if (len < 20) continue;

    const mx = (a.x + b.x) / 2;
    const my = (a.y + b.y) / 2;
    const n1x = -dy / len;
    const n1y = dx / len;
    const dot = n1x * (spawnX - mx) + n1y * (spawnY - my);
    const nx = dot > 0 ? n1x : dy / len;
    const ny = dot > 0 ? n1y : -dx / len;
    candidates.push({ x: rn(mx + nx * 6), y: rn(my + ny * 6) });
  }

  // Shuffle candidates
  for (let i = candidates.length - 1; i > 0; i--) {
    const j = rng.int(0, i);
    [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
  }

  const selected: FuelDepotDef[] = [];
  for (const c of candidates) {
    if (selected.length >= count) break;
    if (turrets.some(t => (t.x - c.x) ** 2 + (t.y - c.y) ** 2 < 40 * 40)) continue;
    if (selected.some(d => (d.x - c.x) ** 2 + (d.y - c.y) ** 2 < 80 * 80)) continue;
    selected.push({ x: c.x, y: c.y });
  }
  return selected;
}

function findPadX(terrain: Pt[]): number {
  const xs = terrain.map(p => p.x);
  const ys = terrain.map(p => p.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const margin = (maxX - minX) * 0.15;
  const safeLeft = minX + margin;
  const safeRight = maxX - margin;

  // Only consider segments near the bottom of the terrain (within 30% of depth from floor)
  const maxY = Math.max(...ys);
  const bottomThreshold = minY + (maxY - minY) * 0.35;

  let bestX = 0;
  let bestSlope = Infinity;
  for (let i = 0; i < terrain.length - 1; i++) {
    const a = terrain[i];
    const b = terrain[i + 1];
    const mx = (a.x + b.x) / 2;
    const my = (a.y + b.y) / 2;
    if (mx < safeLeft || mx > safeRight) continue;
    if (my > bottomThreshold) continue; // skip wall segments — only use floor
    const slope = Math.abs((b.y - a.y) / (Math.abs(b.x - a.x) + 0.01));
    if (slope < bestSlope) {
      bestSlope = slope;
      bestX = rn(mx);
    }
  }
  return bestX;
}

/* ================================================================
   STYLE DEFINITIONS & LEVEL ASSIGNMENT
   ================================================================ */

type CaveStyle = 'wide-bowl' | 'deep-shaft' | 'terraced' | 'mesa' | 'overhang' | 'winding';
type TunnelStyle = 'notched-tunnel' | 'winding-tunnel' | 'reactor-tunnel';
type LevelStyle = CaveStyle | TunnelStyle;

const CAVE_STYLES: CaveStyle[] = ['wide-bowl', 'deep-shaft', 'terraced', 'mesa', 'overhang', 'winding'];
const TUNNEL_STYLES: TunnelStyle[] = ['notched-tunnel', 'winding-tunnel'];

function generateTerrainForStyle(rng: Rng, style: LevelStyle, difficulty: number): Pt[] {
  switch (style) {
    case 'wide-bowl': return genWideBowl(rng, difficulty);
    case 'deep-shaft': return genDeepShaft(rng, difficulty);
    case 'terraced': return genTerraced(rng, difficulty);
    case 'mesa': return genMesa(rng, difficulty);
    case 'overhang': return genOverhang(rng, difficulty);
    case 'winding': return genWinding(rng, difficulty);
    case 'notched-tunnel': return genNotchedTunnel(rng, difficulty);
    case 'winding-tunnel': return genWindingTunnel(rng, difficulty);
    case 'reactor-tunnel': return genReactorTunnel(rng, difficulty);
  }
}

function isTunnelStyle(style: LevelStyle): boolean {
  return style === 'notched-tunnel' || style === 'winding-tunnel' || style === 'reactor-tunnel';
}

/**
 * Assign styles to 12 levels such that:
 * - At least 3 levels are tunnels (closed)
 * - No two adjacent levels share the same style
 * - REACTOR (index 11) is always the reactor-tunnel
 * - Difficulty ramps from 0 to 1
 */
function assignStyles(rng: Rng): LevelStyle[] {
  const styles: LevelStyle[] = new Array(12);

  // Fixed assignments
  styles[11] = 'reactor-tunnel';

  // Place 2 more tunnels in varied positions (avoiding adjacent to index 11)
  const tunnelSlots = [1, 4, 7]; // spread out tunnel candidates
  // Pick 2 of the 3 slots
  const shuffledSlots = [...tunnelSlots];
  for (let i = shuffledSlots.length - 1; i > 0; i--) {
    const j = rng.int(0, i);
    [shuffledSlots[i], shuffledSlots[j]] = [shuffledSlots[j], shuffledSlots[i]];
  }
  styles[shuffledSlots[0]] = rng.pick(TUNNEL_STYLES);
  styles[shuffledSlots[1]] = rng.pick(TUNNEL_STYLES);

  // Fill remaining cave slots ensuring no adjacent duplicates
  for (let i = 0; i < 12; i++) {
    if (styles[i] !== undefined) continue;

    // Gather which styles are forbidden (same as neighbors)
    const forbidden = new Set<LevelStyle>();
    if (i > 0 && styles[i - 1] !== undefined) forbidden.add(styles[i - 1]);
    if (i < 11 && styles[i + 1] !== undefined) forbidden.add(styles[i + 1]);

    const candidates = CAVE_STYLES.filter(s => !forbidden.has(s));
    styles[i] = rng.pick(candidates.length > 0 ? candidates : CAVE_STYLES);
  }

  // Final pass: fix any adjacent duplicates
  for (let i = 1; i < 12; i++) {
    if (styles[i] === styles[i - 1]) {
      const isTunnel = isTunnelStyle(styles[i]);
      const pool = isTunnel ? TUNNEL_STYLES : CAVE_STYLES;
      const alts = pool.filter(s => s !== styles[i] && (i < 11 ? s !== styles[i + 1] : true));
      if (alts.length > 0) styles[i] = rng.pick(alts);
    }
  }

  return styles;
}

/* ================================================================
   MAIN EXPORT
   ================================================================ */

export function generateLevels(seed: number): LevelData[] {
  const rng = new Rng(seed);
  const styles = assignStyles(rng);

  return NAMES.map((name, i) => {
    const difficulty = i / 11;
    const style = styles[i];
    const closed = isTunnelStyle(style);

    const terrain = generateTerrainForStyle(rng, style, difficulty);
    const bounds = terrainBounds(terrain);
    const terrainWidth = bounds.maxX - bounds.minX;

    // Width override: 15% wider than terrain extent for spike wall margin
    const width = closed ? undefined : rn(terrainWidth * 1.15);

    // Spawn position
    const spawnX = 0;
    const spawnY = closed ? 200 : 310;

    // Gravity ramps with difficulty
    const gravity = rn(42 + difficulty * 22 + rng.range(-3, 3));

    // Turret count ramps with difficulty
    const turretCount = rn(3 + difficulty * 6 + rng.range(0, 1));

    // Fuel depots decrease with difficulty
    const depotCount = Math.max(1, rn(4 - difficulty * 2 + rng.range(-0.5, 0.5)));

    const turrets = placeTurrets(rng, terrain, turretCount, closed, spawnX, spawnY);
    const fuelDepots = placeDepots(rng, terrain, depotCount, turrets, closed, spawnX, spawnY);
    const padX = findPadX(terrain);

    return {
      name,
      terrain,
      closed,
      gravity,
      spawnX,
      spawnY,
      turrets,
      fuelDepots,
      padX,
      width,
    };
  });
}
