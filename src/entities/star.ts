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
    const ctx = renderer.ctx;
    const sx = renderer.sx(this.pos.x);
    const sy = renderer.sy(this.pos.y);
    const scale = renderer.camScale;
    const pulse = STAR_RADIUS + Math.sin(this.pulsePhase) * 3;
    const r = pulse * scale;

    // Outer glow
    const outerR = r + 12 * scale;
    const glow = ctx.createRadialGradient(sx, sy, 0, sx, sy, outerR);
    glow.addColorStop(0, 'rgba(255, 255, 100, 0.9)');
    glow.addColorStop(0.35, 'rgba(255, 180, 50, 0.6)');
    glow.addColorStop(0.7, 'rgba(255, 120, 20, 0.15)');
    glow.addColorStop(1, 'rgba(255, 80, 0, 0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(sx, sy, outerR, 0, Math.PI * 2);
    ctx.fill();

    // Bright core
    const coreR = r * 0.45;
    const core = ctx.createRadialGradient(sx, sy, 0, sx, sy, coreR);
    core.addColorStop(0, '#FFFFEE');
    core.addColorStop(0.6, '#FFFF88');
    core.addColorStop(1, '#FFDD44');
    ctx.fillStyle = core;
    ctx.beginPath();
    ctx.arc(sx, sy, coreR, 0, Math.PI * 2);
    ctx.fill();
  }
}
