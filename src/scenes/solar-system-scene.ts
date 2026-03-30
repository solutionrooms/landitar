import { type Scene, type SceneContext } from './scene.js';
import { type Renderer } from '../render/renderer.js';
import { Ship } from '../entities/ship.js';
import { Star } from '../entities/star.js';
import { Planet, createPlanets } from '../entities/planet.js';
import { Explosion } from '../entities/explosion.js';
import { PlanetScene } from './planet-scene.js';
import { GameOverScene } from './game-over-scene.js';
import { renderHud } from '../render/hud.js';
import { Colors } from '../render/colors.js';

const ENTRY_RADIUS = 20;
const FUEL_DRAIN = 1; // fuel per second in overworld

export class SolarSystemScene implements Scene {
  private ship!: Ship;
  private star!: Star;
  private planets!: Planet[];
  private explosions: Explosion[] = [];
  private ctx!: SceneContext;
  private reentryTimer = 0; // prevents immediate planet re-entry

  enter(ctx: SceneContext) {
    this.ctx = ctx;
    this.ship = new Ship(0, -200);
    this.ship.angle = Math.PI / 2;
    this.star = new Star(0, 0);
    this.planets = createPlanets();

    // Mark cleared planets
    for (const p of this.planets) {
      if (ctx.state.planetsCleared[p.def.id]) {
        p.cleared = true;
      }
    }
  }

  exit() {}

  update(dt: number, ctx: SceneContext) {
    const { input, state } = ctx;

    // Drain fuel
    state.fuel -= FUEL_DRAIN * dt;
    if (state.fuel <= 0) {
      state.fuel = 0;
      // Game over - out of fuel
      ctx.replaceScene(new GameOverScene());
      return;
    }

    // Update star
    this.star.update(dt);

    // Update planets
    for (const p of this.planets) p.update(dt);

    // Update ship
    if (this.ship.alive) {
      // Apply star gravity
      const gravity = this.star.getGravityAccel(this.ship.pos);
      this.ship.vel.addMut(gravity.scale(dt));

      const fuelUsed = this.ship.update(dt, input, state.fuel);
      state.fuel = Math.max(0, state.fuel - fuelUsed);

      // Check star collision
      if (this.ship.pos.distanceTo(this.star.pos) < this.star.killRadius) {
        this.killShip(ctx);
      }

      // Check planet entry (with cooldown after returning)
      this.reentryTimer -= dt;
      if (this.reentryTimer <= 0) {
        for (const p of this.planets) {
          if (p.cleared) continue;
          if (this.ship.pos.distanceTo(p.pos) < p.def.radius + ENTRY_RADIUS) {
            this.reentryTimer = 1.0; // 1 second cooldown on return
            ctx.pushScene(new PlanetScene(p.def.levelIndex, p));
            return;
          }
        }
      }

      // Wrap ship at edges
      const BOUNDS = 500;
      if (this.ship.pos.x > BOUNDS) this.ship.pos.x = -BOUNDS;
      if (this.ship.pos.x < -BOUNDS) this.ship.pos.x = BOUNDS;
      if (this.ship.pos.y > BOUNDS) this.ship.pos.y = -BOUNDS;
      if (this.ship.pos.y < -BOUNDS) this.ship.pos.y = BOUNDS;
    } else {
      this.ship.respawnTimer -= dt;
      if (this.ship.respawnTimer <= 0) {
        if (state.lives > 0) {
          this.ship = new Ship(0, -200);
          this.ship.angle = Math.PI / 2;
        } else {
          ctx.replaceScene(new GameOverScene());
          return;
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
    // Camera follows ship loosely
    const target = this.ship.alive ? this.ship.pos : { x: 0, y: 0 };
    renderer.camX += (target.x - renderer.camX) * 0.05;
    renderer.camY += (target.y - renderer.camY) * 0.05;
    renderer.camScale = Math.min(renderer.width, renderer.height) / 900;

    renderer.beginFrame();

    // Draw orbit paths (subtle)
    for (const p of this.planets) {
      if (p.cleared) continue;
      renderer.ctx.strokeStyle = '#111111';
      renderer.ctx.lineWidth = 0.5;
      renderer.ctx.beginPath();
      renderer.ctx.arc(
        renderer.sx(0), renderer.sy(0),
        p.def.orbitRadius * renderer.camScale,
        0, Math.PI * 2
      );
      renderer.ctx.stroke();
    }

    this.star.render(renderer);
    for (const p of this.planets) p.render(renderer);
    this.ship.render(renderer);
    for (const e of this.explosions) e.render(renderer);

    renderHud(renderer, ctx.state);
  }
}
