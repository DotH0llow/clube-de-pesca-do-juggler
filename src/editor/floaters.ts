import { useSyncExternalStore } from 'react';
import { SKY_ORDER, type SkyPhaseId } from '../data/skies';

/**
 * O que passa flutuando no ceu, em forma de dados.
 *
 * Nuvem e passaro eram sorteados dentro do `Sky.tsx` com numero chumbado: seis
 * nuvens, tres bandos, velocidade dividida na mao por 0,3 e por 0,1. Nao dava
 * para acrescentar um flutuador novo sem abrir o codigo, nem para dizer de onde
 * ele sai e para onde vai.
 *
 * Agora cada flutuador e uma linha desta lista: sprite, quantos existem ao mesmo
 * tempo, de onde para onde atravessam, quanto tempo levam e em que horas do dia
 * aparecem. O ceu desenha isso; a secao FLUTUADORES do editor edita isso.
 *
 * Coordenada e sempre PORCENTAGEM DA TELA, nao unidade de mundo: o ceu nao anda
 * com a camera, ele e um pano de fundo que cobre a viewport. 0 e a borda
 * esquerda (ou o topo), 100 e a direita (ou o pe da tela). Da para sair de -30
 * e chegar em 130 para o bicho entrar e sair de cena por fora.
 */

export interface Floater {
  id: string;
  label: string;
  sprite: string;
  /** quantos existem no ceu ao mesmo tempo */
  count: number;
  /** de onde sai e para onde vai, em % da largura da tela */
  fromX: number;
  toX: number;
  /** altura de saida e de chegada, em % da altura da tela */
  fromY: number;
  toY: number;
  /** quanto a altura varia entre um e outro, em pontos percentuais */
  spreadY: number;
  /** altura do sprite, em % da altura da tela */
  size: number;
  /** variacao de tamanho, em % do proprio tamanho (0,4 = ate 40% maior/menor) */
  sizeVar: number;
  /** segundos para atravessar a tela */
  seconds: number;
  /** variacao de velocidade, em % do proprio tempo */
  secondsVar: number;
  opacity: number;
  opacityVar: number;
  /** espelhar o sprite (bicho olhando para o outro lado) */
  flip: boolean;
  /** em que horas do dia ele aparece; lista vazia = em todas */
  hours: SkyPhaseId[];
  /** desligado sem apagar */
  hidden?: boolean;
}

export interface FloaterState {
  items: Floater[];
}

function base(over: Partial<Floater> & { id: string; label: string; sprite: string }): Floater {
  return {
    count: 4,
    fromX: -25,
    toX: 125,
    fromY: 14,
    toY: 14,
    spreadY: 16,
    size: 7,
    sizeVar: 0.45,
    seconds: 330,
    secondsVar: 0.5,
    opacity: 0.7,
    opacityVar: 0.3,
    flip: false,
    hours: [],
    ...over,
  };
}

const DIA: SkyPhaseId[] = ['nascer-do-sol', 'manha-clara', 'meio-dia', 'tarde-dourada', 'por-do-sol'];
const NOITE: SkyPhaseId[] = ['pre-amanhecer', 'anoitecer-azul', 'noite-profunda'];

export function seedFloaters(): FloaterState {
  return {
    items: [
      base({
        id: 'nuvem-grande',
        label: 'NUVEM GRANDE',
        sprite: 'sky/large-cloud',
        count: 4,
        fromY: 6,
        toY: 9,
        size: 9,
        seconds: 330,
        hours: DIA,
      }),
      base({
        id: 'nuvem-pequena',
        label: 'NUVEM PEQUENA',
        sprite: 'sky/small-cloud',
        count: 4,
        fromY: 16,
        toY: 14,
        size: 5.5,
        seconds: 260,
        opacity: 0.6,
        hours: DIA,
      }),
      base({
        id: 'nuvem-noite',
        label: 'NUVEM DA NOITE',
        sprite: 'sky/night-cloud-strip',
        count: 3,
        fromY: 10,
        toY: 12,
        size: 8,
        seconds: 420,
        opacity: 0.5,
        hours: NOITE,
      }),
      base({
        id: 'bando',
        label: 'BANDO DE PÁSSAROS',
        sprite: 'sky/distant-bird-flock',
        count: 2,
        fromX: -20,
        toX: 120,
        fromY: 18,
        toY: 12,
        spreadY: 10,
        size: 3.4,
        seconds: 1800,
        opacity: 0.75,
        hours: DIA,
      }),
      base({
        id: 'gaivota',
        label: 'GAIVOTA',
        sprite: 'sky/seagull',
        count: 2,
        fromX: 120,
        toX: -20,
        fromY: 26,
        toY: 20,
        spreadY: 12,
        size: 3,
        seconds: 1500,
        opacity: 0.8,
        flip: true,
        hours: DIA,
      }),
      base({
        id: 'neblina',
        label: 'BAFO DE NEBLINA',
        sprite: 'sky/mist-puff',
        count: 3,
        fromY: 30,
        toY: 32,
        spreadY: 8,
        size: 6,
        seconds: 500,
        opacity: 0.28,
        opacityVar: 0.4,
        hours: ['pre-amanhecer', 'nascer-do-sol'],
      }),
    ],
  };
}

// ------------------------------------------------------------------- estado

const KEY = 'juggler-fishing/flutuadores/v1';

function load(): FloaterState {
  const seed = seedFloaters();
  if (typeof localStorage === 'undefined') return seed;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return seed;
    const parsed = JSON.parse(raw) as Partial<FloaterState>;
    if (!Array.isArray(parsed.items)) return seed;
    // item novo da semente entra; item que voce criou continua
    const items = parsed.items.map((it) => ({ ...base(it as Floater), ...it }));
    for (const s of seed.items) if (!items.some((i) => i.id === s.id)) items.push(s);
    return { items };
  } catch {
    return seed;
  }
}

let state: FloaterState = load();
const listeners = new Set<() => void>();

function notify() {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    /* sem espaco: vale so em memoria */
  }
  for (const l of listeners) l();
}

function subscribe(fn: () => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

export function getFloaters(): FloaterState {
  return state;
}

export function useFloaters(): FloaterState {
  return useSyncExternalStore(subscribe, getFloaters, getFloaters);
}

export function updateFloater(id: string, patch: Partial<Floater>): void {
  state = { items: state.items.map((i) => (i.id === id ? { ...i, ...patch } : i)) };
  notify();
}

export function addFloater(sprite = 'sky/small-cloud'): Floater {
  const it = base({
    id: `flutuador-${Date.now().toString(36)}`,
    label: 'FLUTUADOR NOVO',
    sprite,
  });
  state = { items: [...state.items, it] };
  notify();
  return it;
}

export function duplicateFloater(id: string): Floater | null {
  const it = state.items.find((i) => i.id === id);
  if (!it) return null;
  const copy: Floater = { ...it, id: `${it.id}-copia-${Date.now().toString(36)}`, label: `${it.label} (CÓPIA)` };
  state = { items: [...state.items, copy] };
  notify();
  return copy;
}

export function removeFloater(id: string): void {
  state = { items: state.items.filter((i) => i.id !== id) };
  notify();
}

export function resetFloaters(): void {
  state = seedFloaters();
  notify();
}

/** Os flutuadores que aparecem numa hora do dia. */
export function floatersAt(hour: SkyPhaseId): Floater[] {
  return state.items.filter((i) => !i.hidden && (i.hours.length === 0 || i.hours.includes(hour)));
}

export const ALL_HOURS = SKY_ORDER;
