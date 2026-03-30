import { Vec2 } from '../math/vec2.js';
import { type Segment, transformSegments } from '../math/collision.js';
import { type Renderer } from '../render/renderer.js';
import { Colors } from '../render/colors.js';

const TURRET_RADIUS = 8;
const FIRE_RATE = 1.5;       // seconds between shots
const BULLET_SPEED = 250;
const BULLET_LIFETIME = 2.0;
const AIM_RANGE = 400;
const SCORE_VALUE = 250;

// Turret shape: bunker-like
const TURRET_SHAPE: Segment[] = [
  { x1: -6, y1: 0, x2: -3, y2: 6 },
  { x1: -3, y1: 6, x2: 3, y2: 6 },
  { x1: 3, y1: 6, x2: 6, y2: 0 },
  { x1: 6, y1: 0, x2: -6, y2: 0 },
];

export interface TurretBullet {
  pos: Vec2;
  vel: Vec2;
  life: number;
}

export interface TurretDef {
  x: number;
  y: number;
  angle: number; // mount angle (perpendicular to terrain)
}

export class Turret {
  pos: Vec2;
  mountAngle: number;
  alive = true;
  fireTimer: number;
  bullets: TurretBullet[] = [];
  readonly radius = TURRET_RADIUS;
  readonly scoreValue = SCORE_VALUE;

  constructor(def: TurretDef) {
    this.pos = new Vec2(def.x, def.y);
    this.mountAngle = def.angle;
    this.fireTimer = Math.random() * FIRE_RATE;
  }

  update(dt: number, playerPos: Vec2) {
    // Update bullets
    for (const b of this.bullets) {
      b.pos.addMut(b.vel.scale(dt));
      b.life -= dt;
    }
    this.bullets = this.bullets.filter(b => b.life > 0);

    if (!this.alive) return;

    // Fire at player if in range
    const dist = this.pos.distanceTo(playerPos);
    if (dist > AIM_RANGE) return;

    this.fireTimer -= dt;
    if (this.fireTimer <= 0) {
      this.fireTimer = FIRE_RATE;
      const aimAngle = this.pos.angleTo(playerPos);
      const vel = Vec2.fromAngle(aimAngle, BULLET_SPEED);
      this.bullets.push({
        pos: this.pos.add(Vec2.fromAngle(aimAngle, 10)),
        vel,
        life: BULLET_LIFETIME,
      });
    }
  }

  getSegments(): Segment[] {
    return transformSegments(TURRET_SHAPE, this.pos.x, this.pos.y, this.mountAngle);
  }

  render(renderer: Renderer) {
    if (this.alive) {
      renderer.drawSegments(this.getSegments(), Colors.turret, 2);
    }

    for (const b of this.bullets) {
      renderer.drawCircle(b.pos.x, b.pos.y, 1.5, Colors.turretBullet, 2);
    }
  }
}
