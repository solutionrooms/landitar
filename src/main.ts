import { InputManager } from './core/input.js';
import { Renderer } from './render/renderer.js';
import { SceneManager } from './scenes/scene-manager.js';
import { TitleScene } from './scenes/title-scene.js';
import { type GameState } from './scenes/scene.js';

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

const scenes = new SceneManager(input, renderer, state);

function resize() {
  renderer.resize();
}
resize();
window.addEventListener('resize', resize);

// Start with title screen
scenes.push(new TitleScene());

// Game loop - fixed timestep
const TICK = 1 / 60;
let accumulator = 0;
let lastTime = performance.now();

function frame(now: number) {
  const delta = Math.min((now - lastTime) / 1000, 0.1); // cap delta
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
