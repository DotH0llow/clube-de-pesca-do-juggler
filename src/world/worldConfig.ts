import { useSyncExternalStore } from 'react';
import type { SkyPhaseId } from '../data/skies';

/**
 * A planta do mundo em forma de dados.
 *
 * Antes altura do mar, largura da agua, faixa de areia e ritmo das ondas eram
 * numero fixo no `layout.ts` e no CSS. Dava para mudar tudo isso - abrindo o
 * codigo. Agora e configuracao salva no navegador, que a secao MUNDO do editor
 * edita e o jogo le a cada quadro.
 *
 * Os numeros da semente sao os do pedido de 2026:
 *
 *   - o mar ficou SEIS vezes mais fundo (348 -> 2088 unidades) e QUATRO vezes
 *     mais largo (1800 -> 7200);
 *   - a faixa de areia caiu para 20% do que era (352 -> 70): esta cena e sobre
 *     o que acontece ACIMA da areia, o que esta embaixo nao interessa;
 *   - o ENQUADRAMENTO (`frameH`) deixou de ser a altura do mundo. A tela mostra
 *     720 unidades com a linha d'agua sempre na mesma altura; o resto do mar
 *     existe abaixo e so aparece quando a camera abre.
 *
 * Por isso "mundo mais fundo" nao encolheu o jogo: fundo e enquadramento sao
 * duas coisas separadas agora.
 */

export interface WorldConfig {
  // --------------------------------------------------------------- geometria
  /** linha d'agua: acima e ceu, abaixo e mar */
  waterY: number;
  /** quanto de agua existe abaixo da linha d'agua */
  seaDepth: number;
  /** quanto de agua existe para a esquerda da praia */
  seaWidth: number;
  /** onde o mar encontra a areia */
  shoreX: number;
  /** topo da areia da praia */
  sandY: number;
  /** quanto de areia aparece abaixo do topo */
  sandDepth: number;
  /** piso do deck do pier */
  pierY: number;

  // ----------------------------------------------------------- enquadramento
  /** quantas unidades de altura cabem na tela com zoom 1 */
  frameH: number;
  /** onde a linha d'agua fica na tela, de 0 (topo) a 1 (pe) */
  waterAnchor: number;
  /** enquadramento do lado da praia (1 = o normal) */
  frameLand: number;
  /** enquadramento do lado do mar: menor = camera mais aberta, mais mar */
  frameSea: number;
  /** quanto tempo a troca de enquadramento leva, em segundos */
  frameEase: number;

  // ------------------------------------------------------------------ ondas
  /** altura da faixa de espuma e ondas, em unidades */
  waveH: number;
  /** o quanto a faixa sobe acima da linha d'agua */
  waveLift: number;
  foamOpacity: number;
  swellOpacity: number;
  glintOpacity: number;
  /** segundos que a onda leva para dar uma passada */
  swellSeconds: number;
  foamSeconds: number;
  /** quanto a onda sobe e desce, em unidades */
  waveBob: number;

  // ------------------------------------------------------------ tela de titulo
  /**
   * A hora do dia da TELA DE MENU.
   *
   * O menu nao acompanha mais o relogio: abrir o jogo de madrugada nao muda a
   * tela de titulo. E uma tela de apresentacao, e apresentacao que muda sozinha
   * nao e apresentacao. Aqui voce escolhe qual ceu ela usa, e pronto.
   */
  menuHour: SkyPhaseId;
}

export function seedWorld(): WorldConfig {
  return {
    waterY: 372,
    seaDepth: 2088,
    seaWidth: 7200,
    shoreX: 1400,
    sandY: 368,
    sandDepth: 70,
    pierY: 336,

    frameH: 720,
    waterAnchor: 0.517,
    frameLand: 1,
    frameSea: 0.42,
    frameEase: 0.9,

    waveH: 44,
    waveLift: 20,
    foamOpacity: 0.75,
    swellOpacity: 0.55,
    glintOpacity: 0.4,
    swellSeconds: 9,
    foamSeconds: 6,
    waveBob: 5,

    menuHour: 'por-do-sol',
  };
}

const KEY = 'juggler-fishing/mundo/v1';

function load(): WorldConfig {
  const seed = seedWorld();
  if (typeof localStorage === 'undefined') return seed;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return seed;
    return { ...seed, ...(JSON.parse(raw) as Partial<WorldConfig>) };
  } catch {
    return seed;
  }
}

let state: WorldConfig = load();
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

export function getWorld(): WorldConfig {
  return state;
}

export function useWorld(): WorldConfig {
  return useSyncExternalStore(subscribe, getWorld, getWorld);
}

export function updateWorld(patch: Partial<WorldConfig>): void {
  state = { ...state, ...patch };
  notify();
}

export function resetWorld(): void {
  state = seedWorld();
  notify();
}

// ------------------------------------------------------------------ derivados

/** Fundo do mar, em unidades de mundo. */
export function seaBottom(): number {
  return state.waterY + state.seaDepth;
}

/** Borda esquerda da agua. E negativa: o mar aberto passa do zero do mundo. */
export function seaLeft(): number {
  return state.shoreX - state.seaWidth;
}

/** Pe da areia da praia. */
export function sandBottom(): number {
  return state.sandY + state.sandDepth;
}

/** O ponto mais baixo que existe no mundo. */
export function worldBottom(): number {
  return Math.max(seaBottom(), sandBottom());
}
