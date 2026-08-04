/**
 * GERADO por scripts/import-character.py - nao edite na mao.
 *
 * Todo quadro ja sai do importador alinhado pelo quadril e pelo pe dentro
 * de um canvas unico, entao nao existe mais tabela de correcao por quadro:
 * basta levar a ancora do canvas ate o ponto onde o renderizador encosta o
 * sprite (centro embaixo).
 */

/** tamanho do arquivo de cada quadro, em px */
export const CHAR_CANVAS = { w: 522, h: 564 };

/** altura do quadro inteiro, em unidades de mundo */
export const CHAR_FRAME_H = 352.5;

/**
 * Deslocamento do quadro, em px do canvas, para o quadril cair no eixo do
 * jogador e o pe encostar no chao.
 */
export const CHAR_ANCHOR = { dx: 0.0, dy: -132.0 };

/**
 * Quantos quadros cada clipe tem, POR PERSONAGEM.
 *
 * A chave e `personagem/clipe`, e nao mais so `clipe`. A arte mora em
 * `src/assets/game/char/<personagem>/<clipe>/00.webp`, entao acrescentar um
 * personagem e soltar uma pasta - ninguem edita lista aqui.
 */
export const CLIP_FRAMES: Record<string, number> = {
  'juggler/back-idle': 1,
  'juggler/fish-left': 6,
  'juggler/fish-right': 6,
  'juggler/jump-left': 2,
  'juggler/jump-right': 2,
  'juggler/run-left': 4,
  'juggler/run-right': 4,
  'juggler/side-idle-left': 1,
  'juggler/side-idle-right': 1,
  'juggler/sit-left': 1,
  'juggler/sit-right': 1,
  'juggler/walk-left': 4,
  'juggler/walk-right': 4,
};
