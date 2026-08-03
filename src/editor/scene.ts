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
  WATER_Y,
  WORLD_W,
  type Prop,
} from '../world/layout';
import type { LayerId, SceneId, SceneObject, SceneState, ZoneId } from './types';

const KEY = 'juggler-fishing/cena/v3';
const KEY_V2 = 'juggler-fishing/cena/v2';

/** Tamanho de desenho da tela de menu. */
export const MENU_W = 1280;
export const MENU_H = 720;

/**
 * As cenas do jogo em forma de dados.
 *
 * Duas cenas hoje: `mundo` (o cais jogavel) e `menu` (a tela de titulo). As
 * duas usam a MESMA lista de objetos, o MESMO renderizador e o MESMO editor -
 * muda so quem esta ativo.
 *
 * Cada objeto tem uma camada de trabalho (`layer`, a gaveta) e uma
 * profundidade (`depth`, 0 a 10, quem fica na frente). Sao coisas diferentes de
 * proposito: da para ter tralha de OBJETOS atras do cenario e vice-versa.
 */

// ------------------------------------------------------------------ semente

let seq = 0;

/**
 * Onde cada familia de sprite mora, por padrao.
 *
 * Serve para dois usos: montar a semente e reclassificar cena antiga sem perder
 * o que voce ja tinha movido de lugar.
 */
export const SPRITE_HOME: { match: RegExp; layer: LayerId; depth: number }[] = [
  // horizonte: e isso que o BACKGROUND deve conter
  { match: /^sky\/(distant-mountain|distant-island|horizon-haze|sunset-cloud|night-cloud)/, layer: 'fundo', depth: 0 },
  { match: /^bg\//, layer: 'fundo', depth: 0 },
  { match: /^sky\//, layer: 'fundo', depth: 0 },
  // fundo do mar e vida submersa sao OBJETOS, nao background
  { match: /^props\/(cave-entrance|seafloor-|sunken-driftwood|kelp-stalk|aquatic-plant|coral-cluster|light-ray)/, layer: 'objetos', depth: 1 },
  { match: /^marine\//, layer: 'objetos', depth: 1 },
  { match: /^fx\/underwater-/, layer: 'objetos', depth: 1 },
  { match: /^props\/decorative-fish-school/, layer: 'objetos', depth: 1 },
  // estrutura do pier
  { match: /^props\/pier-(post|ladder)/, layer: 'cenario', depth: 4 },
  { match: /^props\/fishing-boat/, layer: 'cenario', depth: 3 },
  // vegetacao e construcao ficam de pe no mapa
  { match: /^nature\//, layer: 'cenario', depth: 3 },
  { match: /^props\/(beach-cabana|fish-market-stall)/, layer: 'cenario', depth: 3 },
  // tralha solta
  { match: /^props\/fishing-rod/, layer: 'objetos', depth: 6 },
  { match: /^props\//, layer: 'objetos', depth: 6 },
  { match: /^trash\//, layer: 'objetos', depth: 6 },
  { match: /^fish\//, layer: 'objetos', depth: 6 },
];

export function homeOf(sprite: string): { layer: LayerId; depth: number } {
  for (const rule of SPRITE_HOME) if (rule.match.test(sprite)) return { layer: rule.layer, depth: rule.depth };
  return { layer: 'objetos', depth: 6 };
}

function fromProp(p: Prop, layer: LayerId, depth: number, under = false): SceneObject {
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
    depth,
    flip: p.flip,
    opacity: p.opacity,
    under,
    anim: p.className,
  };
}

/** Faixa que se repete no horizonte e anda mais devagar que a camera. */
function strip(
  id: string,
  sprite: string,
  y: number,
  h: number,
  parallax: number,
  opacity: number,
): SceneObject {
  return {
    id,
    layer: 'fundo',
    kind: 'strip',
    sprite,
    x: -400,
    y,
    w: 5000,
    h,
    rot: 0,
    depth: 0,
    opacity,
    parallax,
  };
}

function seedMundo(): SceneObject[] {
  seq = 0;
  const out: SceneObject[] = [];

  // ------------------------------------------------- BACKGROUND (horizonte)
  out.push(strip('horizonte-montanha', 'sky/distant-mountain-strip', WATER_Y - 96, 96, 0.22, 0.55));
  out.push(strip('horizonte-ilhas', 'sky/distant-island-strip', WATER_Y - 86, 92, 0.52, 0.85));
  out.push(strip('horizonte-neblina', 'sky/horizon-haze-strip', WATER_Y - 26, 40, 0.52, 0.45));

  // ---------------------------------------------------- OBJETOS submersos
  for (const p of SEAFLOOR) out.push(fromProp(p, 'objetos', 1, true));
  for (const p of UNDERWATER_LIFE) out.push(fromProp(p, 'objetos', 1, true));
  for (const p of SHORE) out.push(fromProp(p, 'objetos', 3));

  // ----------------------------------------------------------- CENARIO
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
      depth: 4,
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
    depth: 4,
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
    depth: 3,
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
    depth: 3,
    anim: 'treeline',
    locked: true,
  });
  for (const p of BEACH) out.push(fromProp(p, 'cenario', 3));
  for (const p of MARKET) out.push(fromProp(p, 'cenario', 3));
  for (const p of CABANA) out.push(fromProp(p, 'cenario', 3));
  for (const p of FOREST) out.push(fromProp(p, 'cenario', 3));

  // ---------------------------------------------------------- OBJETOS
  for (const p of PIER_PROPS) out.push(fromProp(p, 'objetos', 6));
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
    depth: 6,
    flip: true,
    role: 'vara',
  });

  // ----------------------------------------------------- INTERAGIVEIS
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
    depth: 9,
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
    depth: 9,
  });

  return out;
}

/**
 * A tela de titulo.
 *
 * Antes era HTML escrito na mao, com posicao em porcentagem: bonito, mas nao
 * dava para mexer sem abrir o codigo. Agora e cena de verdade, com os mesmos
 * objetos e o mesmo editor do mundo. O ceu, o mar e a espuma continuam sendo
 * estrutura (sao gradiente e faixa animada, nao sprite).
 */
const MENU_SEA_Y = 430;
const MENU_DECK_Y = 596;

function menuSprite(
  id: string,
  sprite: string,
  x: number,
  baseY: number,
  h: number,
  depth: number,
  extra: Partial<SceneObject> = {},
): SceneObject {
  return {
    id,
    layer: 'cenario',
    kind: 'sprite',
    sprite,
    x,
    y: baseY - h,
    w: Math.round(h * aspectOf(sprite)),
    h,
    rot: 0,
    depth,
    ...extra,
  };
}

function seedMenu(): SceneObject[] {
  const out: SceneObject[] = [];

  out.push(strip('menu-montanha', 'sky/distant-mountain-strip', MENU_SEA_Y - 104, 104, 0.22, 0.5));
  out.push(strip('menu-ilhas', 'sky/distant-island-strip', MENU_SEA_Y - 92, 96, 0.52, 0.8));
  out.push(strip('menu-neblina', 'sky/horizon-haze-strip', MENU_SEA_Y - 22, 40, 0.52, 0.45));
  for (const s of out) {
    s.x = 0;
    s.w = MENU_W;
  }

  out.push(menuSprite('menu-barco', 'props/fishing-boat-idle-side', 120, MENU_SEA_Y + 58, 96, 3, { anim: 'balanco' }));

  // as estacas do deck, em primeiro plano
  const posts = [40, 232, 424, 616, 808, 1000, 1192];
  posts.forEach((x, i) => {
    out.push(menuSprite(`menu-estaca-${i}`, 'props/pier-post-side', x, MENU_H + 40, 190, 8));
  });

  out.push({
    id: 'menu-deck',
    layer: 'cenario',
    kind: 'strip',
    sprite: 'props/pier-board-side',
    x: 0,
    y: MENU_DECK_Y,
    w: MENU_W,
    h: 34,
    rot: 0,
    depth: 9,
    parallax: 1,
  });

  out.push(menuSprite('menu-lanterna', 'props/pier-lantern', 300, MENU_DECK_Y + 4, 176, 9));
  out.push(menuSprite('menu-rede', 'props/capture-net', 560, MENU_DECK_Y + 4, 112, 9));
  out.push(menuSprite('menu-barril', 'props/barrel', 700, MENU_DECK_Y + 4, 96, 9));
  out.push(menuSprite('menu-cesto', 'props/fish-basket', 830, MENU_DECK_Y + 4, 84, 9));

  out.push(menuSprite('menu-coqueiro', 'nature/coconut-palm', -40, MENU_H + 30, 470, 10, { flip: true }));
  out.push(menuSprite('menu-palmeira', 'nature/royal-palm', 1130, MENU_H + 30, 500, 10));

  return out;
}

export function seedScene(id: SceneId = 'mundo'): SceneState {
  return { objects: id === 'menu' ? seedMenu() : seedMundo(), hidden: [] };
}

// ------------------------------------------------------------------- estado

type Book = Record<SceneId, SceneState>;

function seedBook(): Book {
  return { mundo: seedScene('mundo'), menu: seedScene('menu') };
}

/**
 * Traz a cena da versao anterior.
 *
 * A v2 nao tinha `depth` nem as faixas do horizonte como objeto. Em vez de
 * jogar fora o que voce ja arrumou, cada objeto salvo ganha camada e
 * profundidade pela familia do sprite e as faixas novas entram na frente.
 */
function migrateV2(old: SceneState): SceneState {
  const objects = old.objects.map((o) => {
    if (o.kind === 'zone') return { ...o, depth: o.depth ?? 9 };
    const home = homeOf(o.sprite ?? '');
    return {
      ...o,
      layer: o.sprite ? home.layer : o.layer,
      depth: o.depth ?? (o.sprite ? home.depth : 3),
    };
  });
  const strips = seedMundo().filter((o) => o.kind === 'strip');
  return { objects: [...strips, ...objects], hidden: old.hidden ?? [] };
}

function load(): Book {
  const book = seedBook();
  if (typeof localStorage === 'undefined') return book;
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<Book>;
      for (const id of ['mundo', 'menu'] as SceneId[]) {
        const s = parsed[id];
        if (s && Array.isArray(s.objects) && s.objects.length > 0) {
          book[id] = { objects: s.objects, hidden: s.hidden ?? [] };
        }
      }
      return book;
    }
    const old = localStorage.getItem(KEY_V2);
    if (old) {
      const parsed = JSON.parse(old) as SceneState;
      if (parsed && Array.isArray(parsed.objects) && parsed.objects.length > 0) {
        book.mundo = migrateV2(parsed);
      }
    }
  } catch {
    /* save corrompido: volta para a semente */
  }
  return book;
}

let book: Book = load();
let active: SceneId = 'mundo';
const listeners = new Set<() => void>();
let saveTimer: number | undefined;

/**
 * Historico de desfazer, um por cena.
 *
 * Cada alteracao empilha o estado ANTERIOR. Arrastar um objeto dispara uma
 * alteracao por quadro do mouse, entao o arrasto inteiro entra num lote
 * (`beginBatch`/`endBatch`).
 */
const HISTORY_MAX = 120;
const past: Record<SceneId, SceneState[]> = { mundo: [], menu: [] };
const future: Record<SceneId, SceneState[]> = { mundo: [], menu: [] };
let batching = false;

function persist() {
  if (typeof localStorage === 'undefined') return;
  if (saveTimer !== undefined) clearTimeout(saveTimer);
  saveTimer = window.setTimeout(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(book));
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
    past[active].push(book[active]);
    if (past[active].length > HISTORY_MAX) past[active].shift();
    future[active] = [];
  }
  book = { ...book, [active]: next };
  notify();
}

export function activeScene(): SceneId {
  return active;
}

export function setActiveScene(id: SceneId): void {
  if (active === id) return;
  active = id;
  notify();
}

/** Abre um lote: o arrasto inteiro vira um unico passo do desfazer. */
export function beginBatch(): void {
  if (batching) return;
  past[active].push(book[active]);
  if (past[active].length > HISTORY_MAX) past[active].shift();
  future[active] = [];
  batching = true;
}

export function endBatch(): void {
  batching = false;
}

export function undo(): boolean {
  const prev = past[active].pop();
  if (!prev) return false;
  future[active].push(book[active]);
  book = { ...book, [active]: prev };
  notify();
  return true;
}

export function redo(): boolean {
  const next = future[active].pop();
  if (!next) return false;
  past[active].push(book[active]);
  book = { ...book, [active]: next };
  notify();
  return true;
}

export function canUndo(): boolean {
  return past[active].length > 0;
}

export function canRedo(): boolean {
  return future[active].length > 0;
}

export function getScene(id: SceneId = active): SceneState {
  return book[id];
}

export function subscribeScene(fn: () => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

export function useScene(id?: SceneId): SceneState {
  const read = () => book[id ?? active];
  return useSyncExternalStore(subscribeScene, read, read);
}

/** Qual cena o editor esta editando agora. */
export function useActiveScene(): SceneId {
  return useSyncExternalStore(subscribeScene, activeScene, activeScene);
}

// ------------------------------------------------------------------ acoes

export function updateObject(id: string, patch: Partial<SceneObject>): void {
  const s = book[active];
  set({ ...s, objects: s.objects.map((o) => (o.id === id ? { ...o, ...patch } : o)) });
}

export function removeObject(id: string): void {
  const s = book[active];
  const o = s.objects.find((x) => x.id === id);
  if (!o || o.locked || o.kind === 'zone') return;
  set({ ...s, objects: s.objects.filter((x) => x.id !== id) });
}

export function addSprite(sprite: string, layer: LayerId, x: number, y: number, h = 120): SceneObject {
  const s = book[active];
  const home = homeOf(sprite);
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
    depth: home.depth,
  };
  set({ ...s, objects: [...s.objects, obj] });
  return obj;
}

export function duplicateObject(id: string): SceneObject | null {
  const s = book[active];
  const o = s.objects.find((x) => x.id === id);
  if (!o) return null;
  const copy: SceneObject = { ...o, id: `${o.id}-copia-${Date.now().toString(36)}`, x: o.x + 40, locked: false };
  set({ ...s, objects: [...s.objects, copy] });
  return copy;
}

export function toggleLock(id: string): void {
  const o = book[active].objects.find((x) => x.id === id);
  if (!o) return;
  updateObject(id, { locked: !o.locked });
}

export function moveToLayer(id: string, layer: LayerId): void {
  const o = book[active].objects.find((x) => x.id === id);
  if (!o || o.kind === 'zone') return;
  updateObject(id, { layer });
}

export function toggleLayer(layer: LayerId): void {
  const s = book[active];
  const hidden = s.hidden.includes(layer)
    ? s.hidden.filter((l) => l !== layer)
    : [...s.hidden, layer];
  set({ ...s, hidden }, false);
}

/** Manda o objeto para o fim (ou o comeco) da lista, para desempatar profundidade igual. */
export function reorder(id: string, toFront: boolean): void {
  const s = book[active];
  const o = s.objects.find((x) => x.id === id);
  if (!o) return;
  const rest = s.objects.filter((x) => x.id !== id);
  set({ ...s, objects: toFront ? [...rest, o] : [o, ...rest] });
}

export function resetScene(): void {
  set(seedScene(active));
}

export function importScene(json: string): boolean {
  try {
    const parsed = JSON.parse(json) as Partial<SceneState>;
    if (!parsed || !Array.isArray(parsed.objects)) return false;
    set({
      objects: (parsed.objects as SceneObject[]).map((o) => ({ ...o, depth: o.depth ?? 5 })),
      hidden: parsed.hidden ?? [],
    });
    return true;
  } catch {
    return false;
  }
}

export function exportScene(): string {
  return JSON.stringify(book[active], null, 2);
}

// -------------------------------------------------------- consultas do jogo

/** Area de interacao de um ponto do mundo, do jeito que o editor deixou. */
export function zoneRect(zone: ZoneId): { x: number; y: number; w: number; h: number } | null {
  const o = book.mundo.objects.find((x) => x.kind === 'zone' && x.zone === zone);
  return o ? { x: o.x, y: o.y, w: o.w, h: o.h } : null;
}

/** O jogador esta dentro da area? */
export function inZone(zone: ZoneId, x: number): boolean {
  const r = zoneRect(zone);
  return r ? x >= r.x && x <= r.x + r.w : false;
}

/** Onde esta a vara agora: usado pela camera e pela boia. */
export function rodX(): number {
  const rod = book.mundo.objects.find((o) => o.role === 'vara');
  if (rod) return rod.x + rod.w * 0.35;
  const r = zoneRect('vara');
  return r ? r.x + r.w / 2 : ROD_X;
}
