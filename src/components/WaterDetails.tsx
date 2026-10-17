import { useEffect, useRef } from 'react';
import { useSettings } from '../state/settings';

interface Props { left: number; width: number; top: number; height: number }

interface Glint { x: number; y: number; length: number; phase: number; speed: number; depth: number }

// Spatial placement is seeded so changing panels never reshuffles the sea.
function glintsFor(width: number, height: number): Glint[] {
  let seed = 0x9e3779b9;
  const random = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  const count = Math.max(20, Math.min(220, Math.round(width / 38)));
  return Array.from({ length: count }, () => {
    const depth = Math.pow(random(), 1.28);
    return {
      x: random() * width,
      y: 14 + depth * (height - 28),
      length: 16 + random() * (72 - depth * 32),
      phase: random() * Math.PI * 2,
      speed: .48 + random() * .32,
      depth,
    };
  });
}

/** Moving caustic strokes share the same water column as the shore and reef. */
export function WaterDetails({ left, width, top, height }: Props) {
  const paths = useRef<(SVGPathElement | null)[]>([]);
  const { animations } = useSettings();
  const glints = glintsFor(width, height);

  useEffect(() => {
    let raf = 0;
    let lastDraw = 0;
    const start = performance.now();
    const draw = (now: number) => {
      if (now - lastDraw >= 30 || !animations) {
        lastDraw = now;
        const time = animations ? (now - start) / 1000 : 0;
        glints.forEach((g, i) => {
          const node = paths.current[i];
          if (!node) return;
          const wave = Math.sin(time * g.speed * Math.PI * 2 + g.phase);
          const drift = Math.sin(time * .43 + g.phase) * 13;
          const cx = g.x + drift;
          const cy = g.y + wave * 3;
          const radius = g.length * (.74 + .15 * wave);
          node.setAttribute('d', `M ${(cx-radius).toFixed(1)} ${cy.toFixed(1)} Q ${cx.toFixed(1)} ${(cy-5-wave*2).toFixed(1)} ${(cx+radius).toFixed(1)} ${cy.toFixed(1)}`);
          node.style.opacity = String((.1 + (wave + 1) * .12) * (1 - g.depth * .72));
        });
      }
      if (animations) raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [width, height, animations]);

  return (
    <svg className="water-details" style={{ left, top, width, height }} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" aria-hidden>
      {glints.map((_, index) => <path key={index} ref={(node) => { paths.current[index] = node; }} className="water-glint" />)}
    </svg>
  );
}
