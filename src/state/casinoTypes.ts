import type { HiddenFishModifier, JackpotTier, TideWheelRewardId } from '../game/balance';

/**
 * Estado das mecanicas de risco/recompensa que vai para o save.
 *
 * `securedCoins` nao mora aqui: sao as moedas do save (`sazoncoins`), e elas
 * nunca podem ser removidas por nada deste arquivo. O unico valor em risco e
 * `streak.pendingCoins`.
 */

export type LuckyCardId =
  | 'mare-favoravel'
  | 'linha-abencoada'
  | 'isca-dourada'
  | 'venda-dupla'
  | 'cardume-repentino'
  | 'mao-firme'
  | 'fortuna-crescente'
  | 'pescador-implacavel'
  | 'coroa-do-mar';

export type CardDuration = 'next-catch' | 'next-casts' | 'session' | 'instant';

export interface ActiveLuckyCard {
  id: LuckyCardId;
  /** quantos usos/lancamentos restam; -1 = ate o fim da sessao */
  remaining: number;
}

export interface MissionTile {
  id: string;
  description: string;
  target: number;
  progress: number;
  completed: boolean;
}

export interface MissionBoard {
  boardId: string;
  generatedAt: string;
  tiles: MissionTile[];
  /** ids de linha ja premiadas: 'row-0', 'col-2', 'diag-a'... */
  completedLines: string[];
  fullyCompleted: boolean;
  /** recompensa de cartela cheia ja entregue */
  fullRewardClaimed: boolean;
}

export interface CasinoStatistics {
  totalPendingCoinsCashedOut: number;
  totalPendingCoinsLost: number;
  highestStreakMultiplier: number;
  jackpotFishCaught: number;
  tideWheelSpins: number;
  prizeLadderBestStep: number;
  bonusSchoolsCompleted: number;
  missionBoardsCompleted: number;
}

export interface CasinoMechanicsState {
  streak: {
    current: number;
    best: number;
    /** UNICO valor que pode ser perdido */
    pendingCoins: number;
    multiplier: number;
    /** em qual contagem o modal de saque foi oferecido pela ultima vez */
    lastOfferAt: number;
  };
  jackpotMeter: {
    value: number;
    jackpotReady: boolean;
  };
  tideWheel: {
    availableSpins: number;
    catchesUntilNextSpin: number;
  };
  missionBoard: MissionBoard;
  activeCards: ActiveLuckyCard[];
  statistics: CasinoStatistics;
}

/** Extras que a engine anexa a um encontro. Nao vao para o save. */
export interface EncounterExtras {
  jackpot: JackpotTier | null;
  hidden: HiddenFishModifier | null;
}

export interface TideWheelResult {
  id: TideWheelRewardId;
  label: string;
  index: number;
}
