export interface GameSettings {
  // Ship
  rotateSpeed: number;      // radians/sec
  thrustPower: number;      // units/sec^2
  maxSpeed: number;
  bulletSpeed: number;
  fireCooldown: number;     // seconds
  maxBullets: number;       // max bullets in flight at once

  // Fuel
  fuelThrustRate: number;   // per second while thrusting
  fuelShootRate: number;    // per bullet fired
  fuelShieldRate: number;   // per second while shielded
  fuelPickup: number;       // fuel added per depot pickup
  startingFuel: number;

  // Gravity
  starGravity: number;      // solar system star pull
  planetGravity: number;    // base gravity multiplier for planet levels (1.0 = as defined)

  // Enemies
  turretFireRate: number;   // seconds between shots
  turretBulletSpeed: number;
  turretAimRange: number;
  turretAccuracy: number;   // 0 = random, 1 = perfect aim (spread in radians = (1 - accuracy) * PI)

  // Tractor beam
  tractorRange: number;     // pickup distance

  // Landing pad
  padWidth: number;         // width of landing platform
  padHeight: number;        // height of stilts
  maxLandingSpeed: number;  // max downward speed to survive landing
  maxLandingAngle: number;  // max degrees off vertical to survive landing

  // Audio
  soundVolume: number;      // 0 = off, 1 = full

  // Game
  lives: number;
  maxJumps: number;       // teleport jumps per game
  randomSeed: number;     // 0 = random each game, non-zero = fixed seed
}

export const DEFAULT_SETTINGS: GameSettings = {
  rotateSpeed: 5,
  thrustPower: 225,
  maxSpeed: 300,
  bulletSpeed: 500,
  fireCooldown: 0.10,
  maxBullets: 25,

  fuelThrustRate: 8,
  fuelShootRate: 5,
  fuelShieldRate: 1000,
  fuelPickup: 2500,
  startingFuel: 10000,

  starGravity: 750,
  planetGravity: 0.3,

  turretFireRate: 2.2,
  turretBulletSpeed: 100,
  turretAimRange: 450,
  turretAccuracy: 0.2,

  tractorRange: 70,

  padWidth: 40,
  padHeight: 25,
  maxLandingSpeed: 50,
  maxLandingAngle: 15,

  soundVolume: 0.7,

  lives: 3,
  maxJumps: 3,
  randomSeed: 1,
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
  // Ranges centered so the default value sits at the midpoint of each slider
  { key: 'lives',            label: 'Lives',              min: 1,    max: 5,     step: 1 },
  { key: 'maxJumps',         label: 'Teleport Jumps',     min: 0,    max: 10,    step: 1 },
  { key: 'rotateSpeed',      label: 'Rotation Speed',     min: 2,    max: 8,     step: 0.5 },
  { key: 'thrustPower',      label: 'Thrust Power',       min: 50,   max: 400,   step: 25 },
  { key: 'maxSpeed',         label: 'Max Speed',          min: 100,  max: 600,   step: 50 },
  { key: 'starGravity',      label: 'Star Gravity',       min: 0,    max: 3000,  step: 250 },
  { key: 'planetGravity',    label: 'Planet Gravity',     min: 0,    max: 0.8,   step: 0.05, format: v => v.toFixed(2) + 'x' },
  { key: 'turretFireRate',   label: 'Turret Fire Rate',   min: 0.4,  max: 4.0,   step: 0.2, format: v => v.toFixed(1) + 's' },
  { key: 'turretBulletSpeed',label: 'Turret Bullet Speed',min: 50,   max: 250,   step: 25 },
  { key: 'turretAimRange',   label: 'Turret Aim Range',   min: 100,  max: 600,   step: 50 },
  { key: 'turretAccuracy',   label: 'Turret Accuracy',    min: 0,    max: 0.6,   step: 0.05, format: v => Math.round(v * 100) + '%' },
  { key: 'tractorRange',      label: 'Tractor Beam Range', min: 20,   max: 120,   step: 10 },
  { key: 'padWidth',         label: 'Pad Width',          min: 20,   max: 60,    step: 5 },
  { key: 'padHeight',        label: 'Pad Height',         min: 10,   max: 40,    step: 5 },
  { key: 'maxLandingSpeed',  label: 'Max Landing Speed',  min: 20,   max: 80,    step: 5 },
  { key: 'maxLandingAngle',  label: 'Max Landing Angle',  min: 5,    max: 25,    step: 1, format: v => v + '°' },
  { key: 'maxBullets',       label: 'Max Bullets',         min: 1,    max: 50,    step: 1 },
  { key: 'fireCooldown',     label: 'Fire Cooldown',      min: 0.05, max: 0.55,  step: 0.05, format: v => v.toFixed(2) + 's' },
  { key: 'fuelThrustRate',   label: 'Thrust Fuel Rate',    min: 0,    max: 30,    step: 1, format: v => v + '/s' },
  { key: 'fuelShootRate',    label: 'Shoot Fuel Cost',     min: 0,    max: 20,    step: 1, format: v => String(v) },
  { key: 'fuelShieldRate',   label: 'Shield Fuel Rate',    min: 200,  max: 2000,  step: 100, format: v => v + '/s' },
  { key: 'fuelPickup',       label: 'Fuel Per Pickup',     min: 500,  max: 5000,  step: 250 },
  { key: 'startingFuel',     label: 'Starting Fuel',      min: 3000, max: 17000, step: 1000 },
  { key: 'soundVolume',      label: 'Sound Volume',       min: 0,    max: 1.0,   step: 0.1, format: v => Math.round(v * 100) + '%' },
  { key: 'randomSeed',      label: 'Random Seed',        min: 0,    max: 99999, step: 1, format: v => v === 0 ? 'Random' : String(v) },
];

// Global mutable settings - changed from title screen
export const settings: GameSettings = { ...DEFAULT_SETTINGS };

export function resetSettings() {
  Object.assign(settings, DEFAULT_SETTINGS);
}
