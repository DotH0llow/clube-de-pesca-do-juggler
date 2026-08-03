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

/** As pequenas, bem ao longe: quase so silhueta. */
const FUNDO: Ilha[] = [
  { sprite: 'fundo-recife-arbustivo', x: -2980, h: 34, opacity: 0.5 },
  { sprite: 'fundo-crista-verde', x: -2210, h: 46, opacity: 0.55 },
  { sprite: 'fundo-ilha-baixa-arborizada', x: -1490, h: 38, opacity: 0.5, flip: true },
  { sprite: 'fundo-duas-colinas-verdes', x: -760, h: 52, opacity: 0.58 },
  { sprite: 'fundo-ilhota-jungla', x: 60, h: 58, opacity: 0.55 },
  { sprite: 'fundo-ilhota-com-arvore', x: 840, h: 62, opacity: 0.6, flip: true },
  // uma repetida bem no fim, para o horizonte nao terminar vazio a leste
  { sprite: 'fundo-crista-verde', x: 1320, h: 40, opacity: 0.45, flip: true },
];

/** As grandes, no meio da distancia: sao elas que dao o desenho do horizonte. */
const MEIO: Ilha[] = [
  { sprite: 'torre-karst-filipina', x: -3160, h: 210, opacity: 0.82 },
  { sprite: 'ilha-sedimentar-em-terracos', x: -2640, h: 96, opacity: 0.78 },
  { sprite: 'karst-tres-cumes-conectados', x: -2090, h: 148, opacity: 0.85 },
  { sprite: 'mesa-calcaria-florestada', x: -1580, h: 104, opacity: 0.8, flip: true },
  { sprite: 'ilha-vulcanica-envelhecida', x: -1080, h: 152, opacity: 0.86 },
  { sprite: 'ilha-de-blocos-graniticos', x: -560, h: 118, opacity: 0.82 },
  { sprite: 'calcario-assimetrico-alto', x: -140, h: 196, opacity: 0.88 },
  { sprite: 'ilha-florestada-arredondada', x: 330, h: 126, opacity: 0.84, flip: true },
  { sprite: 'karst-monolito-arredondado', x: 690, h: 172, opacity: 0.9 },
  { sprite: 'ilha-dupla-vulcanica', x: 1080, h: 138, opacity: 0.86 },
  { sprite: 'terraco-calcario-tropical', x: 1360, h: 112, opacity: 0.8, flip: true },
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
  };
}

/** As ilhas do mundo jogavel, prontas para entrar na cena. */
export function islandObjects(): SceneObject[] {
  const base = getWorld().waterY;
  return [
    ...FUNDO.map((it, i) => ilha(it, 0.22, base, `ilha-fundo-${i}`)),
    ...MEIO.map((it, i) => ilha(it, 0.52, base, `ilha-${i}`)),
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
