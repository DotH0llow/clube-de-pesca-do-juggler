/**
 * Planta do mundo lateral. A leitura da esquerda para a direita e:
 *
 *   mar aberto -> pier -> praia -> mercado de peixe -> cabana -> floresta
 *
 * O mar aberto fica de fora do pier de proposito: e a agua que o jogador ve
 * quando olha para o horizonte e onde a boia cai. A floresta do extremo
 * direito e so uma treeline: fecha o cenario e nao da passagem.
 *
 * Tudo em unidades de mundo (px de design). A cena inteira e escalada para
 * caber na altura da viewport, entao esses numeros nunca mudam.
 */

export const WORLD_H = 720;
export const WORLD_W = 3400;

/**
 * Linha da agua. Acima disso e ceu/praia, abaixo e o mar.
 *
 * Subiu de 430 para 372 para o mar ocupar mais tela: a coluna de agua passou de
 * 290 para 348 unidades de altura, quase 20% a mais. Deck e areia sobem junto -
 * a praia nao pode ficar abaixo do nivel do mar.
 */
export const WATER_Y = 372;

/** Onde o mar encontra a areia. A esquerda disso e agua, a direita e praia. */
export const SHORE_X = 1400;

/** Piso da praia e piso do deck do pier. */
export const SAND_Y = 368;
export const PIER_Y = 336;

/** O pier: comeca sobre o mar aberto e encosta na praia. */
export const PIER_START = 600;
export const PIER_END = 1460;
/** Rampa que liga o deck a areia. */
export const PIER_RAMP = 70;

/** Faixas de cenario, da esquerda para a direita. */
export const BEACH_START = PIER_END;
export const MARKET_START = 2060;
export const CABANA_START = 2480;
export const FOREST_START = 2860;

/** Onde fica a vara fincada no deck: o ponto de pescaria, na ponta do pier. */
export const ROD_X = 720;
/** Distancia em que aparece o aviso de interagir. */
export const ROD_REACH = 130;

/** Barraca do mercado: segundo ponto de interacao do mundo. */
export const MARKET_X = 2210;
export const MARKET_REACH = 150;

/**
 * Onde a boia cai na agua quando o jogador lanca: mar aberto, fora do pier.
 *
 * Estes sao so os valores de partida - quem manda de verdade e a configuracao
 * de mecanicas (`src/editor/fx.ts`), que o editor edita.
 */
export const BOBBER_X = ROD_X - 270;
export const BOBBER_Y = WATER_Y + 30;

/** Limites de caminhada: da ponta do pier ate a treeline. */
export const WALK_MIN = PIER_START + 50;
export const WALK_MAX = FOREST_START + 10;

/** Altura do chao em cada ponto do mundo. */
export function groundAt(x: number): number {
  if (x <= PIER_END) return PIER_Y;
  if (x < PIER_END + PIER_RAMP) {
    // rampinha de saida do deck para a areia
    const t = (x - PIER_END) / PIER_RAMP;
    return PIER_Y + (SAND_Y - PIER_Y) * t;
  }
  return SAND_Y;
}

/**
 * Quanto tudo que fica em terra encolheu.
 *
 * O pedido era mar maior e pier/ilha/Juggler menores. Em vez de mexer na altura
 * de cada prop na mao, o cenario de terra passa por aqui: pier, praia, mercado,
 * cabana e mata saem 20% menores. Quem fica no mar (fundo, vida submersa,
 * detalhe de areia) nao encolhe - o mar cresceu, nao diminuiu.
 */
export const LAND_SCALE = 0.8;

function scaled(list: Prop[]): Prop[] {
  return list.map((p) => ({ ...p, h: Math.round(p.h * LAND_SCALE) }));
}

export interface Prop {
  sprite: string;
  x: number;
  /** y da BASE do sprite (o sprite e ancorado embaixo) */
  y: number;
  h: number;
  flip?: boolean;
  opacity?: number;
  /** 1 = plano do jogador; <1 empurra para o fundo */
  depth?: number;
  className?: string;
}

/** Tralha em cima do deck, entre a vara e a praia. */
export const PIER_PROPS: Prop[] = scaled([
  { sprite: 'props/capture-net', x: 632, y: PIER_Y + 2, h: 96 },
  { sprite: 'props/small-anchor', x: 843, y: PIER_Y + 2, h: 74 },
  { sprite: 'props/fishing-bucket', x: 933, y: PIER_Y + 2, h: 66 },
  { sprite: 'props/mooring-rope', x: 1022, y: PIER_Y + 2, h: 44 },
  { sprite: 'props/cooler-box', x: 1111, y: PIER_Y + 2, h: 66 },
  { sprite: 'props/tackle-box', x: 1192, y: PIER_Y + 2, h: 60 },
  { sprite: 'props/pier-lantern', x: 1290, y: PIER_Y + 2, h: 150 },
  { sprite: 'props/fish-basket', x: 1371, y: PIER_Y + 2, h: 72 },
  { sprite: 'props/barrel', x: 1427, y: PIER_Y + 2, h: 86 },
]);

/** Praia: areia aberta entre o pier e o mercado. */
export const BEACH: Prop[] = scaled([
  { sprite: 'props/rolled-fishing-net', x: 1580, y: SAND_Y + 2, h: 66 },
  { sprite: 'props/wooden-oar', x: 1660, y: SAND_Y + 2, h: 100 },
  { sprite: 'props/coastal-rocks', x: 1760, y: SAND_Y + 10, h: 80 },
  { sprite: 'props/sand-grass-patch', x: 1840, y: SAND_Y + 4, h: 44 },
  { sprite: 'nature/fan-palm', x: 1930, y: SAND_Y, h: 300 },
  { sprite: 'props/pier-bench-side', x: 2020, y: SAND_Y + 2, h: 74 },
  { sprite: 'props/seashell', x: 1710, y: SAND_Y + 6, h: 26 },
  { sprite: 'props/starfish', x: 1880, y: SAND_Y + 6, h: 30 },
]);

/** Mercado de peixe: a barraca e a bagunca de trabalho em volta. */
export const MARKET: Prop[] = scaled([
  { sprite: 'props/fish-market-stall-side', x: MARKET_X, y: SAND_Y + 4, h: 240 },
  { sprite: 'props/fish-basket', x: MARKET_X - 130, y: SAND_Y + 2, h: 70 },
  { sprite: 'props/barrel', x: MARKET_X + 150, y: SAND_Y + 2, h: 84 },
  { sprite: 'props/cooler-box', x: MARKET_X + 235, y: SAND_Y + 2, h: 64 },
  { sprite: 'props/sand-grass-patch', x: MARKET_X + 320, y: SAND_Y + 4, h: 40, flip: true },
]);

/** Cabana do clube, com coqueiro e tralha na frente. */
export const CABANA: Prop[] = scaled([
  { sprite: 'nature/coconut-palm', x: 2520, y: SAND_Y, h: 320, flip: true },
  { sprite: 'props/beach-cabana-side', x: 2640, y: SAND_Y + 4, h: 260 },
  { sprite: 'props/pier-bench-side', x: 2780, y: SAND_Y + 2, h: 74, flip: true },
  { sprite: 'props/fishing-line-spool', x: 2580, y: SAND_Y + 2, h: 40 },
  { sprite: 'props/seashell', x: 2780, y: SAND_Y + 6, h: 24, flip: true },
]);

/**
 * Treeline do fim do mapa: vegetacao fechada, sem passagem.
 *
 * A mata mistura especies do pacote `nature` para nao virar um paredao de
 * coqueiro clonado: mangue e ipe atras, palmeira e amendoeira na frente.
 */
export const FOREST: Prop[] = scaled([
  { sprite: 'nature/coconut-palm', x: FOREST_START + 40, y: SAND_Y + 4, h: 330 },
  { sprite: 'nature/tropical-almond', x: FOREST_START + 130, y: SAND_Y + 10, h: 290, flip: true, depth: 0.9 },
  { sprite: 'nature/royal-palm', x: FOREST_START + 220, y: SAND_Y + 2, h: 350 },
  { sprite: 'nature/sea-hibiscus', x: FOREST_START + 320, y: SAND_Y + 8, h: 260, flip: true },
  { sprite: 'nature/coconut-palm', x: FOREST_START + 410, y: SAND_Y + 4, h: 340, depth: 0.88 },
  { sprite: 'props/coastal-rocks', x: FOREST_START + 60, y: SAND_Y + 12, h: 90 },
  { sprite: 'props/sand-grass-patch', x: FOREST_START - 20, y: SAND_Y + 6, h: 46 },
  { sprite: 'props/sand-grass-patch', x: FOREST_START + 180, y: SAND_Y + 8, h: 42, flip: true },
  { sprite: 'nature/yellow-ipe', x: FOREST_START + 90, y: SAND_Y + 14, h: 280, depth: 0.85, opacity: 0.95 },
  { sprite: 'nature/black-mangrove', x: FOREST_START + 270, y: SAND_Y + 16, h: 250, flip: true, depth: 0.85, opacity: 0.95 },
  { sprite: 'nature/casuarina', x: FOREST_START + 370, y: SAND_Y + 12, h: 300, depth: 0.86, opacity: 0.95 },
  { sprite: 'nature/twisted-trunk', x: FOREST_START + 470, y: SAND_Y + 6, h: 210, depth: 0.9 },
  { sprite: 'props/coastal-rocks', x: FOREST_START + 250, y: SAND_Y + 14, h: 70, flip: true },
]);

/** Fundo do mar, na parte visivel abaixo da linha d agua. */
export const SEAFLOOR: Prop[] = [
  { sprite: 'props/cave-entrance', x: 120, y: 712, h: 190 },
  { sprite: 'props/kelp-stalk', x: 250, y: 710, h: 160, flip: true },
  { sprite: 'props/seafloor-rocks', x: 380, y: 706, h: 130 },
  { sprite: 'props/coral-cluster', x: 520, y: 708, h: 120 },
  { sprite: 'props/sunken-driftwood', x: 660, y: 704, h: 70 },
  { sprite: 'props/aquatic-plant', x: 800, y: 710, h: 130, flip: true },
  { sprite: 'props/starfish', x: 900, y: 706, h: 40 },
  { sprite: 'props/coral-cluster', x: 1020, y: 708, h: 100, flip: true },
  { sprite: 'props/kelp-stalk', x: 1140, y: 710, h: 150 },
  { sprite: 'props/seafloor-rocks', x: 1280, y: 708, h: 110, flip: true },
  { sprite: 'props/seashell', x: 1400, y: 704, h: 28 },
  { sprite: 'props/seafloor-hole', x: 1440, y: 712, h: 60, opacity: 0.8 },
  // bicho de fundo do pacote `marine`: coral, ourico, anemona e companhia
  { sprite: 'marine/brain-coral', x: 440, y: 708, h: 52 },
  { sprite: 'marine/staghorn-coral', x: 700, y: 710, h: 76 },
  { sprite: 'marine/sea-anemone', x: 960, y: 708, h: 44 },
  { sprite: 'marine/sea-urchin', x: 1080, y: 706, h: 30 },
  { sprite: 'marine/crab', x: 590, y: 706, h: 34, flip: true },
  { sprite: 'marine/sea-sponge', x: 1210, y: 708, h: 42 },
  { sprite: 'marine/sea-cucumber', x: 330, y: 706, h: 26 },
  { sprite: 'marine/lobster', x: 830, y: 706, h: 32, flip: true },
];

/** Detalhe solto na faixa de areia da frente, para a praia nao ficar vazia. */
export const SHORE: Prop[] = [
  { sprite: 'props/seashell', x: 1427, y: SAND_Y + 92, h: 22, opacity: 0.9 },
  { sprite: 'props/starfish', x: 1780, y: SAND_Y + 150, h: 26, opacity: 0.9 },
  { sprite: 'props/sunken-driftwood', x: 2080, y: SAND_Y + 190, h: 44, opacity: 0.85 },
  { sprite: 'props/seashell', x: 2360, y: SAND_Y + 110, h: 18, flip: true, opacity: 0.85 },
  { sprite: 'props/sand-grass-patch', x: 2630, y: SAND_Y + 165, h: 34, opacity: 0.8 },
  { sprite: 'props/starfish', x: 3050, y: SAND_Y + 235, h: 22, flip: true, opacity: 0.8 },
  { sprite: 'props/seashell', x: 1500, y: SAND_Y + 250, h: 20, opacity: 0.75 },
  { sprite: 'marine/blue-crab', x: 1620, y: SAND_Y + 128, h: 26, opacity: 0.9 },
  { sprite: 'marine/hermit-crab', x: 2200, y: SAND_Y + 205, h: 22, flip: true, opacity: 0.85 },
  { sprite: 'props/coastal-rocks', x: 1440, y: SAND_Y + 120, h: 54, opacity: 0.9 },
];

/** Cardumes e bolhas passeando na coluna de agua. */
export const UNDERWATER_LIFE: Prop[] = [
  { sprite: 'props/decorative-fish-school', x: 300, y: 590, h: 60, opacity: 0.75, className: 'drift-slow' },
  { sprite: 'props/decorative-fish-school', x: 980, y: 640, h: 46, opacity: 0.6, flip: true, className: 'drift-slower' },
  { sprite: 'fx/underwater-bubbles', x: 620, y: 660, h: 90, opacity: 0.6, className: 'rise' },
  { sprite: 'fx/underwater-bubbles', x: 1180, y: 690, h: 70, opacity: 0.45, className: 'rise slow' },
  { sprite: 'fx/underwater-current-streaks', x: 840, y: 560, h: 60, opacity: 0.3 },
  { sprite: 'marine/sea-turtle', x: 520, y: 610, h: 54, opacity: 0.8, className: 'drift-slower' },
  { sprite: 'marine/jellyfish', x: 1260, y: 600, h: 40, opacity: 0.6, className: 'rise slow' },
  { sprite: 'marine/squid', x: 160, y: 650, h: 44, opacity: 0.55, flip: true, className: 'drift-slow' },
];
