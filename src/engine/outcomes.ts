import { REGIONS } from '../data/regions';
import { RARITIES } from '../data/rarities';
import type { GameState, Modifiers, OutcomeCategory, Rarity } from '../state/types';
import { clamp, weightedPick } from './rng';

/** Qualidade do lancamento vinda do minigame da barra de forca. */
export type CastQuality = 'perfeito' | 'bom' | 'fraco';

/** Pesos base sugeridos no documento de design (somam 100). */
export const BASE_WEIGHTS: Record<OutcomeCategory, number> = {
  nada: 30,
  lixo: 10,
  comum: 35,
  incomum: 15,
  raro: 6,
  epico: 2.5,
  lendario: 0.8,
  bau: 0.5,
  evento: 0.2,
  falha: 0, // falha critica nasce do minigame, nao do sorteio
};

/** A partir de quantos lancamentos secos o soft pity de raro comeca a agir. */
export const RARE_PITY_START = 45;
export const EPIC_PITY_START = 120;
/** Fragmentos necessarios para forcar um lendario. */
export const SHARDS_FOR_LEGENDARY = 120;

/** Categorias que representam peixe, na ordem de raridade. */
const RARITY_CATEGORIES: { category: OutcomeCategory; rarity: Rarity }[] = [
  { category: 'comum', rarity: 'comum' },
  { category: 'incomum', rarity: 'incomum' },
  { category: 'raro', rarity: 'raro' },
  { category: 'epico', rarity: 'epico' },
  { category: 'lendario', rarity: 'lendario' },
];

/**
 * Aplica o teto de raridade da regiao: o que passa do teto tem o peso
 * empurrado para a maior raridade permitida ali. E o que faz cada pesqueiro
 * novo valer a pena de verdade.
 */
function applyRegionCap(w: Record<OutcomeCategory, number>, maxRarity: Rarity): void {
  const cap = RARITIES[maxRarity].order;
  let overflow = 0;
  let topAllowed: OutcomeCategory = 'comum';

  for (const { category, rarity } of RARITY_CATEGORIES) {
    if (RARITIES[rarity].order > cap) {
      overflow += w[category];
      w[category] = 0;
    } else {
      topAllowed = category;
    }
  }
  if (overflow > 0) w[topAllowed] += overflow;
}

export function regionAllowsLegendary(s: GameState): boolean {
  return RARITIES[REGIONS[s.region].maxRarity].order >= RARITIES.lendario.order;
}

export interface WeightBreakdown {
  weights: Record<OutcomeCategory, number>;
  pityTriggered: boolean;
  forcedLegendary: boolean;
}

/**
 * Monta a tabela de pesos do lancamento atual.
 * Ordem: base -> qualidade do lancamento -> upgrades -> pity -> normalizacao.
 * Exportado separadamente para dar para simular a economia sem rodar o jogo.
 */
export function buildWeights(
  s: GameState,
  mods: Modifiers,
  quality: CastQuality,
): WeightBreakdown {
  const w: Record<OutcomeCategory, number> = { ...BASE_WEIGHTS };
  const maxRarity = REGIONS[s.region].maxRarity;
  let pityTriggered = false;

  // fragmentos cheios: o proximo lendario e garantido (se a regiao tiver lendario)
  if (s.pity.legendaryShards >= SHARDS_FOR_LEGENDARY && regionAllowsLegendary(s)) {
    const forced: Record<OutcomeCategory, number> = {
      nada: 0,
      lixo: 0,
      comum: 0,
      incomum: 0,
      raro: 0,
      epico: 0,
      lendario: 1,
      bau: 0,
      evento: 0,
      falha: 0,
    };
    return { weights: forced, pityTriggered: true, forcedLegendary: true };
  }

  // --- qualidade do lancamento ---
  if (quality === 'perfeito') {
    w.nada -= 6;
    w.incomum *= 1.25;
    w.raro *= 1.25;
    w.epico *= 1.15;
  } else if (quality === 'fraco') {
    w.nada *= 1.35;
    w.incomum *= 0.85;
    w.raro *= 0.8;
    w.epico *= 0.8;
  }

  // --- upgrades e reliquias ---
  w.nada -= mods.nothingReduction;
  w.incomum *= mods.luckMultiplier;
  w.raro *= mods.luckMultiplier;
  w.epico *= mods.fortuneMultiplier;
  w.lendario *= mods.fortuneMultiplier;
  w.bau *= mods.chestMultiplier;
  w.evento *= mods.hydraMultiplier;

  // --- streak correction: muitos lancamentos secos ---
  const dry = s.pity.dryStreak * mods.pitySpeed;
  if (dry >= 3) {
    const relief = Math.min(dry * 1.8, 22);
    w.nada -= relief;
    w.comum += relief * 0.65;
    w.incomum += relief * 0.35;
    pityTriggered = dry >= 6;
  }

  // --- soft pity de raro ---
  const sinceRare = s.pity.castsSinceRare * mods.pitySpeed;
  if (sinceRare > RARE_PITY_START) {
    const over = sinceRare - RARE_PITY_START;
    const boost = 1 + Math.min(over * 0.08, 3);
    w.raro *= boost;
    w.epico *= 1 + Math.min(over * 0.03, 1.2);
    pityTriggered = true;
  }

  // --- soft pity de epico ---
  const sinceEpic = s.pity.castsSinceEpic * mods.pitySpeed;
  if (sinceEpic > EPIC_PITY_START) {
    const over = sinceEpic - EPIC_PITY_START;
    w.epico *= 1 + Math.min(over * 0.05, 2.5);
    w.lendario *= 1 + Math.min(over * 0.02, 1.5);
    pityTriggered = true;
  }

  // teto de raridade do pesqueiro
  applyRegionCap(w, maxRarity);

  // nada nunca some completamente: o jogo precisa de respiro
  w.nada = clamp(w.nada, 4, 100);
  for (const key of Object.keys(w) as OutcomeCategory[]) {
    w[key] = Math.max(0, w[key]);
  }

  return { weights: w, pityTriggered, forcedLegendary: false };
}

export function rollCategory(breakdown: WeightBreakdown): OutcomeCategory {
  return weightedPick(breakdown.weights);
}

/** Percentuais normalizados, uteis para debug e para a tela de estatisticas. */
export function normalized(weights: Record<OutcomeCategory, number>): Record<OutcomeCategory, number> {
  const total = Object.values(weights).reduce((a, b) => a + b, 0) || 1;
  const out = {} as Record<OutcomeCategory, number>;
  for (const key of Object.keys(weights) as OutcomeCategory[]) {
    out[key] = (weights[key] / total) * 100;
  }
  return out;
}
