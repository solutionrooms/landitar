import { type Scene, type SceneContext } from './scene.js';
import { type Renderer } from '../render/renderer.js';
import { Colors } from '../render/colors.js';
import { SolarSystemScene } from './solar-system-scene.js';

export class TitleScene implements Scene {
  private blinkTimer = 0;
  private ctx!: SceneContext;

  enter(ctx: SceneContext) {
    this.ctx = ctx;
  }

  exit() {}

  update(dt: number, ctx: SceneContext) {
    this.blinkTimer += dt;

    if (ctx.input.start) {
      // Reset game state
      ctx.state.score = 0;
      ctx.state.lives = 3;
      ctx.state.fuel = ctx.state.maxFuel;
      ctx.state.universe = 1;
      ctx.state.planetsCleared = new Array(12).fill(false);
      ctx.state.reactorClears = 0;

      ctx.replaceScene(new SolarSystemScene());
    }
  }

  render(renderer: Renderer) {
    renderer.camX = 0;
    renderer.camY = 0;
    renderer.camScale = 1;
    renderer.beginFrame();

    const cx = renderer.width / 2;
    const cy = renderer.height / 2;

    // Title
    renderer.drawText('GRAVITAR', cx, cy - 80, Colors.star, 48, 'center');

    // Subtitle
    renderer.drawText('A Recreation of the 1982 Atari Classic', cx, cy - 30, Colors.hud, 14, 'center');

    // Controls
    const controlY = cy + 40;
    renderer.drawText('CONTROLS:', cx, controlY, Colors.text, 14, 'center');
    renderer.drawText('LEFT/RIGHT or A/D  -  Rotate', cx, controlY + 24, Colors.hud, 12, 'center');
    renderer.drawText('UP or W  -  Thrust', cx, controlY + 44, Colors.hud, 12, 'center');
    renderer.drawText('SPACE  -  Fire', cx, controlY + 64, Colors.hud, 12, 'center');
    renderer.drawText('SHIFT or S  -  Shield / Tractor Beam', cx, controlY + 84, Colors.hud, 12, 'center');

    // Start prompt (blinking)
    if (Math.floor(this.blinkTimer * 2) % 2 === 0) {
      renderer.drawText('PRESS ENTER OR SPACE TO START', cx, cy + 180, Colors.ship, 16, 'center');
    }
  }
}
