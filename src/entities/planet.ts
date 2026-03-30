import { Vec2 } from '../math/vec2.js';
import { type Renderer } from '../render/renderer.js';

const ORBIT_SPEED_BASE = 0.15; // radians/sec

export interface PlanetDef {
  id: number;
  name: string;
  orbitRadius: number;
  orbitSpeed: number;
  color: string;
  radius: number;
  levelIndex: number;
  isReactor?: boolean;
}

export class Planet {
  pos = Vec2.zero();
  orbitAngle: number;
  cleared = false;
  readonly def: PlanetDef;

  constructor(def: PlanetDef, initialAngle: number) {
    this.def = def;
    this.orbitAngle = initialAngle;
    this.updatePosition();
  }

  update(dt: number) {
    this.orbitAngle += this.def.orbitSpeed * dt;
    this.updatePosition();
  }

  private updatePosition() {
    this.pos.set(
      Math.cos(this.orbitAngle) * this.def.orbitRadius,
      Math.sin(this.orbitAngle) * this.def.orbitRadius,
    );
  }

  render(renderer: Renderer) {
    if (this.cleared) return;

    const color = this.def.isReactor ? '#FF4444' : this.def.color;
    renderer.drawCircle(this.pos.x, this.pos.y, this.def.radius, color, 2);

    // Planet label
    const sx = renderer.sx(this.pos.x);
    const sy = renderer.sy(this.pos.y) + this.def.radius * renderer.camScale + 14;
    renderer.drawText(this.def.name, sx, sy, color, 10, 'center');
  }
}

// Default planet layout
export function createPlanets(): Planet[] {
  const defs: PlanetDef[] = [
    { id: 0, name: 'ALPHA', orbitRadius: 120, orbitSpeed: 0.20, color: '#00AAFF', radius: 12, levelIndex: 0 },
    { id: 1, name: 'BETA',  orbitRadius: 180, orbitSpeed: 0.15, color: '#00FF88', radius: 14, levelIndex: 1 },
    { id: 2, name: 'GAMMA', orbitRadius: 240, orbitSpeed: 0.12, color: '#FFAA00', radius: 11, levelIndex: 2 },
    { id: 3, name: 'DELTA', orbitRadius: 300, orbitSpeed: -0.10, color: '#AA44FF', radius: 13, levelIndex: 3 },
    { id: 4, name: 'EPSILON', orbitRadius: 160, orbitSpeed: -0.18, color: '#FF88FF', radius: 10, levelIndex: 4 },
    { id: 5, name: 'ZETA',  orbitRadius: 220, orbitSpeed: 0.14, color: '#88FF44', radius: 15, levelIndex: 5 },
    { id: 6, name: 'ETA',   orbitRadius: 280, orbitSpeed: -0.11, color: '#44FFAA', radius: 12, levelIndex: 6 },
    { id: 7, name: 'THETA', orbitRadius: 340, orbitSpeed: 0.08, color: '#FF4488', radius: 14, levelIndex: 7 },
    { id: 8, name: 'IOTA',  orbitRadius: 200, orbitSpeed: -0.16, color: '#88AAFF', radius: 11, levelIndex: 8 },
    { id: 9, name: 'KAPPA', orbitRadius: 260, orbitSpeed: 0.13, color: '#FFFF44', radius: 13, levelIndex: 9 },
    { id: 10, name: 'LAMBDA', orbitRadius: 320, orbitSpeed: -0.09, color: '#44FF44', radius: 12, levelIndex: 10 },
    { id: 11, name: 'REACTOR', orbitRadius: 140, orbitSpeed: 0.25, color: '#FF2222', radius: 16, levelIndex: 11, isReactor: true },
  ];

  return defs.map((def, i) => new Planet(def, (i / defs.length) * Math.PI * 2));
}
