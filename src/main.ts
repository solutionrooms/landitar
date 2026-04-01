import { InputManager, setupTouchControls } from './core/input.js';
import { Renderer } from './render/renderer.js';
import { SceneManager } from './scenes/scene-manager.js';
import { TitleScene } from './scenes/title-scene.js';
import { LobbyScene } from './scenes/lobby-scene.js';
import { type GameState } from './scenes/scene.js';
import { MultiplayerSession } from './net/multiplayer-session.js';

const canvas = document.getElementById('game') as HTMLCanvasElement;

const renderer = new Renderer(canvas);
const input = new InputManager();

const state: GameState = {
  score: 0,
  lives: 3,
  fuel: 10000,
  maxFuel: 10000,
  universe: 1,
  planetsCleared: new Array(12).fill(false),
  reactorClears: 0,
};

setupTouchControls(input);

const session = new MultiplayerSession();
const scenes = new SceneManager(input, renderer, state, session);

function resize() { renderer.resize(); }
resize();
window.addEventListener('resize', resize);

// Check for ?join=<peerId> in URL (guest joining)
const joinMatch = window.location.search.match(/[?&]join=([^&]+)/);
if (joinMatch) {
  const hostPeerId = joinMatch[1];
  // Clean URL
  history.replaceState(null, '', window.location.pathname);
  scenes.push(new LobbyScene(session, canvas, hostPeerId));
} else {
  scenes.push(new TitleScene());
}

const TICK = 1 / 60;
let accumulator = 0;
let lastTime = performance.now();

function frame(now: number) {
  const delta = Math.min((now - lastTime) / 1000, 0.1);
  lastTime = now;
  accumulator += delta;

  while (accumulator >= TICK) {
    scenes.update(TICK);
    input.endTick();
    accumulator -= TICK;
  }

  scenes.render();
  requestAnimationFrame(frame);
}

requestAnimationFrame(frame);
