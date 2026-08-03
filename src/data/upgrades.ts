import type { Relic, Upgrade, UpgradeId } from '../state/types';

const pct = (v: number) => `${Math.round(v * 1000) / 10}%`;

/** Loja do barco: upgrades permanentes pagos em Sazoncoins (e um em Olhos da Hydra). */
export const UPGRADES: Upgrade[] = [
  {
    id: 'vara',
    name: 'Vara Melhorada',
    desc: 'Menos lançamentos voltando vazios.',
    currency: 'sazoncoins',
    maxLevel: 8,
    baseCost: 120,
    costGrowth: 1.62,
    icon: 'props/fishing-rod',
    effectText: (lv) => `-${(lv * 1.6).toFixed(1)} pontos na chance de "Nada"`,
  },
  {
    id: 'linha',
    name: 'Linha Reforçada',
    desc: 'Aguenta tranco de bicho grande e arrebenta menos.',
    currency: 'sazoncoins',
    maxLevel: 6,
    baseCost: 200,
    costGrowth: 1.7,
    icon: 'props/fishing-line-spool',
    effectText: (lv) => `+${pct(lv * 0.06)} de margem na fisga`,
  },
  {
    id: 'isca',
    name: 'Isca Brilhante',
    desc: 'Chama a atenção do que vale a pena.',
    currency: 'sazoncoins',
    maxLevel: 8,
    baseCost: 260,
    costGrowth: 1.75,
    icon: 'props/bait-lure',
    effectText: (lv) => `+${pct(lv * 0.09)} de peso em Incomum e Raro`,
  },
  {
    id: 'balde',
    name: 'Balde Maior',
    desc: 'Cabe mais peixe, então rende mais na venda.',
    currency: 'sazoncoins',
    maxLevel: 10,
    baseCost: 400,
    costGrowth: 1.58,
    icon: 'props/fishing-bucket',
    effectText: (lv) => `+${pct(lv * 0.08)} no valor de venda`,
  },
  {
    id: 'olho',
    name: 'Olho do Pescador',
    desc: 'Você começa a reparar em vulto de baú no fundo.',
    currency: 'sazoncoins',
    maxLevel: 5,
    baseCost: 900,
    costGrowth: 1.9,
    icon: 'props/lead-sinker',
    effectText: (lv) => `+${pct(lv * 0.5)} de chance de Bau Afundado`,
  },
  {
    id: 'bencao',
    name: 'Bênção da Hydra',
    desc: 'A Hydra passa a reparar em você. Nem sempre é bom.',
    currency: 'hydraEyes',
    maxLevel: 5,
    baseCost: 3,
    costGrowth: 1.6,
    icon: 'props/distant-underwater-silhouette',
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
    name: 'Lanterna do Píer',
    desc: 'Descarrega a noite toda com luz. Comprador paga +25% sem pechinchar.',
    cost: 6,
    icon: 'props/pier-lantern',
  },
  {
    id: 'vara_leviata',
    name: 'Puçá Reforçado',
    desc: 'Peso de Épico e Lendário sobe 35%.',
    cost: 9,
    icon: 'props/capture-net',
  },
  {
    id: 'amuleto_pity',
    name: 'Estrela Torta',
    desc: 'A maré vira mais rápido: o pity acumula 60% mais depressa.',
    cost: 11,
    icon: 'props/starfish',
  },
  {
    id: 'isca_mistica',
    name: 'Concha da Sereia',
    desc: 'Peso de Lendário e Mítico quase dobra. Use com respeito.',
    cost: 16,
    icon: 'props/seashell',
  },
  {
    id: 'skin_neon',
    name: 'Kit Neon do Clube',
    desc: 'Cosmético. Deixa o HUD do clube em neon anos 2000.',
    cost: 4,
    icon: 'fx/rare-sparkles',
  },
];

export const RELICS_BY_ID: Record<string, Relic> = Object.fromEntries(RELICS.map((r) => [r.id, r]));
