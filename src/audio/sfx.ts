import Phaser from 'phaser';
import { session } from '@/state/session';

/**
 * Zvukové efekty syntetizované vo Web Audio – žiadne súbory, žiadne licencie.
 * Krátke, suché „kancelárske“ zvuky: švih, ťuk, cinknutie.
 */
export type SfxId = 'swing' | 'shot' | 'hit' | 'kill' | 'hurt' | 'pickup' | 'build' | 'click' | 'dash' | 'summon' | 'enrage' | 'fanfare';

let noise: AudioBuffer | null = null;

function noiseBuffer(ctx: AudioContext): AudioBuffer {
  if (noise !== null && noise.sampleRate === ctx.sampleRate) return noise;
  const buf = ctx.createBuffer(1, ctx.sampleRate * 0.3, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  noise = buf;
  return buf;
}

export function sfx(scene: Phaser.Scene, id: SfxId): void {
  const mgr = scene.sound;
  if (session.settings.muted || session.settings.sfxVolume <= 0 || !(mgr instanceof Phaser.Sound.WebAudioSoundManager)) return;
  const ctx = mgr.context;
  if (ctx.state !== 'running') return; // pred prvou interakciou prehliadač zvuk nepustí
  const t = ctx.currentTime;
  const out = ctx.createGain();
  out.gain.value = 0.22 * session.settings.sfxVolume;
  out.connect(mgr.destination);

  const tone = (type: OscillatorType, from: number, to: number, start: number, dur: number, vol = 1): void => {
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(from, t + start);
    o.frequency.exponentialRampToValueAtTime(Math.max(1, to), t + start + dur);
    g.gain.setValueAtTime(vol, t + start);
    g.gain.exponentialRampToValueAtTime(0.001, t + start + dur);
    o.connect(g).connect(out);
    o.start(t + start);
    o.stop(t + start + dur + 0.02);
  };
  const hiss = (freq: number, dur: number, vol = 1): void => {
    const src = ctx.createBufferSource();
    src.buffer = noiseBuffer(ctx);
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.setValueAtTime(freq, t);
    f.frequency.exponentialRampToValueAtTime(freq * 0.4, t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(f).connect(g).connect(out);
    src.start(t);
    src.stop(t + dur + 0.02);
  };

  switch (id) {
    case 'swing':
      hiss(2400, 0.09, 0.7);
      break;
    case 'shot':
      tone('square', 900, 400, 0, 0.05, 0.35);
      break;
    case 'hit':
      tone('sine', 160, 60, 0, 0.11);
      hiss(1200, 0.04, 0.5);
      break;
    case 'kill':
      tone('triangle', 420, 840, 0, 0.12, 0.6);
      tone('triangle', 630, 1260, 0.07, 0.14, 0.5);
      break;
    case 'hurt':
      tone('sawtooth', 240, 90, 0, 0.2, 0.5);
      break;
    case 'pickup':
      tone('sine', 660, 700, 0, 0.07, 0.6);
      tone('sine', 990, 1050, 0.07, 0.1, 0.6);
      break;
    case 'build':
      tone('triangle', 300, 300, 0, 0.06, 0.6);
      tone('triangle', 450, 450, 0.06, 0.08, 0.6);
      break;
    case 'click':
      tone('square', 1300, 1100, 0, 0.025, 0.25);
      break;
    case 'dash':
      hiss(900, 0.12, 0.4);
      break;
    case 'summon':
      // zvonček na poradu: ding-dong
      tone('sine', 880, 880, 0, 0.18, 0.5);
      tone('sine', 660, 660, 0.16, 0.26, 0.5);
      break;
    case 'enrage':
      tone('sawtooth', 110, 70, 0, 0.45, 0.6);
      hiss(500, 0.3, 0.4);
      break;
    case 'fanfare':
      tone('triangle', 523, 523, 0, 0.12, 0.6);
      tone('triangle', 659, 659, 0.12, 0.12, 0.6);
      tone('triangle', 784, 784, 0.24, 0.3, 0.6);
      break;
  }
}
