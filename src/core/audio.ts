import { settings } from './settings.js';

const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();

function ensureCtx() {
  if (audioCtx.state === 'suspended') audioCtx.resume();
}

function playTone(freq: number, duration: number, type: OscillatorType = 'square', vol = 0.15) {
  ensureCtx();
  const v = settings.soundVolume;
  if (v <= 0) return;
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(vol * v, audioCtx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);
  osc.connect(gain).connect(audioCtx.destination);
  osc.start();
  osc.stop(audioCtx.currentTime + duration);
}

function playNoise(duration: number, vol = 0.1) {
  ensureCtx();
  const v = settings.soundVolume;
  if (v <= 0) return;
  const bufferSize = audioCtx.sampleRate * duration;
  const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
  const src = audioCtx.createBufferSource();
  const gain = audioCtx.createGain();
  src.buffer = buffer;
  gain.gain.setValueAtTime(vol * v, audioCtx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);
  src.connect(gain).connect(audioCtx.destination);
  src.start();
}

export function playFireSound() {
  playTone(800, 0.08, 'square', 0.1);
}

export function playEnemyFireSound() {
  playTone(400, 0.1, 'sawtooth', 0.08);
}

export function playExplosionSound() {
  playNoise(0.3, 0.2);
}

export function playDeathSound() {
  playNoise(0.5, 0.3);
  playTone(200, 0.4, 'sawtooth', 0.15);
}

export function playPickupSound() {
  playTone(1200, 0.1, 'sine', 0.12);
  setTimeout(() => playTone(1600, 0.1, 'sine', 0.12), 80);
}

export function playLevelCompleteSound() {
  playTone(800, 0.15, 'sine', 0.12);
  setTimeout(() => playTone(1000, 0.15, 'sine', 0.12), 120);
  setTimeout(() => playTone(1200, 0.2, 'sine', 0.15), 240);
}

let thrustOsc: OscillatorNode | null = null;
let thrustGain: GainNode | null = null;

export function startThrust() {
  if (thrustOsc) return;
  ensureCtx();
  const v = settings.soundVolume;
  if (v <= 0) return;
  thrustOsc = audioCtx.createOscillator();
  thrustGain = audioCtx.createGain();
  thrustOsc.type = 'sawtooth';
  thrustOsc.frequency.value = 60;
  thrustGain.gain.value = 0.06 * v;
  thrustOsc.connect(thrustGain).connect(audioCtx.destination);
  thrustOsc.start();
}

export function stopThrust() {
  if (thrustOsc) {
    thrustOsc.stop();
    thrustOsc.disconnect();
    thrustOsc = null;
    thrustGain = null;
  }
}
