import { useCallback, useEffect, useRef, useState } from 'react';
import { asset } from '../assets';
import { clamp } from '../engine/rng';
import { getSettings } from '../state/settings';
import { groundAt, ROD_REACH, ROD_X, WALK_MAX, WALK_MIN, WORLD_H, WORLD_W } from './layout';

export type Facing = 'left' | 'right';
export type AnimName = 'side-idle' | 'walk' | 'run' | 'jump' | 'fish-no-rod' | 'sit';

const FRAMES: Record<AnimName, number> = {
  'side-idle': 4,
  walk: 6,
  run: 6,
  jump: 6,
  'fish-no-rod': 6,
  sit: 4,
};

/** Duracao de cada quadro, em ms. */
const FRAME_MS: Record<AnimName, number> = {
  'side-idle': 220,
  walk: 100,
  run: 78,
  jump: 110,
  'fish-no-rod': 150,
  sit: 260,
};

const WALK_SPEED = 200;
const RUN_SPEED = 360;
const GRAVITY = 2000;
const JUMP_V = 700;
/** altura do Juggler em unidades de mundo */
export const PLAYER_H = 132;

function framePath(anim: AnimName, facing: Facing, i: number): string {
  return `char/${anim}-${facing}/${String(i).padStart(2, '0')}`;
}

/** Deixa todo quadro em cache antes de o jogador ver, para nao piscar na troca. */
let preloaded = false;
function preload() {
  if (preloaded || typeof Image === 'undefined') return;
  preloaded = true;
  for (const anim of Object.keys(FRAMES) as AnimName[]) {
    for (const facing of ['left', 'right'] as Facing[]) {
      for (let i = 0; i < FRAMES[anim]; i++) {
        const img = new Image();
        img.src = asset(framePath(anim, facing, i));
      }
    }
  }
}

interface Options {
  /** false enquanto o celular ou um modal esta aberto */
  active: boolean;
  /** true quando o Juggler esta pescando: fica parado na pose de pesca */
  fishing: boolean;
}

/**
 * Fisica do personagem, camera e maquina de animacao.
 *
 * O laco escreve direto no DOM (transform da camera, transform do jogador e src
 * do quadro). Sem isso, um `setState` por quadro re-renderizaria o cenario
 * inteiro 60 vezes por segundo.
 */
export function usePlayer({ active, fishing }: Options) {
  const cameraRef = useRef<HTMLDivElement | null>(null);
  const farRef = useRef<HTMLDivElement | null>(null);
  const midRef = useRef<HTMLDivElement | null>(null);
  const playerRef = useRef<HTMLDivElement | null>(null);
  const spriteRef = useRef<HTMLImageElement | null>(null);

  const [nearRod, setNearRod] = useState(false);
  const [scale, setScale] = useState(1);

  const x = useRef(1180);
  const vx = useRef(0);
  const y = useRef(0); // altura acima do chao
  const vy = useRef(0);
  const facing = useRef<Facing>('right');
  const anim = useRef<AnimName>('side-idle');
  const frame = useRef(0);
  const frameT = useRef(0);
  const camX = useRef(0);
  const keys = useRef(new Set<string>());
  const activeRef = useRef(active);
  const fishingRef = useRef(fishing);
  activeRef.current = active;
  fishingRef.current = fishing;

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
    let lastNear = false;

    const step = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;

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
      if (fishingRef.current) next = 'fish-no-rod';
      else if (airborne) next = 'jump';
      else if (dir !== 0) next = running ? 'run' : 'walk';
      else next = 'side-idle';

      if (next !== anim.current) {
        anim.current = next;
        frame.current = 0;
        frameT.current = 0;
      }
      frameT.current += dt * 1000;
      const dur = FRAME_MS[anim.current];
      while (frameT.current >= dur) {
        frameT.current -= dur;
        frame.current = (frame.current + 1) % FRAMES[anim.current];
      }

      // ------------------------------------------------------------ camera
      const view = window.innerWidth / (window.innerHeight / WORLD_H);
      const target = fishingRef.current
        ? clamp(ROD_X + 150 - view / 2, 0, Math.max(0, WORLD_W - view))
        : clamp(x.current - view / 2, 0, Math.max(0, WORLD_W - view));
      const smooth = getSettings().animations ? 1 - Math.pow(0.001, dt) : 1;
      camX.current += (target - camX.current) * smooth;

      // ------------------------------------------------------------ escrita
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
      if (playerRef.current) {
        const gy = groundAt(x.current) - y.current;
        playerRef.current.style.transform = `translate3d(${x.current}px,${gy}px,0)`;
      }
      if (spriteRef.current) {
        const src = asset(framePath(anim.current, facing.current, frame.current));
        if (spriteRef.current.getAttribute('src') !== src) spriteRef.current.src = src;
      }

      const near = !fishingRef.current && Math.abs(x.current - ROD_X) < ROD_REACH;
      if (near !== lastNear) {
        lastNear = near;
        setNearRod(near);
      }

      raf = requestAnimationFrame(step);
    };

    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, []);

  return { cameraRef, farRef, midRef, playerRef, spriteRef, nearRod, scale, press, playerX: x };
}
