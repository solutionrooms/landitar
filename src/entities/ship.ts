import { Vec2 } from '../math/vec2.js';
import { type Segment, transformSegments } from '../math/collision.js';
import { type Renderer } from '../render/renderer.js';
import { Colors } from '../render/colors.js';
import { settings } from '../core/settings.js';

const BULLET_LIFETIME = 1.2;
const SHIP_RADIUS = 8;

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

export interface Bullet {
  pos: Vec2;
  vel: Vec2;
  life: number;
}

export class Ship {
  pos: Vec2;
  vel = Vec2.zero();
  angle = -Math.PI / 2;
  alive = true;
  shielded = false;
  fireCooldown = 0;
  bullets: Bullet[] = [];
  thrusting = false;
  respawnTimer = 0;
  readonly radius = SHIP_RADIUS;

  constructor(x: number, y: number) {
    this.pos = new Vec2(x, y);
  }

  update(dt: number, input: { left: boolean; right: boolean; thrust: boolean; fire: boolean; shield: boolean }, fuel: number): number {
    let fuelUsed = 0;

    if (!this.alive) {
      this.respawnTimer -= dt;
      this.bullets = this.bullets.filter(b => { b.life -= dt; b.pos.addMut(b.vel.scale(dt)); return b.life > 0; });
      return 0;
    }

    if (input.left) this.angle += settings.rotateSpeed * dt;
    if (input.right) this.angle -= settings.rotateSpeed * dt;

    this.shielded = input.shield && fuel > 0;
    if (this.shielded) fuelUsed += settings.fuelShieldRate * dt;

    this.thrusting = input.thrust && fuel > 0;
    if (this.thrusting) {
      this.vel.addMut(Vec2.fromAngle(this.angle, settings.thrustPower * dt));
      fuelUsed += settings.fuelThrustRate * dt;
    }

    if (this.vel.length() > settings.maxSpeed) {
      this.vel = this.vel.normalize().scale(settings.maxSpeed);
    }

    this.pos.addMut(this.vel.scale(dt));

    this.fireCooldown -= dt;
    if (input.fire && this.fireCooldown <= 0 && !this.shielded) {
      this.fireCooldown = settings.fireCooldown;
      this.bullets.push({
        pos: this.pos.add(Vec2.fromAngle(this.angle, 12)),
        vel: Vec2.fromAngle(this.angle, settings.bulletSpeed).add(this.vel),
        life: BULLET_LIFETIME,
      });
    }

    for (const b of this.bullets) {
      b.pos.addMut(b.vel.scale(dt));
      b.life -= dt;
    }
    this.bullets = this.bullets.filter(b => b.life > 0);

    return fuelUsed;
  }

  getSegments(): Segment[] {
    return transformSegments(SHIP_SHAPE, this.pos.x, this.pos.y, this.angle);
  }

  kill() {
    this.alive = false;
    this.respawnTimer = 2.0;
  }

  render(renderer: Renderer) {
    if (!this.alive) return;
    renderer.drawSegments(this.getSegments(), this.shielded ? Colors.shield : Colors.ship);
    if (this.shielded) renderer.drawCircle(this.pos.x, this.pos.y, 14, Colors.shield, 1);
    if (this.thrusting) {
      renderer.drawSegments(transformSegments(THRUST_SHAPE, this.pos.x, this.pos.y, this.angle), Colors.shipThrust, 2);
    }
    for (const b of this.bullets) {
      renderer.drawCircle(b.pos.x, b.pos.y, 1.5, Colors.bullet, 2);
    }
  }
}
