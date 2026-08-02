import { asset } from '../assets';
import { REGIONS } from '../data/regions';
import { useSettings } from '../state/settings';
import type { CastResult, RegionId } from '../state/types';
import type { Phase } from '../hooks/useFishingLoop';
import { FishSprite, Sprite } from './Sprite';

interface Props {
  region: RegionId;
  phase: Phase;
  pending: CastResult | null;
}

/** Ceu e clima de cada pesqueiro, montados com os assets do kit. */
const SKY: Record<RegionId, { bg: string; clouds: string; storm: boolean; night: boolean }> = {
  enseada: { bg: 'bg/sky-day', clouds: 'sky/large-cloud', storm: false, night: false },
  recife: { bg: 'bg/sky-sunset', clouds: 'sky/sunset-cloud-strip', storm: false, night: false },
  naufragio: { bg: 'bg/sky-day', clouds: 'sky/storm-cloud', storm: true, night: false },
  fossa: { bg: 'bg/sky-night', clouds: 'sky/night-cloud-strip', storm: false, night: true },
};

/**
 * Cena em camadas: ceu (imagem do kit), horizonte, mar, ondas, barco e
 * os efeitos de linha/mordida/puxada. A faixa de mar usa a paleta da regiao,
 * entao o recorte do ceu nunca briga com a cor da agua.
 */
export function Scene({ region, phase, pending }: Props) {
  const settings = useSettings();
  const cfg = SKY[region];
  const p = REGIONS[region].palette;
  const inWater = phase === 'waiting' || phase === 'bite' || phase === 'reeling';
  const biting = phase === 'bite';
  const reeling = phase === 'reeling';

  return (
    <div className="stage" aria-hidden="true">
      {/* ---------------------------------------------------------- ceu */}
      <div
        className="scene-sky"
        style={{ backgroundImage: `url(${asset(cfg.bg)})` }}
      >
        <img className="cloud cloud-a" src={asset(cfg.clouds)} alt="" />
        <img className="cloud cloud-b" src={asset(cfg.night ? 'sky/star-cluster' : 'sky/small-cloud')} alt="" />
        {!cfg.night && !cfg.storm && (
          <img className="birds" src={asset('sky/distant-bird-flock')} alt="" />
        )}
        {cfg.night && <img className="stars" src={asset('sky/star-cluster')} alt="" />}
        {cfg.storm && (
          <>
            <div className="storm-tint" />
            <img className="rain" src={asset('sky/rain-streaks')} alt="" />
            <img className="rain rain-2" src={asset('sky/rain-streaks')} alt="" />
            <img className="lightning" src={asset('sky/lightning-bolt')} alt="" />
          </>
        )}
        <img className="island-strip" src={asset('sky/distant-island-strip')} alt="" />
      </div>

      {/* ------------------------------------------------------ horizonte */}
      <img className="haze" src={asset('sky/horizon-haze-strip')} alt="" />

      {/* ---------------------------------------------------------- mar */}
      <div
        className="scene-sea"
        style={{ background: `linear-gradient(180deg, ${p.seaTop}, ${p.seaBottom})` }}
      >
        {!cfg.night && <img className="glint" src={asset('fx/sun-glint-strip')} alt="" />}
        <img className="wave wave-far" src={asset('fx/small-wave-strip')} alt="" />
        <img className="wave wave-mid" src={asset('fx/large-wave-strip')} alt="" />
        <img className="wave wave-near" src={asset('fx/foam-strip')} alt="" />
        {cfg.night && <div className="hydra-glow" />}
      </div>

      {/* -------------------------------------------------------- barco */}
      <div className={`boat${settings.animations ? ' rocking' : ''}`}>
        <img className="boat-shadow" src={asset('props/boat-shadow')} alt="" />
        <img className="boat-frame boat-a" src={asset('props/fishing-boat-idle-side')} alt="" />
        <img className="boat-frame boat-b" src={asset('props/fishing-boat-rocking-side')} alt="" />
      </div>

      {/* ------------------------------------------- linha, boia e peixe */}
      {inWater && (
        <div className="rig">
          <img
            className="rig-line"
            src={asset(reeling ? 'fx/taut-fishing-line' : 'fx/line-across-surface')}
            alt=""
          />
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
              <FishSprite fish={pending.fish} size={54} flip />
              <img className="trail" src={asset('fx/fish-movement-trail')} alt="" />
            </div>
          )}
          {reeling && !pending?.fish && (
            <div className="hooked">
              <Sprite path="fx/underwater-bubbles" size={40} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
