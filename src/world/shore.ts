import type { WorldConfig } from './worldConfig';

/**
 * A LINHA DE COSTA, calculada UMA VEZ.
 *
 * O que havia antes: a areia submersa era um bloco recortado, e por cima dela
 * um `.shore-veil` - um degradê vertical que ia de transparente a `#02131f`
 * em 460 unidades. Esse era o defeito, e ele tem nome: a rampa do MAR chega
 * nessa cor só a 2 088 unidades de profundidade, então a beirada da praia
 * ficava preta enquanto o mar aberto ao lado dela, na mesma altura, continuava
 * azul médio. Não era sombra nem máscara errada - era uma segunda rampa de cor,
 * mais curta e mais escura que a da água, encostada na primeira.
 *
 * Aqui não há degradê nenhum entre água e areia. Há um PERFIL - a superfície da
 * areia descendo para dentro do mar - e cinco coisas derivadas dele:
 *
 *   1. a massa de areia submersa, recortada pelo perfil;
 *   2. faixas discretas de profundidade por cima dela, na cor que a ÁGUA tem
 *      naquela profundidade (é isso que faz a areia sumir sem escurecer);
 *   3. a faixa de água rasa, acompanhando o perfil pelo lado da água;
 *   4. a espuma, em cima do perfil;
 *   5. a areia molhada, acompanhando o perfil pelo lado da areia.
 *
 * Todas saem do MESMO array de pontos. É a exigência que mais importa: quatro
 * formas geradas em separado desalinham no primeiro ajuste de `sandY`, e o
 * desalinho aparece como costura branca ou como sombra dupla.
 *
 * ------------------------------------------------------ o corte é de perfil
 *
 * Isto não é uma praia vista de cima. A cena é um corte transversal: a água
 * fica à ESQUERDA, a areia à DIREITA, e a "linha de costa" é a superfície da
 * areia mergulhando. Por isso "faixa do lado da água" quer dizer ACIMA do
 * perfil, e "faixa do lado da areia" quer dizer ABAIXO dele.
 */

/** Lado do tile de areia. O perfil anda nesta grade para não sair do encaixe. */
export const GRADE = 32;

export interface CostaPonto {
  x: number;
  y: number;
}

export interface FaixaProfundidade {
  /** topo da faixa, relativo à caixa */
  topo: number;
  alt: number;
  /** a que profundidade de água esta faixa corresponde, em unidades */
  profundidade: number;
  /** o quanto ela apaga a areia, de 0 a 1 */
  alfa: number;
}

export interface Costa {
  /** a caixa comum a todas as camadas, em unidades de mundo */
  caixa: { x: number; y: number; w: number; h: number };
  /** o perfil, da esquerda (fundo) para a direita (praia seca) */
  perfil: CostaPonto[];
  /** onde o perfil cruza a linha d'água: é aqui que a praia começa */
  costaX: number;
  /** massa de areia: do perfil para baixo */
  areia: string;
  /** faixa de água rasa: do perfil para cima, no lado da água */
  raso: string;
  /** a mesma faixa, mais grossa - a segunda banda discreta */
  rasoFundo: string;
  /** areia molhada: do perfil para baixo, no lado da areia */
  molhada: string;
  /** linha da espuma, para o `d` de um `<path>` */
  espuma: string;
  /** as bandas que apagam a areia conforme ela afunda */
  faixas: FaixaProfundidade[];
  /**
   * Ate onde as bandas de profundidade vao, relativo a caixa.
   *
   * Elas param na COSTA, e nao na borda da caixa. A massa de areia continua
   * para a direita - e a praia seca, vista de perfil, com subsolo - e uma banda
   * de profundidade em cima dela pintaria de azul o que esta debaixo da areia
   * enxuta. Foi exatamente o que aconteceu na primeira tentativa: a praia
   * inteira ficou dentro d'agua abaixo de uma certa altura.
   */
  faixaLarg: number;
}

/**
 * A COR DA ÁGUA numa dada profundidade.
 *
 * Esta função é o conserto do degradê preto. Ela reproduz as mesmas paradas do
 * `background` do `.sea` - topo até 4%, meio em 42%, fundo em 100% - sobre a
 * profundidade REAL do mar. Assim a banda que apaga a areia a 300 unidades usa
 * exatamente a cor que a água tem a 300 unidades, e a beirada da praia deixa
 * de destoar do mar aberto que está do lado dela.
 */
export function corDoMar(
  profundidade: number,
  p: { seaTop: string; seaBottom: string },
  seaDepth: number,
): string {
  const t = Math.max(0, Math.min(1, profundidade / Math.max(1, seaDepth)));
  const paradas: [number, string][] = [
    [0.04, p.seaTop],
    [0.42, p.seaBottom],
    [1, '#02131f'],
  ];
  if (t <= paradas[0][0]) return p.seaTop;
  for (let i = 1; i < paradas.length; i++) {
    const [t1, c1] = paradas[i];
    const [t0, c0] = paradas[i - 1];
    if (t <= t1) return mistura(c0, c1, (t - t0) / (t1 - t0));
  }
  return '#02131f';
}

function hex(c: string): [number, number, number] {
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

/** Clareia uma cor em direção ao branco: a água rasa é a de cima, mais clara. */
export function clareia(c: string, t: number): string {
  return mistura(c, '#ffffff', t);
}

/**
 * Quantiza para a grade de desenho.
 *
 * Sem isto o perfil nasce em coordenadas fracionárias e, com a cena escalada
 * por um número que não é inteiro, cada vértice cai entre dois pixels - o
 * recorte serrilha de um jeito que não parece pixel art, parece antialias
 * quebrado.
 */
function naGrade(v: number, passo = 4): number {
  return Math.round(v / passo) * passo;
}

/**
 * Um sorteio com semente: o mesmo mundo dá a mesma costa.
 *
 * `Math.random()` aqui seria um erro que só aparece em movimento: a costa
 * mudaria a cada render do React, e o requisito "não gere ruído aleatório
 * diferente a cada frame" existe justamente por isso.
 */
function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

/** Junta pontos num `polygon()` de `clip-path`, em px relativos à caixa. */
function poligono(pts: CostaPonto[], cx: number, cy: number): string {
  return `polygon(${pts.map((p) => `${p.x - cx}px ${p.y - cy}px`).join(',')})`;
}

export function calcularCosta(w: WorldConfig): Costa {
  const colunas = Math.max(4, Math.round(w.shoreColunas));
  const r = rng(20260805);

  /*
   * O PERFIL.
   *
   * A queda é uma curva (`n^curva`), e não um passo constante: passo constante
   * é uma diagonal reta feita de blocos, e praia nenhuma desce assim - a beira
   * é quase plana e o fundo cai depois. O sorteio por coluna tira a aparência
   * de fórmula sem virar ruído: a amplitude é uma fração do degrau, então o
   * perfil continua monotônico e legível.
   */
  const seco = w.shoreX - 60;
  const perfil: CostaPonto[] = [];
  for (let n = colunas; n >= 1; n--) {
    const queda = w.shoreQueda * Math.pow(n, w.shoreCurva) + (r() - 0.5) * w.shoreIrregular;
    perfil.push({
      x: naGrade(seco - n * GRADE, GRADE),
      y: naGrade(w.sandY + Math.max(2, queda)),
    });
  }
  // a praia seca: o perfil continua reto até bem depois da orla
  const direita = naGrade(seco + w.shoreMolhadaAvanco + 200, GRADE);
  perfil.push({ x: seco, y: naGrade(w.sandY) });
  perfil.push({ x: direita, y: naGrade(w.sandY) });

  /** Onde o perfil cruza a linha d'água, andando da direita para a esquerda. */
  let costaX = perfil[perfil.length - 1].x;
  for (let i = perfil.length - 1; i >= 0; i--) {
    if (perfil[i].y >= w.waterY) {
      costaX = perfil[i].x;
      break;
    }
  }

  const esq = perfil[0].x;
  const topo = naGrade(Math.min(w.sandY, w.waterY) - w.shoreRaso * 2 - 16);
  const fundo = naGrade(w.waterY + w.shoreFundo);
  const caixa = { x: esq, y: topo, w: direita - esq, h: fundo - topo };

  // ------------------------------------------------------------- as formas

  /** Um degrau por ponto: sobe reto, anda reto. É o que dá o serrilhado certo. */
  const degraus = (pts: CostaPonto[], dy: number): CostaPonto[] => {
    const out: CostaPonto[] = [];
    for (let i = 0; i < pts.length; i++) {
      out.push({ x: pts[i].x, y: pts[i].y + dy });
      const prox = pts[i + 1];
      if (prox) out.push({ x: prox.x, y: pts[i].y + dy });
    }
    return out;
  };

  const areia = poligono(
    [...degraus(perfil, 0), { x: direita, y: fundo }, { x: esq, y: fundo }],
    caixa.x,
    caixa.y,
  );

  /** Recorta o perfil numa janela de x, para as faixas não irem até o fundo. */
  const janela = (x0: number, x1: number): CostaPonto[] =>
    perfil.filter((p) => p.x >= x0 && p.x <= x1);

  const faixa = (pts: CostaPonto[], espessura: number): string => {
    if (pts.length < 2) return 'polygon(0 0,0 0,0 0)';
    const cima = degraus(pts, -espessura);
    const baixo = degraus(pts, 0).reverse();
    return poligono([...cima, ...baixo], caixa.x, caixa.y);
  };

  /*
   * A faixa rasa PARA NA COSTA.
   *
   * Sem o limite à direita ela seguia o perfil até o fim da caixa - e à direita
   * da costa o perfil é a praia seca, então a faixa virava uma tira de água
   * pairando 34 unidades ACIMA da areia enxuta. É o tipo de erro que só
   * aparece na tela: a geometria estava certa, o domínio é que estava errado.
   */
  const raso = faixa(janela(costaX - w.shoreRasoLarg, costaX), w.shoreRaso);
  const rasoFundo = faixa(
    janela(costaX - w.shoreRasoLarg * 1.8, costaX),
    w.shoreRaso * 2.2,
  );

  const ptsMolhada = janela(costaX - w.shoreMolhadaRecuo, costaX + w.shoreMolhadaAvanco);
  const molhada = (() => {
    if (ptsMolhada.length < 2) return 'polygon(0 0,0 0,0 0)';
    const cima = degraus(ptsMolhada, 0);
    const baixo = degraus(ptsMolhada, w.shoreMolhada).reverse();
    return poligono([...cima, ...baixo], caixa.x, caixa.y);
  })();

  /*
   * A ESPUMA é uma polilinha, e não um polígono: ela é traçada com `stroke`, e
   * é o `stroke-dasharray` que a quebra em pedaços. Uma linha branca contínua
   * ao longo da costa é o defeito clássico de praia em jogo 2D.
   */
  const ptsEspuma = degraus(
    janela(costaX - w.shoreEspumaRecuo, costaX + w.shoreEspumaAvancoX),
    0,
  );
  const espuma = ptsEspuma.length
    ? ptsEspuma
        .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x - caixa.x} ${p.y - caixa.y}`)
        .join(' ')
    : 'M 0 0';

  /*
   * AS FAIXAS DE PROFUNDIDADE.
   *
   * Discretas de propósito - cinco degraus de cor, sem interpolação - porque é
   * assim que água funda se desenha em pixel art. Cada uma usa a cor que a
   * ÁGUA tem naquela profundidade (`corDoMar`), e não uma cor escura inventada:
   * é essa escolha que faz a beirada da praia combinar com o mar aberto ao
   * lado dela em vez de virar uma mancha preta.
   */
  const faixas: FaixaProfundidade[] = [];
  const passos = 8;
  const alto = w.waterY + w.shoreRaso;
  const alcance = fundo - alto;
  for (let i = 0; i < passos; i++) {
    const y0 = alto + (alcance * i) / passos;
    const y1 = alto + (alcance * (i + 1)) / passos;
    const prof = (y0 + y1) / 2 - w.waterY;
    faixas.push({
      topo: naGrade(y0) - caixa.y,
      alt: Math.max(1, naGrade(y1) - naGrade(y0)),
      /*
       * A profundidade REAL do meio da faixa. É dela que sai a cor, e é por
       * isso que as bandas continuam escurecendo depois que a areia já sumiu:
       * elas seguem a mesma rampa do mar aberto ao lado. A primeira tentativa
       * parava de escurecer no fim da absorção e o resultado era um retângulo
       * ciano chapado - piscina, não mar.
       */
      profundidade: prof,
      alfa: Math.min(1, (y0 - w.waterY) / Math.max(1, w.shoreAbsorcao)),
    });
  }
  // a última desce até o pé da caixa: abaixo dela não há mais areia para ver
  const ultima = faixas[faixas.length - 1];
  ultima.alt = Math.max(ultima.alt, caixa.h - ultima.topo);

  return {
    caixa,
    perfil,
    costaX,
    areia,
    raso,
    rasoFundo,
    molhada,
    espuma,
    faixas,
    // um tile de folga para a banda nao terminar exatamente no degrau
    faixaLarg: Math.max(0, costaX + GRADE - caixa.x),
  };
}
