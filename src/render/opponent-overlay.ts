import { type Renderer } from './renderer.js';
import { type MultiplayerSession } from '../net/multiplayer-session.js';
import { type RivalsManager } from '../entities/rivals.js';
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
      const cx = pipX + pipW / 2;
      const cy = pipY + pipH / 2;
      renderer.drawText(sel.name, cx, cy - 14, sel.color, 14, 'center');
      renderer.drawText(`SCORE: ${sel.score}`, cx, cy + 4, '#aaa', 11, 'center');
      const locText = sel.gameOver ? 'GAME OVER' : `@ ${sel.scene.toUpperCase()}`;
      renderer.drawText(locText, cx, cy + 20, '#666', 10, 'center');
      renderer.drawText(`LIVES: ${sel.lives}`, cx, cy + 34, '#666', 9, 'center');
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

/** Legacy single-opponent overlay */
export function renderOpponentOverlay(renderer: Renderer, session: MultiplayerSession, localScore: number) {
  renderRivalsOverlay(renderer, { rivals: [], selectedPip: 0 } as any, localScore, session);
}
