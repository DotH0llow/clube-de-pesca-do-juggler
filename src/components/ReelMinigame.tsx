import { useEffect, useRef, useState } from 'react';
import { clamp } from '../engine/rng';
import type { CastResult } from '../state/types';
import { FishSprite, JunkSprite, Sprite } from './Sprite';

interface Props {
  target: CastResult;
  onDone: (landed: boolean) => void;
}

const TIME_LIMIT = 22000;

/**
 * Minigame de puxada. Segure para subir a faixa verde, solte para descer.
 * Manter o peixe dentro da faixa enche a barra; deixar escapar esvazia.
 */
export function ReelMinigame({ target, onDone }: Props) {
  const d = target.difficulty;

  const [zone, setZone] = useState(0.45);
  const [fish, setFish] = useState(0.5);
  const [progress, setProgress] = useState(0.32);
  const [inside, setInside] = useState(false);

  const zoneRef = useRef(0.45);
  const velRef = useRef(0);
  const fishRef = useRef(0.5);
  const fishVelRef = useRef(0);
  const fishTargetRef = useRef(0.5);
  const progressRef = useRef(0.32);
  const holdRef = useRef(false);
  const doneRef = useRef(false);
  const rafRef = useRef(0);

  const zoneSize = clamp(0.3 - d * 0.16, 0.1, 0.3);

  useEffect(() => {
    const start = performance.now();
    let last = start;
    let nextJump = start;

    const step = (now: number) => {
      const dt = Math.min(0.048, (now - last) / 1000);
      last = now;

      // ---- faixa do jogador (fisica simples)
      const accel = holdRef.current ? -2.6 : 2.4;
      velRef.current = clamp(velRef.current + accel * dt, -1.5, 1.5);
      velRef.current *= 0.94;
      zoneRef.current += velRef.current * dt;
      if (zoneRef.current < 0) {
        zoneRef.current = 0;
        velRef.current = 0;
      }
      if (zoneRef.current > 1 - zoneSize) {
        zoneRef.current = 1 - zoneSize;
        velRef.current = 0;
      }

      // ---- peixe: caminhada aleatoria, mais nervosa em raridade alta
      if (now >= nextJump) {
        fishTargetRef.current = Math.random();
        nextJump = now + 500 + Math.random() * (1400 - d * 900);
      }
      const pull = (fishTargetRef.current - fishRef.current) * (1.6 + d * 3.4);
      fishVelRef.current += pull * dt;
      fishVelRef.current *= 0.9;
      fishRef.current = clamp(fishRef.current + fishVelRef.current * dt, 0, 1);

      // ---- progresso
      const isIn = fishRef.current >= zoneRef.current && fishRef.current <= zoneRef.current + zoneSize;
      progressRef.current += (isIn ? 0.42 : -(0.2 + d * 0.34)) * dt;
      progressRef.current = clamp(progressRef.current, 0, 1);

      setZone(zoneRef.current);
      setFish(fishRef.current);
      setProgress(progressRef.current);
      setInside(isIn);

      if (progressRef.current >= 1) return finish(true);
      if (progressRef.current <= 0) return finish(false);
      if (now - start > TIME_LIMIT) return finish(false);

      rafRef.current = requestAnimationFrame(step);
    };

    const finish = (landed: boolean) => {
      if (doneRef.current) return;
      doneRef.current = true;
      cancelAnimationFrame(rafRef.current);
      onDone(landed);
    };

    rafRef.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(rafRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [d, zoneSize]);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        e.preventDefault();
        holdRef.current = true;
      }
    };
    const up = (e: KeyboardEvent) => {
      if (e.code === 'Space') holdRef.current = false;
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
    };
  }, []);

  const hold = (v: boolean) => () => {
    holdRef.current = v;
  };

  return (
    <div className="pixel-box" style={{ width: 'min(460px, 92vw)' }}>
      <div
        className="reel"
        onPointerDown={hold(true)}
        onPointerUp={hold(false)}
        onPointerLeave={hold(false)}
        onPointerCancel={hold(false)}
      >
        <div className="reel-track">
          <div
            className={`reel-zone${inside ? ' hot' : ''}`}
            style={{ top: `${zone * 100}%`, height: `${zoneSize * 100}%` }}
          />
          <div className="reel-fish" style={{ top: `calc(${fish * 100}% - 11px)` }}>
            {target.fish ? (
              <FishSprite fish={target.fish} size={22} flip />
            ) : target.junk ? (
              <JunkSprite junk={target.junk} size={22} />
            ) : (
              <Sprite path="fx/chest-closed" size={22} />
            )}
          </div>
        </div>
        <div className="reel-progress">
          <div className="fill" style={{ height: `${progress * 100}%` }} />
        </div>
      </div>
      <p className="reel-hint">Segure para subir a faixa. Mantenha o vulto dentro dela.</p>
    </div>
  );
}
