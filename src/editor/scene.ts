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
import { islandObjects, menuIslandObjects } from '../world/islands';
import { largura, peca, pierPieces } from '../world/pier';
import { seaBottom, seaLeft } from '../world/worldConfig';
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
  out.push(...pierPieces());
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
   * O Juggler posando, o bloco do logo, a coluna de botoes e a vinheta das
   * bordas eram HTML solto, posicionado em porcentagem: davam para admirar e
   * nao para mexer. Agora sao objetos de cena com caixa propria - a tela de
   * titulo le a caixa e desenha dentro dela.
   *
   * O ganho e que eles obedecem o editor inteiro: arrastar, esticar, girar,
   * mudar de profundidade, baixar a opacidade e esconder. A vinheta em cima do
   * Juggler ou atras dele e so uma questao de profundidade agora.
   */
  out.push({
    id: 'menu-vinheta',
    layer: 'objetos',
    kind: 'sprite',
    sprite: '',
    role: 'vinheta',
    x: 0,
    y: 0,
    w: MENU_W,
    h: MENU_H,
    rot: 0,
    depth: 9,
    opacity: 1,
  });
  out.push({
    id: 'menu-juggler',
    layer: 'objetos',
    kind: 'sprite',
    sprite: '',
    role: 'juggler',
    x: 726,
    y: 40,
    w: 560,
    h: 680,
    rot: 0,
    depth: 10,
  });
  out.push({
    id: 'menu-titulo',
    layer: 'objetos',
    kind: 'sprite',
    sprite: '',
    role: 'titulo',
    x: 72,
    y: 96,
    w: 560,
    h: 250,
    rot: 0,
    depth: 10,
  });
  out.push({
    id: 'menu-botoes',
    layer: 'objetos',
    kind: 'sprite',
    sprite: '',
    role: 'botoes',
    x: 72,
    y: 370,
    w: 330,
    h: 290,
    rot: 0,
    depth: 10,
  });

  return out;
}

export function seedScene(id: SceneId = 'mundo'): SceneState {
  return { objects: id === 'menu' ? seedMenu() : seedMundo(), hidden: [] };
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
function garantirZonas(st: SceneState): SceneState {
  const seed = seedMundo();
  const faltando = seed.filter(
    (s) =>
      s.kind === 'zone' &&
      s.zone !== 'parede' &&
      !st.objects.some((o) => o.kind === 'zone' && o.zone === s.zone),
  );
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
          const st = { objects: s.objects, hidden: s.hidden ?? [] };
          book[id] = id === 'mundo' ? garantirZonas(st) : st;
        }
      }
      return book;
    }
    /*
     * Cena da v4 ou anterior: o cenario volta pela semente.
     *
     * Da v4 para a v5 o pier, as ilhas e a mata foram REFEITOS com outro
     * conjunto de pecas. Copiar a lista velha traria de volta a estaca solta, a
     * faixa de ilha costurada e a caixa de gradiente da mata - exatamente o que
     * saiu. Entao aqui a gente joga fora e planta de novo, de proposito.
     */
    for (const chave of [KEY_V4, KEY_V3, KEY_V2]) {
      if (localStorage.getItem(chave)) localStorage.removeItem(chave);
    }
  } catch {
    /* save corrompido: volta para a semente */
  }
  return book;
}

let book: Book = load();
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
  if (o.kind === 'zone' && o.zone !== 'parede') return;
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

export function duplicateObject(id: string): SceneObject | null {
  const s = book[active];
  const o = s.objects.find((x) => x.id === id);
  if (!o) return null;
  if (o.kind === 'zone' && o.zone !== 'parede') return null;
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
