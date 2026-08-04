import { useSyncExternalStore } from 'react';
import { startNewDay } from '../world/dayCycle';
import { ACHIEVEMENTS, ACHIEVEMENTS_BY_ID } from '../data/achievements';
import { FAMILIES, FAMILY_MEMBERS, FISH } from '../data/fish';
import { matchesOrder, orderForDay, type MarketOrder } from '../data/market';
import { RELICS_BY_ID, UPGRADES_BY_ID, upgradeCost } from '../data/upgrades';
import { shardGain } from '../engine/fishing';
import { SHARDS_FOR_LEGENDARY } from '../engine/outcomes';
import type { CastQuality } from '../engine/outcomes';
import { createInitialState, SAVE_KEY, SAVE_VERSION } from './defaults';
import type {
  CastResult,
  FamilyId,
  GameState,
  MarketState,
  RegionId,
  RelicId,
  UpgradeId,
} from './types';

// ---------------------------------------------------------------- persistencia

/**
 * Carrega e MIGRA o save.
 *
 * Nunca descartamos um save valido so porque a versao subiu: campos novos
 * entram com o padrao e o resto e preservado. O save v1 (antes das mecanicas
 * de risco/recompensa) vira v2 sem perder uma moeda.
 */
function load(): GameState {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return createInitialState();
    const parsed = JSON.parse(raw) as Partial<GameState> & { version?: number };
    if (typeof parsed !== 'object' || parsed === null) return createInitialState();

    const base = createInitialState();
    const casino = parsed.casino;

    const migrated: GameState = {
      ...base,
      ...parsed,
      version: SAVE_VERSION,
      upgrades: { ...base.upgrades, ...parsed.upgrades },
      stats: {
        ...base.stats,
        ...parsed.stats,
        rarityCounts: { ...base.stats.rarityCounts, ...parsed.stats?.rarityCounts },
      },
      pity: { ...base.pity, ...parsed.pity },
      market: { ...base.market, ...parsed.market },
      lifetimeValue: parsed.lifetimeValue ?? parsed.stats?.totalEarned ?? 0,
      casino: {
        ...base.casino,
        ...casino,
        streak: { ...base.casino.streak, ...casino?.streak },
        jackpotMeter: { ...base.casino.jackpotMeter, ...casino?.jackpotMeter },
        tideWheel: { ...base.casino.tideWheel, ...casino?.tideWheel },
        statistics: { ...base.casino.statistics, ...casino?.statistics },
        activeCards: casino?.activeCards ?? [],
        missionBoard:
          casino?.missionBoard && Array.isArray(casino.missionBoard.tiles) && casino.missionBoard.tiles.length === 9
            ? casino.missionBoard
            : base.casino.missionBoard,
      },
    };

    // bonus pendente nao sobrevive ao fechamento do jogo: ou foi sacado, ou
    // era risco assumido. Zerar aqui evita "moeda fantasma" no save.
    migrated.casino.streak.pendingCoins = 0;
    migrated.casino.streak.current = 0;
    migrated.casino.streak.multiplier = 1;
    migrated.casino.activeCards = [];

    return migrated;
  } catch {
    return createInitialState();
  }
}

let state: GameState = load();
let persistTimer: number | undefined;

const listeners = new Set<() => void>();

function persist() {
  if (persistTimer !== undefined) clearTimeout(persistTimer);
  persistTimer = window.setTimeout(() => {
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(state));
    } catch {
      /* quota cheia ou modo privado: o jogo continua rodando em memoria */
    }
  }, 250);
}

function emit() {
  persist();
  for (const l of listeners) l();
}

function set(next: GameState) {
  state = next;
  emit();
}

/** Atualiza o estado a partir de um patch. Usado pelo modulo de cassino. */
export function updateState(fn: (s: GameState) => GameState): void {
  set(fn(state));
}

export function getState(): GameState {
  return state;
}

export function subscribe(fn: () => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

export function useGame(): GameState {
  return useSyncExternalStore(subscribe, getState, getState);
}

// ------------------------------------------------------------------ conquistas

export interface Unlocks {
  achievements: string[];
  families: FamilyId[];
  newSpecies: boolean;
}

function grantAchievements(s: GameState): { state: GameState; unlocked: string[] } {
  const unlocked: string[] = [];
  let next = s;

  // duas passadas: a "Lenda do Juggler" depende das outras
  for (let pass = 0; pass < 2; pass++) {
    for (const a of ACHIEVEMENTS) {
      if (next.achievements.includes(a.id)) continue;
      if (a.progress(next) < a.goal) continue;
      unlocked.push(a.id);
      next = {
        ...next,
        achievements: [...next.achievements, a.id],
        sazoncoins: next.sazoncoins + (a.reward?.sazoncoins ?? 0),
        hydraEyes: next.hydraEyes + (a.reward?.hydraEyes ?? 0),
        stats: {
          ...next.stats,
          totalEarned: next.stats.totalEarned + (a.reward?.sazoncoins ?? 0),
          eyesEarned: next.stats.eyesEarned + (a.reward?.hydraEyes ?? 0),
        },
      };
    }
  }

  return { state: next, unlocked };
}

function grantFamilies(s: GameState): { state: GameState; unlocked: FamilyId[] } {
  const unlocked: FamilyId[] = [];
  let next = s;
  for (const fam of FAMILIES) {
    if (next.claimedFamilies.includes(fam.id)) continue;
    const complete = FAMILY_MEMBERS[fam.id].every((f) => next.album[f.id]);
    if (!complete) continue;
    unlocked.push(fam.id);
    next = {
      ...next,
      claimedFamilies: [...next.claimedFamilies, fam.id],
      sazoncoins: next.sazoncoins + fam.reward.sazoncoins,
      hydraEyes: next.hydraEyes + fam.reward.hydraEyes,
      stats: {
        ...next.stats,
        totalEarned: next.stats.totalEarned + fam.reward.sazoncoins,
        eyesEarned: next.stats.eyesEarned + fam.reward.hydraEyes,
      },
    };
  }
  return { state: next, unlocked };
}

// ---------------------------------------------------------------------- acoes

/**
 * Aplica o resultado de um lancamento ja resolvido pela engine.
 * `landed` = o jogador venceu o minigame de puxada.
 */
export function applyCast(
  result: CastResult,
  landed: boolean,
  quality: CastQuality,
  /**
   * Quanto creditar de fato. Vem do RewardCalculator quando a captura passa
   * pelas mecanicas de sequencia: so a parcela GARANTIDA entra aqui. O bonus
   * pendente vive em `casino.streak.pendingCoins` ate o jogador sacar.
   */
  guaranteedOverride?: number,
): Unlocks {
  const s = state;
  const stats = { ...s.stats, rarityCounts: { ...s.stats.rarityCounts } };
  const pity = { ...s.pity };
  let sazoncoins = s.sazoncoins;
  let hydraEyes = s.hydraEyes;
  const album = { ...s.album };
  let newSpecies = false;

  stats.casts += 1;
  if (quality === 'perfeito') stats.perfectCasts += 1;

  const isFish = Boolean(result.fish);
  const won = landed && (isFish || result.category === 'bau' || result.category === 'evento');

  let market = marketToday(s.market);

  if (isFish && landed && result.fish) {
    const f = result.fish;
    if (matchesOrder(orderForDay(market.day), f)) {
      market = { ...market, progress: market.progress + 1 };
    }
    stats.catches += 1;
    stats.rarityCounts[f.rarity] += 1;
    stats.currentCatchStreak += 1;
    stats.bestCatchStreak = Math.max(stats.bestCatchStreak, stats.currentCatchStreak);
    stats.currentFailStreak = 0;
    stats.bestWeight = Math.max(stats.bestWeight, result.weight);

    const prev = album[f.id];
    if (!prev) {
      newSpecies = true;
      album[f.id] = {
        count: 1,
        bestWeight: result.weight,
        bestLength: result.length,
        firstCaughtAt: Date.now(),
      };
    } else {
      album[f.id] = {
        count: prev.count + 1,
        bestWeight: Math.max(prev.bestWeight, result.weight),
        bestLength: Math.max(prev.bestLength, result.length),
        firstCaughtAt: prev.firstCaughtAt,
      };
    }

    pity.dryStreak = 0;
    if (f.rarity === 'raro' || f.rarity === 'epico' || f.rarity === 'lendario' || f.rarity === 'mitico') {
      pity.castsSinceRare = 0;
    } else {
      pity.castsSinceRare += 1;
    }
    if (f.rarity === 'epico' || f.rarity === 'lendario' || f.rarity === 'mitico') {
      pity.castsSinceEpic = 0;
    } else {
      pity.castsSinceEpic += 1;
    }
    if (f.rarity === 'lendario' || f.rarity === 'mitico') {
      pity.legendaryShards = 0;
    } else {
      pity.legendaryShards = Math.min(SHARDS_FOR_LEGENDARY, pity.legendaryShards + shardGain(result));
    }
  } else {
    pity.dryStreak += 1;
    pity.castsSinceRare += 1;
    pity.castsSinceEpic += 1;
    stats.currentCatchStreak = 0;

    if (isFish && !landed) {
      stats.escapes += 1;
      const rare = result.fish && result.fish.rarity !== 'comum' && result.fish.rarity !== 'incomum';
      if (rare) stats.lineBreaks += 1;
    }
    if (result.category === 'nada') stats.nothing += 1;
    if (result.category === 'lixo') stats.junk += 1;

    const isFail = result.category === 'nada' || (isFish && !landed);
    if (isFail) {
      stats.currentFailStreak += 1;
      stats.worstFailStreak = Math.max(stats.worstFailStreak, stats.currentFailStreak);
    } else {
      stats.currentFailStreak = 0;
    }
  }

  if (result.category === 'bau' && landed) {
    stats.chests += 1;
    pity.dryStreak = 0;
    pity.legendaryShards = Math.min(SHARDS_FOR_LEGENDARY, pity.legendaryShards + shardGain(result));
  }
  if (result.category === 'evento') {
    stats.hydraEvents += 1;
  }

  let credited = 0;
  if (won || result.category === 'lixo') {
    credited = guaranteedOverride ?? result.value;
    sazoncoins += credited;
    stats.totalEarned += credited;
    stats.bestSingleSale = Math.max(stats.bestSingleSale, credited);
    hydraEyes += result.eyes;
    stats.eyesEarned += result.eyes;
  }

  let next: GameState = {
    ...s,
    sazoncoins,
    hydraEyes,
    album,
    stats,
    pity,
    market,
    lifetimeValue: s.lifetimeValue + credited,
  };

  const fam = grantFamilies(next);
  next = fam.state;
  const ach = grantAchievements(next);
  next = ach.state;

  set(next);
  return { achievements: ach.unlocked, families: fam.unlocked, newSpecies };
}

export function buyUpgrade(id: UpgradeId): boolean {
  const s = state;
  const up = UPGRADES_BY_ID[id];
  const level = s.upgrades[id];
  if (level >= up.maxLevel) return false;
  const cost = upgradeCost(id, level);
  if (up.currency === 'sazoncoins' && s.sazoncoins < cost) return false;
  if (up.currency === 'hydraEyes' && s.hydraEyes < cost) return false;

  let next: GameState = {
    ...s,
    sazoncoins: up.currency === 'sazoncoins' ? s.sazoncoins - cost : s.sazoncoins,
    hydraEyes: up.currency === 'hydraEyes' ? s.hydraEyes - cost : s.hydraEyes,
    upgrades: { ...s.upgrades, [id]: level + 1 },
  };
  next = grantAchievements(next).state;
  set(next);
  return true;
}

export function buyRelic(id: RelicId): boolean {
  const s = state;
  const relic = RELICS_BY_ID[id];
  if (!relic || s.relics.includes(id) || s.hydraEyes < relic.cost) return false;
  let next: GameState = {
    ...s,
    hydraEyes: s.hydraEyes - relic.cost,
    relics: [...s.relics, id],
  };
  next = grantAchievements(next).state;
  set(next);
  return true;
}

/**
 * Sincroniza o save com a fase do dia que esta no ar.
 *
 * O jogador nao escolhe mais onde pesca: o relogio escolhe por ele. O campo
 * `region` continua existindo porque a pescaria, o album e o mercado leem dali
 * - so quem escreve mudou.
 */
export function syncRegion(id: RegionId): void {
  if (state.region === id) return;
  set({ ...state, region: id });
}

// --------------------------------------------------------------- bonus diario

// ------------------------------------------------------------------- mercado

/**
 * A encomenda vira junto com o dia. Se o save ficou parado desde ontem, o
 * progresso zera aqui em vez de a barraca aceitar peixe velho.
 */
function marketToday(m: MarketState): MarketState {
  const day = todayKey();
  if (m.day === day) return m;
  return { day, progress: 0, claimed: false };
}

export interface MarketView {
  order: MarketOrder;
  progress: number;
  claimed: boolean;
  /** encomenda completa e ainda nao retirada */
  ready: boolean;
}

/** O que a barraca esta pedindo agora e como esta o progresso. */
export function marketView(s: GameState = state): MarketView {
  const m = marketToday(s.market);
  const order = orderForDay(m.day);
  const progress = Math.min(m.progress, order.target);
  return { order, progress, claimed: m.claimed, ready: progress >= order.target && !m.claimed };
}

/** Retira a recompensa no balcao. Devolve a encomenda paga, ou null. */
export function claimMarketOrder(): MarketOrder | null {
  const view = marketView(state);
  if (!view.ready) return null;
  const m = marketToday(state.market);
  set({
    ...state,
    sazoncoins: state.sazoncoins + view.order.reward.sazoncoins,
    hydraEyes: state.hydraEyes + (view.order.reward.hydraEyes ?? 0),
    lifetimeValue: state.lifetimeValue + view.order.reward.sazoncoins,
    stats: {
      ...state.stats,
      totalEarned: state.stats.totalEarned + view.order.reward.sazoncoins,
      eyesEarned: state.stats.eyesEarned + (view.order.reward.hydraEyes ?? 0),
    },
    market: { ...m, claimed: true },
  });
  return view.order;
}

export function todayKey(d = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function dailyAvailable(s: GameState = state): boolean {
  return s.lastDailyClaim !== todayKey();
}

export interface DailyReward {
  sazoncoins: number;
  hydraEyes: number;
  streak: number;
}

export function dailyPreview(s: GameState = state): DailyReward {
  const yesterday = todayKey(new Date(Date.now() - 86400000));
  const continued = s.lastDailyClaim === yesterday;
  const streak = continued ? s.dayStreak + 1 : 1;
  return {
    sazoncoins: 200 + Math.min(streak, 14) * 150,
    hydraEyes: streak % 7 === 0 ? 2 : 0,
    streak,
  };
}

export function claimDaily(): DailyReward | null {
  const s = state;
  if (!dailyAvailable(s)) return null;
  const reward = dailyPreview(s);
  let next: GameState = {
    ...s,
    sazoncoins: s.sazoncoins + reward.sazoncoins,
    hydraEyes: s.hydraEyes + reward.hydraEyes,
    dayStreak: reward.streak,
    lastDailyClaim: todayKey(),
    stats: {
      ...s.stats,
      totalEarned: s.stats.totalEarned + reward.sazoncoins,
      eyesEarned: s.stats.eyesEarned + reward.hydraEyes,
    },
  };
  next = grantAchievements(next).state;
  set(next);
  return reward;
}

// ------------------------------------------------------------------ os dias

/**
 * Encerra o dia e comeca o proximo.
 *
 * O contador nao segue relogio nenhum - nem o do jogo, nem o do computador -
 * e essa e a escolha de design. Um cais de pesca e um lugar onde se fica o
 * tempo que der vontade; um contador que virasse sozinho a meia-noite
 * transformaria "quanto tempo eu quero ficar aqui" numa contagem regressiva.
 * Aqui o dia acaba quando o jogador diz que acabou.
 */
export function endDay(): number {
  const s = state;
  set({ ...s, dia: s.dia + 1 });
  // O CEU VOLTA PARA A MANHA CLARA. E o unico lugar em que ele amanhece: sem
  // isto, dormir no meio da tarde comecaria o dia seguinte na mesma tarde.
  startNewDay();
  return state.dia;
}

/** Volta o contador para o dia 1, sem tocar em mais nada do save. */
export function resetDays(): void {
  set({ ...state, dia: 1 });
}

/**
 * Cheat de desenvolvimento: entra dinheiro do nada.
 * Fica atras do painel de dev, nao existe caminho normal ate aqui.
 */
export function grantCheat(sazoncoins: number, hydraEyes: number): void {
  set({
    ...state,
    sazoncoins: state.sazoncoins + sazoncoins,
    hydraEyes: state.hydraEyes + hydraEyes,
    stats: {
      ...state.stats,
      totalEarned: state.stats.totalEarned + sazoncoins,
      eyesEarned: state.stats.eyesEarned + hydraEyes,
    },
    lifetimeValue: state.lifetimeValue + sazoncoins,
  });
}

/**
 * Cheat: preenche o Album do Pescador inteiro.
 *
 * Marca as 24 especies como pescadas, com um peso e um comprimento no meio da
 * faixa de cada uma - assim as fichas do album ficam com numero plausivel em
 * vez de zero. As recompensas de FAMILIA sao entregues logo em seguida, pela
 * mesma funcao que o jogo usa quando voce completa uma de verdade, entao o
 * estado nao fica torto.
 *
 * Chamar de novo com o album cheio nao faz nada.
 */
export function unlockAlbum(): number {
  const album = { ...state.album };
  const agora = Date.now();
  let novas = 0;

  for (const f of FISH) {
    if (album[f.id]) continue;
    novas += 1;
    album[f.id] = {
      count: 1,
      bestWeight: (f.weight[0] + f.weight[1]) / 2,
      bestLength: (f.length[0] + f.length[1]) / 2,
      firstCaughtAt: agora,
    };
  }
  if (novas === 0) return 0;

  const comAlbum = { ...state, album };
  const { state: comFamilias } = grantFamilies(comAlbum);
  set(comFamilias);
  return novas;
}

/** Cheat: zera o album, para testar o preenchimento de novo. */
export function clearAlbum(): void {
  set({ ...state, album: {}, claimedFamilies: [] });
}

export function resetGame(): void {
  set(createInitialState());
}

export function achievementName(id: string): string {
  return ACHIEVEMENTS_BY_ID[id]?.name ?? id;
}
