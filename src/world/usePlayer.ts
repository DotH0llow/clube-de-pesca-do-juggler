import { useCallback, useEffect, useRef, useState } from 'react';
import { asset } from '../assets';
import { clamp } from '../engine/rng';
import { getSettings } from '../state/settings';
import { inZone, rodX } from '../editor/scene';
import { CHAR_ANCHOR, CHAR_CANVAS, CHAR_FRAME_H, CLIP_FRAMES } from './charFrames';
import { groundAt, WALK_MAX, WALK_MIN, WORLD_H, WORLD_W } from './layout';

export type Facing = 'left' | 'right';
export type AnimName = 'side-idle' | 'walk' | 'run' | 'jump' | 'fish' | 'sit';
/** Pontos do mundo em que o botao de interagir aparece. */
export type Spot = 'vara' | 'mercado' | null;

/**
 * Duracao de cada quadro, em ms.
 *
 * A caminhada tem 4 quadros (pe esquerdo -> perfil -> pe direito -> perfil), o
 * que da dois passos por ciclo. Correr usa exatamente a mesma arte, 25% mais
 * rapida - foi assim que a animacao foi pedida.
 */
const WALK_FRAME_MS = 170;
export const RUN_ANIM_SPEEDUP = 1.25;

const FRAME_MS: Record<AnimName, number> = {
  'side-idle': 1000,
  walk: WALK_FRAME_MS,
  run: WALK_FRAME_MS / RUN_ANIM_SPEEDUP,
  jump: 1000, // o pulo nao roda no tempo: o quadro sai da velocidade vertical
  fish: 1000, // a pescaria nao roda no tempo: o quadro sai da fase do lance
  sit: 1000,
};

/**
 * Quadro da pescaria por fase do lance. A arte veio com uma pose para cada
 * momento, entao nao faz sentido rodar em loop: cada fase trava no seu quadro.
 * A fase `waiting` passa rapido pelo arremesso antes de assentar na espera.
 */
export type FishPose = 'idle' | 'power' | 'cast' | 'waiting' | 'bite' | 'reeling';
const FISH_FRAME: Record<FishPose, number> = {
  idle: 0, // 01_ready
  power: 1, // 02_cast_backswing
  cast: 2, // 03_cast_forward
  waiting: 3, // 04_wait_reel
  bite: 4, // 05_hook_set
  reeling: 5, // 06_reel_in
};
/** quanto tempo o arremesso fica na tela antes de virar espera */
const CAST_HOLD_MS = 380;

const WALK_SPEED = 200;
const RUN_SPEED = 360;
const GRAVITY = 2000;
const JUMP_V = 700;

/** Altura do quadro inteiro em unidades de mundo (inclui a vara). */
export const PLAYER_H = CHAR_FRAME_H;

function clipName(anim: AnimName, facing: Facing): string {
  return `${anim}-${facing}`;
}

function framePath(anim: AnimName, facing: Facing, i: number): string {
  return `char/${clipName(anim, facing)}/${String(i).padStart(2, '0')}`;
}

/** Deixa todo quadro em cache antes de o jogador ver, para nao piscar na troca. */
let preloaded = false;
function preload() {
  if (preloaded || typeof Image === 'undefined') return;
  preloaded = true;
  for (const clip of Object.keys(CLIP_FRAMES)) {
    for (let i = 0; i < CLIP_FRAMES[clip]; i++) {
      const img = new Image();
      img.src = asset(`char/${clip}/${String(i).padStart(2, '0')}`);
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
 * em vez de uma tabela por quadro.
 */
export function usePlayer({ active, fishing, fishPose = 'idle', paused = false }: Options) {
  const cameraRef = useRef<HTMLDivElement | null>(null);
  const farRef = useRef<HTMLDivElement | null>(null);
  const midRef = useRef<HTMLDivElement | null>(null);
  const playerRef = useRef<HTMLDivElement | null>(null);
  const spriteRef = useRef<HTMLImageElement | null>(null);

  const [spot, setSpot] = useState<Spot>(null);
  const [scale, setScale] = useState(1);

  const x = useRef(1780);
  const vx = useRef(0);
  const y = useRef(0); // altura acima do chao
  const vy = useRef(0);
  const facing = useRef<Facing>('left');
  const anim = useRef<AnimName>('side-idle');
  const frame = useRef(0);
  const frameT = useRef(0);
  const camX = useRef(0);
  const keys = useRef(new Set<string>());
  const activeRef = useRef(active);
  const fishingRef = useRef(fishing);
  const pausedRef = useRef(paused);
  const poseRef = useRef<FishPose>(fishPose);
  /** ha quanto tempo a fase da pescaria mudou: segura o quadro de arremesso */
  const poseT = useRef(0);
  activeRef.current = active;
  fishingRef.current = fishing;
  pausedRef.current = paused;
  if (poseRef.current !== fishPose) {
    poseRef.current = fishPose;
    poseT.current = 0;
  }

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
    const onResize = () => setScale(window.innerHeight / WORLD_H);
    onResize();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

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

    const step = (now: number) => {
      // pausado (celular aberto ou editor): o mundo congela, mas a camera
      // continua obedecendo - e assim que o editor navega pelo mapa
      if (pausedRef.current) {
        last = now;
        writeCamera();
        raf = requestAnimationFrame(step);
        return;
      }

      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      poseT.current += dt * 1000;

      const k = keys.current;
      const canMove = activeRef.current && !fishingRef.current;
      const left = canMove && (k.has('ArrowLeft') || k.has('KeyA'));
      const right = canMove && (k.has('ArrowRight') || k.has('KeyD'));
      const running = k.has('ShiftLeft') || k.has('ShiftRight');
      const wantJump = canMove && (k.has('Space') || k.has('ArrowUp') || k.has('KeyW'));

      const speed = running ? RUN_SPEED : WALK_SPEED;
      const dir = (right ? 1 : 0) - (left ? 1 : 0);
      vx.current = dir * speed;
      if (dir !== 0) facing.current = dir > 0 ? 'right' : 'left';

      x.current = clamp(x.current + vx.current * dt, WALK_MIN, WALK_MAX);

      const grounded = y.current <= 0.001 && vy.current <= 0;
      if (wantJump && grounded) {
        vy.current = JUMP_V;
      }
      vy.current -= GRAVITY * dt;
      y.current = Math.max(0, y.current + vy.current * dt);
      if (y.current === 0) vy.current = 0;

      // ------------------------------------------------- estado da animacao
      const airborne = y.current > 0.5;
      let next: AnimName;
      if (fishingRef.current) {
        next = 'fish';
        // o mar aberto fica a esquerda: pescando, o Juggler encara a agua
        facing.current = 'left';
      } else if (airborne) next = 'jump';
      else if (dir !== 0) next = running ? 'run' : 'walk';
      else next = 'side-idle';

      if (next !== anim.current) {
        anim.current = next;
        frame.current = 0;
        frameT.current = 0;
      }

      const count = CLIP_FRAMES[clipName(anim.current, facing.current)] ?? 1;
      if (anim.current === 'fish') {
        // quadro colado na fase do lance, com uma passada rapida pelo arremesso
        const pose = poseRef.current;
        const shown =
          pose === 'waiting' && poseT.current < CAST_HOLD_MS ? 'cast' : pose;
        frame.current = Math.min(count - 1, FISH_FRAME[shown]);
      } else if (anim.current === 'jump') {
        // subindo mostra o impulso, descendo mostra a aterrissagem
        frame.current = vy.current > 0 ? 0 : Math.min(1, count - 1);
      } else if (count > 1) {
        frameT.current += dt * 1000;
        const dur = FRAME_MS[anim.current];
        while (frameT.current >= dur) {
          frameT.current -= dur;
          frame.current = (frame.current + 1) % count;
        }
      } else {
        frame.current = 0;
      }

      // ------------------------------------------------------------ camera
      const view = window.innerWidth / (window.innerHeight / WORLD_H);
      const focus = fishingRef.current ? rodX() - 107 : x.current;
      const target = clamp(focus - view / 2, 0, Math.max(0, WORLD_W - view));
      const smooth = getSettings().animations ? 1 - Math.pow(0.001, dt) : 1;
      camX.current += (target - camX.current) * smooth;

      writeCamera();
      if (playerRef.current) {
        const gy = groundAt(x.current) - y.current;
        playerRef.current.style.transform = `translate3d(${x.current}px,${gy}px,0)`;
      }
      const clip = clipName(anim.current, facing.current);
      const frameKey = `${clip}/${frame.current}`;
      if (spriteRef.current && frameKey !== lastFrameKey) {
        lastFrameKey = frameKey;
        const el = spriteRef.current;
        el.src = asset(framePath(anim.current, facing.current, frame.current));
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

      raf = requestAnimationFrame(step);
    };

    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, []);

  return {
    cameraRef,
    farRef,
    midRef,
    playerRef,
    spriteRef,
    /** posicao da camera: o editor escreve aqui para navegar pelo mapa */
    camXRef: camX,
    spot,
    nearRod: spot === 'vara',
    nearMarket: spot === 'mercado',
    scale,
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
