import { type Scene, type SceneContext } from './scene.js';
import { type Renderer } from '../render/renderer.js';
import { Colors } from '../render/colors.js';
import { LEVELS } from '../levels/level-data.js';
import { validateLevel, type ValidationIssue } from '../levels/level-generator.js';
import { PlanetScene } from './planet-scene.js';

const COLS = 4;
const ROWS = 3;

interface LevelInfo {
  name: string;
  issues: ValidationIssue[];
  minX: number; maxX: number; minY: number; maxY: number;
}

export class LevelDebugScene implements Scene {
  private ctx!: SceneContext;
  private selected = 0;
  private levels: LevelInfo[] = [];

  enter(ctx: SceneContext) {
    this.ctx = ctx;
    // Run validation on all levels
    this.levels = LEVELS.map(level => {
      const issues = validateLevel(level);
      const xs = level.terrain.map(p => p.x);
      const ys = level.terrain.map(p => p.y);
      return {
        name: level.name,
        issues,
        minX: Math.min(...xs), maxX: Math.max(...xs),
        minY: Math.min(...ys), maxY: Math.max(...ys),
      };
    });
  }

  exit() {}

  update(dt: number, ctx: SceneContext) {
    const { input } = ctx;
    if (input.wasPressed('ArrowRight')) this.selected = Math.min(this.selected + 1, LEVELS.length - 1);
    if (input.wasPressed('ArrowLeft')) this.selected = Math.max(this.selected - 1, 0);
    if (input.wasPressed('ArrowDown')) this.selected = Math.min(this.selected + COLS, LEVELS.length - 1);
    if (input.wasPressed('ArrowUp')) this.selected = Math.max(this.selected - COLS, 0);

    if (input.wasPressed('Enter')) {
      ctx.replaceScene(new PlanetScene(this.selected, null));
    }
    if (input.wasPressed('Escape')) {
      ctx.popScene();
    }
  }

  render(renderer: Renderer) {
    renderer.camX = 0;
    renderer.camY = 0;
    renderer.camScale = 1;
    renderer.beginFrame();

    const w = renderer.width;
    const h = renderer.height;
    const ctx = renderer.ctx;

    renderer.drawText('LEVEL DEBUG', w / 2, 18, Colors.star, 20, 'center');
    renderer.drawText('ARROWS: Select  ENTER: Play  ESC: Back', w / 2, 36, Colors.hud, 10, 'center');

    const margin = 12;
    const topOffset = 48;
    const cellW = (w - margin * (COLS + 1)) / COLS;
    const cellH = (h - topOffset - margin * (ROWS + 1)) / ROWS;

    for (let i = 0; i < LEVELS.length && i < COLS * ROWS; i++) {
      const col = i % COLS;
      const row = Math.floor(i / COLS);
      const cx = margin + col * (cellW + margin);
      const cy = topOffset + margin + row * (cellH + margin);

      const level = LEVELS[i];
      const info = this.levels[i];
      const isSelected = i === this.selected;
      const hasIssues = info.issues.length > 0;

      // Cell background
      ctx.fillStyle = isSelected ? '#1a1a30' : '#0a0a15';
      ctx.fillRect(cx, cy, cellW, cellH);

      // Border
      const borderColor = hasIssues ? '#FF4444' : (isSelected ? Colors.star : '#333333');
      ctx.strokeStyle = borderColor;
      ctx.lineWidth = isSelected ? 2 : 1;
      ctx.strokeRect(cx, cy, cellW, cellH);

      // Terrain preview
      const previewMargin = 6;
      const previewX = cx + previewMargin;
      const previewY = cy + 16;
      const previewW = cellW - previewMargin * 2;
      const previewH = cellH - 42;

      this.drawTerrainPreview(ctx, level, info, previewX, previewY, previewW, previewH);

      // Level name + status
      const nameColor = hasIssues ? '#FF4444' : Colors.star;
      renderer.drawText(level.name, cx + cellW / 2, cy + 10, nameColor, 10, 'center');

      // Closed indicator
      if (level.closed) {
        renderer.drawText('[T]', cx + cellW - 14, cy + 10, '#666', 8, 'center');
      }

      // Issue count or OK
      const statusY = cy + cellH - 8;
      if (hasIssues) {
        const issueText = info.issues.map(i => i.rule).join(', ');
        renderer.drawText(issueText, cx + cellW / 2, statusY, '#FF4444', 7, 'center');
      } else {
        renderer.drawText('OK', cx + cellW / 2, statusY, '#44FF44', 8, 'center');
      }
    }

    // Detail panel for selected level
    if (this.levels[this.selected]) {
      const info = this.levels[this.selected];
      const level = LEVELS[this.selected];
      const detailY = h - 4;
      let detailText = `${level.name} | ${level.closed ? 'TUNNEL' : 'CAVE'} | ` +
        `turrets:${level.turrets.length} depots:${level.fuelDepots.length} grav:${level.gravity}`;
      if (info.issues.length > 0) {
        detailText += ' | ISSUES: ' + info.issues.map(i => i.detail).join('; ');
      }
      renderer.drawText(detailText, w / 2, detailY, Colors.hud, 9, 'center');
    }
  }

  private drawTerrainPreview(
    ctx: CanvasRenderingContext2D,
    level: typeof LEVELS[0],
    info: LevelInfo,
    px: number, py: number, pw: number, ph: number,
  ) {
    // Clip to preview area
    ctx.save();
    ctx.beginPath();
    ctx.rect(px, py, pw, ph);
    ctx.clip();

    // Compute scale to fit terrain in preview
    const tw = info.maxX - info.minX || 1;
    const th = info.maxY - info.minY || 1;
    const scale = Math.min(pw / tw, ph / th) * 0.9;
    const ox = px + pw / 2;
    const oy = py + ph / 2;
    const tcx = (info.minX + info.maxX) / 2;
    const tcy = (info.minY + info.maxY) / 2;

    const sx = (wx: number) => ox + (wx - tcx) * scale;
    const sy = (wy: number) => oy - (wy - tcy) * scale; // Y flip

    // Draw terrain
    ctx.strokeStyle = Colors.terrain;
    ctx.lineWidth = 1;
    ctx.beginPath();
    const pts = level.terrain;
    if (pts.length > 0) {
      ctx.moveTo(sx(pts[0].x), sy(pts[0].y));
      for (let i = 1; i < pts.length; i++) {
        ctx.lineTo(sx(pts[i].x), sy(pts[i].y));
      }
      if (level.closed) ctx.closePath();
    }
    ctx.stroke();

    // Draw islands
    if (level.islands) {
      ctx.strokeStyle = '#006600';
      for (const island of level.islands) {
        ctx.beginPath();
        ctx.moveTo(sx(island[0].x), sy(island[0].y));
        for (let i = 1; i < island.length; i++) {
          ctx.lineTo(sx(island[i].x), sy(island[i].y));
        }
        ctx.closePath();
        ctx.stroke();
      }
    }

    // Draw turrets as dots
    for (const t of level.turrets) {
      ctx.fillStyle = Colors.turret;
      ctx.beginPath();
      ctx.arc(sx(t.x), sy(t.y), 2, 0, Math.PI * 2);
      ctx.fill();
    }

    // Draw depots as dots
    for (const d of level.fuelDepots) {
      ctx.fillStyle = Colors.fuelDepot;
      ctx.beginPath();
      ctx.arc(sx(d.x), sy(d.y), 2, 0, Math.PI * 2);
      ctx.fill();
    }

    // Draw landing pad
    if (level.padX !== undefined) {
      ctx.fillStyle = '#FFFF00';
      ctx.fillRect(sx(level.padX) - 3, sy(info.minY + 10) - 1, 6, 2);
    }

    // Draw spawn point
    ctx.fillStyle = Colors.ship;
    ctx.beginPath();
    ctx.arc(sx(level.spawnX), sy(level.spawnY), 3, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }
}
