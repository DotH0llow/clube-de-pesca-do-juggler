import { useEffect, useRef, useState } from 'react';
import type { CastQuality } from '../engine/outcomes';

interface Props {
  onLock: (quality: CastQuality) => void;
}

const GOOD_MIN = 26;
const GOOD_MAX = 74;
const PERFECT_MIN = 43;
const PERFECT_MAX = 57;

/** Barra de forca do lancamento. Parar no meio vale lancamento perfeito. */
export function CastBar({ onLock }: Props) {
  const [pos, setPos] = useState(0);
  const posRef = useRef(0);
  const dirRef = useRef(1);
  const rafRef = useRef(0);
  const lockedRef = useRef(false);

  useEffect(() => {
    let last = performance.now();
    const step = (now: number) => {
      const dt = Math.min(48, now - last);
      last = now;
      posRef.current += dirRef.current * dt * 0.115;
      if (posRef.current >= 100) {
        posRef.current = 100;
        dirRef.current = -1;
      } else if (posRef.current <= 0) {
        posRef.current = 0;
        dirRef.current = 1;
      }
      setPos(posRef.current);
      rafRef.current = requestAnimationFrame(step);
    };
    rafRef.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(rafRef.current);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'Space' || e.code === 'Enter') {
        e.preventDefault();
        lock();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function lock() {
    if (lockedRef.current) return;
    lockedRef.current = true;
    cancelAnimationFrame(rafRef.current);
    const v = posRef.current;
    const quality: CastQuality =
      v >= PERFECT_MIN && v <= PERFECT_MAX ? 'perfeito' : v >= GOOD_MIN && v <= GOOD_MAX ? 'bom' : 'fraco';
    onLock(quality);
  }

  return (
    <div className="pixel-box" style={{ width: 'min(460px, 92vw)' }}>
      <div className="meter" onPointerDown={lock}>
        <div className="zone" style={{ left: `${GOOD_MIN}%`, width: `${GOOD_MAX - GOOD_MIN}%` }} />
        <div
          className="zone perfect"
          style={{ left: `${PERFECT_MIN}%`, width: `${PERFECT_MAX - PERFECT_MIN}%` }}
        />
        <div className="needle" style={{ left: `calc(${pos}% - 3px)` }} />
      </div>
      <p className="reel-hint">Toque (ou espaco) para travar a forca do lancamento</p>
      <div className="btn-row" style={{ marginTop: 8 }}>
        <button className="btn primary" onClick={lock}>
          TRAVAR
        </button>
      </div>
    </div>
  );
}
