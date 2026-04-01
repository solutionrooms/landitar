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

const REPEAT_DELAY = 0.35;  // seconds before key repeat starts
const REPEAT_RATE = 0.06;   // seconds between repeats

export class TitleScene implements Scene {
  private blinkTimer = 0;
  private ctx!: SceneContext;
  private selectedIndex = 0;
  private showSettings = false;
  private menuIndex = 0; // 0=1p, 1=3bots, 2=2p, 3=2p+2bots, 4=settings, 5=prefs, 6=debug

  // Key repeat state for held arrow keys in settings
  private holdDir = 0;        // -1 left, +1 right, 0 none
  private holdTimer = 0;
  private holdRepeating = false;

  enter(ctx: SceneContext) {
    this.ctx = ctx;
  }

  exit() {}

  update(dt: number, ctx: SceneContext) {
    this.blinkTimer += dt;
    const { input } = ctx;

    if (this.showSettings) {
      this.updateSettings(dt, input, ctx);
    } else {
      if (input.wasPressed('ArrowUp') || input.wasPressed('KeyW')) {
        this.menuIndex = (this.menuIndex - 1 + 7) % 7;
      }
      if (input.wasPressed('ArrowDown') || input.wasPressed('KeyS')) {
        this.menuIndex = (this.menuIndex + 1) % 7;
      }
      if (input.wasPressed('Enter') || input.wasPressed('Space')) {
        if (this.menuIndex === 0) {
          this.startGame(ctx);
        } else if (this.menuIndex === 1) {
          this.startGame(ctx, 3);
        } else if (this.menuIndex === 2) {
          this.start2Player(ctx, 0);
        } else if (this.menuIndex === 3) {
          this.start2Player(ctx, 2);
        } else if (this.menuIndex === 4) {
          this.showSettings = true;
        } else if (this.menuIndex === 5) {
          ctx.pushScene(new PreferencesScene());
        } else if (this.menuIndex === 6) {
          const seed = settings.randomSeed || Math.floor(Math.random() * 2147483647);
          setLevels(generateLevels(seed));
          ctx.pushScene(new LevelDebugScene());
        }
      }
    }
  }

  private updateSettings(dt: number, input: InputManager, ctx: SceneContext) {
    // Up/down navigation
    if (input.wasPressed('ArrowUp') || input.wasPressed('KeyW')) {
      this.selectedIndex = (this.selectedIndex - 1 + SETTING_DEFS.length) % SETTING_DEFS.length;
    }
    if (input.wasPressed('ArrowDown') || input.wasPressed('KeyS')) {
      this.selectedIndex = (this.selectedIndex + 1) % SETTING_DEFS.length;
    }

    // Left/right adjustment with key repeat
    const leftHeld = input.isDown('ArrowLeft') || input.isDown('KeyA');
    const rightHeld = input.isDown('ArrowRight') || input.isDown('KeyD');
    const newDir = leftHeld ? -1 : rightHeld ? 1 : 0;

    if (newDir !== 0) {
      if (newDir !== this.holdDir) {
        // Direction changed or just started - immediate adjust + reset timer
        this.holdDir = newDir;
        this.holdTimer = 0;
        this.holdRepeating = false;
        this.adjustSetting(SETTING_DEFS[this.selectedIndex], newDir);
      } else {
        // Same direction held - repeat after delay
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

    // Reset defaults
    if (input.wasPressed('KeyR')) {
      resetSettings();
    }

    // Back / Start
    if (input.wasPressed('Escape')) {
      this.showSettings = false;
    }
    if (input.wasPressed('Enter')) {
      this.startGame(ctx);
    }
  }

  private adjustSetting(def: SettingDef, direction: number) {
    const current = settings[def.key];
    let next = current + def.step * direction;
    next = Math.round(next / def.step) * def.step;
    next = Math.max(def.min, Math.min(def.max, next));
    (settings as any)[def.key] = next;
  }

  private start2Player(ctx: SceneContext, botCount = 2) {
    const session = ctx.multiplayer ?? new MultiplayerSession();
    const canvas = ctx.renderer.ctx.canvas as HTMLCanvasElement;
    ctx.replaceScene(new LobbyScene(session, canvas, botCount));
  }

  private startGame(ctx: SceneContext, botCount = 0) {
    const seed = settings.randomSeed || Math.floor(Math.random() * 2147483647);
    setLevels(generateLevels(seed));

    ctx.state.score = 0;
    ctx.state.lives = settings.lives;
    ctx.state.fuel = settings.startingFuel;
    ctx.state.maxFuel = settings.startingFuel;
    ctx.state.universe = 1;
    ctx.state.planetsCleared = new Array(12).fill(false);
    ctx.state.reactorClears = 0;

    // Set up rivals
    if (botCount > 0) {
      const rm = new RivalsManager();
      rm.init(botCount);
      ctx.rivals = rm;
    } else {
      ctx.rivals = null;
    }

    ctx.replaceScene(new SolarSystemScene());
  }

  render(renderer: Renderer) {
    renderer.camX = 0;
    renderer.camY = 0;
    renderer.camScale = 1;
    renderer.beginFrame();

    const cx = renderer.width / 2;
    const cy = renderer.height / 2;

    if (this.showSettings) {
      this.renderSettings(renderer, cx, cy);
    } else {
      this.renderTitle(renderer, cx, cy);
    }
  }

  private renderTitle(renderer: Renderer, cx: number, cy: number) {
    renderer.drawText('LANDITAR', cx, cy - 80, Colors.star, 48, 'center');
    renderer.drawText('Inspired by the 1982 Atari Classic Gravitar', cx, cy - 30, Colors.hud, 14, 'center');

    const y0 = cy + 40;
    renderer.drawText('CONTROLS:', cx, y0, Colors.text, 14, 'center');
    renderer.drawText('LEFT/RIGHT or A/D  -  Rotate', cx, y0 + 24, Colors.hud, 12, 'center');
    renderer.drawText('UP or W  -  Thrust', cx, y0 + 44, Colors.hud, 12, 'center');
    renderer.drawText('SPACE  -  Fire', cx, y0 + 64, Colors.hud, 12, 'center');
    renderer.drawText('SHIFT or S  -  Shield / Tractor Beam', cx, y0 + 84, Colors.hud, 12, 'center');

    // Menu options
    const menuItems = ['1 PLAYER', 'VS 3 BOTS', '2P ONLY', '2P + 2 BOTS', 'SETTINGS', 'PREFERENCES', 'LEVEL DEBUG'];
    const menuY = cy + 150;
    for (let i = 0; i < menuItems.length; i++) {
      const selected = i === this.menuIndex;
      const color = selected ? Colors.star : Colors.hud;
      const prefix = selected ? '> ' : '  ';
      const blink = selected && Math.floor(this.blinkTimer * 3) % 2 === 0;
      if (!selected || blink) {
        renderer.drawText(prefix + menuItems[i], cx, menuY + i * 28, color, 16, 'center');
      }
    }

    // High scores
    const scores = getHighScores();
    if (scores.length > 0) {
      const hsY = menuY + menuItems.length * 28 + 12;
      renderer.drawText('HIGH SCORES', cx, hsY, Colors.text, 14, 'center');
      for (let i = 0; i < Math.min(5, scores.length); i++) {
        const e = scores[i];
        const rankStr = `${i + 1}.`.padStart(3);
        const scoreStr = String(e.score).padStart(8);
        renderer.drawText(`${rankStr}${scoreStr}`, cx, hsY + 20 + i * 18, Colors.hud, 12, 'center');
      }
    }
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
