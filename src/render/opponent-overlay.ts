import { type Renderer } from './renderer.js';
import { type MultiplayerSession } from '../net/multiplayer-session.js';
import { type RivalsManager } from '../entities/rivals.js';
import { LEVELS } from '../levels/level-data.js';
import { Colors } from './colors.js';

/** Optional callback to render a scene view into the PIP area.
 *  Returns true if it drew content, false to fall back to text panel. */
export type PipRenderFn = (
  ctx: CanvasRenderingContext2D, renderer: Renderer,
  pipX: number, pipY: number, pipW: number, pipH: number,
  rival: { ship: any; visual: any; color: string },
) => boolean;

/** Render scoreboard + PIP for all rivals */
export function renderRivalsOverlay(
  renderer: Renderer,
  rivals: RivalsManager,
  localScore: number,
  session: MultiplayerSession | null,
  pipRender?: PipRenderFn,
) {
  const ctx = renderer.ctx;
  const w = renderer.width;

  // ---- Large local score (top-center) ----
  renderer.drawText(String(localScore), w / 2, 36, Colors.star, 32, 'center');

  if (rivals.rivals.length === 0) return;

  // ---- Scoreboard (top-right) ----
  const sbX = w - 10;
  const sbY = 16;
  renderer.drawText('YOU', sbX, sbY, Colors.star, 11, 'right');
  renderer.drawText(String(localScore), sbX - 50, sbY, Colors.star, 11, 'right');

  for (let i = 0; i < rivals.rivals.length; i++) {
    const r = rivals.rivals[i];
    const y = sbY + (i + 1) * 16;
    const selected = i === rivals.selectedPip;
    const color = selected ? r.color : '#666666';
    const tag = selected ? `[${i + 1}]` : ` ${i + 1} `;
    renderer.drawText(`${tag} ${r.name}`, sbX, y, color, 10, 'right');
    renderer.drawText(String(r.score), sbX - 70, y, color, 10, 'right');
    if (r.gameOver) {
      renderer.drawText('DONE', sbX - 110, y, '#FF4444', 9, 'right');
    } else if (!r.isHuman) {
      renderer.drawText(r.scene, sbX - 110, y, '#444', 8, 'right');
    }
  }

  // ---- PIP for selected rival ----
  const sel = rivals.rivals[rivals.selectedPip];
  if (!sel) return;

  const pipW = Math.round(w * 0.20);
  const pipH = Math.round(pipW * 0.6);
  const pipX = 10;
  const pipY = 10;

  ctx.strokeStyle = sel.color;
  ctx.lineWidth = 2;
  ctx.strokeRect(pipX - 1, pipY - 1, pipW + 2, pipH + 2);

  if (sel.isHuman && session?.remoteVideo && session.remoteVideo.readyState >= 2) {
    ctx.drawImage(session.remoteVideo, pipX, pipY, pipW, pipH);
  } else {
    // Try scene render callback first (renders actual game view for active bots)
    let rendered = false;
    if (pipRender && !sel.isHuman) {
      ctx.fillStyle = '#0a0a15';
      ctx.fillRect(pipX, pipY, pipW, pipH);
      rendered = pipRender(ctx, renderer, pipX, pipY, pipW, pipH, sel);
    }
    if (!rendered) {
      ctx.fillStyle = '#0a0a15';
      ctx.fillRect(pipX, pipY, pipW, pipH);

      // Try rendering a minimap of the bot's current planet
      if (!sel.isHuman && sel.scene !== 'solar' && !sel.gameOver) {
        renderBotPlanetMinimap(ctx, renderer, pipX, pipY, pipW, pipH, sel);
      } else {
        const cx = pipX + pipW / 2;
        const cy = pipY + pipH / 2;
        renderer.drawText(sel.name, cx, cy - 14, sel.color, 14, 'center');
        renderer.drawText(`SCORE: ${sel.score}`, cx, cy + 4, '#aaa', 11, 'center');
        const locText = sel.gameOver ? 'GAME OVER' : `@ ${sel.scene.toUpperCase()}`;
        renderer.drawText(locText, cx, cy + 20, '#666', 10, 'center');
        renderer.drawText(`LIVES: ${sel.lives}`, cx, cy + 34, '#666', 9, 'center');
      }
    }
  }

  const label = `${sel.name} [${rivals.selectedPip + 1}/${rivals.rivals.length}]`;
  renderer.drawText(label, pipX + pipW / 2, pipY + pipH + 14, sel.color, 10, 'center');
  if (rivals.rivals.length > 1) {
    renderer.drawText('KEYS 1-3: SWITCH', pipX + pipW / 2, pipY + pipH + 26, '#444', 8, 'center');
  }

  if (session?.connectionState === 'lost' && sel.isHuman) {
    ctx.fillStyle = 'rgba(80, 0, 0, 0.7)';
    ctx.fillRect(0, renderer.height / 2 - 20, w, 40);
    renderer.drawText('OPPONENT DISCONNECTED', w / 2, renderer.height / 2 + 6, '#FF4444', 18, 'center');
  }
}

/** Render a minimap of the bot's current planet in the PIP area */
function renderBotPlanetMinimap(
  ctx: CanvasRenderingContext2D, renderer: Renderer,
  px: number, py: number, pw: number, ph: number,
  rival: { name: string; score: number; scene: string; color: string; lives: number },
) {
  // Find the level matching the bot's scene
  const level = LEVELS.find(l => l.name === rival.scene);
  if (!level) return;

  const terrain = level.terrain;
  const xs = terrain.map(p => p.x);
  const ys = terrain.map(p => p.y);
  const minX = Math.min(...xs), maxX = Math.max(...xs);
  const minY = Math.min(...ys), maxY = Math.max(...ys);
  const tw = maxX - minX || 1;
  const th = maxY - minY || 1;

  ctx.save();
  ctx.beginPath();
  ctx.rect(px, py, pw, ph);
  ctx.clip();

  const scale = Math.min(pw / tw, ph / th) * 0.85;
  const ox = px + pw / 2;
  const oy = py + ph / 2;
  const tcx = (minX + maxX) / 2;
  const tcy = (minY + maxY) / 2;
  const sx = (wx: number) => ox + (wx - tcx) * scale;
  const sy = (wy: number) => oy - (wy - tcy) * scale;

  // Terrain outline
  ctx.strokeStyle = '#1a5a1a';
  ctx.lineWidth = 1;
  ctx.beginPath();
  if (terrain.length > 0) {
    ctx.moveTo(sx(terrain[0].x), sy(terrain[0].y));
    for (let i = 1; i < terrain.length; i++) {
      ctx.lineTo(sx(terrain[i].x), sy(terrain[i].y));
    }
    if (level.closed) ctx.closePath();
  }
  ctx.stroke();

  // Islands
  if (level.islands) {
    for (const island of level.islands) {
      ctx.beginPath();
      ctx.moveTo(sx(island[0].x), sy(island[0].y));
      for (let i = 1; i < island.length; i++) ctx.lineTo(sx(island[i].x), sy(island[i].y));
      ctx.closePath();
      ctx.stroke();
    }
  }

  // Turrets as tiny dots
  ctx.fillStyle = '#661111';
  for (const t of level.turrets) {
    ctx.beginPath();
    ctx.arc(sx(t.x), sy(t.y), 1.5, 0, Math.PI * 2);
    ctx.fill();
  }

  // Pulsing bot indicator — random-ish position inside the level
  const pulse = 0.5 + 0.5 * Math.sin(performance.now() * 0.004);
  const botX = tcx + Math.sin(performance.now() * 0.0007) * tw * 0.2;
  const botY = tcy + Math.cos(performance.now() * 0.0005) * th * 0.15;
  ctx.fillStyle = rival.color;
  ctx.globalAlpha = 0.5 + pulse * 0.5;
  ctx.beginPath();
  ctx.arc(sx(botX), sy(botY), 3 + pulse * 2, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;

  ctx.restore();

  // Score overlay at bottom of PIP
  renderer.drawText(`${rival.score}`, px + pw / 2, py + ph - 4, '#aaa', 9, 'center');
}

/** Legacy single-opponent overlay */
export function renderOpponentOverlay(renderer: Renderer, session: MultiplayerSession, localScore: number) {
  renderRivalsOverlay(renderer, { rivals: [], selectedPip: 0 } as any, localScore, session);
}
