import { memo } from 'react';
import { asset } from '../assets';
import { REGIONS } from '../data/regions';
import type { CastResult, RegionId } from '../state/types';
import type { Phase } from '../hooks/useFishingLoop';
import { useSettings } from '../state/settings';
import {
  BEACH,
  BOBBER_X,
  BOBBER_Y,
  FOREST,
  PIER_END,
  PIER_PROPS,
  PIER_START,
  PIER_Y,
  ROD_X,
  SAND_Y,
  SEAFLOOR,
  SEA_START,
  SHORE,
  UNDERWATER_LIFE,
  WATER_Y,
  WORLD_H,
  WORLD_W,
  type Prop,
} from '../world/layout';
import { PLAYER_H } from '../world/usePlayer';
import { FishSprite } from './Sprite';
import { Sky } from './Sky';

interface Props {
  region: RegionId;
  phase: Phase;
  pending: CastResult | null;
  fishing: boolean;
  cameraRef: React.MutableRefObject<HTMLDivElement | null>;
  farRef: React.MutableRefObject<HTMLDivElement | null>;
  midRef: React.MutableRefObject<HTMLDivElement | null>;
  playerRef: React.MutableRefObject<HTMLDivElement | null>;
  spriteRef: React.MutableRefObject<HTMLImageElement | null>;
  scale: number;
}

/** Sprite ancorado pela base, posicionado em coordenadas de mundo. */
function WorldProp({ sprite, x, y, h, flip, opacity, className }: Prop) {
  return (
    <img
      className={`wprop${className ? ` ${className}` : ''}`}
      src={asset(sprite)}
      alt=""
      style={{
        left: x,
        top: y - h,
        height: h,
        opacity,
        transform: flip ? 'scaleX(-1)' : undefined,
      }}
    />
  );
}

const Props = memo(function Props({ list }: { list: Prop[] }) {
  return (
    <>
      {list.map((p, i) => (
        <WorldProp key={`${p.sprite}-${i}`} {...p} />
      ))}
    </>
  );
});

/**
 * O mundo inteiro: ceu, camadas de parallax, praia, pier, corte da agua e o
 * Juggler. Nada aqui re-renderiza por quadro - camera e personagem sao movidos
 * direto no DOM pelo `usePlayer`.
 */
export function World({
  region,
  phase,
  pending,
  fishing,
  cameraRef,
  farRef,
  midRef,
  playerRef,
  spriteRef,
  scale,
}: Props) {
  const settings = useSettings();
  const p = REGIONS[region].palette;
  const inWater = fishing && (phase === 'waiting' || phase === 'bite' || phase === 'reeling');
  const biting = phase === 'bite';
  const reeling = phase === 'reeling';

  return (
    <div className="stage">
      <Sky region={region} />

      {/* escala tudo pela altura da tela: o mundo tem sempre 720 de altura */}
      <div className="world-scale" style={{ transform: `scale(${scale})` }}>
        {/* ------------------------------------------------ fundo distante */}
        <div className="layer" ref={farRef}>
          <div
            className="strip"
            style={{
              backgroundImage: `url(${asset('sky/distant-mountain-strip')})`,
              top: WATER_Y - 96,
              height: 96,
              opacity: 0.55,
            }}
          />
        </div>

        <div className="layer" ref={midRef}>
          <div
            className="strip"
            style={{
              backgroundImage: `url(${asset('sky/distant-island-strip')})`,
              top: WATER_Y - 86,
              height: 92,
              opacity: 0.85,
            }}
          />
          <div
            className="strip"
            style={{
              backgroundImage: `url(${asset('sky/horizon-haze-strip')})`,
              top: WATER_Y - 26,
              height: 40,
              opacity: 0.45,
            }}
          />
        </div>

        {/* ---------------------------------------------------- plano do jogo */}
        <div className="layer" ref={cameraRef}>
          {/* ------------------------------------------------------ o mar */}
          <div
            className="sea"
            style={{
              left: SEA_START - 180,
              width: WORLD_W - SEA_START + 180,
              top: WATER_Y,
              height: WORLD_H - WATER_Y,
              background: `linear-gradient(180deg, ${p.seaTop} 0%, ${p.seaTop} 12%, ${p.seaBottom} 78%, #02131f 100%)`,
            }}
          >
            {/* raios de luz atravessando a coluna de agua */}
            {!REGIONS[region].palette.sun.startsWith('#ff2') && (
              <>
                <img className="ray" src={asset('props/light-ray-strip')} alt="" style={{ left: 320, height: 210 }} />
                <img className="ray ray-b" src={asset('props/light-ray-strip')} alt="" style={{ left: 700, height: 180 }} />
                <img className="ray" src={asset('props/light-ray-strip')} alt="" style={{ left: 1090, height: 230 }} />
              </>
            )}
            {/* areia do fundo */}
            <div className="seabed" />
          </div>

          {/* vida submersa e fundo, em coordenadas de mundo */}
          <div className="under">
            <Props list={SEAFLOOR} />
            <Props list={UNDERWATER_LIFE} />
          </div>

          {/* espuma e ondas na linha d agua */}
          <div
            className="surf"
            style={{
              left: SEA_START - 220,
              width: WORLD_W - SEA_START + 220,
              top: WATER_Y - 20,
            }}
          >
            <div className="foam" style={{ backgroundImage: `url(${asset('fx/foam-strip')})` }} />
            <div className="swell" style={{ backgroundImage: `url(${asset('fx/small-wave-strip')})` }} />
            <div className="swell swell-b" style={{ backgroundImage: `url(${asset('fx/large-wave-strip')})` }} />
            <div className="glint" style={{ backgroundImage: `url(${asset('fx/sun-glint-strip')})` }} />
          </div>

          {/* ---------------------------------------------------- a terra */}
          <div
            className="sand"
            style={{ left: -40, width: SEA_START + 90, top: SAND_Y, height: WORLD_H - SAND_Y }}
          />
          <div className="sand-slope" style={{ left: SEA_START + 40, top: SAND_Y }} />
          <div className="tide-line" style={{ left: SEA_START - 420, width: 480, top: SAND_Y + 26 }} />
          <Props list={SHORE} />

          <Props list={FOREST} />
          <Props list={BEACH} />

          {/* --------------------------------------------------- o pier */}
          <div
            className="pier-deck"
            style={{
              left: PIER_START - 70,
              width: PIER_END - PIER_START + 140,
              top: PIER_Y,
              backgroundImage: `url(${asset('props/pier-board-side')})`,
            }}
          />
          {Array.from({ length: Math.ceil((PIER_END - PIER_START) / 210) + 1 }, (_, i) => (
            <img
              key={`post${i}`}
              className="pier-post"
              src={asset('props/pier-post-side')}
              alt=""
              style={{ left: PIER_START - 30 + i * 210, top: PIER_Y + 26 }}
            />
          ))}
          <img
            className="wprop"
            src={asset('props/pier-ladder-side')}
            alt=""
            style={{ left: PIER_START + 120, top: PIER_Y + 20, height: 120 }}
          />

          <Props list={PIER_PROPS} />

          {/* barco ancorado no fim do pier */}
          <div className={`anchored-boat${settings.animations ? ' rocking' : ''}`} style={{ left: PIER_END + 40 }}>
            <img className="boat-frame boat-a" src={asset('props/fishing-boat-idle-side')} alt="" />
            <img className="boat-frame boat-b" src={asset('props/fishing-boat-rocking-side')} alt="" />
          </div>

          {/* --------------------------------------- a vara fincada no deck */}
          <img
            className={`rod${fishing ? ' casting' : ''}`}
            src={asset('props/fishing-rod')}
            alt=""
            style={{ left: ROD_X, top: PIER_Y - 150 }}
          />

          {/* ------------------------------------------- linha, boia, peixe */}
          {inWater && (
            <div className="rig" style={{ left: BOBBER_X, top: BOBBER_Y }}>
              <img className="rig-line" src={asset(reeling ? 'fx/taut-fishing-line' : 'fx/line-across-surface')} alt="" />
              <img
                className={`ripple${biting && settings.screenShake ? ' shaking' : ''}`}
                src={asset('fx/circular-ripple')}
                alt=""
              />
              {biting && (
                <>
                  <img className="bite-ring" src={asset('fx/bite-alert-ring')} alt="" />
                  <img className="bang" src={asset('fx/exclamation-mark')} alt="" />
                </>
              )}
              {reeling && pending?.fish && (
                <div className="hooked">
                  <FishSprite fish={pending.fish} size={70} flip />
                </div>
              )}
            </div>
          )}

          {/* ------------------------------------------------- o Juggler */}
          <div className="player" ref={playerRef}>
            <img
              ref={spriteRef}
              className="player-sprite"
              src={asset('char/side-idle-right/00')}
              alt="Juggler"
              style={{ height: PLAYER_H }}
            />
            <div className="player-shadow" />
          </div>
        </div>
      </div>
    </div>
  );
}
