/**
 * Planta do mundo lateral, seguindo o sketch do cenario:
 * floresta -> praia -> cabana -> pier sobre a agua -> vara de pesca -> mar aberto.
 *
 * Tudo em unidades de mundo (px de design). A cena inteira e escalada para caber
 * na altura da viewport, entao esses numeros nunca mudam.
 */

export const WORLD_H = 720;
export const WORLD_W = 3400;

/** Linha da agua. Acima disso e ceu/praia, abaixo e o mar. */
export const WATER_Y = 430;

/** Onde a areia termina e comeca o mar. */
export const SEA_START = 1960;

/** Piso da praia e piso do deck do pier. */
export const SAND_Y = 426;
export const PIER_Y = 384;

export const FOREST_END = 640;
export const PIER_START = 1900;
export const PIER_END = 3180;

/** Onde fica a vara fincada no deck: o ponto de pescaria. */
export const ROD_X = 3010;
/** Distancia em que aparece o aviso de interagir. */
export const ROD_REACH = 130;

/** Onde a boia cai na agua quando o jogador lanca. */
export const BOBBER_X = ROD_X + 190;
export const BOBBER_Y = WATER_Y + 46;

/** Limites de caminhada do jogador. */
export const WALK_MIN = 60;
export const WALK_MAX = PIER_END - 70;

/** Altura do chao em cada ponto do mundo. */
export function groundAt(x: number): number {
  if (x < PIER_START - 60) return SAND_Y;
  if (x < PIER_START) {
    // rampinha de acesso ao deck
    const t = (x - (PIER_START - 60)) / 60;
    return SAND_Y + (PIER_Y - SAND_Y) * t;
  }
  return PIER_Y;
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

/** Vegetacao densa da ilha, ao fundo e nas laterais. */
export const FOREST: Prop[] = [
  { sprite: 'props/palm-tree-side', x: 40, y: SAND_Y + 8, h: 300, depth: 0.82, opacity: 0.9 },
  { sprite: 'props/palm-tree-side', x: 170, y: SAND_Y + 2, h: 340, flip: true },
  { sprite: 'props/palm-tree-side', x: 300, y: SAND_Y + 10, h: 270, depth: 0.86, opacity: 0.92 },
  { sprite: 'props/palm-tree-side', x: 430, y: SAND_Y, h: 320 },
  { sprite: 'props/palm-tree-side', x: 560, y: SAND_Y + 6, h: 290, flip: true, depth: 0.88 },
  { sprite: 'props/coastal-rocks', x: 240, y: SAND_Y + 12, h: 90 },
  { sprite: 'props/sand-grass-patch', x: 120, y: SAND_Y + 6, h: 46 },
  { sprite: 'props/sand-grass-patch', x: 500, y: SAND_Y + 6, h: 40, flip: true },
];

/** Praia: cabana, banco, coqueiro solto e tralha de pescador. */
export const BEACH: Prop[] = [
  { sprite: 'props/palm-tree-side', x: 760, y: SAND_Y, h: 300 },
  { sprite: 'props/beach-cabana-side', x: 1020, y: SAND_Y + 4, h: 250 },
  { sprite: 'props/pier-bench-side', x: 1290, y: SAND_Y + 2, h: 74 },
  { sprite: 'props/palm-tree-side', x: 1430, y: SAND_Y, h: 330, flip: true },
  { sprite: 'props/sand-grass-patch', x: 900, y: SAND_Y + 4, h: 44 },
  { sprite: 'props/sand-grass-patch', x: 1180, y: SAND_Y + 4, h: 38, flip: true },
  { sprite: 'props/seashell', x: 1350, y: SAND_Y + 6, h: 26 },
  { sprite: 'props/starfish', x: 860, y: SAND_Y + 6, h: 30 },
  { sprite: 'props/coastal-rocks', x: 1620, y: SAND_Y + 10, h: 80 },
  { sprite: 'props/rolled-fishing-net', x: 1700, y: SAND_Y + 2, h: 66 },
  { sprite: 'props/wooden-oar', x: 1770, y: SAND_Y + 2, h: 100, flip: true },
];

/** Tralha em cima do deck. */
export const PIER_PROPS: Prop[] = [
  { sprite: 'props/barrel', x: 2010, y: PIER_Y + 2, h: 86 },
  { sprite: 'props/fish-basket', x: 2130, y: PIER_Y + 2, h: 72 },
  { sprite: 'props/pier-lantern', x: 2260, y: PIER_Y + 2, h: 150 },
  { sprite: 'props/tackle-box', x: 2400, y: PIER_Y + 2, h: 60 },
  { sprite: 'props/cooler-box', x: 2500, y: PIER_Y + 2, h: 66 },
  { sprite: 'props/mooring-rope', x: 2650, y: PIER_Y + 2, h: 44 },
  { sprite: 'props/fishing-bucket', x: 2760, y: PIER_Y + 2, h: 66 },
  { sprite: 'props/small-anchor', x: 2870, y: PIER_Y + 2, h: 74 },
  { sprite: 'props/capture-net', x: 3090, y: PIER_Y + 2, h: 96, flip: true },
];

/** Fundo do mar, na parte visivel abaixo da linha d agua. */
export const SEAFLOOR: Prop[] = [
  { sprite: 'props/seafloor-rocks', x: 2040, y: 706, h: 130, depth: 1 },
  { sprite: 'props/coral-cluster', x: 2190, y: 708, h: 120 },
  { sprite: 'props/kelp-stalk', x: 2320, y: 710, h: 150 },
  { sprite: 'props/aquatic-plant', x: 2420, y: 710, h: 130, flip: true },
  { sprite: 'props/starfish', x: 2520, y: 706, h: 40 },
  { sprite: 'props/coral-cluster', x: 2640, y: 708, h: 100, flip: true },
  { sprite: 'props/sunken-driftwood', x: 2760, y: 704, h: 70 },
  { sprite: 'props/seafloor-rocks', x: 2900, y: 708, h: 110, flip: true },
  { sprite: 'props/cave-entrance', x: 3120, y: 712, h: 190 },
  { sprite: 'props/kelp-stalk', x: 3260, y: 710, h: 160, flip: true },
  { sprite: 'props/seafloor-hole', x: 2050, y: 712, h: 60, opacity: 0.8 },
  { sprite: 'props/seashell', x: 2860, y: 704, h: 28 },
];

/** Detalhe solto na faixa de areia da frente, para a praia nao ficar vazia. */
export const SHORE: Prop[] = [
  { sprite: 'props/seashell', x: 520, y: SAND_Y + 92, h: 22, opacity: 0.9 },
  { sprite: 'props/starfish', x: 1120, y: SAND_Y + 130, h: 26, opacity: 0.9 },
  { sprite: 'props/sunken-driftwood', x: 700, y: SAND_Y + 170, h: 44, opacity: 0.85 },
  { sprite: 'props/seashell', x: 1560, y: SAND_Y + 78, h: 18, flip: true, opacity: 0.85 },
  { sprite: 'props/sand-grass-patch', x: 300, y: SAND_Y + 150, h: 34, opacity: 0.8 },
  { sprite: 'props/coastal-rocks', x: 1850, y: SAND_Y + 120, h: 54, opacity: 0.9 },
  { sprite: 'props/starfish', x: 260, y: SAND_Y + 235, h: 22, flip: true, opacity: 0.8 },
  { sprite: 'props/seashell', x: 980, y: SAND_Y + 250, h: 20, opacity: 0.75 },
];

/** Cardumes e bolhas passeando na coluna de agua. */
export const UNDERWATER_LIFE: Prop[] = [
  { sprite: 'props/decorative-fish-school', x: 2260, y: 590, h: 60, opacity: 0.75, className: 'drift-slow' },
  { sprite: 'props/decorative-fish-school', x: 2720, y: 640, h: 46, opacity: 0.6, flip: true, className: 'drift-slower' },
  { sprite: 'fx/underwater-bubbles', x: 2480, y: 660, h: 90, opacity: 0.6, className: 'rise' },
  { sprite: 'fx/underwater-bubbles', x: 3020, y: 690, h: 70, opacity: 0.45, className: 'rise slow' },
  { sprite: 'fx/underwater-current-streaks', x: 2600, y: 560, h: 60, opacity: 0.3 },
];
