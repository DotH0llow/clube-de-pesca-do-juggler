import { useSyncExternalStore } from 'react';

export const SETTINGS_KEY = 'juggler-fishing/settings/v1';

export interface Settings {
  /** animacoes de cena, boia, ondas e popups */
  animations: boolean;
  /** tremida da tela e da boia quando o peixe morde */
  screenShake: boolean;
  /** textos de ajuda durante a pescaria */
  hints: boolean;
  /** vibracao no celular */
  haptics: boolean;
  /** silencia tudo sem perder os volumes salvos */
  muted: boolean;
  /** 0 a 1 */
  master: number;
  music: number;
  sfx: number;
  /** confirmar antes de gastar Olhos da Hydra */
  confirmEyes: boolean;
}

function prefersReducedMotion(): boolean {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

export function defaultSettings(): Settings {
  return {
    animations: !prefersReducedMotion(),
    screenShake: !prefersReducedMotion(),
    hints: true,
    haptics: true,
    muted: false,
    master: 0.8,
    music: 0.45,
    sfx: 0.75,
    confirmEyes: true,
  };
}

function load(): Settings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return defaultSettings();
    return { ...defaultSettings(), ...(JSON.parse(raw) as Partial<Settings>) };
  } catch {
    return defaultSettings();
  }
}

let settings: Settings = load();
const listeners = new Set<() => void>();
const changeHandlers = new Set<(s: Settings) => void>();

export function getSettings(): Settings {
  return settings;
}

export function subscribeSettings(fn: () => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

/** Callback fora do React (usado pela camada de audio). */
export function onSettingsChange(fn: (s: Settings) => void): () => void {
  changeHandlers.add(fn);
  return () => {
    changeHandlers.delete(fn);
  };
}

export function updateSettings(patch: Partial<Settings>): void {
  settings = { ...settings, ...patch };
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    /* modo privado: mantem so em memoria */
  }
  for (const l of listeners) l();
  for (const h of changeHandlers) h(settings);
}

export function resetSettings(): void {
  updateSettings(defaultSettings());
}

export function useSettings(): Settings {
  return useSyncExternalStore(subscribeSettings, getSettings, getSettings);
}

/** Vibracao curta, respeitando a preferencia do jogador. */
export function buzz(pattern: number | number[] = 12): void {
  if (!settings.haptics) return;
  try {
    navigator.vibrate?.(pattern);
  } catch {
    /* navegador sem suporte */
  }
}
