import { type InputManager } from '../core/input.js';
import { type Renderer } from '../render/renderer.js';

export interface GameState {
  score: number;
  lives: number;
  fuel: number;
  maxFuel: number;
  universe: number;       // 1-4
  planetsCleared: boolean[];  // which planets have been destroyed
  reactorClears: number;  // how many times reactor completed
}

export interface SceneContext {
  input: InputManager;
  renderer: Renderer;
  state: GameState;
  pushScene: (scene: Scene) => void;
  popScene: () => void;
  replaceScene: (scene: Scene) => void;
}

export interface Scene {
  enter(ctx: SceneContext): void;
  exit(): void;
  update(dt: number, ctx: SceneContext): void;
  render(renderer: Renderer, ctx: SceneContext): void;
}
