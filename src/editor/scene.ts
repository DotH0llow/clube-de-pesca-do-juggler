import { useSyncExternalStore } from 'react';
import { aspectOf } from '../assets/dims';
import {
  BEACH,
  CABANA,
  FOREST,
  FOREST_START,
  MARKET,
  MARKET_X,
  PIER_END,
  PIER_PROPS,
  PIER_RAMP,
  PIER_START,
  PIER_Y,
  ROD_X,
  SAND_Y,
  SEAFLOOR,
  SHORE,
  SPAWN_X,
  UNDERWATER_LIFE,
  WATER_Y,
  WORLD_W,
  type Prop,
} from '../world/layout';
import { setPisos } from '../world/ground';
import { islandObjects, menuIslandObjects } from '../world/islands';
import { largura, peca, pierPieces } from '../world/pier';
import { pier25Pieces } from '../world/pier25';

/**
 * Qual cais o jogo monta.
 *
 * `true`  - o 2.5D gerado por script (`world/pier25.ts`)
 * `false` - o de PERFIL, desenhado a mao (`world/pier.ts`)
 *
 * O interruptor existe porque a troca nao e obviamente melhor. O 2.5D ganha o
 * angulo pedido e o tampo a mostra, mas as pecas dele sao GERADAS - cor chapada
 * com um pouco de grao por cima - e perdem para a estaca roliça com colar de
 * corda que veio desenhada no pacote. Lado a lado, o de perfil tem mais peso.
 *
 * Trocar aqui troca o cais inteiro. A cena salva acompanha: quem ja tem cais
 * 2.5D salvo e voltar para `false` precisa apagar as pecas `pier25-` no editor,
 * ou usar RESETAR na cena.
 */
const USAR_PIER_25 = true;

/**
 * Geracao do cais montado na cena.
 *
 * Suba este numero sempre que a composicao do cais mudar de forma que uma cena
 * ja salva precise ser refeita. E o que garante que a troca chegue em quem ja
 * jogou - sem isso, a migracao so acontece em maquina que nunca abriu o jogo,
 * que e justamente onde ela nao faz falta.
 *
 *   1  cais de perfil, desenhado a mao
 *   2  2.5D de baixa resolucao, misturado com estrutura de perfil, sem rampa
 *   3  a-raso puro, em resolucao de verdade, com rampa
 *   4  deck terminando no fim do cais (a "segunda rampa" era ele passando do
 *      ponto), corrimao emendando no mourao e rampa encostando na areia
 */
const PIER_VERSAO = 4;
import { seaBottom, seaLeft } from '../world/worldConfig';
import { ZONAS_REPETIVEIS } from './types';
import type { LayerId, SceneId, SceneObject, SceneState, ShapeKind, ZoneId } from './types';

/*
 * A v5 refez o CENARIO: o pier virou pacote de pecas de verdade (era uma div
 * com tabua de fundo), as ilhas viraram sprite por sprite (era uma faixa
 * repetida), a mata deixou de ser gradiente e apareceu o ponto de nascimento.
 * Nada disso da para remendar em cima da cena antiga - a v4 dela e jogada fora
 * e o cenario volta pela semente. O que se salva de verdade e a configuracao
 * de MUNDO e a de MECANICAS, que moram em outra chave e continuam valendo.
 */
const KEY = 'juggler-fishing/cena/v5';
const KEY_V4 = 'juggler-fishing/cena/v4';
const KEY_V3 = 'juggler-fishing/cena/v3';
const KEY_V2 = 'juggler-fishing/cena/v2';

/** Tamanho de desenho da tela de menu. */
export const MENU_W = 1280;
export const MENU_H = 720;

/**
 * As cenas do jogo em forma de dados.
 *
 * Duas cenas hoje: `mundo` (o cais jogavel) e `menu` (a tela de titulo). As
 * duas usam a MESMA lista de objetos, o MESMO renderizador e o MESMO editor -
 * muda so quem esta ativo.
 *
 * Cada objeto tem uma camada de trabalho (`layer`, a gaveta) e uma
 * profundidade (`depth`, 0 a 10, quem fica na frente). Sao coisas diferentes de
 * proposito: da para ter tralha de OBJETOS atras do cenario e vice-versa.
 */

// ------------------------------------------------------------------ semente

let seq = 0;

/**
 * Onde cada familia de sprite mora, por padrao.
 *
 * Serve para dois usos: montar a semente e reclassificar cena antiga sem perder
 * o que voce ja tinha movido de lugar.
 */
export const SPRITE_HOME: { match: RegExp; layer: LayerId; depth: number }[] = [
  // horizonte: e isso que o BACKGROUND deve conter
  { match: /^sky\/(distant-mountain|horizon-haze|sunset-cloud|night-cloud)/, layer: 'fundo', depth: 0 },
  // as ilhas do pacote novo: horizonte, sempre
  { match: /^island\//, layer: 'fundo', depth: 0 },
  { match: /^bg\//, layer: 'fundo', depth: 0 },
  { match: /^sky\//, layer: 'fundo', depth: 0 },
  // o pacote do pier e estrutura, nao tralha
  { match: /^pier\/(deck|rail|post-cap|cleat)/, layer: 'cenario', depth: 5 },
  { match: /^pier\//, layer: 'cenario', depth: 4 },
  // fundo do mar e vida submersa sao OBJETOS, nao background
  { match: /^props\/(cave-entrance|seafloor-|sunken-driftwood|kelp-stalk|aquatic-plant|coral-cluster|light-ray)/, layer: 'objetos', depth: 1 },
  { match: /^marine\//, layer: 'objetos', depth: 1 },
  { match: /^fx\/underwater-/, layer: 'objetos', depth: 1 },
  { match: /^props\/decorative-fish-school/, layer: 'objetos', depth: 1 },
  // estrutura do pier
  { match: /^props\/pier-(post|ladder)/, layer: 'cenario', depth: 4 },
  { match: /^props\/fishing-boat/, layer: 'cenario', depth: 3 },
  // vegetacao e construcao ficam de pe no mapa
  { match: /^nature\//, layer: 'cenario', depth: 3 },
  { match: /^props\/(beach-cabana|fish-market-stall)/, layer: 'cenario', depth: 3 },
  // tralha solta
  { match: /^props\/fishing-rod/, layer: 'objetos', depth: 6 },
  { match: /^props\//, layer: 'objetos', depth: 6 },
  { match: /^trash\//, layer: 'objetos', depth: 6 },
  { match: /^fish\//, layer: 'objetos', depth: 6 },
];

export function homeOf(sprite: string): { layer: LayerId; depth: number } {
  for (const rule of SPRITE_HOME) if (rule.match.test(sprite)) return { layer: rule.layer, depth: rule.depth };
  return { layer: 'objetos', depth: 6 };
}

function fromProp(p: Prop, layer: LayerId, depth: number, under = false): SceneObject {
  const w = Math.round(p.h * aspectOf(p.sprite));
  return {
    id: `${p.sprite.split('/').pop()}-${++seq}`,
    layer,
    kind: 'sprite',
    sprite: p.sprite,
    x: p.x,
    y: p.y - p.h,
    w,
    h: p.h,
    rot: 0,
    depth,
    flip: p.flip,
    opacity: p.opacity,
    under,
    anim: p.className,
  };
}

/** Faixa que se repete no horizonte e anda mais devagar que a camera. */
function strip(
  id: string,
  sprite: string,
  y: number,
  h: number,
  parallax: number,
  opacity: number,
): SceneObject {
  return {
    id,
    layer: 'fundo',
    kind: 'strip',
    sprite,
    // a faixa cobre a agua inteira mais uma folga: o mar ficou quatro vezes
    // mais largo e o horizonte nao pode terminar no meio da tela
    x: seaLeft() - 400,
    y,
    w: WORLD_W - seaLeft() + 800,
    h,
    rot: 0,
    depth: 0,
    opacity,
    parallax,
  };
}

function seedMundo(): SceneObject[] {
  seq = 0;
  const out: SceneObject[] = [];

  // ------------------------------------------------- BACKGROUND (horizonte)
  out.push(strip('horizonte-montanha', 'sky/distant-mountain-strip', WATER_Y - 96, 96, 0.22, 0.55));
  /*
   * As ilhas nao sao mais faixa.
   *
   * `sky/distant-island-strip` era uma tira costurada que se repetia a cada
   * volta: a mesma ilha, na mesma ordem, ate o fim do mar - e nenhuma delas
   * dava para mover, esticar ou trocar. Agora sao 17 sprites soltos em duas
   * distancias de parallax (ver `world/islands.ts`), e cada um e objeto de cena
   * como qualquer outro.
   */
  out.push(...islandObjects());
  out.push(strip('horizonte-neblina', 'sky/horizon-haze-strip', WATER_Y - 26, 40, 0.52, 0.45));

  /*
   * O fundo do mar e a vida submersa foram desenhados quando o mar tinha 348
   * unidades de profundidade. Com 2088 eles ficariam boiando no meio da agua,
   * entao descem junto - a distancia deles para o fundo continua a mesma.
   */
  const fundo = seaBottom() - 720;
  for (const p of SEAFLOOR) out.push(fromProp({ ...p, y: p.y + fundo }, 'objetos', 1, true));
  for (const p of UNDERWATER_LIFE) out.push(fromProp({ ...p, y: p.y + fundo }, 'objetos', 1, true));
  for (const p of SHORE) out.push(fromProp(p, 'objetos', 3));

  // ----------------------------------------------------------- CENARIO
  /*
   * O pier inteiro, peca por peca.
   *
   * Era uma fileira de estacas iguais mais uma DIV com a tabua repetida no
   * fundo: de longe passava, de perto nao tinha viga, nem testeira, nem
   * travessa, nem mao-francesa - e a rampa era um gradiente cortado na
   * diagonal. `world/pier.ts` monta o cais com o pacote `pier/` e devolve tudo
   * como objeto de cena editavel.
   */
  out.push(...(USAR_PIER_25 ? pier25Pieces() : pierPieces()));
  out.push({
    id: 'barco-ancorado',
    layer: 'cenario',
    kind: 'sprite',
    sprite: 'props/fishing-boat-idle-side',
    x: PIER_START - 420,
    y: 314,
    w: Math.round(118 * aspectOf('props/fishing-boat-idle-side')),
    h: 118,
    rot: 0,
    depth: 3,
    anim: 'balanco',
  });
  /*
   * A mata do fim do mapa.
   *
   * Era uma caixa de gradiente radial: quatro borroes verdes em CSS fazendo as
   * vezes de floresta, travada para ninguem mexer. Saiu. No lugar entra uma
   * fileira de arvore de verdade do pacote `nature`, escurecida e empurrada
   * para tras - massa de mata feita de arvore, e nao de cor.
   */
  const matas = [
    'nature/black-mangrove',
    'nature/casuarina',
    'nature/coastal-fig',
    'nature/red-mangrove',
    'nature/sea-hibiscus',
    'nature/white-mangrove',
    'nature/cashew-tree',
    'nature/pandanus',
  ];
  for (let mx = FOREST_START - 60, n = 0; mx < WORLD_W + 120; mx += 96, n++) {
    const sprite = matas[n % matas.length];
    const h = 250 + ((n * 37) % 90);
    out.push({
      id: `mata-fundo-${n}`,
      layer: 'cenario',
      kind: 'sprite',
      sprite,
      x: mx,
      y: SAND_Y + 14 - h,
      w: Math.round(h * aspectOf(sprite)),
      h,
      rot: 0,
      depth: 2,
      flip: n % 3 === 0,
      opacity: 0.9,
      anim: 'mata-fundo',
    });
  }
  for (const p of BEACH) out.push(fromProp(p, 'cenario', 3));
  for (const p of MARKET) out.push(fromProp(p, 'cenario', 3));
  for (const p of CABANA) out.push(fromProp(p, 'cenario', 3));
  for (const p of FOREST) out.push(fromProp(p, 'cenario', 3));

  // ---------------------------------------------------------- OBJETOS
  for (const p of PIER_PROPS) out.push(fromProp(p, 'objetos', 6));
  out.push({
    id: 'vara-de-pesca',
    layer: 'objetos',
    kind: 'sprite',
    sprite: 'props/fishing-rod',
    x: ROD_X,
    y: PIER_Y - 122,
    w: Math.round(128 * aspectOf('props/fishing-rod')),
    h: 128,
    rot: 0,
    depth: 6,
    flip: true,
    role: 'vara',
  });

  // ----------------------------------------------------- INTERAGIVEIS
  out.push({
    id: 'area-vara',
    layer: 'interagiveis',
    kind: 'zone',
    zone: 'vara',
    x: ROD_X - 120,
    y: PIER_Y - 145,
    w: 240,
    h: 180,
    rot: 0,
    depth: 9,
  });
  out.push({
    id: 'area-mercado',
    layer: 'interagiveis',
    kind: 'zone',
    zone: 'mercado',
    x: MARKET_X - 140,
    y: SAND_Y - 205,
    w: 280,
    h: 215,
    rot: 0,
    depth: 9,
  });

  /*
   * As paredes que seguram o Juggler.
   *
   * Isso era `WALK_MIN` e `WALK_MAX`: duas constantes invisiveis que so davam
   * para mudar no codigo. Agora sao caixas de verdade, que aparecem no editor,
   * se arrastam, se redimensionam, se duplicam e se apagam como qualquer outra
   * area. Quem quiser abrir o mapa e so arrastar a parede para longe.
   */
  out.push({
    id: 'parede-oeste',
    layer: 'interagiveis',
    kind: 'zone',
    zone: 'parede',
    x: PIER_START - 10,
    y: PIER_Y - 240,
    w: 60,
    h: 300,
    rot: 0,
    depth: 9,
  });
  out.push({
    id: 'parede-leste',
    layer: 'interagiveis',
    kind: 'zone',
    zone: 'parede',
    x: FOREST_START + 10,
    y: SAND_Y - 240,
    w: 60,
    h: 300,
    rot: 0,
    depth: 9,
  });

  /*
   * O CHAO, em tres pedacos.
   *
   * Isto era `groundAt`: um `if` no `layout.ts` que dizia "ate o fim do pier a
   * altura e a do deck, depois desce numa rampa de 289, depois e a areia".
   * Ninguem conseguia abrir um buraco no meio do deck, pendurar um estrado
   * mais alto na praia ou encurtar a rampa sem abrir o codigo - e o editor nao
   * tinha o que mostrar, porque nao havia objeto nenhum.
   *
   * As tres caixas abaixo dizem exatamente a mesma coisa que o `if` dizia. A
   * diferenca e que agora sao objetos: arraste a borda e o deck fica mais
   * curto, duplique e voce tem um degrau, apague e o chao some. A do meio tem
   * QUEDA, que e o que faz dela uma rampa sem precisar de um tipo proprio.
   */
  const chao = (id: string, x: number, w: number, y: number, queda = 0): SceneObject => ({
    id,
    layer: 'marcadores',
    kind: 'zone',
    zone: 'piso',
    x,
    y,
    w,
    h: 26,
    rot: 0,
    depth: 9,
    queda,
  });
  out.push(chao('chao-deck', PIER_START - 70, PIER_END - (PIER_START - 70), PIER_Y));
  out.push(chao('chao-rampa', PIER_END, PIER_RAMP, PIER_Y, SAND_Y - PIER_Y));
  out.push(chao('chao-praia', PIER_END + PIER_RAMP, WORLD_W - (PIER_END + PIER_RAMP), SAND_Y));

  /*
   * O limiar do pier: a fronteira entre dois enquadramentos.
   *
   * A esquerda dele a camera abre e mostra o mar fundo; a direita ela fecha e
   * volta para a superficie. E uma caixa como as outras, entao da para decidir
   * onde exatamente essa virada acontece.
   */
  out.push({
    id: 'limiar-do-pier',
    layer: 'marcadores',
    kind: 'zone',
    zone: 'limiar',
    x: PIER_END - 180,
    y: PIER_Y - 260,
    w: 90,
    h: 320,
    rot: 0,
    depth: 9,
  });

  /*
   * Onde o Juggler nasce.
   *
   * Era `x.current = 1780`: um numero no meio do `usePlayer`, invisivel no
   * editor e impossivel de mudar sem abrir o codigo. Virou caixa, e ganhou
   * gaveta propria (MARCADORES) para nao se perder no meio de cem coqueiros -
   * ponto de nascimento nao e cenario nem tralha, e referencia de jogo.
   *
   * O botao "Travei!" do celular traz o Juggler de volta exatamente para o meio
   * dela.
   */
  out.push({
    id: 'nascimento',
    layer: 'marcadores',
    kind: 'zone',
    zone: 'spawn',
    x: SPAWN_X - 60,
    y: SAND_Y - 230,
    w: 120,
    h: 240,
    rot: 0,
    depth: 9,
  });

  return out;
}

/**
 * A tela de titulo.
 *
 * Antes era HTML escrito na mao, com posicao em porcentagem: bonito, mas nao
 * dava para mexer sem abrir o codigo. Agora e cena de verdade, com os mesmos
 * objetos e o mesmo editor do mundo. O ceu, o mar e a espuma continuam sendo
 * estrutura (sao gradiente e faixa animada, nao sprite).
 */
const MENU_SEA_Y = 430;
const MENU_DECK_Y = 596;

function menuSprite(
  id: string,
  sprite: string,
  x: number,
  baseY: number,
  h: number,
  depth: number,
  extra: Partial<SceneObject> = {},
): SceneObject {
  return {
    id,
    layer: 'cenario',
    kind: 'sprite',
    sprite,
    x,
    y: baseY - h,
    w: Math.round(h * aspectOf(sprite)),
    h,
    rot: 0,
    depth,
    ...extra,
  };
}

function seedMenu(): SceneObject[] {
  const out: SceneObject[] = [];

  out.push(strip('menu-montanha', 'sky/distant-mountain-strip', MENU_SEA_Y - 104, 104, 0.22, 0.5));
  out.push(strip('menu-neblina', 'sky/horizon-haze-strip', MENU_SEA_Y - 22, 40, 0.52, 0.45));
  for (const s of out) {
    s.x = 0;
    s.w = MENU_W;
  }

  // as ilhas do pacote novo, no lugar da faixa costurada
  out.push(...menuIslandObjects(MENU_SEA_Y, MENU_W));

  out.push(menuSprite('menu-barco', 'props/fishing-boat-idle-side', 120, MENU_SEA_Y + 58, 96, 3, { anim: 'balanco' }));

  /*
   * O deck do menu, com o pacote novo.
   *
   * A tabua do menu era `props/pier-board-side` esticada numa faixa e as
   * estacas eram `props/pier-post-side` repetidas: o menu mostrava um cais que
   * nao existia mais no jogo. Agora ele usa exatamente as mesmas pecas do cais
   * jogavel - se o pier mudar, a tela de titulo muda junto.
   */
  const deckY = MENU_DECK_Y;
  const tabuaW = largura('deck-long');
  for (let x = -20, n = 0; x < MENU_W + 40; x += tabuaW, n++) {
    out.push(peca(n % 3 === 2 ? 'deck-patched' : 'deck-long', { esq: x, topo: deckY, larg: tabuaW, depth: 9 }));
  }
  const fasciaW = largura('deck-fascia');
  for (let x = -20; x < MENU_W + 40; x += fasciaW) {
    out.push(peca('deck-fascia', { esq: x, topo: deckY + 9, larg: fasciaW, depth: 9 }));
  }
  const estacas = [40, 232, 424, 616, 808, 1000, 1192];
  estacas.forEach((x, i) => {
    out.push(peca(i % 2 === 0 ? 'piling-heavy-round' : 'piling-rope-collar', {
      cx: x,
      topo: deckY + 22,
      alt: MENU_H - deckY + 40,
      depth: 8,
    }));
    out.push(peca('knee-brace', { cx: x + 40, topo: deckY + 30, alt: 46, depth: 8 }));
  });
  const railW = largura('rail-long');
  for (let x = -20; x < MENU_W + 40; x += railW) {
    out.push(peca('rail-long', { esq: x, base: deckY + 2, alt: 44, depth: 9, opacity: 0.95 }));
  }
  out.push(peca('cleat-wood', { cx: 460, base: deckY + 2, alt: 30, depth: 10 }));
  out.push(peca('fender-logs', { cx: 152, topo: deckY + 60, alt: 110, depth: 10 }));

  out.push(menuSprite('menu-lanterna', 'props/pier-lantern', 300, MENU_DECK_Y + 4, 176, 9));
  out.push(menuSprite('menu-rede', 'props/capture-net', 560, MENU_DECK_Y + 4, 112, 9));
  out.push(menuSprite('menu-barril', 'props/barrel', 700, MENU_DECK_Y + 4, 96, 9));
  out.push(menuSprite('menu-cesto', 'props/fish-basket', 830, MENU_DECK_Y + 4, 84, 9));

  out.push(menuSprite('menu-coqueiro', 'nature/coconut-palm', -40, MENU_H + 30, 470, 10, { flip: true }));
  out.push(menuSprite('menu-palmeira', 'nature/royal-palm', 1130, MENU_H + 30, 500, 10));

  /*
   * As pecas de INTERFACE da tela de titulo.
   *
   * Eram HTML solto posicionado em porcentagem: davam para admirar e nao para
   * mexer. Viraram objeto de cena com caixa propria - a tela de titulo le a
   * caixa e desenha dentro dela - e agora obedecem o editor inteiro: arrastar,
   * esticar, girar, mudar de profundidade, baixar a opacidade e esconder.
   *
   * E ELAS ERAM DOIS BLOCOS, agora sao oito.
   *
   * `titulo` carregava a marca, o nome do jogo e a chamada de uma vez; `botoes`
   * carregava os quatro botoes e a linha de progresso. Quem quisesse subir so a
   * marca, ou jogar o botao do editor para o canto, nao tinha o que arrastar -
   * o arranjo de dentro vinha do CSS, nao da cena. Cada peca abaixo e uma caixa
   * independente.
   */
  const ui = (
    role: NonNullable<SceneObject['role']>,
    x: number,
    y: number,
    w: number,
    h: number,
    depth = 10,
  ): SceneObject => ({
    id: `menu-${role}`,
    layer: 'objetos',
    kind: 'sprite',
    sprite: '',
    role,
    x,
    y,
    w,
    h,
    rot: 0,
    depth,
  });

  const vinheta = ui('vinheta', 0, 0, MENU_W, MENU_H, 9);
  vinheta.opacity = 1;
  out.push(vinheta);
  out.push(ui('juggler', 726, 40, 560, 680));

  out.push(ui('marca', 72, 96, 210, 88));
  /*
   * O NOME DO JOGO SAO TRES CAIXAS, uma por palavra.
   *
   * Era um bloco so, com uma quebra de linha no meio e o arranjo vindo do CSS.
   * Dava para mover o nome inteiro e mais nada - subir so o CLUB, ou abrir
   * espaco entre JUGGLER'S e FISHING, exigia mexer no codigo. As tres nascem
   * na mesma arrumacao de antes, entao a tela abre igual; o que muda e que
   * agora cada palavra se arrasta sozinha.
   */
  out.push(ui('titulo', 72, 196, 330, 62));
  out.push(ui('fishing', 412, 178, 300, 58));
  out.push(ui('club', 412, 238, 220, 58));
  out.push(ui('subtitulo', 72, 340, 470, 52));

  // a coluna de botoes: mesma largura, empilhados, mas cada um por si
  const BTN_W = 330;
  const BTN_H = 52;
  out.push(ui('jogar', 72, 410, BTN_W, BTN_H));
  out.push(ui('progresso', 72, 470, BTN_W, 26));
  out.push(ui('comojogar', 72, 506, BTN_W, BTN_H));
  out.push(ui('config', 72, 566, BTN_W, BTN_H));
  out.push(ui('editor', 72, 626, BTN_W, BTN_H));

  return out;
}

export function seedScene(id: SceneId = 'mundo'): SceneState {
  return { objects: id === 'menu' ? seedMenu() : seedMundo(), hidden: [], pierV: PIER_VERSAO };
}

// ------------------------------------------------------------------- estado

type Book = Record<SceneId, SceneState>;

function seedBook(): Book {
  return { mundo: seedScene('mundo'), menu: seedScene('menu') };
}

/*
 * As migracoes da v2, v3 e v4 sairam daqui.
 *
 * Elas existiam para nao jogar fora o que voce ja tinha arrumado quando o
 * mundo mudava de tamanho ou ganhava area nova - o que fazia todo sentido
 * enquanto as PECAS continuavam as mesmas. Na v5 o cenario foi refeito com
 * outro conjunto: o pier virou pacote, as ilhas viraram sprite e a mata virou
 * arvore. Nao ha o que aproveitar de uma lista que so tem peca aposentada, e
 * carregar codigo de migracao morto e pior do que assumir a virada.
 */

/**
 * Garante que as areas UNICAS existam.
 *
 * Uma cena salva antes de a area existir nao tem como conhece-la: a caixa
 * NASCIMENTO, por exemplo, so apareceu na v5. Sem isto, quem ja tinha cena
 * salva abriria o jogo sem ponto de nascimento e o "Travei!" nao teria para
 * onde levar ninguem. As areas que faltam entram; as que voce ja moveu ficam
 * exatamente onde estao.
 */
/**
 * Pecas que sairam do jogo e nao devem voltar por um save antigo.
 *
 * Uma por uma, e com o motivo escrito ao lado. E a alternativa a jogar a cena
 * inteira fora: se tres familias de peca foram aposentadas, sao essas tres que
 * saem - e nao as noventa que voce arrumou junto com elas.
 */
const APOSENTADOS: { por: (o: SceneObject) => boolean; motivo: string }[] = [
  {
    // virou 17 sprites soltos em `world/islands.ts`
    por: (o) => o.sprite === 'sky/distant-island-strip',
    motivo: 'faixa de ilha costurada',
  },
  {
    // virou fileira de arvore do pacote `nature`
    por: (o) => o.anim === 'treeline',
    motivo: 'mata de gradiente radial',
  },
  {
    // o cais virou pacote inteiro, e depois virou 2.5D em `world/pier25.ts`
    por: (o) => o.id.startsWith('pier-'),
    motivo: 'cais de perfil, das duas geracoes anteriores',
  },
];

function limparAposentados(st: SceneState): SceneState {
  const objects = st.objects.filter((o) => !APOSENTADOS.some((a) => a.por(o)));
  return objects.length === st.objects.length ? st : { ...st, objects };
}

/**
 * Traz para a cena salva os GRUPOS que a semente ganhou depois dela.
 *
 * Compara por id, que e deterministico na semente. Assim o cais novo, as ilhas
 * e a mata entram numa cena antiga sem duplicar nada e sem mexer no que ja
 * estava la.
 */
function garantirGruposNovos(st: SceneState): SceneState {
  const seed = seedMundo();
  const ids = new Set(st.objects.map((o) => o.id));
  const faltando = seed.filter(
    (s) =>
      !ids.has(s.id) &&
      (s.id.startsWith('pier25-') || s.id.startsWith('ilha-') || s.id.startsWith('mata-fundo-')),
  );
  if (faltando.length === 0) return st;
  return { ...st, objects: [...st.objects, ...faltando] };
}

/**
 * Troca o cais de PERFIL pelo cais 2.5D numa cena ja salva.
 *
 * Isto e uma migracao cirurgica, e nao um reset: ela apaga so o que tem id de
 * peca do cais antigo (`pier-...`) e poe as pecas novas no lugar. Todo o resto
 * da cena - inclusive o que voce arrastou na mao - passa intacto.
 *
 * Ela reconhece a cena antiga pela ausencia de qualquer `pier25-`: onde ja ha
 * cais novo, nao faz nada e sai.
 */
function trocarPier(st: SceneState): SceneState {
  if (st.pierV === PIER_VERSAO) return st;

  const ehDoCais = (o: SceneObject) => o.id.startsWith('pier-') || o.id.startsWith('pier25-');
  const semCais = st.objects.filter((o) => !ehDoCais(o));
  // cena sem cais nenhum (alguem apagou tudo): respeita e so anota a versao
  if (semCais.length === st.objects.length) return { ...st, pierV: PIER_VERSAO };

  return {
    ...st,
    objects: [...semCais, ...(USAR_PIER_25 ? pier25Pieces() : pierPieces())],
    pierV: PIER_VERSAO,
  };
}

/**
 * Traz as caixas de CHAO para uma cena salva antes de elas existirem.
 *
 * Nao da para usar o `garantirZonas` aqui: ele so cuida das areas UNICAS, e
 * chao e repetivel (a graca e poder cortar em varios). A regra e tudo ou nada -
 * se a cena ja tem qualquer piso, o desenho do chao e seu e nao ha o que
 * completar; se nao tem nenhum, o mundo esta usando a rede de seguranca do
 * `layout.ts` e as tres caixas da semente entram para voce poder mexer nelas.
 */
function garantirPiso(st: SceneState): SceneState {
  if (st.objects.some((o) => o.kind === 'zone' && o.zone === 'piso')) return st;
  const novos = seedMundo().filter((o) => o.zone === 'piso');
  return { ...st, objects: [...st.objects, ...novos] };
}

/**
 * O clipe das caixas de acao ganhou PERSONAGEM na frente.
 *
 * A arte era `char/<clipe>` e virou `char/<personagem>/<clipe>` - sem a pasta
 * do personagem no meio so cabe um elenco no jogo inteiro, porque dois
 * personagens com uma pose `sit-left` cada disputariam o mesmo arquivo.
 *
 * Uma cena salva antes disso guarda `sit-left`, que agora nao aponta para
 * arquivo nenhum: a caixa de acao existiria e nao faria nada. Toda caixa sem
 * barra no nome do clipe e do Juggler, porque ele era o unico que havia.
 */
function migrarClipes(st: SceneState): SceneState {
  const precisa = st.objects.some((o) => o.clip && !o.clip.includes('/'));
  if (!precisa) return st;
  return {
    ...st,
    objects: st.objects.map((o) =>
      o.clip && !o.clip.includes('/') ? { ...o, clip: `juggler/${o.clip}` } : o,
    ),
  };
}

function garantirZonas(st: SceneState): SceneState {
  const seed = seedMundo();
  const faltando = seed.filter(
    (s) =>
      s.kind === 'zone' &&
      !ZONAS_REPETIVEIS.includes(s.zone ?? 'vara') &&
      !st.objects.some((o) => o.kind === 'zone' && o.zone === s.zone),
  );
  if (faltando.length === 0) return st;
  return { ...st, objects: [...st.objects, ...faltando] };
}

/**
 * Garante que as PECAS DE INTERFACE do menu existam.
 *
 * Isto conserta um bug que eu mesmo criei: a tela de titulo passou a ter oito
 * pecas onde antes havia duas (`titulo` e `botoes`), e o carregamento do menu
 * copiava a cena salva como estava. Numa maquina que ja tinha menu salvo, as
 * pecas novas simplesmente nao existiam na lista - e peca que nao existe nao e
 * desenhada. Resultado: a tela de titulo abriu sem nenhum botao.
 *
 * A regra aqui e ADITIVA, e essa e a parte que importa: o que ja esta salvo
 * fica exatamente onde voce deixou, e so entra o que faltava. As duas caixas
 * velhas, se ainda estiverem la, saem - elas nao sao mais desenhadas por
 * ninguem e ficariam como retangulo fantasma no meio do editor.
 */
function garantirPecasDoMenu(st: SceneState): SceneState {
  const seed = seedMenu();
  const novas = seed.filter((s) => s.role);

  /*
   * A caixa `botoes` e a assinatura de um menu ANTERIOR a divisao.
   *
   * Onde ela existe, a interface inteira do menu esta na arrumacao velha - duas
   * caixas para dez elementos - e nao ha correspondencia peca a peca com a
   * nova. Ai a interface (e SO ela) volta para a semente; o cenario do menu, o
   * deck, o barco, as palmeiras, o que voce arrumou, fica intocado.
   */
  // `botoes` saiu do tipo quando a divisao aconteceu, entao a comparacao e
  // feita como texto: e justamente um papel que NAO existe mais que estamos
  // procurando aqui
  const preDivisao = st.objects.some((o) => (o.role as string) === 'botoes');
  if (preDivisao) {
    const cenario = st.objects.filter((o) => !o.role);
    return { ...st, objects: [...cenario, ...novas] };
  }

  // caso normal: so entra o que faltava, e o que existe fica onde esta
  const faltando = novas.filter((s) => !st.objects.some((o) => o.role === s.role));
  if (faltando.length === 0) return st;
  return { ...st, objects: [...st.objects, ...faltando] };
}

function load(): Book {
  const book = seedBook();
  if (typeof localStorage === 'undefined') return book;
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<Book>;
      for (const id of ['mundo', 'menu'] as SceneId[]) {
        const s = parsed[id];
        if (s && Array.isArray(s.objects) && s.objects.length > 0) {
          const st = { objects: s.objects, hidden: s.hidden ?? [], pierV: s.pierV };
          book[id] =
            id === 'mundo'
              ? migrarClipes(garantirPiso(garantirZonas(trocarPier(st))))
              : garantirPecasDoMenu(st);
        }
      }
      return book;
    }
    /*
     * Save de versao anterior: MIGRA, nao joga fora.
     *
     * Aqui havia um `removeItem` em cada chave velha, com um comentario
     * explicando por que descartar era proposital. Era uma decisao errada e ela
     * custou trabalho de verdade: quem tinha espelhado a cabana no editor
     * perdeu a edicao, refez, e perdeu de novo na versao seguinte. Cena salva e
     * trabalho manual de quem usa o editor, e sumir com trabalho manual porque
     * a semente mudou nao e uma troca justa.
     *
     * A regra passa a ser: o que estiver salvo entra, e o que a semente ganhou
     * de novo entra junto. Peca que saiu do jogo (a estaca solta, a faixa de
     * ilha costurada, a caixa de gradiente da mata) e descartada UMA a UMA pelo
     * `limparAposentados`, em vez de a lista inteira ir para o lixo por causa
     * delas.
     */
    for (const chave of [KEY_V4, KEY_V3, KEY_V2]) {
      const antigo = localStorage.getItem(chave);
      if (!antigo) continue;
      const parsed = JSON.parse(antigo) as Partial<Book>;
      for (const id of ['mundo', 'menu'] as SceneId[]) {
        const s = parsed[id];
        if (!s || !Array.isArray(s.objects) || s.objects.length === 0) continue;
        const st = limparAposentados({ objects: s.objects, hidden: s.hidden ?? [] });
        book[id] =
          id === 'mundo'
            ? migrarClipes(garantirPiso(garantirZonas(garantirGruposNovos(st))))
            : garantirPecasDoMenu(st);
      }
      break;
    }
  } catch {
    /* save corrompido: volta para a semente */
  }
  return book;
}

/**
 * Entrega o desenho do chao para quem anda em cima dele.
 *
 * O `layout.ts` nao pode importar este arquivo - ele e importado POR este
 * arquivo, e os dois se enrolariam num circulo. Entao a cena EMPURRA a lista
 * para `world/ground.ts`, que nao importa ninguem, e o `layout` so le de la.
 *
 * Roda em toda alteracao de cena: arrastar a borda de uma caixa de chao move o
 * piso debaixo do Juggler no mesmo quadro.
 */
function publicarPiso() {
  setPisos(
    book.mundo.objects
      .filter((o) => o.kind === 'zone' && o.zone === 'piso' && !o.off)
      .map((o) => ({ x: o.x, w: o.w, y: o.y, queda: o.queda ?? 0 })),
  );
}

let book: Book = load();
publicarPiso();
let active: SceneId = 'mundo';
const listeners = new Set<() => void>();
let saveTimer: number | undefined;

/**
 * Historico de desfazer, um por cena.
 *
 * Cada alteracao empilha o estado ANTERIOR. Arrastar um objeto dispara uma
 * alteracao por quadro do mouse, entao o arrasto inteiro entra num lote
 * (`beginBatch`/`endBatch`).
 */
const HISTORY_MAX = 120;
const past: Record<SceneId, SceneState[]> = { mundo: [], menu: [] };
const future: Record<SceneId, SceneState[]> = { mundo: [], menu: [] };
let batching = false;

function persist() {
  if (typeof localStorage === 'undefined') return;
  if (saveTimer !== undefined) clearTimeout(saveTimer);
  saveTimer = window.setTimeout(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(book));
    } catch {
      /* sem espaco: a cena continua valendo em memoria */
    }
  }, 200);
}

function notify() {
  publicarPiso();
  persist();
  for (const l of listeners) l();
}

function set(next: SceneState, record = true) {
  if (record && !batching) {
    past[active].push(book[active]);
    if (past[active].length > HISTORY_MAX) past[active].shift();
    future[active] = [];
  }
  book = { ...book, [active]: next };
  notify();
}

/**
 * Recarrega o livro de cenas a partir do que esta salvo agora.
 *
 * Existe para o `scripts/test-migracao.ts`: o `load()` roda uma vez so, na
 * inicializacao do modulo, e um teste que precisa experimentar varios saves
 * diferentes nao tem como reimportar o modulo do zero a cada caso.
 */
export function recarregarParaTeste(): SceneState {
  book = load();
  return book.mundo;
}

export function activeScene(): SceneId {
  return active;
}

export function setActiveScene(id: SceneId): void {
  if (active === id) return;
  active = id;
  notify();
}

/** Abre um lote: o arrasto inteiro vira um unico passo do desfazer. */
export function beginBatch(): void {
  if (batching) return;
  past[active].push(book[active]);
  if (past[active].length > HISTORY_MAX) past[active].shift();
  future[active] = [];
  batching = true;
}

export function endBatch(): void {
  batching = false;
}

export function undo(): boolean {
  const prev = past[active].pop();
  if (!prev) return false;
  future[active].push(book[active]);
  book = { ...book, [active]: prev };
  notify();
  return true;
}

export function redo(): boolean {
  const next = future[active].pop();
  if (!next) return false;
  past[active].push(book[active]);
  book = { ...book, [active]: next };
  notify();
  return true;
}

export function canUndo(): boolean {
  return past[active].length > 0;
}

export function canRedo(): boolean {
  return future[active].length > 0;
}

export function getScene(id: SceneId = active): SceneState {
  return book[id];
}

export function subscribeScene(fn: () => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

export function useScene(id?: SceneId): SceneState {
  const read = () => book[id ?? active];
  return useSyncExternalStore(subscribeScene, read, read);
}

/** Qual cena o editor esta editando agora. */
export function useActiveScene(): SceneId {
  return useSyncExternalStore(subscribeScene, activeScene, activeScene);
}

// ------------------------------------------------------------------ acoes

export function updateObject(id: string, patch: Partial<SceneObject>): void {
  const s = book[active];
  set({ ...s, objects: s.objects.map((o) => (o.id === id ? { ...o, ...patch } : o)) });
}

/**
 * A MESMA MUDANCA EM VARIOS OBJETOS, num passo so do desfazer.
 *
 * Isto existe por dois motivos, e o segundo e o que importa. O primeiro e
 * obvio: chamar `updateObject` num laco escreve a cena N vezes e empilha N
 * passos no Ctrl+Z, entao desfazer uma mudanca feita em dez pecas exigiria dez
 * Ctrl+Z.
 *
 * O segundo e que o editor tem selecao multipla desde que o laco foi feito,
 * mas o INSPETOR sempre escreveu num id so - o da ultima peca clicada. Baixar
 * a opacidade com dez pecas selecionadas mexia numa. Aqui a regra passa a ser
 * a que a selecao multipla sempre prometeu: o que voce mexe vale para o que
 * esta selecionado.
 *
 * O `patch` pode ser uma FUNCAO do objeto, e nao so um valor fixo. E o que
 * permite mudanca relativa - empurrar dez pecas 5 unidades para o lado sem
 * empilhar todas no mesmo x.
 */
export function updateObjects(
  ids: string[],
  patch: Partial<SceneObject> | ((o: SceneObject) => Partial<SceneObject>),
): void {
  if (ids.length === 0) return;
  const alvo = new Set(ids);
  const s = book[active];
  set({
    ...s,
    objects: s.objects.map((o) =>
      alvo.has(o.id) ? { ...o, ...(typeof patch === 'function' ? patch(o) : patch) } : o,
    ),
  });
}

/**
 * Apaga um objeto.
 *
 * Area de interacao unica (vara, mercado, limiar) nao sai: o jogo depende dela
 * para saber onde pescar, onde vender e onde a camera vira. Parede sai - o
 * mapa pode muito bem nao ter parede nenhuma.
 */
export function removeObject(id: string): void {
  const s = book[active];
  const o = s.objects.find((x) => x.id === id);
  if (!o || o.locked) return;
  // area unica nao sai; parede e area de acao saem, porque delas pode haver
  // quantas voce quiser (ou nenhuma)
  if (o.kind === 'zone' && !ZONAS_REPETIVEIS.includes(o.zone ?? 'vara')) return;
  set({ ...s, objects: s.objects.filter((x) => x.id !== id) });
}

export function addSprite(sprite: string, layer: LayerId, x: number, y: number, h = 120): SceneObject {
  const s = book[active];
  const home = homeOf(sprite);
  const obj: SceneObject = {
    id: `${sprite.split('/').pop()}-${Date.now().toString(36)}`,
    layer,
    kind: 'sprite',
    sprite,
    x: Math.round(x - (h * aspectOf(sprite)) / 2),
    y: Math.round(y - h / 2),
    w: Math.round(h * aspectOf(sprite)),
    h,
    rot: 0,
    depth: home.depth,
  };
  set({ ...s, objects: [...s.objects, obj] });
  return obj;
}

/**
 * Cria uma forma geometrica colorida.
 *
 * Serve para o que nao tem sprite: um bloco de sombra, uma faixa de cor sobre a
 * agua, um vulto no fundo, uma marcacao de trabalho. Como qualquer objeto, ela
 * tem camada, profundidade, giro e opacidade.
 */
export function addShape(shape: ShapeKind, x: number, y: number, layer: LayerId = 'objetos'): SceneObject {
  const s = book[active];
  const obj: SceneObject = {
    id: `${shape}-${Date.now().toString(36)}`,
    layer,
    kind: 'forma',
    shape,
    x: Math.round(x - 90),
    y: Math.round(y - 60),
    w: 180,
    h: 120,
    rot: 0,
    depth: 6,
    opacity: 0.9,
    fill: '#2fd6c9',
    stroke: '',
    strokeW: 4,
    radius: 0,
  };
  set({ ...s, objects: [...s.objects, obj] });
  return obj;
}

/**
 * Cria uma area de ACAO onde a tela estiver.
 *
 * Area de acao e a caixa que faz o Juggler sentar no banco, encostar no
 * parapeito, olhar o mar. Ela nasce ja funcionando - com um clipe escolhido e
 * um aviso escrito - porque marcador que nasce vazio e marcador que aparece
 * como "AÇÃO ·" no mapa e nao faz nada ate alguem lembrar de configurar.
 *
 *   animacao - toca o clipe em ciclo enquanto o jogador ficar parado nele
 *   pose     - trava num quadro so, que e o caso do sentar
 */
export function addAction(kind: 'animacao' | 'pose', x: number, y: number): SceneObject {
  const s = book[active];
  const obj: SceneObject = {
    id: `${kind}-${Date.now().toString(36)}`,
    layer: 'marcadores',
    kind: 'zone',
    zone: kind,
    x: Math.round(x - 70),
    y: Math.round(y - 110),
    w: 140,
    h: 220,
    rot: 0,
    depth: 9,
    clip: kind === 'pose' ? 'juggler/sit-left' : 'juggler/walk-left',
    poseFrame: 0,
    prompt: kind === 'pose' ? 'Sentar' : 'Fazer',
  };
  set({ ...s, objects: [...s.objects, obj] });
  return obj;
}

/**
 * A area de acao em que o jogador esta, se houver alguma.
 *
 * Desempata pela ordem da lista: a ultima criada ganha, que e a que voce
 * acabou de arrastar para la.
 */
export function actionAt(x: number): SceneObject | null {
  const list = book.mundo.objects.filter(
    (o) =>
      o.kind === 'zone' &&
      (o.zone === 'animacao' || o.zone === 'pose') &&
      !o.off &&
      x >= o.x &&
      x <= o.x + o.w,
  );
  return list.length ? list[list.length - 1] : null;
}

/**
 * Cria um trecho de CHAO onde a tela estiver.
 *
 * Ele nasce plano e com 300 de largura. Rampa se faz depois, pondo QUEDA no
 * inspetor - e cortar um trecho em dois e duplicar e arrastar a borda, que e
 * o mesmo gesto de qualquer outro objeto.
 */
export function addFloor(x: number, y: number): SceneObject {
  const s = book[active];
  const obj: SceneObject = {
    id: `piso-${Date.now().toString(36)}`,
    layer: 'marcadores',
    kind: 'zone',
    zone: 'piso',
    x: Math.round(x - 150),
    y: Math.round(y),
    w: 300,
    h: 26,
    rot: 0,
    depth: 9,
    queda: 0,
  };
  set({ ...s, objects: [...s.objects, obj] });
  return obj;
}

/** Cria uma parede nova onde a tela estiver. */
export function addWall(x: number, y: number): SceneObject {
  const s = book[active];
  const obj: SceneObject = {
    id: `parede-${Date.now().toString(36)}`,
    layer: 'interagiveis',
    kind: 'zone',
    zone: 'parede',
    x: Math.round(x - 30),
    y: Math.round(y - 150),
    w: 60,
    h: 300,
    rot: 0,
    depth: 9,
  };
  set({ ...s, objects: [...s.objects, obj] });
  return obj;
}

// ------------------------------------------------------------------ grupos

/**
 * GRUPO: pecas que andam juntas porque sao uma coisa so.
 *
 * A cena tem 130 objetos e um cais e feito de vinte. Sem grupo, mover o cais
 * inteiro dois passos para a esquerda e um exercicio de laco de selecao, e
 * qualquer clique perdido no meio do caminho desfaz a selecao e recomeca.
 *
 * O grupo NAO e um objeto novo: e uma etiqueta (`group`) escrita em cada peca.
 * Isso e de proposito. Um objeto-grupo de verdade teria posicao e tamanho
 * proprios, e ai haveria duas verdades sobre onde a peca esta - a dela e a do
 * pai. Etiqueta nao tem esse problema: as pecas continuam soltas na lista e
 * so o CLIQUE sabe que elas se pegam juntas.
 *
 * Travar um grupo e travar cada peca dele, pelo mesmo motivo: nao ha um lugar
 * central para guardar "este grupo esta travado" sem inventar o pai.
 */
let grupoSeq = 0;

export function groupObjects(ids: string[]): string | null {
  if (ids.length < 2) return null;
  const nome = `g${Date.now().toString(36)}${(++grupoSeq).toString(36)}`;
  /*
   * Grupo de grupo NAO ANINHA: ele funde.
   *
   * Selecionar duas pecas de um grupo A mais uma solta e apertar G poderia
   * criar um grupo B dentro do A - e ai clicar numa peca teria duas respostas
   * certas ("seleciona o B" e "seleciona o A"), e nenhuma forma de o usuario
   * saber qual vai sair. Fundir e a resposta previsivel: as pecas selecionadas
   * e TODAS as dos grupos que elas tocam viram um grupo so.
   */
  const s = book[active];
  const tocados = new Set(ids);
  const grupos = new Set(
    s.objects.filter((o) => tocados.has(o.id) && o.group).map((o) => o.group as string),
  );
  const objects = s.objects.map((o) =>
    tocados.has(o.id) || (o.group && grupos.has(o.group)) ? { ...o, group: nome } : o,
  );
  set({ ...s, objects });
  return nome;
}

export function ungroupObjects(ids: string[]): void {
  const s = book[active];
  const grupos = new Set(
    s.objects.filter((o) => ids.includes(o.id) && o.group).map((o) => o.group as string),
  );
  if (grupos.size === 0) return;
  set({
    ...s,
    objects: s.objects.map((o) => (o.group && grupos.has(o.group) ? { ...o, group: undefined } : o)),
  });
}

/** Todo mundo que anda junto com esta peca (ela inclusa). */
export function groupMembers(id: string): string[] {
  const o = book[active].objects.find((x) => x.id === id);
  if (!o?.group) return [id];
  return book[active].objects.filter((x) => x.group === o.group).map((x) => x.id);
}

/** Os grupos da cena, com quantas pecas e se estao travados. */
export function groupList(): { nome: string; pecas: number; travado: boolean }[] {
  const por = new Map<string, SceneObject[]>();
  for (const o of book[active].objects) {
    if (!o.group) continue;
    const atual = por.get(o.group);
    if (atual) atual.push(o);
    else por.set(o.group, [o]);
  }
  return [...por.entries()].map(([nome, pecas]) => ({
    nome,
    pecas: pecas.length,
    travado: pecas.every((p) => p.locked),
  }));
}

// --------------------------------------------------- copiar e colar

/**
 * A area de transferencia do editor.
 *
 * Ela guarda uma COPIA dos objetos, e nao os ids: colar depois de apagar o
 * original tem de funcionar, e um id na mao nao serve para nada quando a peca
 * saiu da lista.
 *
 * Vive em memoria, e nao no `localStorage`, porque copiar e uma acao de
 * sessao. Recarregar a pagina e um jeito razoavel de esperar que a area de
 * transferencia esvazie - e uma cheia de uma semana atras, colada por engano,
 * e pior do que uma vazia.
 */
let prancheta: SceneObject[] = [];

export function copyObjects(ids: string[]): number {
  const alvo = new Set(ids);
  prancheta = book[active].objects.filter((o) => alvo.has(o.id)).map((o) => ({ ...o }));
  return prancheta.length;
}

export function clipboardSize(): number {
  return prancheta.length;
}

/**
 * Cola o que foi copiado, com o CANTO SUPERIOR ESQUERDO do conjunto em (x, y).
 *
 * O arranjo relativo entre as pecas e preservado: o que importa numa colagem
 * de cinco pecas de cais nao e onde cada uma cai, e a distancia entre elas.
 *
 * Area de interacao UNICA nao cola. Duas caixas de PESCAR na cena e um estado
 * que o jogo nao sabe ler - `zoneRect` devolve a primeira que encontrar - e
 * colar sem querer a caixa da vara junto com um barril daria um bug que so
 * apareceria muito depois, na hora de pescar.
 */
export function pasteObjects(x: number, y: number): string[] {
  if (prancheta.length === 0) return [];
  const podem = prancheta.filter(
    (o) => o.kind !== 'zone' || ZONAS_REPETIVEIS.includes(o.zone ?? 'vara'),
  );
  if (podem.length === 0) return [];

  const x0 = Math.min(...podem.map((o) => o.x));
  const y0 = Math.min(...podem.map((o) => o.y));
  const marca = Date.now().toString(36);
  // grupo copiado continua grupo, mas com nome NOVO: colar dentro do grupo de
  // origem faria a copia arrastar o original junto
  const renome = new Map<string, string>();
  for (const o of podem) {
    if (o.group && !renome.has(o.group)) renome.set(o.group, `g${marca}${renome.size}`);
  }

  const novos = podem.map((o, i) => ({
    ...o,
    id: `${o.id.replace(/-copia-.*$/, '')}-copia-${marca}${i}`,
    x: Math.round(x + (o.x - x0)),
    y: Math.round(y + (o.y - y0)),
    locked: false,
    group: o.group ? renome.get(o.group) : undefined,
  }));

  const s = book[active];
  set({ ...s, objects: [...s.objects, ...novos] });
  return novos.map((o) => o.id);
}

export function duplicateObject(id: string): SceneObject | null {
  const s = book[active];
  const o = s.objects.find((x) => x.id === id);
  if (!o) return null;
  if (o.kind === 'zone' && !ZONAS_REPETIVEIS.includes(o.zone ?? 'vara')) return null;
  const copy: SceneObject = { ...o, id: `${o.id}-copia-${Date.now().toString(36)}`, x: o.x + 40, locked: false };
  set({ ...s, objects: [...s.objects, copy] });
  return copy;
}

export function toggleLock(id: string): void {
  const o = book[active].objects.find((x) => x.id === id);
  if (!o) return;
  updateObject(id, { locked: !o.locked });
}

export function moveToLayer(id: string, layer: LayerId): void {
  const o = book[active].objects.find((x) => x.id === id);
  if (!o || o.kind === 'zone') return;
  updateObject(id, { layer });
}

export function toggleLayer(layer: LayerId): void {
  const s = book[active];
  const hidden = s.hidden.includes(layer)
    ? s.hidden.filter((l) => l !== layer)
    : [...s.hidden, layer];
  set({ ...s, hidden }, false);
}

/** Manda o objeto para o fim (ou o comeco) da lista, para desempatar profundidade igual. */
export function reorder(id: string, toFront: boolean): void {
  const s = book[active];
  const o = s.objects.find((x) => x.id === id);
  if (!o) return;
  const rest = s.objects.filter((x) => x.id !== id);
  set({ ...s, objects: toFront ? [...rest, o] : [o, ...rest] });
}

export function resetScene(): void {
  set(seedScene(active));
}

export function importScene(json: string): boolean {
  try {
    const parsed = JSON.parse(json) as Partial<SceneState>;
    if (!parsed || !Array.isArray(parsed.objects)) return false;
    set({
      objects: (parsed.objects as SceneObject[]).map((o) => ({ ...o, depth: o.depth ?? 5 })),
      hidden: parsed.hidden ?? [],
    });
    return true;
  } catch {
    return false;
  }
}

export function exportScene(): string {
  return JSON.stringify(book[active], null, 2);
}

// -------------------------------------------------------- consultas do jogo

/** Area de interacao de um ponto do mundo, do jeito que o editor deixou. */
export function zoneRect(zone: ZoneId): { x: number; y: number; w: number; h: number } | null {
  const o = book.mundo.objects.find((x) => x.kind === 'zone' && x.zone === zone);
  return o ? { x: o.x, y: o.y, w: o.w, h: o.h } : null;
}

/** O jogador esta dentro da area? */
export function inZone(zone: ZoneId, x: number): boolean {
  const r = zoneRect(zone);
  return r ? x >= r.x && x <= r.x + r.w : false;
}

/** Todas as paredes da cena do mundo. */
export function wallRects(): { x: number; w: number }[] {
  return book.mundo.objects
    .filter((o) => o.kind === 'zone' && o.zone === 'parede' && !o.off)
    .map((o) => ({ x: o.x, w: o.w }));
}

/**
 * Onde o Juggler para de andar.
 *
 * Uma parede barra pelo lado de onde ele vem: se ele ja esta a esquerda dela,
 * nao passa da borda esquerda; se ja esta a direita, nao passa da direita.
 * Assim uma parede no meio do mapa funciona nos dois sentidos, e uma parede na
 * ponta funciona como o limite antigo do mapa.
 */
export function blockWalls(from: number, to: number): number {
  let x = to;
  for (const w of wallRects()) {
    const meio = w.x + w.w / 2;
    if (from <= meio) x = Math.min(x, w.x);
    else x = Math.max(x, w.x + w.w);
  }
  return x;
}

/**
 * O X do limiar do pier: a esquerda dele a camera abre para o mar, a direita
 * ela fecha na superficie. `null` quando nao ha limiar na cena.
 */
export function thresholdX(): number | null {
  const o = book.mundo.objects.find((x) => x.kind === 'zone' && x.zone === 'limiar');
  return o ? o.x + o.w / 2 : null;
}

/**
 * Onde o Juggler nasce, agora que isso e uma caixa e nao um numero escondido.
 *
 * Se a caixa foi apagada ou desligada, cai na semente do `layout.ts`: o jogo
 * nunca fica sem lugar para colocar o personagem.
 */
export function spawnX(): number {
  const o = book.mundo.objects.find((x) => x.kind === 'zone' && x.zone === 'spawn' && !x.off);
  return o ? o.x + o.w / 2 : SPAWN_X;
}

/** A caixa de uma peca de interface da tela de titulo. */
export function menuSlot(role: SceneObject['role']): SceneObject | null {
  return book.menu.objects.find((o) => o.role === role && !o.off) ?? null;
}

/** Onde esta a vara agora: usado pela camera e pela boia. */
export function rodX(): number {
  const rod = book.mundo.objects.find((o) => o.role === 'vara');
  if (rod) return rod.x + rod.w * 0.35;
  const r = zoneRect('vara');
  return r ? r.x + r.w / 2 : ROD_X;
}
