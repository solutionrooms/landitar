import { Vec2 } from '../math/vec2.js';
import { type Segment, transformSegments } from '../math/collision.js';
import { type Renderer } from '../render/renderer.js';
import { Colors } from '../render/colors.js';

const ROTATE_SPEED = 4.0;      // radians/sec
const THRUST_POWER = 200;       // units/sec^2
const MAX_SPEED = 400;
const FIRE_COOLDOWN = 0.15;     // seconds
const BULLET_SPEED = 500;
const BULLET_LIFETIME = 1.2;    // seconds
const SHIP_RADIUS = 8;
const FUEL_THRUST_RATE = 8;     // fuel per second while thrusting
const FUEL_SHIELD_RATE = 20;    // fuel per second while shielding

// Ship shape: triangle pointing right (angle=0)
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
  angle = -Math.PI / 2; // pointing up
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

    // Rotate
    if (input.left) this.angle += ROTATE_SPEED * dt;
    if (input.right) this.angle -= ROTATE_SPEED * dt;

    // Shield
    this.shielded = input.shield && fuel > 0;
    if (this.shielded) {
      fuelUsed += FUEL_SHIELD_RATE * dt;
    }

    // Thrust
    this.thrusting = input.thrust && fuel > 0;
    if (this.thrusting) {
      const thrustVec = Vec2.fromAngle(this.angle, THRUST_POWER * dt);
      this.vel.addMut(thrustVec);
      fuelUsed += FUEL_THRUST_RATE * dt;
    }

    // Clamp speed
    if (this.vel.length() > MAX_SPEED) {
      this.vel = this.vel.normalize().scale(MAX_SPEED);
    }

    // Move
    this.pos.addMut(this.vel.scale(dt));

    // Fire
    this.fireCooldown -= dt;
    if (input.fire && this.fireCooldown <= 0 && !this.shielded) {
      this.fireCooldown = FIRE_COOLDOWN;
      const dir = Vec2.fromAngle(this.angle, BULLET_SPEED);
      this.bullets.push({
        pos: this.pos.add(Vec2.fromAngle(this.angle, 12)),
        vel: dir.add(this.vel),
        life: BULLET_LIFETIME,
      });
    }

    // Update bullets
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

    // Ship body
    const segs = this.getSegments();
    renderer.drawSegments(segs, this.shielded ? Colors.shield : Colors.ship);

    // Shield circle
    if (this.shielded) {
      renderer.drawCircle(this.pos.x, this.pos.y, 14, Colors.shield, 1);
    }

    // Thrust flame
    if (this.thrusting) {
      const flame = transformSegments(THRUST_SHAPE, this.pos.x, this.pos.y, this.angle);
      renderer.drawSegments(flame, Colors.shipThrust, 2);
    }

    // Bullets
    for (const b of this.bullets) {
      renderer.drawCircle(b.pos.x, b.pos.y, 1.5, Colors.bullet, 2);
    }
  }
}
