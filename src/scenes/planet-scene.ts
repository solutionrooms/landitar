import { type Scene, type SceneContext } from './scene.js';
import { type Renderer } from '../render/renderer.js';
import { type Segment } from '../math/collision.js';
import { Ship } from '../entities/ship.js';
import { Turret } from '../entities/turret.js';
import { FuelDepot } from '../entities/fuel-depot.js';
import { Explosion } from '../entities/explosion.js';
import { LandingPad } from '../entities/landing-pad.js';
import { Terrain } from '../levels/terrain.js';
import { LEVELS } from '../levels/level-data.js';
import { type Planet, type PlanetSavedState } from '../entities/planet.js';
import { circleVsSegments, circleVsSegmentsInfo } from '../math/collision.js';
import { renderHud } from '../render/hud.js';
import { Colors } from '../render/colors.js';
import { GameOverScene } from './game-over-scene.js';
import { settings } from '../core/settings.js';
import { playPickupSound, playExplosionSound, playDeathSound, playLevelCompleteSound } from '../core/audio.js';
import { renderRivalsOverlay, type PipRenderFn } from '../render/opponent-overlay.js';
import { type RivalsManager } from '../entities/rivals.js';

const EXIT_Y = 450;
const SPIKE_SIZE = 18;
const SPIKE_SPACING = 25;

function generateSpikes(
  x1: number, y1: number, x2: number, y2: number,
  perpX: number, perpY: number,
): Segment[] {
  const len = Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
  const count = Math.max(1, Math.round(len / SPIKE_SPACING));
  const dx = (x2 - x1) / count;
  const dy = (y2 - y1) / count;
  const segs: Segment[] = [];
  for (let i = 0; i < count; i++) {
    const ax = x1 + dx * i;
    const ay = y1 + dy * i;
    const tx = ax + dx * 0.5 + perpX * SPIKE_SIZE;
    const ty = ay + dy * 0.5 + perpY * SPIKE_SIZE;
    const bx = x1 + dx * (i + 1);
    const by = y1 + dy * (i + 1);
    segs.push({ x1: ax, y1: ay, x2: tx, y2: ty });
    segs.push({ x1: tx, y1: ty, x2: bx, y2: by });
  }
  return segs;
}

type LandPhase = 'none' | 'waiting' | 'planting' | 'departing';

export class PlanetScene implements Scene {
  private ship!: Ship;
  private terrain!: Terrain;
  private turrets: Turret[] = [];
  private fuelDepots: FuelDepot[] = [];
  private explosions: Explosion[] = [];
  private landingPad!: LandingPad;
  private gravity = 50;
  private ctx!: SceneContext;
  private levelIndex: number;
  private planet: Planet | null;
  private levelName = '';
  private cleared = false;
  private clearBonusGiven = false;
  private landPhase: LandPhase = 'none';
  private landPhaseTimer = 0;
  private minX = -Infinity;
  private maxX = Infinity;
  private bottomY = -Infinity;

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

    // Compute bounds
    const xs = level.terrain.map(p => p.x);
    const ys = level.terrain.map(p => p.y);
    if (level.width) {
      this.minX = -level.width / 2;
      this.maxX = level.width / 2;
    } else {
      this.minX = Math.min(...xs);
      this.maxX = Math.max(...xs);
    }
    this.bottomY = Math.min(...ys) - 60;

    // Add spike walls for open levels
    if (!level.closed) {
      // Left spike wall (spikes point right)
      this.terrain.segments.push(
        ...generateSpikes(this.minX, EXIT_Y, this.minX, this.bottomY, 1, 0),
      );
      // Right spike wall (spikes point left)
      this.terrain.segments.push(
        ...generateSpikes(this.maxX, EXIT_Y, this.maxX, this.bottomY, -1, 0),
      );
      // Bottom spike wall (spikes point up)
      this.terrain.segments.push(
        ...generateSpikes(this.minX, this.bottomY, this.maxX, this.bottomY, 0, 1),
      );
    }

    this.ship = new Ship(level.spawnX, level.spawnY);
    this.ship.angle = Math.PI / 2;

    this.turrets = level.turrets.map(def => new Turret(def));
    this.fuelDepots = level.fuelDepots.map(def => new FuelDepot(def));
    this.explosions = [];
    this.cleared = false;
    this.clearBonusGiven = false;
    this.landPhase = 'none';
    this.landPhaseTimer = 0;

    // Create landing pad - use level's padX or pick a random flat-ish spot
    const padX = level.padX ?? this.pickPadX(level.terrain);
    const groundY = this.terrain.getYAtX(padX) ?? -50;
    this.landingPad = new LandingPad(padX, groundY);

    // Restore saved state if returning to this planet
    if (this.planet?.savedState) {
      const saved = this.planet.savedState;
      this.cleared = saved.cleared;
      for (let i = 0; i < this.turrets.length && i < saved.turretsAlive.length; i++) {
        this.turrets[i].alive = saved.turretsAlive[i];
      }
      for (let i = 0; i < this.fuelDepots.length && i < saved.depotsAlive.length; i++) {
        if (!saved.depotsAlive[i]) this.fuelDepots[i].alive = false;
      }
    }

    // Spawn rival bots on this planet
    if (ctx.rivals) {
      ctx.rivals.spawnBotsOnPlanet(this.levelName, level.spawnX, level.spawnY);
    }
  }

  private pickPadX(terrainPts: { x: number; y: number }[]): number {
    let bestX = 0;
    let bestSlope = Infinity;
    for (let i = 1; i < terrainPts.length - 2; i++) {
      const p = terrainPts[i];
      const q = terrainPts[i + 1];
      const slope = Math.abs((q.y - p.y) / (q.x - p.x + 0.01));
      if (slope < bestSlope) {
        bestSlope = slope;
        bestX = (p.x + q.x) / 2;
      }
    }
    return bestX;
  }

  exit() {
    // Save level state so player can resume later
    if (this.planet && !this.planet.cleared && !this.planet.explosivesPlanted) {
      this.planet.savedState = {
        turretsAlive: this.turrets.map(t => t.alive),
        depotsAlive: this.fuelDepots.map(d => d.alive),
        cleared: this.cleared,
      };
    }
    // Despawn bot ships
    if (this.ctx.rivals) {
      this.ctx.rivals.despawnBots();
    }
  }


  update(dt: number, ctx: SceneContext) {
    const { input, state } = ctx;

    if (state.fuel <= 0) {
      ctx.replaceScene(new GameOverScene());
      return;
    }

    // Landing sequence state machine
    if (this.landPhase !== 'none') {
      this.updateLandPhase(dt, ctx);
      return;
    }

    if (this.ship.alive) {
      // Apply gravity
      this.ship.vel.y -= this.gravity * settings.planetGravity * dt;

      const fuelUsed = this.ship.update(dt, input, state.fuel);
      state.fuel = Math.max(0, state.fuel - fuelUsed);

      // Clamp ship within bounds
      if (this.ship.pos.x < this.minX) { this.ship.pos.x = this.minX; this.ship.vel.x = 0; }
      if (this.ship.pos.x > this.maxX) { this.ship.pos.x = this.maxX; this.ship.vel.x = 0; }

      // Exit planet (must be flying upward past threshold)
      if (this.ship.pos.y > EXIT_Y && this.ship.vel.y > 0) {
        ctx.popScene();
        return;
      }

      // Landing pad check
      const landResult = this.landingPad.checkLanding(
        this.ship.pos.x, this.ship.pos.y, this.ship.vel.y, this.ship.angle, this.ship.radius
      );
      if (landResult === 'landed') {
        this.landPhase = 'waiting';
        this.ship.vel.set(0, 0);
        this.ship.thrusting = false;
        state.score += 2000;
        playLevelCompleteSound();
      } else if (landResult === 'crashed') {
        if (this.ship.shielded) {
          // Bounce off pad surface (normal points up)
          this.ship.vel.y = Math.abs(this.ship.vel.y) * 0.6;
          this.ship.vel.x *= 0.6;
          this.ship.pos.y = this.landingPad.top + this.ship.radius + 1;
        } else {
          this.killShip(ctx);
        }
      }

      // Terrain collision (ship)
      if (this.ship.alive) {
        const hit = circleVsSegmentsInfo(this.ship.pos.x, this.ship.pos.y, this.ship.radius, this.terrain.segments);
        if (hit) {
          if (this.ship.shielded) {
            // Bounce off: reflect velocity across surface normal
            const vDotN = this.ship.vel.x * hit.normalX + this.ship.vel.y * hit.normalY;
            if (vDotN < 0) {
              this.ship.vel.x -= 2 * vDotN * hit.normalX;
              this.ship.vel.y -= 2 * vDotN * hit.normalY;
              this.ship.vel.scaleMut(0.6); // energy loss
            }
            // Push out of penetration
            this.ship.pos.x += hit.normalX * (hit.depth + 1);
            this.ship.pos.y += hit.normalY * (hit.depth + 1);
          } else {
            this.killShip(ctx);
          }
        }
      }

      // Turret bullet collision with ship
      if (this.ship.alive) {
        for (const turret of this.turrets) {
          for (const b of turret.bullets) {
            if (b.pos.distanceTo(this.ship.pos) < this.ship.radius + 3) {
              if (this.ship.shielded) {
                // Absorb hit: push ship away and spin it
                const pushScale = 0.3;
                this.ship.vel.x += b.vel.x * pushScale;
                this.ship.vel.y += b.vel.y * pushScale;
                this.ship.angle += (Math.random() - 0.5) * 0.8;
                b.life = 0;
              } else {
                this.killShip(ctx);
                break;
              }
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
            playExplosionSound();
          }
        }

        // Bullet vs terrain - always check (bullets stop at walls)
        if (bullet.life > 0 && circleVsSegments(bullet.pos.x, bullet.pos.y, 2, this.terrain.segments)) {
          bullet.life = 0;
        }
      }

      // Tractor beam - initiate grab
      if (input.shield) {
        for (const depot of this.fuelDepots) {
          if (!depot.alive || depot.grabbed) continue;
          if (this.ship.pos.distanceTo(depot.pos) < settings.tractorRange) {
            depot.grabbed = true;
          }
        }
      }

      // Check if all turrets destroyed
      if (!this.cleared && this.turrets.length > 0 && this.turrets.every(t => !t.alive)) {
        this.cleared = true;
        if (!this.clearBonusGiven) {
          this.clearBonusGiven = true;
          state.score += 1000;
          this.explosions.push(new Explosion(this.ship.pos.x, this.ship.pos.y - 50, 24));
          playLevelCompleteSound();
        }
      }
    } else {
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

    // Update grabbed depots
    for (const depot of this.fuelDepots) {
      if (!depot.alive || !depot.grabbed) continue;
      if (depot.updateGrab(dt, this.ship.pos)) {
        depot.alive = false;
        state.fuel = Math.min(state.maxFuel, state.fuel + settings.fuelPickup);
        playPickupSound();
      }
    }

    // Update turrets
    for (const t of this.turrets) {
      t.update(dt, this.ship.pos, this.terrain.segments);
    }

    // Turret bullets vs terrain - skip if still near the turret that fired it
    for (const turret of this.turrets) {
      for (const b of turret.bullets) {
        const nearOwner = turret.alive && b.pos.distanceTo(turret.pos) < 20;
        if (!nearOwner && circleVsSegments(b.pos.x, b.pos.y, 2, this.terrain.segments)) {
          b.life = 0;
        }
      }
    }

    // Update rivals (bots + network)
    if (ctx.rivals) {
      ctx.rivals.updateBackground(dt, this.levelName);
      ctx.rivals.updateActiveBots(
        dt, this.gravity, this.terrain.segments,
        this.turrets, this.explosions,
        this.minX, this.maxX, EXIT_Y,
      );
      ctx.rivals.handlePipKeys(code => ctx.input.wasPressed(code));

      // Network rival sync
      if (ctx.multiplayer?.isMultiplayer) {
        ctx.multiplayer.broadcastShipState(this.ship, this.levelName);
        for (const r of ctx.rivals.rivals) {
          if (r.isHuman) {
            r.visual.applyState(ctx.multiplayer.remoteShip);
            r.score = ctx.multiplayer.remote.score;
          }
        }
      }

      // Cross-player combat
      if (ctx.rivals.checkCombat(this.ship, ctx.state, this.explosions, this.levelName)) {
        this.killShip(ctx);
      }
    }

    // Update explosions
    for (const e of this.explosions) e.update(dt);
    this.explosions = this.explosions.filter(e => !e.done);
  }

  private updateLandPhase(dt: number, ctx: SceneContext) {
    switch (this.landPhase) {
      case 'waiting':
        if (ctx.input.fire) {
          this.landPhase = 'planting';
          this.landPhaseTimer = 2.0;
        } else if (ctx.input.thrust) {
          // Take off without planting
          this.landPhase = 'none';
          this.ship.vel.set(0, 60);
          this.ship.shielded = false;
        }
        break;

      case 'planting':
        this.landPhaseTimer -= dt;
        if (this.landPhaseTimer <= 0) {
          this.landPhase = 'departing';
          if (this.planet) this.planet.explosivesPlanted = true;
          this.ship.vel.set(0, 80);
          this.ship.angle = Math.PI / 2;
          playExplosionSound();
        }
        break;

      case 'departing':
        // Auto-takeoff: strong upward thrust overcoming gravity
        this.ship.vel.y += 200 * dt;
        this.ship.pos.addMut(this.ship.vel.scale(dt));
        this.ship.thrusting = true;
        if (this.ship.pos.y > EXIT_Y) {
          ctx.popScene();
          return;
        }
        break;
    }

    // Update explosions during landing phases
    for (const e of this.explosions) e.update(dt);
    this.explosions = this.explosions.filter(e => !e.done);

    // Turrets keep firing during waiting/planting (but ship is shielded)
    if (this.landPhase !== 'departing') {
      for (const t of this.turrets) {
        t.update(dt, this.ship.pos, this.terrain.segments);
      }
    }
  }

  private killShip(ctx: SceneContext) {
    if (!this.ship.alive) return;
    this.explosions.push(new Explosion(this.ship.pos.x, this.ship.pos.y));
    this.ship.kill();
    ctx.state.lives--;
    playDeathSound();
  }

  render(renderer: Renderer, ctx: SceneContext) {
    const isLanding = this.landPhase !== 'none' && this.landPhase !== 'departing';
    if (this.ship.alive && !isLanding) {
      renderer.camX += (this.ship.pos.x - renderer.camX) * 0.08;
      renderer.camY += (this.ship.pos.y - renderer.camY) * 0.08;
    }
    renderer.camScale = Math.min(renderer.width, renderer.height) / 700;

    renderer.beginFrame();

    // Terrain
    renderer.drawSegments(this.terrain.segments, Colors.terrain, 2);

    // Landing pad
    this.landingPad.render(renderer);

    // Fuel depots
    for (const f of this.fuelDepots) f.render(renderer);

    // Turrets
    for (const t of this.turrets) t.render(renderer);

    // Tractor beam line
    if (this.ship.alive && this.landPhase === 'none') {
      for (const depot of this.fuelDepots) {
        if (!depot.alive) continue;
        if (depot.grabbed) {
          renderer.drawLine(this.ship.pos.x, this.ship.pos.y, depot.pos.x, depot.pos.y, Colors.shield, 2);
        } else if (this.ctx.input.shield) {
          const dist = this.ship.pos.distanceTo(depot.pos);
          if (dist < settings.tractorRange * 2) {
            const inRange = dist < settings.tractorRange;
            renderer.drawLine(
              this.ship.pos.x, this.ship.pos.y,
              depot.pos.x, depot.pos.y,
              inRange ? Colors.shield : '#224444', inRange ? 2 : 1
            );
          }
        }
      }
    }

    // Exit zone haze
    this.renderExitHaze(renderer);

    // Ship (show shield during landing phases except departing)
    if (isLanding) {
      this.ship.shielded = true;
    }
    this.ship.render(renderer);

    // Render rival ships
    if (ctx.rivals) {
      ctx.rivals.renderOnScene(renderer, this.levelName);
    }

    // Explosions
    for (const e of this.explosions) e.render(renderer);

    // Landing warning
    if (this.ship.alive && this.landPhase === 'none') {
      this.renderLandingWarning(renderer);
    }

    // HUD
    renderHud(renderer, ctx.state);

    // Level name
    renderer.drawText(this.levelName, renderer.width / 2, renderer.height - 20, Colors.text, 14, 'center');

    // Status messages
    if (this.landPhase === 'waiting') {
      renderer.drawText('LANDED! SPACE: PLANT EXPLOSIVES  |  THRUST: TAKE OFF', renderer.width / 2, 60, Colors.star, 14, 'center');
    } else if (this.landPhase === 'planting') {
      const dots = '.'.repeat(Math.floor((2.0 - this.landPhaseTimer) * 3) % 4);
      renderer.drawText('PLANTING EXPLOSIVES' + dots, renderer.width / 2, 60, '#FF4444', 16, 'center');
    } else if (this.landPhase === 'departing') {
      renderer.drawText('EXPLOSIVES PLANTED - GET CLEAR!', renderer.width / 2, 60, '#FF4444', 16, 'center');
    } else if (this.cleared) {
      renderer.drawText('ALL ENEMIES DESTROYED +1000', renderer.width / 2, 60, Colors.star, 14, 'center');
    } else if (this.ship.alive && this.ship.pos.y > EXIT_Y - 100) {
      renderer.drawText('^ EXIT ^', renderer.width / 2, 60, Colors.text, 12, 'center');
    }

    // Rivals overlay
    if (ctx.rivals && ctx.rivals.rivals.length > 0) {
      if (ctx.multiplayer?.isMultiplayer) {
        ctx.multiplayer.maybeBroadcastState(ctx.state);
      }
      renderRivalsOverlay(renderer, ctx.rivals, ctx.state.score, ctx.multiplayer, this.pipRenderFn(renderer));
    }
  }

  /** Creates a PIP render callback that draws the bot's scene view */
  private pipRenderFn(renderer: Renderer): PipRenderFn {
    return (canvasCtx, rend, pipX, pipY, pipW, pipH, rival) => {
      const rShip = rival.ship;
      if (!rShip || !rShip.alive) return false;

      // Save renderer + canvas state
      const savedCamX = rend.camX;
      const savedCamY = rend.camY;
      const savedScale = rend.camScale;

      canvasCtx.save();
      canvasCtx.beginPath();
      canvasCtx.rect(pipX, pipY, pipW, pipH);
      canvasCtx.clip();

      // Translate so renderer center maps to PIP center
      const offsetX = (pipX + pipW / 2) - rend.width / 2;
      const offsetY = (pipY + pipH / 2) - rend.height / 2;
      canvasCtx.translate(offsetX, offsetY);

      // Set camera to bot's position, scaled to fit PIP
      rend.camX = rShip.pos.x;
      rend.camY = rShip.pos.y;
      rend.camScale = pipW / 800;

      // Draw terrain
      rend.drawSegments(this.terrain.segments, Colors.terrain, 1);

      // Draw turrets (alive only, simplified)
      for (const t of this.turrets) {
        if (t.alive) {
          rend.drawSegments(t.getSegments(), Colors.turret, 1);
        }
      }

      // Draw fuel depots
      for (const f of this.fuelDepots) {
        if (f.alive) {
          rend.drawCircle(f.pos.x, f.pos.y, 4, Colors.fuelDepot, 1);
        }
      }

      // Draw the bot's ship
      rival.visual.render(rend);

      // Draw the player's ship as a small dot (so bot view shows player position)
      if (this.ship.alive) {
        rend.drawCircle(this.ship.pos.x, this.ship.pos.y, 4, Colors.ship, 1);
      }

      // Landing pad
      this.landingPad.render(rend);

      // Restore
      canvasCtx.restore();
      rend.camX = savedCamX;
      rend.camY = savedCamY;
      rend.camScale = savedScale;

      // Draw bot name overlay at bottom of PIP
      const label = `${rival.visual.scene || 'PLANET'}`;
      rend.drawText(label, pipX + pipW / 2, pipY + pipH - 4, rival.color, 8, 'center');

      return true;
    };
  }

  private renderExitHaze(renderer: Renderer) {
    const HAZE_DEPTH = 100;
    const ctx = renderer.ctx;
    const exitScreenY = renderer.sy(EXIT_Y);
    const hazeBottomScreenY = renderer.sy(EXIT_Y - HAZE_DEPTH);

    // Gradient band warning area
    const grad = ctx.createLinearGradient(0, exitScreenY, 0, hazeBottomScreenY);
    grad.addColorStop(0, 'rgba(0, 50, 120, 0.3)');
    grad.addColorStop(1, 'rgba(0, 50, 120, 0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, exitScreenY, renderer.width, hazeBottomScreenY - exitScreenY);

    // Solid haze above exit line
    if (exitScreenY > 0) {
      ctx.fillStyle = 'rgba(0, 50, 120, 0.35)';
      ctx.fillRect(0, 0, renderer.width, exitScreenY);
    }

    // Dashed boundary line at exit threshold
    ctx.strokeStyle = 'rgba(80, 140, 255, 0.3)';
    ctx.lineWidth = 1;
    ctx.setLineDash([8, 8]);
    ctx.beginPath();
    ctx.moveTo(0, exitScreenY);
    ctx.lineTo(renderer.width, exitScreenY);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  private renderLandingWarning(renderer: Renderer) {
    const pad = this.landingPad;
    const ship = this.ship;
    const dx = ship.pos.x - pad.pos.x;
    const dy = ship.pos.y - pad.pos.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    const warnRange = 80;
    if (dist > warnRange) return;

    const angleDev = Math.abs(ship.angle - Math.PI / 2);
    const angleDevNorm = angleDev > Math.PI ? Math.PI * 2 - angleDev : angleDev;
    const maxAngleRad = (settings.maxLandingAngle * Math.PI) / 180;
    const tooTilted = angleDevNorm > maxAngleRad;
    const tooFast = Math.abs(ship.vel.y) > settings.maxLandingSpeed;

    if (!tooTilted && !tooFast) return;

    // Flash red at ~4Hz
    const flash = Math.sin(Date.now() * 0.025) > 0;
    if (!flash) return;

    const padScreenX = renderer.sx(pad.pos.x);
    const padScreenY = renderer.sy(pad.pos.y);

    const hw = settings.padWidth / 2 * renderer.camScale;
    renderer.ctx.strokeStyle = '#FF2222';
    renderer.ctx.lineWidth = 2;
    renderer.ctx.beginPath();
    renderer.ctx.moveTo(padScreenX - hw - 6, padScreenY);
    renderer.ctx.lineTo(padScreenX + hw + 6, padScreenY);
    renderer.ctx.stroke();

    const warnings: string[] = [];
    if (tooFast) warnings.push('SPEED');
    if (tooTilted) warnings.push('ANGLE');
    renderer.drawText(warnings.join(' / '), padScreenX, padScreenY - 14, '#FF2222', 10, 'center');
  }
}
