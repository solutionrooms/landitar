export interface KeyBindings {
  left: string[];
  right: string[];
  thrust: string[];
  fire: string[];
  shield: string[];
}

export const DEFAULT_BINDINGS: KeyBindings = {
  left: ['ArrowLeft', 'KeyA'],
  right: ['ArrowRight', 'KeyD'],
  thrust: ['ArrowUp', 'KeyW'],
  fire: ['Space'],
  shield: ['ShiftLeft', 'ShiftRight', 'KeyS'],
};

export interface Preferences {
  bindings: KeyBindings;
}

const STORAGE_KEY = 'landitar-preferences';

function loadPreferences(): Preferences {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      // Validate that all binding keys exist and are arrays
      const bindings: KeyBindings = { ...DEFAULT_BINDINGS };
      for (const action of Object.keys(DEFAULT_BINDINGS) as (keyof KeyBindings)[]) {
        if (parsed.bindings && Array.isArray(parsed.bindings[action]) && parsed.bindings[action].length > 0) {
          bindings[action] = parsed.bindings[action];
        }
      }
      return { bindings };
    }
  } catch {
    // Ignore parse errors, use defaults
  }
  return { bindings: { ...DEFAULT_BINDINGS } };
}

function savePreferences() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences));
  } catch {
    // Ignore storage errors
  }
}

export const preferences: Preferences = loadPreferences();

export function setBinding(action: keyof KeyBindings, keys: string[]) {
  preferences.bindings[action] = keys;
  savePreferences();
}

export function resetBindings() {
  preferences.bindings = {
    left: [...DEFAULT_BINDINGS.left],
    right: [...DEFAULT_BINDINGS.right],
    thrust: [...DEFAULT_BINDINGS.thrust],
    fire: [...DEFAULT_BINDINGS.fire],
    shield: [...DEFAULT_BINDINGS.shield],
  };
  savePreferences();
}

/** Human-readable name for a key code */
export function keyDisplayName(code: string): string {
  const map: Record<string, string> = {
    ArrowLeft: 'LEFT',
    ArrowRight: 'RIGHT',
    ArrowUp: 'UP',
    ArrowDown: 'DOWN',
    Space: 'SPACE',
    ShiftLeft: 'L-SHIFT',
    ShiftRight: 'R-SHIFT',
    ControlLeft: 'L-CTRL',
    ControlRight: 'R-CTRL',
    AltLeft: 'L-ALT',
    AltRight: 'R-ALT',
    MetaLeft: 'L-META',
    MetaRight: 'R-META',
    Enter: 'ENTER',
    Escape: 'ESC',
    Backspace: 'BACKSPACE',
    Tab: 'TAB',
    CapsLock: 'CAPS',
  };
  if (map[code]) return map[code];
  // KeyA -> A, KeyZ -> Z
  if (code.startsWith('Key')) return code.slice(3);
  // Digit0 -> 0, Digit9 -> 9
  if (code.startsWith('Digit')) return code.slice(5);
  // Numpad0 -> NUM0, etc.
  if (code.startsWith('Numpad')) return 'NUM' + code.slice(6);
  return code.toUpperCase();
}

export const BINDING_ACTIONS: (keyof KeyBindings)[] = ['left', 'right', 'thrust', 'fire', 'shield'];

export const ACTION_LABELS: Record<keyof KeyBindings, string> = {
  left: 'LEFT',
  right: 'RIGHT',
  thrust: 'THRUST',
  fire: 'FIRE',
  shield: 'SHIELD',
};
