import { useEffect, useRef } from 'react';
import { useSettings } from '../state/settings';

interface Props {
  left: number;
  width: number;
  top: number;
  height: number;
}

const GLINTS = [
  { x: 0.08, y: 0.23, w: 78, pace: 0.62, phase: 0.4 },
  { x: 0.29, y: 0.54, w: 56, pace: 0.83, phase: 1.9 },
  { x: 0.49, y: 0.31, w: 94, pace: 0.51, phase: 3.1 },
  { x: 0.67, y: 0.72, w: 62, pace: 0.76, phase: 4.4 },
  { x: 0.84, y: 0.43, w: 71, pace: 0.58, phase: 5.6 },
];

/** Reflexos de superficie atualizados sem re-renderizar o mundo. */
export function WaterDetails({ left, width, top, height }: Props) {
  const paths = useRef<(SVGPathElement | null)[]>([]);
  const settings = useSettings();

  useEffect(() => {
    let raf = 0;
    const start = performance.now();

    const draw = (now: number) => {
      const seconds = (now - start) / 1000;
      for (let i = 0; i < GLINTS.length; i += 1) {
        const glint = GLINTS[i];
        const node = paths.current[i];
        if (!node) continue;
        const pulse = Math.sin(seconds * glint.pace * Math.PI * 2 + glint.phase);
        const drift = Math.sin(seconds * glint.pace * 0.43 + glint.phase) * 11;
        const x = glint.x * width + drift;
        const y = glint.y * height + pulse * 2;
        const half = glint.w * (0.58 + (pulse + 1) * 0.21);
        node.setAttribute('d', `M ${(x - half).toFixed(1)} ${y.toFixed(1)} Q ${x.toFixed(1)} ${(y - 2.5).toFixed(1)} ${(x + half).toFixed(1)} ${y.toFixed(1)}`);
        node.style.opacity = `${0.12 + (pulse + 1) * 0.12}`;
      }
      if (settings.animations) raf = requestAnimationFrame(draw);
    };

    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [width, height, settings.animations]);

  return (
    <svg
      className="water-details"
      style={{ left, top, width, height }}
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      aria-hidden
    >
      {GLINTS.map((glint, index) => (
        <path key={glint.phase} ref={(node) => { paths.current[index] = node; }} className="water-glint" />
      ))}
    </svg>
  );
}
