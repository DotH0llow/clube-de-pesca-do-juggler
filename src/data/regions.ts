import { DAY_ORDER } from '../world/dayCycle';
import type { Region, RegionId } from '../state/types';

/**
 * As quatro fases de um dia no cais, da manha a madrugada.
 *
 * Antes isso era um mapa de quatro pesqueiros que o jogador comprava e trocava
 * na loja. Agora e o mesmo lugar em quatro horarios: o relogio anda sozinho
 * (24 minutos por dia, 6 por fase) e a fase que estiver valendo manda no ceu,
 * na paleta, no valor do peixe e na raridade que aparece.
 *
 * Os ids continuam os antigos para nao invalidar save nem tabela de peixe.
 */
export const REGIONS: Record<RegionId, Region> = {
  enseada: {
    id: 'enseada',
    name: 'Manhã na Enseada',
    subtitle: 'Água rasa, sol subindo, peixe manso.',
    time: '06:00',
    valueMultiplier: 1,
    rarityBonus: 0,
    maxRarity: 'raro',
    difficulty: 0,
    palette: {
      skyTop: '#39b6ef',
      skyBottom: '#b8ecff',
      seaTop: '#1fc8e3',
      seaBottom: '#065a86',
      sun: '#fff4b8',
      island: '#93a9b4',
      islandShade: '#5d7280',
      haze: '#d7f4ff',
    },
  },
  recife: {
    id: 'recife',
    name: 'Entardecer no Recife',
    subtitle: 'O sol cai e o cardume começa a brilhar.',
    time: '18:00',
    valueMultiplier: 1.35,
    rarityBonus: 0.15,
    maxRarity: 'epico',
    difficulty: 0.1,
    palette: {
      skyTop: '#2b1055',
      skyBottom: '#ff77c2',
      seaTop: '#2196b8',
      seaBottom: '#08243a',
      sun: '#ffd166',
      island: '#4a3f6b',
      islandShade: '#241d40',
      haze: '#ff9ad9',
    },
  },
  naufragio: {
    id: 'naufragio',
    name: 'Tarde de Temporal',
    subtitle: 'Céu fechado, óleo na água e bicho grande embaixo.',
    time: '12:00',
    valueMultiplier: 1.8,
    rarityBonus: 0.32,
    maxRarity: 'lendario',
    difficulty: 0.2,
    palette: {
      skyTop: '#33506b',
      skyBottom: '#9db9cc',
      seaTop: '#12798c',
      seaBottom: '#03202b',
      sun: '#e6eef4',
      island: '#4d5d66',
      islandShade: '#2a353b',
      haze: '#b3cddc',
    },
  },
  fossa: {
    id: 'fossa',
    name: 'Madrugada na Fossa',
    subtitle: 'Três sombras no fundo. Nenhuma delas é peixe.',
    time: '00:00',
    valueMultiplier: 2.6,
    rarityBonus: 0.6,
    maxRarity: 'mitico',
    difficulty: 0.32,
    palette: {
      skyTop: '#04081c',
      skyBottom: '#241a5e',
      seaTop: '#123a86',
      seaBottom: '#01030f',
      sun: '#ff2e4d',
      island: '#17203f',
      islandShade: '#080d1f',
      haze: '#7b2ff7',
    },
  },
};

/** A ordem em que as fases entram no ar. Mora no relogio, nao aqui. */
export const REGION_ORDER: RegionId[] = DAY_ORDER;
