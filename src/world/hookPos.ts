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
  targetX: 0,
  targetY: 0,
  sonarUntil: 0,
  sonarReadyAt: 0,
  maxLine: 1,
  /** quanto resta de linha, de 1 a 0 */
  linha: 1,
  /** true enquanto a cacada esta rodando */
  ativo: false,
};

/** Shared touch input for the dive; keyboard input stays in HookHunt. */
export const huntInput = { left: false, right: false, up: false, down: false };

export function triggerSonar(): boolean {
  const now = performance.now();
  if (!hookPos.ativo || now < hookPos.sonarReadyAt) return false;
  hookPos.sonarUntil = now + 2800;
  hookPos.sonarReadyAt = now + 5200;
  return true;
}

export function setHookAtivo(on: boolean): void {
  hookPos.ativo = on;
}
