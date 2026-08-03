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

export const CHAR_CANVAS = { w: 113, h: 170 };

/**
 * Compensacao de tamanho enquanto a arte nao estiver padronizada.
 * Referencia: side-idle-right. Com quadros no mesmo tamanho, tudo vira 1.
 */
export const ANIM_SCALE: Record<string, number> = {
  'back-idle': 0.880,
  'fish-no-rod-left': 1.191,
  'fish-no-rod-right': 1.192,
  'jump-left': 1.426,
  'jump-right': 1.426,
  'run-left': 1.272,
  'run-right': 1.272,
  'side-idle-left': 1.000,
  'side-idle-right': 1.000,
  'sit-left': 1.050,
  'sit-right': 1.050,
  'walk-left': 1.211,
  'walk-right': 1.211,
};

export const FRAME_FIX: Record<string, FrameFix[]> = {
  'back-idle': [{ dx: -4.0, dy: -2 }, { dx: 5.0, dy: -2 }, { dx: 4.0, dy: -2 }, { dx: 9.0, dy: -2 }],
  'fish-no-rod-left': [{ dx: 3.5, dy: -16 }, { dx: 2.5, dy: -16 }, { dx: 2.0, dy: -16 }, { dx: 9.0, dy: -16 }, { dx: 9.5, dy: -16 }, { dx: 4.5, dy: -16 }],
  'fish-no-rod-right': [{ dx: -2.5, dy: -16 }, { dx: -1.0, dy: -16 }, { dx: -0.5, dy: -16 }, { dx: -8.0, dy: -16 }, { dx: -8.0, dy: -16 }, { dx: -3.0, dy: -16 }],
  'jump-left': [{ dx: 3.0, dy: -15.0 }, { dx: 7.0, dy: -39.0 }, { dx: 4.5, dy: -55.5 }, { dx: 1.0, dy: -76.0 }, { dx: -2.0, dy: -44.5 }, { dx: -6.0, dy: -11.5 }],
  'jump-right': [{ dx: -1.5, dy: -15.0 }, { dx: -5.5, dy: -39.0 }, { dx: -3.5, dy: -55.5 }, { dx: 0.0, dy: -76.0 }, { dx: 3.5, dy: -44.5 }, { dx: 7.0, dy: -11.5 }],
  'run-left': [{ dx: 10.5, dy: -28 }, { dx: 10.83, dy: -26 }, { dx: 11.64, dy: -38 }, { dx: 0.68, dy: -26 }, { dx: 1.5, dy: -25 }, { dx: 5.5, dy: -26 }],
  'run-right': [{ dx: -9.0, dy: -28 }, { dx: -8.5, dy: -26 }, { dx: -9.24, dy: -38 }, { dx: 0.75, dy: -26 }, { dx: -0.5, dy: -25 }, { dx: -3.5, dy: -26 }],
  'side-idle-left': [{ dx: 15.5, dy: 0 }, { dx: 2.5, dy: 0 }, { dx: -8.0, dy: 0 }, { dx: -22.0, dy: 0 }],
  'side-idle-right': [{ dx: -14.5, dy: 0 }, { dx: -1.5, dy: 0 }, { dx: 9.0, dy: 0 }, { dx: 23.0, dy: 0 }],
  'sit-left': [{ dx: -7.0, dy: -16 }, { dx: -11.5, dy: -17 }, { dx: -22.5, dy: -16 }, { dx: -22.5, dy: -16 }],
  'sit-right': [{ dx: 8.0, dy: -16 }, { dx: 12.5, dy: -17 }, { dx: 23.5, dy: -16 }, { dx: 23.5, dy: -16 }],
  'walk-left': [{ dx: 5.0, dy: -21 }, { dx: -6.0, dy: -19 }, { dx: -6.0, dy: -20 }, { dx: -10.0, dy: -19 }, { dx: -19.5, dy: -19 }, { dx: -11.5, dy: -20 }],
  'walk-right': [{ dx: -4.0, dy: -21 }, { dx: 7.0, dy: -19 }, { dx: 8.0, dy: -20 }, { dx: 11.5, dy: -19 }, { dx: 20.5, dy: -19 }, { dx: 13.0, dy: -20 }],
};
