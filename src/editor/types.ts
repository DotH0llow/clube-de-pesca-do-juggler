/** Camadas do mundo, do fundo para a frente. */
export type LayerId = 'fundo' | 'cenario' | 'objetos' | 'interagiveis';

export const LAYERS: { id: LayerId; label: string; hint: string }[] = [
  { id: 'fundo', label: 'BACKGROUND', hint: 'fundo do mar, vida submersa e detalhe de areia' },
  { id: 'cenario', label: 'CENÁRIO', hint: 'coqueiros, cabana, mercado, pier e barco' },
  { id: 'objetos', label: 'OBJETOS', hint: 'tralha solta: caixas, barris, vara, corda' },
  { id: 'interagiveis', label: 'INTERAGÍVEIS', hint: 'áreas de interação (vara, mercado)' },
];

export type ZoneId = 'vara' | 'mercado';

export interface SceneObject {
  id: string;
  layer: LayerId;
  /** sprite comum ou area de interacao */
  kind: 'sprite' | 'zone';
  /** caminho no registro de assets (kind = sprite) */
  sprite?: string;
  /** qual interacao esta area dispara (kind = zone) */
  zone?: ZoneId;
  /** canto superior esquerdo, em unidades de mundo */
  x: number;
  y: number;
  w: number;
  h: number;
  /** graus, em volta do centro */
  rot: number;
  flip?: boolean;
  opacity?: number;
  /** true = nao pode ser selecionado nem apagado */
  locked?: boolean;
  /** tratamento visual de coisa submersa */
  under?: boolean;
  /** classe extra de animacao (drift, rise...) */
  anim?: string;
  /** papel especial no jogo: a vara inclina ao lancar */
  role?: 'vara';
}

export interface SceneState {
  objects: SceneObject[];
  hidden: LayerId[];
}
