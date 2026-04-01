import { type Scene, type SceneContext } from './scene.js';
import { type Renderer } from '../render/renderer.js';
import { Colors } from '../render/colors.js';
import { SolarSystemScene } from './solar-system-scene.js';
import { settings, SETTING_DEFS, resetSettings, type SettingDef } from '../core/settings.js';
import { type InputManager } from '../core/input.js';
import { getHighScores } from '../core/highscores.js';
import { generateLevels } from '../levels/level-generator.js';
import { setLevels } from '../levels/level-data.js';
import { LobbyScene } from './lobby-scene.js';
import { PreferencesScene } from './preferences-scene.js';
import { LevelDebugScene } from './level-debug-scene.js';
import { MultiplayerSession } from '../net/multiplayer-session.js';
import { RivalsManager } from '../entities/rivals.js';

const REPEAT_DELAY = 0.35;
const REPEAT_RATE = 0.06;

type MenuMode = 'main' | 'multiplayer' | 'settings';

export class TitleScene implements Scene {
  private blinkTimer = 0;
  private ctx!: SceneContext;
  private mode: MenuMode = 'main';
  private menuIndex = 0;
  private selectedIndex = 0; // settings slider index

  // Multiplayer config
  private mpBots = 2;
  private mpHuman = true;
  private mpMenuIndex = 0; // 0=bots, 1=human, 2=start, 3=back

  // Key repeat state
  private holdDir = 0;
  private holdTimer = 0;
  private holdRepeating = false;

  enter(ctx: SceneContext) {
    this.ctx = ctx;
  }

  exit() {}

  update(dt: number, ctx: SceneContext) {
    this.blinkTimer += dt;
    const { input } = ctx;

    switch (this.mode) {
      case 'main': this.updateMain(input, ctx); break;
      case 'multiplayer': this.updateMultiplayer(input, ctx); break;
      case 'settings': this.updateSettings(dt, input, ctx); break;
    }
  }

  // --- Main menu: 1 PLAYER | MULTIPLAYER | SETTINGS | PREFERENCES | LEVEL DEBUG ---
  private updateMain(input: InputManager, ctx: SceneContext) {
    const items = 5;
    if (input.wasPressed('ArrowLeft') || input.wasPressed('ArrowUp') || input.wasPressed('KeyA') || input.wasPressed('KeyW')) this.menuIndex = (this.menuIndex - 1 + items) % items;
    if (input.wasPressed('ArrowRight') || input.wasPressed('ArrowDown') || input.wasPressed('KeyD') || input.wasPressed('KeyS')) this.menuIndex = (this.menuIndex + 1) % items;

    if (input.wasPressed('Enter') || input.wasPressed('Space')) {
      if (this.menuIndex === 0) {
        this.startGame(ctx, 0, false);
      } else if (this.menuIndex === 1) {
        this.mode = 'multiplayer';
        this.mpMenuIndex = 0;
      } else if (this.menuIndex === 2) {
        this.mode = 'settings';
      } else if (this.menuIndex === 3) {
        ctx.pushScene(new PreferencesScene());
      } else if (this.menuIndex === 4) {
        const seed = settings.randomSeed || Math.floor(Math.random() * 2147483647);
        setLevels(generateLevels(seed));
        ctx.pushScene(new LevelDebugScene());
      }
    }
  }

  // --- Multiplayer sub-menu: bots slider, human toggle, start, back ---
  private updateMultiplayer(input: InputManager, ctx: SceneContext) {
    const items = 4;
    if (input.wasPressed('ArrowUp') || input.wasPressed('KeyW')) this.mpMenuIndex = (this.mpMenuIndex - 1 + items) % items;
    if (input.wasPressed('ArrowDown') || input.wasPressed('KeyS')) this.mpMenuIndex = (this.mpMenuIndex + 1) % items;

    if (this.mpMenuIndex === 0) {
      // Bots slider
      if (input.wasPressed('ArrowLeft') || input.wasPressed('KeyA')) this.mpBots = Math.max(0, this.mpBots - 1);
      if (input.wasPressed('ArrowRight') || input.wasPressed('KeyD')) this.mpBots = Math.min(3, this.mpBots + 1);
    } else if (this.mpMenuIndex === 1) {
      // Human toggle
      if (input.wasPressed('ArrowLeft') || input.wasPressed('ArrowRight') ||
          input.wasPressed('KeyA') || input.wasPressed('KeyD') ||
          input.wasPressed('Enter') || input.wasPressed('Space')) {
        if (input.wasPressed('Enter') || input.wasPressed('Space')) {
          this.mpHuman = !this.mpHuman;
        } else {
          this.mpHuman = !this.mpHuman;
        }
        // Must have at least 1 opponent
        if (!this.mpHuman && this.mpBots === 0) this.mpBots = 1;
        return;
      }
    }

    if (input.wasPressed('Enter') || input.wasPressed('Space')) {
      if (this.mpMenuIndex === 2) {
        // Start
        if (this.mpHuman) {
          this.start2Player(ctx, this.mpBots);
        } else {
          this.startGame(ctx, this.mpBots, false);
        }
      } else if (this.mpMenuIndex === 3) {
        this.mode = 'main';
      }
    }

    if (input.wasPressed('Escape')) {
      this.mode = 'main';
    }
  }

  private updateSettings(dt: number, input: InputManager, ctx: SceneContext) {
    if (input.wasPressed('ArrowUp') || input.wasPressed('KeyW')) {
      this.selectedIndex = (this.selectedIndex - 1 + SETTING_DEFS.length) % SETTING_DEFS.length;
    }
    if (input.wasPressed('ArrowDown') || input.wasPressed('KeyS')) {
      this.selectedIndex = (this.selectedIndex + 1) % SETTING_DEFS.length;
    }

    const leftHeld = input.isDown('ArrowLeft') || input.isDown('KeyA');
    const rightHeld = input.isDown('ArrowRight') || input.isDown('KeyD');
    const newDir = leftHeld ? -1 : rightHeld ? 1 : 0;

    if (newDir !== 0) {
      if (newDir !== this.holdDir) {
        this.holdDir = newDir;
        this.holdTimer = 0;
        this.holdRepeating = false;
        this.adjustSetting(SETTING_DEFS[this.selectedIndex], newDir);
      } else {
        this.holdTimer += dt;
        if (!this.holdRepeating && this.holdTimer > REPEAT_DELAY) {
          this.holdRepeating = true;
          this.holdTimer = 0;
        }
        if (this.holdRepeating) {
          this.holdTimer += dt;
          while (this.holdTimer > REPEAT_RATE) {
            this.holdTimer -= REPEAT_RATE;
            this.adjustSetting(SETTING_DEFS[this.selectedIndex], newDir);
          }
        }
      }
    } else {
      this.holdDir = 0;
      this.holdTimer = 0;
      this.holdRepeating = false;
    }

    if (input.wasPressed('KeyR')) resetSettings();
    if (input.wasPressed('Escape')) this.mode = 'main';
    if (input.wasPressed('Enter')) this.startGame(this.ctx, 0, false);
  }

  private adjustSetting(def: SettingDef, direction: number) {
    const current = settings[def.key];
    let next = current + def.step * direction;
    next = Math.round(next / def.step) * def.step;
    next = Math.max(def.min, Math.min(def.max, next));
    (settings as any)[def.key] = next;
  }

  private start2Player(ctx: SceneContext, botCount: number) {
    const session = ctx.multiplayer ?? new MultiplayerSession();
    const canvas = ctx.renderer.ctx.canvas as HTMLCanvasElement;
    ctx.replaceScene(new LobbyScene(session, canvas, botCount));
  }

  private startGame(ctx: SceneContext, botCount: number, _hasHuman: boolean) {
    ctx.input.clearAll();
    const seed = settings.randomSeed || Math.floor(Math.random() * 2147483647);
    setLevels(generateLevels(seed));

    ctx.state.score = 0;
    ctx.state.lives = settings.lives;
    ctx.state.fuel = settings.startingFuel;
    ctx.state.maxFuel = settings.startingFuel;
    ctx.state.universe = 1;
    ctx.state.planetsCleared = new Array(12).fill(false);
    ctx.state.reactorClears = 0;
    ctx.state.jumpsLeft = settings.maxJumps;

    if (botCount > 0) {
      const rm = new RivalsManager();
      rm.init(botCount);
      ctx.rivals = rm;
    } else {
      ctx.rivals = null;
    }

    ctx.replaceScene(new SolarSystemScene());
  }

  // ========================== RENDERING ==========================

  render(renderer: Renderer) {
    renderer.camX = 0;
    renderer.camY = 0;
    renderer.camScale = 1;
    renderer.beginFrame();

    const cx = renderer.width / 2;
    const cy = renderer.height / 2;

    switch (this.mode) {
      case 'main': this.renderMain(renderer, cx, cy); break;
      case 'multiplayer': this.renderMultiplayer(renderer, cx, cy); break;
      case 'settings': this.renderSettings(renderer, cx, cy); break;
    }
  }

  private renderMain(renderer: Renderer, cx: number, cy: number) {
    const w = renderer.width;
    const h = renderer.height;
    const ctx = renderer.ctx;
    const t = this.blinkTimer;

    // === Background: twinkling starfield ===
    for (let i = 0; i < 60; i++) {
      const sx = ((i * 137.5 + 50) % w);
      const sy = ((i * 97.3 + 30) % h);
      const twinkle = 0.2 + 0.8 * (0.5 + 0.5 * Math.sin(t * (1 + i * 0.07) + i));
      const size = 0.5 + (i % 3) * 0.4;
      ctx.fillStyle = `rgba(180, 190, 220, ${twinkle * 0.6})`;
      ctx.beginPath();
      ctx.arc(sx, sy, size, 0, Math.PI * 2);
      ctx.fill();
    }

    // === Center: Animated mini solar system (scale to screen) ===
    const solarCx = cx;
    const solarCy = cy - 10;
    const solarScale = Math.min(w, h) / 600; // scale orbits to screen

    // Sun (pulsing)
    const sunPulse = (18 + Math.sin(t * 2) * 3) * solarScale;
    const sunGrad = ctx.createRadialGradient(solarCx, solarCy, 0, solarCx, solarCy, sunPulse + 12 * solarScale);
    sunGrad.addColorStop(0, '#FFFF44');
    sunGrad.addColorStop(0.5, '#FFAA00');
    sunGrad.addColorStop(1, 'rgba(255, 100, 0, 0)');
    ctx.fillStyle = sunGrad;
    ctx.beginPath();
    ctx.arc(solarCx, solarCy, sunPulse + 12 * solarScale, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#FFFF88';
    ctx.beginPath();
    ctx.arc(solarCx, solarCy, sunPulse * 0.5, 0, Math.PI * 2);
    ctx.fill();

    // Orbiting planets (scaled to screen)
    const planets = [
      { r: 80 * solarScale, speed: 0.4, size: 5 * solarScale, color: '#44AAFF' },
      { r: 130 * solarScale, speed: 0.25, size: 7 * solarScale, color: '#00CC00' },
      { r: 180 * solarScale, speed: 0.15, size: 4 * solarScale, color: '#FF6644' },
      { r: 230 * solarScale, speed: 0.1, size: 8 * solarScale, color: '#AA44FF' },
    ];

    for (const p of planets) {
      // Orbit path (subtle)
      ctx.strokeStyle = 'rgba(60, 70, 100, 0.3)';
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      ctx.arc(solarCx, solarCy, p.r, 0, Math.PI * 2);
      ctx.stroke();

      // Planet
      const angle = t * p.speed + p.r;
      const px = solarCx + Math.cos(angle) * p.r;
      const py = solarCy + Math.sin(angle) * p.r;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(px, py, p.size, 0, Math.PI * 2);
      ctx.fill();
      // Glow
      ctx.fillStyle = p.color.replace(')', ', 0.15)').replace('rgb', 'rgba').replace('#', '');
      // Simple glow with just a larger circle
      ctx.globalAlpha = 0.15;
      ctx.beginPath();
      ctx.arc(px, py, p.size + 5 * solarScale, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }

    // Animated ship flying around the solar system
    const shipAngle = t * 0.6;
    const shipOrbit = (50 + Math.sin(t * 0.3) * 30) * solarScale;
    const shipX = solarCx + Math.cos(shipAngle) * shipOrbit;
    const shipY = solarCy + Math.sin(shipAngle) * shipOrbit;
    const shipDir = shipAngle + Math.PI / 2;
    const ss = 1.5 * solarScale; // ship scale

    // Ship shape
    ctx.strokeStyle = Colors.ship;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(shipX + Math.cos(shipDir) * 8 * ss, shipY + Math.sin(shipDir) * 8 * ss);
    ctx.lineTo(shipX + Math.cos(shipDir + 2.5) * 6 * ss, shipY + Math.sin(shipDir + 2.5) * 6 * ss);
    ctx.lineTo(shipX + Math.cos(shipDir + Math.PI) * 3 * ss, shipY + Math.sin(shipDir + Math.PI) * 3 * ss);
    ctx.lineTo(shipX + Math.cos(shipDir - 2.5) * 6 * ss, shipY + Math.sin(shipDir - 2.5) * 6 * ss);
    ctx.closePath();
    ctx.stroke();

    // Thrust flame
    const thrustFlicker = 0.5 + Math.random() * 0.5;
    ctx.strokeStyle = `rgba(255, 136, 0, ${thrustFlicker})`;
    ctx.lineWidth = 1.5;
    const thrustLen = (5 + Math.random() * 5) * ss;
    ctx.beginPath();
    ctx.moveTo(
      shipX + Math.cos(shipDir + 2.8) * 4 * ss,
      shipY + Math.sin(shipDir + 2.8) * 4 * ss,
    );
    ctx.lineTo(
      shipX + Math.cos(shipDir + Math.PI) * thrustLen,
      shipY + Math.sin(shipDir + Math.PI) * thrustLen,
    );
    ctx.lineTo(
      shipX + Math.cos(shipDir - 2.8) * 4 * ss,
      shipY + Math.sin(shipDir - 2.8) * 4 * ss,
    );
    ctx.stroke();

    // === Title (over the animation) ===
    // Shadow
    renderer.drawText('LANDITAR', cx + 2, 52, '#000', 52, 'center');
    renderer.drawText('LANDITAR', cx, 50, Colors.star, 52, 'center');
    renderer.drawText('Inspired by the 1982 Atari Classic Gravitar', cx, 88, '#777', 11, 'center');
    renderer.drawText('(also with some inspiration from Apple Lander as published in Windfall magazine)', cx, 104, '#555', 9, 'center');

    // === Left column: Controls ===
    const leftX = 24;
    const colTop = h - 200;
    renderer.drawText('CONTROLS', leftX, colTop, Colors.text, 12, 'left');
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(leftX, colTop + 4);
    ctx.lineTo(leftX + 280, colTop + 4);
    ctx.stroke();

    const controls = [
      ['LEFT/RIGHT  A/D', 'Rotate'],
      ['UP  W', 'Thrust'],
      ['SPACE', 'Fire'],
      ['SHIFT  S', 'Shield / Tractor'],
      ['J', 'Hyperspace Jump'],
      ['1-3', 'Switch PIP'],
    ];
    for (let i = 0; i < controls.length; i++) {
      const y = colTop + 18 + i * 16;
      renderer.drawText(controls[i][0], leftX, y, '#666', 9, 'left');
      renderer.drawText(controls[i][1], leftX + 130, y, '#999', 9, 'left');
    }

    // === Right column: High Scores ===
    const rightX = w - 24;
    const scores = getHighScores();
    renderer.drawText('HIGH SCORES', rightX, colTop, Colors.text, 12, 'right');
    ctx.strokeStyle = '#333';
    ctx.beginPath();
    ctx.moveTo(rightX - 200, colTop + 4);
    ctx.lineTo(rightX, colTop + 4);
    ctx.stroke();

    if (scores.length > 0) {
      for (let i = 0; i < Math.min(6, scores.length); i++) {
        const y = colTop + 18 + i * 16;
        renderer.drawText(`${i + 1}.  ${scores[i].score}`, rightX, y, i === 0 ? Colors.star : Colors.hud, 10, 'right');
      }
    } else {
      renderer.drawText('No scores yet', rightX, colTop + 18, '#444', 9, 'right');
    }

    // === Bottom: Menu bar ===
    ctx.fillStyle = 'rgba(15, 17, 35, 0.9)';
    ctx.fillRect(0, h - 56, w, 56);
    ctx.strokeStyle = '#444';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, h - 56);
    ctx.lineTo(w, h - 56);
    ctx.stroke();

    const menuItems = ['1 PLAYER', 'MULTIPLAYER', 'SETTINGS', 'PREFERENCES', 'LEVEL DEBUG'];
    const menuY = h - 22;
    const spacing = w / (menuItems.length + 1);

    for (let i = 0; i < menuItems.length; i++) {
      const mx = spacing * (i + 1);
      const selected = i === this.menuIndex;
      const color = selected ? Colors.star : '#777';
      const blink = selected && Math.floor(t * 3) % 2 === 0;
      const fontSize = selected ? 18 : 14;
      if (!selected || blink) {
        renderer.drawText(menuItems[i], mx, menuY, color, fontSize, 'center');
      }
      if (selected) {
        ctx.font = `bold ${fontSize}px monospace`;
        const tw = ctx.measureText(menuItems[i]).width;
        ctx.strokeStyle = Colors.star;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(mx - tw / 2, menuY + 6);
        ctx.lineTo(mx + tw / 2, menuY + 6);
        ctx.stroke();
      }
    }
  }

  private renderMultiplayer(renderer: Renderer, cx: number, cy: number) {
    renderer.drawText('MULTIPLAYER SETUP', cx, 50, Colors.star, 28, 'center');

    const y0 = cy - 50;

    // Bots slider
    const botsSelected = this.mpMenuIndex === 0;
    renderer.drawText('BOTS:', cx - 80, y0, botsSelected ? Colors.star : Colors.hud, 16, 'right');
    renderer.drawText(`< ${this.mpBots} >`, cx + 10, y0, botsSelected ? Colors.star : Colors.hud, 16, 'center');
    // Visual dots for bot count
    for (let i = 0; i < 3; i++) {
      const dotX = cx + 60 + i * 20;
      renderer.drawText(i < this.mpBots ? '\u25CF' : '\u25CB', dotX, y0, botsSelected ? Colors.star : '#555', 14, 'center');
    }

    // Human toggle
    const humanSelected = this.mpMenuIndex === 1;
    renderer.drawText('HUMAN OPPONENT:', cx - 80, y0 + 36, humanSelected ? Colors.star : Colors.hud, 16, 'right');
    renderer.drawText(this.mpHuman ? 'YES' : 'NO', cx + 10, y0 + 36, humanSelected ? (this.mpHuman ? '#44FF44' : '#FF4444') : Colors.hud, 16, 'center');

    // Summary
    const parts: string[] = [];
    if (this.mpBots > 0) parts.push(`${this.mpBots} bot${this.mpBots > 1 ? 's' : ''}`);
    if (this.mpHuman) parts.push('1 human');
    const summary = parts.length > 0 ? parts.join(' + ') : 'No opponents';
    renderer.drawText(`vs ${summary}`, cx, y0 + 76, '#888', 12, 'center');

    // Start button
    const startSel = this.mpMenuIndex === 2;
    const blink = startSel && Math.floor(this.blinkTimer * 3) % 2 === 0;
    if (!startSel || blink) {
      renderer.drawText(this.mpHuman ? 'START LOBBY' : 'START GAME', cx, y0 + 110, startSel ? Colors.star : Colors.hud, 18, 'center');
    }

    // Back
    const backSel = this.mpMenuIndex === 3;
    renderer.drawText('BACK', cx, y0 + 145, backSel ? Colors.star : '#555', 14, 'center');

    renderer.drawText('ESC: Back', cx, renderer.height - 20, '#444', 10, 'center');
  }

  private renderSettings(renderer: Renderer, cx: number, cy: number) {
    renderer.drawText('SETTINGS', cx, 40, Colors.star, 28, 'center');
    renderer.drawText('UP/DOWN: Select    LEFT/RIGHT: Adjust (hold to repeat)', cx, 66, Colors.hud, 11, 'center');

    const startY = 100;
    const lineH = 28;
    const labelX = cx - 180;
    const valueX = cx + 10;
    const barW = 100;

    for (let i = 0; i < SETTING_DEFS.length; i++) {
      const def = SETTING_DEFS[i];
      const y = startY + i * lineH;
      const selected = i === this.selectedIndex;
      const color = selected ? Colors.star : Colors.hud;
      const prefix = selected ? '> ' : '  ';

      renderer.drawText(prefix + def.label, labelX, y, color, 14, 'left');

      const val = settings[def.key];
      const formatted = def.format ? def.format(val) : String(val);
      renderer.drawText(formatted, valueX + barW + 14, y, color, 14, 'left');

      const pct = (val - def.min) / (def.max - def.min);
      renderer.ctx.strokeStyle = selected ? '#444444' : '#222222';
      renderer.ctx.lineWidth = 1;
      renderer.ctx.strokeRect(valueX, y - 10, barW, 12);
      renderer.ctx.fillStyle = selected ? Colors.ship : '#336688';
      renderer.ctx.fillRect(valueX + 1, y - 9, (barW - 2) * pct, 10);

      if (selected) {
        renderer.drawText('<', valueX - 12, y, Colors.star, 14, 'center');
        renderer.drawText('>', valueX + barW + 6, y, Colors.star, 14, 'left');
      }
    }

    const bottomY = startY + SETTING_DEFS.length * lineH + 20;
    if (Math.floor(this.blinkTimer * 2) % 2 === 0) {
      renderer.drawText('PRESS ENTER TO START', cx, bottomY, Colors.ship, 16, 'center');
    }
    renderer.drawText('R: Reset Defaults    ESC: Back', cx, bottomY + 30, Colors.hud, 12, 'center');
  }
}
