import { type Renderer } from './renderer.js';
import { type GameState } from '../scenes/scene.js';
import { Colors } from './colors.js';

export function renderHud(renderer: Renderer, state: GameState) {
  const w = renderer.width;

  // Score
  renderer.drawText(`SCORE: ${state.score}`, 10, 24, Colors.text, 16);

  // Lives
  renderer.drawText(`LIVES: ${state.lives}`, 10, 46, Colors.text, 14);

  // Fuel bar
  const fuelPct = state.fuel / state.maxFuel;
  const barX = w - 210;
  const barW = 200;
  const barH = 14;
  const barY = 10;

  // Bar background
  renderer.ctx.strokeStyle = Colors.hud;
  renderer.ctx.lineWidth = 1;
  renderer.ctx.strokeRect(barX, barY, barW, barH);

  // Bar fill
  const fuelColor = fuelPct > 0.25 ? Colors.fuel : Colors.fuelLow;
  renderer.ctx.fillStyle = fuelColor;
  renderer.ctx.fillRect(barX + 1, barY + 1, (barW - 2) * fuelPct, barH - 2);

  renderer.drawText('FUEL', barX - 40, barY + 12, Colors.hud, 12);

  // Universe
  renderer.drawText(`UNIVERSE ${state.universe}`, w / 2, 24, Colors.text, 14, 'center');
}
