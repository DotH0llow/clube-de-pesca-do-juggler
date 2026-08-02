import { asset } from '../assets';
import { RARITIES, rarityBadge } from '../data/rarities';
import type { Outcome } from '../hooks/useFishingLoop';
import type { Rarity } from '../state/types';
import { FishSprite, JunkSprite, Sprite } from './Sprite';

interface Props {
  outcome: Outcome;
  onAgain: () => void;
}

/** Efeito de fundo por raridade: quanto mais raro, mais escandaloso. */
const BURST: Record<Rarity, string | null> = {
  comum: null,
  incomum: 'fx/common-particles',
  raro: 'fx/rare-sparkles',
  epico: 'fx/epic-particle-burst',
  lendario: 'fx/reward-glow',
  mitico: 'fx/reward-glow',
};

export function CatchPopup({ outcome, onAgain }: Props) {
  const { result, landed, escapeText } = outcome;
  const fish = result.fish;
  const rarity = fish ? RARITIES[fish.rarity] : null;
  const failed = Boolean(fish) && !landed;
  const burst = fish && !failed ? BURST[fish.rarity] : null;

  const accent = failed ? '#ff5f7e' : rarity ? rarity.color : '#cfe8f5';

  return (
    <div className="catch-popup" onClick={onAgain}>
      <div className="catch-card" onClick={(e) => e.stopPropagation()}>
        <div className="catch-banner">
          <img src={asset('fx/capture-banner')} alt="" />
          <span className="headline" style={{ color: failed ? '#a3301f' : '#3a2410' }}>
            {failed ? 'ESCAPOU' : result.headline}
          </span>
        </div>

        <div className="sprite-frame">
          {burst && <img className="burst" src={asset(burst)} alt="" />}
          {fish ? (
            <div className={failed ? '' : 'bobbing'} style={{ opacity: failed ? 0.4 : 1 }}>
              <FishSprite fish={fish} size={140} />
            </div>
          ) : result.junk ? (
            <JunkSprite junk={result.junk} size={120} />
          ) : result.category === 'bau' ? (
            <Sprite path={landed ? 'fx/chest-open' : 'fx/chest-closed'} size={130} />
          ) : result.category === 'evento' ? (
            <Sprite path="props/distant-underwater-silhouette" size={120} className="sprite-silhouette" />
          ) : (
            <Sprite path="fx/snapped-fishing-line" size={110} />
          )}
          {failed && <img className="burst" src={asset('fx/escape-swirl')} alt="" />}
        </div>

        {fish && (
          <>
            <div className="fish-name" style={{ color: accent }}>
              {fish.name}
            </div>
            <div className="rarity-line">
              <Sprite path={rarityBadge(fish.rarity)} size={30} />
              <span className="rarity-tag" style={{ color: rarity?.color }}>
                {rarity?.label}
              </span>
            </div>
            <div className="flavor">
              {result.weight} kg &middot; {result.length} cm
            </div>
            <div className="flavor">{failed ? escapeText : fish.flavor}</div>
          </>
        )}

        {result.junk && (
          <>
            <div className="fish-name">{result.junk.name}</div>
            <div className="flavor">{result.junk.flavor}</div>
          </>
        )}

        {result.category === 'bau' && landed && (
          <div className="flavor">Alguem afundou isso aqui faz tempo.</div>
        )}

        {result.category === 'evento' && !fish && (
          <div className="flavor">Tres vultos passaram embaixo do barco. Nao voltaram.</div>
        )}

        {result.category === 'nada' && <div className="flavor">{result.headline}</div>}

        {!failed && (result.value > 0 || result.eyes > 0) && (
          <div className="reward-line">
            {result.value > 0 && <span style={{ color: 'var(--coin)' }}>+{result.value} SZ</span>}
            {result.eyes > 0 && <span style={{ color: 'var(--eye)' }}>+{result.eyes} Olhos</span>}
          </div>
        )}

        {result.pityTriggered && !failed && (
          <div className="flavor" style={{ color: 'var(--neon)' }}>
            A mare virou a seu favor.
          </div>
        )}

        <div className="btn-row">
          <button className="btn primary" onClick={onAgain} autoFocus>
            LANCAR DE NOVO
          </button>
        </div>
      </div>
    </div>
  );
}

