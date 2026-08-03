import { useSyncExternalStore } from 'react';
import { LUCKY_CARDS_BY_ID, drawCardChoices, type LuckyCard } from '../data/luckyCards';
import { MISSION_BY_ID, MISSION_LINES, generateBoard, type MissionEvent } from '../data/missions';
import {
  BONUS_SCHOOL_DURATION_MS,
  BONUS_SCHOOL_FAIL_PENALTY_MS,
  CARD_CHOICES,
  CARD_STREAK_TRIGGER,
  CASH_OUT_MIN_STREAK,
  CASH_OUT_RELEVANT_BONUS,
  CASH_OUT_REPEAT_EVERY,
  CATCHES_PER_SPIN,
  JACKPOT_METER_MAX,
  METER_GAIN_BY_RARITY,
  METER_GAIN_MISSION_LINE,
  METER_GAIN_NEW_RECORD,
  METER_GAIN_PERFECT_CAST,
  TIDE_WHEEL_REWARDS,
  bonusSchoolMultiplier,
  type TideWheelRewardId,
} from '../game/balance';
import {
  calculateCatchReward,
  streakMultiplierFor,
  weightedPickFrom,
  type RewardBreakdown,
} from '../game/systems/RewardCalculator';
import type { HiddenFishModifier, JackpotTier } from '../game/balance';
import { getState, updateState } from './store';
import type { CasinoMechanicsState, LuckyCardId, TideWheelResult } from './casinoTypes';
import type { Rarity } from './types';

/**
 * Camada de acao das mecanicas de risco/recompensa.
 *
 * Regra que este arquivo inteiro respeita: `sazoncoins` do save so cresce.
 * A unica coisa que pode diminuir e `casino.streak.pendingCoins`.
 */

// ==================================================== estado volatil da sessao

export interface BonusSchoolState {
  active: boolean;
  endsAt: number;
  catches: number;
  coinsSecured: number;
  coinsBonus: number;
  bestMultiplier: number;
}

interface SessionState {
  bonusSchool: BonusSchoolState;
  /** x2 da roda, aplicado na proxima captura */
  temporaryMultiplier: number;
  /** lancamentos restantes com isca rara da roda */
  rareBaitCasts: number;
  /** cartas oferecidas aguardando escolha */
  cardOffer: LuckyCard[] | null;
  /** resultado da roda ja sorteado, esperando a animacao */
  wheelResult: TideWheelResult | null;
  lastSummary: { secured: number; pending: number; multiplier: number } | null;
}

const emptySession = (): SessionState => ({
  bonusSchool: { active: false, endsAt: 0, catches: 0, coinsSecured: 0, coinsBonus: 0, bestMultiplier: 1 },
  temporaryMultiplier: 1,
  rareBaitCasts: 0,
  cardOffer: null,
  wheelResult: null,
  lastSummary: null,
});

let session: SessionState = emptySession();
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

export function getSession(): SessionState {
  return session;
}

export function subscribeSession(fn: () => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

export function useSession(): SessionState {
  return useSyncExternalStore(subscribeSession, getSession, getSession);
}

function patchSession(p: Partial<SessionState>) {
  session = { ...session, ...p };
  emit();
}

/** Zera o que e da sessao. Chamado ao sair da pescaria ou voltar ao titulo. */
export function resetSession(): void {
  loseStreak('sessão encerrada');
  session = emptySession();
  emit();
}

// ==================================================== leitura de conveniencia

export function casino(): CasinoMechanicsState {
  return getState().casino;
}

function patchCasino(fn: (c: CasinoMechanicsState) => CasinoMechanicsState): void {
  updateState((s) => ({ ...s, casino: fn(s.casino) }));
}

export function hasCard(id: LuckyCardId): boolean {
  return casino().activeCards.some((c) => c.id === id);
}

// ==================================================== cartas

/** Gasta um uso da carta e remove quando acaba. */
function consumeCard(id: LuckyCardId): void {
  patchCasino((c) => ({
    ...c,
    activeCards: c.activeCards
      .map((a) => (a.id === id ? { ...a, remaining: a.remaining - 1 } : a))
      .filter((a) => a.remaining !== 0),
  }));
}

/** Um lancamento consumiu o turno: cartas com duracao em lancamentos andam. */
export function tickCastCards(): void {
  patchCasino((c) => ({
    ...c,
    activeCards: c.activeCards
      .map((a) =>
        LUCKY_CARDS_BY_ID[a.id].durationType === 'next-casts' ? { ...a, remaining: a.remaining - 1 } : a,
      )
      .filter((a) => a.remaining !== 0),
  }));
  if (session.rareBaitCasts > 0) patchSession({ rareBaitCasts: session.rareBaitCasts - 1 });
}

export function offerCards(): void {
  if (session.cardOffer) return;
  patchSession({ cardOffer: drawCardChoices(CARD_CHOICES) });
}

export function chooseCard(id: LuckyCardId): void {
  const def = LUCKY_CARDS_BY_ID[id];
  patchSession({ cardOffer: null });

  if (def.durationType === 'instant') {
    if (id === 'fortuna-crescente') addMeter(15);
    if (id === 'cardume-repentino') startBonusSchool();
    missionEvent({ type: 'card-used' });
    return;
  }

  patchCasino((c) => ({
    ...c,
    activeCards: [
      ...c.activeCards.filter((a) => a.id !== id),
      { id, remaining: def.durationValue ?? -1 },
    ],
  }));
  missionEvent({ type: 'card-used' });
}

export function dismissCardOffer(): void {
  patchSession({ cardOffer: null });
}

// ==================================================== medidor da fortuna

export function addMeter(points: number): void {
  patchCasino((c) => {
    const value = Math.min(JACKPOT_METER_MAX, Math.max(0, c.jackpotMeter.value + points));
    return {
      ...c,
      jackpotMeter: { value, jackpotReady: value >= JACKPOT_METER_MAX || c.jackpotMeter.jackpotReady },
    };
  });
}

/** Consome o medidor cheio ao gerar o encontro jackpot. */
export function consumeJackpotReady(): void {
  patchCasino((c) => ({ ...c, jackpotMeter: { value: 0, jackpotReady: false } }));
}

// ==================================================== sequencia e saque

export interface CatchContext {
  rarity: Rarity;
  baseValue: number;
  weightKg: number;
  perfect: boolean;
  newRecord: boolean;
  jackpot: JackpotTier | null;
  hidden: HiddenFishModifier | null;
}

export interface CatchOutcome {
  breakdown: RewardBreakdown;
  streak: number;
  multiplier: number;
  tierUp: boolean;
  offerCashOut: boolean;
  offerLadder: boolean;
  gotSpin: boolean;
}

/**
 * Registra uma captura bem-sucedida: sobe a sequencia, calcula garantido x
 * pendente, alimenta medidor, cartela e roda.
 * Devolve o que a UI precisa mostrar. NAO credita o garantido - quem faz isso
 * e o `applyCast`, junto do resto do save.
 */
export function registerCatch(ctx: CatchContext): CatchOutcome {
  const c = casino();
  const before = c.streak.current;
  const streak = before + 1;
  const multiplier = streakMultiplierFor(streak);
  const tierUp = multiplier > streakMultiplierFor(before);

  const cardMultiplier = hasCard('venda-dupla') ? 2 : hasCard('mare-favoravel') ? 2 : 1;
  const eventMultiplier = session.bonusSchool.active
    ? bonusSchoolMultiplier(session.bonusSchool.catches)
    : 1;

  const breakdown = calculateCatchReward({
    finalBaseValue: ctx.baseValue * session.temporaryMultiplier,
    streakMultiplier: multiplier,
    guaranteedCardMultiplier: cardMultiplier,
    hidden: ctx.hidden,
    eventMultiplier,
    jackpot: ctx.jackpot,
    inStreak: streak > 1,
  });

  if (cardMultiplier > 1) consumeCard(hasCard('venda-dupla') ? 'venda-dupla' : 'mare-favoravel');
  if (session.temporaryMultiplier > 1) patchSession({ temporaryMultiplier: 1 });

  // --- medidor
  let meterGain = METER_GAIN_BY_RARITY[ctx.rarity] ?? 1;
  if (ctx.newRecord) meterGain += METER_GAIN_NEW_RECORD;
  if (ctx.perfect) meterGain += METER_GAIN_PERFECT_CAST;

  // --- roda
  const spinsBefore = c.tideWheel.availableSpins;
  let catchesUntilNextSpin = c.tideWheel.catchesUntilNextSpin - 1;
  let availableSpins = c.tideWheel.availableSpins;
  if (catchesUntilNextSpin <= 0) {
    availableSpins += 1;
    catchesUntilNextSpin = CATCHES_PER_SPIN;
  }

  patchCasino((cur) => ({
    ...cur,
    streak: {
      ...cur.streak,
      current: streak,
      best: Math.max(cur.streak.best, streak),
      multiplier,
      pendingCoins: cur.streak.pendingCoins + breakdown.pending,
    },
    jackpotMeter: {
      value: Math.min(JACKPOT_METER_MAX, cur.jackpotMeter.value + meterGain),
      jackpotReady: cur.jackpotMeter.value + meterGain >= JACKPOT_METER_MAX || cur.jackpotMeter.jackpotReady,
    },
    tideWheel: { availableSpins, catchesUntilNextSpin },
    statistics: {
      ...cur.statistics,
      highestStreakMultiplier: Math.max(cur.statistics.highestStreakMultiplier, multiplier),
      jackpotFishCaught: cur.statistics.jackpotFishCaught + (ctx.jackpot ? 1 : 0),
    },
  }));

  if (session.bonusSchool.active) {
    const catches = session.bonusSchool.catches + 1;
    patchSession({
      bonusSchool: {
        ...session.bonusSchool,
        catches,
        coinsSecured: session.bonusSchool.coinsSecured + breakdown.guaranteed,
        coinsBonus: session.bonusSchool.coinsBonus + breakdown.pending,
        bestMultiplier: Math.max(session.bonusSchool.bestMultiplier, bonusSchoolMultiplier(catches)),
      },
    });
  }

  // --- cartela
  missionEvent({
    type: 'catch',
    rarity: ctx.rarity,
    weight: ctx.weightKg,
    perfect: ctx.perfect,
    newRecord: ctx.newRecord,
  });
  missionEvent({ type: 'streak', value: streak });
  missionEvent({ type: 'multiplier', value: multiplier });

  if (streak === CARD_STREAK_TRIGGER || ctx.rarity === 'raro') offerCards();

  const pending = casino().streak.pendingCoins;
  const offerCashOut =
    streak >= CASH_OUT_MIN_STREAK &&
    pending > 0 &&
    (tierUp ||
      pending >= CASH_OUT_RELEVANT_BONUS ||
      streak - casino().streak.lastOfferAt >= CASH_OUT_REPEAT_EVERY ||
      ['raro', 'epico', 'lendario', 'mitico'].includes(ctx.rarity));

  if (offerCashOut) {
    patchCasino((cur) => ({ ...cur, streak: { ...cur.streak, lastOfferAt: streak } }));
  }

  return {
    breakdown,
    streak,
    multiplier,
    tierUp,
    offerCashOut,
    offerLadder: ['raro', 'epico', 'lendario', 'mitico'].includes(ctx.rarity),
    gotSpin: availableSpins > spinsBefore,
  };
}

/** Saque: o pendente vira moeda garantida e a sequencia recomeca. */
export function cashOut(): number {
  const c = casino();
  const amount = c.streak.pendingCoins;
  if (amount <= 0) return 0;

  updateState((s) => ({
    ...s,
    sazoncoins: s.sazoncoins + amount,
    lifetimeValue: s.lifetimeValue + amount,
    stats: { ...s.stats, totalEarned: s.stats.totalEarned + amount },
    casino: {
      ...s.casino,
      streak: { ...s.casino.streak, current: 0, multiplier: 1, pendingCoins: 0, lastOfferAt: 0 },
      statistics: {
        ...s.casino.statistics,
        totalPendingCoinsCashedOut: s.casino.statistics.totalPendingCoinsCashedOut + amount,
      },
    },
  }));

  patchSession({ lastSummary: { secured: amount, pending: 0, multiplier: c.streak.multiplier } });
  missionEvent({ type: 'cash-out' });
  return amount;
}

/**
 * Falha: a sequencia cai e o pendente vai embora.
 * Nenhuma moeda ja garantida e tocada, nunca.
 */
export function loseStreak(_reason: string): number {
  const c = casino();
  if (c.streak.current === 0 && c.streak.pendingCoins === 0) return 0;

  // "Pescador Implacável" segura a sequencia por uma falha, cobrando metade
  const shielded = hasCard('pescador-implacavel');
  const lost = shielded ? Math.floor(c.streak.pendingCoins / 2) : c.streak.pendingCoins;

  if (shielded) consumeCard('pescador-implacavel');

  patchCasino((cur) => ({
    ...cur,
    streak: {
      ...cur.streak,
      current: shielded ? cur.streak.current : 0,
      multiplier: shielded ? cur.streak.multiplier : 1,
      pendingCoins: cur.streak.pendingCoins - lost,
      lastOfferAt: shielded ? cur.streak.lastOfferAt : 0,
    },
    statistics: {
      ...cur.statistics,
      totalPendingCoinsLost: cur.statistics.totalPendingCoinsLost + lost,
    },
  }));

  return lost;
}

// ==================================================== roda da mare

/**
 * Sorteia o premio ANTES da animacao, como manda a spec: a interface so recebe
 * um resultado pronto e gira ate ele.
 */
export function spinTideWheel(): TideWheelResult | null {
  const c = casino();
  if (c.tideWheel.availableSpins <= 0) return null;

  const reward = weightedPickFrom(TIDE_WHEEL_REWARDS);
  const index = TIDE_WHEEL_REWARDS.findIndex((r) => r.id === reward.id);
  const result: TideWheelResult = { id: reward.id, label: reward.label, index };

  patchCasino((cur) => ({
    ...cur,
    tideWheel: { ...cur.tideWheel, availableSpins: cur.tideWheel.availableSpins - 1 },
    statistics: { ...cur.statistics, tideWheelSpins: cur.statistics.tideWheelSpins + 1 },
  }));
  patchSession({ wheelResult: result });
  return result;
}

/** Aplica o premio depois que a animacao termina. */
export function applyWheelReward(id: TideWheelRewardId): void {
  const reward = TIDE_WHEEL_REWARDS.find((r) => r.id === id);
  if (!reward) return;

  const coins = 'coins' in reward ? reward.coins : 0;
  if (coins) {
    updateState((s) => ({
      ...s,
      sazoncoins: s.sazoncoins + coins,
      lifetimeValue: s.lifetimeValue + coins,
      stats: { ...s.stats, totalEarned: s.stats.totalEarned + coins },
    }));
  }

  switch (id) {
    case 'temporary-multiplier':
      patchSession({ temporaryMultiplier: 2 });
      break;
    case 'rare-bait':
      patchSession({ rareBaitCasts: 3 });
      break;
    case 'bonus-school':
      startBonusSchool();
      break;
    case 'lucky-card':
      offerCards();
      break;
    case 'jackpot-progress':
      addMeter(20);
      break;
    default:
      break;
  }
  patchSession({ wheelResult: null });
}

// ==================================================== cardume bonus

export function startBonusSchool(): void {
  patchSession({
    bonusSchool: {
      active: true,
      endsAt: Date.now() + BONUS_SCHOOL_DURATION_MS,
      catches: 0,
      coinsSecured: 0,
      coinsBonus: 0,
      bestMultiplier: 1,
    },
  });
}

/** Falhar durante o cardume nao encerra: come tempo. */
export function bonusSchoolPenalty(): void {
  if (!session.bonusSchool.active) return;
  patchSession({
    bonusSchool: { ...session.bonusSchool, endsAt: session.bonusSchool.endsAt - BONUS_SCHOOL_FAIL_PENALTY_MS },
  });
}

export function endBonusSchool(): BonusSchoolState {
  const final = session.bonusSchool;
  patchSession({ bonusSchool: { ...final, active: false } });
  patchCasino((c) => ({
    ...c,
    statistics: { ...c.statistics, bonusSchoolsCompleted: c.statistics.bonusSchoolsCompleted + 1 },
  }));
  return final;
}

export function bonusSchoolActive(): boolean {
  return session.bonusSchool.active && Date.now() < session.bonusSchool.endsAt;
}

// ==================================================== escada de premios

export function creditLadder(amount: number, step: number): void {
  if (amount <= 0) return;
  updateState((s) => ({
    ...s,
    sazoncoins: s.sazoncoins + amount,
    lifetimeValue: s.lifetimeValue + amount,
    stats: { ...s.stats, totalEarned: s.stats.totalEarned + amount },
    casino: {
      ...s.casino,
      statistics: {
        ...s.casino.statistics,
        prizeLadderBestStep: Math.max(s.casino.statistics.prizeLadderBestStep, step),
      },
    },
  }));
}

export function registerLadderStep(step: number): void {
  patchCasino((c) => ({
    ...c,
    statistics: { ...c.statistics, prizeLadderBestStep: Math.max(c.statistics.prizeLadderBestStep, step) },
  }));
  missionEvent({ type: 'ladder-step' });
}

// ==================================================== cartela de missoes

/** Recompensa de linha: moedas + medidor + giro. */
function grantLineReward(lines: number): void {
  const coins = 300 + lines * 200;
  updateState((s) => ({
    ...s,
    sazoncoins: s.sazoncoins + coins,
    lifetimeValue: s.lifetimeValue + coins,
    stats: { ...s.stats, totalEarned: s.stats.totalEarned + coins },
    casino: {
      ...s.casino,
      tideWheel: { ...s.casino.tideWheel, availableSpins: s.casino.tideWheel.availableSpins + 1 },
    },
  }));
  addMeter(METER_GAIN_MISSION_LINE);
  if (lines >= 2) patchSession({ temporaryMultiplier: 2 });
  offerCards();
}

function grantFullBoardReward(): void {
  const coins = 5000;
  updateState((s) => ({
    ...s,
    sazoncoins: s.sazoncoins + coins,
    lifetimeValue: s.lifetimeValue + coins,
    stats: { ...s.stats, totalEarned: s.stats.totalEarned + coins },
    casino: {
      ...s.casino,
      statistics: {
        ...s.casino.statistics,
        missionBoardsCompleted: s.casino.statistics.missionBoardsCompleted + 1,
      },
    },
  }));
  addMeter(30);
  startBonusSchool();
}

/** Empurra um evento de gameplay para a cartela. Idempotente por casa. */
export function missionEvent(e: MissionEvent): void {
  const board = casino().missionBoard;
  let changed = false;

  const tiles = board.tiles.map((t) => {
    if (t.completed) return t;
    const def = MISSION_BY_ID[t.id];
    if (!def || !def.matches(e)) return t;
    changed = true;
    // eventos de "alcance X" contam como conclusao direta
    const progress = Math.min(t.target, t.progress + 1);
    return { ...t, progress, completed: progress >= t.target };
  });

  if (!changed) return;

  const completedNow = MISSION_LINES.filter(
    (l) => l.cells.every((c) => tiles[c]?.completed) && !board.completedLines.includes(l.id),
  ).map((l) => l.id);

  const allDone = tiles.every((t) => t.completed);

  patchCasino((c) => ({
    ...c,
    missionBoard: {
      ...c.missionBoard,
      tiles,
      completedLines: [...c.missionBoard.completedLines, ...completedNow],
      fullyCompleted: allDone,
    },
  }));

  // recompensas: cada linha paga uma unica vez
  for (let i = 0; i < completedNow.length; i++) {
    grantLineReward(casino().missionBoard.completedLines.length);
  }

  if (allDone && !board.fullRewardClaimed) {
    patchCasino((c) => ({ ...c, missionBoard: { ...c.missionBoard, fullRewardClaimed: true } }));
    grantFullBoardReward();
  }
}

export function newMissionBoard(): void {
  patchCasino((c) => ({ ...c, missionBoard: generateBoard() }));
}

export function registerCast(): void {
  missionEvent({ type: 'cast' });
  tickCastCards();
}

export function registerJunk(): void {
  missionEvent({ type: 'junk' });
}

// ==================================================== debug

export const debugActions = {
  setStreak(n: number) {
    patchCasino((c) => ({ ...c, streak: { ...c.streak, current: n, multiplier: streakMultiplierFor(n) } }));
  },
  addPending(n: number) {
    patchCasino((c) => ({ ...c, streak: { ...c.streak, pendingCoins: c.streak.pendingCoins + n } }));
  },
  fillMeter() {
    patchCasino((c) => ({ ...c, jackpotMeter: { value: JACKPOT_METER_MAX, jackpotReady: true } }));
  },
  grantSpin() {
    patchCasino((c) => ({ ...c, tideWheel: { ...c.tideWheel, availableSpins: c.tideWheel.availableSpins + 1 } }));
  },
  grantCard: offerCards,
  startSchool: startBonusSchool,
  completeLine() {
    const board = casino().missionBoard;
    const tiles = board.tiles.map((t, i) => (i < 3 ? { ...t, progress: t.target, completed: true } : t));
    patchCasino((c) => ({ ...c, missionBoard: { ...c.missionBoard, tiles } }));
    missionEvent({ type: 'cast' });
  },
  simulateFail() {
    loseStreak('debug');
  },
};
