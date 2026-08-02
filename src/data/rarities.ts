import type { Rarity } from '../state/types';

export interface RarityMeta {
  id: Rarity;
  label: string;
  color: string;
  glow: string;
  /** peso da raridade para ordenar o album */
  order: number;
  /** duracao do popup de captura em ms */
  fanfare: number;
}

export const RARITIES: Record<Rarity, RarityMeta> = {
  comum: {
    id: 'comum',
    label: 'Comum',
    color: '#cfe8f5',
    glow: 'rgba(207,232,245,0.45)',
    order: 0,
    fanfare: 900,
  },
  incomum: {
    id: 'incomum',
    label: 'Incomum',
    color: '#5ef2a8',
    glow: 'rgba(94,242,168,0.5)',
    order: 1,
    fanfare: 1100,
  },
  raro: {
    id: 'raro',
    label: 'Raro',
    color: '#4fc3ff',
    glow: 'rgba(79,195,255,0.6)',
    order: 2,
    fanfare: 1400,
  },
  epico: {
    id: 'epico',
    label: 'Epico',
    color: '#c77dff',
    glow: 'rgba(199,125,255,0.65)',
    order: 3,
    fanfare: 1800,
  },
  lendario: {
    id: 'lendario',
    label: 'Lendario',
    color: '#ffb703',
    glow: 'rgba(255,183,3,0.7)',
    order: 4,
    fanfare: 2400,
  },
  mitico: {
    id: 'mitico',
    label: 'Mitico',
    color: '#ff2e63',
    glow: 'rgba(255,46,99,0.75)',
    order: 5,
    fanfare: 3000,
  },
};

/** O kit tem tres selos de raridade; as seis do jogo se dividem neles. */
export function rarityBadge(rarity: Rarity): string {
  if (rarity === 'comum' || rarity === 'incomum') return 'ui/rarity-common';
  if (rarity === 'raro') return 'ui/rarity-rare';
  return 'ui/rarity-epic';
}

export const RARITY_ORDER: Rarity[] = ['comum', 'incomum', 'raro', 'epico', 'lendario', 'mitico'];
