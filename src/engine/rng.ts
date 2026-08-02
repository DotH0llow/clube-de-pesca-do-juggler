/** Utilitarios de sorteio. Isolados aqui para ficarem faceis de testar/trocar. */

export function randFloat(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

export function randInt(min: number, max: number): number {
  return Math.floor(randFloat(min, max + 1));
}

export function pick<T>(list: readonly T[]): T {
  return list[Math.floor(Math.random() * list.length)];
}

export function chance(p: number): boolean {
  return Math.random() < p;
}

/**
 * Sorteio ponderado sobre um mapa chave -> peso.
 * Pesos <= 0 sao ignorados. Retorna a primeira chave se tudo zerar.
 */
export function weightedPick<K extends string>(weights: Record<K, number>): K {
  const keys = Object.keys(weights) as K[];
  let total = 0;
  for (const k of keys) total += Math.max(0, weights[k]);
  if (total <= 0) return keys[0];

  let roll = Math.random() * total;
  for (const k of keys) {
    const w = Math.max(0, weights[k]);
    if (roll < w) return k;
    roll -= w;
  }
  return keys[keys.length - 1];
}

/**
 * Curva enviesada para baixo: a maioria dos peixes fica no tamanho pequeno/medio
 * e os gigantes sao raros dentro da propria especie.
 */
export function skewedRoll(bias = 2.2): number {
  return Math.pow(Math.random(), bias);
}

export function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}

export function roundTo(v: number, decimals: number): number {
  const f = Math.pow(10, decimals);
  return Math.round(v * f) / f;
}
