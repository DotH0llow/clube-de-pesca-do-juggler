import type { RegionId } from '../state/types';

/**
 * As oito horas do dia.
 *
 * O pacote de ceus novo veio com oito pinturas, de pre-amanhecer a noite
 * profunda, entao o dia deixou de ter quatro degraus e passou a ter oito. Isso
 * e uma escala VISUAL: ceu, cor do mar, luz e clima.
 *
 * A REGIAO (quatro ids antigos) continua existindo e continua mandando na
 * economia - valor do peixe, raridade maxima, dificuldade. Cada hora aponta
 * para a regiao que vale nela. Separar as duas coisas foi de proposito: a
 * tabela de peixe, o album e os saves antigos falam em regiao, e ninguem quer
 * migrar 24 especies para poder ter um ceu a mais.
 */

export type SkyPhaseId =
  | 'pre-amanhecer'
  | 'nascer-do-sol'
  | 'manha-clara'
  | 'meio-dia'
  | 'tarde-dourada'
  | 'por-do-sol'
  | 'anoitecer-azul'
  | 'noite-profunda';

export interface SkyPhase {
  id: SkyPhaseId;
  /** nome na tela */
  name: string;
  /** hora ficticia em que a fase comeca */
  hour: number;
  /** fundo do ceu, em `assets/game/bg` */
  bg: string;
  /** que regiao (economia) vale nesta hora */
  region: RegionId;
  night: boolean;
  storm: boolean;
  palette: {
    seaTop: string;
    seaBottom: string;
    sun: string;
    haze: string;
  };
}

export const SKY_PHASES: SkyPhase[] = [
  {
    id: 'pre-amanhecer',
    name: 'Pré-amanhecer',
    hour: 3,
    bg: 'bg/sky-01-pre-amanhecer',
    region: 'fossa',
    night: true,
    storm: false,
    palette: { seaTop: '#1b3f6b', seaBottom: '#040c1c', sun: '#8fa6d8', haze: '#4a5f92' },
  },
  {
    id: 'nascer-do-sol',
    name: 'Nascer do sol',
    hour: 6,
    bg: 'bg/sky-02-nascer-do-sol-transicao',
    region: 'enseada',
    night: false,
    storm: false,
    palette: { seaTop: '#31a0c4', seaBottom: '#0a3e63', sun: '#ffd9a0', haze: '#ffc9a8' },
  },
  {
    id: 'manha-clara',
    name: 'Manhã clara',
    hour: 9,
    bg: 'bg/sky-03-manha-clara',
    region: 'enseada',
    night: false,
    storm: false,
    palette: { seaTop: '#1fc8e3', seaBottom: '#065a86', sun: '#fff4b8', haze: '#d7f4ff' },
  },
  {
    id: 'meio-dia',
    name: 'Meio-dia',
    hour: 12,
    bg: 'bg/sky-04-meio-dia',
    region: 'naufragio',
    night: false,
    storm: false,
    palette: { seaTop: '#25d2e8', seaBottom: '#046a97', sun: '#ffffff', haze: '#e8fbff' },
  },
  {
    id: 'tarde-dourada',
    name: 'Tarde dourada',
    hour: 15,
    bg: 'bg/sky-05-tarde-dourada-transicao',
    region: 'naufragio',
    night: false,
    storm: true,
    palette: { seaTop: '#2aa8ba', seaBottom: '#06405e', sun: '#ffd88a', haze: '#ffdcae' },
  },
  {
    id: 'por-do-sol',
    name: 'Pôr do sol',
    hour: 18,
    bg: 'bg/sky-06-por-do-sol',
    region: 'recife',
    night: false,
    storm: false,
    palette: { seaTop: '#2196b8', seaBottom: '#08243a', sun: '#ffd166', haze: '#ff9ad9' },
  },
  {
    id: 'anoitecer-azul',
    name: 'Anoitecer azul',
    hour: 21,
    bg: 'bg/sky-07-anoitecer-azul',
    region: 'recife',
    night: true,
    storm: false,
    palette: { seaTop: '#1d5f92', seaBottom: '#04162a', sun: '#c9d8ff', haze: '#6f8ec7' },
  },
  {
    id: 'noite-profunda',
    name: 'Noite profunda',
    hour: 0,
    bg: 'bg/sky-08-noite-profunda',
    region: 'fossa',
    night: true,
    storm: false,
    palette: { seaTop: '#123a86', seaBottom: '#01030f', sun: '#ff2e4d', haze: '#7b2ff7' },
  },
];

export const SKY_BY_ID: Record<SkyPhaseId, SkyPhase> = Object.fromEntries(
  SKY_PHASES.map((p) => [p.id, p]),
) as Record<SkyPhaseId, SkyPhase>;

/** A ordem em que as horas entram no ar. */
export const SKY_ORDER: SkyPhaseId[] = SKY_PHASES.map((p) => p.id);

export function skyPhase(id: SkyPhaseId): SkyPhase {
  return SKY_BY_ID[id] ?? SKY_PHASES[2];
}
