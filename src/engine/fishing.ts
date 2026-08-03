import { fishByRarity } from '../data/fish';
import { CHEST_LOOT, JUNK } from '../data/junk';
import { REGIONS } from '../data/regions';
import type { CastResult, GameState, Modifiers, OutcomeCategory, Rarity } from '../state/types';
import {
  CROWN_CARD_CHANCE_MULTIPLIER,
  JACKPOT_DIFFICULTY_BONUS,
  JACKPOT_RANDOM_CHANCE,
  JACKPOT_TIERS,
} from '../game/balance';
import { rollHiddenModifier, rollJackpotTier } from '../game/systems/RewardCalculator';
import { computeModifiers } from './modifiers';
import { buildWeights, rollCategory, type CastQuality } from './outcomes';
import { chance, clamp, pick, randFloat, randInt, roundTo, skewedRoll } from './rng';

/** Dificuldade base do minigame de puxada por raridade. */
const REEL_DIFFICULTY: Record<Rarity, number> = {
  comum: 0.1,
  incomum: 0.2,
  raro: 0.36,
  epico: 0.52,
  lendario: 0.68,
  mitico: 0.82,
};

const CATEGORY_TO_RARITY: Partial<Record<OutcomeCategory, Rarity>> = {
  comum: 'comum',
  incomum: 'incomum',
  raro: 'raro',
  epico: 'epico',
  lendario: 'lendario',
};

const NOTHING_LINES = [
  'A isca voltou limpa.',
  'Nem um toque na linha.',
  'Só mexeu a água.',
  'Peixe nenhum. Só paisagem.',
  'A boia nem piscou.',
];

const QUALITY_VALUE_MULT: Record<CastQuality, number> = {
  perfeito: 1.15,
  bom: 1,
  fraco: 0.9,
};

export interface ResolvedCast {
  result: CastResult;
  mods: Modifiers;
}

/**
 * Resolve um lancamento inteiro: sorteia a categoria, materializa o item
 * e calcula valor, Olhos da Hydra e dificuldade da puxada.
 * NAO altera o estado - quem aplica isso e o store.
 */
/**
 * Contexto extra vindo das mecanicas de risco/recompensa.
 * Fica fora do GameState para a engine continuar sendo pura.
 */
export interface CasinoContext {
  /** medidor cheio: o proximo encontro elegivel vira Peixe Jackpot */
  jackpotReady: boolean;
  /** carta Coroa do Mar ativa */
  crownCard: boolean;
  /** carta/premio de isca rara ativo */
  rareBait: boolean;
  /** cardume bonus rolando: comuns ficam mais faceis */
  bonusSchool: boolean;
}

export function resolveCast(
  s: GameState,
  quality: CastQuality,
  ctx: CasinoContext = { jackpotReady: false, crownCard: false, rareBait: false, bonusSchool: false },
): ResolvedCast {
  const mods = computeModifiers(s);
  const region = REGIONS[s.region];
  const breakdown = buildWeights(s, mods, quality);
  let category = rollCategory(breakdown);

  // Evento Hydra: as vezes vira encontro mitico, as vezes so uma sombra na agua.
  let mythic = false;
  if (category === 'evento') {
    const mythChance = s.region === 'fossa' ? 0.7 : s.region === 'naufragio' ? 0.2 : 0;
    mythic = chance(mythChance);
  }

  const result: CastResult = {
    category,
    weight: 0,
    length: 0,
    value: 0,
    eyes: 0,
    difficulty: 0,
    headline: '',
    pityTriggered: breakdown.pityTriggered,
  };

  const rarity: Rarity | undefined = mythic ? 'mitico' : CATEGORY_TO_RARITY[category];

  if (rarity) {
    const species = pick(fishByRarity(rarity, s.region));
    const roll = skewedRoll(rarity === 'comum' ? 1.8 : 2.4);
    const weight = roundTo(species.weight[0] + (species.weight[1] - species.weight[0]) * roll, 2);
    const length = Math.round(species.length[0] + (species.length[1] - species.length[0]) * roll);
    const sizeRatio = roll;

    const raw =
      species.baseValue *
      (0.55 + sizeRatio * 0.9) *
      region.valueMultiplier *
      mods.valueMultiplier *
      QUALITY_VALUE_MULT[quality];

    result.fish = species;
    result.weight = weight;
    result.length = length;
    result.value = Math.max(1, Math.round(raw));
    result.difficulty = clamp(
      REEL_DIFFICULTY[rarity] + region.difficulty * 0.5 + sizeRatio * 0.12 - mods.reelAssist,
      0.05,
      0.93,
    );
    result.eyes = rollEyes(rarity, mods);
    result.headline = headlineFor(rarity, mythic);

    // ------------------------------------------------- Peixe Jackpot
    // So peixe de verdade vira jackpot, e so se o jogador conseguir puxar:
    // dificuldade sobe, mas nunca passa do teto do minigame.
    const jackpotByMeter = ctx.jackpotReady;
    const jackpotByLuck = chance(JACKPOT_RANDOM_CHANCE);
    if (jackpotByMeter || jackpotByLuck) {
      result.jackpot = rollJackpotTier();
      result.difficulty = clamp(result.difficulty + JACKPOT_DIFFICULTY_BONUS, 0.05, 0.9);
      result.headline = `JACKPOT ${JACKPOT_TIERS[result.jackpot].multiplier}X`;
    } else {
      // ------------------------------------------ modificador escondido
      // Nunca em lixo, nada, bau ou evento - e nunca sobre um jackpot.
      result.hidden = rollHiddenModifier(ctx.crownCard ? CROWN_CARD_CHANCE_MULTIPLIER : 1);
    }

    if (ctx.bonusSchool && (rarity === 'comum' || rarity === 'incomum')) {
      result.difficulty = clamp(result.difficulty * 0.6, 0.04, 0.9);
    }

    if (mythic) result.category = 'evento';
    return { result, mods };
  }

  switch (category) {
    case 'lixo': {
      const junk = pick(JUNK);
      result.junk = junk;
      result.value = Math.round(junk.value * mods.valueMultiplier);
      result.difficulty = 0.05;
      result.headline = 'Veio pesado... e inútil.';
      break;
    }
    case 'bau': {
      const coins = randInt(CHEST_LOOT.minCoins, CHEST_LOOT.maxCoins);
      result.value = Math.round(coins * region.valueMultiplier * mods.valueMultiplier);
      result.eyes = chance(CHEST_LOOT.eyeChance + mods.eyeBonus * 0.5) ? 1 : 0;
      result.difficulty = clamp(0.4 + region.difficulty * 0.5 - mods.reelAssist, 0.05, 0.8);
      result.headline = 'Baú afundado!';
      break;
    }
    case 'evento': {
      // sombra na agua: nao da para pescar, mas a Hydra reconhece o esforco
      result.eyes = randInt(1, 2) + (chance(mods.eyeBonus) ? 1 : 0);
      result.difficulty = 0;
      result.headline = 'Sombra no Lago';
      break;
    }
    default: {
      category = 'nada';
      result.category = 'nada';
      result.difficulty = 0;
      result.headline = pick(NOTHING_LINES);
      break;
    }
  }

  return { result, mods };
}

function rollEyes(rarity: Rarity, mods: Modifiers): number {
  switch (rarity) {
    case 'mitico':
      return randInt(3, 6) + (chance(mods.eyeBonus) ? 1 : 0);
    case 'lendario':
      return randInt(1, 2) + (chance(mods.eyeBonus) ? 1 : 0);
    case 'epico':
      return chance(0.25 + mods.eyeBonus) ? 1 : 0;
    default:
      return 0;
  }
}

function headlineFor(rarity: Rarity, mythic: boolean): string {
  if (mythic) return 'A HYDRA OLHOU DE VOLTA';
  switch (rarity) {
    case 'lendario':
      return 'LENDA NO ANZOL';
    case 'epico':
      return 'Peixe grande!';
    case 'raro':
      return 'Achado raro';
    case 'incomum':
      return 'Boa pescaria';
    default:
      return 'Fisgou';
  }
}

/** Quanto de fragmento lendario cada resultado gera. */
export function shardGain(result: CastResult): number {
  switch (result.fish?.rarity) {
    case 'raro':
      return 5;
    case 'epico':
      return 15;
    default:
      return result.category === 'bau' ? 2 : 0;
  }
}

/** Frase mostrada quando o peixe escapa no minigame. */
export function escapeLine(): string {
  return pick([
    'A linha arrebentou.',
    'Ele soltou do anzol.',
    'Sumiu embaixo do barco.',
    'Deu um tranco e foi embora.',
    'Ficou só a história.',
  ]);
}

/** Tempo de espera aleatorio ate a mordida (ms). */
export function biteDelay(fast = false): number {
  return fast ? randFloat(250, 900) : randFloat(700, 2600);
}
