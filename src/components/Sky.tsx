import { useMemo } from 'react';
import { Rain } from './Rain';
import { asset } from '../assets';
import { skyPhase, type SkyPhaseId } from '../data/skies';
import { floatersAt, useFloaters, type Floater } from '../editor/floaters';
import { useDevFlags } from '../state/dev';

/**
 * Ceu de fundo com o que passa flutuando nele.
 *
 * O ceu em si e a pintura da hora do dia (`src/data/skies.ts`). O que atravessa
 * a tela - nuvem, bando, gaivota, neblina - vem da lista de flutuadores
 * (`src/editor/floaters.ts`), que a secao FLUTUADORES do editor edita: quantos
 * sao, de onde para onde vao, em quanto tempo e em que horas aparecem.
 *
 * Cada copia sorteia altura, tamanho, opacidade e atraso dentro da faixa que
 * voce configurou. O atraso e negativo de proposito: assim todo mundo ja esta
 * espalhado pelo ceu no primeiro quadro, em vez de entrar em fila pela esquerda.
 */

/** RNG com semente, para o ceu nao remontar a cada render. */
function seeded(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function hashOf(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

interface Copy {
  key: string;
  sprite: string;
  fromX: number;
  toX: number;
  fromY: number;
  toY: number;
  height: number;
  opacity: number;
  duration: number;
  delay: number;
  flip: boolean;
}

function copiesOf(it: Floater): Copy[] {
  const rnd = seeded(hashOf(it.id) + it.count * 7919);
  const n = Math.max(0, Math.min(24, Math.round(it.count)));
  return Array.from({ length: n }, (_, i) => {
    const jitter = (it.spreadY || 0) * (rnd() - 0.5) * 2;
    const dur = Math.max(2, it.seconds * (1 + (rnd() - 0.5) * 2 * (it.secondsVar || 0)));
    return {
      key: `${it.id}-${i}`,
      sprite: it.sprite,
      fromX: it.fromX,
      toX: it.toX,
      fromY: it.fromY + jitter,
      toY: it.toY + jitter,
      height: Math.max(0.2, it.size * (1 + (rnd() - 0.5) * 2 * (it.sizeVar || 0))),
      opacity: Math.min(1, Math.max(0.02, it.opacity * (1 + (rnd() - 0.5) * 2 * (it.opacityVar || 0)))),
      duration: dur,
      delay: -dur * rnd(),
      flip: it.flip !== rnd() > 0.82,
    };
  });
}

export function Sky({ hour }: { hour: SkyPhaseId }) {
  const cfg = skyPhase(hour);
  const floaters = useFloaters();
  const dev = useDevFlags();
  // o interruptor de teste manda na chuva; sem ele, quem decide e a hora do dia
  const storm = dev.rain === null ? cfg.storm : dev.rain;

  const copies = useMemo(() => {
    void floaters;
    return floatersAt(hour).flatMap(copiesOf);
  }, [hour, floaters]);

  return (
    <div className="sky" style={{ backgroundImage: `url(${asset(cfg.bg)})` }}>
      {cfg.night && <img className="stars" src={asset('sky/star-cluster')} alt="" />}

      {copies.map((c) => (
        <img
          key={c.key}
          className="drifter"
          src={asset(c.sprite)}
          alt=""
          style={
            {
              height: `${c.height}%`,
              opacity: c.opacity,
              animationDuration: `${c.duration}s`,
              animationDelay: `${c.delay}s`,
              '--from-x': `${c.fromX}vw`,
              '--to-x': `${c.toX}vw`,
              '--from-y': `${c.fromY}vh`,
              '--to-y': `${c.toY}vh`,
              '--flip': c.flip ? -1 : 1,
            } as React.CSSProperties
          }
        />
      ))}

      {storm && (
        <>
          <div className="storm-tint" />
          {/* Era `sky/rain-streaks` duas vezes: uma imagem de riscos esticada
              na tela e deslizada em loop. Agora a chuva é feita de gota, em
              três distâncias, com respingo onde a água bate - ver `Rain`. */}
          <Rain />
          <img className="lightning" src={asset('sky/lightning-bolt')} alt="" />
        </>
      )}
    </div>
  );
}
