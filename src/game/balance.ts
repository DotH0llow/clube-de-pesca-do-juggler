/**
 * Balanceamento das mecanicas de risco/recompensa.
 *
 * TODA probabilidade, peso e multiplicador vive aqui. Nenhum numero magico
 * espalhado pelos componentes: se um valor influencia recompensa ou sorteio,
 * ele esta neste arquivo.
 */

import type { Rarity } from '../state/types';

// ============================================================ sequencia

export const STREAK_TIERS = [
  { catches: 0, multiplier: 1.0 },
  { catches: 3, multiplier: 1.2 },
  { catches: 5, multiplier: 1.5 },
  { catches: 8, multiplier: 2.0 },
  { catches: 12, multiplier: 3.0 },
] as const;

/** A partir de quantas capturas seguidas o modal de saque pode aparecer. */
export const CASH_OUT_MIN_STREAK = 3;
/** Reaparece a cada N capturas alem do gatilho anterior. */
export const CASH_OUT_REPEAT_EVERY = 3;
/** Bonus pendente que, sozinho, ja justifica oferecer o saque. */
export const CASH_OUT_RELEVANT_BONUS = 400;

// ============================================================ jackpot

export type JackpotTier = 'minor' | 'major' | 'grand';

export const JACKPOT_TIERS: Record<JackpotTier, { multiplier: number; weight: number }> = {
  minor: { multiplier: 5, weight: 85 },
  major: { multiplier: 15, weight: 14 },
  grand: { multiplier: 50, weight: 1 },
};

/** Chance de um encontro virar Peixe Jackpot por puro RNG (sem medidor cheio). */
export const JACKPOT_RANDOM_CHANCE = 0.004;

/** Dificuldade extra do minigame no Peixe Jackpot. */
export const JACKPOT_DIFFICULTY_BONUS = 0.16;

/**
 * Para onde vai o bonus do jackpot (acima do valor-base).
 * Regra unica e consistente, como pede a spec: em sequencia vira bonus pendente;
 * fora de sequencia e garantido na hora.
 */
export const JACKPOT_BONUS_TO_PENDING_WHILE_STREAKING = true;

// ============================================================ medidor

/** "Maré da Fortuna": 0 a 100. */
export const JACKPOT_METER_MAX = 100;

export const METER_GAIN_BY_RARITY: Record<Rarity, number> = {
  comum: 1,
  incomum: 2,
  raro: 5,
  epico: 10,
  lendario: 20,
  mitico: 20,
};

export const METER_GAIN_NEW_RECORD = 3;
export const METER_GAIN_PERFECT_CAST = 2;
export const METER_GAIN_MISSION_LINE = 8;

/** Marcos do medidor. Os dois do meio mexem no sorteio; os outros sao visuais. */
export const METER_MILESTONES = {
  quarter: 25,
  half: 50,
  threeQuarters: 75,
  full: 100,
} as const;

/** Bonus de peso aplicados ao sorteio quando o medidor passa dos marcos. */
export const METER_UNCOMMON_BOOST = 0.1; // +10% no peso de incomum a partir de 50
export const METER_RARE_BOOST = 0.05; // +5% no peso de raro a partir de 75

// ============================================================ modificadores ocultos

export type HiddenFishModifier = 'silver' | 'gold' | 'crowned';

/** `chance` em porcentagem do total de capturas de peixe. */
export const HIDDEN_FISH_MODIFIERS: Record<
  HiddenFishModifier,
  { multiplier: number; chance: number; label: string }
> = {
  silver: { multiplier: 1.5, chance: 3, label: 'PEIXE PRATEADO' },
  gold: { multiplier: 2, chance: 1, label: 'PEIXE DOURADO' },
  crowned: { multiplier: 3, chance: 0.25, label: 'CAPTURA COROADA' },
};

/** Multiplicador de chance quando a carta "Coroa do Mar" esta ativa. */
export const CROWN_CARD_CHANCE_MULTIPLIER = 3;

// ============================================================ roda da mare

/*
 * A roda da mare foi removida do jogo. O tipo do id fica porque o formato do
 * save antigo ainda o menciona - a mecanica saiu, o dado gravado nao precisa
 * sair junto.
 */
export type TideWheelRewardId = string;

/** Capturas validas necessarias para ganhar um giro. */
export const CATCHES_PER_SPIN = 5;

// ============================================================ cardume bonus

export const BONUS_SCHOOL_DURATION_MS = 25_000;
/** Cada falha durante o evento consome tempo em vez de encerrar. */
export const BONUS_SCHOOL_FAIL_PENALTY_MS = 3_000;
export const BONUS_SCHOOL_MAX_MULTIPLIER = 3;
/** Dificuldade dos comuns cai; raros continuam duros. */
export const BONUS_SCHOOL_COMMON_DIFFICULTY_CUT = 0.4;
/** A espera pela mordida encurta. */
export const BONUS_SCHOOL_BITE_SPEED = 0.35;

export function bonusSchoolMultiplier(successfulCatches: number): number {
  return Math.min(BONUS_SCHOOL_MAX_MULTIPLIER, 1 + Math.floor(successfulCatches / 3) * 0.5);
}

// ============================================================ escada de premios

export type LadderDifficulty = 'easy' | 'medium' | 'hard' | 'extreme';

export const PRIZE_LADDER: {
  step: number;
  bonusMultiplier: number;
  difficulty: LadderDifficulty;
  /** largura da zona de acerto, 0 a 1 */
  zone: number;
  /** voltas por segundo do marcador */
  speed: number;
}[] = [
  { step: 1, bonusMultiplier: 0.2, difficulty: 'easy', zone: 0.28, speed: 0.55 },
  { step: 2, bonusMultiplier: 0.5, difficulty: 'medium', zone: 0.19, speed: 0.75 },
  { step: 3, bonusMultiplier: 1, difficulty: 'hard', zone: 0.12, speed: 1.0 },
  { step: 4, bonusMultiplier: 2, difficulty: 'extreme', zone: 0.07, speed: 1.35 },
];

/** Raridade minima da captura para a escada ser oferecida. */
export const LADDER_MIN_RARITY: Rarity = 'raro';

// ============================================================ limites

export const MAX_NORMAL_CAPTURE_MULTIPLIER = 10;
export const MAX_EVENT_CAPTURE_MULTIPLIER = 25;
export const MAX_JACKPOT_MULTIPLIER = 50;

// ============================================================ cartas

/** Quantas cartas sao oferecidas na escolha. */
export const CARD_CHOICES = 3;
/** Capturas seguidas que disparam uma oferta de carta. */
export const CARD_STREAK_TRIGGER = 5;

// ============================================================ debug

/**
 * Painel de debug. Ligado por env em desenvolvimento ou por
 * `localStorage.setItem('juggler-debug', '1')`.
 */
export function debugEnabled(): boolean {
  try {
    if (localStorage.getItem('juggler-debug') === '1') return true;
  } catch {
    /* modo privado */
  }
  return import.meta.env.DEV && import.meta.env.VITE_DEBUG_GAME === 'true';
}
