export interface GameSettings {
  // Ship
  rotateSpeed: number;      // radians/sec
  thrustPower: number;      // units/sec^2
  maxSpeed: number;
  bulletSpeed: number;
  fireCooldown: number;     // seconds

  // Fuel
  fuelThrustRate: number;   // per second
  fuelShieldRate: number;   // per second
  startingFuel: number;

  // Gravity
  starGravity: number;      // solar system star pull
  planetGravity: number;    // base gravity multiplier for planet levels (1.0 = as defined)

  // Enemies
  turretFireRate: number;   // seconds between shots
  turretBulletSpeed: number;
  turretAimRange: number;

  // Game
  lives: number;
}

export const DEFAULT_SETTINGS: GameSettings = {
  rotateSpeed: 4.0,
  thrustPower: 200,
  maxSpeed: 400,
  bulletSpeed: 500,
  fireCooldown: 0.15,

  fuelThrustRate: 8,
  fuelShieldRate: 20,
  startingFuel: 10000,

  starGravity: 3000,       // was 8000, reduced per feedback
  planetGravity: 1.0,

  turretFireRate: 1.5,
  turretBulletSpeed: 250,
  turretAimRange: 400,

  lives: 3,
};

export interface SettingDef {
  key: keyof GameSettings;
  label: string;
  min: number;
  max: number;
  step: number;
  format?: (v: number) => string;
}

export const SETTING_DEFS: SettingDef[] = [
  { key: 'lives',            label: 'Lives',              min: 1,    max: 9,     step: 1 },
  { key: 'rotateSpeed',      label: 'Rotation Speed',     min: 1,    max: 8,     step: 0.5 },
  { key: 'thrustPower',      label: 'Thrust Power',       min: 50,   max: 500,   step: 25 },
  { key: 'maxSpeed',         label: 'Max Speed',          min: 100,  max: 800,   step: 50 },
  { key: 'starGravity',      label: 'Star Gravity',       min: 500,  max: 10000, step: 500 },
  { key: 'planetGravity',    label: 'Planet Gravity',     min: 0.2,  max: 3.0,   step: 0.1, format: v => v.toFixed(1) + 'x' },
  { key: 'turretFireRate',   label: 'Turret Fire Rate',   min: 0.3,  max: 5.0,   step: 0.1, format: v => v.toFixed(1) + 's' },
  { key: 'turretBulletSpeed',label: 'Turret Bullet Speed',min: 50,   max: 500,   step: 25 },
  { key: 'turretAimRange',   label: 'Turret Aim Range',   min: 100,  max: 800,   step: 50 },
  { key: 'fireCooldown',     label: 'Fire Cooldown',      min: 0.05, max: 0.5,   step: 0.05, format: v => v.toFixed(2) + 's' },
  { key: 'startingFuel',     label: 'Starting Fuel',      min: 3000, max: 30000, step: 1000 },
];

// Global mutable settings - changed from title screen
export const settings: GameSettings = { ...DEFAULT_SETTINGS };

export function resetSettings() {
  Object.assign(settings, DEFAULT_SETTINGS);
}
