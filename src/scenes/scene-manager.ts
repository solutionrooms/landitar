import { type Scene, type SceneContext } from './scene.js';
import { type InputManager } from '../core/input.js';
import { type Renderer } from '../render/renderer.js';
import { type GameState } from './scene.js';

export class SceneManager {
  private stack: Scene[] = [];
  private ctx: SceneContext;

  constructor(
    public input: InputManager,
    public renderer: Renderer,
    public state: GameState,
  ) {
    this.ctx = {
      input,
      renderer,
      state,
      pushScene: (scene: Scene) => this.push(scene),
      popScene: () => this.pop(),
      replaceScene: (scene: Scene) => this.replace(scene),
    };
  }

  get current(): Scene | undefined {
    return this.stack[this.stack.length - 1];
  }

  push(scene: Scene) {
    scene.enter(this.ctx);
    this.stack.push(scene);
  }

  pop() {
    const scene = this.stack.pop();
    scene?.exit();
  }

  replace(scene: Scene) {
    const old = this.stack.pop();
    old?.exit();
    scene.enter(this.ctx);
    this.stack.push(scene);
  }

  update(dt: number) {
    this.current?.update(dt, this.ctx);
  }

  render() {
    this.current?.render(this.renderer, this.ctx);
  }
}
