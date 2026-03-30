import { Vec2 } from '../math/vec2.js';
import { type Segment, transformSegments } from '../math/collision.js';
import { type Renderer } from '../render/renderer.js';
import { Colors } from '../render/colors.js';
import { settings } from '../core/settings.js';

const TURRET_RADIUS = 8;
const BULLET_LIFETIME = 2.0;
const SCORE_VALUE = 250;

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
  angle: number;
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
    this.fireTimer = Math.random() * settings.turretFireRate;
  }

  update(dt: number, playerPos: Vec2) {
    for (const b of this.bullets) {
      b.pos.addMut(b.vel.scale(dt));
      b.life -= dt;
    }
    this.bullets = this.bullets.filter(b => b.life > 0);

    if (!this.alive) return;

    const dist = this.pos.distanceTo(playerPos);
    if (dist > settings.turretAimRange) return;

    this.fireTimer -= dt;
    if (this.fireTimer <= 0) {
      this.fireTimer = settings.turretFireRate;
      const aimAngle = this.pos.angleTo(playerPos);
      this.bullets.push({
        pos: this.pos.add(Vec2.fromAngle(aimAngle, 10)),
        vel: Vec2.fromAngle(aimAngle, settings.turretBulletSpeed),
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
