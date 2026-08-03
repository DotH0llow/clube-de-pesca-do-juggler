import { useSyncExternalStore } from 'react';
import { CLIPS } from '../assets';

/**
 * Sequencias de quadros de cada clipe animado.
 *
 * Antes a ordem dos quadros estava presa no codigo: o clipe tocava 0,1,2,...,n
 * e pronto. Agora cada clipe tem uma SEQUENCIA editavel - uma lista de indices
 * de quadro - e um tempo de quadro. O jogo le daqui; o editor escreve aqui.
 *
 * Como cada clipe usa a sequencia:
 *
 *   loop   - roda a lista em ciclo, `frameMs` por item (andar, correr, parado);
 *   fisica - o primeiro item e o quadro de subida e o ultimo o de descida (pulo);
 *   fase   - a lista e lida por posicao, uma por momento do lance (pescaria).
 *
 * Assim, mexer na ordem no editor muda o jogo sem tocar em codigo.
 */

export type ClipMode = 'loop' | 'fisica' | 'fase';

export interface ClipConfig {
  /** ordem dos quadros; cada numero e o indice do arquivo na pasta */
  frames: number[];
  /** tempo de cada quadro, em ms (so vale no modo `loop`) */
  frameMs: number;
  /** como o jogo consome a sequencia */
  mode: ClipMode;
  /** rotulo de cada posicao da sequencia (modo `fase`) */
  slots?: string[];
}

/** Momentos do lance, na ordem em que a sequencia de `fish` e lida. */
export const FISH_SLOTS = ['parado', 'forca', 'arremesso', 'espera', 'fisgada', 'recolhendo'];

const LOOP_MS: Record<string, number> = {
  walk: 200,
  run: 160,
};

function range(n: number): number[] {
  return Array.from({ length: n }, (_, i) => i);
}

/**
 * Sequencia padrao de um clipe.
 *
 * Andar e correr saem com [0, 2] de proposito: os quadros 1 e 3 da arte sao a
 * pose PARADA, e usar pose parada dentro da caminhada e o que fazia o Juggler
 * parecer que hesitava a cada passo. Quem quiser o ciclo de 4 quadros e so
 * escrever 0,1,2,3 no editor.
 */
export function defaultClip(path: string, count: number): ClipConfig {
  const name = path.split('/').pop() ?? path;
  const base = name.replace(/-(left|right)$/, '');

  if (base === 'fish') {
    return { frames: range(count), frameMs: 1000, mode: 'fase', slots: FISH_SLOTS };
  }
  if (base === 'jump') {
    return { frames: range(count), frameMs: 1000, mode: 'fisica', slots: ['subindo', 'descendo'] };
  }
  if ((base === 'walk' || base === 'run') && count >= 3) {
    return { frames: [0, 2], frameMs: LOOP_MS[base], mode: 'loop' };
  }
  return { frames: range(count), frameMs: LOOP_MS[base] ?? 1000, mode: 'loop' };
}

export function seedAnims(): Record<string, ClipConfig> {
  const out: Record<string, ClipConfig> = {};
  for (const c of CLIPS) out[c.path] = defaultClip(c.path, c.count);
  return out;
}

// ------------------------------------------------------------------- estado

const KEY = 'juggler-fishing/animacoes/v1';

function load(): Record<string, ClipConfig> {
  const seed = seedAnims();
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return seed;
    const parsed = JSON.parse(raw) as Record<string, Partial<ClipConfig>>;
    for (const [path, cfg] of Object.entries(parsed)) {
      if (!seed[path] || !Array.isArray(cfg.frames)) continue;
      seed[path] = { ...seed[path], ...cfg, frames: cfg.frames as number[] };
    }
    return seed;
  } catch {
    return seed;
  }
}

let state: Record<string, ClipConfig> =
  typeof localStorage === 'undefined' ? seedAnims() : load();
const listeners = new Set<() => void>();

function notify() {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    /* sem espaco: vale so em memoria */
  }
  for (const l of listeners) l();
}

export function getAnims(): Record<string, ClipConfig> {
  return state;
}

function subscribe(fn: () => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

export function useAnims(): Record<string, ClipConfig> {
  return useSyncExternalStore(subscribe, getAnims, getAnims);
}

/** Config de um clipe; cai no padrao quando a pasta e nova. */
export function clipConfig(path: string): ClipConfig {
  return state[path] ?? defaultClip(path, CLIPS.find((c) => c.path === path)?.count ?? 1);
}

export function setClip(path: string, patch: Partial<ClipConfig>): void {
  const cur = clipConfig(path);
  state = { ...state, [path]: { ...cur, ...patch } };
  notify();
}

export function resetClip(path: string): void {
  const count = CLIPS.find((c) => c.path === path)?.count ?? 1;
  state = { ...state, [path]: defaultClip(path, count) };
  notify();
}

export function resetAnims(): void {
  state = seedAnims();
  notify();
}

/**
 * Quadro real a mostrar na posicao `i` da sequencia.
 *
 * Aceita indice fora da faixa (volta pro comeco) e sequencia vazia, para uma
 * edicao pela metade no editor nunca quebrar o jogo.
 */
export function frameAt(path: string, i: number, count: number): number {
  const seq = clipConfig(path).frames;
  if (seq.length === 0) return 0;
  const raw = seq[((i % seq.length) + seq.length) % seq.length];
  return Math.min(Math.max(0, raw | 0), Math.max(0, count - 1));
}

/** Quantos passos a sequencia tem (o laco do jogo cicla nisso). */
export function seqLength(path: string): number {
  return Math.max(1, clipConfig(path).frames.length);
}
