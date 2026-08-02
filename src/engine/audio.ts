import { getSettings, onSettingsChange, type Settings } from '../state/settings';
import type { Rarity } from '../state/types';

/**
 * Camada de audio 100% procedural (WebAudio), sem nenhum arquivo.
 * Serve como som provisorio: da feedback de verdade e nao pesa no bundle.
 * Quando entrarem trilha e SFX reais, basta trocar o corpo de `playSfx`.
 */

type Ctx = AudioContext & { _juggler?: boolean };

let ctx: Ctx | null = null;
let master: GainNode | null = null;
let sfxBus: GainNode | null = null;
let musicBus: GainNode | null = null;
let ambience: { stop: () => void } | null = null;
let noiseBuffer: AudioBuffer | null = null;

function volumes(s: Settings) {
  const m = s.muted ? 0 : s.master;
  return { master: m, sfx: s.sfx, music: s.music };
}

function applyVolumes() {
  if (!ctx || !master || !sfxBus || !musicBus) return;
  const v = volumes(getSettings());
  const t = ctx.currentTime;
  master.gain.setTargetAtTime(v.master, t, 0.05);
  sfxBus.gain.setTargetAtTime(v.sfx, t, 0.05);
  musicBus.gain.setTargetAtTime(v.music, t, 0.05);
}

onSettingsChange(() => applyVolumes());

/** Cria o contexto. So funciona depois de um gesto do usuario. */
export function initAudio(): void {
  if (ctx) {
    void ctx.resume();
    return;
  }
  const AC: typeof AudioContext | undefined =
    window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AC) return;

  ctx = new AC();
  master = ctx.createGain();
  sfxBus = ctx.createGain();
  musicBus = ctx.createGain();
  sfxBus.connect(master);
  musicBus.connect(master);
  master.connect(ctx.destination);

  // ruido branco reaproveitado por todos os efeitos
  const len = Math.floor(ctx.sampleRate * 2);
  noiseBuffer = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = noiseBuffer.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;

  applyVolumes();
}

export function audioReady(): boolean {
  return ctx !== null;
}

function tone(
  freq: number,
  start: number,
  dur: number,
  type: OscillatorType,
  peak: number,
  bus: GainNode,
  detune = 0,
) {
  if (!ctx) return;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, start);
  osc.detune.setValueAtTime(detune, start);
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(peak, start + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + dur);
  osc.connect(gain).connect(bus);
  osc.start(start);
  osc.stop(start + dur + 0.05);
}

function noise(start: number, dur: number, from: number, to: number, peak: number, bus: GainNode) {
  if (!ctx || !noiseBuffer) return;
  const src = ctx.createBufferSource();
  src.buffer = noiseBuffer;
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(from, start);
  filter.frequency.exponentialRampToValueAtTime(Math.max(60, to), start + dur);
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(peak, start + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + dur);
  src.connect(filter).connect(gain).connect(bus);
  src.start(start);
  src.stop(start + dur + 0.05);
}

export type SfxName =
  | 'ui'
  | 'cast'
  | 'splash'
  | 'bite'
  | 'reel'
  | 'coin'
  | 'fail'
  | 'unlock'
  | 'chest';

/** Notas do arpejo de captura por raridade. */
const CATCH_NOTES: Record<Rarity, number[]> = {
  comum: [523.25],
  incomum: [523.25, 659.25],
  raro: [523.25, 659.25, 783.99],
  epico: [523.25, 659.25, 783.99, 1046.5],
  lendario: [523.25, 659.25, 783.99, 1046.5, 1318.5],
  mitico: [261.63, 311.13, 392.0, 466.16, 622.25, 932.33],
};

export function playSfx(name: SfxName): void {
  if (!ctx || !sfxBus) return;
  const t = ctx.currentTime;
  const bus = sfxBus;

  switch (name) {
    case 'ui':
      tone(660, t, 0.07, 'square', 0.06, bus);
      break;
    case 'cast':
      noise(t, 0.34, 900, 220, 0.1, bus);
      tone(320, t, 0.12, 'triangle', 0.05, bus);
      break;
    case 'splash':
      noise(t, 0.45, 2600, 180, 0.16, bus);
      break;
    case 'bite':
      tone(880, t, 0.09, 'square', 0.09, bus);
      tone(1320, t + 0.1, 0.11, 'square', 0.09, bus);
      break;
    case 'reel':
      tone(220, t, 0.04, 'sawtooth', 0.03, bus);
      break;
    case 'coin':
      tone(1046.5, t, 0.07, 'square', 0.07, bus);
      tone(1568, t + 0.06, 0.12, 'square', 0.06, bus);
      break;
    case 'fail':
      tone(220, t, 0.3, 'sawtooth', 0.08, bus, -300);
      noise(t, 0.3, 500, 90, 0.08, bus);
      break;
    case 'chest':
      noise(t, 0.25, 1600, 300, 0.1, bus);
      [392, 523.25, 659.25].forEach((f, i) => tone(f, t + i * 0.07, 0.3, 'triangle', 0.07, bus));
      break;
    case 'unlock':
      [523.25, 659.25, 783.99, 1046.5].forEach((f, i) =>
        tone(f, t + i * 0.08, 0.45, 'triangle', 0.07, bus),
      );
      break;
  }
}

/** Fanfarra de captura, mais longa e mais rica quanto mais raro o peixe. */
export function playCatch(rarity: Rarity): void {
  if (!ctx || !sfxBus) return;
  const t = ctx.currentTime;
  const notes = CATCH_NOTES[rarity];
  const long = rarity === 'lendario' || rarity === 'mitico';

  noise(t, 0.4, 2400, 220, 0.12, sfxBus);
  notes.forEach((f, i) => {
    const start = t + 0.06 + i * (long ? 0.11 : 0.08);
    tone(f, start, long ? 0.8 : 0.4, rarity === 'mitico' ? 'sawtooth' : 'triangle', 0.09, sfxBus!);
    if (long) tone(f / 2, start, 0.9, 'sine', 0.05, sfxBus!, 6);
  });
}

/** Som do lancamento perfeito, so um brilho extra em cima do splash. */
export function playPerfect(): void {
  if (!ctx || !sfxBus) return;
  const t = ctx.currentTime;
  tone(1318.5, t, 0.18, 'triangle', 0.06, sfxBus);
  tone(1975.5, t + 0.05, 0.2, 'triangle', 0.05, sfxBus);
}

/**
 * Ambiencia: ruido filtrado com envelope lento = quebra de onda.
 * Um pad grave bem baixo por baixo segura a atmosfera.
 */
export function startAmbience(): void {
  if (!ctx || !musicBus || !noiseBuffer || ambience) return;

  const src = ctx.createBufferSource();
  src.buffer = noiseBuffer;
  src.loop = true;

  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = 520;
  filter.Q.value = 0.6;

  const swell = ctx.createGain();
  swell.gain.value = 0.1;

  const lfo = ctx.createOscillator();
  lfo.type = 'sine';
  lfo.frequency.value = 0.09;
  const lfoGain = ctx.createGain();
  lfoGain.gain.value = 0.07;
  lfo.connect(lfoGain).connect(swell.gain);

  src.connect(filter).connect(swell).connect(musicBus);

  const padGain = ctx.createGain();
  padGain.gain.value = 0.035;
  padGain.connect(musicBus);
  const pad: OscillatorNode[] = [];
  for (const f of [110, 164.81, 220]) {
    const o = ctx.createOscillator();
    o.type = 'sine';
    o.frequency.value = f;
    o.detune.value = (Math.random() - 0.5) * 8;
    o.connect(padGain);
    o.start();
    pad.push(o);
  }

  src.start();
  lfo.start();

  ambience = {
    stop: () => {
      try {
        src.stop();
        lfo.stop();
        pad.forEach((o) => o.stop());
      } catch {
        /* ja parado */
      }
    },
  };
}

export function stopAmbience(): void {
  ambience?.stop();
  ambience = null;
}
