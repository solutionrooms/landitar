import { type Scene, type SceneContext } from './scene.js';
import { type Renderer } from '../render/renderer.js';
import { Colors } from '../render/colors.js';
import { LEVELS, type LevelData } from '../levels/level-data.js';
import { validateLevel, lastGenerationLog, type ValidationIssue, type RejectedAttempt } from '../levels/level-generator.js';
import { PlanetScene } from './planet-scene.js';

const COLS = 4;
const ROWS = 3;

interface LevelInfo {
  name: string;
  issues: ValidationIssue[];
  fixups: string[];
  rejected: RejectedAttempt[];
  minX: number; maxX: number; minY: number; maxY: number;
}

type ViewMode = 'grid' | 'detail';

export class LevelDebugScene implements Scene {
  private ctx!: SceneContext;
  private selected = 0;
  private levels: LevelInfo[] = [];
  private mode: ViewMode = 'grid';
  private detailScroll = 0;
  private copyMsg = '';
  private copyMsgTimer = 0;

  enter(ctx: SceneContext) {
    this.ctx = ctx;
    const log = lastGenerationLog;

    this.levels = LEVELS.map((level, i) => {
      const issues = validateLevel(level);
      const xs = level.terrain.map(p => p.x);
      const ys = level.terrain.map(p => p.y);
      const rejected = log?.rejected.filter(r => r.name === LEVELS[i].name.replace(' [!]', '')) ?? [];
      const fixups = log?.fixups.find(f => f.name === LEVELS[i].name.replace(' [!]', ''))?.removed ?? [];
      return {
        name: level.name,
        issues, fixups, rejected,
        minX: Math.min(...xs), maxX: Math.max(...xs),
        minY: Math.min(...ys), maxY: Math.max(...ys),
      };
    });
  }

  exit() {}

  update(dt: number, ctx: SceneContext) {
    const { input } = ctx;
    if (this.copyMsgTimer > 0) this.copyMsgTimer -= dt;

    // C key: copy selected level data to clipboard
    if (input.wasPressed('KeyC')) {
      this.copyLevelData();
    }

    if (this.mode === 'grid') {
      if (input.wasPressed('ArrowRight')) this.selected = Math.min(this.selected + 1, LEVELS.length - 1);
      if (input.wasPressed('ArrowLeft')) this.selected = Math.max(this.selected - 1, 0);
      if (input.wasPressed('ArrowDown')) this.selected = Math.min(this.selected + COLS, LEVELS.length - 1);
      if (input.wasPressed('ArrowUp')) this.selected = Math.max(this.selected - COLS, 0);

      if (input.wasPressed('Enter')) {
        ctx.replaceScene(new PlanetScene(this.selected, null));
      }
      if (input.wasPressed('Space')) {
        this.mode = 'detail';
        this.detailScroll = this.levels[this.selected].rejected.length; // start on FINAL tab
      }
      if (input.wasPressed('Escape')) {
        ctx.popScene();
      }
    } else {
      const info = this.levels[this.selected];
      const maxScroll = info.rejected.length;
      if (input.wasPressed('ArrowRight')) this.detailScroll = Math.min(this.detailScroll + 1, maxScroll);
      if (input.wasPressed('ArrowLeft')) this.detailScroll = Math.max(this.detailScroll - 1, 0);
      if (input.wasPressed('Escape') || input.wasPressed('Space')) {
        this.mode = 'grid';
      }
      if (input.wasPressed('Enter')) {
        ctx.replaceScene(new PlanetScene(this.selected, null));
      }
    }
  }

  private copyLevelData() {
    const level = LEVELS[this.selected];
    const info = this.levels[this.selected];
    const log = lastGenerationLog;

    const data: any = {
      name: level.name,
      index: this.selected,
      seed: log?.seed,
      closed: level.closed,
      gravity: level.gravity,
      spawnX: level.spawnX,
      spawnY: level.spawnY,
      padX: level.padX,
      terrain: level.terrain,
      turrets: level.turrets,
      fuelDepots: level.fuelDepots,
      islands: level.islands,
      validation: info.issues.map(i => `${i.rule}: ${i.detail}`),
      fixups: info.fixups,
    };

    const text = JSON.stringify(data, null, 2);
    navigator.clipboard.writeText(text).then(() => {
      this.copyMsg = `Copied ${level.name} (${text.length} chars)`;
      this.copyMsgTimer = 2;
    }).catch(() => {
      this.copyMsg = 'Copy failed — check permissions';
      this.copyMsgTimer = 2;
    });
  }

  render(renderer: Renderer) {
    renderer.camX = 0;
    renderer.camY = 0;
    renderer.camScale = 1;
    renderer.beginFrame();

    if (this.mode === 'grid') {
      this.renderGrid(renderer);
    } else {
      this.renderDetail(renderer);
    }
  }

  private renderGrid(renderer: Renderer) {
    const w = renderer.width;
    const h = renderer.height;
    const ctx = renderer.ctx;

    renderer.drawText('LEVEL DEBUG', w / 2, 18, Colors.star, 20, 'center');
    renderer.drawText('ARROWS: Select  ENTER: Play  SPACE: Detail  C: Copy  ESC: Back', w / 2, 36, Colors.hud, 10, 'center');
    if (this.copyMsgTimer > 0) {
      renderer.drawText(this.copyMsg, w / 2, 50, '#44FF44', 10, 'center');
    }

    const margin = 12;
    const topOffset = 48;
    const cellW = (w - margin * (COLS + 1)) / COLS;
    const cellH = (h - topOffset - margin * (ROWS + 1) - 20) / ROWS;

    for (let i = 0; i < LEVELS.length && i < COLS * ROWS; i++) {
      const col = i % COLS;
      const row = Math.floor(i / COLS);
      const cx = margin + col * (cellW + margin);
      const cy = topOffset + margin + row * (cellH + margin);

      const level = LEVELS[i];
      const info = this.levels[i];
      const isSelected = i === this.selected;
      const hasIssues = info.issues.length > 0;
      const hadRejections = info.rejected.length > 0;
      const hadFixups = info.fixups.length > 0;

      // Cell background
      ctx.fillStyle = isSelected ? '#1a1a30' : '#0a0a15';
      ctx.fillRect(cx, cy, cellW, cellH);

      // Border color: red=issues, orange=had rejections/fixups, green=clean
      let borderColor = '#333333';
      if (hasIssues) borderColor = '#FF4444';
      else if (hadRejections) borderColor = '#FF8800';
      else if (hadFixups) borderColor = '#AAAA00';
      if (isSelected) borderColor = Colors.star;
      ctx.strokeStyle = borderColor;
      ctx.lineWidth = isSelected ? 2 : 1;
      ctx.strokeRect(cx, cy, cellW, cellH);

      // Terrain preview
      const previewMargin = 6;
      const previewX = cx + previewMargin;
      const previewY = cy + 16;
      const previewW = cellW - previewMargin * 2;
      const previewH = cellH - 42;

      this.drawTerrainPreview(ctx, level.terrain, level.closed, level.turrets,
        level.fuelDepots, level.islands, level.spawnX, level.spawnY, level.padX,
        info, previewX, previewY, previewW, previewH, Colors.terrain);

      // Level name
      const nameColor = hasIssues ? '#FF4444' : (hadRejections ? '#FF8800' : Colors.star);
      renderer.drawText(level.name, cx + cellW / 2, cy + 10, nameColor, 10, 'center');

      if (level.closed) {
        renderer.drawText('[T]', cx + cellW - 14, cy + 10, '#666', 8, 'center');
      }

      // Status line
      const statusY = cy + cellH - 8;
      if (hasIssues) {
        renderer.drawText(info.issues.map(i => i.rule).join(', '), cx + cellW / 2, statusY, '#FF4444', 7, 'center');
      } else if (hadRejections || hadFixups) {
        const parts: string[] = [];
        if (hadRejections) parts.push(`${info.rejected.length} rejected`);
        if (hadFixups) parts.push(info.fixups.join(', '));
        renderer.drawText(parts.join(' | '), cx + cellW / 2, statusY, '#AAAA00', 7, 'center');
      } else {
        renderer.drawText('OK', cx + cellW / 2, statusY, '#44FF44', 8, 'center');
      }
    }

    // Detail bar
    if (this.levels[this.selected]) {
      const info = this.levels[this.selected];
      const level = LEVELS[this.selected];
      const detailY = h - 6;
      let text = `${level.name} | ${level.closed ? 'TUNNEL' : 'CAVE'} | ` +
        `turrets:${level.turrets.length} depots:${level.fuelDepots.length} grav:${level.gravity}`;
      if (info.rejected.length > 0) text += ` | ${info.rejected.length} rejected attempts`;
      if (info.fixups.length > 0) text += ` | fixups: ${info.fixups.join(', ')}`;
      renderer.drawText(text, w / 2, detailY, Colors.hud, 9, 'center');
    }
  }

  private renderDetail(renderer: Renderer) {
    const w = renderer.width;
    const h = renderer.height;
    const ctx = renderer.ctx;
    const info = this.levels[this.selected];
    const level = LEVELS[this.selected];

    // Header
    renderer.drawText(`${level.name} — GENERATION HISTORY`, w / 2, 18, Colors.star, 18, 'center');
    renderer.drawText('LEFT/RIGHT: Browse attempts  C: Copy  ESC: Back  ENTER: Play', w / 2, 36, Colors.hud, 10, 'center');
    if (this.copyMsgTimer > 0) {
      renderer.drawText(this.copyMsg, w / 2, 50, '#44FF44', 10, 'center');
    }

    // Show tabs: [Rejected 1] [Rejected 2] ... [Final]
    const tabY = 54;
    const tabW = 100;
    const totalTabs = info.rejected.length + 1;
    const tabStartX = w / 2 - (totalTabs * (tabW + 4)) / 2;

    for (let t = 0; t <= info.rejected.length; t++) {
      const tx = tabStartX + t * (tabW + 4);
      const isFinal = t === info.rejected.length;
      const isActive = t === this.detailScroll;
      const label = isFinal ? 'FINAL' : `REJECT ${t + 1}`;
      const color = isActive ? Colors.star : '#666';

      ctx.strokeStyle = color;
      ctx.lineWidth = isActive ? 2 : 1;
      ctx.strokeRect(tx, tabY, tabW, 18);
      if (isActive) {
        ctx.fillStyle = '#1a1a30';
        ctx.fillRect(tx + 1, tabY + 1, tabW - 2, 16);
      }
      renderer.drawText(label, tx + tabW / 2, tabY + 12, isActive ? (isFinal ? '#44FF44' : '#FF4444') : '#666', 9, 'center');
    }

    // Main preview area
    const previewX = 40;
    const previewY = 84;
    const previewW = w - 80;
    const previewH = h - 140;

    const isFinal = this.detailScroll === info.rejected.length;

    if (isFinal) {
      // Show the final accepted level
      const fInfo = {
        minX: info.minX, maxX: info.maxX, minY: info.minY, maxY: info.maxY,
      };
      this.drawTerrainPreview(ctx, level.terrain, level.closed, level.turrets,
        level.fuelDepots, level.islands, level.spawnX, level.spawnY, level.padX,
        fInfo, previewX, previewY, previewW, previewH, Colors.terrain);

      // Info text
      const infoY = h - 18;
      let text = `ACCEPTED | turrets:${level.turrets.length} depots:${level.fuelDepots.length}`;
      if (info.fixups.length > 0) text += ` | fixups: ${info.fixups.join(', ')}`;
      renderer.drawText(text, w / 2, infoY, '#44FF44', 11, 'center');
    } else {
      // Show a rejected attempt
      const rej = info.rejected[this.detailScroll];
      const xs = rej.terrain.map(p => p.x);
      const ys = rej.terrain.map(p => p.y);
      const rInfo = {
        minX: Math.min(...xs), maxX: Math.max(...xs),
        minY: Math.min(...ys), maxY: Math.max(...ys),
      };
      this.drawTerrainPreview(ctx, rej.terrain, rej.closed, rej.turrets,
        rej.fuelDepots, rej.islands, 0, rej.closed ? 200 : 310, undefined,
        rInfo, previewX, previewY, previewW, previewH, '#FF4444');

      // Info text
      const infoY = h - 18;
      renderer.drawText(
        `REJECTED (attempt ${rej.attempt}) | style: ${rej.style} | reason: ${rej.reason}`,
        w / 2, infoY, '#FF4444', 11, 'center',
      );
    }

    // Border
    ctx.strokeStyle = isFinal ? '#44FF44' : '#FF4444';
    ctx.lineWidth = 2;
    ctx.strokeRect(previewX - 2, previewY - 2, previewW + 4, previewH + 4);
  }

  private drawTerrainPreview(
    ctx: CanvasRenderingContext2D,
    terrain: { x: number; y: number }[],
    closed: boolean,
    turrets: { x: number; y: number }[],
    depots: { x: number; y: number }[],
    islands: { x: number; y: number }[][] | undefined,
    spawnX: number, spawnY: number,
    padX: number | undefined,
    bounds: { minX: number; maxX: number; minY: number; maxY: number },
    px: number, py: number, pw: number, ph: number,
    terrainColor: string,
  ) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(px, py, pw, ph);
    ctx.clip();

    const tw = bounds.maxX - bounds.minX || 1;
    const th = bounds.maxY - bounds.minY || 1;
    const scale = Math.min(pw / tw, ph / th) * 0.9;
    const ox = px + pw / 2;
    const oy = py + ph / 2;
    const tcx = (bounds.minX + bounds.maxX) / 2;
    const tcy = (bounds.minY + bounds.maxY) / 2;

    const sx = (wx: number) => ox + (wx - tcx) * scale;
    const sy = (wy: number) => oy - (wy - tcy) * scale;

    // Terrain
    ctx.strokeStyle = terrainColor;
    ctx.lineWidth = 1;
    ctx.beginPath();
    if (terrain.length > 0) {
      ctx.moveTo(sx(terrain[0].x), sy(terrain[0].y));
      for (let i = 1; i < terrain.length; i++) {
        ctx.lineTo(sx(terrain[i].x), sy(terrain[i].y));
      }
      if (closed) ctx.closePath();
    }
    ctx.stroke();

    // Islands
    if (islands) {
      ctx.strokeStyle = '#006600';
      for (const island of islands) {
        ctx.beginPath();
        ctx.moveTo(sx(island[0].x), sy(island[0].y));
        for (let i = 1; i < island.length; i++) {
          ctx.lineTo(sx(island[i].x), sy(island[i].y));
        }
        ctx.closePath();
        ctx.stroke();
      }
    }

    // Turrets
    for (const t of turrets) {
      ctx.fillStyle = Colors.turret;
      ctx.beginPath();
      ctx.arc(sx(t.x), sy(t.y), 2, 0, Math.PI * 2);
      ctx.fill();
    }

    // Depots
    for (const d of depots) {
      ctx.fillStyle = Colors.fuelDepot;
      ctx.beginPath();
      ctx.arc(sx(d.x), sy(d.y), 2, 0, Math.PI * 2);
      ctx.fill();
    }

    // Landing pad
    if (padX !== undefined) {
      ctx.fillStyle = '#FFFF00';
      ctx.fillRect(sx(padX) - 3, sy(bounds.minY + 10) - 1, 6, 2);
    }

    // Spawn point
    ctx.fillStyle = Colors.ship;
    ctx.beginPath();
    ctx.arc(sx(spawnX), sy(spawnY), 3, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }
}
