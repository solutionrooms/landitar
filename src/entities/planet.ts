import { Vec2 } from '../math/vec2.js';
import { type Renderer } from '../render/renderer.js';

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

export interface PlanetSavedState {
  turretsAlive: boolean[];
  depotsAlive: boolean[];
  cleared: boolean;
}

// Score value per planet (higher for harder planets)
function planetScore(id: number): number {
  return 3000 + id * 750;
}

export class Planet {
  pos = Vec2.zero();
  orbitAngle: number;
  cleared = false;
  explosivesPlanted = false;
  savedState?: PlanetSavedState;
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

    const { x, y } = this.pos;
    const r = this.def.radius;
    const color = this.def.isReactor ? '#FF4444' : this.def.color;
    const style = this.def.id % 12;

    // Each planet gets a unique vector art style
    switch (style) {
      case 0: // Crosshair with arrows
        renderer.drawCircle(x, y, r, color, 2);
        renderer.drawLine(x - r * 1.6, y, x + r * 1.6, y, color, 1.5);
        renderer.drawLine(x, y - r * 1.6, x, y + r * 1.6, color, 1.5);
        renderer.drawFilledCircle(x, y, 2, color);
        break;

      case 1: // Hexagon with inner dot
        this.drawNgon(renderer, x, y, r, 6, 0, color);
        renderer.drawFilledCircle(x, y, 3, color);
        break;

      case 2: // Circle with 6 radiating rays
        renderer.drawCircle(x, y, r * 0.7, color, 2);
        for (let i = 0; i < 6; i++) {
          const a = (i / 6) * Math.PI * 2;
          renderer.drawLine(
            x + Math.cos(a) * r * 0.5, y + Math.sin(a) * r * 0.5,
            x + Math.cos(a) * r * 1.6, y + Math.sin(a) * r * 1.6,
            color, 1.5,
          );
        }
        break;

      case 3: // Diamond with inner cross
        this.drawNgon(renderer, x, y, r, 4, Math.PI / 4, color);
        renderer.drawLine(x - r * 0.5, y, x + r * 0.5, y, color, 1);
        renderer.drawLine(x, y - r * 0.5, x, y + r * 0.5, color, 1);
        break;

      case 4: // Saturn ring
        renderer.drawCircle(x, y, r * 0.8, color, 2);
        renderer.ctx.save();
        renderer.ctx.strokeStyle = color;
        renderer.ctx.lineWidth = 1.5;
        renderer.ctx.beginPath();
        renderer.ctx.ellipse(
          renderer.sx(x), renderer.sy(y),
          r * 1.8 * renderer.camScale, r * 0.5 * renderer.camScale,
          0, 0, Math.PI * 2,
        );
        renderer.ctx.stroke();
        renderer.ctx.restore();
        break;

      case 5: // Double circle
        renderer.drawCircle(x, y, r, color, 2);
        renderer.drawCircle(x, y, r * 0.5, color, 1.5);
        break;

      case 6: // Starburst (8 spikes, no circle)
        for (let i = 0; i < 8; i++) {
          const a = (i / 8) * Math.PI * 2;
          const inner = r * 0.3;
          const outer = i % 2 === 0 ? r * 1.4 : r * 1.0;
          renderer.drawLine(
            x + Math.cos(a) * inner, y + Math.sin(a) * inner,
            x + Math.cos(a) * outer, y + Math.sin(a) * outer,
            color, 2,
          );
        }
        renderer.drawCircle(x, y, r * 0.3, color, 1.5);
        break;

      case 7: // Circle with X
        renderer.drawCircle(x, y, r, color, 2);
        renderer.drawLine(x - r, y - r, x + r, y + r, color, 1.5);
        renderer.drawLine(x - r, y + r, x + r, y - r, color, 1.5);
        break;

      case 8: // Triangle
        this.drawNgon(renderer, x, y, r, 3, -Math.PI / 2, color);
        renderer.drawFilledCircle(x, y, 2, color);
        break;

      case 9: // Circle with compass points
        renderer.drawCircle(x, y, r, color, 2);
        for (let i = 0; i < 4; i++) {
          const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
          renderer.drawLine(
            x + Math.cos(a) * r, y + Math.sin(a) * r,
            x + Math.cos(a) * r * 1.5, y + Math.sin(a) * r * 1.5,
            color, 2,
          );
        }
        break;

      case 10: // Pentagon with inner star
        this.drawNgon(renderer, x, y, r, 5, -Math.PI / 2, color);
        this.drawNgon(renderer, x, y, r * 0.5, 5, Math.PI / 2, color);
        break;

      case 11: // REACTOR - pulsing circle with many spikes
        {
          const pulse = 1 + Math.sin(Date.now() * 0.005) * 0.15;
          const rr = r * pulse;
          renderer.drawCircle(x, y, rr * 0.6, color, 2);
          renderer.drawCircle(x, y, rr, color, 1);
          for (let i = 0; i < 10; i++) {
            const a = (i / 10) * Math.PI * 2;
            renderer.drawLine(
              x + Math.cos(a) * rr * 0.7, y + Math.sin(a) * rr * 0.7,
              x + Math.cos(a) * rr * 1.6, y + Math.sin(a) * rr * 1.6,
              color, 2,
            );
          }
        }
        break;
    }

    // Label: name + score
    const sx = renderer.sx(x);
    const sy = renderer.sy(y) + r * renderer.camScale + 14;
    renderer.drawText(this.def.name, sx, sy, color, 10, 'center');
    renderer.drawText(String(planetScore(this.def.id)), sx, sy + 12, color, 8, 'center');
  }

  private drawNgon(renderer: Renderer, cx: number, cy: number, r: number, sides: number, startAngle: number, color: string) {
    const pts: { x: number; y: number }[] = [];
    for (let i = 0; i < sides; i++) {
      const a = startAngle + (i / sides) * Math.PI * 2;
      pts.push({ x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r });
    }
    renderer.drawPolygon(pts, color, true, 2);
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
