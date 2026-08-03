import { useSyncExternalStore } from 'react';
import type { Phase } from '../hooks/useFishingLoop';
import type { SfxName } from '../engine/audio';
import { WATER_Y } from '../world/layout';

/**
 * Efeitos das mecanicas em forma de dados.
 *
 * Boia, ondinha, anel de mordida, ponto de exclamacao, peixe fisgado e a linha
 * de pesca deixaram de ter posicao e tamanho chumbados no CSS: agora sao itens
 * com x, y, largura, altura, giro, opacidade, CAMADA e duracao, salvos no
 * navegador.
 *
 * O jogo desenha essa lista. O editor edita essa lista. Por isso o que voce
 * ajusta na secao MECANICAS vale no jogo de verdade no proximo lance.
 *
 * Todo x/y e RELATIVO a ancora do efeito:
 *   - itens do apetrecho (`rig`) medem a partir do ponto onde a boia cai;
 *   - as pontas de vara (`tip-*`) medem a partir dos pes do Juggler.
 *
 * Este arquivo tem HISTORICO PROPRIO. O Ctrl+Z de dentro da simulacao desfaz
 * mexida de mecanica, e o de fora desfaz mexida de cena: sao duas pilhas
 * separadas, e nao uma so que ia desfazendo o que voce nem estava olhando.
 */

export type FxAnchor = 'rig' | 'jogador';

/** O que a peca e. `peixe` desenha o vulto do peixe fisgado, nao um sprite. */
export type FxKind = 'sprite' | 'peixe';

/** Animacao pronta que da para pendurar numa peca. */
export type FxAnim = '' | 'pulsing' | 'bobbing' | 'spinning' | 'fading';

export const FX_ANIMS: { id: FxAnim; label: string }[] = [
  { id: '', label: 'NENHUMA' },
  { id: 'pulsing', label: 'PULSAR' },
  { id: 'bobbing', label: 'BALANÇAR' },
  { id: 'spinning', label: 'GIRAR' },
  { id: 'fading', label: 'PISCAR' },
];

export interface FxItem {
  id: string;
  label: string;
  kind: FxKind;
  /** caminho do sprite; vazio = desenhado (a linha, o vulto do peixe) */
  sprite: string;
  anchor: FxAnchor;
  x: number;
  y: number;
  w: number;
  h: number;
  rot: number;
  opacity: number;
  /** camada: quanto maior, mais na frente. Desempata pela ordem da lista. */
  z: number;
  /** em que etapas da mecanica o item aparece */
  steps: StepId[];
  /** duracao propria do item, em ms (0 = segue a etapa) */
  ms: number;
  /** animacao pendurada na peca */
  anim: FxAnim;
  /** true = tremer quando o peixe morde (a ondinha da boia faz isso) */
  wave?: boolean;
  /** true = so ponto de referencia, sem caixa desenhada (pontas de vara) */
  point?: boolean;
  /** true = escondido: continua na lista, mas nao aparece no jogo */
  off?: boolean;
  /** true = peca da semente; nao da para apagar, so esconder */
  fixed?: boolean;
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

// ------------------------------------------------------------------- audio

/**
 * Um som da mecanica: o que toca, em que etapa e em que momento dela.
 *
 * `sfx` e o som procedural do motor (`src/engine/audio.ts`); `musica` e uma
 * faixa de `src/assets/music`, util para stinger de captura ou tensao do
 * recolhimento.
 */
export interface FxSound {
  id: string;
  label: string;
  source: 'sfx' | 'musica';
  /** nome do efeito procedural, quando `source = sfx` */
  sfx: SfxName;
  /** id da faixa, quando `source = musica` */
  track: string;
  /** em que etapa da mecanica ele dispara */
  step: StepId;
  /** ao ENTRAR na etapa ou ao SAIR dela */
  when: 'entrar' | 'sair';
  /** espera antes de tocar, em ms */
  delayMs: number;
  /** 0 a 1, por cima do volume das configuracoes */
  volume: number;
  /** repetir enquanto a etapa durar (so faz sentido em faixa) */
  loop: boolean;
  off?: boolean;
}

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
  /**
   * Onde o Juggler fica plantado quando a pescaria comeca, em unidades de
   * mundo. `null` = no meio da area de interacao da vara, como era antes.
   */
  fishX: number | null;
}

export interface FxState {
  items: FxItem[];
  sounds: FxSound[];
  timings: FxTimings;
}

function item(over: Partial<FxItem> & { id: string; label: string }): FxItem {
  return {
    kind: 'sprite',
    sprite: '',
    anchor: 'rig',
    x: 0,
    y: 0,
    w: 60,
    h: 60,
    rot: 0,
    opacity: 1,
    z: 0,
    steps: [],
    ms: 0,
    anim: '',
    ...over,
  };
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
      fishX: null,
    },
    items: [
      item({
        id: 'ondinha',
        label: 'ONDINHA DA BOIA',
        sprite: 'fx/circular-ripple',
        x: -65, y: -26, w: 130, h: 51, opacity: 0.85, z: 0,
        steps: ['waiting', 'bite', 'reeling'],
        wave: true,
        fixed: true,
      }),
      item({
        id: 'anel-mordida',
        label: 'ANEL DE MORDIDA',
        sprite: 'fx/bite-alert-ring',
        x: -60, y: -41, w: 120, h: 81, z: 2,
        steps: ['bite'],
        anim: 'pulsing',
        fixed: true,
      }),
      item({
        id: 'exclamacao',
        label: 'PONTO DE EXCLAMAÇÃO',
        sprite: 'fx/exclamation-mark',
        x: -13, y: -118, w: 26, h: 59, z: 4,
        steps: ['bite'],
        anim: 'bobbing',
        fixed: true,
      }),
      item({
        id: 'peixe-fisgado',
        label: 'VULTO DO PEIXE',
        kind: 'peixe',
        x: -30, y: 16, w: 60, h: 60, z: 1,
        steps: ['reeling'],
        fixed: true,
      }),
      // ---- pontas da vara: uma por pose, para a linha sair do lugar certo
      item({ id: 'tip-idle', label: 'PONTA DA VARA · PARADO', anchor: 'jogador', x: -99, y: 21, w: 0, h: 0, steps: ['idle'], point: true, fixed: true }),
      item({ id: 'tip-power', label: 'PONTA DA VARA · FORÇA', anchor: 'jogador', x: 99, y: -169, w: 0, h: 0, steps: ['power'], point: true, fixed: true }),
      item({ id: 'tip-cast', label: 'PONTA DA VARA · ARREMESSO', anchor: 'jogador', x: -98, y: -140, w: 0, h: 0, steps: ['cast'], point: true, fixed: true }),
      item({ id: 'tip-waiting', label: 'PONTA DA VARA · ESPERA', anchor: 'jogador', x: -96, y: 22, w: 0, h: 0, steps: ['waiting'], point: true, fixed: true }),
      item({ id: 'tip-bite', label: 'PONTA DA VARA · FISGADA', anchor: 'jogador', x: -98, y: -170, w: 0, h: 0, steps: ['bite'], point: true, fixed: true }),
      item({ id: 'tip-reeling', label: 'PONTA DA VARA · RECOLHENDO', anchor: 'jogador', x: -86, y: -164, w: 0, h: 0, steps: ['reeling'], point: true, fixed: true }),
    ],
    sounds: [
      { id: 'som-lance', label: 'ZUNIDO DO LANCE', source: 'sfx', sfx: 'cast', track: '', step: 'cast', when: 'entrar', delayMs: 0, volume: 1, loop: false },
      { id: 'som-agua', label: 'BOIA CAINDO NA ÁGUA', source: 'sfx', sfx: 'splash', track: '', step: 'waiting', when: 'entrar', delayMs: 120, volume: 1, loop: false },
      { id: 'som-mordida', label: 'ALERTA DE MORDIDA', source: 'sfx', sfx: 'bite', track: '', step: 'bite', when: 'entrar', delayMs: 0, volume: 1, loop: false },
      { id: 'som-carretel', label: 'CARRETEL', source: 'sfx', sfx: 'reel', track: '', step: 'reeling', when: 'entrar', delayMs: 0, volume: 1, loop: false },
    ],
  };
}

// ------------------------------------------------------------------- estado

const KEY = 'juggler-fishing/mecanicas/v2';
const KEY_V1 = 'juggler-fishing/mecanicas/v1';

function load(): FxState {
  const seed = seedFx();
  if (typeof localStorage === 'undefined') return seed;
  try {
    const raw = localStorage.getItem(KEY) ?? localStorage.getItem(KEY_V1);
    if (!raw) return seed;
    const parsed = JSON.parse(raw) as Partial<FxState>;
    // peca da semente mantem rotulo e tipo; o resto vem do save
    const items = seed.items.map((base) => {
      const saved = parsed.items?.find((i) => i.id === base.id);
      return saved ? { ...base, ...saved, id: base.id, label: base.label, kind: base.kind, fixed: true } : base;
    });
    // peca que voce criou no editor nao esta na semente: entra depois
    for (const it of parsed.items ?? []) {
      if (!items.some((i) => i.id === it.id)) items.push({ ...item(it as FxItem), ...it, fixed: false });
    }
    return {
      items,
      sounds: parsed.sounds ?? seed.sounds,
      timings: { ...seed.timings, ...(parsed.timings ?? {}) },
    };
  } catch {
    return seed;
  }
}

let state: FxState = typeof localStorage === 'undefined' ? seedFx() : load();
const listeners = new Set<() => void>();

/** Historico proprio da secao de mecanicas. */
const HISTORY_MAX = 80;
let past: FxState[] = [];
let future: FxState[] = [];
let batching = false;

function notify() {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    /* sem espaco: vale so em memoria */
  }
  for (const l of listeners) l();
}

function set(next: FxState, record = true) {
  if (record && !batching) {
    past.push(state);
    if (past.length > HISTORY_MAX) past.shift();
    future = [];
  }
  state = next;
  notify();
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

// ------------------------------------------------------------------ desfazer

/** Abre um lote: o arrasto inteiro vira um unico passo do desfazer. */
export function beginFxBatch(): void {
  if (batching) return;
  past.push(state);
  if (past.length > HISTORY_MAX) past.shift();
  future = [];
  batching = true;
}

export function endFxBatch(): void {
  batching = false;
}

export function undoFx(): boolean {
  const prev = past.pop();
  if (!prev) return false;
  future.push(state);
  state = prev;
  notify();
  return true;
}

export function redoFx(): boolean {
  const next = future.pop();
  if (!next) return false;
  past.push(state);
  state = next;
  notify();
  return true;
}

export function canUndoFx(): boolean {
  return past.length > 0;
}

export function canRedoFx(): boolean {
  return future.length > 0;
}

// -------------------------------------------------------------------- acoes

export function updateFx(id: string, patch: Partial<FxItem>): void {
  set({ ...state, items: state.items.map((i) => (i.id === id ? { ...i, ...patch } : i)) });
}

/** Cria uma peca nova, ja aparecendo na etapa que estiver aberta. */
export function addFxItem(step: StepId, sprite = 'fx/water-particles'): FxItem {
  const novo = item({
    id: `peca-${Date.now().toString(36)}`,
    label: 'PEÇA NOVA',
    sprite,
    x: -40,
    y: -40,
    w: 80,
    h: 80,
    z: 5,
    steps: [step],
  });
  set({ ...state, items: [...state.items, novo] });
  return novo;
}

export function duplicateFxItem(id: string): FxItem | null {
  const it = fxItem(id);
  if (!it) return null;
  const copy: FxItem = {
    ...it,
    id: `${it.id}-copia-${Date.now().toString(36)}`,
    label: `${it.label} (CÓPIA)`,
    fixed: false,
    x: it.x + 20,
  };
  set({ ...state, items: [...state.items, copy] });
  return copy;
}

/** Apaga uma peca. Peca da semente nao sai - use ESCONDER. */
export function removeFxItem(id: string): void {
  const it = fxItem(id);
  if (!it || it.fixed) return;
  set({ ...state, items: state.items.filter((i) => i.id !== id) });
}

export function updateTimings(patch: Partial<FxTimings>): void {
  set({ ...state, timings: { ...state.timings, ...patch } });
}

// ------------------------------------------------------------------- sons

export function updateSound(id: string, patch: Partial<FxSound>): void {
  set({ ...state, sounds: state.sounds.map((s) => (s.id === id ? { ...s, ...patch } : s)) });
}

export function addSound(step: StepId): FxSound {
  const novo: FxSound = {
    id: `som-${Date.now().toString(36)}`,
    label: 'SOM NOVO',
    source: 'sfx',
    sfx: 'ui',
    track: '',
    step,
    when: 'entrar',
    delayMs: 0,
    volume: 1,
    loop: false,
  };
  set({ ...state, sounds: [...state.sounds, novo] });
  return novo;
}

export function removeSound(id: string): void {
  set({ ...state, sounds: state.sounds.filter((s) => s.id !== id) });
}

export function resetFx(): void {
  set(seedFx());
}

/** Ponta da vara na pose atual, em offset a partir dos pes do Juggler. */
export function rodTip(pose: string): { x: number; y: number } {
  const it = fxItem(`tip-${pose}`) ?? fxItem('tip-waiting');
  return { x: it?.x ?? -96, y: it?.y ?? 22 };
}
