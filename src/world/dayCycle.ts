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
 *
 * Em cima disso existe um DESVIO (`offsetMs`), que so o painel de dev mexe: e
 * como adiantar um relogio de parede. O dia continua andando sozinho a partir
 * dali, entao adiantar para o entardecer e esperar leva para a madrugada
 * normalmente. Nao e salvo: recarregar volta para a hora de verdade.
 */

let offsetMs = 0;

/** O agora do JOGO: relogio da maquina mais o desvio do painel de dev. */
export function gameNow(): number {
  return Date.now() + offsetMs;
}

export function clockOffset(): number {
  return offsetMs;
}

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

export function dayPhaseAt(now = gameNow()): DayPhase {
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
export function clockLabel(now = gameNow()): string {
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

function tick(force = false) {
  const next = currentPhase();
  if (next === snapshot && !force) return;
  snapshot = next;
  for (const l of listeners) l();
}

/**
 * Adianta ou atrasa o relogio do jogo, em ms.
 *
 * `tick(true)` no fim porque a fase pode ate continuar a mesma (pular 10
 * minutos dentro da mesma fase), mas a HORA mudou e quem mostra o relogio
 * precisa saber.
 */
export function shiftClock(ms: number): void {
  offsetMs += ms;
  tick(true);
  clockTick();
}

/** Leva o relogio para o comeco de uma fase, sem passar pelas outras. */
export function jumpToPhase(id: RegionId): void {
  const target = DAY_ORDER.indexOf(id);
  if (target < 0) return;
  const t = ((gameNow() % DAY_LENGTH_MS) + DAY_LENGTH_MS) % DAY_LENGTH_MS;
  // meio da fase, e nao a borda: parar em cima da virada troca de fase sozinho
  const want = target * PHASE_MS + PHASE_MS * 0.15;
  shiftClock(want - t);
}

/** Devolve o relogio para a hora de verdade. */
export function resetClock(): void {
  offsetMs = 0;
  tick(true);
  clockTick();
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

/**
 * O relogio da tela, separado da fase de proposito.
 *
 * A fase troca de 6 em 6 minutos e re-renderizar o mundo inteiro nela e barato.
 * O relogio anda a cada segundo; se ele estivesse no mesmo gancho, o cenario
 * seria remontado 60 vezes por minuto a toa. Aqui so quem mostra a hora escuta.
 */
const clockListeners = new Set<() => void>();
let clockSnap = clockLabel();
let clockTimer: ReturnType<typeof setInterval> | undefined;

function clockTick() {
  const next = clockLabel();
  if (next === clockSnap) return;
  clockSnap = next;
  for (const l of clockListeners) l();
}

function subscribeClock(fn: () => void): () => void {
  clockListeners.add(fn);
  if (clockTimer === undefined) clockTimer = setInterval(clockTick, 500);
  return () => {
    clockListeners.delete(fn);
    if (clockListeners.size === 0 && clockTimer !== undefined) {
      clearInterval(clockTimer);
      clockTimer = undefined;
    }
  };
}

export function useGameClock(): string {
  return useSyncExternalStore(
    subscribeClock,
    () => clockSnap,
    () => clockSnap,
  );
}
