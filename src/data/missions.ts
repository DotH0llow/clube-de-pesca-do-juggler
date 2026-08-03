import type { MissionBoard, MissionTile } from '../state/casinoTypes';

/**
 * Cartela 3x3 de objetivos. Funciona como bingo: cada linha, coluna ou diagonal
 * completa paga uma vez.
 */

export type MissionEvent =
  | { type: 'catch'; rarity: string; weight: number; perfect: boolean; newRecord: boolean }
  | { type: 'junk' }
  | { type: 'cast' }
  | { type: 'card-used' }
  | { type: 'cash-out' }
  | { type: 'multiplier'; value: number }
  | { type: 'ladder-step' }
  | { type: 'streak'; value: number };

export interface MissionDef {
  id: string;
  description: string;
  target: number;
  /** 'facil' entra sem upgrade nenhum */
  tier: 'facil' | 'media' | 'dificil';
  matches: (e: MissionEvent) => boolean;
}

export const MISSION_POOL: MissionDef[] = [
  {
    id: 'comuns-3',
    description: 'CAPTURE 3 PEIXES COMUNS',
    target: 3,
    tier: 'facil',
    matches: (e) => e.type === 'catch' && e.rarity === 'comum',
  },
  {
    id: 'incomum-1',
    description: 'CAPTURE 1 PEIXE INCOMUM',
    target: 1,
    tier: 'facil',
    matches: (e) => e.type === 'catch' && e.rarity === 'incomum',
  },
  {
    id: 'raro-1',
    description: 'CAPTURE 1 PEIXE RARO',
    target: 1,
    tier: 'media',
    matches: (e) => e.type === 'catch' && ['raro', 'epico', 'lendario', 'mitico'].includes(e.rarity),
  },
  {
    id: 'peso-5kg',
    description: 'CAPTURE UM PEIXE ACIMA DE 5 KG',
    target: 1,
    tier: 'media',
    matches: (e) => e.type === 'catch' && e.weight >= 5,
  },
  {
    id: 'peso-20kg',
    description: 'CAPTURE UM PEIXE ACIMA DE 20 KG',
    target: 1,
    tier: 'dificil',
    matches: (e) => e.type === 'catch' && e.weight >= 20,
  },
  {
    id: 'seguidos-3',
    description: 'CAPTURE 3 PEIXES SEGUIDOS',
    target: 1,
    tier: 'media',
    matches: (e) => e.type === 'streak' && e.value >= 3,
  },
  {
    id: 'lixo-2',
    description: 'ENCONTRE 2 PEÇAS DE LIXO',
    target: 2,
    tier: 'facil',
    matches: (e) => e.type === 'junk',
  },
  {
    id: 'lancamentos-5',
    description: 'FAÇA 5 LANÇAMENTOS',
    target: 5,
    tier: 'facil',
    matches: (e) => e.type === 'cast',
  },
  {
    id: 'lancamentos-12',
    description: 'FAÇA 12 LANÇAMENTOS',
    target: 12,
    tier: 'facil',
    matches: (e) => e.type === 'cast',
  },
  {
    id: 'perfeito-1',
    description: 'EXECUTE UMA CAPTURA PERFEITA',
    target: 1,
    tier: 'media',
    matches: (e) => e.type === 'catch' && e.perfect,
  },
  {
    id: 'recorde-1',
    description: 'BATA UM RECORDE DE PESO',
    target: 1,
    tier: 'media',
    matches: (e) => e.type === 'catch' && e.newRecord,
  },
  {
    id: 'carta-1',
    description: 'USE UMA CARTA DE SORTE',
    target: 1,
    tier: 'media',
    matches: (e) => e.type === 'card-used',
  },
  {
    id: 'saque-1',
    description: 'SAQUE UM BÔNUS DE SEQUÊNCIA',
    target: 1,
    tier: 'media',
    matches: (e) => e.type === 'cash-out',
  },
  {
    id: 'multiplicador-2',
    description: 'ALCANCE MULTIPLICADOR X2',
    target: 1,
    tier: 'dificil',
    matches: (e) => e.type === 'multiplier' && e.value >= 2,
  },
  {
    id: 'escada-1',
    description: 'COMPLETE UMA ETAPA DA ESCADA',
    target: 1,
    tier: 'dificil',
    matches: (e) => e.type === 'ladder-step',
  },
  {
    id: 'capturas-8',
    description: 'CAPTURE 8 PEIXES',
    target: 8,
    tier: 'facil',
    matches: (e) => e.type === 'catch',
  },
];

export const MISSION_BY_ID: Record<string, MissionDef> = Object.fromEntries(
  MISSION_POOL.map((m) => [m.id, m]),
);

/** As 8 linhas possiveis de um 3x3. */
export const MISSION_LINES: { id: string; cells: number[] }[] = [
  { id: 'row-0', cells: [0, 1, 2] },
  { id: 'row-1', cells: [3, 4, 5] },
  { id: 'row-2', cells: [6, 7, 8] },
  { id: 'col-0', cells: [0, 3, 6] },
  { id: 'col-1', cells: [1, 4, 7] },
  { id: 'col-2', cells: [2, 5, 8] },
  { id: 'diag-a', cells: [0, 4, 8] },
  { id: 'diag-b', cells: [2, 4, 6] },
];

function pick<T>(list: T[], n: number): T[] {
  const pool = [...list];
  const out: T[] = [];
  while (out.length < n && pool.length) out.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]);
  return out;
}

/**
 * Gera uma cartela nova: 5 faceis, 3 medias e 1 dificil, sem repetidos.
 * Nenhum objetivo exige lendario, e a maioria e possivel sem upgrade nenhum.
 */
export function generateBoard(): MissionBoard {
  const facil = MISSION_POOL.filter((m) => m.tier === 'facil');
  const media = MISSION_POOL.filter((m) => m.tier === 'media');
  const dificil = MISSION_POOL.filter((m) => m.tier === 'dificil');

  const chosen = [...pick(facil, 5), ...pick(media, 3), ...pick(dificil, 1)];
  // embaralha para as dificeis nao cairem sempre no mesmo canto
  for (let i = chosen.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [chosen[i], chosen[j]] = [chosen[j], chosen[i]];
  }

  const tiles: MissionTile[] = chosen.map((m) => ({
    id: m.id,
    description: m.description,
    target: m.target,
    progress: 0,
    completed: false,
  }));

  return {
    boardId: `board-${Date.now().toString(36)}`,
    generatedAt: new Date().toISOString(),
    tiles,
    completedLines: [],
    fullyCompleted: false,
    fullRewardClaimed: false,
  };
}

/** Linhas completas de uma cartela, incluindo as ja premiadas. */
export function linesCompleted(board: MissionBoard): string[] {
  return MISSION_LINES.filter((l) => l.cells.every((c) => board.tiles[c]?.completed)).map((l) => l.id);
}
