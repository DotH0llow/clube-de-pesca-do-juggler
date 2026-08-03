/**
 * GERADO por scripts/measure-character.py - nao edite na mao os numeros;
 * rode o script de novo depois de trocar a arte.
 *
 * dx/dy estao em pixels do canvas original do quadro. O renderizador
 * multiplica pelo fator de escala do sprite antes de aplicar.
 */

export interface FrameFix {
  /** deslocamento horizontal para o quadril cair no eixo do jogador */
  dx: number;
  /** deslocamento vertical para o pe cair no chao */
  dy: number;
}

export const CHAR_CANVAS = { w: 256, h: 256 };

/**
 * Compensacao de tamanho enquanto a arte nao estiver padronizada.
 * Referencia: side-idle-right. Com quadros no mesmo tamanho, tudo vira 1.
 */
export const ANIM_SCALE: Record<string, number> = {
  'back-idle': 1.000,
  'fish-no-rod-left': 1.000,
  'fish-no-rod-right': 1.000,
  'jump-left': 1.000,
  'jump-right': 1.000,
  'run-left': 1.000,
  'run-right': 1.000,
  'side-idle-left': 1.000,
  'side-idle-right': 1.000,
  'sit-left': 1.000,
  'sit-right': 1.000,
  'walk-left': 1.000,
  'walk-right': 1.000,
};

export const FRAME_FIX: Record<string, FrameFix[]> = {
  'back-idle': [{ dx: 6.0, dy: -35 }, { dx: 2.5, dy: -36 }, { dx: 1.5, dy: -21 }, { dx: 7.0, dy: -28 }],
  'fish-no-rod-left': [{ dx: 4.5, dy: -28 }, { dx: 5.5, dy: -37 }, { dx: 9.5, dy: -33 }, { dx: 2.0, dy: -29 }, { dx: 5.0, dy: -27 }, { dx: 5.5, dy: -29 }],
  'fish-no-rod-right': [{ dx: -3.5, dy: -28 }, { dx: -4.5, dy: -37 }, { dx: -8.5, dy: -33 }, { dx: -1.0, dy: -29 }, { dx: -4.0, dy: -27 }, { dx: -4.5, dy: -29 }],
  'jump-left': [{ dx: -12.0, dy: -43.0 }, { dx: -4.0, dy: -58.5 }, { dx: -4.5, dy: -55.5 }, { dx: 2.5, dy: -63.5 }, { dx: -1.5, dy: -65.5 }, { dx: -10.0, dy: -43.5 }],
  'jump-right': [{ dx: 13.0, dy: -43.0 }, { dx: 5.0, dy: -58.5 }, { dx: 5.5, dy: -55.5 }, { dx: -1.5, dy: -63.5 }, { dx: 2.5, dy: -65.5 }, { dx: 11.0, dy: -43.5 }],
  'run-left': [{ dx: 2.5, dy: -43 }, { dx: 0.0, dy: -37 }, { dx: 4.0, dy: -35 }, { dx: 3.0, dy: -38 }, { dx: 6.0, dy: -40 }, { dx: 5.5, dy: -26 }],
  'run-right': [{ dx: -1.5, dy: -43 }, { dx: 1.0, dy: -37 }, { dx: -3.0, dy: -35 }, { dx: -2.0, dy: -38 }, { dx: -5.0, dy: -40 }, { dx: -4.5, dy: -26 }],
  'side-idle-left': [{ dx: -2.0, dy: -28 }, { dx: -1.0, dy: -30 }, { dx: -3.0, dy: -31 }, { dx: 2.5, dy: -34 }],
  'side-idle-right': [{ dx: 3.0, dy: -28 }, { dx: 2.0, dy: -30 }, { dx: 4.0, dy: -31 }, { dx: -1.5, dy: -34 }],
  'sit-left': [{ dx: -14.5, dy: -27 }, { dx: -9.0, dy: -33 }, { dx: -13.0, dy: -40 }, { dx: -6.5, dy: -42 }],
  'sit-right': [{ dx: 15.5, dy: -27 }, { dx: 10.0, dy: -33 }, { dx: 14.0, dy: -40 }, { dx: 7.5, dy: -42 }],
  'walk-left': [{ dx: -1.0, dy: -31 }, { dx: -2.5, dy: -29 }, { dx: 3.0, dy: -29 }, { dx: 6.0, dy: -31 }, { dx: -1.5, dy: -33 }, { dx: -6.5, dy: -31 }],
  'walk-right': [{ dx: 2.0, dy: -31 }, { dx: 3.5, dy: -29 }, { dx: -2.0, dy: -29 }, { dx: -5.0, dy: -31 }, { dx: 2.5, dy: -33 }, { dx: 7.5, dy: -31 }],
};
