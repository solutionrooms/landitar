export class InputManager {
  private keys = new Map<string, boolean>();
  private justPressed = new Set<string>();

  constructor() {
    window.addEventListener('keydown', (e) => {
      if (!this.keys.get(e.code)) {
        this.justPressed.add(e.code);
      }
      this.keys.set(e.code, true);
      e.preventDefault();
    });
    window.addEventListener('keyup', (e) => {
      this.keys.set(e.code, false);
    });
  }

  /** Call at end of each tick to clear single-frame press events */
  endTick() {
    this.justPressed.clear();
  }

  isDown(code: string): boolean {
    return this.keys.get(code) === true;
  }

  wasPressed(code: string): boolean {
    return this.justPressed.has(code);
  }

  // Convenience
  get left() { return this.isDown('ArrowLeft') || this.isDown('KeyA'); }
  get right() { return this.isDown('ArrowRight') || this.isDown('KeyD'); }
  get thrust() { return this.isDown('ArrowUp') || this.isDown('KeyW'); }
  get fire() { return this.wasPressed('Space'); }
  get shield() { return this.isDown('ShiftLeft') || this.isDown('ShiftRight') || this.isDown('KeyS'); }
  get start() { return this.wasPressed('Enter') || this.wasPressed('Space'); }
}
