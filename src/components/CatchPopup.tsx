import { RARITIES } from '../data/rarities';
import type { Outcome } from '../hooks/useFishingLoop';
import { FishSprite } from './FishSprite';

interface Props {
  outcome: Outcome;
  onAgain: () => void;
}

export function CatchPopup({ outcome, onAgain }: Props) {
  const { result, landed, escapeText } = outcome;
  const fish = result.fish;
  const rarity = fish ? RARITIES[fish.rarity] : null;
  const failed = Boolean(fish) && !landed;

  const accent = failed ? '#ff5f7e' : rarity ? rarity.color : '#cfe8f5';

  return (
    <div className="catch-popup" onClick={onAgain}>
      <div
        className="pixel-box catch-card"
        style={{ borderColor: accent, boxShadow: `0 0 0 4px #041b28, 0 0 26px ${rarity?.glow ?? 'rgba(0,0,0,0)'}` }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="headline" style={{ color: accent }}>
          {failed ? 'ESCAPOU' : result.headline}
        </div>

        <div className="sprite-frame">
          {fish ? (
            <div className={failed ? '' : 'bobbing'} style={{ opacity: failed ? 0.35 : 1 }}>
              <FishSprite fish={fish} size={110} />
            </div>
          ) : result.junk ? (
            <div style={{ fontSize: 64 }}>{result.junk.emoji}</div>
          ) : result.category === 'bau' ? (
            <div style={{ fontSize: 64 }}>🧰</div>
          ) : result.category === 'evento' ? (
            <div style={{ fontSize: 64 }}>👁️</div>
          ) : (
            <div style={{ fontSize: 56, opacity: 0.5 }}>🎣</div>
          )}
        </div>

        {fish && (
          <>
            <div className="fish-name" style={{ color: accent }}>
              {fish.name}
            </div>
            <div>
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
