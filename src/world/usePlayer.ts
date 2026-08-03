import { useCallback, useEffect, useRef, useState } from 'react';
import { asset } from '../assets';
import { clamp } from '../engine/rng';
import { getDevFlags } from '../state/dev';
import { getSettings } from '../state/settings';
import { clipConfig, frameAt, seqLength } from '../editor/anims';
import { inZone, rodX } from '../editor/scene';
import { CHAR_ANCHOR, CHAR_CANVAS, CHAR_FRAME_H, CLIP_FRAMES } from './charFrames';
import { groundAt, WALK_MAX, WALK_MIN, WORLD_H, WORLD_W } from './layout';

export type Facing = 'left' | 'right';
export type AnimName = 'side-idle' | 'walk' | 'run' | 'jump' | 'fish' | 'sit';
/** Pontos do mundo em que o botao de interagir aparece. */
export type Spot = 'vara' | 'mercado' | null;

/**
 * Quanto o Juggler encolheu para o mar ganhar tela.
 *
 * O quadro inteiro (`CHAR_FRAME_H`) e gerado pelo importador e nao se mexe na
 * mao; o ajuste de jogo mora aqui.
 */
export const CHAR_SCALE = 0.72;

/**
 * Quadro da pescaria por fase do lance. A arte veio com uma pose para cada
 * momento, entao nao faz sentido rodar em loop: cada fase trava no seu quadro.
 * A fase `waiting` passa rapido pelo arremesso antes de assentar na espera.
 */
export type FishPose = 'idle' | 'power' | 'cast' | 'waiting' | 'bite' | 'reeling';

/** Posicao de cada pose dentro da sequencia do clipe `fish`. */
const FISH_SLOT: Record<FishPose, number> = {
  idle: 0,
  power: 1,
  cast: 2,
  waiting: 3,
  bite: 4,
  reeling: 5,
};

const WALK_SPEED = 200;
const RUN_SPEED = 360;
const GRAVITY = 2000;
const JUMP_V = 700;

/**
 * Quanto tempo o quadro de aterrissagem fica na tela, em ms.
 *
 * Antes o clipe de pulo trocava de quadro pelo SINAL da velocidade vertical:
 * no instante em que ele parava de subir ja aparecia a pose de aterrissar, com
 * o Juggler agachado no ar durante toda a descida. Agora o quadro de
 * aterrissagem so entra quando o pe encosta - e sai sozinho depois disso.
 */
const LAND_MS = 150;

/** Velocidade da camera livre, em unidades de mundo por segundo. */
const FREE_CAM_SPEED = 900;
/** Faixa da borda da tela que empurra a camera livre, em px. */
const EDGE_BAND = 46;

/** Limites do zoom de ctrl+roda. */
export const ZOOM_MIN = 0.6;
export const ZOOM_MAX = 2.6;

/** Altura do quadro inteiro em unidades de mundo (inclui a vara). */
export const PLAYER_H = CHAR_FRAME_H * CHAR_SCALE;

function clipName(anim: AnimName, facing: Facing): string {
  return `${anim}-${facing}`;
}

function framePath(clip: string, i: number): string {
  return `char/${clip}/${String(i).padStart(2, '0')}`;
}

/** Deixa todo quadro em cache antes de o jogador ver, para nao piscar na troca. */
let preloaded = false;
function preload() {
  if (preloaded || typeof Image === 'undefined') return;
  preloaded = true;
  for (const clip of Object.keys(CLIP_FRAMES)) {
    for (let i = 0; i < CLIP_FRAMES[clip]; i++) {
      const img = new Image();
      img.src = asset(framePath(clip, i));
    }
  }
}

interface Options {
  /** false enquanto o celular ou um modal esta aberto */
  active: boolean;
  /** true quando o Juggler esta com a vara na mao */
  fishing: boolean;
  /** em que momento do lance ele esta: define o quadro da pescaria */
  fishPose?: FishPose;
  /** congela o mundo inteiro: fisica, animacao e camera (a musica continua) */
  paused?: boolean;
}

/**
 * Fisica do personagem, camera e maquina de animacao.
 *
 * O laco escreve direto no DOM (transform da camera, transform do jogador e src
 * do quadro). Sem isso, um `setState` por quadro re-renderizaria o cenario
 * inteiro 60 vezes por segundo.
 *
 * Os quadros ja saem do importador alinhados pelo quadril e pelo pe dentro de
 * um canvas unico, entao a correcao de ancora e uma constante (`CHAR_ANCHOR`)
 * em vez de uma tabela por quadro. QUAL quadro tocar, em que ordem e em que
 * ritmo vem da configuracao de animacoes (`src/editor/anims.ts`), que o editor
 * edita - aqui nao existe mais ordem de quadro escrita na mao.
 */
export function usePlayer({ active, fishing, fishPose = 'idle', paused = false }: Options) {
  const cameraRef = useRef<HTMLDivElement | null>(null);
  const worldRef = useRef<HTMLDivElement | null>(null);
  const shadowRef = useRef<HTMLDivElement | null>(null);
  const farRef = useRef<HTMLDivElement | null>(null);
  const midRef = useRef<HTMLDivElement | null>(null);
  const playerRef = useRef<HTMLDivElement | null>(null);
  const spriteRef = useRef<HTMLImageElement | null>(null);

  const [spot, setSpot] = useState<Spot>(null);
  const [viewH, setViewH] = useState(() =>
    typeof window === 'undefined' ? WORLD_H : window.innerHeight,
  );
  const [zoom, setZoom] = useState(1);

  const x = useRef(1780);
  const vx = useRef(0);
  const y = useRef(0); // altura acima do chao
  const vy = useRef(0);
  const facing = useRef<Facing>('left');
  const anim = useRef<AnimName>('side-idle');
  /** posicao dentro da SEQUENCIA do clipe, nao o numero do arquivo */
  const step = useRef(0);
  const frameT = useRef(0);
  const camX = useRef(0);
  /** deslocamento vertical da camera livre (so faz efeito com zoom) */
  const camY = useRef(0);
  /** quanto falta do quadro de aterrissagem, em ms */
  const landT = useRef(0);
  const keys = useRef(new Set<string>());
  /** ultima posicao do mouse: a camera livre anda quando ele encosta na borda */
  const mouse = useRef({ x: -1, y: -1 });
  const activeRef = useRef(active);
  const fishingRef = useRef(fishing);
  const pausedRef = useRef(paused);
  const poseRef = useRef<FishPose>(fishPose);
  const scaleRef = useRef(1);
  const viewYRef = useRef(0);
  activeRef.current = active;
  fishingRef.current = fishing;
  pausedRef.current = paused;
  poseRef.current = fishPose;

  const scale = (viewH / WORLD_H) * zoom;
  scaleRef.current = scale;
  /** com zoom o mundo passa da altura da tela: centraliza em vez de cortar embaixo */
  const viewY = (viewH - WORLD_H * scale) / 2;
  viewYRef.current = viewY;

  useEffect(preload, []);

  // ------------------------------------------------------------- teclado
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      keys.current.add(e.code);
      if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'Space', 'KeyA', 'KeyD', 'KeyW'].includes(e.code)) {
        if (activeRef.current) e.preventDefault();
      }
    };
    const up = (e: KeyboardEvent) => keys.current.delete(e.code);
    const blur = () => keys.current.clear();
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    window.addEventListener('blur', blur);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
      window.removeEventListener('blur', blur);
    };
  }, []);

  // ------------------------------------------------------- escala da cena
  useEffect(() => {
    const onResize = () => setViewH(window.innerHeight);
    onResize();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // a camera livre precisa saber onde o mouse esta para empurrar pelas bordas
  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      mouse.current = { x: e.clientX, y: e.clientY };
    };
    const onLeave = () => {
      mouse.current = { x: -1, y: -1 };
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseleave', onLeave);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseleave', onLeave);
    };
  }, []);

  /**
   * Zoom de ctrl+roda.
   *
   * O listener precisa ser nao-passivo para o `preventDefault` valer: sem ele o
   * navegador aplica o proprio zoom da pagina e o jogo sai de lugar.
   */
  useEffect(() => {
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      setZoom((z) => clamp(z * (e.deltaY > 0 ? 0.9 : 1 / 0.9), ZOOM_MIN, ZOOM_MAX));
    };
    window.addEventListener('wheel', onWheel, { passive: false });
    return () => window.removeEventListener('wheel', onWheel);
  }, []);

  const resetZoom = useCallback(() => setZoom(1), []);

  /** Move o jogador por toque/clique: usado pelos botoes de mobile. */
  const press = useCallback((code: string, on: boolean) => {
    if (on) keys.current.add(code);
    else keys.current.delete(code);
  }, []);

  // ------------------------------------------------------------- laco
  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    let lastSpot: Spot = null;
    let lastFrameKey = '';

    /** camera e parallax vao direto pro DOM, sem passar por render do React */
    const writeCamera = () => {
      if (worldRef.current) {
        worldRef.current.style.transform =
          `translate3d(0,${viewYRef.current + camY.current * scaleRef.current}px,0) scale(${scaleRef.current})`;
      }
      if (cameraRef.current) {
        cameraRef.current.style.transform = `translate3d(${-camX.current}px,0,0)`;
      }
      // parallax: quanto mais longe, menos anda
      if (farRef.current) {
        farRef.current.style.transform = `translate3d(${-camX.current * 0.22}px,0,0)`;
      }
      if (midRef.current) {
        midRef.current.style.transform = `translate3d(${-camX.current * 0.52}px,0,0)`;
      }
    };

    const stepLoop = (now: number) => {
      /*
       * Pausado (celular aberto ou editor): fisica e teclado ficam de fora, mas
       * camera, posicao e QUADRO continuam sendo escritos. E isso que deixa a
       * simulacao passo a passo do editor mostrar a pose certa - antes o mundo
       * congelava no ultimo quadro desenhado e a etapa escolhida nao aparecia.
       */
      const frozen = pausedRef.current;
      const dt = frozen ? 0 : Math.min(0.05, (now - last) / 1000);
      last = now;

      const free = getDevFlags().freeCam;
      const k = keys.current;
      // com camera livre o Juggler fica plantado: o teclado passa a ser da tela
      const canMove = !frozen && !free && activeRef.current && !fishingRef.current;
      const left = canMove && (k.has('ArrowLeft') || k.has('KeyA'));
      const right = canMove && (k.has('ArrowRight') || k.has('KeyD'));
      const running = !frozen && !free && (k.has('ShiftLeft') || k.has('ShiftRight'));
      const wantJump = canMove && (k.has('Space') || k.has('ArrowUp') || k.has('KeyW'));

      const speed = running ? RUN_SPEED : WALK_SPEED;
      const dir = (right ? 1 : 0) - (left ? 1 : 0);
      vx.current = dir * speed;
      if (dir !== 0) facing.current = dir > 0 ? 'right' : 'left';

      x.current = clamp(x.current + vx.current * dt, WALK_MIN, WALK_MAX);

      const grounded = y.current <= 0.001 && vy.current <= 0;
      if (wantJump && grounded) {
        vy.current = JUMP_V;
        landT.current = 0;
      }
      if (!frozen) {
        const wasUp = y.current > 0.001;
        vy.current -= GRAVITY * dt;
        y.current = Math.max(0, y.current + vy.current * dt);
        if (y.current === 0) {
          // acabou de encostar o pe: e agora que a aterrissagem aparece
          if (wasUp && vy.current < 0) landT.current = LAND_MS;
          vy.current = 0;
        }
        if (landT.current > 0) landT.current = Math.max(0, landT.current - dt * 1000);
      }

      // ------------------------------------------------- estado da animacao
      // no ar OU nos primeiros quadros depois de cair: os dois sao o clipe de pulo
      const airborne = y.current > 0.5;
      const landing = landT.current > 0;
      let next: AnimName;
      if (fishingRef.current) {
        next = 'fish';
        // o mar aberto fica a esquerda: pescando, o Juggler encara a agua
        facing.current = 'left';
      } else if (airborne || landing) next = 'jump';
      else if (dir !== 0) next = running ? 'run' : 'walk';
      else next = 'side-idle';

      if (next !== anim.current) {
        anim.current = next;
        step.current = 0;
        frameT.current = 0;
      }

      const clip = clipName(anim.current, facing.current);
      const count = CLIP_FRAMES[clip] ?? 1;
      const cfg = clipConfig(`char/${clip}`);

      if (cfg.mode === 'fase') {
        // um quadro por momento do lance, com uma passada rapida pelo arremesso
        step.current = FISH_SLOT[poseRef.current] ?? 0;
      } else if (cfg.mode === 'fisica') {
        // no ar (subindo E descendo) e o impulso; o ultimo quadro e a chegada,
        // e ele so entra quando o pe ja encostou
        step.current = landing ? seqLength(`char/${clip}`) - 1 : 0;
      } else if (seqLength(`char/${clip}`) > 1) {
        frameT.current += dt * 1000;
        const dur = Math.max(30, cfg.frameMs);
        while (frameT.current >= dur) {
          frameT.current -= dur;
          step.current += 1;
        }
      } else {
        step.current = 0;
      }

      // ------------------------------------------------------------ camera
      // congelado, quem manda na camera e o editor (ele escreve em camX direto)
      const view = window.innerWidth / scaleRef.current;
      const maxX = Math.max(0, WORLD_W - view);
      if (frozen) {
        // o editor escreve em camX direto, e a conta dele nao conhece a camera
        // livre: zerar aqui garante que a caixa de selecao caia sobre o sprite
        camY.current = 0;
      } else if (free && activeRef.current) {
        // WASD e setas empurram a tela; o mouse encostado na borda faz o mesmo
        const m = mouse.current;
        let dx = 0;
        let dy = 0;
        if (k.has('KeyA') || k.has('ArrowLeft')) dx -= 1;
        if (k.has('KeyD') || k.has('ArrowRight')) dx += 1;
        if (k.has('KeyW') || k.has('ArrowUp')) dy -= 1;
        if (k.has('KeyS') || k.has('ArrowDown')) dy += 1;
        if (m.x >= 0) {
          if (m.x < EDGE_BAND) dx -= 1;
          if (m.x > window.innerWidth - EDGE_BAND) dx += 1;
          if (m.y < EDGE_BAND) dy -= 1;
          if (m.y > window.innerHeight - EDGE_BAND) dy += 1;
        }
        const boost = k.has('ShiftLeft') || k.has('ShiftRight') ? 2.2 : 1;
        const speed = (FREE_CAM_SPEED * boost * dt) / Math.max(0.25, scaleRef.current);
        camX.current = clamp(camX.current + Math.sign(dx) * speed, 0, maxX);
        // so da para subir e descer quando o zoom faz o mundo passar da tela
        const over = Math.max(0, WORLD_H * scaleRef.current - window.innerHeight);
        const maxY = over / scaleRef.current / 2;
        camY.current = clamp(camY.current + Math.sign(dy) * speed, -maxY, maxY);
      } else if (free) {
        // camera livre com painel aberto: a tela fica onde estava
      } else {
        const focus = fishingRef.current ? rodX() - 90 : x.current;
        const target = clamp(focus - view / 2, 0, maxX);
        const smooth = getSettings().animations ? 1 - Math.pow(0.001, dt) : 1;
        camX.current += (target - camX.current) * smooth;
        camY.current += (0 - camY.current) * smooth;
      }

      writeCamera();
      const ground = groundAt(x.current);
      if (playerRef.current) {
        playerRef.current.style.transform = `translate3d(${x.current}px,${ground - y.current}px,0)`;
      }
      /*
       * A sombra e um elemento separado de proposito: dentro do `.player` ela
       * subia junto com o pulo, como se o chao fosse embora com ele. Aqui ela
       * fica no chao e so encolhe e clareia conforme ele ganha altura.
       */
      if (shadowRef.current) {
        const t = Math.min(1, y.current / 220);
        shadowRef.current.style.transform = `translate3d(${x.current}px,${ground}px,0) scale(${1 - t * 0.45})`;
        shadowRef.current.style.opacity = String(0.34 - t * 0.2);
      }
      const shown = frameAt(`char/${clip}`, step.current, count);
      const frameKey = `${clip}/${shown}`;
      if (spriteRef.current && frameKey !== lastFrameKey) {
        lastFrameKey = frameKey;
        spriteRef.current.src = asset(framePath(clip, shown));
      }

      let near: Spot = null;
      if (!fishingRef.current) {
        if (inZone('vara', x.current)) near = 'vara';
        else if (inZone('mercado', x.current)) near = 'mercado';
      }
      if (near !== lastSpot) {
        lastSpot = near;
        setSpot(near);
      }

      raf = requestAnimationFrame(stepLoop);
    };

    raf = requestAnimationFrame(stepLoop);
    return () => cancelAnimationFrame(raf);
  }, []);

  return {
    cameraRef,
    worldRef,
    farRef,
    midRef,
    playerRef,
    shadowRef,
    spriteRef,
    /** posicao da camera: o editor escreve aqui para navegar pelo mapa */
    camXRef: camX,
    spot,
    nearRod: spot === 'vara',
    nearMarket: spot === 'mercado',
    scale,
    /** deslocamento vertical da cena quando o zoom passa da altura da tela */
    viewY,
    zoom,
    resetZoom,
    press,
    playerX: x,
  };
}

/**
 * Estilo fixo do sprite do jogador: a ancora do canvas e constante, entao da
 * para calcular uma vez so em vez de reescrever a cada quadro.
 */
export const PLAYER_SPRITE_STYLE = {
  height: PLAYER_H,
  marginLeft: (CHAR_ANCHOR.dx * PLAYER_H) / CHAR_CANVAS.h,
  marginBottom: (CHAR_ANCHOR.dy * PLAYER_H) / CHAR_CANVAS.h,
};
