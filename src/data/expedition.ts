import type { GameState } from '../state/types';

export interface ExpeditionTask {
  label: string;
  goal: number;
  count: (s: GameState) => number;
}

export interface ExpeditionChapter {
  title: string;
  story: string;
  reward: { coins: number; eyes: number };
  tasks: ExpeditionTask[];
}

const rareCatches = (s: GameState) => ['raro', 'epico', 'lendario', 'mitico'].reduce((sum, rarity) => sum + s.stats.rarityCounts[rarity as keyof typeof s.stats.rarityCounts], 0);
const legendaryCatches = (s: GameState) => s.stats.rarityCounts.lendario + s.stats.rarityCounts.mitico;

export const EXPEDITION: ExpeditionChapter[] = [
  {
    title: 'I · A PRIMEIRA MARÉ',
    story: 'O clube precisa de um pescador capaz de ler a enseada.',
    reward: { coins: 350, eyes: 0 },
    tasks: [
      { label: 'Faça 3 lançamentos', goal: 3, count: (s) => s.stats.casts },
      { label: 'Traga 2 peixes', goal: 2, count: (s) => s.stats.catches },
    ],
  },
  {
    title: 'II · O RECIFE RESPIRA',
    story: 'Conheça os habitantes do mar e tire a sujeira da água.',
    reward: { coins: 750, eyes: 1 },
    tasks: [
      { label: 'Descubra 5 espécies', goal: 5, count: (s) => Object.keys(s.album).length },
      { label: 'Recupere 1 objeto perdido', goal: 1, count: (s) => s.stats.junk },
    ],
  },
  {
    title: 'III · ROTA DO NAUFRÁGIO',
    story: 'Uma linha longa e um cais ativo abrem caminho para o fundo.',
    reward: { coins: 1400, eyes: 2 },
    tasks: [
      { label: 'Melhore a linha até o nível 2', goal: 2, count: (s) => s.upgrades.linha },
      { label: 'Entregue 1 encomenda', goal: 1, count: (s) => s.stats.marketOrders },
      { label: 'Abra 1 baú afundado', goal: 1, count: (s) => s.stats.chests },
    ],
  },
  {
    title: 'IV · A LENDA DA FOSSA',
    story: 'O último mergulho encontra o segredo que a Hydra guardou.',
    reward: { coins: 5000, eyes: 5 },
    tasks: [
      { label: 'Descubra 10 espécies', goal: 10, count: (s) => Object.keys(s.album).length },
      { label: 'Capture 3 peixes raros ou melhores', goal: 3, count: rareCatches },
      { label: 'Capture 1 lendário ou mítico', goal: 1, count: legendaryCatches },
    ],
  },
];

export function expeditionReady(s: GameState): boolean {
  const chapter = EXPEDITION[s.expeditionChapter];
  return Boolean(chapter && chapter.tasks.every((task) => task.count(s) >= task.goal));
}
