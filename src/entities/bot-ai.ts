import { Vec2 } from '../math/vec2.js';
import { type Segment, pointToSegmentDist, hasLineOfSight } from '../math/collision.js';
import { type Ship, type Bullet } from '../entities/ship.js';
import { type Turret } from '../entities/turret.js';
import { settings } from '../core/settings.js';

/** Virtual input state produced by the bot */
export interface BotInput {
  left: boolean;
  right: boolean;
  thrust: boolean;
  fire: boolean;
  shield: boolean;
}

const WALL_AVOID_DIST = 60;
const FIRE_AIM_TOLERANCE = 0.15; // radians

/**
 * Simple bot AI for planet levels.
 * Behavior: seek and destroy turrets, avoid terrain, collect fuel.
 */
export class BotAI {
  private target: Vec2 | null = null;
  private fireTimer = 0;

  update(
    dt: number,
    ship: Ship,
    turrets: { pos: Vec2; alive: boolean }[],
    terrain: Segment[],
    exitY: number,
  ): BotInput {
    const input: BotInput = { left: false, right: false, thrust: false, fire: false, shield: false };

    if (!ship.alive) return input;

    this.fireTimer -= dt;

    // Find nearest alive turret
    let nearestTurret: { pos: Vec2; alive: boolean } | null = null;
    let nearestDist = Infinity;
    for (const t of turrets) {
      if (!t.alive) continue;
      const d = ship.pos.distanceTo(t.pos);
      if (d < nearestDist) {
        nearestDist = d;
        nearestTurret = t;
      }
    }

    // Pick target: nearest turret, or exit if all dead
    if (nearestTurret) {
      this.target = nearestTurret.pos;
    } else {
      // All turrets dead - head for exit
      this.target = new Vec2(0, exitY + 50);
    }

    // Compute desired angle to target
    const toTarget = this.target.sub(ship.pos);
    const desiredAngle = Math.atan2(toTarget.y, toTarget.x);

    // Terrain avoidance: check nearby walls
    let avoidX = 0, avoidY = 0;
    for (const seg of terrain) {
      const dist = pointToSegmentDist(ship.pos.x, ship.pos.y, seg);
      if (dist < WALL_AVOID_DIST) {
        // Push away from this segment
        const mx = (seg.x1 + seg.x2) / 2;
        const my = (seg.y1 + seg.y2) / 2;
        const awayX = ship.pos.x - mx;
        const awayY = ship.pos.y - my;
        const awayLen = Math.sqrt(awayX * awayX + awayY * awayY) || 1;
        const strength = (WALL_AVOID_DIST - dist) / WALL_AVOID_DIST;
        avoidX += (awayX / awayLen) * strength;
        avoidY += (awayY / awayLen) * strength;
      }
    }

    // Blend target direction with avoidance
    let steerAngle = desiredAngle;
    const avoidLen = Math.sqrt(avoidX * avoidX + avoidY * avoidY);
    if (avoidLen > 0.3) {
      const avoidAngle = Math.atan2(avoidY, avoidX);
      // Weight avoidance more when close to walls
      const blend = Math.min(avoidLen * 2, 0.8);
      steerAngle = lerpAngle(desiredAngle, avoidAngle, blend);
    }

    // Steer toward target angle
    let angleDiff = normalizeAngle(steerAngle - ship.angle);
    if (angleDiff > 0.05) input.left = true;
    if (angleDiff < -0.05) input.right = true;

    // Thrust toward target (when roughly aimed)
    if (Math.abs(angleDiff) < 1.2) {
      input.thrust = true;
    }

    // Brake if going too fast
    if (ship.vel.length() > settings.maxSpeed * 0.7) {
      input.thrust = false;
    }

    // Fire at turrets when aimed
    if (nearestTurret && nearestDist < settings.turretAimRange * 1.2) {
      const aimAngle = ship.pos.angleTo(nearestTurret.pos);
      const aimDiff = Math.abs(normalizeAngle(aimAngle - ship.angle));
      if (aimDiff < FIRE_AIM_TOLERANCE && this.fireTimer <= 0) {
        input.fire = true;
        this.fireTimer = settings.fireCooldown + 0.05;
      }
    }

    // Shield when turret bullets are nearby
    for (const t of turrets) {
      if (!t.alive) continue;
      for (const b of (t as any).bullets || []) {
        if (b.pos && ship.pos.distanceTo(b.pos) < 40) {
          input.shield = true;
          break;
        }
      }
      if (input.shield) break;
    }

    return input;
  }
}

function normalizeAngle(a: number): number {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}

function lerpAngle(a: number, b: number, t: number): number {
  let diff = normalizeAngle(b - a);
  return a + diff * t;
}
