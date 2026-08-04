/**
 * Camadas de TRABALHO. Elas dizem em que gaveta o objeto mora - nao dizem quem
 * fica na frente de quem. Ordem de desenho e a `depth`, logo abaixo.
 */
export type LayerId = 'fundo' | 'cenario' | 'objetos' | 'interagiveis' | 'marcadores';

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
  {
    id: 'marcadores',
    label: 'MARCADORES',
    hint: 'pontos de referência do jogo: onde o Juggler nasce e onde a câmera vira',
  },
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
 * As três distâncias de parallax, e o quanto cada uma anda com a câmera.
 *
 * Isto aqui é a peça que faltava ser compartilhada. O mundo desenha cada faixa
 * num container próprio, movido por `-camX × fator`; o `parallax` de cada
 * objeto só serve para dizer em QUAL das três ele cai. Ou seja: o fator que
 * vale na tela é o da FAIXA, não o número escrito no objeto.
 *
 * Enquanto só as tiras de horizonte tinham parallax isso não incomodava
 * ninguém. Quando as ilhas viraram sprite solto, virou bug visível: o editor
 * desenhava a caixa de seleção como se tudo andasse junto com a câmera, e a
 * ilha aparecia longe da própria caixa. Agora os dois leem a mesma tabela.
 */
export type BandId = 'longe' | 'meio' | 'perto';

export const BAND_FACTOR: Record<BandId, number> = {
  longe: 0.22,
  meio: 0.52,
  perto: 1,
};

/** Em que faixa de parallax o objeto cai. */
export function bandOf(o: Pick<SceneObject, 'parallax'>): BandId {
  const p = o.parallax ?? 1;
  if (p < 0.35) return 'longe';
  if (p < 0.8) return 'meio';
  return 'perto';
}

/** Quanto o objeto anda em relação à câmera, na prática. */
export function parallaxFactor(o: Pick<SceneObject, 'parallax'>): number {
  return BAND_FACTOR[bandOf(o)];
}

/**
 * As areas de interacao do mundo.
 *
 *   vara     - abre a pescaria
 *   mercado  - abre o mercado de peixe
 *   parede   - barra o Juggler (as antigas paredes invisiveis, agora moveis)
 *   limiar   - troca o enquadramento da camera entre mar e praia
 *   spawn    - onde o Juggler nasce e para onde o "Travei!" o traz de volta
 *   animacao - toca um clipe animado quando o jogador aperta E
 *   pose     - trava num quadro so quando o jogador aperta E
 *
 * Pode existir mais de uma parede, e quantas acoes voce quiser. As outras sao
 * unicas.
 */
export type ZoneId =
  | 'vara'
  | 'mercado'
  | 'parede'
  | 'limiar'
  | 'spawn'
  | 'animacao'
  | 'pose';

export const ZONE_LABEL: Record<ZoneId, string> = {
  vara: 'PESCAR',
  mercado: 'MERCADO',
  parede: 'PAREDE',
  limiar: 'LIMIAR DO PÍER',
  spawn: 'NASCIMENTO',
  animacao: 'AÇÃO · ANIMAÇÃO',
  pose: 'AÇÃO · POSE',
};

/** As areas que podem existir mais de uma vez na cena. */
export const ZONAS_REPETIVEIS: ZoneId[] = ['parede', 'animacao', 'pose'];

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
   * Peca com papel e desenhada por quem sabe desenha-la (a tela de titulo, por
   * exemplo), mas continua sendo objeto de cena: da para arrastar, esticar,
   * mudar de profundidade e de opacidade no editor como qualquer outra.
   *
   * A TELA DE TITULO ERA DOIS BLOCOS. `titulo` trazia a marca, o nome do jogo e
   * a chamada grudados; `botoes` trazia os quatro botoes e a linha de progresso
   * empilhados. Mover o nome do jogo sem levar a marca junto, ou afastar o
   * botao do editor dos outros tres, era impossivel - eram um objeto so, e o
   * arranjo interno vinha do CSS. Agora cada peca e uma peca:
   *
   *   marca      - o simbolo do topo
   *   titulo     - a primeira palavra do nome (JUGGLER'S)
   *   fishing    - a segunda (FISHING)
   *   club       - a terceira (CLUB)
   *   subtitulo  - a chamada de uma linha
   *   progresso  - lancamentos, especies e moedas
   *   jogar      - CONTINUAR / COMECAR
   *   comojogar  - COMO JOGAR
   *   config     - CONFIGURACOES
   *   editor     - EDITOR DO MENU
   *
   * O texto DENTRO de cada botao continua sendo do botao, claro - separar isso
   * seria separar a etiqueta da coisa.
   */
  role?:
    | 'vara'
    | 'juggler'
    | 'vinheta'
    | 'marca'
    | 'titulo'
    | 'fishing'
    | 'club'
    | 'subtitulo'
    | 'progresso'
    | 'jogar'
    | 'comojogar'
    | 'config'
    | 'editor';
  /**
   * Quanto a faixa anda em relacao a camera (kind = strip).
   * 0,22 = bem longe; 0,52 = meio termo; 1 = anda junto com o mundo.
   */
  parallax?: number;

  // -------------------------------------------- area de acao (zone animacao|pose)
  /**
   * Qual clipe de personagem a area toca, no formato do registro de quadros:
   * `sit-left`, `fish-right`, `walk-left`... A lista sai sozinha da pasta de
   * assets, entao clipe novo aparece no editor sem ninguem escrever nada.
   */
  clip?: string;
  /** Em qual quadro travar (zone = pose). Sem isso, o primeiro. */
  poseFrame?: number;
  /**
   * O que o aviso diz para o jogador.
   *
   * E o texto que aparece junto do "E" quando ele chega perto: "Sentar",
   * "Olhar o mar", "Descansar". Sem isto o aviso nao saberia o que pedir - e
   * "APERTE E" sozinho nao diz para que.
   */
  prompt?: string;

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
  /**
   * Que geração do cais esta cena tem montada.
   *
   * Existe porque adivinhar isso pela lista de objetos não funcionou. A
   * primeira tentativa perguntava "há peça `pier25-` aqui?" - e quem tinha
   * salvo a versão INTERMEDIÁRIA do cais (2.5D de baixa resolução, misturado
   * com estrutura de perfil, sem rampa) respondia que sim. A migração saía
   * fora na hora e o cais velho ficava preso para sempre.
   *
   * Um número é honesto: ou a cena tem a geração de agora, ou não tem. Não há
   * o que deduzir.
   */
  pierV?: number;
}
