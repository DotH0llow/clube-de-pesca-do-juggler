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

/**
 * As areas de interacao do mundo.
 *
 *   vara    - abre a pescaria
 *   mercado - abre o mercado de peixe
 *   parede  - barra o Juggler (as antigas paredes invisiveis, agora moveis)
 *   limiar  - troca o enquadramento da camera entre mar e praia
 *
 * Pode existir mais de uma parede na cena. As outras sao unicas.
 */
export type ZoneId = 'vara' | 'mercado' | 'parede' | 'limiar';

export const ZONE_LABEL: Record<ZoneId, string> = {
  vara: 'PESCAR',
  mercado: 'MERCADO',
  parede: 'PAREDE',
  limiar: 'LIMIAR DO PÍER',
};

/** Formas geometricas que da para criar direto no editor, sem sprite. */
export type ShapeKind = 'retangulo' | 'elipse' | 'triangulo' | 'losango';

export const SHAPES: { id: ShapeKind; label: string }[] = [
  { id: 'retangulo', label: 'RETÂNGULO' },
  { id: 'elipse', label: 'ELIPSE' },
  { id: 'triangulo', label: 'TRIÂNGULO' },
  { id: 'losango', label: 'LOSANGO' },
];

/** Cada tela editável é uma cena própria, com lista e histórico separados. */
export type SceneId = 'mundo' | 'menu';

export interface SceneObject {
  id: string;
  layer: LayerId;
  /** sprite, faixa repetida, area de interacao ou forma geometrica */
  kind: 'sprite' | 'zone' | 'strip' | 'forma';
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
  /** true = desligado: nao aparece no jogo e nao vale como parede, mas continua na lista */
  off?: boolean;
  /** tratamento visual de coisa submersa */
  under?: boolean;
  /** classe extra de animacao (drift, rise...) */
  anim?: string;
  /**
   * Papel especial da peca.
   *
   *   vara    - a vara fincada no deck; some quando o Juggler pega a dele
   *   juggler - a arte do Juggler posando na tela de titulo
   *   titulo  - o bloco do logo e do subtitulo
   *   botoes  - a coluna de botoes do menu
   *   vinheta - o escurecido das bordas da tela de titulo
   *
   * Peca com papel e desenhada por quem sabe desenha-la (a tela de titulo, por
   * exemplo), mas continua sendo objeto de cena: da para arrastar, esticar,
   * mudar de profundidade e de opacidade no editor como qualquer outra.
   */
  role?: 'vara' | 'juggler' | 'titulo' | 'botoes' | 'vinheta';
  /**
   * Quanto a faixa anda em relacao a camera (kind = strip).
   * 0,22 = bem longe; 0,52 = meio termo; 1 = anda junto com o mundo.
   */
  parallax?: number;

  // ------------------------------------------------- forma geometrica (kind = forma)
  shape?: ShapeKind;
  /** cor de dentro, em hexadecimal */
  fill?: string;
  /** cor da borda; vazio = sem borda */
  stroke?: string;
  /** espessura da borda, em unidades de mundo */
  strokeW?: number;
  /** canto arredondado do retangulo, em unidades de mundo */
  radius?: number;
}

export interface SceneState {
  objects: SceneObject[];
  hidden: LayerId[];
}
