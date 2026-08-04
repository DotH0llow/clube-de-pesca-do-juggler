import { aspectOf } from '../assets/dims';
import type { SceneObject } from '../editor/types';
import { getWorld } from './worldConfig';

/**
 * As ilhas do horizonte.
 *
 * O horizonte era UMA faixa (`sky/distant-island-strip`) repetida ate o fim do
 * mar: a mesma silhueta a cada tantas unidades, sem como mexer em nenhuma
 * delas. A faixa saiu e no lugar entraram as 17 ilhas do pacote, uma a uma,
 * como objeto de cena - cada uma arrasta, estica, gira, muda de profundidade e
 * de opacidade no editor.
 *
 * Elas moram em DUAS distancias, e e o `parallax` que decide qual:
 *
 *   0,22 - as `fundo-*`: morrote baixo, desbotado pela distancia, quase parado
 *          quando a camera anda. E o fundo do fundo.
 *   0,52 - as ilhas grandes: karst, vulcao, mesa calcaria. Andam o dobro das
 *          outras, e e essa diferenca que da profundidade ao mar aberto.
 *
 * O `y` de todas e a LINHA D'AGUA: a base da ilha encosta no mar, nao boia
 * acima nem afunda. Como a linha d'agua e configuravel na secao MUNDO, a conta
 * e feita na hora de semear em vez de ser numero fixo.
 */

interface Ilha {
  sprite: string;
  /** x do centro da ilha, em unidades de mundo */
  x: number;
  /** altura do sprite em unidades */
  h: number;
  /** quanto a base afunda abaixo da linha d'agua (tira o corte reto) */
  afunda?: number;
  opacity?: number;
  flip?: boolean;
}

/*
 * ---------------------------------------------------------- A ESCALA
 *
 * As ilhas eram todas do tamanho de um morro no horizonte: 100 a 200 unidades,
 * enfileiradas na linha d'agua. Lidas juntas, elas diziam "ha uma costa ali
 * longe" - e nada alem disso. O que as referencias tem e outra coisa: torres
 * de karst GRANDES e PERTO, que sobem alem do topo da tela e emolduram a cena
 * pelos dois lados, com a costa distante bem apagada atras delas.
 *
 * O que da o senso de escala nao e o tamanho de uma ilha sozinha - e a RAZAO
 * entre a mais perto e a mais longe. Aqui essa razao passa de 20 para 1.
 *
 * Sao tres distancias, e cada uma tem um trabalho:
 *
 *   FUNDO  (0,22)  a costa longe: silhueta apagada, quase da cor do ceu
 *   MEIO   (0,52)  as ilhas de sempre, agora maiores
 *   PERTO  (1,00)  as torres que emolduram, cortadas pelo topo da tela
 *
 * A camada PERTO anda junto com a camera de proposito. Uma parede de pedra a
 * poucas centenas de unidades que se movesse mais devagar que o cais entregaria
 * na hora que ela e um pano de fundo.
 */

/** A costa distante: silhueta apagada, quase da cor do ceu. */
const FUNDO: Ilha[] = [
  { sprite: 'fundo-recife-arbustivo', x: -3400, h: 54, opacity: 0.32 },
  { sprite: 'karst-tres-cumes-conectados', x: -2860, h: 132, opacity: 0.26 },
  { sprite: 'fundo-crista-verde', x: -2210, h: 62, opacity: 0.3 },
  { sprite: 'torre-karst-filipina', x: -1780, h: 168, opacity: 0.24, flip: true },
  { sprite: 'fundo-ilha-baixa-arborizada', x: -1180, h: 52, opacity: 0.3, flip: true },
  { sprite: 'fundo-duas-colinas-verdes', x: -640, h: 70, opacity: 0.34 },
  { sprite: 'calcario-assimetrico-alto', x: -120, h: 150, opacity: 0.24 },
  { sprite: 'fundo-ilhota-jungla', x: 420, h: 66, opacity: 0.32 },
  { sprite: 'fundo-ilhota-com-arvore', x: 980, h: 74, opacity: 0.34, flip: true },
  { sprite: 'fundo-crista-verde', x: 1420, h: 56, opacity: 0.28, flip: true },
];

/** O meio da distancia: e aqui que o horizonte ganha desenho. */
const MEIO: Ilha[] = [
  { sprite: 'ilha-sedimentar-em-terracos', x: -3050, h: 168, opacity: 0.62 },
  { sprite: 'karst-monolito-arredondado', x: -2480, h: 320, opacity: 0.68 },
  { sprite: 'mesa-calcaria-florestada', x: -1900, h: 182, opacity: 0.6, flip: true },
  { sprite: 'ilha-vulcanica-envelhecida', x: -1340, h: 268, opacity: 0.66 },
  { sprite: 'ilha-de-blocos-graniticos', x: -820, h: 206, opacity: 0.62 },
  { sprite: 'karst-tres-cumes-conectados', x: -300, h: 258, opacity: 0.66, flip: true },
  { sprite: 'ilha-florestada-arredondada', x: 240, h: 220, opacity: 0.6, flip: true },
  { sprite: 'ilha-dupla-vulcanica', x: 780, h: 242, opacity: 0.64 },
  { sprite: 'terraco-calcario-tropical', x: 1300, h: 196, opacity: 0.6, flip: true },
];

/**
 * As torres que emolduram.
 *
 * Poucas, enormes, e propositalmente CORTADAS pelo topo da tela: a razao de
 * elas darem escala e justamente nao caberem. Uma torre que cabe inteira no
 * enquadramento vira um objeto que se mede com o olho; uma que sai da moldura
 * vira uma parede.
 *
 * Elas ficam longe do cais - a mais proxima a 1600 unidades a oeste - para
 * emoldurar o mar aberto sem tampar a pescaria.
 */
const PERTO: Ilha[] = [
  { sprite: 'torre-karst-filipina', x: -4300, h: 900, opacity: 1, afunda: 30 },
  { sprite: 'karst-monolito-arredondado', x: -3560, h: 620, opacity: 1, afunda: 26, flip: true },
  { sprite: 'calcario-assimetrico-alto', x: -2650, h: 700, opacity: 1, afunda: 28 },
  { sprite: 'torre-karst-filipina', x: -1620, h: 560, opacity: 1, afunda: 24, flip: true },
];

function ilha(it: Ilha, parallax: number, base: number, id: string): SceneObject {
  const sprite = `island/${it.sprite}`;
  const w = Math.round(it.h * aspectOf(sprite));
  return {
    id,
    layer: 'fundo',
    kind: 'sprite',
    sprite,
    x: Math.round(it.x - w / 2),
    // a base encosta na agua e afunda um tico: ilha nao tem corte reto no mar
    y: Math.round(base - it.h + (it.afunda ?? 6)),
    w,
    h: it.h,
    rot: 0,
    depth: 0,
    opacity: it.opacity,
    flip: it.flip,
    parallax,
    /*
     * A PERSPECTIVA ATMOSFERICA.
     *
     * Longe nao e so menor e mais transparente - e mais AZUL e menos
     * contrastado, porque o ar entre voce e a montanha tem cor. Sem isso, a
     * ilha de tras fica com o mesmo verde vivo da da frente e as duas parecem
     * estar na mesma distancia, por menor que uma seja.
     */
    anim: parallax < 0.35 ? 'ilha-longe' : parallax < 0.8 ? 'ilha-meio' : undefined,
  };
}

/** As ilhas do mundo jogavel, prontas para entrar na cena. */
export function islandObjects(): SceneObject[] {
  const base = getWorld().waterY;
  return [
    ...FUNDO.map((it, i) => ilha(it, 0.22, base, `ilha-fundo-${i}`)),
    ...MEIO.map((it, i) => ilha(it, 0.52, base, `ilha-${i}`)),
    ...PERTO.map((it, i) => ilha(it, 1, base, `ilha-perto-${i}`)),
  ];
}

/**
 * As ilhas da TELA DE TITULO.
 *
 * O menu e uma caixa de 1280x720 e nao tem camera, entao aqui nao ha o mar
 * inteiro para espalhar ilha: sao seis, escolhidas para desenhar um horizonte
 * bonito atras do Juggler, e nada mais.
 */
export function menuIslandObjects(seaY: number, menuW: number): SceneObject[] {
  const escolha: (Ilha & { parallax: number })[] = [
    { sprite: 'fundo-crista-verde', x: 150, h: 34, opacity: 0.5, parallax: 0.22 },
    { sprite: 'fundo-ilhota-jungla', x: 620, h: 40, opacity: 0.5, parallax: 0.22, flip: true },
    { sprite: 'fundo-ilha-baixa-arborizada', x: 1080, h: 30, opacity: 0.45, parallax: 0.22 },
    { sprite: 'karst-tres-cumes-conectados', x: 300, h: 112, opacity: 0.8, parallax: 0.52 },
    { sprite: 'calcario-assimetrico-alto', x: 760, h: 142, opacity: 0.84, parallax: 0.52 },
    { sprite: 'ilha-florestada-arredondada', x: 1150, h: 96, opacity: 0.78, parallax: 0.52, flip: true },
  ];
  return escolha.map((it, i) => {
    const o = ilha(it, it.parallax, seaY, `menu-ilha-${i}`);
    // no menu nao ha camera: a ilha nao pode escapar da caixa de desenho
    o.x = Math.min(Math.max(o.x, -60), menuW - o.w + 60);
    return o;
  });
}
