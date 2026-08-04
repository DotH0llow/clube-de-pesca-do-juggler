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
  /**
   * Camera livre: o Juggler fica plantado onde estava e a tela passa a andar
   * com WASD, com as setas e com o mouse encostado na borda. Serve para olhar o
   * mapa inteiro sem ter que atravessar o cais a pe.
   */
  freeCam: boolean;
  /**
   * O RELAMPAGO SOB DEMANDA.
   *
   * O raio da tempestade cai de 17 em 17 segundos e acende por dois quadros -
   * ou seja, quem quiser olhar como ele ficou espera, em media, oito segundos e
   * meio, e pisca antes de conseguir olhar. E isso multiplicado por cada
   * ajuste.
   *
   * O numero e um CONTADOR, e nao um `true`: React nao re-renderiza quando o
   * valor novo e igual ao antigo, entao um booleano so relampejaria uma vez.
   * Cada disparo incrementa, e o componente do ceu remonta o raio por causa da
   * chave.
   */
  bolt: number;
}

let flags: DevFlags = { rain: null, freeCam: false, bolt: 0 };
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

/**
 * Dispara um relampago agora.
 *
 * Ele cai independente da hora do dia e de estar chovendo: quem aperta o botao
 * quer VER o raio, e exigir que ja seja tarde de temporal para isso e o mesmo
 * problema que o cheat veio resolver.
 */
export function fireBolt(): void {
  flags = { ...flags, bolt: flags.bolt + 1 };
  notify();
}

export function toggleFreeCam(): void {
  flags = { ...flags, freeCam: !flags.freeCam };
  notify();
}

export function setFreeCam(on: boolean): void {
  if (flags.freeCam === on) return;
  flags = { ...flags, freeCam: on };
  notify();
}
