import { useSyncExternalStore } from 'react';
import type { Phase } from '../hooks/useFishingLoop';
import { WATER_Y } from '../world/layout';

/**
 * Efeitos das mecanicas em forma de dados.
 *
 * Boia, ondinha, anel de mordida, ponto de exclamacao, peixe fisgado e a linha
 * de pesca deixaram de ter posicao e tamanho chumbados no CSS: agora sao itens
 * com x, y, largura, altura, giro, opacidade e duracao, salvos no navegador.
 *
 * O jogo desenha essa lista. O editor edita essa lista. Por isso o que voce
 * ajusta na secao MECANICAS vale no jogo de verdade no proximo lance.
 *
 * Todo x/y e RELATIVO a ancora do efeito:
 *   - itens do apetrecho (`rig`) medem a partir do ponto onde a boia cai;
 *   - as pontas de vara (`tip-*`) medem a partir dos pes do Juggler.
 */

export type FxAnchor = 'rig' | 'jogador';

export interface FxItem {
  id: string;
  label: string;
  /** caminho do sprite; vazio = desenhado (a linha) */
  sprite: string;
  anchor: FxAnchor;
  x: number;
  y: number;
  w: number;
  h: number;
  rot: number;
  opacity: number;
  /** em que etapas da mecanica o item aparece */
  steps: StepId[];
  /** duracao propria do item, em ms (0 = segue a etapa) */
  ms: number;
  /** true = so ponto de referencia, sem caixa desenhada (pontas de vara) */
  point?: boolean;
}

export type StepId = 'idle' | 'power' | 'cast' | 'waiting' | 'bite' | 'reeling' | 'result';

export interface MechanicStep {
  id: StepId;
  label: string;
  /** fase real do jogo que essa etapa reproduz */
  phase: Phase;
  /** pose da pescaria mostrada nessa etapa */
  pose: 'idle' | 'power' | 'cast' | 'waiting' | 'bite' | 'reeling';
  hint: string;
}

export const FISHING_STEPS: MechanicStep[] = [
  { id: 'idle', label: '1 · VARA NA MÃO', phase: 'idle', pose: 'idle', hint: 'Juggler pronto, linha recolhida.' },
  { id: 'power', label: '2 · BARRA DE FORÇA', phase: 'power', pose: 'power', hint: 'Barra de força na tela; a vara vai para trás.' },
  { id: 'cast', label: '3 · ARREMESSO', phase: 'waiting', pose: 'cast', hint: 'Quadro do arremesso, antes de a boia assentar.' },
  { id: 'waiting', label: '4 · ESPERA', phase: 'waiting', pose: 'waiting', hint: 'Linha na água, ondinha na boia.' },
  { id: 'bite', label: '5 · MORDIDA', phase: 'bite', pose: 'bite', hint: 'Anel de alerta e ponto de exclamação.' },
  { id: 'reeling', label: '6 · RECOLHENDO', phase: 'reeling', pose: 'reeling', hint: 'Minigame de puxar, com o vulto do peixe.' },
  { id: 'result', label: '7 · RESULTADO', phase: 'result', pose: 'idle', hint: 'Popup da captura.' },
];

export const MECHANICS = [{ id: 'pescaria', label: 'PESCARIA', steps: FISHING_STEPS }] as const;

/** Tempos das mecanicas, em ms. */
export interface FxTimings {
  /** janela para clicar em FISGAR */
  biteWindowMs: number;
  /** quanto o quadro de arremesso segura antes de virar espera */
  castHoldMs: number;
  /** onde a boia cai, medido a partir da vara */
  bobberDx: number;
  bobberY: number;
  /** espessura da linha, em unidades de mundo */
  lineWidth: number;
  /** barriga da linha entre a ponta da vara e a boia */
  lineSag: number;
}

export interface FxState {
  items: FxItem[];
  timings: FxTimings;
}

export function seedFx(): FxState {
  return {
    timings: {
      biteWindowMs: 4600,
      castHoldMs: 380,
      bobberDx: -270,
      bobberY: WATER_Y + 30,
      lineWidth: 2,
      lineSag: 12,
    },
    items: [
      {
        id: 'ondinha',
        label: 'ONDINHA DA BOIA',
        sprite: 'fx/circular-ripple',
        anchor: 'rig',
        x: -65, y: -26, w: 130, h: 51, rot: 0, opacity: 0.85,
        steps: ['waiting', 'bite', 'reeling'],
        ms: 0,
      },
      {
        id: 'anel-mordida',
        label: 'ANEL DE MORDIDA',
        sprite: 'fx/bite-alert-ring',
        anchor: 'rig',
        x: -60, y: -41, w: 120, h: 81, rot: 0, opacity: 1,
        steps: ['bite'],
        ms: 0,
      },
      {
        id: 'exclamacao',
        label: 'PONTO DE EXCLAMAÇÃO',
        sprite: 'fx/exclamation-mark',
        anchor: 'rig',
        x: -13, y: -118, w: 26, h: 59, rot: 0, opacity: 1,
        steps: ['bite'],
        ms: 0,
      },
      {
        id: 'peixe-fisgado',
        label: 'VULTO DO PEIXE',
        sprite: '',
        anchor: 'rig',
        x: -30, y: 16, w: 60, h: 60, rot: 0, opacity: 1,
        steps: ['reeling'],
        ms: 0,
      },
      // ---- pontas da vara: uma por pose, para a linha sair do lugar certo
      { id: 'tip-idle', label: 'PONTA DA VARA · PARADO', sprite: '', anchor: 'jogador', x: -99, y: 21, w: 0, h: 0, rot: 0, opacity: 1, steps: ['idle'], ms: 0, point: true },
      { id: 'tip-power', label: 'PONTA DA VARA · FORÇA', sprite: '', anchor: 'jogador', x: 99, y: -169, w: 0, h: 0, rot: 0, opacity: 1, steps: ['power'], ms: 0, point: true },
      { id: 'tip-cast', label: 'PONTA DA VARA · ARREMESSO', sprite: '', anchor: 'jogador', x: -98, y: -140, w: 0, h: 0, rot: 0, opacity: 1, steps: ['cast'], ms: 0, point: true },
      { id: 'tip-waiting', label: 'PONTA DA VARA · ESPERA', sprite: '', anchor: 'jogador', x: -96, y: 22, w: 0, h: 0, rot: 0, opacity: 1, steps: ['waiting'], ms: 0, point: true },
      { id: 'tip-bite', label: 'PONTA DA VARA · FISGADA', sprite: '', anchor: 'jogador', x: -98, y: -170, w: 0, h: 0, rot: 0, opacity: 1, steps: ['bite'], ms: 0, point: true },
      { id: 'tip-reeling', label: 'PONTA DA VARA · RECOLHENDO', sprite: '', anchor: 'jogador', x: -86, y: -164, w: 0, h: 0, rot: 0, opacity: 1, steps: ['reeling'], ms: 0, point: true },
    ],
  };
}

// ------------------------------------------------------------------- estado

const KEY = 'juggler-fishing/mecanicas/v1';

function load(): FxState {
  const seed = seedFx();
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return seed;
    const parsed = JSON.parse(raw) as Partial<FxState>;
    const items = seed.items.map((base) => {
      const saved = parsed.items?.find((i) => i.id === base.id);
      return saved ? { ...base, ...saved, id: base.id, label: base.label } : base;
    });
    return { items, timings: { ...seed.timings, ...(parsed.timings ?? {}) } };
  } catch {
    return seed;
  }
}

let state: FxState = typeof localStorage === 'undefined' ? seedFx() : load();
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

export function getFx(): FxState {
  return state;
}

export function useFx(): FxState {
  return useSyncExternalStore(subscribe, getFx, getFx);
}

export function fxItem(id: string): FxItem | undefined {
  return state.items.find((i) => i.id === id);
}

export function updateFx(id: string, patch: Partial<FxItem>): void {
  state = { ...state, items: state.items.map((i) => (i.id === id ? { ...i, ...patch } : i)) };
  notify();
}

export function updateTimings(patch: Partial<FxTimings>): void {
  state = { ...state, timings: { ...state.timings, ...patch } };
  notify();
}

export function resetFx(): void {
  state = seedFx();
  notify();
}

/** Ponta da vara na pose atual, em offset a partir dos pes do Juggler. */
export function rodTip(pose: string): { x: number; y: number } {
  const it = fxItem(`tip-${pose}`) ?? fxItem('tip-waiting');
  return { x: it?.x ?? -96, y: it?.y ?? 22 };
}
