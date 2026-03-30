import { Vec2 } from '../math/vec2.js';
import { type Renderer } from '../render/renderer.js';
import { Colors } from '../render/colors.js';
import { settings } from '../core/settings.js';

const STAR_POINTS = 12;
const STAR_RADIUS = 25;
const KILL_RADIUS = 30;

export class Star {
  pos: Vec2;
  readonly killRadius = KILL_RADIUS;
  private pulsePhase = 0;

  constructor(x: number, y: number) {
    this.pos = new Vec2(x, y);
  }

  update(dt: number) {
    this.pulsePhase += dt * 2;
  }

  getGravityAccel(targetPos: Vec2): Vec2 {
    const diff = this.pos.sub(targetPos);
    const distSq = diff.lengthSq();
    if (distSq < 100) return Vec2.zero();
    const dist = Math.sqrt(distSq);
    return diff.normalize().scale(settings.starGravity / distSq * dist);
  }

  render(renderer: Renderer) {
    const r = STAR_RADIUS + Math.sin(this.pulsePhase) * 3;
    // Draw as a spiky star shape
    const points: { x: number; y: number }[] = [];
    for (let i = 0; i < STAR_POINTS * 2; i++) {
      const angle = (i / (STAR_POINTS * 2)) * Math.PI * 2;
      const radius = i % 2 === 0 ? r : r * 0.5;
      points.push({
        x: this.pos.x + Math.cos(angle) * radius,
        y: this.pos.y + Math.sin(angle) * radius,
      });
    }
    renderer.drawPolygon(points, Colors.star, true, 2);
  }
}
