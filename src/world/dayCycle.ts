import { useSyncExternalStore } from 'react';
import type { RegionId } from '../state/types';

/**
 * O relogio do jogo.
 *
 * Os quatro cenarios deixaram de ser "mapas" que o jogador compra e escolhe:
 * agora sao as quatro fases de um mesmo dia, que anda sozinho. Um dia inteiro
 * dura 24 minutos reais, entao cada fase fica 6 minutos no ar e o ciclo volta
 * ao comeco sem pedir licenca.
 *
 * O tempo vem do relogio da maquina (`Date.now()`), nao de um contador que
 * comeca do zero a cada partida. Assim o mundo continua girando com o jogo
 * fechado - abrir de novo as 3 da tarde nao devolve o jogador ao amanhecer.
 */

export const DAY_LENGTH_MS = 24 * 60 * 1000;

/** A ordem em que o dia passa. Os ids continuam os mesmos por compatibilidade. */
export const DAY_ORDER: RegionId[] = ['enseada', 'naufragio', 'recife', 'fossa'];

export const PHASE_MS = DAY_LENGTH_MS / DAY_ORDER.length;

export interface DayPhase {
  id: RegionId;
  /** 0..3 */
  index: number;
  /** quanto ja andou dentro da fase, de 0 a 1 */
  progress: number;
  /** ms que faltam para a proxima fase */
  msLeft: number;
}

export function dayPhaseAt(now = Date.now()): DayPhase {
  const t = ((now % DAY_LENGTH_MS) + DAY_LENGTH_MS) % DAY_LENGTH_MS;
  const index = Math.min(DAY_ORDER.length - 1, Math.floor(t / PHASE_MS));
  const into = t - index * PHASE_MS;
  return { id: DAY_ORDER[index], index, progress: into / PHASE_MS, msLeft: PHASE_MS - into };
}

/** Qual fase esta valendo agora - para quem nao e componente React. */
export function currentPhase(): RegionId {
  return dayPhaseAt().id;
}

/** Hora ficticia do mundo, em formato 24h, so para mostrar na tela. */
export function clockLabel(now = Date.now()): string {
  const t = ((now % DAY_LENGTH_MS) + DAY_LENGTH_MS) % DAY_LENGTH_MS;
  // o dia do jogo comeca as 6h: as 24 horas ficticias cabem nos 24 minutos
  const hours = (6 + (t / DAY_LENGTH_MS) * 24) % 24;
  const h = Math.floor(hours);
  const m = Math.floor((hours - h) * 60);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

// ----------------------------------------------------------------- assinatura

/**
 * Um unico timer para o app inteiro. Ele so avisa os interessados quando a
 * fase realmente vira - nao adianta re-renderizar o mundo a cada segundo.
 */
const listeners = new Set<() => void>();
let snapshot: RegionId = currentPhase();
let timer: ReturnType<typeof setInterval> | undefined;

function tick() {
  const next = currentPhase();
  if (next === snapshot) return;
  snapshot = next;
  for (const l of listeners) l();
}

function subscribe(fn: () => void): () => void {
  listeners.add(fn);
  if (timer === undefined) timer = setInterval(tick, 1000);
  return () => {
    listeners.delete(fn);
    if (listeners.size === 0 && timer !== undefined) {
      clearInterval(timer);
      timer = undefined;
    }
  };
}

/** A fase do dia que esta valendo, re-renderizando so quando ela troca. */
export function useDayPhase(): RegionId {
  return useSyncExternalStore(
    subscribe,
    () => snapshot,
    () => snapshot,
  );
}
