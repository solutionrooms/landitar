import { type Scene, type SceneContext } from './scene.js';
import { type Renderer } from '../render/renderer.js';
import { Colors } from '../render/colors.js';
import { TitleScene } from './title-scene.js';
import { SolarSystemScene } from './solar-system-scene.js';
import { type MultiplayerSession } from '../net/multiplayer-session.js';
import { settings } from '../core/settings.js';
import { generateLevels } from '../levels/level-generator.js';
import { setLevels } from '../levels/level-data.js';
import { RivalsManager } from '../entities/rivals.js';

export class LobbyScene implements Scene {
  private session: MultiplayerSession;
  private canvas: HTMLCanvasElement;
  private hostPeerId: string;
  private botCount: number;
  private joinUrl = '';
  private status = 'INITIALIZING...';
  private error = '';
  private blinkTimer = 0;
  private copied = false;

  constructor(session: MultiplayerSession, canvas: HTMLCanvasElement, botCount = 2, hostPeerId = '') {
    this.session = session;
    this.canvas = canvas;
    this.botCount = botCount;
    this.hostPeerId = hostPeerId;
  }

  enter(ctx: SceneContext) {
    if (this.hostPeerId) {
      // Guest mode
      this.status = 'CONNECTING TO HOST...';
      this.session.joinGame(this.hostPeerId, this.canvas)
        .then(() => {
          this.status = 'CONNECTED! WAITING FOR HOST TO START...';
        })
        .catch(() => {
          this.error = 'CONNECTION FAILED';
        });

      // Listen for seed + settings from host
      this.session.onMessage((msg) => {
        if (msg.type === 'seed') {
          this.session.sharedSeed = msg.payload;
        }
        if (msg.type === 'settings') {
          Object.assign(settings, msg.payload);
        }
        if (msg.type === 'game-start') {
          setLevels(generateLevels(this.session.sharedSeed));
          this.startGame(ctx);
        }
      });
    } else {
      // Host mode
      this.status = 'CREATING ROOM...';
      this.session.hostGame(this.canvas)
        .then((peerId) => {
          const base = window.location.origin + window.location.pathname;
          this.joinUrl = `${base}?join=${peerId}`;
          this.status = 'WAITING FOR OPPONENT...';
        })
        .catch(() => {
          this.error = 'FAILED TO CREATE ROOM';
        });

      // When guest connects, host sends seed/settings and starts
      this.session.onMessage(() => {}); // no-op, just to init
      // Watch for connection
    }
  }

  exit() {}

  update(dt: number, ctx: SceneContext) {
    this.blinkTimer += dt;

    if (ctx.input.wasPressed('Escape')) {
      this.session.destroy();
      ctx.replaceScene(new TitleScene());
      return;
    }

    // Host: detect guest connected
    if (this.session.isHost && this.session.connectionState === 'connected') {
      if (ctx.input.wasPressed('Enter')) {
        // Generate seed and send to guest
        const seed = settings.randomSeed || Math.floor(Math.random() * 2147483647);
        this.session.sharedSeed = seed;
        this.session.sendMessage({ type: 'seed', payload: seed });
        this.session.sendMessage({ type: 'settings', payload: { ...settings } });
        this.session.sendMessage({ type: 'game-start', payload: null });

        setLevels(generateLevels(seed));
        this.startGame(ctx);
        return;
      }
    }

    // Host: copy link
    if (this.session.isHost && this.joinUrl && ctx.input.wasPressed('KeyC')) {
      navigator.clipboard.writeText(this.joinUrl).then(() => {
        this.copied = true;
      }).catch(() => {});
    }
  }

  private startGame(ctx: SceneContext) {
    ctx.state.score = 0;
    ctx.state.lives = settings.lives;
    ctx.state.fuel = settings.startingFuel;
    ctx.state.maxFuel = settings.startingFuel;
    ctx.state.universe = 1;
    ctx.state.planetsCleared = new Array(12).fill(false);
    ctx.state.reactorClears = 0;

    // Set up rivals: 1 human + N bots
    const rm = new RivalsManager();
    if (this.botCount > 0) rm.init(this.botCount);
    rm.addHumanRival();
    ctx.rivals = rm;

    ctx.replaceScene(new SolarSystemScene());
  }

  render(renderer: Renderer) {
    renderer.camX = 0;
    renderer.camY = 0;
    renderer.camScale = 1;
    renderer.beginFrame();

    const cx = renderer.width / 2;
    const cy = renderer.height / 2;

    renderer.drawText('2 PLAYER', cx, cy - 100, Colors.star, 32, 'center');

    if (this.error) {
      renderer.drawText(this.error, cx, cy, '#FF4444', 18, 'center');
      renderer.drawText('PRESS ESC TO RETURN', cx, cy + 40, Colors.hud, 12, 'center');
      return;
    }

    renderer.drawText(this.status, cx, cy - 40, Colors.text, 16, 'center');

    if (this.session.isHost && this.joinUrl) {
      // Show join URL
      renderer.drawText('SEND THIS LINK TO YOUR OPPONENT:', cx, cy, Colors.hud, 12, 'center');

      // Truncate URL for display
      const displayUrl = this.joinUrl.length > 60
        ? this.joinUrl.slice(0, 57) + '...'
        : this.joinUrl;
      renderer.drawText(displayUrl, cx, cy + 24, Colors.ship, 11, 'center');

      renderer.drawText(
        this.copied ? 'COPIED!' : 'PRESS C TO COPY LINK',
        cx, cy + 50, this.copied ? '#44FF44' : Colors.hud, 12, 'center',
      );

      if (this.session.connectionState === 'connected') {
        renderer.drawText('OPPONENT CONNECTED!', cx, cy + 90, '#44FF44', 18, 'center');
        if (Math.floor(this.blinkTimer * 2) % 2 === 0) {
          renderer.drawText('PRESS ENTER TO START', cx, cy + 120, Colors.ship, 16, 'center');
        }
      }
    }

    // Guest waiting
    if (!this.session.isHost && this.session.connectionState === 'connected') {
      renderer.drawText('CONNECTED! WAITING FOR HOST...', cx, cy, '#44FF44', 16, 'center');
    }

    renderer.drawText('ESC: CANCEL', cx, renderer.height - 30, Colors.hud, 10, 'center');
  }
}
