import { type Scene, type SceneContext } from './scene.js';
import { type Renderer } from '../render/renderer.js';

const DURATION = 0.4; // total animation time in seconds

/** Brief hyperspace warp animation between planets */
export class HyperspaceScene implements Scene {
  private timer = 0;
  private targetScene: Scene;
  private ctx!: SceneContext;
  private stars: { x: number; y: number; speed: number }[] = [];

  constructor(targetScene: Scene) {
    this.targetScene = targetScene;
  }

  enter(ctx: SceneContext) {
    this.ctx = ctx;
    // Generate streaking star field
    for (let i = 0; i < 80; i++) {
      this.stars.push({
        x: (Math.random() - 0.5) * 2,  // -1 to 1 normalized
        y: (Math.random() - 0.5) * 2,
        speed: 0.5 + Math.random() * 2,
      });
    }
  }

  exit() {}

  update(dt: number, ctx: SceneContext) {
    this.timer += dt;
    if (this.timer >= DURATION) {
      ctx.replaceScene(this.targetScene);
    }
  }

  render(renderer: Renderer) {
    renderer.camX = 0;
    renderer.camY = 0;
    renderer.camScale = 1;
    renderer.beginFrame();

    const w = renderer.width;
    const h = renderer.height;
    const cx = w / 2;
    const cy = h / 2;
    const ctx = renderer.ctx;
    const t = this.timer / DURATION; // 0 to 1

    // Stretch factor increases over time
    const stretch = 1 + t * 30;
    const brightness = t < 0.7 ? t / 0.7 : 1;

    // Draw streaking stars from center outward
    for (const star of this.stars) {
      const len = star.speed * stretch;
      const angle = Math.atan2(star.y, star.x);
      const dist = Math.sqrt(star.x * star.x + star.y * star.y);
      const startDist = dist * 100 * (1 + t * 2);
      const endDist = startDist + len * 60;

      const x1 = cx + Math.cos(angle) * startDist;
      const y1 = cy + Math.sin(angle) * startDist;
      const x2 = cx + Math.cos(angle) * endDist;
      const y2 = cy + Math.sin(angle) * endDist;

      const alpha = brightness * (0.3 + star.speed * 0.3);
      ctx.strokeStyle = `rgba(150, 180, 255, ${Math.min(1, alpha)})`;
      ctx.lineWidth = 1 + t * 1.5;
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
    }

    // White flash at the end
    if (t > 0.8) {
      const flash = (t - 0.8) / 0.2;
      ctx.fillStyle = `rgba(200, 220, 255, ${flash * 0.6})`;
      ctx.fillRect(0, 0, w, h);
    }

    // Text
    renderer.drawText('HYPERSPACE', cx, cy, `rgba(150, 200, 255, ${brightness})`, 20, 'center');
  }
}
