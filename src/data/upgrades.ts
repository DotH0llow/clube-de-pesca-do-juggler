import type { Relic, Upgrade, UpgradeId } from '../state/types';

const pct = (v: number) => `${Math.round(v * 1000) / 10}%`;

/** Loja do barco: upgrades permanentes pagos em Sazoncoins (e um em Olhos da Hydra). */
export const UPGRADES: Upgrade[] = [
  {
    id: 'vara',
    name: 'Vara Melhorada',
    desc: 'Menos lancamentos voltando vazios.',
    currency: 'sazoncoins',
    maxLevel: 8,
    baseCost: 120,
    costGrowth: 1.62,
    icon: '🎣',
    effectText: (lv) => `-${(lv * 1.6).toFixed(1)} pontos na chance de "Nada"`,
  },
  {
    id: 'linha',
    name: 'Linha Reforcada',
    desc: 'Aguenta tranco de bicho grande e arrebenta menos.',
    currency: 'sazoncoins',
    maxLevel: 6,
    baseCost: 200,
    costGrowth: 1.7,
    icon: '🧵',
    effectText: (lv) => `+${pct(lv * 0.06)} de margem na fisga`,
  },
  {
    id: 'isca',
    name: 'Isca Brilhante',
    desc: 'Chama a atencao do que vale a pena.',
    currency: 'sazoncoins',
    maxLevel: 8,
    baseCost: 260,
    costGrowth: 1.75,
    icon: '✨',
    effectText: (lv) => `+${pct(lv * 0.09)} de peso em Incomum e Raro`,
  },
  {
    id: 'balde',
    name: 'Balde Maior',
    desc: 'Cabe mais peixe, entao rende mais na venda.',
    currency: 'sazoncoins',
    maxLevel: 10,
    baseCost: 400,
    costGrowth: 1.58,
    icon: '🪣',
    effectText: (lv) => `+${pct(lv * 0.08)} no valor de venda`,
  },
  {
    id: 'olho',
    name: 'Olho do Pescador',
    desc: 'Voce comeca a reparar em vulto de bau no fundo.',
    currency: 'sazoncoins',
    maxLevel: 5,
    baseCost: 900,
    costGrowth: 1.9,
    icon: '👁️',
    effectText: (lv) => `+${pct(lv * 0.5)} de chance de Bau Afundado`,
  },
  {
    id: 'bencao',
    name: 'Bencao da Hydra',
    desc: 'A Hydra passa a reparar em voce. Nem sempre e bom.',
    currency: 'hydraEyes',
    maxLevel: 5,
    baseCost: 3,
    costGrowth: 1.6,
    icon: '🐉',
    effectText: (lv) => `+${pct(lv * 0.6)} em Evento Hydra, +${pct(lv * 0.15)} de Olhos`,
  },
];

export const UPGRADES_BY_ID: Record<UpgradeId, Upgrade> = Object.fromEntries(
  UPGRADES.map((u) => [u.id, u]),
) as Record<UpgradeId, Upgrade>;

export function upgradeCost(id: UpgradeId, currentLevel: number): number {
  const u = UPGRADES_BY_ID[id];
  const raw = u.baseCost * Math.pow(u.costGrowth, currentLevel);
  return u.currency === 'hydraEyes' ? Math.round(raw) : Math.round(raw / 5) * 5;
}

/** Altar da Hydra: compras unicas em Olhos da Hydra. */
export const RELICS: Relic[] = [
  {
    id: 'radio_pirata',
    name: 'Radio Pirata',
    desc: 'Musica boa no barco. Comprador paga +25% sem saber por que.',
    cost: 6,
    icon: '📻',
  },
  {
    id: 'vara_leviata',
    name: 'Vara do Leviata',
    desc: 'Peso de Epico e Lendario sobe 35%.',
    cost: 9,
    icon: '🔱',
  },
  {
    id: 'amuleto_pity',
    name: 'Amuleto do Pescador',
    desc: 'A mare vira mais rapido: pity acumula 60% mais depressa.',
    cost: 11,
    icon: '🧿',
  },
  {
    id: 'isca_mistica',
    name: 'Isca Mistica',
    desc: 'Peso de Lendario e Mitico quase dobra. Use com respeito.',
    cost: 16,
    icon: '🩸',
  },
  {
    id: 'skin_neon',
    name: 'Kit Neon do Clube',
    desc: 'Cosmetico. Deixa o HUD do clube em neon anos 2000.',
    cost: 4,
    icon: '🌈',
  },
];

export const RELICS_BY_ID: Record<string, Relic> = Object.fromEntries(RELICS.map((r) => [r.id, r]));
