import { WORLD_W } from './layout';
import type { WorldConfig } from './worldConfig';

/**
 * A LINHA DE COSTA: UM caminho, e tudo o mais derivado dele.
 *
 * -------------------------------------------------------------- o que saiu
 *
 * A versao anterior desenhava a beira do mar como uma pilha de retangulos: a
 * areia submersa recortada por um perfil quase horizontal e, por cima dela,
 * OITO bandas de profundidade, cada uma um retangulo de altura fixa que
 * atravessava a cena inteira. Duas consequencias, e as duas apareciam na tela:
 *
 *   1. oito costuras horizontais no mar. Banda chapada encostada em banda
 *      chapada e uma linha, por mais proximas que sejam as cores;
 *   2. uma parede vertical entre agua e areia. As bandas paravam todas no
 *      mesmo x (`faixaLarg`), entao a borda da agua era uma reta perfeita -
 *      o resto do perfil ficava escondido debaixo delas.
 *
 * A agua nao precisa de banda nenhuma: ela ja e UM elemento com UM degrade
 * vertical continuo, do azul de superficie ao breu do fundo. O que faltava
 * nao era profundidade pintada - era a agua terminar numa forma de costa.
 *
 * ----------------------------------------------------------- o que entra
 *
 * Um caminho so, `perfil`, descendo a tela em degraus de 4 unidades, com a
 * costa andando de 4 a 12 unidades para os lados. Dele saem, na mesma
 * chamada e com as mesmas coordenadas:
 *
 *   `marClip`     - recorte do MAR: tudo o que fica a esquerda do caminho;
 *   `areiaClip`   - recorte da AREIA: tudo o que fica a direita dele;
 *   `raso`/`rasoFundo` - duas faixas de agua rasa, que ATRAVESSAM a costa e
 *                   entram na areia (e por isso a areia continua visivel
 *                   debaixo delas: sao translucidas);
 *   `molhada`     - a areia molhada, do lado da areia;
 *   `espuma`      - o `d` de um `<path>`, tracejado em pedacos desiguais.
 *
 * Nenhuma dessas formas tem geometria propria. Mudar a ondulacao da costa
 * move as cinco juntas, porque as cinco sao o mesmo array de pontos com
 * deslocamentos diferentes em x - e e isso que evita costura, buraco e
 * sobreposicao entre camadas.
 *
 * ------------------------------------------------------ o corte e de perfil
 *
 * A cena e um corte transversal, e nao uma praia vista de cima: a agua fica a
 * ESQUERDA, a areia a DIREITA, e a costa desce a tela quase na vertical. Por
 * isso "lado da agua" quer dizer x MENOR e "lado da areia" quer dizer x MAIOR
 * - e nao acima e abaixo, como na versao do perfil deitado.
 */

/** Grade de desenho. Tudo cai nela: costa em meio pixel nao e pixel art. */
export const GRADE = 4;

export interface CostaPonto {
  x: number;
  y: number;
}

export interface Caixa {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Costa {
  /** a caixa da faixa de costa, em unidades de mundo */
  caixa: Caixa;
  /** o caminho da costa, de cima para baixo */
  perfil: CostaPonto[];
  /** x medio da costa: onde a crista da onda para */
  costaX: number;
  /** a caixa do MAR e o recorte que o termina na costa */
  mar: Caixa;
  marClip: string;
  /** a caixa da AREIA e o recorte que a comeca na costa */
  areia: Caixa;
  areiaClip: string;
  /** agua rasa: a faixa fina, mais clara, do lado da agua */
  raso: string;
  /** agua rasa: a faixa larga de tras, mais apagada */
  rasoFundo: string;
  /** a lamina de agua que entra POR CIMA da areia */
  rasoAreia: string;
  /** areia molhada, do lado da areia */
  molhada: string;
  /** espuma: o `d` de um `<path>` que segue a costa */
  espuma: string;
}

/**
 * Le uma cor, em `#rrggbb` OU em `rgb(r,g,b)`.
 *
 * Os dois formatos, e nao so o hexadecimal, porque estas funcoes se ENCAIXAM:
 * `esverdeia(clareia(azul))` recebe de volta o que a de dentro devolveu. Com
 * um leitor so de hexadecimal isso dava `NaN` em silencio - a cor saia
 * `rgb(NaN,NaN,NaN)`, o CSS descartava a regra inteira e a faixa de agua rasa
 * simplesmente nao aparecia na tela.
 */
function hex(c: string): [number, number, number] {
  if (c.startsWith('rgb')) {
    const n = c.replace(/[^0-9,.]/g, '').split(',').map(Number);
    return [n[0] || 0, n[1] || 0, n[2] || 0];
  }
  const s = c.replace('#', '');
  return [
    parseInt(s.slice(0, 2), 16),
    parseInt(s.slice(2, 4), 16),
    parseInt(s.slice(4, 6), 16),
  ];
}

function mistura(a: string, b: string, t: number): string {
  const [r1, g1, b1] = hex(a);
  const [r2, g2, b2] = hex(b);
  const k = Math.max(0, Math.min(1, t));
  return `rgb(${Math.round(r1 + (r2 - r1) * k)},${Math.round(g1 + (g2 - g1) * k)},${Math.round(
    b1 + (b2 - b1) * k,
  )})`;
}

/** Clareia uma cor em direcao ao branco: agua rasa e mais clara, nunca escura. */
export function clareia(c: string, t: number): string {
  return mistura(c, '#ffffff', t);
}

/** Puxa a cor para o verde-agua: rasa e esverdeada, funda e azul. */
export function esverdeia(c: string, t: number): string {
  return mistura(c, '#7fe3d2', t);
}

function naGrade(v: number, passo = GRADE): number {
  return Math.round(v / passo) * passo;
}

/**
 * Sorteio com semente: o mesmo mundo da a mesma costa.
 *
 * `Math.random()` aqui seria um defeito que so aparece em movimento - a costa
 * mudaria a cada render do React, e "sem ruido aleatorio por quadro" e
 * requisito de pixel art, nao preferencia.
 */
function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

/**
 * O caminho em DEGRAUS, deslocado em x.
 *
 * Desce reto ate o proximo y, anda reto ate o proximo x. E o serrilhado de
 * mapa de tiles; uma diagonal ligando ponto a ponto viraria uma reta suave
 * que o resto da cena nao tem.
 */
function degraus(pts: CostaPonto[], dx: number): CostaPonto[] {
  const out: CostaPonto[] = [];
  for (let i = 0; i < pts.length; i++) {
    out.push({ x: pts[i].x + dx, y: pts[i].y });
    const prox = pts[i + 1];
    if (prox) out.push({ x: pts[i].x + dx, y: prox.y });
  }
  return out;
}

/** Junta pontos num `polygon()` de `clip-path`, em px relativos a uma caixa. */
function poligono(pts: CostaPonto[], c: Caixa): string {
  return `polygon(${pts.map((p) => `${p.x - c.x}px ${p.y - c.y}px`).join(',')})`;
}

export function calcularCosta(w: WorldConfig): Costa {
  const r = rng(20260805);

  const topo = naGrade(Math.min(w.sandY, w.waterY) - 48);
  const fundo = naGrade(w.waterY + w.seaDepth);
  const amp = Math.max(0, w.shoreIrregular);
  const passo = Math.max(8, w.shorePasso);

  /*
   * O CAMINHO.
   *
   * Passeio aleatorio com passo curto e limite: cada degrau anda 0, 4 ou 8
   * unidades para um lado, e a soma nunca passa de `shoreIrregular`. Sortear
   * um x novo a cada degrau daria serrilhado de 1 px - o "ruido" que o pedido
   * descarta; um seno daria ondulacao regular, que le como enfeite. Passeio
   * limitado da poucas reentrancias grandes, que e o que praia tem.
   *
   * A ALTURA DE CADA DEGRAU tambem varia (de 1 a 3 passos). Com altura fixa a
   * costa vira escada de tamanho unico, e escada de tamanho unico o olho
   * reconhece como padrao na primeira olhada.
   */
  const perfil: CostaPonto[] = [];
  let x = w.shoreX;
  for (let y = topo; y < fundo; ) {
    perfil.push({ x: naGrade(x), y: naGrade(y) });
    const anda = [-8, -4, -4, 0, 0, 4, 4, 8][Math.floor(r() * 8)];
    x = Math.max(w.shoreX - amp, Math.min(w.shoreX + amp, x + anda));
    y += passo * (1 + Math.floor(r() * 3));
  }
  perfil.push({ x: naGrade(x), y: fundo });

  const costaX = naGrade(w.shoreX);
  const caixa = { x: w.shoreX - 240, y: topo, w: 480, h: fundo - topo };

  // ----------------------------------------------------------- os recortes
  //
  // O MAR e a AREIA sao os dois lados do MESMO caminho. Se um recuasse meia
  // unidade em relacao ao outro apareceria uma fresta de fundo entre os dois,
  // e e por isso que os dois saem daqui e nao de dois calculos parecidos.

  const mar: Caixa = {
    x: w.shoreX - w.seaWidth,
    y: w.waterY,
    w: w.seaWidth + 240,
    h: w.seaDepth,
  };
  /*
   * O caminho vai ALEM das duas caixas, em cima e embaixo, e cada recorte
   * PRENDE o que sobra na propria borda em vez de descartar. Descartar seria
   * o mesmo defeito de sempre: o ponto que falta vira uma reta ligando os dois
   * vizinhos, e essa reta e uma emenda visivel bem na linha d'agua.
   */
  const preso = (c: Caixa): CostaPonto[] =>
    degraus(perfil, 0).map((p) => ({ x: p.x, y: Math.max(c.y, Math.min(c.y + c.h, p.y)) }));

  const linhaMar = preso(mar);
  const marClip = poligono(
    [
      { x: mar.x, y: mar.y },
      ...linhaMar,
      { x: mar.x, y: mar.y + mar.h },
    ],
    mar,
  );

  const areia: Caixa = {
    x: w.shoreX - 240,
    y: w.sandY,
    w: WORLD_W - w.shoreX + 400,
    h: fundo + 420 - w.sandY,
  };
  const areiaClip = poligono(
    [
      ...preso(areia),
      { x: areia.x + areia.w, y: areia.y + areia.h },
      { x: areia.x + areia.w, y: areia.y },
    ],
    areia,
  );

  // ------------------------------------------------------------- as faixas
  //
  // Uma faixa e o caminho deslocado para os dois lados e fechado: `-esq` entra
  // na agua, `+dir` entra na areia. Trocar a ondulacao da costa move todas
  // juntas, porque todas sao `perfil`.

  const faixa = (esq: number, dir: number): string =>
    poligono([...degraus(perfil, -esq), ...degraus(perfil, dir).reverse()], caixa);

  /*
   * A AGUA RASA ATRAVESSA A COSTA.
   *
   * Ela nao para na beira da agua: avanca `shoreRasoAvanco` unidades por cima
   * do tile de areia, translucida, e e essa sobreposicao que faz a praia
   * entrar na agua em vez de encostar nela. Duas faixas, e nao um degrade: a
   * de tras mais larga e mais apagada, a da frente fina e mais clara.
   */
  const raso = faixa(w.shoreRaso, 0);
  const rasoFundo = faixa(w.shoreRaso * 2.2, 0);

  /*
   * A LAMINA SOBRE A AREIA e uma camada propria, e nao a ponta da faixa de
   * cima. O motivo e de cor: agua turquesa a 34% por cima de areia amarela da
   * verde-oliva, que le como limo, nao como agua. Sobre areia clara a agua
   * rasa aparece MAIS CLARA que a areia, com um resto de ciano - entao esta
   * camada e clara e a de dentro d'agua e saturada, e as duas se encontram
   * exatamente em cima da linha da espuma, que e o que esconde a junta.
   */
  const rasoAreia = faixa(0, w.shoreRasoAvanco);

  /*
   * A AREIA MOLHADA COMECA ONDE A AGUA RASA TERMINA.
   *
   * Ela nao encosta na costa: fica DEPOIS do avanco da agua rasa, ja em areia
   * exposta. Debaixo da agua ela nao teria o que fazer - a faixa molhada e
   * justamente o rastro que a onda deixa quando recua, e a ordem da praia e
   * agua funda, agua rasa, espuma, areia molhada, areia seca.
   */
  const molhada = faixa(-w.shoreRasoAvanco, w.shoreRasoAvanco + w.shoreMolhada);

  /*
   * A ESPUMA e polilinha, e nao poligono: quem a quebra em pedacos e o
   * `stroke-dasharray` do CSS. Linha branca continua ao longo da costa e o
   * defeito classico de praia em 2D.
   */
  const pts = degraus(perfil, 0);
  const espuma = pts
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x - caixa.x} ${p.y - caixa.y}`)
    .join(' ');

  return {
    caixa,
    perfil,
    costaX,
    mar,
    marClip,
    areia,
    areiaClip,
    raso,
    rasoFundo,
    rasoAreia,
    molhada,
    espuma,
  };
}
