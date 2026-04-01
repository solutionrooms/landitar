import { Vec2 } from '../math/vec2.js';
import { Ship, type Bullet } from '../entities/ship.js';
import { type Turret } from '../entities/turret.js';
import { type Segment } from '../math/collision.js';
import { circleVsSegmentsInfo } from '../math/collision.js';
import { Explosion } from '../entities/explosion.js';
import { BotAI } from '../entities/bot-ai.js';
import { RivalShip, type RivalState } from '../entities/rival-ship.js';
import { type Renderer } from '../render/renderer.js';
import { settings } from '../core/settings.js';
import { playExplosionSound } from '../core/audio.js';

const BOT_NAMES = ['BOT-A', 'BOT-B', 'BOT-C'];
const BOT_COLORS = ['#44AAFF', '#FFAA44', '#AA44FF'];
const PLANET_NAMES = [
  'ALPHA', 'BETA', 'GAMMA', 'DELTA', 'EPSILON', 'ZETA',
  'ETA', 'THETA', 'IOTA', 'KAPPA', 'LAMBDA', 'REACTOR',
];

export interface RivalPlayer {
  id: number;
  name: string;
  color: string;
  isHuman: boolean;
  score: number;
  lives: number;
  gameOver: boolean;

  // Location
  scene: string;         // 'solar' or planet name
  targetPlanetIdx: number;

  // Background bot simulation
  transitTimer: number;  // seconds until arriving at planet
  planetTimer: number;   // seconds spent on current planet
  planetDuration: number; // how long to stay
  killTimer: number;     // timer for next background kill

  // Active simulation (when on same planet as player)
  ship: Ship | null;
  ai: BotAI | null;
  visual: RivalShip;

  // Cleared planets
  clearedPlanets: Set<number>;

  // Jump charges
  jumpsLeft: number;
  jumpCooldown: number;   // seconds until bot considers jumping again
}

export class RivalsManager {
  rivals: RivalPlayer[] = [];
  selectedPip = 0; // 0-2, which rival to show in PIP

  init(botCount: number) {
    this.rivals = [];
    for (let i = 0; i < botCount; i++) {
      this.rivals.push({
        id: i + 1,
        name: BOT_NAMES[i] || `BOT-${i + 1}`,
        color: BOT_COLORS[i] || '#888888',
        isHuman: false,
        score: 0,
        lives: settings.lives,
        gameOver: false,
        scene: 'solar',
        targetPlanetIdx: -1,
        transitTimer: 2 + Math.random() * 3,
        planetTimer: 0,
        planetDuration: 0,
        killTimer: 0,
        ship: null,
        ai: null,
        visual: new RivalShip(BOT_COLORS[i] || '#888888'),
        clearedPlanets: new Set(),
        jumpsLeft: settings.maxJumps,
        jumpCooldown: 15 + Math.random() * 20,
      });
      // Pick initial target
      this.pickNextPlanet(this.rivals[i]);
    }
  }

  /** Add a human rival (from network) */
  addHumanRival(): RivalPlayer {
    const r: RivalPlayer = {
      id: this.rivals.length + 1,
      name: 'OPPONENT',
      color: '#FF6644',
      isHuman: true,
      score: 0,
      lives: settings.lives,
      gameOver: false,
      scene: 'solar',
      targetPlanetIdx: -1,
      transitTimer: 0,
      planetTimer: 0,
      planetDuration: 0,
      killTimer: 0,
      ship: null,
      ai: null,
      visual: new RivalShip('#FF6644'),
      clearedPlanets: new Set(),
      jumpsLeft: settings.maxJumps,
      jumpCooldown: 0,
    };
    this.rivals.push(r);
    // Auto-select the human rival for PIP display
    this.selectedPip = this.rivals.length - 1;
    return r;
  }

  private pickNextPlanet(r: RivalPlayer) {
    // Pick a random planet the bot hasn't cleared
    const available: number[] = [];
    for (let i = 0; i < 12; i++) {
      if (!r.clearedPlanets.has(i)) available.push(i);
    }
    if (available.length === 0) {
      r.gameOver = true;
      return;
    }
    r.targetPlanetIdx = available[Math.floor(Math.random() * available.length)];
    r.scene = 'solar';
    r.transitTimer = 3 + Math.random() * 4;
  }

  /** Update background bots (call every frame from any scene) */
  updateBackground(dt: number, playerScene: string) {
    // Interpolate human rival ships for smooth rendering
    for (const r of this.rivals) {
      if (r.isHuman) r.visual.interpolate(dt);
    }

    for (const r of this.rivals) {
      if (r.isHuman || r.gameOver) continue;
      if (r.lives <= 0) { r.gameOver = true; continue; }

      // If bot is actively simulated on the player's scene, skip background
      if (r.ship) continue;

      // Bot jump decision: occasionally teleport to player's planet
      r.jumpCooldown -= dt;
      if (r.jumpsLeft > 0 && r.jumpCooldown <= 0 && r.scene !== playerScene && playerScene !== 'solar') {
        // ~15% chance per cooldown cycle to jump to player's planet
        if (Math.random() < 0.15) {
          r.jumpsLeft--;
          r.scene = playerScene;
          r.planetTimer = 0;
          r.planetDuration = 10 + Math.random() * 12;
          r.killTimer = 1.5 + Math.random() * 2;
          r.jumpCooldown = 20 + Math.random() * 15;
          continue;
        }
        r.jumpCooldown = 8 + Math.random() * 10;
      }

      if (r.scene === 'solar') {
        // In transit to next planet
        r.transitTimer -= dt;
        if (r.transitTimer <= 0) {
          // Arrive at planet
          r.scene = PLANET_NAMES[r.targetPlanetIdx] || 'ALPHA';
          r.planetTimer = 0;
          r.planetDuration = 12 + Math.random() * 15;
          r.killTimer = 2 + Math.random() * 2;
        }
      } else {
        // On a planet (background simulation)
        r.planetTimer += dt;
        r.killTimer -= dt;

        // Simulate turret kills
        if (r.killTimer <= 0) {
          r.score += 250;
          r.killTimer = 2.5 + Math.random() * 2;
        }

        // Done with planet?
        if (r.planetTimer >= r.planetDuration) {
          r.score += 2000; // landing bonus
          r.clearedPlanets.add(r.targetPlanetIdx);
          this.pickNextPlanet(r);
        }
      }
    }
  }

  /** Spawn bot ships when entering a planet scene */
  spawnBotsOnPlanet(levelName: string, spawnX: number, spawnY: number) {
    for (const r of this.rivals) {
      if (r.isHuman || r.gameOver) continue;
      // If bot is on the same planet, spawn a real ship
      if (r.scene === levelName && !r.ship) {
        r.ship = new Ship(spawnX + 20 + r.id * 15, spawnY);
        r.ship.angle = Math.PI / 2;
        r.ai = new BotAI();
      }
    }
  }

  /** Despawn bot ships when leaving a planet */
  despawnBots() {
    for (const r of this.rivals) {
      r.ship = null;
      r.ai = null;
    }
  }

  /** Update active bot ships on current planet */
  updateActiveBots(
    dt: number, gravity: number, terrain: Segment[],
    turrets: Turret[], explosions: Explosion[],
    minX: number, maxX: number, exitY: number,
  ) {
    for (const r of this.rivals) {
      if (!r.ship || !r.ai || !r.ship.alive || r.isHuman) continue;

      // Gravity
      r.ship.vel.y -= gravity * settings.planetGravity * dt;

      // Bot AI input
      const input = r.ai.update(dt, r.ship, turrets, terrain, exitY);
      r.ship.update(dt, input, 99999);

      // Clamp
      if (r.ship.pos.x < minX) { r.ship.pos.x = minX; r.ship.vel.x = 0; }
      if (r.ship.pos.x > maxX) { r.ship.pos.x = maxX; r.ship.vel.x = 0; }

      // Terrain bounce
      const hit = circleVsSegmentsInfo(r.ship.pos.x, r.ship.pos.y, r.ship.radius, terrain);
      if (hit) {
        const vDotN = r.ship.vel.x * hit.normalX + r.ship.vel.y * hit.normalY;
        if (vDotN < 0) {
          r.ship.vel.x -= 2 * vDotN * hit.normalX;
          r.ship.vel.y -= 2 * vDotN * hit.normalY;
          r.ship.vel.scaleMut(0.5);
        }
        r.ship.pos.x += hit.normalX * (hit.depth + 1);
        r.ship.pos.y += hit.normalY * (hit.depth + 1);
      }

      // Bot bullets vs turrets
      for (const bullet of r.ship.bullets) {
        for (const turret of turrets) {
          if (!turret.alive) continue;
          if (bullet.pos.distanceTo(turret.pos) < turret.radius + 3) {
            turret.alive = false;
            bullet.life = 0;
            r.score += 250;
            explosions.push(new Explosion(turret.pos.x, turret.pos.y));
            playExplosionSound();
          }
        }
      }

      // Bot exits if above EXIT_Y
      if (r.ship.pos.y > exitY && r.ship.vel.y > 0) {
        r.ship = null;
        r.ai = null;
        // Continue background simulation
      }

      // Update visual
      if (r.ship) {
        r.visual.applyState({
          x: r.ship.pos.x, y: r.ship.pos.y,
          angle: r.ship.angle, alive: r.ship.alive,
          shielded: r.ship.shielded, thrusting: r.ship.thrusting,
          bullets: r.ship.bullets.map(b => ({ x: b.pos.x, y: b.pos.y })),
          scene: r.scene,
        });
      }
    }
  }

  /** Check player bullets vs rival ships, and rival bullets vs player */
  checkCombat(
    playerShip: Ship, playerScore: { score: number },
    explosions: Explosion[], currentScene: string,
  ) {
    for (const r of this.rivals) {
      const rival = r.ship ? r : null;
      const rShip = r.ship;
      const vis = r.visual;
      if (!vis.alive && !rShip?.alive) continue;

      const onScene = r.isHuman ? (vis.scene === currentScene) : !!rShip;
      if (!onScene) continue;

      const rPos = rShip ? rShip.pos : vis.pos;
      const rRadius = rShip ? rShip.radius : vis.radius;
      const rShielded = rShip ? rShip.shielded : vis.shielded;

      // Player bullets vs rival
      if (playerShip.alive) {
        for (const b of playerShip.bullets) {
          if (b.pos.distanceTo(rPos) < rRadius + 3) {
            b.life = 0;
            if (rShielded) {
              if (rShip) {
                rShip.vel.x += b.vel.x * 0.3;
                rShip.vel.y += b.vel.y * 0.3;
                rShip.angle += (Math.random() - 0.5) * 0.8;
              }
            } else {
              explosions.push(new Explosion(rPos.x, rPos.y));
              playExplosionSound();
              if (rShip) {
                rShip.kill();
                r.lives--;
              }
              playerScore.score += 500;
            }
          }
        }
      }

      // Rival bullets vs player
      if (playerShip.alive) {
        const bullets = rShip ? rShip.bullets : [];
        const bulletPositions = r.isHuman ? vis.bullets : [];
        const allBullets = rShip
          ? bullets.map(b => ({ x: b.pos.x, y: b.pos.y, ref: b }))
          : bulletPositions.map(b => ({ x: b.x, y: b.y, ref: null }));

        for (const bp of allBullets) {
          const dx = bp.x - playerShip.pos.x;
          const dy = bp.y - playerShip.pos.y;
          if (dx * dx + dy * dy < (playerShip.radius + 3) ** 2) {
            if (playerShip.shielded) {
              playerShip.vel.x += (bp.x - playerShip.pos.x) * 2;
              playerShip.vel.y += (bp.y - playerShip.pos.y) * 2;
              playerShip.angle += (Math.random() - 0.5) * 0.8;
            } else {
              return true; // player was killed
            }
            if (bp.ref) (bp.ref as any).life = 0;
            break;
          }
        }
      }
    }
    return false;
  }

  /** Render all rival ships on the current scene */
  renderOnScene(renderer: Renderer, currentScene: string) {
    for (const r of this.rivals) {
      if (r.isHuman) {
        if (r.visual.scene === currentScene && r.visual.alive) {
          r.visual.render(renderer);
        }
      } else if (r.ship?.alive) {
        r.visual.render(renderer);
      }
    }
  }

  /** Cycle PIP selection with keys 1-3 */
  handlePipKeys(wasPressed: (code: string) => boolean) {
    if (wasPressed('Digit1') && this.rivals.length >= 1) this.selectedPip = 0;
    if (wasPressed('Digit2') && this.rivals.length >= 2) this.selectedPip = 1;
    if (wasPressed('Digit3') && this.rivals.length >= 3) this.selectedPip = 2;
  }
}
