// Gravitar levels traced from original arcade screenshots
// Terrain polylines, turret and fuel depot positions traced from MAME captures

import { type TurretDef } from '../entities/turret.js';
import { type FuelDepotDef } from '../entities/fuel-depot.js';

export interface LevelData {
  name: string;
  terrain: { x: number; y: number }[];
  closed: boolean;
  gravity: number;
  spawnX: number;
  spawnY: number;
  turrets: TurretDef[];
  fuelDepots: FuelDepotDef[];
  padX?: number;
  width?: number;   // override play area width (centered at x=0)
  islands?: { x: number; y: number }[][]; // additional closed polylines (pillars, islands)
}

const U = Math.PI / 2; // turret pointing up

// L1: Large enclosed cave, open at top. Jagged angular walls.
const L1: LevelData = {
  name: 'ALPHA',
  terrain: [
    {x:-80,y:260}, {x:-120,y:220}, {x:-160,y:200},
    {x:-200,y:160}, {x:-160,y:140}, {x:-200,y:100},
    {x:-240,y:80}, {x:-280,y:40}, {x:-320,y:0},
    {x:-340,y:-40}, {x:-300,y:-60}, {x:-340,y:-100},
    {x:-300,y:-140}, {x:-260,y:-160}, {x:-220,y:-140},
    {x:-200,y:-180}, {x:-160,y:-200}, {x:-120,y:-180},
    {x:-80,y:-200}, {x:-40,y:-180}, {x:0,y:-200},
    {x:40,y:-220}, {x:80,y:-200},
    {x:120,y:-180}, {x:160,y:-200}, {x:200,y:-160},
    {x:240,y:-140}, {x:280,y:-100},
    {x:320,y:-60}, {x:340,y:-20}, {x:320,y:20},
    {x:300,y:60}, {x:260,y:100},
    {x:300,y:140}, {x:260,y:160},
    {x:220,y:200}, {x:180,y:220}, {x:140,y:240},
    {x:100,y:260},
  ],
  closed: false, gravity: 50, spawnX: 0, spawnY: 300, padX: 0,
  turrets: [
    {x:-200,y:108,angle:U}, {x:-300,y:-52,angle:U},
    {x:-120,y:-172,angle:U}, {x:40,y:-212,angle:U},
    {x:200,y:-152,angle:U}, {x:300,y:68,angle:U},
    {x:140,y:248,angle:U},
  ],
  fuelDepots: [{x:-160,y:148},{x:-260,y:-152},{x:80,y:-192},{x:320,y:28}],
};

// L2: Wide two-tier. Flat ceiling with V-notches, jagged floor.
const L2: LevelData = {
  name: 'BETA',
  terrain: [
    {x:-500,y:100},
    {x:-460,y:100}, {x:-420,y:60}, {x:-380,y:100},
    {x:-300,y:100}, {x:-260,y:60}, {x:-220,y:100},
    {x:-100,y:100}, {x:-60,y:60}, {x:-20,y:100},
    {x:60,y:100}, {x:100,y:100},
    {x:180,y:100}, {x:220,y:60}, {x:260,y:100},
    {x:380,y:100}, {x:420,y:60}, {x:460,y:100},
    {x:500,y:100},
    {x:500,y:-40},
    {x:460,y:-60}, {x:420,y:-40}, {x:380,y:-80},
    {x:340,y:-60}, {x:300,y:-100}, {x:260,y:-80},
    {x:220,y:-60}, {x:180,y:-80}, {x:140,y:-100},
    {x:100,y:-80}, {x:60,y:-60}, {x:20,y:-80},
    {x:-20,y:-100}, {x:-60,y:-60}, {x:-100,y:-80},
    {x:-140,y:-100}, {x:-180,y:-80}, {x:-220,y:-60},
    {x:-260,y:-80}, {x:-300,y:-100}, {x:-340,y:-60},
    {x:-380,y:-80}, {x:-420,y:-40}, {x:-460,y:-60},
    {x:-500,y:-40},
  ],
  closed: true, gravity: 45, spawnX: 0, spawnY: 200, padX: 0,
  turrets: [
    {x:-420,y:68,angle:-U}, {x:-260,y:68,angle:-U}, {x:-60,y:68,angle:-U},
    {x:220,y:68,angle:-U}, {x:420,y:68,angle:-U},
    {x:-300,y:-92,angle:U}, {x:-140,y:-92,angle:U},
    {x:60,y:-52,angle:U}, {x:300,y:-92,angle:U},
  ],
  fuelDepots: [{x:-400,y:-32},{x:-100,y:-72},{x:140,y:-92},{x:400,y:-32}],
};

// L3: Angular structures rising from bottom. Open top.
const L3: LevelData = {
  name: 'GAMMA',
  terrain: [
    {x:-400,y:-120},
    {x:-360,y:-80}, {x:-320,y:-40}, {x:-280,y:0},
    {x:-240,y:40}, {x:-200,y:80},
    {x:-200,y:40}, {x:-240,y:0}, {x:-200,y:-40},
    {x:-160,y:0}, {x:-120,y:-40},
    {x:-80,y:-80}, {x:-40,y:-120},
    {x:0,y:-100}, {x:40,y:-80},
    {x:80,y:-40}, {x:120,y:0},
    {x:160,y:40}, {x:200,y:0}, {x:160,y:-40},
    {x:200,y:-80},
    {x:260,y:-40}, {x:320,y:0},
    {x:360,y:40}, {x:320,y:80},
    {x:280,y:40}, {x:320,y:0},
    {x:360,y:-40}, {x:400,y:-80},
    {x:400,y:-120},
  ],
  closed: false, gravity: 50, spawnX: 0, spawnY: 200, padX: -40,
  turrets: [
    {x:-280,y:8,angle:U}, {x:-200,y:88,angle:U},
    {x:-120,y:-32,angle:U}, {x:80,y:-32,angle:U},
    {x:200,y:8,angle:U}, {x:320,y:88,angle:U},
  ],
  fuelDepots: [{x:-320,y:-32},{x:-40,y:-112},{x:160,y:48},{x:280,y:-32}],
};

// L4: Same cave as L1 (repeats in later universe)
const L4: LevelData = {
  ...L1, name: 'DELTA', gravity: 55,
  turrets: L1.turrets.map(t => ({...t})),
  fuelDepots: L1.fuelDepots.map(f => ({...f})),
  terrain: [...L1.terrain],
};

// L5: Complex interlocking figure-8 / pretzel shape
const L5: LevelData = {
  name: 'EPSILON',
  terrain: [
    {x:-200,y:240}, {x:-280,y:200}, {x:-320,y:140},
    {x:-300,y:80}, {x:-240,y:40}, {x:-200,y:80},
    {x:-160,y:40}, {x:-200,y:0},
    {x:-280,y:-40}, {x:-320,y:-100},
    {x:-280,y:-160}, {x:-220,y:-200},
    {x:-160,y:-180}, {x:-120,y:-140},
    {x:-80,y:-100}, {x:-40,y:-60}, {x:0,y:-40},
    {x:40,y:-60}, {x:80,y:-100},
    {x:120,y:-140}, {x:160,y:-180},
    {x:220,y:-200}, {x:280,y:-160},
    {x:320,y:-100}, {x:280,y:-40},
    {x:200,y:0}, {x:160,y:40},
    {x:200,y:80}, {x:240,y:40},
    {x:300,y:80}, {x:320,y:140},
    {x:280,y:200}, {x:200,y:240},
  ],
  closed: false, gravity: 55, spawnX: 0, spawnY: 300, padX: 0,
  turrets: [
    {x:-300,y:88,angle:U}, {x:-280,y:-152,angle:U},
    {x:-40,y:-52,angle:U}, {x:120,y:-132,angle:U},
    {x:280,y:-152,angle:U}, {x:300,y:88,angle:U},
    {x:-200,y:8,angle:U}, {x:200,y:8,angle:U},
  ],
  fuelDepots: [{x:-220,y:-192},{x:0,y:-32},{x:220,y:-192}],
};

// L6: Scattered geometric shapes - triangle, arrow, parallelogram
const L6: LevelData = {
  name: 'ZETA',
  terrain: [
    {x:-400,y:-100},
    {x:-360,y:-60}, {x:-300,y:40}, {x:-260,y:80},
    {x:-220,y:40}, {x:-180,y:-20}, {x:-160,y:-60},
    {x:-120,y:-20}, {x:-80,y:40}, {x:-40,y:0},
    {x:0,y:-40}, {x:40,y:-80},
    {x:80,y:-40}, {x:60,y:0}, {x:40,y:-20},
    {x:80,y:-60}, {x:120,y:-100},
    {x:160,y:-60}, {x:200,y:-60},
    {x:240,y:-20}, {x:280,y:40},
    {x:320,y:40}, {x:360,y:-20},
    {x:320,y:-60}, {x:280,y:-60},
    {x:240,y:-100}, {x:400,y:-100},
  ],
  closed: false, gravity: 50, spawnX: 0, spawnY: 200, padX: -40,
  turrets: [
    {x:-300,y:48,angle:U}, {x:-220,y:48,angle:U},
    {x:-80,y:48,angle:U}, {x:60,y:8,angle:U},
    {x:280,y:48,angle:U}, {x:320,y:48,angle:U},
  ],
  fuelDepots: [{x:-340,y:-52},{x:-160,y:-52},{x:40,y:-72},{x:160,y:-52}],
};

// L7: Two large structures - angular left + nested triangle right
const L7: LevelData = {
  name: 'ETA',
  terrain: [
    {x:-400,y:-120},
    {x:-360,y:-80}, {x:-320,y:0}, {x:-280,y:60},
    {x:-240,y:100}, {x:-200,y:60},
    {x:-240,y:20}, {x:-200,y:-20},
    {x:-160,y:-60}, {x:-120,y:-100},
    {x:-80,y:-60}, {x:-40,y:-120},
    {x:0,y:-100}, {x:40,y:-80},
    {x:80,y:-40}, {x:120,y:20}, {x:160,y:60},
    {x:200,y:100}, {x:240,y:60},
    {x:200,y:20}, {x:160,y:-20},
    {x:120,y:-60}, {x:160,y:-40}, {x:200,y:0},
    {x:240,y:-20}, {x:280,y:-60},
    {x:320,y:-100}, {x:360,y:-60},
    {x:400,y:-120},
  ],
  closed: false, gravity: 55, spawnX: 0, spawnY: 200, padX: 0,
  turrets: [
    {x:-280,y:68,angle:U}, {x:-200,y:68,angle:U},
    {x:-80,y:-52,angle:U}, {x:120,y:28,angle:U},
    {x:200,y:108,angle:U}, {x:280,y:-52,angle:U},
  ],
  fuelDepots: [{x:-320,y:8},{x:-120,y:-92},{x:80,y:-32},{x:240,y:68}],
};

// L8: Wide ceiling with complex jagged floor
const L8: LevelData = {
  name: 'THETA',
  terrain: [
    {x:-480,y:60},
    {x:-440,y:80}, {x:-360,y:80}, {x:-320,y:60},
    {x:-280,y:80}, {x:-200,y:100}, {x:-100,y:100},
    {x:0,y:100}, {x:100,y:100}, {x:200,y:100},
    {x:300,y:80}, {x:400,y:100}, {x:480,y:80},
    {x:480,y:-40},
    {x:440,y:-60}, {x:400,y:-40}, {x:360,y:-80},
    {x:320,y:-60}, {x:280,y:-40}, {x:240,y:-80},
    {x:200,y:-100}, {x:160,y:-60},
    {x:120,y:-80}, {x:80,y:-120},
    {x:40,y:-100}, {x:0,y:-60},
    {x:-40,y:-80}, {x:-80,y:-120},
    {x:-120,y:-80}, {x:-160,y:-60},
    {x:-200,y:-100}, {x:-240,y:-80},
    {x:-280,y:-40}, {x:-320,y:-60},
    {x:-360,y:-80}, {x:-400,y:-40},
    {x:-440,y:-60}, {x:-480,y:-40},
  ],
  closed: true, gravity: 50, spawnX: 0, spawnY: 200, padX: 0,
  turrets: [
    {x:-320,y:68,angle:-U}, {x:-200,y:-92,angle:U},
    {x:-80,y:-112,angle:U}, {x:80,y:-112,angle:U},
    {x:200,y:-92,angle:U}, {x:360,y:-72,angle:U},
  ],
  fuelDepots: [{x:-400,y:-32},{x:-40,y:-72},{x:160,y:-52},{x:400,y:-32}],
};

// L9: Symmetric reactor with diamond center. Open at top.
const L9: LevelData = {
  name: 'IOTA',
  terrain: [
    {x:-100,y:260},
    {x:-200,y:200}, {x:-280,y:160}, {x:-320,y:120},
    {x:-280,y:80}, {x:-220,y:60},
    {x:-280,y:0}, {x:-320,y:-40},
    {x:-280,y:-80}, {x:-220,y:-60},
    {x:-200,y:-120}, {x:-160,y:-160},
    {x:-120,y:-180}, {x:-80,y:-160},
    {x:-40,y:-180}, {x:0,y:-200},
    {x:40,y:-180}, {x:80,y:-160},
    {x:120,y:-180}, {x:160,y:-160},
    {x:200,y:-120},
    {x:220,y:-60}, {x:280,y:-80},
    {x:320,y:-40}, {x:280,y:0},
    {x:220,y:60}, {x:280,y:80},
    {x:320,y:120}, {x:280,y:160},
    {x:200,y:200},
    {x:100,y:260},
  ],
  closed: false, gravity: 60, spawnX: 0, spawnY: 320, padX: 0,
  turrets: [
    {x:-280,y:168,angle:U}, {x:-280,y:-72,angle:U},
    {x:-120,y:-172,angle:U}, {x:120,y:-172,angle:U},
    {x:280,y:-72,angle:U}, {x:280,y:168,angle:U},
  ],
  fuelDepots: [{x:-200,y:-112},{x:0,y:-192},{x:200,y:-112}],
};

// L10: Inverted funnels on flat base - pyramid arrangement
const L10: LevelData = {
  name: 'KAPPA',
  terrain: [
    {x:-500,y:-60}, {x:-500,y:-20},
    {x:-460,y:-20},
    {x:-420,y:40}, {x:-380,y:80}, {x:-340,y:40}, {x:-300,y:-20},
    {x:-260,y:-20},
    {x:-220,y:40}, {x:-180,y:80}, {x:-140,y:40}, {x:-100,y:-20},
    {x:-60,y:-20},
    {x:-20,y:40}, {x:0,y:100}, {x:20,y:140},
    {x:40,y:100}, {x:60,y:40}, {x:100,y:-20},
    {x:140,y:-20},
    {x:180,y:40}, {x:220,y:80}, {x:260,y:40}, {x:300,y:-20},
    {x:340,y:-20},
    {x:380,y:40}, {x:420,y:80}, {x:460,y:40},
    {x:500,y:-20}, {x:500,y:-60},
  ],
  closed: false, gravity: 45, spawnX: 0, spawnY: 260, padX: 0,
  turrets: [
    {x:-380,y:88,angle:U}, {x:-180,y:88,angle:U},
    {x:0,y:108,angle:U}, {x:20,y:148,angle:U},
    {x:220,y:88,angle:U}, {x:420,y:88,angle:U},
  ],
  fuelDepots: [{x:-300,y:-12},{x:-100,y:-12},{x:140,y:-12},{x:340,y:-12}],
};

// L11: Same cave as L1 (repeats in later universe with harder enemies)
const L11: LevelData = {
  ...L1, name: 'LAMBDA', gravity: 60,
  turrets: L1.turrets.map(t => ({...t})),
  fuelDepots: L1.fuelDepots.map(f => ({...f})),
  terrain: [...L1.terrain],
};

// L12: Rolling hills / zigzag landscape
const L12: LevelData = {
  name: 'REACTOR',
  terrain: [
    {x:-500,y:40},
    {x:-440,y:0}, {x:-400,y:-40},
    {x:-360,y:0}, {x:-320,y:40},
    {x:-280,y:0}, {x:-240,y:-40},
    {x:-200,y:-80}, {x:-160,y:-40},
    {x:-120,y:0}, {x:-80,y:-40},
    {x:-40,y:-80}, {x:0,y:-120},
    {x:40,y:-80}, {x:80,y:-40},
    {x:120,y:0}, {x:160,y:-40},
    {x:200,y:0}, {x:240,y:-40},
    {x:280,y:0}, {x:320,y:40},
    {x:360,y:0}, {x:400,y:-40},
    {x:440,y:0}, {x:500,y:40},
  ],
  closed: false, gravity: 55, spawnX: 0, spawnY: 200, padX: 0,
  turrets: [
    {x:-400,y:-32,angle:U}, {x:-240,y:-32,angle:U},
    {x:-80,y:-32,angle:U}, {x:0,y:-112,angle:U},
    {x:160,y:-32,angle:U}, {x:280,y:8,angle:U},
    {x:400,y:-32,angle:U},
  ],
  fuelDepots: [{x:-320,y:48},{x:-120,y:8},{x:120,y:8},{x:320,y:48}],
};

export const LEVELS: LevelData[] = [L1, L2, L3, L4, L5, L6, L7, L8, L9, L10, L11, L12];

/** Replace all levels with newly generated ones */
export function setLevels(levels: LevelData[]) {
  LEVELS.length = 0;
  LEVELS.push(...levels);
}
