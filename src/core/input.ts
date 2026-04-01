import { preferences } from './preferences.js';

export class InputManager {
  private keys = new Map<string, boolean>();
  private justPressed = new Set<string>();

  // Virtual keys from touch controls
  private touchKeys = new Map<string, boolean>();
  private touchJustPressed = new Set<string>();

  /** Set by preferences scene to capture the next key press */
  onNextKeyDown: ((code: string) => void) | null = null;

  constructor() {
    window.addEventListener('keydown', (e) => {
      if (this.onNextKeyDown) {
        e.preventDefault();
        this.onNextKeyDown(e.code);
        return;
      }
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
    this.touchJustPressed.clear();
  }

  /** Set a virtual key state (used by touch controls) */
  touchDown(code: string) {
    if (!this.touchKeys.get(code)) {
      this.touchJustPressed.add(code);
    }
    this.touchKeys.set(code, true);
  }

  touchUp(code: string) {
    this.touchKeys.set(code, false);
  }

  isDown(code: string): boolean {
    return this.keys.get(code) === true || this.touchKeys.get(code) === true;
  }

  wasPressed(code: string): boolean {
    return this.justPressed.has(code) || this.touchJustPressed.has(code);
  }

  // Convenience - gameplay actions read from preferences
  get left() { return preferences.bindings.left.some(k => this.isDown(k)); }
  get right() { return preferences.bindings.right.some(k => this.isDown(k)); }
  get thrust() { return preferences.bindings.thrust.some(k => this.isDown(k)); }
  get fire() { return preferences.bindings.fire.some(k => this.wasPressed(k)); }
  get shield() { return preferences.bindings.shield.some(k => this.isDown(k)); }
  // Start is not rebindable - always Enter/Space
  get start() { return this.wasPressed('Enter') || this.wasPressed('Space'); }
}

/** Detect if device is touch-only (phones/tablets, not Chromebooks/laptops with touch) */
function isTouchDevice(): boolean {
  if (!('ontouchstart' in window) && navigator.maxTouchPoints === 0) return false;
  // Use pointer media query: coarse = finger, fine = mouse/trackpad
  // Devices with a fine pointer (Chromebooks, laptops) should use keyboard controls
  if (window.matchMedia('(pointer: fine)').matches) return false;
  // Fallback: check screen size as heuristic (small = phone/tablet)
  return window.innerWidth < 1024;
}

interface TouchButton {
  el: HTMLElement;
  code: string;
  hold: boolean; // true = held while pressed, false = single press
}

/** Create mobile touch overlay. Call once after InputManager is created. */
export function setupTouchControls(input: InputManager) {
  if (!isTouchDevice()) return;

  const overlay = document.createElement('div');
  overlay.id = 'touch-controls';
  overlay.innerHTML = `
    <style>
      #touch-controls {
        position: fixed; bottom: 0; left: 0; right: 0;
        pointer-events: none; z-index: 20;
        height: 45vh; user-select: none; -webkit-user-select: none;
      }
      .tc-btn {
        position: absolute; pointer-events: auto;
        display: flex; align-items: center; justify-content: center;
        border-radius: 12px; font: bold 14px monospace;
        color: rgba(255,255,255,0.5); background: rgba(255,255,255,0.08);
        border: 1px solid rgba(255,255,255,0.15);
        -webkit-tap-highlight-color: transparent;
        touch-action: none;
      }
      .tc-btn.active {
        background: rgba(255,255,255,0.2);
        color: rgba(255,255,255,0.8);
      }
      .tc-left  { left: 10px; bottom: 10px; width: 70px; height: 70px; }
      .tc-right { left: 90px; bottom: 10px; width: 70px; height: 70px; }
      .tc-thrust { right: 10px; bottom: 90px; width: 80px; height: 80px; }
      .tc-fire  { right: 100px; bottom: 10px; width: 70px; height: 70px; }
      .tc-shield { right: 10px; bottom: 10px; width: 80px; height: 70px; font-size: 11px; }
      .tc-start { left: 50%; top: 8px; transform: translateX(-50%); width: 70px; height: 34px; font-size: 11px; }
      .tc-fs { right: 8px; top: 8px; width: 30px; height: 30px; font-size: 16px; }
    </style>
    <div class="tc-btn tc-left" data-code="ArrowLeft" data-hold="1">&lt;</div>
    <div class="tc-btn tc-right" data-code="ArrowRight" data-hold="1">&gt;</div>
    <div class="tc-btn tc-thrust" data-code="ArrowUp" data-hold="1">THRUST</div>
    <div class="tc-btn tc-fire" data-code="Space" data-hold="0">FIRE</div>
    <div class="tc-btn tc-shield" data-code="ShiftLeft" data-hold="1">SHIELD</div>
    <div class="tc-btn tc-start" data-code="Enter" data-hold="0">START</div>
    <div class="tc-btn tc-fs" id="tc-fullscreen">&#x26F6;</div>
  `;
  document.body.appendChild(overlay);

  // Wire up touch events
  const buttons = overlay.querySelectorAll<HTMLElement>('.tc-btn');
  buttons.forEach(el => {
    const code = el.dataset.code!;
    const hold = el.dataset.hold === '1';

    const down = (e: Event) => {
      e.preventDefault();
      el.classList.add('active');
      input.touchDown(code);
    };
    const up = (e: Event) => {
      e.preventDefault();
      el.classList.remove('active');
      input.touchUp(code);
    };

    el.addEventListener('touchstart', down, { passive: false });
    el.addEventListener('touchend', up, { passive: false });
    el.addEventListener('touchcancel', up, { passive: false });

    // Prevent context menu on long press
    el.addEventListener('contextmenu', e => e.preventDefault());
  });

  // Fullscreen toggle button
  const fsEl = document.getElementById('tc-fullscreen');
  if (fsEl) {
    fsEl.addEventListener('touchstart', (e) => {
      e.preventDefault();
      if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(() => {});
      } else {
        document.exitFullscreen();
      }
    }, { passive: false });
  }

  // Hide desktop fullscreen button on mobile
  const fsBtn = document.getElementById('fs-btn');
  if (fsBtn) fsBtn.style.display = 'none';
}
