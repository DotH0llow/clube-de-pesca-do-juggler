/**
 * Camadas de TRABALHO. Elas dizem em que gaveta o objeto mora - nao dizem quem
 * fica na frente de quem. Ordem de desenho e a `depth`, logo abaixo.
 */
export type LayerId = 'fundo' | 'cenario' | 'objetos' | 'interagiveis';

export const LAYERS: { id: LayerId; label: string; hint: string }[] = [
  {
    id: 'fundo',
    label: 'BACKGROUND',
    hint: 'o que fecha o horizonte: montanha longe, ilha, neblina da linha do mar',
  },
  {
    id: 'cenario',
    label: 'CENÁRIO',
    hint: 'o que fica de pé no mapa: píer, coqueiro, cabana, mercado, barco, mata',
  },
  {
    id: 'objetos',
    label: 'OBJETOS',
    hint: 'tralha solta e vida do mar: barril, caixa, vara, coral, alga, peixinho',
  },
  { id: 'interagiveis', label: 'INTERAGÍVEIS', hint: 'áreas de interação (vara, mercado)' },
];

/**
 * Profundidade: 0 é o mais para trás, 10 é o mais para frente.
 *
 * É uma escala única para a cena inteira, independente da camada de trabalho.
 * Dois objetos com o mesmo número desempatam pela ordem da lista.
 *
 * O Juggler fica no 7: de 0 a 7 o objeto passa ATRÁS dele, de 8 para cima passa
 * NA FRENTE. As peças fixas do mundo (mar, areia, deck) ocupam a mesma régua,
 * então dá para enfiar um objeto entre elas.
 */
export const DEPTH_MIN = 0;
export const DEPTH_MAX = 10;
export const PLAYER_DEPTH = 7;

/** Rótulo de cada degrau, para o editor não virar adivinhação. */
export const DEPTH_HINTS: Record<number, string> = {
  0: 'horizonte e fundo do mar',
  1: 'vulto submerso',
  2: 'espuma e linha d’água',
  3: 'cenário distante',
  4: 'estacas e estrutura',
  5: 'deck e chão',
  6: 'tralha em cima do deck',
  7: 'plano do Juggler (atrás dele)',
  8: 'na frente do Juggler',
  9: 'primeiro plano',
  10: 'colado na tela',
};

/** z-index real de um objeto. As peças fixas do mundo usam a mesma conta. */
export function depthZ(depth: number): number {
  return Math.round(Math.min(DEPTH_MAX, Math.max(DEPTH_MIN, depth)) * 10);
}

export type ZoneId = 'vara' | 'mercado';

/** Cada tela editável é uma cena própria, com lista e histórico separados. */
export type SceneId = 'mundo' | 'menu';

export interface SceneObject {
  id: string;
  layer: LayerId;
  /** sprite comum, faixa que se repete no horizonte, ou area de interacao */
  kind: 'sprite' | 'zone' | 'strip';
  /** caminho no registro de assets (kind = sprite | strip) */
  sprite?: string;
  /** qual interacao esta area dispara (kind = zone) */
  zone?: ZoneId;
  /** canto superior esquerdo, em unidades de mundo */
  x: number;
  y: number;
  w: number;
  h: number;
  /** graus, em volta do centro */
  rot: number;
  /** 0 = mais para tras, 10 = mais para frente */
  depth: number;
  flip?: boolean;
  opacity?: number;
  /** true = nao pode ser selecionado nem apagado */
  locked?: boolean;
  /** tratamento visual de coisa submersa */
  under?: boolean;
  /** classe extra de animacao (drift, rise...) */
  anim?: string;
  /** papel especial no jogo: a vara some quando o Juggler pega a dele */
  role?: 'vara';
  /**
   * Quanto a faixa anda em relacao a camera (kind = strip).
   * 0,22 = bem longe; 0,52 = meio termo; 1 = anda junto com o mundo.
   */
  parallax?: number;
}

export interface SceneState {
  objects: SceneObject[];
  hidden: LayerId[];
}
