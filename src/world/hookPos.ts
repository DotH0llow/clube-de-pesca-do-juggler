/**
 * Onde o anzol esta durante a cacada.
 *
 * E um modulo com um objeto mutavel, e nao um estado do React, de proposito:
 * TRES lugares precisam desta posicao a cada quadro - o desenho do anzol, a
 * linha de pesca e a camera - e nenhum deles pode esperar por um render. Passar
 * isso como propriedade obrigaria a re-renderizar o mundo inteiro sessenta
 * vezes por segundo, que e exatamente o que o resto do jogo evita.
 */
export const hookPos = {
  x: 0,
  y: 0,
  /** quanto resta de linha, de 1 a 0 */
  linha: 1,
  /** true enquanto a cacada esta rodando */
  ativo: false,
};

export function setHookAtivo(on: boolean): void {
  hookPos.ativo = on;
}
