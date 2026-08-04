import type { SceneObject } from '../editor/types';
import { PIER_END, PIER_RAMP, PIER_START } from './layout';
import { largura, peca } from './pier';
import { getWorld } from './worldConfig';

/**
 * O PÍER DO JOGO, em 2.5D.
 *
 * O pacote `pier/` é desenhado de PERFIL: tábua vista de canto, estaca vista
 * de lado, tudo num plano só. Isso dá um cais correto e chapado - dá para ver
 * que ele existe, não dá para ver que dá para ANDAR nele. As peças daqui saem
 * do `scripts/pier25.py`, que recorta a textura daquele mesmo pacote e
 * re-renderiza a geometria em projeção oblíqua: a madeira é a mesma, o que
 * mudou foi o ângulo.
 *
 * ------------------------------------------------------------------- o chão
 *
 * O Juggler anda na TÁBUA DA FRENTE, e só nela. O deck tem profundidade no
 * desenho, mas não no jogo: `groundAt` continua devolvendo uma altura por
 * ponto do mapa, e essa altura é a borda da frente do tabuado. Um deck
 * navegável em profundidade seria outro sistema de movimentação.
 *
 * Por isso tudo aqui é ancorado pela LINHA DE PISO - a borda da frente - e não
 * pelo topo da caixa do sprite.
 *
 * --------------------------------------------------------------------- luz
 *
 * Nenhuma. Não há sombra projetada nem gradiente de face em peça alguma. A
 * diferença de tom entre o tampo e a testeira é separação de face, que é o que
 * torna um desenho oblíquo legível - não iluminação. O cais chapado é de
 * propósito: dá para pendurar lampião e recorte de luz por cima depois sem
 * brigar com claro e escuro já assados no sprite.
 */

/*
 * A GEOMETRIA DO GERADOR.
 *
 * Estes números são os da variação `a-raso`, e eles NÃO são escolhidos aqui -
 * são consequência das constantes do `scripts/pier25.py`. Estão repetidos
 * porque o TypeScript não lê o Python; se a variação mudar lá, muda aqui.
 *
 * Tudo em pixels de DESENHO do gerador (o arquivo no disco é 3x isto).
 */
const G = {
  /** largura de um tile de deck, e o passo com que ele se repete */
  tile: 160,
  passo: 128,
  /** altura da caixa do tile */
  tileAlt: 23,
  /** onde, dentro do tile, fica a borda da frente do tabuado */
  piso: 14,
  /** o quanto o tampo recua para dentro */
  recuo: 32,
  /** a peça que fecha a ponta */
  fim: 34,
  /** mourão: largura, altura total, e quanto ele sobe acima do piso */
  posteL: 13,
  posteAlt: 138,
  posteAcima: 42,
  /** o mourão de trás é menor porque está mais longe */
  fundoL: 11,
  /** a barra do corrimão */
  corrimaoL: 136,
  corrimaoAlt: 9,
  /** a que altura do piso a barra passa */
  corrimaoY: 30,
};

/**
 * Quantas unidades de mundo vale um pixel de desenho do gerador.
 *
 * 1,8 põe o passo do tabuado em 230 unidades - cinco tiles ao longo do cais -
 * e o mourão com 23 de largura por 248 de altura. Mexer aqui reescala o cais
 * inteiro de uma vez, mantendo tudo encaixado.
 */
const P = 1.8;

let seq = 0;

function p25(sprite: string, x: number, y: number, largBase: number, altBase: number, depth: number, extra: Partial<SceneObject> = {}): SceneObject {
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
 * O cais inteiro em 2.5D.
 *
 * A ordem de composição é a ordem de profundidade, e é ela que faz a coisa
 * parecer sólida: mourão de trás, tabuado por cima dele, mourão da frente por
 * cima do tabuado. Errar essa ordem entrega o truque na hora.
 *
 *   3  mourão de trás (aparece ACIMA da linha do deck, por estar recuado)
 *   5  tabuado
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
  // Recuados para dentro da cena, e por isso desenhados mais alto na tela: é
  // esse par que fecha a leitura de profundidade.
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

  // ------------------------------------------------------------- tabuado
  for (let x = x0; x < x1; x += passo) {
    out.push(p25('deck', x, deckY, G.tile, G.tileAlt, 5));
  }
  // a ponta, fechando o bico do último tile
  out.push(p25('deck-fim', x1 - G.fim * P * 0.4, deckY, G.fim, G.tileAlt, 5));

  // --------------------------------------------------- mourões da frente
  for (let x = x0; x < x1; x += passo) {
    out.push(p25('poste', x - (G.posteL / 2) * P, deckY - G.posteAcima * P, G.posteL, G.posteAlt, 6));
  }

  // ------------------------------------------------------------ corrimão
  const corrimaoW = G.corrimaoL * P;
  for (let x = x0; x < x1 - 20; x += corrimaoW) {
    out.push(
      p25('corrimao', x, deckY + (G.piso - G.corrimaoY) * P, G.corrimaoL, G.corrimaoAlt, 6, {
        opacity: 0.97,
      }),
    );
  }

  /*
   * A ESTRUTURA DEBAIXO DO DECK, do pacote de PERFIL.
   *
   * Esta parte é o remendo de um erro meu. Ao trocar o cais pelo 2.5D eu
   * troquei também tudo que vinha junto - viga, travessa em X, mão-francesa,
   * emenda - porque o gerador não produz nenhuma dessas peças. O resultado foi
   * um cais mais pobre que o anterior: cinco postes, uma barra e nada entre
   * eles. Ganhou ângulo e perdeu densidade, o que não é uma troca boa.
   *
   * Elas voltam. E voltam de perfil mesmo, porque estrutura ABAIXO da linha
   * d'água não denuncia ângulo: são vigas e cordas cruzadas, sem tampo à
   * mostra que pudesse contradizer a projeção do deck.
   */
  const vao = passo;
  for (let n = 0, x = x0; x < x1; x += vao, n++) {
    // travessa em X entre um par de mourões e o seguinte
    if (x + vao < x1) {
      out.push(peca('brace-x', { cx: x + vao / 2, topo: w.pierY + 96, alt: 78, depth: 3, opacity: 0.95 }));
    }
    // mão-francesa no encontro do mourão com o tabuado
    out.push(
      peca('knee-brace', {
        cx: x + (n % 2 === 0 ? 30 : -30),
        topo: w.pierY + 26,
        alt: 44,
        depth: 4,
        flip: n % 2 !== 0,
      }),
    );
    // estaca magra no meio do vão, adensando a estacaria
    if (x + vao / 2 < x1) {
      out.push(
        peca('piling-slim', {
          cx: x + vao / 2,
          topo: w.pierY + 22,
          alt: 168,
          depth: 3,
          opacity: 0.9,
        }),
      );
    }
  }

  // a viga longitudinal, amarrando as estacas por baixo
  const vigaW = largura('beam-underdeck-long');
  for (let x = x0; x < x1; x += vigaW) {
    out.push(
      peca('beam-underdeck-long', {
        esq: x,
        topo: w.pierY + 22,
        larg: Math.min(vigaW, x1 - x),
        depth: 3,
      }),
    );
  }
  out.push(peca('joint-lashed', { cx: x0 + 132, topo: w.pierY + 20, alt: 70, depth: 4 }));
  out.push(peca('support-square-massive', { cx: x0 - 10, topo: w.pierY + 6, alt: 250, depth: 4 }));
  out.push(peca('derrick-wood', { cx: x0 + 104, base: w.pierY + 2, alt: 150, depth: 4, opacity: 0.96 }));

  /*
   * A RAMPA E A TRALHA também vêm do perfil.
   *
   * Não há peça 2.5D para elas, e inventar uma aqui seria produzir geometria
   * que o gerador não faz. O que é pequeno e redondo - cabeço, defensa,
   * escada - não denuncia ângulo, então atravessa a troca de projeção sem
   * parecer errado.
   */
  out.push(
    peca('deck-ramp', {
      esq: x1 - 10,
      topo: w.pierY - 4,
      larg: PIER_RAMP + 24,
      alt: w.sandY - w.pierY + 22,
      depth: 5,
    }),
  );
  out.push(peca('deck-short', { esq: x1 + PIER_RAMP - 4, topo: w.sandY, larg: 40, depth: 5 }));
  out.push(peca('cleat-wood', { cx: x0 + 168, base: w.pierY + 2, alt: 28, depth: 8 }));
  out.push(peca('cleat-wood', { cx: x1 - 220, base: w.pierY + 2, alt: 28, depth: 8, flip: true }));
  out.push(peca('fender-logs', { cx: x0 + 62, topo: w.pierY + 96, alt: 104, depth: 8 }));
  out.push(peca('ladder-hanging', { cx: PIER_START + 280, topo: w.pierY + 8, alt: 132, depth: 4 }));

  return out;
}
