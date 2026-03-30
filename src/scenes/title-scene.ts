import { type Scene, type SceneContext } from './scene.js';
import { type Renderer } from '../render/renderer.js';
import { Colors } from '../render/colors.js';
import { SolarSystemScene } from './solar-system-scene.js';
import { settings, SETTING_DEFS, resetSettings, type SettingDef } from '../core/settings.js';

export class TitleScene implements Scene {
  private blinkTimer = 0;
  private ctx!: SceneContext;
  private selectedIndex = 0;
  private showSettings = false;

  enter(ctx: SceneContext) {
    this.ctx = ctx;
  }

  exit() {}

  update(dt: number, ctx: SceneContext) {
    this.blinkTimer += dt;
    const { input } = ctx;

    if (this.showSettings) {
      // Navigate settings
      if (input.wasPressed('ArrowUp') || input.wasPressed('KeyW')) {
        this.selectedIndex = (this.selectedIndex - 1 + SETTING_DEFS.length) % SETTING_DEFS.length;
      }
      if (input.wasPressed('ArrowDown') || input.wasPressed('KeyS')) {
        this.selectedIndex = (this.selectedIndex + 1) % SETTING_DEFS.length;
      }

      const def = SETTING_DEFS[this.selectedIndex];
      if (input.wasPressed('ArrowLeft') || input.wasPressed('KeyA')) {
        this.adjustSetting(def, -1);
      }
      if (input.wasPressed('ArrowRight') || input.wasPressed('KeyD')) {
        this.adjustSetting(def, 1);
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
    } else {
      if (input.wasPressed('Enter')) {
        this.startGame(ctx);
      }
      if (input.wasPressed('Space')) {
        this.showSettings = true;
      }
    }
  }

  private adjustSetting(def: SettingDef, direction: number) {
    const current = settings[def.key];
    let next = current + def.step * direction;
    next = Math.round(next / def.step) * def.step; // avoid float drift
    next = Math.max(def.min, Math.min(def.max, next));
    (settings as any)[def.key] = next;
  }

  private startGame(ctx: SceneContext) {
    ctx.state.score = 0;
    ctx.state.lives = settings.lives;
    ctx.state.fuel = settings.startingFuel;
    ctx.state.maxFuel = settings.startingFuel;
    ctx.state.universe = 1;
    ctx.state.planetsCleared = new Array(12).fill(false);
    ctx.state.reactorClears = 0;
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
    renderer.drawText('GRAVITAR', cx, cy - 80, Colors.star, 48, 'center');
    renderer.drawText('A Recreation of the 1982 Atari Classic', cx, cy - 30, Colors.hud, 14, 'center');

    const y0 = cy + 40;
    renderer.drawText('CONTROLS:', cx, y0, Colors.text, 14, 'center');
    renderer.drawText('LEFT/RIGHT or A/D  -  Rotate', cx, y0 + 24, Colors.hud, 12, 'center');
    renderer.drawText('UP or W  -  Thrust', cx, y0 + 44, Colors.hud, 12, 'center');
    renderer.drawText('SPACE  -  Fire', cx, y0 + 64, Colors.hud, 12, 'center');
    renderer.drawText('SHIFT or S  -  Shield / Tractor Beam', cx, y0 + 84, Colors.hud, 12, 'center');

    if (Math.floor(this.blinkTimer * 2) % 2 === 0) {
      renderer.drawText('PRESS ENTER TO START', cx, cy + 170, Colors.ship, 16, 'center');
    }
    renderer.drawText('PRESS SPACE FOR SETTINGS', cx, cy + 200, Colors.hud, 12, 'center');
  }

  private renderSettings(renderer: Renderer, cx: number, cy: number) {
    renderer.drawText('SETTINGS', cx, 40, Colors.star, 28, 'center');
    renderer.drawText('UP/DOWN: Select   LEFT/RIGHT: Adjust   R: Reset Defaults', cx, 68, Colors.hud, 11, 'center');

    const startY = 100;
    const lineH = 28;
    const labelX = cx - 180;
    const valueX = cx + 120;
    const barX = cx + 10;
    const barW = 100;

    for (let i = 0; i < SETTING_DEFS.length; i++) {
      const def = SETTING_DEFS[i];
      const y = startY + i * lineH;
      const selected = i === this.selectedIndex;

      const color = selected ? Colors.star : Colors.hud;
      const prefix = selected ? '> ' : '  ';

      renderer.drawText(prefix + def.label, labelX, y, color, 14, 'left');

      // Value
      const val = settings[def.key];
      const formatted = def.format ? def.format(val) : String(val);
      renderer.drawText(formatted, valueX + barW + 10, y, color, 14, 'left');

      // Bar showing position within range
      const pct = (val - def.min) / (def.max - def.min);
      renderer.ctx.strokeStyle = selected ? '#444444' : '#222222';
      renderer.ctx.lineWidth = 1;
      renderer.ctx.strokeRect(valueX, y - 10, barW, 12);

      renderer.ctx.fillStyle = selected ? Colors.ship : '#336688';
      renderer.ctx.fillRect(valueX + 1, y - 9, (barW - 2) * pct, 10);

      // Arrow indicators when selected
      if (selected) {
        renderer.drawText('<', valueX - 14, y, Colors.star, 14, 'center');
        renderer.drawText('>', valueX + barW + 4, y, Colors.star, 14, 'left');
      }
    }

    const bottomY = startY + SETTING_DEFS.length * lineH + 20;

    if (Math.floor(this.blinkTimer * 2) % 2 === 0) {
      renderer.drawText('PRESS ENTER TO START', cx, bottomY, Colors.ship, 16, 'center');
    }
    renderer.drawText('ESC: Back to Title', cx, bottomY + 30, Colors.hud, 12, 'center');
  }
}
