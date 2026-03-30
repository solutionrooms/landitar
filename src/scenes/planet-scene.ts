import { type Scene, type SceneContext } from './scene.js';
import { type Renderer } from '../render/renderer.js';
import { Ship, type Bullet } from '../entities/ship.js';
import { Turret } from '../entities/turret.js';
import { FuelDepot } from '../entities/fuel-depot.js';
import { Explosion } from '../entities/explosion.js';
import { Terrain } from '../levels/terrain.js';
import { LEVELS } from '../levels/level-data.js';
import { type Planet } from '../entities/planet.js';
import { circleVsSegments, segmentIntersection, type Segment } from '../math/collision.js';
import { renderHud } from '../render/hud.js';
import { Colors } from '../render/colors.js';
import { GameOverScene } from './game-over-scene.js';

const EXIT_Y = 280;        // Y threshold to exit planet
const TRACTOR_RANGE = 35;  // range for tractor beam pickup

export class PlanetScene implements Scene {
  private ship!: Ship;
  private terrain!: Terrain;
  private turrets: Turret[] = [];
  private fuelDepots: FuelDepot[] = [];
  private explosions: Explosion[] = [];
  private gravity = 50;
  private ctx!: SceneContext;
  private levelIndex: number;
  private planet: Planet | null;
  private levelName = '';

  constructor(levelIndex: number, planet: Planet | null = null) {
    this.levelIndex = levelIndex;
    this.planet = planet;
  }

  enter(ctx: SceneContext) {
    this.ctx = ctx;
    const level = LEVELS[this.levelIndex % LEVELS.length];
    this.levelName = level.name;

    this.terrain = new Terrain(level.terrain, level.closed);
    this.gravity = level.gravity;

    this.ship = new Ship(level.spawnX, level.spawnY);
    this.ship.angle = Math.PI / 2; // pointing up

    this.turrets = level.turrets.map(def => new Turret(def));
    this.fuelDepots = level.fuelDepots.map(def => new FuelDepot(def));
    this.explosions = [];
  }

  exit() {}

  update(dt: number, ctx: SceneContext) {
    const { input, state } = ctx;

    if (state.fuel <= 0) {
      ctx.replaceScene(new GameOverScene());
      return;
    }

    // Update ship
    if (this.ship.alive) {
      // Apply gravity
      this.ship.vel.y -= this.gravity * dt;

      const fuelUsed = this.ship.update(dt, input, state.fuel);
      state.fuel = Math.max(0, state.fuel - fuelUsed);

      // Exit planet (fly up past threshold)
      if (this.ship.pos.y > EXIT_Y) {
        ctx.popScene();
        return;
      }

      // Terrain collision
      if (!this.ship.shielded && circleVsSegments(this.ship.pos.x, this.ship.pos.y, this.ship.radius, this.terrain.segments)) {
        this.killShip(ctx);
      }

      // Turret bullet collision with ship
      if (!this.ship.shielded) {
        for (const turret of this.turrets) {
          for (const b of turret.bullets) {
            if (b.pos.distanceTo(this.ship.pos) < this.ship.radius + 3) {
              this.killShip(ctx);
              break;
            }
          }
          if (!this.ship.alive) break;
        }
      }

      // Ship bullet vs turrets
      for (const bullet of this.ship.bullets) {
        for (const turret of this.turrets) {
          if (!turret.alive) continue;
          if (bullet.pos.distanceTo(turret.pos) < turret.radius + 3) {
            turret.alive = false;
            bullet.life = 0;
            state.score += turret.scoreValue;
            this.explosions.push(new Explosion(turret.pos.x, turret.pos.y));
          }
        }

        // Bullet vs terrain
        if (circleVsSegments(bullet.pos.x, bullet.pos.y, 2, this.terrain.segments)) {
          bullet.life = 0;
        }
      }

      // Tractor beam / fuel pickup
      if (input.shield) {
        for (const depot of this.fuelDepots) {
          if (!depot.alive) continue;
          if (this.ship.pos.distanceTo(depot.pos) < TRACTOR_RANGE) {
            depot.alive = false;
            state.fuel = Math.min(state.maxFuel, state.fuel + depot.fuelAmount);
          }
        }
      }

      // Check if all turrets destroyed
      const allDestroyed = this.turrets.every(t => !t.alive);
      if (allDestroyed && this.turrets.length > 0) {
        // Planet cleared!
        state.score += 1000;
        if (this.planet) {
          this.planet.cleared = true;
          state.planetsCleared[this.planet.def.id] = true;
        }
        // Explosion animation then exit
        this.explosions.push(new Explosion(this.ship.pos.x, this.ship.pos.y - 50, 24));
        ctx.popScene();
        return;
      }
    } else {
      // Dead - wait for respawn
      if (this.ship.respawnTimer <= 0) {
        if (state.lives > 0) {
          const level = LEVELS[this.levelIndex % LEVELS.length];
          this.ship = new Ship(level.spawnX, level.spawnY);
          this.ship.angle = Math.PI / 2;
        } else {
          ctx.replaceScene(new GameOverScene());
          return;
        }
      } else {
        this.ship.respawnTimer -= dt;
      }
    }

    // Update turrets
    for (const t of this.turrets) {
      t.update(dt, this.ship.pos);
    }

    // Turret bullets vs terrain
    for (const turret of this.turrets) {
      for (const b of turret.bullets) {
        if (circleVsSegments(b.pos.x, b.pos.y, 2, this.terrain.segments)) {
          b.life = 0;
        }
      }
    }

    // Update explosions
    for (const e of this.explosions) e.update(dt);
    this.explosions = this.explosions.filter(e => !e.done);
  }

  private killShip(ctx: SceneContext) {
    this.explosions.push(new Explosion(this.ship.pos.x, this.ship.pos.y));
    this.ship.kill();
    ctx.state.lives--;
  }

  render(renderer: Renderer, ctx: SceneContext) {
    // Camera follows ship
    if (this.ship.alive) {
      renderer.camX += (this.ship.pos.x - renderer.camX) * 0.08;
      renderer.camY += (this.ship.pos.y - renderer.camY) * 0.08;
    }
    renderer.camScale = Math.min(renderer.width, renderer.height) / 700;

    renderer.beginFrame();

    // Terrain
    renderer.drawSegments(this.terrain.segments, Colors.terrain, 2);

    // Fuel depots
    for (const f of this.fuelDepots) f.render(renderer);

    // Turrets
    for (const t of this.turrets) t.render(renderer);

    // Tractor beam line
    if (this.ship.alive && this.ctx.input.shield) {
      for (const depot of this.fuelDepots) {
        if (!depot.alive) continue;
        if (this.ship.pos.distanceTo(depot.pos) < TRACTOR_RANGE * 1.5) {
          renderer.drawLine(this.ship.pos.x, this.ship.pos.y, depot.pos.x, depot.pos.y, Colors.shield, 1);
        }
      }
    }

    // Ship
    this.ship.render(renderer);

    // Explosions
    for (const e of this.explosions) e.render(renderer);

    // HUD
    renderHud(renderer, ctx.state);

    // Level name
    renderer.drawText(this.levelName, renderer.width / 2, renderer.height - 20, Colors.text, 14, 'center');

    // Exit indicator
    if (this.ship.alive && this.ship.pos.y > EXIT_Y - 80) {
      renderer.drawText('^ EXIT ^', renderer.width / 2, 60, Colors.text, 12, 'center');
    }
  }
}
