import { useSyncExternalStore } from 'react';

/**
 * Interruptores de teste.
 *
 * Coisas que o jogo normalmente decide sozinho (a chuva, por exemplo, so cai na
 * tarde de temporal) e que dao muito trabalho para reproduzir quando voce so
 * quer olhar como ficou. Nada disso e salvo: some ao recarregar, de proposito.
 */
export interface DevFlags {
  /** null = a fase do dia manda; true/false = voce manda */
  rain: boolean | null;
}

let flags: DevFlags = { rain: null };
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

export function getDevFlags(): DevFlags {
  return flags;
}

export function useDevFlags(): DevFlags {
  return useSyncExternalStore(subscribe, getDevFlags, getDevFlags);
}

/** Passa por: automatico -> chovendo -> seco -> automatico. */
export function cycleRain(): void {
  flags = { ...flags, rain: flags.rain === null ? true : flags.rain ? false : null };
  notify();
}

export const RAIN_LABEL: Record<string, string> = {
  auto: 'CHUVA: AUTOMÁTICA',
  on: 'CHUVA: LIGADA',
  off: 'CHUVA: DESLIGADA',
};

export function rainMode(f: DevFlags): 'auto' | 'on' | 'off' {
  return f.rain === null ? 'auto' : f.rain ? 'on' : 'off';
}
