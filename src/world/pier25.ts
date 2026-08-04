import type { SceneObject } from '../editor/types';
import { PIER_END, PIER_START } from './layout';
import { getWorld } from './worldConfig';

/**
 * O PÍER DO JOGO: a-raso, e só ele.
 *
 * As peças saem do `scripts/pier25.py`, que recorta a textura do pacote de
 * perfil e re-renderiza a geometria em projeção oblíqua. Aqui não entra nada
 * do pacote de perfil - nem viga, nem travessa, nem mão-francesa, nem
 * guindaste. Uma tentativa anterior misturou os dois para "dar densidade" e o
 * resultado foi um cais de duas linguagens ao mesmo tempo, com estrutura
 * chapada pendurada sob um tabuado em perspectiva.
 *
 * São cinco peças e mais nada:
 *
 *   deck         o tabuado, que se repete
 *   deck-fim     a face que fecha a ponta
 *   deck-rampa   o mesmo tabuado, cisalhado, descendo para a areia
 *   poste        o mourão da frente
 *   poste-fundo  o mourão de trás, menor por estar recuado
 *   corrimao     a barra que liga os mourões
 *
 * ------------------------------------------------------------------- o chão
 *
 * O Juggler anda na TÁBUA DA FRENTE, e só nela. O deck tem profundidade no
 * desenho, mas não no jogo: `groundAt` devolve uma altura por ponto do mapa, e
 * essa altura é a borda da frente do tabuado. Por isso tudo aqui é ancorado
 * pela LINHA DE PISO, e não pelo topo da caixa do sprite.
 *
 * --------------------------------------------------------------------- luz
 *
 * Nenhuma. A diferença de tom entre o tampo e a testeira é separação de face,
 * que é o que torna um desenho oblíquo legível - não iluminação. Não há sombra
 * projetada nem gradiente em peça alguma, então dá para pendurar lampião e
 * recorte de luz por cima depois.
 */

/*
 * A GEOMETRIA DO GERADOR, em pixels de desenho.
 *
 * Estes números não são escolhidos aqui - são consequência das constantes do
 * `scripts/pier25.py` na variação `a-raso`. Estão repetidos porque o
 * TypeScript não lê o Python; se a variação mudar lá, muda aqui.
 *
 * A escala de trabalho do gerador TRIPLICOU em relação à primeira versão: o
 * tampo passou de 14 para 42 pixels de verdade. Antes a peça tinha o tamanho
 * certo e a resolução de um sprite três vezes menor, e o chão do cais ficava
 * grosseiro perto do resto da arte.
 */
const G = {
  /** largura da caixa do tile de deck, e o passo com que ele se repete */
  tile: 481,
  passo: 384,
  tileAlt: 64,
  /** onde, dentro do tile, fica a borda da frente do tabuado */
  piso: 41,
  /** o quanto o tampo recua para dentro */
  recuo: 97,
  /** a peça que fecha a ponta */
  fim: 99,
  /** a rampa: caixa e o quanto ela desce do começo ao fim */
  rampa: 481,
  rampaAlt: 106,
  /** mourão */
  posteL: 39,
  posteAlt: 414,
  posteAcima: 126,
  fundoL: 32,
  /** a barra do corrimão */
  corrimaoL: 408,
  corrimaoAlt: 24,
  corrimaoY: 90,
};

/**
 * Quantas unidades de mundo vale um pixel de desenho do gerador.
 *
 * 0,6 põe o passo do tabuado em 230 unidades - quatro tiles ao longo do cais -
 * e o mourão com 23 de largura por 248 de altura. É a mesma escala final da
 * versão anterior; o que mudou é que agora há três vezes mais pixel dentro
 * dela.
 */
const P = 0.6;

let seq = 0;

function p25(
  sprite: string,
  x: number,
  y: number,
  largBase: number,
  altBase: number,
  depth: number,
  extra: Partial<SceneObject> = {},
): SceneObject {
  return {
    id: `pier25-${sprite}-${++seq}`,
    layer: 'cenario',
    kind: 'sprite',
    sprite: `pier2d/${sprite}`,
    x: Math.round(x),
    y: Math.round(y),
    w: Math.round(largBase * P),
    h: Math.round(altBase * P),
    rot: 0,
    depth,
    ...extra,
  };
}

/**
 * O cais inteiro.
 *
 * A ordem de composição é a ordem de profundidade, e é ela que faz a coisa
 * parecer sólida: mourão de trás, tabuado por cima dele, mourão da frente por
 * cima do tabuado. Errar essa ordem entrega o truque na hora.
 *
 *   3  mourão de trás (aparece ACIMA da linha do deck, por estar recuado)
 *   5  tabuado e rampa
 *   6  mourão da frente e corrimão
 *
 * Tudo ATRÁS do Juggler (7). Um corrimão na frente dele cortaria o personagem
 * ao meio a cada passo, e este cais é para pescar.
 */
export function pier25Pieces(): SceneObject[] {
  seq = 0;
  const w = getWorld();
  const out: SceneObject[] = [];

  const x0 = PIER_START - 70;
  const x1 = PIER_END;

  /** O topo da caixa do tile, para a borda da frente cair em `pierY`. */
  const deckY = w.pierY - G.piso * P;
  const passo = G.passo * P;

  // ------------------------------------------------------ mourões de trás
  for (let x = x0; x < x1; x += passo) {
    out.push(
      p25(
        'poste-fundo',
        x + (G.recuo - G.fundoL / 2) * P,
        deckY - (G.posteAcima + G.piso) * P,
        G.fundoL,
        G.posteAlt,
        3,
        { opacity: 0.94 },
      ),
    );
  }

  /*
   * O TABUADO, e ele TERMINA ONDE O CAIS TERMINA.
   *
   * O laço era `x < x1` com passo de 230 e tábua de 289: a última tábua nascia
   * a 8 unidades do fim do cais e seguia por mais 280 sobre a areia. Como a
   * rampa começa exatamente ali e desce, o que se via eram DUAS rampas - uma
   * tábua reta pendurada no ar por cima da rampa de verdade, que era a de
   * baixo. A "rampa alta" nunca foi uma rampa: era o deck passando do ponto.
   *
   * Agora as tábuas cheias entram enquanto couberem inteiras, e a última é
   * encostada pela DIREITA em `x1`. Elas já se sobrepõem entre si (a peça é
   * mais larga que o passo), então uma sobreposição maior no fim não aparece.
   */
  const tabuaW = G.tile * P;
  let ultima = x0;
  for (let x = x0; x + tabuaW <= x1; x += passo) {
    out.push(p25('deck', x, deckY, G.tile, G.tileAlt, 5));
    ultima = x;
  }
  if (ultima + tabuaW < x1 - 1) out.push(p25('deck', x1 - tabuaW, deckY, G.tile, G.tileAlt, 5));
  out.push(p25('deck-fim', x1 - G.fim * P * 0.4, deckY, G.fim, G.tileAlt, 5));

  // --------------------------------------------------- mourões da frente
  for (let x = x0; x < x1; x += passo) {
    out.push(p25('poste', x - (G.posteL / 2) * P, deckY - G.posteAcima * P, G.posteL, G.posteAlt, 6));
  }

  /*
   * O CORRIMÃO ANDA NO PASSO DO MOURÃO, e não no tamanho da própria peça.
   *
   * A peça tem 408 px de caixa, mas a BARRA dentro dela tem 384 - os 24 que
   * sobram são a aba do topo em perspectiva, que existe justamente para cair
   * por cima do mourão seguinte. E 384 px é o passo do cais (`TILE * 2` no
   * gerador). O laço andava de 408 em 408, ou seja, arrastava a aba junto: a
   * cada vão o corrimão saía 14 unidades mais para a direita e, quatro vãos
   * depois, a emenda estava no meio do vão em vez de encostada no mourão.
   *
   * Andando de `passo` em `passo`, a emenda cai sempre em cima do mourão -
   * que é onde uma emenda de corrimão cai num cais de verdade - e a aba de
   * cada peça cobre a junta da seguinte.
   */
  for (let x = x0; x + passo <= x1; x += passo) {
    out.push(
      p25('corrimao', x, deckY + (G.piso - G.corrimaoY) * P, G.corrimaoL, G.corrimaoAlt, 6, {
        opacity: 0.97,
      }),
    );
  }

  /*
   * A RAMPA.
   *
   * Ela é o próprio tabuado cisalhado, então encaixa no deck reto sem emenda
   * visível. Começa onde o deck termina e desce até a areia.
   *
   * A largura dela é o que manda no `PIER_RAMP` do `layout.ts` - os dois
   * precisam concordar, senão o Juggler desce a rampa no desenho e continua no
   * nível do deck na física, ou o contrário. Aqui a rampa é desenhada com a
   * largura que a peça tem.
   *
   * A ALTURA, essa, é calculada aqui. No desenho a rampa desce 25 unidades
   * (106 px de caixa contra 64 da tábua reta, a 0,6), e o desnível do mundo é
   * `sandY - pierY` - hoje 32. Sete unidades de diferença é o bastante para a
   * rampa terminar boiando acima da praia, que é o que se via. Esticar a peça
   * até a queda do mundo resolve, e continua resolvendo quando alguém mexer no
   * piso do deck ou no topo da areia pela seção MUNDO do editor.
   */
  const quedaMundo = Math.max(0, w.sandY - w.pierY);
  out.push(
    p25('deck-rampa', x1 - 6, deckY, G.rampa, G.rampaAlt, 5, {
      h: Math.round(G.tileAlt * P + quedaMundo),
    }),
  );

  return out;
}

/**
 * O comprimento horizontal da rampa, em unidades de mundo.
 *
 * O `layout.ts` usa isto para o chão descer no mesmo lugar em que o desenho
 * desce. Exportado daqui, e não escrito à mão lá, porque quem sabe o tamanho
 * da peça é este arquivo.
 */
export const RAMPA_LARGURA = Math.round(G.rampa * P);
