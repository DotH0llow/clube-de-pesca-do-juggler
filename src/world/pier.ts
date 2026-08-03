import { aspectOf } from '../assets/dims';
import type { SceneObject } from '../editor/types';
import { PIER_END, PIER_RAMP, PIER_START } from './layout';
import { getWorld } from './worldConfig';

/**
 * O pier, montado peca por peca com o pacote `pier/`.
 *
 * Antes o deck era uma DIV com a tabua repetida no fundo e a rampa era um
 * gradiente cortado em diagonal: funcionava de longe e desmontava de perto -
 * nao tinha estaca sob a tabua, nao tinha viga, nao tinha travessa, e a rampa
 * era uma cunha de cor. Agora cada tabua, viga, estaca, mao-francesa e corda e
 * um objeto de cena de verdade, com sprite, profundidade e caixa - o editor
 * mexe em todas elas como mexe num coqueiro.
 *
 * ------------------------------------------------------------------ o recorte
 *
 * Cada sprite do pacote vem numa celula de 64 (ou 64xN) com folga transparente
 * em volta: a tabua do `deck-long` ocupa 12 px no meio de uma celula de 64. Se
 * as pecas fossem posicionadas pela CAIXA, a tabua ficaria flutuando 20 px
 * acima da estaca e nada encostaria em nada.
 *
 * Por isso tudo aqui e posicionado pelo DESENHO, nao pela caixa: a tabela
 * abaixo guarda onde o pixel opaco comeca e termina dentro de cada celula, em
 * fracao de 0 a 1, e o `peca()` faz a conta de quanto empurrar a caixa para o
 * desenho cair no lugar pedido. Encostar a base de uma estaca no topo de uma
 * tabua vira uma linha de codigo, e nao uma cacada de pixel na mao.
 *
 * A tabela e GERADA (`scripts/pier-boxes.py`): se o pacote for reexportado com
 * outra folga, rode o script de novo em vez de corrigir numero na mao.
 */
const RECORTE: Record<string, [number, number, number, number]> = {
  'beam-splice': [0.0703, 0.2812, 0.9297, 0.7031],
  'beam-transverse': [0.0625, 0.3438, 0.9271, 0.6562],
  'beam-underdeck-long': [0.0703, 0.2656, 0.9297, 0.7344],
  'brace-long-left': [0.0703, 0.2812, 0.9297, 0.7188],
  'brace-long-rising': [0.0703, 0.2812, 0.9297, 0.7188],
  'brace-x': [0.0677, 0.2552, 0.9271, 0.7448],
  'cleat-wood': [0.0625, 0.4375, 0.9219, 0.9531],
  'deck-broken-edge': [0.0703, 0.3906, 0.9297, 0.6094],
  'deck-end-left': [0.0625, 0.3281, 0.9219, 0.6719],
  'deck-end-right': [0.0781, 0.3281, 0.9375, 0.6719],
  'deck-fascia': [0.0703, 0.3438, 0.9297, 0.6406],
  'deck-ladder-well': [0.0703, 0.4375, 0.9297, 0.5625],
  'deck-long': [0.0677, 0.4062, 0.9271, 0.5938],
  'deck-medium': [0.0703, 0.3906, 0.9297, 0.6094],
  'deck-patched': [0.0703, 0.4219, 0.9297, 0.5781],
  'deck-ramp': [0.0703, 0.5312, 0.9297, 0.9531],
  'deck-short': [0.0625, 0.3906, 0.9219, 0.5938],
  'derrick-wood': [0.0677, 0.1375, 0.9271, 0.9594],
  'fender-logs': [0.1042, 0.1, 0.8958, 0.9625],
  'joint-lashed': [0.0703, 0.1328, 0.9297, 0.8672],
  'knee-brace': [0.0625, 0.2734, 0.9271, 0.7266],
  'ladder-hanging': [0.1875, 0.0375, 0.8125, 0.9],
  'piling-heavy-round': [0.1979, 0.1, 0.7917, 0.9594],
  'piling-rope-collar': [0.1042, 0.1, 0.8958, 0.9594],
  'piling-slim': [0.2344, 0.1016, 0.7656, 0.9609],
  'post-cap': [0.0625, 0.4688, 0.9271, 0.9531],
  'rail-long': [0.0677, 0.6562, 0.9271, 0.9583],
  'rail-short': [0.0625, 0.625, 0.9271, 0.9583],
  'support-paired': [0.0703, 0.3828, 0.9297, 0.9609],
  'support-square-massive': [0.2812, 0.1016, 0.7188, 0.9609],
};

/**
 * Quanto uma celula de 64 do pacote mede em unidades de mundo.
 *
 * 48 deixa a tabua com 9 unidades de espessura e a estaca com pouco mais de
 * 200 de altura, que e a proporcao que o cais ja tinha. Mexer aqui reescala o
 * pier inteiro de uma vez, mantendo tudo encaixado.
 */
export const PIER_T = 48;

function box(sprite: string): [number, number, number, number] {
  return RECORTE[sprite] ?? [0, 0, 1, 1];
}

interface Alvo {
  /** x do desenho: escolha UM entre esquerda, centro e direita */
  esq?: number;
  cx?: number;
  dir?: number;
  /** y do desenho: escolha UM entre topo, meio e base */
  topo?: number;
  cy?: number;
  base?: number;
  /** altura do DESENHO em unidades; sem isso vale a grade (`PIER_T`) */
  alt?: number;
  /** largura do DESENHO em unidades; tem prioridade sobre `alt` */
  larg?: number;
  depth?: number;
  flip?: boolean;
  opacity?: number;
  anim?: string;
  layer?: SceneObject['layer'];
}

let seq = 0;

/**
 * Poe uma peca do pacote com o DESENHO ancorado onde voce pediu.
 *
 * `peca('piling-heavy-round', { cx: 700, topo: 340 })` bota o topo do desenho
 * da estaca na altura 340 e o centro dela em 700 - sem que voce precise saber
 * que o sprite tem 10% de folga em cima.
 */
export function peca(sprite: string, a: Alvo): SceneObject {
  const path = `pier/${sprite}`;
  const [fx0, fy0, fx1, fy1] = box(sprite);
  const razao = aspectOf(path); // largura / altura da CAIXA

  /*
   * Tamanho da caixa a partir do tamanho pedido para o DESENHO.
   *
   * Com so um dos dois (`larg` OU `alt`) a peca mantem a proporcao. Com os
   * DOIS ela deforma de proposito - a rampa precisa disso: ela tem de comecar
   * exatamente no piso do deck e terminar exatamente na areia, e esses dois
   * pontos vem da planta do mundo, nao do desenho.
   */
  let boxW: number;
  if (a.larg !== undefined) boxW = a.larg / (fx1 - fx0);
  else if (a.alt !== undefined) boxW = (a.alt / (fy1 - fy0)) * razao;
  else boxW = PIER_T * razao;
  const boxH =
    a.larg !== undefined && a.alt !== undefined ? a.alt / (fy1 - fy0) : boxW / razao;

  const drawW = boxW * (fx1 - fx0);
  const drawH = boxH * (fy1 - fy0);

  // onde o DESENHO deve comecar
  const drawX = a.esq ?? (a.cx !== undefined ? a.cx - drawW / 2 : (a.dir ?? 0) - drawW);
  const drawY = a.topo ?? (a.cy !== undefined ? a.cy - drawH / 2 : (a.base ?? 0) - drawH);

  return {
    id: `pier-${sprite}-${++seq}`,
    layer: a.layer ?? 'cenario',
    kind: 'sprite',
    sprite: path,
    // a caixa recua pela folga transparente: o desenho e que fica no alvo
    x: Math.round(drawX - boxW * fx0),
    y: Math.round(drawY - boxH * fy0),
    w: Math.round(boxW),
    h: Math.round(boxH),
    rot: 0,
    depth: a.depth ?? 4,
    flip: a.flip,
    opacity: a.opacity,
    anim: a.anim,
  };
}

/** Largura do DESENHO de uma peca desenhada com a altura de grade padrao. */
export function largura(sprite: string, alt?: number): number {
  const path = `pier/${sprite}`;
  const [fx0, fy0, fx1, fy1] = box(sprite);
  const razao = aspectOf(path);
  const boxW = alt !== undefined ? (alt / (fy1 - fy0)) * razao : PIER_T * razao;
  return boxW * (fx1 - fx0);
}

/**
 * O cais inteiro, do balanco sobre o mar ate a rampa que desce na areia.
 *
 * A leitura, de cima para baixo:
 *
 *   corrimao de corda -> tabua -> testeira -> viga sob o deck -> estacas,
 *   travessas em X e mao-francesa -> defensas de tronco na agua
 *
 * Profundidades: a estrutura submersa fica no 3, a estacaria no 4, o deck no 5
 * e a tralha de convés no 6 - tudo ATRAS do Juggler (7). So a defensa e o
 * cabeço de amarração sobem para o 8, e sao eles que dao o primeiro plano
 * quando ele anda na ponta.
 */
export function pierPieces(): SceneObject[] {
  seq = 0;
  const w = getWorld();
  const deck = w.pierY;
  const out: SceneObject[] = [];

  const x0 = PIER_START - 70;
  const x1 = PIER_END;

  // --------------------------------------------------------------- o tabuado
  // Tres tabuas diferentes em rodizio para o deck nao virar um carimbo. A
  // emenda de uma cai exatamente onde a proxima comeca.
  const tabuas = ['deck-long', 'deck-medium', 'deck-patched', 'deck-long', 'deck-short'];
  let x = x0;
  let i = 0;
  while (x < x1) {
    const nome = tabuas[i % tabuas.length];
    const lw = largura(nome);
    out.push(peca(nome, { esq: x, topo: deck, larg: Math.min(lw, x1 - x), depth: 5 }));
    x += lw;
    i++;
  }

  // testeira: a tabua da BORDA do deck, logo abaixo do piso
  const fasciaW = largura('deck-fascia');
  for (let fx = x0; fx < x1; fx += fasciaW) {
    out.push(
      peca('deck-fascia', {
        esq: fx,
        topo: deck + 8,
        larg: Math.min(fasciaW, x1 - fx),
        depth: 4,
      }),
    );
  }

  // viga longitudinal por baixo de tudo, amarrando as estacas
  const vigaW = largura('beam-underdeck-long');
  for (let vx = x0; vx < x1; vx += vigaW) {
    out.push(
      peca('beam-underdeck-long', {
        esq: vx,
        topo: deck + 24,
        larg: Math.min(vigaW, x1 - vx),
        depth: 3,
      }),
    );
  }

  // as duas pontas do tabuado, para o deck nao terminar cortado no ar
  out.push(peca('deck-end-left', { esq: x0 - 6, topo: deck - 4, depth: 6 }));
  out.push(peca('deck-end-right', { dir: x1 + 8, topo: deck - 4, depth: 6 }));

  // --------------------------------------------------------------- estacaria
  /*
   * Uma estaca a cada 186 unidades. Elas nao sao todas iguais de proposito: a
   * grossa e a de colar de corda se revezam, e a magra entra no meio do vao
   * como estaca secundaria. Cais de madeira nao tem duas pecas iguais.
   */
  const passo = 186;
  const estacas: number[] = [];
  for (let px = x0 + 40; px < x1; px += passo) estacas.push(px);

  estacas.forEach((px, n) => {
    const grossa = n % 2 === 0;
    out.push(
      peca(grossa ? 'piling-heavy-round' : 'piling-rope-collar', {
        cx: px,
        topo: deck + 18,
        alt: 208,
        depth: 4,
      }),
    );
    // estaca magra logo ao lado, meio passo adiante: adensa a estrutura
    if (px + passo / 2 < x1) {
      out.push(
        peca('piling-slim', {
          cx: px + passo / 2,
          topo: deck + 26,
          alt: 172,
          depth: 3,
          opacity: 0.92,
        }),
      );
    }
    // mao-francesa no encontro da estaca com a viga
    out.push(
      peca('knee-brace', {
        cx: px + (grossa ? 34 : -34),
        topo: deck + 30,
        alt: 44,
        depth: 4,
        flip: !grossa,
      }),
    );
  });

  // travessa em X entre pares de estaca, bem abaixo da linha d'agua
  for (let n = 0; n + 1 < estacas.length; n += 2) {
    const cx = (estacas[n] + estacas[n + 1]) / 2;
    out.push(peca('brace-x', { cx, topo: deck + 108, alt: 78, depth: 3, opacity: 0.95 }));
  }

  // emenda de viga e no amarrado: detalhe que quebra a repeticao
  out.push(peca('beam-splice', { cx: x0 + 320, cy: deck + 34, alt: 22, depth: 4 }));
  out.push(peca('beam-splice', { cx: x0 + 690, cy: deck + 34, alt: 22, depth: 4 }));
  out.push(peca('joint-lashed', { cx: x0 + 132, topo: deck + 20, alt: 70, depth: 5 }));
  out.push(peca('brace-long-rising', { esq: x0 + 210, topo: deck + 40, alt: 96, depth: 3, opacity: 0.9 }));
  out.push(peca('brace-long-left', { esq: x0 + 560, topo: deck + 40, alt: 96, depth: 3, opacity: 0.9 }));
  out.push(peca('beam-transverse', { cx: x0 + 430, cy: deck + 62, alt: 16, depth: 3 }));

  // ------------------------------------------------------- a ponta sobre o mar
  /*
   * A cabeceira do cais e o que se ve do menu e o que enquadra a pescaria:
   * ganha o par de estacas travadas, o poste macico e o guindaste de madeira.
   */
  out.push(peca('support-paired', { cx: x0 + 26, topo: deck + 16, alt: 190, depth: 3 }));
  out.push(peca('support-square-massive', { cx: x0 - 16, topo: deck + 10, alt: 250, depth: 4 }));
  // o guindaste de madeira e o unico volume que sobe acima do deck: fica na
  // ponta, e a silhueta que se ve de longe. 150 e o teto para ele nao sair da
  // moldura do jogador quando a camera fecha na praia
  out.push(peca('derrick-wood', { cx: x0 + 104, base: deck + 2, alt: 150, depth: 4, opacity: 0.96 }));

  // defensas de tronco penduradas na agua, no primeiro plano
  out.push(peca('fender-logs', { cx: x0 + 62, topo: deck + 96, alt: 104, depth: 8 }));
  out.push(peca('fender-logs', { cx: x0 + 258, topo: deck + 112, alt: 92, depth: 8, flip: true, opacity: 0.95 }));

  // ----------------------------------------------------------- convés e corda
  // corrimao de corda correndo o cais todo, ATRAS do Juggler: a corda na frente
  // dele cortaria o personagem no meio a cada passo
  const railW = largura('rail-long');
  for (let rx = x0 + 20; rx < x1 - 40; rx += railW) {
    out.push(peca('rail-long', { esq: rx, base: deck + 2, alt: 40, depth: 6, opacity: 0.95 }));
  }
  out.push(peca('rail-short', { dir: x1 - 6, base: deck + 2, alt: 40, depth: 6, opacity: 0.95 }));

  // cabeco de amarracao e tampa de poste: o pouco que sobe acima do piso
  out.push(peca('cleat-wood', { cx: x0 + 168, base: deck + 2, alt: 28, depth: 8 }));
  out.push(peca('cleat-wood', { cx: x1 - 220, base: deck + 2, alt: 28, depth: 8, flip: true }));
  out.push(peca('post-cap', { cx: x0 + 40, base: deck + 2, alt: 30, depth: 8 }));
  out.push(peca('post-cap', { cx: x0 + 412, base: deck + 2, alt: 30, depth: 8 }));

  // ------------------------------------------------------------- a escada
  // o vao da escada e um pedaco do tabuado: entra POR CIMA da tabua, no lugar
  // dela, e a escada desce daquele ponto
  const escadaX = PIER_START + 280;
  out.push(peca('deck-ladder-well', { cx: escadaX, topo: deck, larg: 96, depth: 6 }));
  out.push(peca('ladder-hanging', { cx: escadaX, topo: deck + 8, alt: 132, depth: 5 }));

  // borda quebrada perto da ponta: o cais tem idade
  out.push(peca('deck-broken-edge', { esq: x0 + 96, topo: deck - 2, larg: 82, depth: 6 }));

  // --------------------------------------------------------------- a rampa
  /*
   * A rampa era um gradiente cortado em diagonal. Agora e a peca `deck-ramp`,
   * que ja vem desenhada em diagonal.
   *
   * Ela e desenhada em cima do desnivel do `groundAt`, e nao ao lado dele: a
   * rampa tem exatamente `PIER_RAMP` de comprimento e desce exatamente do piso
   * do deck ate o topo da areia. Foi por isso que a peca ganhou o direito de
   * deformar - encaixar o desenho no chao por onde o Juggler anda vale mais do
   * que manter a proporcao original do sprite.
   */
  out.push(
    peca('deck-ramp', {
      esq: x1 - 10,
      topo: deck - 4,
      larg: PIER_RAMP + 24,
      alt: w.sandY - deck + 22,
      depth: 5,
    }),
  );
  // um pedaco de tabua fechando a boca da rampa na areia
  out.push(peca('deck-short', { esq: x1 + PIER_RAMP - 4, topo: w.sandY, larg: 40, depth: 5 }));

  return out;
}
