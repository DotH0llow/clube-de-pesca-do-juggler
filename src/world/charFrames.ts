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

/** quantos quadros cada clipe tem */
export const CLIP_FRAMES: Record<string, number> = {
  'back-idle': 1,
  'fish-left': 6,
  'fish-right': 6,
  'jump-left': 2,
  'jump-right': 2,
  'run-left': 4,
  'run-right': 4,
  'side-idle-left': 1,
  'side-idle-right': 1,
  'sit-left': 1,
  'sit-right': 1,
  'walk-left': 4,
  'walk-right': 4,
};
