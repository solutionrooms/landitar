import { type LevelData } from './level-data.js';
import { type TurretDef } from '../entities/turret.js';
import { type FuelDepotDef } from '../entities/fuel-depot.js';

const NAMES = [
  'ALPHA', 'BETA', 'GAMMA', 'DELTA', 'EPSILON', 'ZETA',
  'ETA', 'THETA', 'IOTA', 'KAPPA', 'LAMBDA', 'REACTOR',
];

const TYPES: ('cave' | 'tunnel')[] = [
  'cave', 'tunnel', 'cave', 'cave', 'cave', 'cave',
  'cave', 'tunnel', 'cave', 'cave', 'cave', 'cave',
];

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
}

type Pt = { x: number; y: number };

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function rn(v: number): number {
  return Math.round(v);
}

function generateCaveTerrain(rng: Rng, width: number, depth: number, openingWidth: number, jag: number): Pt[] {
  const halfW = width / 2;
  const halfOpen = openingWidth / 2;
  const topY = 260;
  const botY = topY - depth;
  const pts: Pt[] = [];

  const leftN = 7 + rng.int(0, 4);
  for (let i = 0; i <= leftN; i++) {
    const t = i / leftN;
    const baseX = lerp(-halfOpen, -halfW, t);
    const baseY = lerp(topY, botY, t);
    let xOff = 0;
    if (i > 0 && i < leftN) {
      xOff = (i % 2 === 1) ? rng.range(20, 50) * jag : rng.range(-10, 5) * jag;
    }
    pts.push({ x: rn(baseX + xOff), y: rn(baseY + rng.range(-8, 8) * jag) });
  }

  const botN = 8 + rng.int(0, 6);
  for (let i = 1; i < botN; i++) {
    const t = i / botN;
    const peakAmp = 20 + rng.range(0, 30) * jag;
    const yOff = (i % 2 === 0) ? rng.range(peakAmp * 0.5, peakAmp) : -rng.range(0, peakAmp * 0.4);
    pts.push({
      x: rn(lerp(-halfW, halfW, t) + rng.range(-8, 8) * jag),
      y: rn(botY + yOff),
    });
  }

  const rightN = 7 + rng.int(0, 4);
  for (let i = 0; i <= rightN; i++) {
    const t = i / rightN;
    const baseX = lerp(halfW, halfOpen, t);
    const baseY = lerp(botY, topY, t);
    let xOff = 0;
    if (i > 0 && i < rightN) {
      xOff = (i % 2 === 1) ? -rng.range(20, 50) * jag : rng.range(-5, 10) * jag;
    }
    pts.push({ x: rn(baseX + xOff), y: rn(baseY + rng.range(-8, 8) * jag) });
  }

  return pts;
}

function generateTunnelTerrain(rng: Rng, width: number, gap: number, jag: number): Pt[] {
  const halfW = width / 2;
  const ceilY = 100;
  const floorY = ceilY - gap;
  const pts: Pt[] = [];

  const numNotches = 3 + rng.int(0, 3);
  const spacing = width / (numNotches + 1);

  pts.push({ x: rn(-halfW), y: ceilY });
  for (let i = 0; i < numNotches; i++) {
    const notchX = rn(-halfW + spacing * (i + 1));
    const notchW = rn(spacing * (0.15 + rng.range(0, 0.1)));
    const notchDepth = rn(30 + rng.range(0, 25) * jag);
    pts.push({ x: notchX - notchW, y: ceilY + rn(rng.range(-3, 3) * jag) });
    pts.push({ x: notchX, y: ceilY - notchDepth });
    pts.push({ x: notchX + notchW, y: ceilY + rn(rng.range(-3, 3) * jag) });
  }
  pts.push({ x: rn(halfW), y: ceilY });
  pts.push({ x: rn(halfW), y: floorY });

  const floorN = 10 + rng.int(0, 6);
  for (let i = 1; i < floorN; i++) {
    const t = i / floorN;
    const amp = 15 + rng.range(0, 20) * jag;
    const yOff = (i % 2 === 0) ? rng.range(amp * 0.5, amp) : -rng.range(0, amp * 0.3);
    pts.push({ x: rn(lerp(halfW, -halfW, t)), y: rn(floorY + yOff) });
  }

  pts.push({ x: rn(-halfW), y: floorY });
  return pts;
}

function placeTurrets(rng: Rng, terrain: Pt[], count: number, closed: boolean): TurretDef[] {
  const nSegs = closed ? terrain.length : terrain.length - 1;
  let cx = 0, cy = 0;
  for (const p of terrain) { cx += p.x; cy += p.y; }
  cx /= terrain.length; cy /= terrain.length;

  const candidates: { x: number; y: number; angle: number; score: number }[] = [];
  for (let i = 0; i < nSegs; i++) {
    const a = terrain[i], b = terrain[(i + 1) % terrain.length];
    const dx = b.x - a.x, dy = b.y - a.y;
    const len = Math.sqrt(dx * dx + dy * dy);
    if (len < 15) continue;
    const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
    const n1x = -dy / len, n1y = dx / len;
    const dot = n1x * (cx - mx) + n1y * (cy - my);
    const nx = dot > 0 ? n1x : dy / len;
    const ny = dot > 0 ? n1y : -dx / len;
    const angle = Math.atan2(ny, nx);
    const slope = Math.abs(dy / (Math.abs(dx) + 1));
    candidates.push({ x: rn(mx + nx * 8), y: rn(my + ny * 8), angle, score: 1 / (1 + slope) + rng.next() * 0.4 });
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

function placeDepots(rng: Rng, terrain: Pt[], count: number, turrets: TurretDef[], closed: boolean): FuelDepotDef[] {
  const nSegs = closed ? terrain.length : terrain.length - 1;
  let cx = 0, cy = 0;
  for (const p of terrain) { cx += p.x; cy += p.y; }
  cx /= terrain.length; cy /= terrain.length;

  const candidates: Pt[] = [];
  for (let i = 0; i < nSegs; i++) {
    const a = terrain[i], b = terrain[(i + 1) % terrain.length];
    const dx = b.x - a.x, dy = b.y - a.y;
    const len = Math.sqrt(dx * dx + dy * dy);
    if (len < 20) continue;
    const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
    const n1x = -dy / len, n1y = dx / len;
    const dot = n1x * (cx - mx) + n1y * (cy - my);
    const nx = dot > 0 ? n1x : dy / len;
    const ny = dot > 0 ? n1y : -dx / len;
    candidates.push({ x: rn(mx + nx * 6), y: rn(my + ny * 6) });
  }

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
  const minX = Math.min(...xs), maxX = Math.max(...xs);
  const margin = (maxX - minX) * 0.2;
  const safeLeft = minX + margin, safeRight = maxX - margin;

  let bestX = 0, bestSlope = Infinity;
  for (let i = 0; i < terrain.length - 1; i++) {
    const a = terrain[i], b = terrain[i + 1];
    const mx = (a.x + b.x) / 2;
    if (mx < safeLeft || mx > safeRight) continue;
    const slope = Math.abs((b.y - a.y) / (Math.abs(b.x - a.x) + 0.01));
    if (slope < bestSlope) { bestSlope = slope; bestX = rn(mx); }
  }
  return bestX;
}

function generateCaveLevel(rng: Rng, name: string, difficulty: number): LevelData {
  const width = rn(550 + (1 - difficulty) * 200 + rng.range(-40, 40));
  const depth = rn(300 + difficulty * 200 + rng.range(-30, 30));
  const openingWidth = rn(Math.max(80, 160 - difficulty * 60 + rng.range(-15, 15)));
  const jag = 0.4 + difficulty * 0.6;
  const gravity = rn(42 + difficulty * 20 + rng.range(-3, 3));
  const turretCount = rn(4 + difficulty * 5);
  const depotCount = Math.max(2, rn(4 - difficulty));

  const terrain = generateCaveTerrain(rng, width, depth, openingWidth, jag);
  const turrets = placeTurrets(rng, terrain, turretCount, false);
  const depots = placeDepots(rng, terrain, depotCount, turrets, false);
  return { name, terrain, closed: false, gravity, spawnX: 0, spawnY: 310, turrets, fuelDepots: depots, padX: findPadX(terrain) };
}

function generateTunnelLevel(rng: Rng, name: string, difficulty: number): LevelData {
  const width = rn(700 + (1 - difficulty) * 200 + rng.range(-40, 40));
  const gap = rn(Math.max(80, 160 - difficulty * 50 + rng.range(-10, 10)));
  const jag = 0.4 + difficulty * 0.5;
  const gravity = rn(42 + difficulty * 18 + rng.range(-3, 3));
  const turretCount = rn(5 + difficulty * 4);
  const depotCount = Math.max(2, rn(4 - difficulty));

  const terrain = generateTunnelTerrain(rng, width, gap, jag);
  const turrets = placeTurrets(rng, terrain, turretCount, true);
  const depots = placeDepots(rng, terrain, depotCount, turrets, true);
  return { name, terrain, closed: true, gravity, spawnX: 0, spawnY: 200, turrets, fuelDepots: depots, padX: findPadX(terrain) };
}

export function generateLevels(seed: number): LevelData[] {
  const rng = new Rng(seed);
  return NAMES.map((name, i) => {
    const difficulty = i / 11;
    return TYPES[i] === 'tunnel' ? generateTunnelLevel(rng, name, difficulty) : generateCaveLevel(rng, name, difficulty);
  });
}
