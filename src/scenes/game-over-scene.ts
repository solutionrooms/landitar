import { type Scene, type SceneContext } from './scene.js';
import { type Renderer } from '../render/renderer.js';
import { Colors } from '../render/colors.js';
import { TitleScene } from './title-scene.js';

export class GameOverScene implements Scene {
  private timer = 0;
  private score = 0;

  enter(ctx: SceneContext) {
    this.score = ctx.state.score;
  }

  exit() {}

  update(dt: number, ctx: SceneContext) {
    this.timer += dt;
    if (this.timer > 2 && ctx.input.start) {
      ctx.replaceScene(new TitleScene());
    }
  }

  render(renderer: Renderer) {
    renderer.camX = 0;
    renderer.camY = 0;
    renderer.camScale = 1;
    renderer.beginFrame();

    const cx = renderer.width / 2;
    const cy = renderer.height / 2;

    renderer.drawText('GAME OVER', cx, cy - 40, Colors.turret, 36, 'center');
    renderer.drawText(`FINAL SCORE: ${this.score}`, cx, cy + 20, Colors.star, 20, 'center');

    if (this.timer > 2 && Math.floor(this.timer * 2) % 2 === 0) {
      renderer.drawText('PRESS ENTER TO CONTINUE', cx, cy + 80, Colors.hud, 14, 'center');
    }
  }
}
