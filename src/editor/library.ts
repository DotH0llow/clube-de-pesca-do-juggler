import { useSyncExternalStore } from 'react';
import { ASSET_LIST } from '../assets/dims';

/**
 * Organizacao da biblioteca do editor.
 *
 * A pasta de verdade continua sendo a do disco (`assets/game/<pasta>/`) - isso
 * aqui e so como VOCE quer ver: quais pastas abertas, em que ordem, e para onde
 * arrastou cada asset. Nada disso mexe em arquivo; e uma etiqueta por cima.
 *
 * Motivo: a lista crua tem umas 250 imagens em 10 pastas fixas, e montar um
 * cenario significa pescar sempre os mesmos vinte assets no meio disso.
 */

const KEY = 'juggler-fishing/biblioteca/v1';

export interface LibraryState {
  /** ordem das pastas na tela */
  order: string[];
  /** pastas fechadas (o padrao e aberta) */
  closed: string[];
  /** asset -> pasta escolhida na mao (sobrepoe a pasta do disco) */
  moved: Record<string, string>;
  /** pastas criadas no editor, que nao existem no disco */
  custom: string[];
}

/** Pasta natural de um asset: o primeiro pedaco do caminho. */
export function diskFolder(path: string): string {
  const i = path.indexOf('/');
  return i < 0 ? 'geral' : path.slice(0, i);
}

function seed(): LibraryState {
  const folders = [...new Set(ASSET_LIST.map(diskFolder))].sort((a, b) => a.localeCompare(b));
  return { order: folders, closed: folders.filter((f) => f !== 'props'), moved: {}, custom: [] };
}

function load(): LibraryState {
  const base = seed();
  if (typeof localStorage === 'undefined') return base;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return base;
    const p = JSON.parse(raw) as Partial<LibraryState>;
    const custom = p.custom ?? [];
    const known = [...new Set([...base.order, ...custom])];
    // pasta que sumiu do disco cai fora; pasta nova entra no fim
    const order = [
      ...(p.order ?? []).filter((f) => known.includes(f)),
      ...known.filter((f) => !(p.order ?? []).includes(f)),
    ];
    return { order, closed: p.closed ?? base.closed, moved: p.moved ?? {}, custom };
  } catch {
    return base;
  }
}

let state: LibraryState = load();
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

export function getLibrary(): LibraryState {
  return state;
}

export function useLibraryState(): LibraryState {
  return useSyncExternalStore(subscribe, getLibrary, getLibrary);
}

/** Pastas na ordem escolhida, cada uma com os assets que caem nela. */
export function foldersOf(lib: LibraryState): { name: string; items: string[]; open: boolean }[] {
  const bag = new Map<string, string[]>();
  for (const name of lib.order) bag.set(name, []);
  for (const path of ASSET_LIST) {
    const folder = lib.moved[path] ?? diskFolder(path);
    if (!bag.has(folder)) bag.set(folder, []);
    bag.get(folder)!.push(path);
  }
  return lib.order
    .filter((name) => bag.has(name))
    .map((name) => ({ name, items: bag.get(name)!, open: !lib.closed.includes(name) }));
}

export function toggleFolder(name: string): void {
  state = {
    ...state,
    closed: state.closed.includes(name)
      ? state.closed.filter((f) => f !== name)
      : [...state.closed, name],
  };
  notify();
}

export function openOnly(name: string): void {
  state = { ...state, closed: state.order.filter((f) => f !== name) };
  notify();
}

/** Move a pasta `name` para a posicao de `before` (arrastar e soltar). */
export function moveFolder(name: string, before: string): void {
  if (name === before) return;
  const rest = state.order.filter((f) => f !== name);
  const at = rest.indexOf(before);
  if (at < 0) return;
  state = { ...state, order: [...rest.slice(0, at), name, ...rest.slice(at)] };
  notify();
}

/** Refila um asset em outra pasta. Nao toca no arquivo, so na etiqueta. */
export function moveAsset(path: string, folder: string): void {
  const moved = { ...state.moved };
  if (folder === diskFolder(path)) delete moved[path];
  else moved[path] = folder;
  state = { ...state, moved };
  notify();
}

export function addFolder(name: string): void {
  const clean = name.trim().toLowerCase().replace(/[^a-z0-9-]+/g, '-');
  if (!clean || state.order.includes(clean)) return;
  state = { ...state, order: [...state.order, clean], custom: [...state.custom, clean] };
  notify();
}

export function removeFolder(name: string): void {
  if (!state.custom.includes(name)) return;
  const moved = { ...state.moved };
  for (const [path, folder] of Object.entries(moved)) if (folder === name) delete moved[path];
  state = {
    ...state,
    order: state.order.filter((f) => f !== name),
    custom: state.custom.filter((f) => f !== name),
    moved,
  };
  notify();
}

export function resetLibrary(): void {
  state = seed();
  notify();
}
