import { RARITIES } from './rarities';
import type { FamilyId, FishSpecies, Rarity } from '../state/types';

/**
 * Encomendas do mercado de peixe. Todo dia a barraca pede uma coisa diferente:
 * o pedido sai de um sorteio deterministico pela data, entao todo mundo que
 * joga no mesmo dia pega a mesma encomenda e ela nao muda se o jogo recarregar.
 */
export interface MarketOrder {
  id: string;
  /** o que a barraca esta pedindo, em uma linha */
  title: string;
  desc: string;
  /** restringe a familia do peixe aceito */
  family?: FamilyId;
  /** raridade minima aceita */
  minRarity?: Rarity;
  /** quantos peixes precisam entrar na caixa */
  target: number;
  reward: { sazoncoins: number; hydraEyes?: number };
  icon: string;
}

export const MARKET_ORDERS: MarketOrder[] = [
  {
    id: 'caixa_do_dia',
    title: 'Caixa do dia',
    desc: 'Qualquer peixe serve. O freguês do almoço não é exigente.',
    target: 6,
    reward: { sazoncoins: 900 },
    icon: 'props/fish-basket',
  },
  {
    id: 'grelha_da_praia',
    title: 'Grelha da praia',
    desc: 'Costeiros para a grelha do meio-dia.',
    family: 'costeiros',
    target: 5,
    reward: { sazoncoins: 1200 },
    icon: 'props/cooler-box',
  },
  {
    id: 'vitrine_colorida',
    title: 'Vitrine colorida',
    desc: 'Bicho de recife para enfeitar o balcão.',
    family: 'recifais',
    target: 4,
    reward: { sazoncoins: 1800, hydraEyes: 1 },
    icon: 'props/coral-cluster',
  },
  {
    id: 'encomenda_do_restaurante',
    title: 'Encomenda do restaurante',
    desc: 'Só peixe raro ou melhor. O chef confere um por um.',
    minRarity: 'raro',
    target: 3,
    reward: { sazoncoins: 3200, hydraEyes: 1 },
    icon: 'ui/rarity-rare',
  },
  {
    id: 'caixa_do_fundo',
    title: 'Caixa do fundo',
    desc: 'Coisa de água funda, dessas que dobram a linha.',
    family: 'profundos',
    target: 3,
    reward: { sazoncoins: 5200, hydraEyes: 2 },
    icon: 'props/cave-entrance',
  },
  {
    id: 'pedido_do_leiloeiro',
    title: 'Pedido do leiloeiro',
    desc: 'Épico ou acima. O leilão de sexta paga caro.',
    minRarity: 'epico',
    target: 2,
    reward: { sazoncoins: 9000, hydraEyes: 3 },
    icon: 'ui/rarity-epic',
  },
];

export const MARKET_ORDERS_BY_ID: Record<string, MarketOrder> = Object.fromEntries(
  MARKET_ORDERS.map((o) => [o.id, o]),
);

/** Hash estável da data: o mesmo dia sempre devolve a mesma encomenda. */
export function orderForDay(day: string): MarketOrder {
  let h = 2166136261;
  for (let i = 0; i < day.length; i++) {
    h ^= day.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  const i = Math.abs(h) % MARKET_ORDERS.length;
  return MARKET_ORDERS[i];
}

/** O peixe entra nesta encomenda? */
export function matchesOrder(order: MarketOrder, fish: FishSpecies): boolean {
  if (order.family && fish.family !== order.family) return false;
  if (order.minRarity && RARITIES[fish.rarity].order < RARITIES[order.minRarity].order) return false;
  return true;
}
