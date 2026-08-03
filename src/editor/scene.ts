import { useSyncExternalStore } from 'react';
import { aspectOf } from '../assets/dims';
import {
  BEACH,
  CABANA,
  FOREST,
  FOREST_START,
  MARKET,
  MARKET_X,
  PIER_END,
  PIER_PROPS,
  PIER_START,
  PIER_Y,
  ROD_X,
  SAND_Y,
  SEAFLOOR,
  SHORE,
  UNDERWATER_LIFE,
  WORLD_W,
  type Prop,
} from '../world/layout';
import type { LayerId, SceneObject, SceneState, ZoneId } from './types';

const KEY = 'juggler-fishing/cena/v2';

/**
 * A cena do mundo em forma de dados.
 *
 * Antes cada prop era uma constante no `layout.ts` e so o codigo mexia nela.
 * Agora tudo vira objeto com posicao, tamanho, rotacao, camada e cadeado - e o
 * modo editor edita exatamente a mesma lista que o jogo desenha. O layout
 * continua sendo a semente: apagar o save volta pro cenario original.
 */

// ------------------------------------------------------------------ semente

let seq = 0;
function fromProp(p: Prop, layer: LayerId, under = false): SceneObject {
  const w = Math.round(p.h * aspectOf(p.sprite));
  return {
    id: `${p.sprite.split('/').pop()}-${++seq}`,
    layer,
    kind: 'sprite',
    sprite: p.sprite,
    x: p.x,
    y: p.y - p.h,
    w,
    h: p.h,
    rot: 0,
    flip: p.flip,
    opacity: p.opacity,
    under,
    anim: p.className,
  };
}

function seedObjects(): SceneObject[] {
  seq = 0;
  const out: SceneObject[] = [];

  // ------------------------------------------------------------- fundo
  for (const p of SEAFLOOR) out.push(fromProp(p, 'fundo', true));
  for (const p of UNDERWATER_LIFE) out.push(fromProp(p, 'fundo', true));
  // A areia da frente e desenhada DEPOIS da camada de fundo, entao concha,
  // estrela e caranguejo da orla precisam viver no cenario - no fundo eles
  // ficavam escondidos atras do proprio chao.
  for (const p of SHORE) out.push(fromProp(p, 'cenario'));

  // ----------------------------------------------------------- cenario
  const postCount = Math.floor((PIER_END - 60 - (PIER_START - 30)) / 190) + 1;
  for (let i = 0; i < postCount; i++) {
    out.push({
      id: `pier-post-${i}`,
      layer: 'cenario',
      kind: 'sprite',
      sprite: 'props/pier-post-side',
      x: PIER_START - 30 + i * 190,
      y: PIER_Y + 22,
      w: Math.round(184 * aspectOf('props/pier-post-side')),
      h: 184,
      rot: 0,
    });
  }
  out.push({
    id: 'pier-ladder',
    layer: 'cenario',
    kind: 'sprite',
    sprite: 'props/pier-ladder-side',
    x: PIER_START + 280,
    y: PIER_Y + 16,
    w: Math.round(96 * aspectOf('props/pier-ladder-side')),
    h: 96,
    rot: 0,
  });
  out.push({
    id: 'barco-ancorado',
    layer: 'cenario',
    kind: 'sprite',
    sprite: 'props/fishing-boat-idle-side',
    x: PIER_START - 420,
    y: 314,
    w: Math.round(118 * aspectOf('props/fishing-boat-idle-side')),
    h: 118,
    rot: 0,
    anim: 'balanco',
  });
  out.push({
    id: 'treeline',
    layer: 'cenario',
    kind: 'sprite',
    sprite: '',
    x: FOREST_START - 90,
    y: SAND_Y - 216,
    w: WORLD_W - FOREST_START + 190,
    h: 220,
    rot: 0,
    anim: 'treeline',
    locked: true,
  });
  for (const p of BEACH) out.push(fromProp(p, 'cenario'));
  for (const p of MARKET) out.push(fromProp(p, 'cenario'));
  for (const p of CABANA) out.push(fromProp(p, 'cenario'));
  for (const p of FOREST) out.push(fromProp(p, 'cenario'));

  // ---------------------------------------------------------- objetos
  for (const p of PIER_PROPS) out.push(fromProp(p, 'objetos'));
  out.push({
    id: 'vara-de-pesca',
    layer: 'objetos',
    kind: 'sprite',
    sprite: 'props/fishing-rod',
    x: ROD_X,
    y: PIER_Y - 122,
    w: Math.round(128 * aspectOf('props/fishing-rod')),
    h: 128,
    rot: 0,
    flip: true,
    role: 'vara',
  });

  // ----------------------------------------------------- interagiveis
  out.push({
    id: 'area-vara',
    layer: 'interagiveis',
    kind: 'zone',
    zone: 'vara',
    x: ROD_X - 120,
    y: PIER_Y - 145,
    w: 240,
    h: 180,
    rot: 0,
  });
  out.push({
    id: 'area-mercado',
    layer: 'interagiveis',
    kind: 'zone',
    zone: 'mercado',
    x: MARKET_X - 140,
    y: SAND_Y - 205,
    w: 280,
    h: 215,
    rot: 0,
  });

  return out;
}

export function seedScene(): SceneState {
  return { objects: seedObjects(), hidden: [] };
}

// ------------------------------------------------------------------- estado

function load(): SceneState {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return seedScene();
    const parsed = JSON.parse(raw) as Partial<SceneState>;
    if (!parsed || !Array.isArray(parsed.objects) || parsed.objects.length === 0) return seedScene();
    return { objects: parsed.objects as SceneObject[], hidden: parsed.hidden ?? [] };
  } catch {
    return seedScene();
  }
}

let state: SceneState = typeof localStorage === 'undefined' ? seedScene() : load();
const listeners = new Set<() => void>();
let saveTimer: number | undefined;

/**
 * Historico de desfazer.
 *
 * Cada alteracao empilha o estado ANTERIOR em `past`. Arrastar um objeto
 * dispara uma alteracao por quadro do mouse, entao o arrasto inteiro entra num
 * lote (`beginBatch`/`endBatch`): a pilha guarda so o estado de antes de pegar
 * o objeto, e um Ctrl+Z devolve tudo de uma vez.
 */
const HISTORY_MAX = 120;
let past: SceneState[] = [];
let future: SceneState[] = [];
let batching = false;

function persist() {
  if (typeof localStorage === 'undefined') return;
  if (saveTimer !== undefined) clearTimeout(saveTimer);
  saveTimer = window.setTimeout(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
    } catch {
      /* sem espaco: a cena continua valendo em memoria */
    }
  }, 200);
}

function notify() {
  persist();
  for (const l of listeners) l();
}

function set(next: SceneState, record = true) {
  if (record && !batching) {
    past.push(state);
    if (past.length > HISTORY_MAX) past.shift();
    future = [];
  }
  state = next;
  notify();
}

/** Abre um lote: o arrasto inteiro vira um unico passo do desfazer. */
export function beginBatch(): void {
  if (batching) return;
  past.push(state);
  if (past.length > HISTORY_MAX) past.shift();
  future = [];
  batching = true;
}

export function endBatch(): void {
  batching = false;
}

export function undo(): boolean {
  const prev = past.pop();
  if (!prev) return false;
  future.push(state);
  state = prev;
  notify();
  return true;
}

export function redo(): boolean {
  const next = future.pop();
  if (!next) return false;
  past.push(state);
  state = next;
  notify();
  return true;
}

export function canUndo(): boolean {
  return past.length > 0;
}

export function canRedo(): boolean {
  return future.length > 0;
}

export function getScene(): SceneState {
  return state;
}

export function subscribeScene(fn: () => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

export function useScene(): SceneState {
  return useSyncExternalStore(subscribeScene, getScene, getScene);
}

// ------------------------------------------------------------------ acoes

export function updateObject(id: string, patch: Partial<SceneObject>): void {
  set({ ...state, objects: state.objects.map((o) => (o.id === id ? { ...o, ...patch } : o)) });
}

export function removeObject(id: string): void {
  const o = state.objects.find((x) => x.id === id);
  if (!o || o.locked || o.kind === 'zone') return;
  set({ ...state, objects: state.objects.filter((x) => x.id !== id) });
}

export function addSprite(sprite: string, layer: LayerId, x: number, y: number, h = 120): SceneObject {
  const obj: SceneObject = {
    id: `${sprite.split('/').pop()}-${Date.now().toString(36)}`,
    layer,
    kind: 'sprite',
    sprite,
    x: Math.round(x - (h * aspectOf(sprite)) / 2),
    y: Math.round(y - h / 2),
    w: Math.round(h * aspectOf(sprite)),
    h,
    rot: 0,
  };
  set({ ...state, objects: [...state.objects, obj] });
  return obj;
}

export function duplicateObject(id: string): SceneObject | null {
  const o = state.objects.find((x) => x.id === id);
  if (!o) return null;
  const copy: SceneObject = { ...o, id: `${o.id}-copia-${Date.now().toString(36)}`, x: o.x + 40, locked: false };
  set({ ...state, objects: [...state.objects, copy] });
  return copy;
}

export function toggleLock(id: string): void {
  const o = state.objects.find((x) => x.id === id);
  if (!o) return;
  updateObject(id, { locked: !o.locked });
}

export function moveToLayer(id: string, layer: LayerId): void {
  const o = state.objects.find((x) => x.id === id);
  if (!o || o.kind === 'zone') return;
  updateObject(id, { layer });
}

export function toggleLayer(layer: LayerId): void {
  const hidden = state.hidden.includes(layer)
    ? state.hidden.filter((l) => l !== layer)
    : [...state.hidden, layer];
  set({ ...state, hidden }, false);
}

export function resetScene(): void {
  set(seedScene());
}

export function importScene(json: string): boolean {
  try {
    const parsed = JSON.parse(json) as Partial<SceneState>;
    if (!parsed || !Array.isArray(parsed.objects)) return false;
    set({ objects: parsed.objects as SceneObject[], hidden: parsed.hidden ?? [] });
    return true;
  } catch {
    return false;
  }
}

export function exportScene(): string {
  return JSON.stringify(state, null, 2);
}

// -------------------------------------------------------- consultas do jogo

/** Area de interacao de um ponto do mundo, do jeito que o editor deixou. */
export function zoneRect(zone: ZoneId): { x: number; y: number; w: number; h: number } | null {
  const o = state.objects.find((x) => x.kind === 'zone' && x.zone === zone);
  return o ? { x: o.x, y: o.y, w: o.w, h: o.h } : null;
}

/** O jogador esta dentro da area? */
export function inZone(zone: ZoneId, x: number): boolean {
  const r = zoneRect(zone);
  return r ? x >= r.x && x <= r.x + r.w : false;
}

/** Onde esta a vara agora: usado pela camera e pela boia. */
export function rodX(): number {
  const rod = state.objects.find((o) => o.role === 'vara');
  if (rod) return rod.x + rod.w * 0.35;
  const r = zoneRect('vara');
  return r ? r.x + r.w / 2 : ROD_X;
}
