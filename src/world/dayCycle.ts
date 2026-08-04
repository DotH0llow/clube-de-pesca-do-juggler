import { useSyncExternalStore } from 'react';
import { SKY_BY_ID, SKY_ORDER, type SkyPhaseId } from '../data/skies';
import type { RegionId } from '../state/types';

/**
 * O relogio do jogo.
 *
 * Os cenarios deixaram de ser "mapas" que o jogador compra e escolhe: agora
 * sao as HORAS de um mesmo dia, que anda sozinho. Com o pacote de ceus novo o
 * dia passou a ter oito horas em vez de quatro: um dia inteiro continua durando
 * 24 minutos reais, entao cada hora fica 3 minutos no ar e o ciclo volta ao
 * comeco sem pedir licenca.
 *
 * Hora e REGIAO sao coisas diferentes: a hora manda no visual (ceu, cor do mar,
 * clima) e aponta para a regiao que vale nela; a regiao manda na economia. Ver
 * `src/data/skies.ts`.
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

/**
 * QUANDO ESTE DIA COMECOU.
 *
 * O relogio deixou de ser o resto de uma divisao (`Date.now() % 24min`), e essa
 * e a mudanca inteira. Com o resto, a hora do jogo dependia da hora do mundo:
 * abrir o jogo as 11h47 podia cair no meio da noite profunda, e o ciclo dava a
 * volta sozinho e amanhecia de novo no meio da tarde de quem estava jogando.
 *
 * Agora o dia tem um COMECO, e ele e o comeco do dia do jogador: a primeira
 * abertura, ou o "dormir" que encerra o dia. Dali o ceu anda para a frente e
 * so para a frente.
 */
let inicioDia = Date.now();

/** O agora do JOGO: relogio da maquina mais o desvio do painel de dev. */
export function gameNow(): number {
  return Date.now() + offsetMs;
}

export function clockOffset(): number {
  return offsetMs;
}

export const DAY_LENGTH_MS = 24 * 60 * 1000;

/** As oito horas do dia, na ordem em que entram no ar. */
export const HOUR_ORDER: SkyPhaseId[] = SKY_ORDER;

/**
 * ONDE O DIA COMECA.
 *
 * Em MANHA CLARA, sempre. O pre-amanhecer e o nascer do sol continuam aqui,
 * inteiros, com pintura, paleta e regiao - eles so nao entram mais no ciclo
 * sozinhos. Quem pesca chega no cais de manha; ver o ceu clarear e coisa de
 * quem virou a noite, e virar a noite era o que o ciclo antigo fazia com todo
 * mundo que abrisse o jogo na hora errada.
 *
 * Os dois guardados continuam alcancaveis: o painel de dev pula para qualquer
 * hora, e atrasar o relogio (F6) volta ate eles.
 */
export const DIA_COMECA: SkyPhaseId = 'manha-clara';
const INICIO = Math.max(0, HOUR_ORDER.indexOf(DIA_COMECA));

/**
 * Comeca um dia novo: o ceu volta para a manha clara.
 *
 * Chamado por `endDay()` - quando o jogador dorme - e uma vez na abertura do
 * jogo, por este modulo carregar. O desvio do painel de dev e zerado junto:
 * dormir com o relogio adiantado tres horas devolveria uma manha que ja
 * comeca no fim.
 */
export function startNewDay(): void {
  inicioDia = Date.now();
  offsetMs = 0;
  tick(true);
  clockTick();
}

/**
 * A ordem das REGIOES no dia, sem repetir.
 *
 * Sobrou para nao quebrar quem so quer listar as quatro regioes (loja, painel
 * de dev, album). O ciclo de verdade e o de `HOUR_ORDER`.
 */
export const DAY_ORDER: RegionId[] = ['enseada', 'naufragio', 'recife', 'fossa'];

export const PHASE_MS = DAY_LENGTH_MS / HOUR_ORDER.length;

export interface DayPhase {
  /** a regiao que vale nesta hora (economia) */
  id: RegionId;
  /** a hora do dia (visual) */
  sky: SkyPhaseId;
  /** 0..7 */
  index: number;
  /** quanto ja andou dentro da hora, de 0 a 1 */
  progress: number;
  /** ms que faltam para a proxima hora */
  msLeft: number;
}

/**
 * A hora do dia, contada a partir do comeco DESTE dia.
 *
 * Duas diferencas para o ciclo antigo, e as duas sao o pedido:
 *
 *   COMECA NA MANHA CLARA. O indice parte de `INICIO`, e nao de zero.
 *
 *   NAO DA A VOLTA. Chegando na noite profunda, fica nela. Amanhecer no meio
 *   da sessao era o efeito do resto da divisao, e e ele que some: o cais so
 *   amanhece quando o jogador dorme e o dia seguinte comeca.
 *
 * O indice ainda pode cair ANTES do inicio - `shiftClock` com valor negativo,
 * no painel de dev - e e assim que se olha o pre-amanhecer e o nascer do sol
 * sem eles estarem no ciclo.
 */
export function dayPhaseAt(now = gameNow()): DayPhase {
  const t = now - inicioDia;
  const passos = Math.floor(t / PHASE_MS);
  const index = Math.max(0, Math.min(HOUR_ORDER.length - 1, INICIO + passos));
  const into = ((t % PHASE_MS) + PHASE_MS) % PHASE_MS;
  const sky = HOUR_ORDER[index];
  const parado = index === HOUR_ORDER.length - 1 && INICIO + passos >= index;
  return {
    id: SKY_BY_ID[sky].region,
    sky,
    index,
    progress: parado ? 1 : into / PHASE_MS,
    msLeft: parado ? Infinity : PHASE_MS - into,
  };
}

/** Qual regiao esta valendo agora - para quem nao e componente React. */
export function currentPhase(): RegionId {
  return dayPhaseAt().id;
}

/** Que hora do dia esta no ar agora. */
export function currentSky(): SkyPhaseId {
  return dayPhaseAt().sky;
}

/** Hora ficticia do mundo, em formato 24h, so para mostrar na tela. */
/**
 * Hora ficticia do mundo, em formato 24h, so para mostrar na tela.
 *
 * Sai da FASE, e nao mais de uma regra de tres em cima do dia inteiro: cada
 * hora do dia ja diz a que hora ficticia ela comeca (`SkyPhase.hour`), e as
 * fases sao de tres em tres. Com o ciclo pulando o pre-amanhecer e o nascer do
 * sol, a regra de tres antiga mostraria 03:00 numa manha clara.
 */
export function clockLabel(now = gameNow()): string {
  const fase = dayPhaseAt(now);
  const hours = (SKY_BY_ID[fase.sky].hour + Math.min(0.999, fase.progress) * 3) % 24;
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
let snapshot: SkyPhaseId = currentSky();
let timer: ReturnType<typeof setInterval> | undefined;

function tick(force = false) {
  const next = currentSky();
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

/** Leva o relogio para o comeco de uma hora, sem passar pelas outras. */
export function jumpToSky(id: SkyPhaseId): void {
  const target = HOUR_ORDER.indexOf(id);
  if (target < 0) return;
  const t = gameNow() - inicioDia;
  // meio da fase, e nao a borda: parar em cima da virada troca de fase sozinho
  const want = (target - INICIO) * PHASE_MS + PHASE_MS * 0.15;
  shiftClock(want - t);
}

/** Leva o relogio para a primeira hora em que a regiao pedida vale. */
export function jumpToPhase(id: RegionId): void {
  const hour = HOUR_ORDER.find((h) => SKY_BY_ID[h].region === id);
  if (hour) jumpToSky(hour);
}

/** Devolve o relogio para a hora de verdade deste dia. */
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

/** A hora do dia que esta valendo, re-renderizando so quando ela troca. */
export function useSkyPhase(): SkyPhaseId {
  return useSyncExternalStore(
    subscribe,
    () => snapshot,
    () => snapshot,
  );
}

/** A regiao que esta valendo, derivada da hora. */
export function useDayPhase(): RegionId {
  return SKY_BY_ID[useSkyPhase()].region;
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
