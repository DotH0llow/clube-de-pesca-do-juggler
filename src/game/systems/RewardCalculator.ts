/**
 * RewardCalculator - toda a matematica de recompensa do jogo mora aqui.
 *
 * Regra de ouro: o valor-base de uma captura e SEMPRE garantido. So o bonus
 * gerado por multiplicadores pode ficar pendente e, portanto, ser perdido.
 * Nenhuma funcao deste arquivo mexe em estado; sao funcoes puras, testadas em
 * `scripts/test-rewards.ts`.
 *
 * Ordem fixa (spec 13):
 *
 *   finalBaseValue  = valor do peixe ja com o peso aplicado
 *   guaranteedValue = finalBaseValue * multiplicador garantido de carta
 *   pendingBonus    = finalBaseValue * (streakMultiplier - 1)
 *   specialBonus    = finalBaseValue * ((hidden * event) - 1)
 *
 * O `- 1` nos dois ultimos e proposital: eles sao BONUS sobre a base, nao um
 * novo total. Sem isso, um peixe prateado num cardume pagaria 3x a base duas
 * vezes (uma na base, outra no "bonus").
 */

import {
  HIDDEN_FISH_MODIFIERS,
  JACKPOT_TIERS,
  MAX_EVENT_CAPTURE_MULTIPLIER,
  MAX_JACKPOT_MULTIPLIER,
  MAX_NORMAL_CAPTURE_MULTIPLIER,
  STREAK_TIERS,
  type HiddenFishModifier,
  type JackpotTier,
} from '../balance';

export interface RewardInput {
  /** valor do peixe apos peso, regiao e upgrades (o que a engine ja calcula) */
  finalBaseValue: number;
  /** multiplicador da faixa de sequencia atual (1 = sem sequencia) */
  streakMultiplier: number;
  /** multiplicador garantido vindo de carta (ex.: Venda Dupla = 2) */
  guaranteedCardMultiplier?: number;
  /** modificador escondido revelado nesta captura */
  hidden?: HiddenFishModifier | null;
  /** multiplicador do Cardume Bonus em andamento */
  eventMultiplier?: number;
  /** categoria do Peixe Jackpot, se for um */
  jackpot?: JackpotTier | null;
  /** true enquanto o jogador esta numa sequencia viva */
  inStreak?: boolean;
  /** o bonus do jackpot vai para o pendente quando em sequencia */
  jackpotBonusToPendingWhileStreaking?: boolean;
}

export interface RewardBreakdown {
  /** vai direto para o save, nunca some */
  guaranteed: number;
  /** fica em risco ate o jogador sacar */
  pending: number;
  /** guaranteed + pending, so para exibicao */
  total: number;
  /** multiplicador efetivo aplicado (total / base) */
  effectiveMultiplier: number;
  /** true se algum limite cortou o valor */
  capped: boolean;
  /** teto que estava valendo */
  cap: number;
}

export function streakMultiplierFor(catches: number): number {
  let multiplier = 1;
  for (const tier of STREAK_TIERS) {
    if (catches >= tier.catches) multiplier = tier.multiplier;
  }
  return multiplier;
}

/** Proxima faixa de sequencia, ou null se ja esta no topo. */
export function nextStreakTier(catches: number): { catches: number; multiplier: number } | null {
  for (const tier of STREAK_TIERS) {
    if (catches < tier.catches) return { catches: tier.catches, multiplier: tier.multiplier };
  }
  return null;
}

function round(v: number): number {
  return Math.max(0, Math.round(v));
}

/**
 * Calcula a divisao garantido/pendente de uma captura.
 * Aplica o teto correspondente ao contexto (normal, evento ou jackpot).
 */
export function calculateCatchReward(input: RewardInput): RewardBreakdown {
  const base = Math.max(0, input.finalBaseValue);
  const streak = Math.max(1, input.streakMultiplier || 1);
  const cardMul = Math.max(1, input.guaranteedCardMultiplier ?? 1);
  const event = Math.max(1, input.eventMultiplier ?? 1);
  const hiddenMul = input.hidden ? HIDDEN_FISH_MODIFIERS[input.hidden].multiplier : 1;
  const jackpotMul = input.jackpot ? JACKPOT_TIERS[input.jackpot].multiplier : 1;

  const cap = input.jackpot
    ? MAX_JACKPOT_MULTIPLIER
    : event > 1
      ? MAX_EVENT_CAPTURE_MULTIPLIER
      : MAX_NORMAL_CAPTURE_MULTIPLIER;

  // --- parcelas, cada uma como BONUS sobre a base
  let guaranteedMul = cardMul;
  let pendingMul = streak - 1;
  const specialMul = hiddenMul * event - 1;
  const jackpotBonusMul = jackpotMul - 1;

  // o bonus especial (oculto + evento) acompanha o destino do pendente:
  // em sequencia ele fica em risco junto, fora dela e garantido na hora
  if (input.inStreak) {
    pendingMul += specialMul;
  } else {
    guaranteedMul += specialMul;
  }

  if (jackpotBonusMul > 0) {
    if (input.inStreak && (input.jackpotBonusToPendingWhileStreaking ?? true)) {
      pendingMul += jackpotBonusMul;
    } else {
      guaranteedMul += jackpotBonusMul;
    }
  }

  // --- teto: corta proporcionalmente, comecando pelo pendente
  let totalMul = guaranteedMul + pendingMul;
  let capped = false;
  if (totalMul > cap) {
    capped = true;
    const excess = totalMul - cap;
    const cutFromPending = Math.min(pendingMul, excess);
    pendingMul -= cutFromPending;
    guaranteedMul -= excess - cutFromPending;
    guaranteedMul = Math.max(1, guaranteedMul);
    totalMul = guaranteedMul + pendingMul;
  }

  const guaranteed = round(base * guaranteedMul);
  const pending = round(base * pendingMul);

  return {
    guaranteed,
    pending,
    total: guaranteed + pending,
    effectiveMultiplier: base > 0 ? (guaranteed + pending) / base : 0,
    capped,
    cap,
  };
}

/** Valor total da escada apos N etapas vencidas, em cima do valor-base. */
export function ladderBonus(baseValue: number, stepsCleared: number, steps: readonly { bonusMultiplier: number }[]): number {
  if (stepsCleared <= 0) return 0;
  const idx = Math.min(stepsCleared, steps.length) - 1;
  return round(baseValue * steps[idx].bonusMultiplier);
}

/** Sorteio ponderado generico, usado por roda, jackpot e modificadores. */
export function weightedPickFrom<T extends { weight: number }>(list: readonly T[], roll = Math.random()): T {
  const total = list.reduce((a, b) => a + b.weight, 0);
  let acc = roll * total;
  for (const item of list) {
    acc -= item.weight;
    if (acc <= 0) return item;
  }
  return list[list.length - 1];
}

/** Categoria do jackpot, respeitando os pesos de balance.ts. */
export function rollJackpotTier(roll = Math.random()): JackpotTier {
  const entries = (Object.keys(JACKPOT_TIERS) as JackpotTier[]).map((id) => ({
    id,
    weight: JACKPOT_TIERS[id].weight,
  }));
  return weightedPickFrom(entries, roll).id;
}

/**
 * Sorteia o modificador escondido de um peixe.
 * `chanceMultiplier` vem da carta Coroa do Mar.
 */
export function rollHiddenModifier(
  chanceMultiplier = 1,
  roll = Math.random() * 100,
): HiddenFishModifier | null {
  // do mais raro para o mais comum, para o coroado nunca ser engolido
  const order: HiddenFishModifier[] = ['crowned', 'gold', 'silver'];
  let threshold = 0;
  for (const id of order) {
    threshold += HIDDEN_FISH_MODIFIERS[id].chance * chanceMultiplier;
    if (roll < threshold) return id;
  }
  return null;
}
