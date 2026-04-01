import { Vec2 } from '../math/vec2.js';
import { type Segment, transformSegments } from '../math/collision.js';
import { type Renderer } from '../render/renderer.js';

const SHIP_SHAPE: Segment[] = [
  { x1: 10, y1: 0, x2: -6, y2: 6 },
  { x1: -6, y1: 6, x2: -3, y2: 0 },
  { x1: -3, y1: 0, x2: -6, y2: -6 },
  { x1: -6, y1: -6, x2: 10, y2: 0 },
];

const THRUST_SHAPE: Segment[] = [
  { x1: -5, y1: 3, x2: -12, y2: 0 },
  { x1: -12, y1: 0, x2: -5, y2: -3 },
];

export interface RivalState {
  x: number;
  y: number;
  vx?: number;
  vy?: number;
  angle: number;
  alive: boolean;
  shielded: boolean;
  thrusting: boolean;
  bullets: { x: number; y: number }[];
  scene: string; // 'solar' or level name
}

const LERP_SPEED = 12; // interpolation rate (higher = snappier)

export class RivalShip {
  pos = Vec2.zero();
  angle = 0;
  alive = true;
  shielded = false;
  thrusting = false;
  bullets: Vec2[] = [];
  scene = '';
  readonly radius = 8;
  readonly color: string;

  // Interpolation state
  private targetPos = Vec2.zero();
  private vel = Vec2.zero();
  private targetAngle = 0;
  private lastUpdateTime = 0;

  constructor(color = '#FF6644') {
    this.color = color;
  }

  applyState(s: RivalState) {
    this.targetPos.set(s.x, s.y);
    this.vel.set(s.vx ?? 0, s.vy ?? 0);
    this.targetAngle = s.angle;
    this.alive = s.alive;
    this.shielded = s.shielded;
    this.thrusting = s.thrusting;
    this.scene = s.scene;
    this.bullets = s.bullets.map(b => new Vec2(b.x, b.y));
    this.lastUpdateTime = performance.now();

    // If first state or scene changed, snap immediately
    if (this.pos.x === 0 && this.pos.y === 0) {
      this.pos.set(s.x, s.y);
      this.angle = s.angle;
    }
  }

  /** Call each frame to smoothly interpolate toward the latest network state */
  interpolate(dt: number) {
    if (!this.alive) return;

    // Extrapolate target using velocity and time since last update
    const elapsed = (performance.now() - this.lastUpdateTime) / 1000;
    const predX = this.targetPos.x + this.vel.x * elapsed;
    const predY = this.targetPos.y + this.vel.y * elapsed;

    // Lerp position toward predicted target
    const t = Math.min(1, LERP_SPEED * dt);
    this.pos.x += (predX - this.pos.x) * t;
    this.pos.y += (predY - this.pos.y) * t;

    // Lerp angle (handle wrapping)
    let angleDiff = this.targetAngle - this.angle;
    if (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
    if (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
    this.angle += angleDiff * t;

    // Snap if too far away (teleport/scene change)
    const dx = predX - this.pos.x, dy = predY - this.pos.y;
    if (dx * dx + dy * dy > 200 * 200) {
      this.pos.set(predX, predY);
      this.angle = this.targetAngle;
    }
  }

  render(renderer: Renderer) {
    if (!this.alive) return;

    const segs = transformSegments(SHIP_SHAPE, this.pos.x, this.pos.y, this.angle);
    renderer.drawSegments(segs, this.shielded ? '#FF8844' : this.color, 2);

    if (this.shielded) {
      renderer.drawCircle(this.pos.x, this.pos.y, 14, '#FF884488', 1);
    }

    if (this.thrusting) {
      renderer.drawSegments(
        transformSegments(THRUST_SHAPE, this.pos.x, this.pos.y, this.angle),
        '#FF8800', 2,
      );
    }

    for (const b of this.bullets) {
      renderer.drawCircle(b.x, b.y, 1.5, '#FF8844', 2);
    }

    // Name tag
    const sx = renderer.sx(this.pos.x);
    const sy = renderer.sy(this.pos.y) - 16 * renderer.camScale;
    renderer.drawText('OPP', sx, sy, this.color, 8, 'center');
  }
}
