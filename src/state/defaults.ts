import { generateBoard } from '../data/missions';
import type { CasinoMechanicsState } from './casinoTypes';
import type { GameState, GameStats, MarketState, PityState } from './types';

export const SAVE_VERSION = 3;
export const SAVE_KEY = 'juggler-fishing/save/v1';

export const emptyStats = (): GameStats => ({
  casts: 0,
  catches: 0,
  junk: 0,
  nothing: 0,
  lineBreaks: 0,
  escapes: 0,
  chests: 0,
  hydraEvents: 0,
  totalEarned: 0,
  eyesEarned: 0,
  bestSingleSale: 0,
  bestWeight: 0,
  perfectCasts: 0,
  currentCatchStreak: 0,
  bestCatchStreak: 0,
  currentFailStreak: 0,
  worstFailStreak: 0,
  rarityCounts: {
    comum: 0,
    incomum: 0,
    raro: 0,
    epico: 0,
    lendario: 0,
    mitico: 0,
  },
});

export const emptyPity = (): PityState => ({
  dryStreak: 0,
  castsSinceRare: 0,
  castsSinceEpic: 0,
  legendaryShards: 0,
});

export const emptyCasino = (): CasinoMechanicsState => ({
  streak: { current: 0, best: 0, pendingCoins: 0, multiplier: 1, lastOfferAt: 0 },
  jackpotMeter: { value: 0, jackpotReady: false },
  tideWheel: { availableSpins: 0, catchesUntilNextSpin: 5 },
  missionBoard: generateBoard(),
  activeCards: [],
  statistics: {
    totalPendingCoinsCashedOut: 0,
    totalPendingCoinsLost: 0,
    highestStreakMultiplier: 1,
    jackpotFishCaught: 0,
    tideWheelSpins: 0,
    prizeLadderBestStep: 0,
    bonusSchoolsCompleted: 0,
    missionBoardsCompleted: 0,
  },
});

export const emptyMarket = (): MarketState => ({
  day: '',
  progress: 0,
  claimed: false,
});

export const createInitialState = (): GameState => ({
  version: SAVE_VERSION,
  sazoncoins: 0,
  hydraEyes: 0,
  region: 'enseada',
  upgrades: { vara: 0, linha: 0, isca: 0, balde: 0, olho: 0, bencao: 0 },
  relics: [],
  album: {},
  claimedFamilies: [],
  achievements: [],
  stats: emptyStats(),
  pity: emptyPity(),
  lastDailyClaim: null,
  dayStreak: 0,
  dia: 1,
  createdAt: Date.now(),
  lifetimeValue: 0,
  casino: emptyCasino(),
  market: emptyMarket(),
});
