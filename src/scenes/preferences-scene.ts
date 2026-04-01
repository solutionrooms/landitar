import { type Scene, type SceneContext } from './scene.js';
import { type Renderer } from '../render/renderer.js';
import { Colors } from '../render/colors.js';
import { type InputManager } from '../core/input.js';
import {
  preferences,
  resetBindings,
  setBinding,
  keyDisplayName,
  BINDING_ACTIONS,
  ACTION_LABELS,
  type KeyBindings,
} from '../core/preferences.js';

export class PreferencesScene implements Scene {
  private ctx!: SceneContext;
  private selectedIndex = 0;
  private rebinding = false;        // true when waiting for key input
  private rebindSlot = -1;          // which slot in the key array we are setting (0 = primary, 1 = secondary)
  private blinkTimer = 0;

  enter(ctx: SceneContext) {
    this.ctx = ctx;
  }

  exit() {
    // Make sure we clean up any capture hook
    this.ctx.input.onNextKeyDown = null;
  }

  update(dt: number, ctx: SceneContext) {
    this.blinkTimer += dt;
    const { input } = ctx;

    if (this.rebinding) {
      // Key capture is handled by the onNextKeyDown callback set in startRebind.
      // Escape cancels without changing anything.
      return;
    }

    // Navigation
    if (input.wasPressed('ArrowUp')) {
      this.selectedIndex = (this.selectedIndex - 1 + BINDING_ACTIONS.length) % BINDING_ACTIONS.length;
    }
    if (input.wasPressed('ArrowDown')) {
      this.selectedIndex = (this.selectedIndex + 1) % BINDING_ACTIONS.length;
    }

    // Enter to start rebinding
    if (input.wasPressed('Enter')) {
      this.startRebind(ctx.input);
    }

    // Reset to defaults
    if (input.wasPressed('KeyR')) {
      resetBindings();
    }

    // Back to title
    if (input.wasPressed('Escape')) {
      ctx.popScene();
    }
  }

  private startRebind(input: InputManager) {
    this.rebinding = true;
    this.rebindSlot = 0;

    input.onNextKeyDown = (code: string) => {
      // Escape cancels rebinding
      if (code === 'Escape') {
        this.finishRebind(input);
        return;
      }

      const action = BINDING_ACTIONS[this.selectedIndex];
      const current = [...preferences.bindings[action]];

      if (this.rebindSlot === 0) {
        // First key - always set
        current[0] = code;
        // If the binding originally had only one key, we ask for a second
        // but the user can press Escape or Enter to skip
        setBinding(action, [code]);
        this.rebindSlot = 1;
        // Keep capturing for optional second binding
        return;
      }

      if (this.rebindSlot === 1) {
        // Second key (optional) - Enter skips adding a second binding
        if (code === 'Enter') {
          this.finishRebind(input);
          return;
        }
        const primary = preferences.bindings[action][0];
        if (code === primary) {
          // Same key pressed twice - just use one binding
          this.finishRebind(input);
          return;
        }
        setBinding(action, [primary, code]);
        this.finishRebind(input);
      }
    };
  }

  private finishRebind(input: InputManager) {
    this.rebinding = false;
    this.rebindSlot = -1;
    input.onNextKeyDown = null;
  }

  render(renderer: Renderer) {
    renderer.camX = 0;
    renderer.camY = 0;
    renderer.camScale = 1;
    renderer.beginFrame();

    const cx = renderer.width / 2;

    renderer.drawText('KEY BINDINGS', cx, 40, Colors.star, 28, 'center');
    renderer.drawText('UP/DOWN: Select    ENTER: Rebind    R: Reset    ESC: Back', cx, 66, Colors.hud, 11, 'center');

    const startY = 110;
    const lineH = 36;
    const labelX = cx - 160;
    const bindingX = cx + 40;

    for (let i = 0; i < BINDING_ACTIONS.length; i++) {
      const action = BINDING_ACTIONS[i];
      const y = startY + i * lineH;
      const selected = i === this.selectedIndex;
      const color = selected ? Colors.star : Colors.hud;
      const prefix = selected ? '> ' : '  ';

      // Action label
      renderer.drawText(prefix + ACTION_LABELS[action], labelX, y, color, 16, 'left');

      // Current bindings
      if (this.rebinding && selected) {
        // Show rebind prompt
        const blink = Math.floor(this.blinkTimer * 4) % 2 === 0;
        if (this.rebindSlot === 0) {
          const promptText = blink ? 'PRESS KEY...' : '';
          renderer.drawText(promptText, bindingX, y, Colors.ship, 16, 'left');
        } else if (this.rebindSlot === 1) {
          const primary = keyDisplayName(preferences.bindings[action][0]);
          const promptText = blink ? primary + '  +  ?' : primary + '  +  _';
          renderer.drawText(promptText, bindingX, y, Colors.ship, 16, 'left');
          renderer.drawText('(press 2nd key, ENTER to skip, ESC to cancel)', cx, startY + BINDING_ACTIONS.length * lineH + 10, Colors.hud, 11, 'center');
        }
      } else {
        const keys = preferences.bindings[action];
        const display = keys.map(keyDisplayName).join('  /  ');
        renderer.drawText(display, bindingX, y, color, 16, 'left');
      }

      // Arrow indicators for selected item
      if (selected && !this.rebinding) {
        renderer.drawText('>', labelX - 14, y, Colors.star, 16, 'left');
      }
    }

    // Footer
    const footerY = startY + BINDING_ACTIONS.length * lineH + 40;
    renderer.drawText('START is always ENTER / SPACE (not rebindable)', cx, footerY, Colors.hud, 11, 'center');
  }
}
