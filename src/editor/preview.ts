import { useSyncExternalStore } from 'react';
import { FISHING_STEPS, MECHANICS, type MechanicStep } from './fx';

/**
 * Simulacao de mecanica dentro do editor.
 *
 * A secao MECANICAS nao desenha uma maquete propria: ela pede ao jogo para
 * congelar numa etapa (`idle`, `bite`, `reeling`...). O App le daqui e passa a
 * fase para o mundo de verdade, entao o que aparece na tela e o mesmo desenho
 * que o jogador ve - com os mesmos efeitos, na mesma posicao, no mesmo tamanho.
 */

export interface PreviewState {
  /** null = editor sem simulacao; o jogo fica como estava */
  mechanic: string | null;
  stepIndex: number;
}

let state: PreviewState = { mechanic: null, stepIndex: 0 };
const listeners = new Set<() => void>();

function notify() {
  for (const l of listeners) l();
}

function subscribe(fn: () => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

export function getPreview(): PreviewState {
  return state;
}

export function usePreview(): PreviewState {
  return useSyncExternalStore(subscribe, getPreview, getPreview);
}

export function stepsOf(mechanic: string | null): MechanicStep[] {
  if (!mechanic) return [];
  return MECHANICS.find((m) => m.id === mechanic)?.steps ?? FISHING_STEPS;
}

export function currentStep(): MechanicStep | null {
  const steps = stepsOf(state.mechanic);
  return steps[state.stepIndex] ?? null;
}

export function setMechanic(mechanic: string | null): void {
  state = { mechanic, stepIndex: 0 };
  notify();
}

/** Anda `delta` etapas, sem passar das pontas. */
export function moveStep(delta: number): void {
  const steps = stepsOf(state.mechanic);
  if (steps.length === 0) return;
  const next = Math.min(steps.length - 1, Math.max(0, state.stepIndex + delta));
  if (next === state.stepIndex) return;
  state = { ...state, stepIndex: next };
  notify();
}

export function goToStep(i: number): void {
  state = { ...state, stepIndex: i };
  notify();
}

export function stopPreview(): void {
  if (state.mechanic === null) return;
  state = { mechanic: null, stepIndex: 0 };
  notify();
}
