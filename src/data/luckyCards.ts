import type { CardDuration, LuckyCardId } from '../state/casinoTypes';

export interface LuckyCard {
  id: LuckyCardId;
  name: string;
  description: string;
  rarity: 'common' | 'uncommon' | 'rare';
  durationType: CardDuration;
  durationValue?: number;
  icon: string;
}

/**
 * Cartas de sorte: efeitos temporarios de sessao.
 * Nenhuma delas multiplica sem teto - o RewardCalculator corta em
 * MAX_NORMAL_CAPTURE_MULTIPLIER de qualquer jeito.
 */
export const LUCKY_CARDS: LuckyCard[] = [
  {
    id: 'mare-favoravel',
    name: 'MARÉ FAVORÁVEL',
    description: 'A próxima captura concede x2 no valor.',
    rarity: 'uncommon',
    durationType: 'next-catch',
    durationValue: 1,
    icon: 'fx/reward-glow',
  },
  {
    id: 'linha-abencoada',
    name: 'LINHA ABENÇOADA',
    description: 'Reduz em 25% a perda de tensão durante três lançamentos.',
    rarity: 'common',
    durationType: 'next-casts',
    durationValue: 3,
    icon: 'props/fishing-line-spool',
  },
  {
    id: 'isca-dourada',
    name: 'ISCA DOURADA',
    description: 'Aumenta a chance de peixe raro nos próximos três lançamentos.',
    rarity: 'uncommon',
    durationType: 'next-casts',
    durationValue: 3,
    icon: 'props/bait-lure',
  },
  {
    id: 'venda-dupla',
    name: 'VENDA DUPLA',
    description: 'O próximo peixe vendido concede duas vezes o valor-base, já garantido.',
    rarity: 'rare',
    durationType: 'next-catch',
    durationValue: 1,
    icon: 'ui/rarity-epic',
  },
  {
    id: 'cardume-repentino',
    name: 'CARDUME REPENTINO',
    description: 'Ativa imediatamente um Cardume Bônus.',
    rarity: 'rare',
    durationType: 'instant',
    icon: 'props/decorative-fish-school',
  },
  {
    id: 'mao-firme',
    name: 'MÃO FIRME',
    description: 'Aumenta a zona segura da tensão durante cinco lançamentos.',
    rarity: 'common',
    durationType: 'next-casts',
    durationValue: 5,
    icon: 'props/capture-net',
  },
  {
    id: 'fortuna-crescente',
    name: 'FORTUNA CRESCENTE',
    description: 'Adiciona 15 pontos ao Medidor de Jackpot.',
    rarity: 'common',
    durationType: 'instant',
    icon: 'fx/reward-star',
  },
  {
    id: 'pescador-implacavel',
    name: 'PESCADOR IMPLACÁVEL',
    description: 'A próxima falha não encerra a sequência, mas leva metade do bônus pendente.',
    rarity: 'rare',
    durationType: 'session',
    durationValue: 1,
    icon: 'props/small-anchor',
  },
  {
    id: 'coroa-do-mar',
    name: 'COROA DO MAR',
    description: 'Aumenta a chance de multiplicador escondido nos próximos cinco peixes.',
    rarity: 'uncommon',
    durationType: 'next-casts',
    durationValue: 5,
    icon: 'props/seashell',
  },
];

export const LUCKY_CARDS_BY_ID: Record<LuckyCardId, LuckyCard> = Object.fromEntries(
  LUCKY_CARDS.map((c) => [c.id, c]),
) as Record<LuckyCardId, LuckyCard>;

/** Sorteia N cartas distintas para a tela de escolha. */
export function drawCardChoices(count: number): LuckyCard[] {
  const pool = [...LUCKY_CARDS];
  const out: LuckyCard[] = [];
  while (out.length < count && pool.length > 0) {
    out.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]);
  }
  return out;
}
