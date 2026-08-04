import { useSyncExternalStore } from 'react';
import type { SkyPhaseId } from '../data/skies';

/**
 * A planta do mundo em forma de dados.
 *
 * Antes altura do mar, largura da agua, faixa de areia e ritmo das ondas eram
 * numero fixo no `layout.ts` e no CSS. Dava para mudar tudo isso - abrindo o
 * codigo. Agora e configuracao salva no navegador, que a secao MUNDO do editor
 * edita e o jogo le a cada quadro.
 *
 * Os numeros da semente sao os do pedido de 2026:
 *
 *   - o mar ficou SEIS vezes mais fundo (348 -> 2088 unidades) e QUATRO vezes
 *     mais largo (1800 -> 7200);
 *   - a faixa de areia caiu para 20% do que era (352 -> 70): esta cena e sobre
 *     o que acontece ACIMA da areia, o que esta embaixo nao interessa;
 *   - o ENQUADRAMENTO (`frameH`) deixou de ser a altura do mundo. A tela mostra
 *     720 unidades com a linha d'agua sempre na mesma altura; o resto do mar
 *     existe abaixo e so aparece quando a camera abre.
 *
 * Por isso "mundo mais fundo" nao encolheu o jogo: fundo e enquadramento sao
 * duas coisas separadas agora.
 */

export interface WorldConfig {
  // --------------------------------------------------------------- geometria
  /** linha d'agua: acima e ceu, abaixo e mar */
  waterY: number;
  /** quanto de agua existe abaixo da linha d'agua */
  seaDepth: number;
  /** quanto de agua existe para a esquerda da praia */
  seaWidth: number;
  /** onde o mar encontra a areia */
  shoreX: number;
  /** topo da areia da praia */
  sandY: number;
  /** quanto de areia aparece abaixo do topo */
  sandDepth: number;
  /** piso do deck do pier */
  pierY: number;

  // ----------------------------------------------------------- enquadramento
  /** quantas unidades de altura cabem na tela com zoom 1 */
  frameH: number;
  /**
   * ONDE A LINHA D'AGUA FICA NA TELA, de 0 (topo) a 1 (pe).
   *
   * Este numero responde a uma pergunta so: quando a camera abre no pier e
   * passa a mostrar mais mundo, O QUE FICA PARADO? A resposta e a linha
   * d'agua, e este e o ponto da TELA em que ela fica.
   *
   * 0,5 poe o mar no meio: metade ceu, metade agua. Baixando para 0,3, a linha
   * d'agua sobe na tela e sobra mais agua embaixo. Subindo para 0,8, ela desce
   * e sobra mais ceu em cima.
   *
   * Sem uma ancora a cena inteira escorregaria quando o enquadramento mudasse:
   * o horizonte subiria e desceria a cada vez que o Juggler cruza o limiar, e
   * e isso que da enjoo em jogo lateral.
   */
  waterAnchor: number;
  /**
   * DESLOCAMENTO DA MOLDURA, em unidades de mundo.
   *
   * A ancora acima e uma fracao da TELA e esta presa a linha d'agua. Para uma
   * cena que e quase toda ceu - pouco chao embaixo, muito ar em cima - a
   * ancora sozinha nao chega la: ela vai ate a borda e para.
   *
   * Este numero e o resto do caminho, e ele e solto: POSITIVO sobe a moldura
   * (mostra mais ceu), NEGATIVO desce (mostra mais chao e mais agua). Nao tem
   * limite, e por isso a moldura do editor arrasta no vertical sem esbarrar em
   * nada.
   */
  frameOffsetY: number;
  /** enquadramento do lado da praia (1 = o normal) */
  frameLand: number;
  /** enquadramento do lado do mar: menor = camera mais aberta, mais mar */
  frameSea: number;
  /** quanto tempo a troca de enquadramento leva, em segundos */
  frameEase: number;

  // --------------------------------------------------------------- parallax
  /**
   * O QUANTO CADA FAIXA DE FUNDO ANDA COM A CAMERA.
   *
   * 1 e andar junto com o mundo; 0 e ficar parado, colado na tela. A faixa
   * LONGE leva montanha e neblina de horizonte, a MEIO leva as ilhas.
   *
   * Estes dois numeros estavam escritos em pedra no `editor/types.ts`. Sao
   * decisao de olho - o quanto o horizonte "desliza" quando se anda so se
   * acerta mexendo e olhando - e por isso viraram slider.
   *
   * A terceira faixa (PERTO) e sempre 1 e nao aparece no editor: ela e o
   * proprio mundo, e mundo que anda em velocidade diferente da camera nao e
   * parallax, e bug.
   */
  parallaxFar: number;
  parallaxMid: number;

  // ------------------------------------------------------------ linha de costa
  /**
   * A COSTA, em parametros e nao em numeros soltos pelo codigo.
   *
   * Tudo o que desenha a beirada da praia - o perfil da areia, a agua rasa, a
   * espuma, a areia molhada e a sombra do pier - sai daqui. Sao decisoes de
   * olho, e decisao de olho se acerta mexendo e olhando.
   */
  /**
   * O quanto a costa anda para os lados, em unidades.
   *
   * Este e o numero que impede a parede vertical: 0 devolve uma reta perfeita
   * entre agua e areia, 10 da as reentrancias de 4 a 12 unidades que a beira
   * do mar tem. Acima de uns 24 a costa comeca a ler como rasgo, e nao como
   * praia.
   */
  shoreIrregular: number;
  /** altura de cada degrau da costa, em unidades (a de verdade varia de 1 a 3x) */
  shorePasso: number;

  /** espessura da faixa de agua rasa, do lado da agua */
  shoreRaso: number;
  /** o quanto a agua rasa AVANCA por cima da areia */
  shoreRasoAvanco: number;
  shoreRasoAlfa: number;

  /** espessura da areia molhada, do lado da areia */
  shoreMolhada: number;
  shoreMolhadaAlfa: number;

  /** grossura do traco da espuma */
  shoreEspuma: number;
  /** quantas unidades a onda sobe na areia e volta, e em quantos segundos */
  shoreEspumaOnda: number;
  shoreEspumaSeg: number;

  // ------------------------------------------------------------------ ondas
  /** altura da faixa de espuma e ondas, em unidades */
  waveH: number;
  /** o quanto a faixa sobe acima da linha d'agua */
  waveLift: number;
  foamOpacity: number;
  swellOpacity: number;
  glintOpacity: number;
  /** segundos que a onda leva para dar uma passada */
  swellSeconds: number;
  foamSeconds: number;
  /** quanto a onda sobe e desce, em unidades */
  waveBob: number;

  // ------------------------------------------------------------ tela de titulo
  /**
   * A hora do dia da TELA DE MENU.
   *
   * O menu nao acompanha mais o relogio: abrir o jogo de madrugada nao muda a
   * tela de titulo. E uma tela de apresentacao, e apresentacao que muda sozinha
   * nao e apresentacao. Aqui voce escolhe qual ceu ela usa, e pronto.
   */
  menuHour: SkyPhaseId;
}

export function seedWorld(): WorldConfig {
  return {
    waterY: 372,
    seaDepth: 2088,
    seaWidth: 7200,
    shoreX: 1400,
    sandY: 368,
    sandDepth: 70,
    pierY: 336,

    frameH: 720,
    waterAnchor: 0.517,
    frameOffsetY: 0,
    frameLand: 1,
    frameSea: 0.42,
    frameEase: 0.9,

    parallaxFar: 0.22,
    parallaxMid: 0.52,

    /*
     * A COSTA ONDULA POUCO E EM BLOCO.
     *
     * 10 unidades de amplitude com degrau de 4 da reentrancia de 4 a 12 - a
     * faixa que o pedido descreve. O degrau de 28 unidades, sorteado de 1 a 3
     * vezes, poe entre 28 e 84 unidades de costa reta entre uma mudanca e
     * outra: e o que separa "praia irregular" de "serrilhado de 1 pixel".
     */
    shoreIrregular: 10,
    shorePasso: 28,

    shoreRaso: 42,
    shoreRasoAvanco: 28,
    shoreRasoAlfa: 0.34,

    shoreMolhada: 16,
    shoreMolhadaAlfa: 0.3,

    shoreEspuma: 5,
    shoreEspumaOnda: 10,
    shoreEspumaSeg: 7,

    waveH: 44,
    waveLift: 20,
    foamOpacity: 0.75,
    swellOpacity: 0.55,
    glintOpacity: 0.4,
    swellSeconds: 9,
    foamSeconds: 6,
    waveBob: 5,

    menuHour: 'por-do-sol',
  };
}

const KEY = 'juggler-fishing/mundo/v1';

function load(): WorldConfig {
  const seed = seedWorld();
  if (typeof localStorage === 'undefined') return seed;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return seed;
    return { ...seed, ...(JSON.parse(raw) as Partial<WorldConfig>) };
  } catch {
    return seed;
  }
}

let state: WorldConfig = load();
const listeners = new Set<() => void>();

function notify() {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    /* sem espaco: vale so em memoria */
  }
  for (const l of listeners) l();
}

function subscribe(fn: () => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

export function getWorld(): WorldConfig {
  return state;
}

export function useWorld(): WorldConfig {
  return useSyncExternalStore(subscribe, getWorld, getWorld);
}

export function updateWorld(patch: Partial<WorldConfig>): void {
  state = { ...state, ...patch };
  notify();
}

export function resetWorld(): void {
  state = seedWorld();
  notify();
}

// ------------------------------------------------------------------ derivados

/** Fundo do mar, em unidades de mundo. */
export function seaBottom(): number {
  return state.waterY + state.seaDepth;
}

/** Borda esquerda da agua. E negativa: o mar aberto passa do zero do mundo. */
export function seaLeft(): number {
  return state.shoreX - state.seaWidth;
}

/** Pe da areia da praia. */
export function sandBottom(): number {
  return state.sandY + state.sandDepth;
}

/** O ponto mais baixo que existe no mundo. */
export function worldBottom(): number {
  return Math.max(seaBottom(), sandBottom());
}

/**
 * Ate onde a tela pode descer e subir na camera livre e no editor.
 *
 * O limite antigo era o TRANSBORDO: so dava para mover no vertical quando o
 * zoom fazia o mundo passar da altura da tela, e mesmo assim so metade disso.
 * Com o mar seis vezes mais fundo, isso queria dizer que o fundo do mar e o
 * subsolo da praia eram inalcancaveis - havia cenario ali que ninguem
 * conseguia editar.
 *
 * O limite agora e o MUNDO, com uma tela de folga de cada lado: sobe ate acima
 * do ceu e desce ate embaixo da areia. Sao unidades de mundo, e valores
 * positivos olham para CIMA (o desenho desce na tela).
 */
export function panMaxY(): number {
  return state.frameH;
}

export function panMinY(): number {
  return -(worldBottom() - state.waterY + state.frameH);
}
