import { type Scene, type SceneContext } from './scene.js';
import { type Renderer } from '../render/renderer.js';
import { Colors } from '../render/colors.js';
import { TitleScene } from './title-scene.js';
import { SolarSystemScene } from './solar-system-scene.js';
import { addHighScore, getHighScores, type HighScoreEntry } from '../core/highscores.js';
import { settings } from '../core/settings.js';
import { generateLevels } from '../levels/level-generator.js';
import { setLevels } from '../levels/level-data.js';
import { RivalsManager } from '../entities/rivals.js';

export class GameOverScene implements Scene {
  private timer = 0;
  private score = 0;
  private rank = -1;
  private table: HighScoreEntry[] = [];
  private isMultiplayer = false;
  private remoteGameOver = false;
  private remoteScore = 0;
  private selectedOption = 0; // 0 = play again, 1 = quit
  private botCount = 0;

  enter(ctx: SceneContext) {
    this.score = ctx.state.score;
    this.rank = addHighScore(this.score);
    this.table = getHighScores();

    const mp = ctx.multiplayer;
    if (mp?.isMultiplayer) {
      this.isMultiplayer = true;
      mp.sendMessage({ type: 'game-over', payload: { finalScore: this.score } });
      this.remoteGameOver = mp.remote.gameOver;
      this.remoteScore = mp.remote.finalScore;
    }

    // Remember bot count for rematch
    if (ctx.rivals) {
      this.botCount = ctx.rivals.rivals.filter(r => !r.isHuman).length;
    }
  }

  exit() {}

  update(dt: number, ctx: SceneContext) {
    this.timer += dt;
    if (this.timer < 2) return;

    const { input } = ctx;
    const mp = ctx.multiplayer;

    if (mp?.isMultiplayer) {
      if (mp.remote.gameOver) {
        this.remoteGameOver = true;
        this.remoteScore = mp.remote.finalScore;
      }
    }

    // Navigate options
    if (input.wasPressed('ArrowUp') || input.wasPressed('ArrowDown') ||
        input.wasPressed('KeyW') || input.wasPressed('KeyS')) {
      this.selectedOption = 1 - this.selectedOption;
    }

    if (input.wasPressed('Enter') || input.wasPressed('Space')) {
      if (this.selectedOption === 0) {
        this.playAgain(ctx);
      } else {
        if (mp?.isMultiplayer) mp.destroy();
        ctx.replaceScene(new TitleScene());
      }
    }
  }

  private playAgain(ctx: SceneContext) {
    const seed = settings.randomSeed || Math.floor(Math.random() * 2147483647);
    setLevels(generateLevels(seed));

    ctx.state.score = 0;
    ctx.state.lives = settings.lives;
    ctx.state.fuel = settings.startingFuel;
    ctx.state.maxFuel = settings.startingFuel;
    ctx.state.universe = 1;
    ctx.state.planetsCleared = new Array(12).fill(false);
    ctx.state.reactorClears = 0;

    // Restore rivals (bots + human if multiplayer)
    const mp = ctx.multiplayer;
    if (mp?.isMultiplayer) {
      // Reset remote state for new game
      mp.remote.gameOver = false;
      mp.remote.finalScore = 0;
      mp.remote.score = 0;

      const rm = new RivalsManager();
      if (this.botCount > 0) rm.init(this.botCount);
      rm.addHumanRival();
      ctx.rivals = rm;

      // Sync new game with opponent
      if (mp.isHost) {
        mp.sharedSeed = seed;
        mp.sendMessage({ type: 'seed', payload: seed });
        mp.sendMessage({ type: 'game-start', payload: null });
      }
    } else if (this.botCount > 0) {
      const rm = new RivalsManager();
      rm.init(this.botCount);
      ctx.rivals = rm;
    } else {
      ctx.rivals = null;
    }

    ctx.replaceScene(new SolarSystemScene());
  }

  render(renderer: Renderer, ctx: SceneContext) {
    renderer.camX = 0;
    renderer.camY = 0;
    renderer.camScale = 1;
    renderer.beginFrame();

    const cx = renderer.width / 2;
    const cy = renderer.height / 2;

    renderer.drawText('GAME OVER', cx, cy - 160, Colors.turret, 36, 'center');

    if (this.isMultiplayer) {
      // Multiplayer results
      renderer.drawText(`YOUR SCORE: ${this.score}`, cx, cy - 100, Colors.star, 22, 'center');

      if (this.remoteGameOver) {
        renderer.drawText(`OPPONENT:   ${this.remoteScore}`, cx, cy - 68, '#FF6666', 22, 'center');

        let result: string;
        let resultColor: string;
        if (this.score > this.remoteScore) {
          result = 'YOU WIN!';
          resultColor = '#44FF44';
        } else if (this.score < this.remoteScore) {
          result = 'YOU LOSE';
          resultColor = '#FF4444';
        } else {
          result = 'TIE!';
          resultColor = '#FFFF44';
        }
        renderer.drawText(result, cx, cy - 20, resultColor, 36, 'center');
      } else if (ctx.multiplayer?.connectionState === 'lost') {
        renderer.drawText('OPPONENT DISCONNECTED', cx, cy - 68, '#FF4444', 18, 'center');
        renderer.drawText('YOU WIN BY DEFAULT!', cx, cy - 20, '#44FF44', 28, 'center');
      } else {
        renderer.drawText('WAITING FOR OPPONENT...', cx, cy - 60, Colors.hud, 16, 'center');
        // Draw opponent's current score
        const mp = ctx.multiplayer!;
        renderer.drawText(`OPPONENT SCORE: ${mp.remote.score}`, cx, cy - 30, '#FF6666', 14, 'center');
      }

      // Show remote PIP if stream available
      const mp = ctx.multiplayer;
      if (mp?.remoteVideo && mp.remoteVideo.readyState >= 2) {
        const pipW = Math.round(renderer.width * 0.2);
        const pipH = Math.round(pipW * 0.6);
        const pipX = cx - pipW / 2;
        const pipY = cy + 30;
        renderer.ctx.strokeStyle = '#FF4444';
        renderer.ctx.lineWidth = 2;
        renderer.ctx.strokeRect(pipX - 1, pipY - 1, pipW + 2, pipH + 2);
        renderer.ctx.drawImage(mp.remoteVideo, pipX, pipY, pipW, pipH);
      }
    } else {
      // Single player results
      renderer.drawText(`FINAL SCORE: ${this.score}`, cx, cy - 110, Colors.star, 20, 'center');

      if (this.rank > 0) {
        renderer.drawText(`NEW HIGH SCORE - RANK #${this.rank}!`, cx, cy - 80, '#FFFF00', 16, 'center');
      }

      renderer.drawText('HIGH SCORES', cx, cy - 40, Colors.text, 18, 'center');

      const tableY = cy - 10;
      const lineH = 20;
      const maxShow = Math.min(this.table.length, 10);
      for (let i = 0; i < maxShow; i++) {
        const entry = this.table[i];
        const y = tableY + i * lineH;
        const isNew = this.rank === i + 1 && entry.score === this.score;
        const color = isNew ? '#FFFF00' : Colors.hud;
        const rankStr = `${i + 1}.`.padStart(3);
        const scoreStr = String(entry.score).padStart(8);
        renderer.drawText(`${rankStr}${scoreStr}   ${entry.date}`, cx, y, color, 12, 'center');
      }
    }

    if (this.timer > 2) {
      const optY = renderer.height - 50;
      const blink = Math.floor(this.timer * 3) % 2 === 0;
      const items = ['PLAY AGAIN', 'QUIT TO MENU'];
      for (let i = 0; i < items.length; i++) {
        const sel = i === this.selectedOption;
        const color = sel ? Colors.star : Colors.hud;
        const prefix = sel && blink ? '> ' : '  ';
        renderer.drawText(prefix + items[i], cx, optY + i * 22, color, 14, 'center');
      }
    }
  }
}
