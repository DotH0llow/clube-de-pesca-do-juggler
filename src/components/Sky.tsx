import { useMemo } from 'react';
import { asset } from '../assets';
import type { RegionId } from '../state/types';

/**
 * Céu de fundo com nuvens e passaros.
 *
 * Cada nuvem e cada bando sorteia tamanho, altura, opacidade, velocidade e
 * atraso inicial - o atraso negativo espalha todo mundo pelo céu ja no primeiro
 * quadro, em vez de fazer fila entrando pela esquerda.
 *
 * Velocidades: nuvens a 30% do que era antes, passaros a 10%.
 */

export interface SkyConfig {
  bg: string;
  cloud: string;
  storm: boolean;
  night: boolean;
}

export const SKY: Record<RegionId, SkyConfig> = {
  enseada: { bg: 'bg/sky-day', cloud: 'sky/large-cloud', storm: false, night: false },
  recife: { bg: 'bg/sky-sunset', cloud: 'sky/sunset-cloud-strip', storm: false, night: false },
  naufragio: { bg: 'bg/sky-day', cloud: 'sky/storm-cloud', storm: true, night: false },
  fossa: { bg: 'bg/sky-night', cloud: 'sky/night-cloud-strip', storm: false, night: true },
};

/** Base das duracoes, ja com o corte de velocidade aplicado. */
const CLOUD_BASE_S = 100 / 0.3; // 70% mais lentas
const BIRD_BASE_S = 200 / 0.1; // 90% mais lentos

interface Drifter {
  sprite: string;
  top: number;
  height: number;
  opacity: number;
  duration: number;
  delay: number;
  flip: boolean;
}

/** RNG com semente, para o ceu nao remontar a cada render. */
function seeded(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

export function Sky({ region }: { region: RegionId }) {
  const cfg = SKY[region];

  const clouds = useMemo<Drifter[]>(() => {
    const rnd = seeded(region.length * 7919 + 13);
    const small = 'sky/small-cloud';
    return Array.from({ length: 6 }, () => {
      const big = rnd() > 0.45;
      const dur = CLOUD_BASE_S * (0.75 + rnd() * 0.9);
      return {
        sprite: cfg.night ? cfg.cloud : big ? cfg.cloud : small,
        top: 2 + rnd() * 30,
        height: (big ? 9 : 5.5) * (0.7 + rnd() * 0.8),
        opacity: 0.45 + rnd() * 0.45,
        duration: dur,
        delay: -dur * rnd(),
        flip: rnd() > 0.5,
      };
    });
  }, [region, cfg.cloud, cfg.night]);

  const birds = useMemo<Drifter[]>(() => {
    const rnd = seeded(region.length * 104729 + 7);
    return Array.from({ length: 3 }, () => {
      const dur = BIRD_BASE_S * (0.8 + rnd() * 0.6);
      return {
        sprite: rnd() > 0.5 ? 'sky/distant-bird-flock' : 'sky/seagull',
        top: 8 + rnd() * 26,
        height: 2.2 + rnd() * 3.6,
        opacity: 0.5 + rnd() * 0.4,
        duration: dur,
        delay: -dur * rnd(),
        flip: rnd() > 0.6,
      };
    });
  }, [region]);

  return (
    <div className="sky" style={{ backgroundImage: `url(${asset(cfg.bg)})` }}>
      {cfg.night && <img className="stars" src={asset('sky/star-cluster')} alt="" />}

      {clouds.map((c, i) => (
        <img
          key={`c${i}`}
          className="drifter"
          src={asset(c.sprite)}
          alt=""
          style={{
            top: `${c.top}%`,
            height: `${c.height}%`,
            opacity: c.opacity,
            animationDuration: `${c.duration}s`,
            animationDelay: `${c.delay}s`,
            transform: c.flip ? 'scaleX(-1)' : undefined,
          }}
        />
      ))}

      {!cfg.night &&
        birds.map((b, i) => (
          <img
            key={`b${i}`}
            className="drifter"
            src={asset(b.sprite)}
            alt=""
            style={{
              top: `${b.top}%`,
              height: `${b.height}%`,
              opacity: b.opacity,
              animationDuration: `${b.duration}s`,
              animationDelay: `${b.delay}s`,
              transform: b.flip ? 'scaleX(-1)' : undefined,
            }}
          />
        ))}

      {cfg.storm && (
        <>
          <div className="storm-tint" />
          <img className="rain" src={asset('sky/rain-streaks')} alt="" />
          <img className="rain rain-2" src={asset('sky/rain-streaks')} alt="" />
          <img className="lightning" src={asset('sky/lightning-bolt')} alt="" />
        </>
      )}
    </div>
  );
}
