import { type TurretDef } from '../entities/turret.js';
import { type FuelDepotDef } from '../entities/fuel-depot.js';

export interface LevelData {
  name: string;
  terrain: { x: number; y: number }[];
  closed: boolean;
  gravity: number;           // downward acceleration
  spawnX: number;
  spawnY: number;
  turrets: TurretDef[];
  fuelDepots: FuelDepotDef[];
}

// Hand-authored levels (will be replaced with ROM-extracted data later)
export const LEVELS: LevelData[] = [
  // Level 0: Wide open valley
  {
    name: 'ALPHA',
    terrain: [
      { x: -400, y: 300 }, { x: -400, y: 0 }, { x: -350, y: -20 },
      { x: -250, y: -50 }, { x: -150, y: -30 }, { x: -50, y: -80 },
      { x: 0, y: -60 }, { x: 80, y: -100 }, { x: 150, y: -70 },
      { x: 250, y: -40 }, { x: 350, y: -60 }, { x: 400, y: 0 },
      { x: 400, y: 300 },
    ],
    closed: false,
    gravity: 50,
    spawnX: 0, spawnY: 250,
    turrets: [
      { x: -200, y: -42, angle: Math.PI / 2 },
      { x: 100, y: -92, angle: Math.PI / 2 },
      { x: 300, y: -52, angle: Math.PI / 2 },
    ],
    fuelDepots: [
      { x: -100, y: -22 },
      { x: 200, y: -32 },
    ],
  },
  // Level 1: Narrow canyon
  {
    name: 'BETA',
    terrain: [
      { x: -300, y: 300 }, { x: -300, y: 50 }, { x: -250, y: 20 },
      { x: -200, y: -30 }, { x: -150, y: -60 }, { x: -100, y: -100 },
      { x: -50, y: -130 }, { x: 0, y: -150 }, { x: 50, y: -130 },
      { x: 100, y: -100 }, { x: 150, y: -60 }, { x: 200, y: -30 },
      { x: 250, y: 20 }, { x: 300, y: 50 }, { x: 300, y: 300 },
    ],
    closed: false,
    gravity: 60,
    spawnX: 0, spawnY: 250,
    turrets: [
      { x: -150, y: -52, angle: Math.PI * 0.6 },
      { x: 0, y: -142, angle: Math.PI / 2 },
      { x: 150, y: -52, angle: Math.PI * 0.4 },
    ],
    fuelDepots: [
      { x: -50, y: -122 },
    ],
  },
  // Level 2: Cave with overhangs
  {
    name: 'GAMMA',
    terrain: [
      { x: -350, y: 300 }, { x: -350, y: 100 }, { x: -300, y: 60 },
      { x: -200, y: 30 }, { x: -150, y: -10 }, { x: -100, y: -40 },
      { x: -50, y: -20 }, { x: 0, y: -60 }, { x: 50, y: -40 },
      { x: 100, y: -80 }, { x: 150, y: -50 }, { x: 200, y: -20 },
      { x: 250, y: 10 }, { x: 300, y: 50 }, { x: 350, y: 80 },
      { x: 350, y: 300 },
    ],
    closed: false,
    gravity: 55,
    spawnX: 0, spawnY: 250,
    turrets: [
      { x: -100, y: -32, angle: Math.PI / 2 },
      { x: 50, y: -32, angle: Math.PI / 2 },
      { x: 200, y: -12, angle: Math.PI / 2 },
      { x: -200, y: 38, angle: Math.PI / 2 },
    ],
    fuelDepots: [
      { x: -50, y: -12 },
      { x: 150, y: -42 },
    ],
  },
  // Level 3: Zigzag passage
  {
    name: 'DELTA',
    terrain: [
      { x: -400, y: 300 }, { x: -400, y: 50 }, { x: -350, y: 0 },
      { x: -280, y: -40 }, { x: -200, y: -80 }, { x: -120, y: -30 },
      { x: -60, y: -90 }, { x: 0, y: -50 }, { x: 60, y: -120 },
      { x: 120, y: -70 }, { x: 200, y: -110 }, { x: 280, y: -60 },
      { x: 350, y: -20 }, { x: 400, y: 30 }, { x: 400, y: 300 },
    ],
    closed: false,
    gravity: 65,
    spawnX: 0, spawnY: 250,
    turrets: [
      { x: -200, y: -72, angle: Math.PI / 2 },
      { x: -60, y: -82, angle: Math.PI / 2 },
      { x: 60, y: -112, angle: Math.PI / 2 },
      { x: 200, y: -102, angle: Math.PI / 2 },
    ],
    fuelDepots: [
      { x: -120, y: -22 },
      { x: 120, y: -62 },
    ],
  },
  // Level 4-11: Additional levels
  ...Array.from({ length: 8 }, (_, i) => ({
    name: ['EPSILON', 'ZETA', 'ETA', 'THETA', 'IOTA', 'KAPPA', 'LAMBDA', 'REACTOR'][i],
    terrain: generateTerrain(i + 4),
    closed: false,
    gravity: 50 + (i + 4) * 5,
    spawnX: 0, spawnY: 250,
    turrets: generateTurrets(i + 4),
    fuelDepots: generateFuelDepots(i + 4),
  })),
];

function generateTerrain(seed: number): { x: number; y: number }[] {
  const points: { x: number; y: number }[] = [];
  const width = 350 + seed * 10;
  points.push({ x: -width, y: 300 });
  points.push({ x: -width, y: 50 });

  const segments = 10 + seed;
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const x = -width + 30 + t * (width * 2 - 60);
    const y = -30 - Math.sin(t * Math.PI * (2 + seed * 0.3)) * 60 - seed * 5;
    points.push({ x, y });
  }

  points.push({ x: width, y: 50 });
  points.push({ x: width, y: 300 });
  return points;
}

function generateTurrets(seed: number): TurretDef[] {
  const count = 3 + Math.floor(seed / 3);
  return Array.from({ length: count }, (_, i) => ({
    x: -200 + (i / (count - 1)) * 400,
    y: -40 - Math.sin((i + seed) * 1.5) * 50,
    angle: Math.PI / 2,
  }));
}

function generateFuelDepots(seed: number): FuelDepotDef[] {
  return [
    { x: -100 + seed * 15, y: -20 - seed * 3 },
    { x: 100 - seed * 10, y: -30 - seed * 4 },
  ];
}
