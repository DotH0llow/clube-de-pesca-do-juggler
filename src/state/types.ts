/**
 * Tipos centrais do Clube de Pesca do Juggler.
 * Universo Hydra - pegada tropical/oceanica anos 2000, pixel art.
 */
import type { CasinoMechanicsState } from './casinoTypes';

export type Rarity = 'comum' | 'incomum' | 'raro' | 'epico' | 'lendario' | 'mitico';

/** Categorias sorteadas ANTES de escolher o item concreto (arquitetura de RNG do Hydrinho). */
export type OutcomeCategory =
  | 'nada'
  | 'lixo'
  | 'comum'
  | 'incomum'
  | 'raro'
  | 'epico'
  | 'lendario'
  | 'bau'
  | 'evento'
  | 'falha';

export type RegionId = 'enseada' | 'recife' | 'naufragio' | 'fossa';

export type FamilyId = 'costeiros' | 'recifais' | 'profundos' | 'miticos';

export type UpgradeId = 'vara' | 'linha' | 'isca' | 'balde' | 'olho' | 'bencao';

export type RelicId = 'vara_leviata' | 'isca_mistica' | 'amuleto_pity' | 'skin_neon' | 'radio_pirata';

export interface FishSpecies {
  id: string;
  name: string;
  rarity: Rarity;
  family: FamilyId;
  regions: RegionId[];
  /** peso em kg: [min, max] */
  weight: [number, number];
  /** comprimento em cm: [min, max] */
  length: [number, number];
  /** valor base em Sazoncoins antes dos multiplicadores */
  baseValue: number;
  /** caminho no registro de assets, ex.: 'fish/mahi-mahi' */
  sprite: string;
  /** cor de apoio para brilho e borda na UI */
  color: string;
  /** a Hydra nunca aparece nitida: renderiza como silhueta tratada */
  silhouette?: boolean;
  flavor: string;
}

export interface JunkItem {
  id: string;
  name: string;
  value: number;
  /** caminho no registro de assets, ex.: 'trash/old-boot' */
  sprite: string;
  flavor: string;
}

export interface Region {
  id: RegionId;
  name: string;
  subtitle: string;
  /** custo de desbloqueio; null = liberada desde o inicio */
  unlock: { currency: 'sazoncoins' | 'hydraEyes'; cost: number } | null;
  /** multiplicador de valor dos peixes vendidos aqui */
  valueMultiplier: number;
  /** deslocamento de peso para raridades altas (0 = neutro) */
  rarityBonus: number;
  /** raridade maxima que aparece aqui. O resto do peso desce para o teto. */
  maxRarity: Rarity;
  /** dificuldade extra no minigame de fisga (0 a 1) */
  difficulty: number;
  palette: {
    skyTop: string;
    skyBottom: string;
    seaTop: string;
    seaBottom: string;
    sun: string;
    island: string;
    islandShade: string;
    haze: string;
  };
}

export interface Upgrade {
  id: UpgradeId;
  name: string;
  desc: string;
  currency: 'sazoncoins' | 'hydraEyes';
  maxLevel: number;
  baseCost: number;
  costGrowth: number;
  icon: string;
  /** texto do efeito acumulado no nivel informado */
  effectText: (level: number) => string;
}

export interface Relic {
  id: RelicId;
  name: string;
  desc: string;
  cost: number;
  icon: string;
}

export type AchievementCategory =
  | 'inicio'
  | 'persistencia'
  | 'sorte'
  | 'economia'
  | 'colecao'
  | 'azar'
  | 'prestigio'
  | 'lendaria';

export interface Achievement {
  id: string;
  name: string;
  desc: string;
  category: AchievementCategory;
  goal: number;
  /** quanto do objetivo o jogador ja atingiu */
  progress: (s: GameState) => number;
  reward?: { sazoncoins?: number; hydraEyes?: number };
  secret?: boolean;
}

export interface AlbumEntry {
  count: number;
  bestWeight: number;
  bestLength: number;
  firstCaughtAt: number;
}

export interface GameStats {
  casts: number;
  catches: number;
  junk: number;
  nothing: number;
  lineBreaks: number;
  escapes: number;
  chests: number;
  hydraEvents: number;
  totalEarned: number;
  eyesEarned: number;
  bestSingleSale: number;
  bestWeight: number;
  perfectCasts: number;
  /** capturas seguidas sem falhar */
  currentCatchStreak: number;
  bestCatchStreak: number;
  /** falhas seguidas (nada / linha arrebentada / fuga) */
  currentFailStreak: number;
  worstFailStreak: number;
  rarityCounts: Record<Rarity, number>;
}

export interface PityState {
  /** lancamentos seguidos sem trazer peixe */
  dryStreak: number;
  /** lancamentos desde o ultimo raro ou melhor */
  castsSinceRare: number;
  /** lancamentos desde o ultimo epico ou melhor */
  castsSinceEpic: number;
  /** fragmentos de escama lendaria (100 = proximo lendario garantido) */
  legendaryShards: number;
}

export interface GameState {
  version: number;
  sazoncoins: number;
  hydraEyes: number;
  region: RegionId;
  unlockedRegions: RegionId[];
  upgrades: Record<UpgradeId, number>;
  relics: RelicId[];
  album: Record<string, AlbumEntry>;
  claimedFamilies: FamilyId[];
  achievements: string[];
  stats: GameStats;
  pity: PityState;
  /** data ISO (YYYY-MM-DD) do ultimo bonus diario resgatado */
  lastDailyClaim: string | null;
  dayStreak: number;
  createdAt: number;
  /** total ja ganho na vida do save, usado por ranking futuro */
  lifetimeValue: number;
  /** mecanicas de risco/recompensa */
  casino: CasinoMechanicsState;
}

/** Resultado completo de um lancamento, produzido pela engine. */
export interface CastResult {
  category: OutcomeCategory;
  /** presente quando a categoria e um peixe */
  fish?: FishSpecies;
  weight: number;
  length: number;
  /** presente quando a categoria e lixo */
  junk?: JunkItem;
  /** Sazoncoins que serao pagos se o jogador conseguir puxar */
  value: number;
  /** Olhos da Hydra ganhos */
  eyes: number;
  /** dificuldade do minigame de fisga, 0 a 1 */
  difficulty: number;
  /** texto curto exibido no topo do popup */
  headline: string;
  /** ativou soft pity neste lancamento */
  pityTriggered: boolean;
  /** categoria do Peixe Jackpot, quando o encontro for um */
  jackpot?: 'minor' | 'major' | 'grand' | null;
  /** modificador escondido, revelado so depois da fisgada */
  hidden?: 'silver' | 'gold' | 'crowned' | null;
}

/** Modificadores derivados de upgrades, reliquias e regiao. */
export interface Modifiers {
  /** reducao absoluta (em pontos de peso) do resultado "nada" */
  nothingReduction: number;
  /** multiplicador de peso para incomum/raro */
  luckMultiplier: number;
  /** multiplicador de peso para epico/lendario */
  fortuneMultiplier: number;
  /** multiplicador do peso de bau afundado */
  chestMultiplier: number;
  /** multiplicador do peso de evento Hydra */
  hydraMultiplier: number;
  /** multiplicador do valor de venda */
  valueMultiplier: number;
  /** reducao da dificuldade do minigame (0 a 1) */
  reelAssist: number;
  /** velocidade do acumulo de pity */
  pitySpeed: number;
  /** bonus de Olhos da Hydra em capturas raras */
  eyeBonus: number;
}
