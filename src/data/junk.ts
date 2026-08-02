import type { JunkItem } from '../state/types';

/** Lixo do fundo do mar. Recompensa minima, valor comico alto. */
export const JUNK: JunkItem[] = [
  { id: 'lata', name: 'Lata Amassada', value: 3, emoji: '🥫', flavor: 'Refrigerante de 2003. Ainda tem gas.' },
  { id: 'chinelo', name: 'Chinelo Solitario', value: 5, emoji: '🩴', flavor: 'O pe esquerdo continua desaparecido.' },
  { id: 'pneu', name: 'Pneu de Jet Ski', value: 12, emoji: '🛞', flavor: 'Jet ski nao tem pneu. Nao pergunte.' },
  { id: 'oculos', name: 'Oculos Escuros Quebrados', value: 9, emoji: '🕶️', flavor: 'Estilo intacto, lente nem tanto.' },
  { id: 'cd', name: 'CD Queimado', value: 7, emoji: '💿', flavor: 'Escrito a caneta: SO AS BOAS - VOL 4.' },
  { id: 'celular', name: 'Celular de 2003', value: 18, emoji: '📱', flavor: 'Bateria em 12%. Depois de 20 anos.' },
  { id: 'boia', name: 'Boia Furada', value: 4, emoji: '🛟', flavor: 'Salva-vidas aposentado.' },
  { id: 'fita', name: 'Fita Cassete Molhada', value: 8, emoji: '📼', flavor: 'Da para rebobinar com a caneta ainda.' },
  { id: 'controle', name: 'Controle Sem Fio', value: 15, emoji: '🎮', flavor: 'Sem fio porque o fio caiu no mar.' },
  { id: 'placa', name: 'Placa de Proibido Pescar', value: 22, emoji: '🪧', flavor: 'Voce nao viu isso.' },
];

export const CHEST_LOOT = {
  minCoins: 250,
  maxCoins: 2200,
  /** chance de vir um Olho da Hydra dentro do bau */
  eyeChance: 0.35,
};
