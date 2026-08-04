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
  /*
   * As POSES SOLTAS - `angry`, `crying`, `sit-back`, `sit-front`,
   * `sit-side-right`, `sit-three-quarter` - nao vem do pacote de animacao:
   * entram por `scripts/import-poses.py`, que ACRESCENTA uma linha por arquivo
   * em vez de reescrever a tabela. Rodar o `import-character.py` de novo nao
   * as apaga daqui, mas tambem nao as regera - a arte de origem delas mora nos
   * zips, e nao na pasta de animacao.
   */
  'juggler/angry': 1,
  'juggler/back-idle': 1,
  'juggler/crying': 1,
  'juggler/fish-left': 6,
  'juggler/fish-right': 6,
  'juggler/jump-left': 2,
  'juggler/jump-right': 2,
  'juggler/run-left': 4,
  'juggler/run-right': 4,
  'juggler/side-idle-left': 1,
  'juggler/side-idle-right': 1,
  'juggler/sit-back': 1,
  'juggler/sit-front': 1,
  'juggler/sit-left': 1,
  'juggler/sit-right': 1,
  'juggler/sit-side-right': 1,
  'juggler/sit-three-quarter': 1,
  'juggler/walk-left': 4,
  'juggler/walk-right': 4,
};
