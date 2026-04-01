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
  angle: number;
  alive: boolean;
  shielded: boolean;
  thrusting: boolean;
  bullets: { x: number; y: number }[];
  scene: string; // 'solar' or level name
}

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

  constructor(color = '#FF6644') {
    this.color = color;
  }

  applyState(s: RivalState) {
    this.pos.set(s.x, s.y);
    this.angle = s.angle;
    this.alive = s.alive;
    this.shielded = s.shielded;
    this.thrusting = s.thrusting;
    this.scene = s.scene;
    this.bullets = s.bullets.map(b => new Vec2(b.x, b.y));
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
