/**
 * O CHÃO ANDÁVEL, em forma de dados.
 *
 * Era `groundAt` no `layout.ts`: três linhas de `if` sobre `pierY`, `sandY` e
 * um comprimento de rampa. Funcionava e não dava para mexer - abrir um buraco
 * no meio do deck, pôr um degrau na praia ou encurtar a rampa exigia abrir o
 * código, e o editor não tinha o que mostrar. Agora cada trecho de piso é uma
 * CAIXA na cena, da mesma família das paredes e das áreas de ação: nasce, se
 * arrasta, se estica, se corta em duas e se apaga.
 *
 * -------------------------------------------------------------- por que aqui
 *
 * Este arquivo não importa nada. É de propósito: o `layout.ts` precisa saber a
 * altura do chão e a cena (`editor/scene.ts`) precisa do `layout.ts` para se
 * semear. Se o `layout` fosse perguntar direto para a cena, os dois módulos se
 * importariam em círculo. Aqui a cena EMPURRA a lista quando ela muda
 * (`setPisos`) e o `layout` só lê - ninguém importa ninguém.
 */

export interface Piso {
  /** borda esquerda da caixa, em unidades de mundo */
  x: number;
  w: number;
  /** altura do piso na borda ESQUERDA (o topo da caixa) */
  y: number;
  /**
   * Quanto o piso desce da esquerda para a direita, em unidades.
   *
   * 0 é um piso plano. Positivo desce para a direita (a rampa que sai do deck
   * para a areia), negativo sobe. É isto que permite ter rampa sem inventar um
   * tipo de objeto só para ela.
   */
  queda: number;
}

let pisos: Piso[] = [];

/** A cena chama isto sempre que a lista de objetos muda. */
export function setPisos(list: Piso[]): void {
  pisos = list;
}

export function getPisos(): Piso[] {
  return pisos;
}

/**
 * A altura do chão em `x`, ou `null` se ali não há piso nenhum.
 *
 * Quando duas caixas se sobrepõem ganha a MAIS ALTA. É a regra que faz um
 * estrado colocado em cima do deck virar um degrau em vez de um buraco, e é
 * também a que mantém a emenda deck/rampa limpa: nos poucos pixels em que as
 * duas se encostam, o Juggler anda na de cima e desce quando ela acaba.
 */
export function pisoAt(x: number): number | null {
  let melhor: number | null = null;
  for (const p of pisos) {
    if (x < p.x || x > p.x + p.w) continue;
    const t = p.w <= 0 ? 0 : (x - p.x) / p.w;
    const y = p.y + p.queda * t;
    if (melhor === null || y < melhor) melhor = y;
  }
  return melhor;
}

/** Existe piso em `x`? Usado pela chuva, que só respinga onde dá para pisar. */
export function temPiso(x: number): boolean {
  return pisoAt(x) !== null;
}

/**
 * A faixa que os pisos ocupam, da borda esquerda do primeiro à direita do
 * último. A chuva sorteia os respingos dentro dela.
 */
export function faixaDosPisos(): { x0: number; x1: number } | null {
  if (pisos.length === 0) return null;
  let x0 = Infinity;
  let x1 = -Infinity;
  for (const p of pisos) {
    x0 = Math.min(x0, p.x);
    x1 = Math.max(x1, p.x + p.w);
  }
  return { x0, x1 };
}
