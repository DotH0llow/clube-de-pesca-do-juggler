import { useState } from 'react';
import { FAMILIES, FAMILY_MEMBERS, FISH } from '../data/fish';
import { RARITIES } from '../data/rarities';
import { REGIONS } from '../data/regions';
import { useGame } from '../state/store';
import type { FamilyId } from '../state/types';
import { FishSprite } from './FishSprite';
import { Panel } from './Panel';

export function AlbumPanel({ onClose }: { onClose: () => void }) {
  const s = useGame();
  const [tab, setTab] = useState<FamilyId | 'todos'>('todos');

  const list = tab === 'todos' ? FISH : FAMILY_MEMBERS[tab];
  const known = Object.keys(s.album).length;

  return (
    <Panel
      title="Album do Pescador"
      onClose={onClose}
      right={
        <span style={{ fontSize: 11 }}>
          {known}/{FISH.length}
        </span>
      }
    >
      <div className="tabs">
        <button className={`tab${tab === 'todos' ? ' active' : ''}`} onClick={() => setTab('todos')}>
          TODOS
        </button>
        {FAMILIES.map((f) => (
          <button
            key={f.id}
            className={`tab${tab === f.id ? ' active' : ''}`}
            onClick={() => setTab(f.id)}
          >
            {f.name.toUpperCase()}
          </button>
        ))}
      </div>

      {tab !== 'todos' && (
        <div className="row">
          <div className="grow">
            <div className="title">Recompensa de familia</div>
            <div className="desc">
              {FAMILIES.find((f) => f.id === tab)?.desc} Completar rende{' '}
              {FAMILIES.find((f) => f.id === tab)?.reward.sazoncoins} SZ e{' '}
              {FAMILIES.find((f) => f.id === tab)?.reward.hydraEyes} Olhos.
            </div>
            <div className="bar">
              <div
                className="fill"
                style={{
                  width: `${
                    (FAMILY_MEMBERS[tab].filter((f) => s.album[f.id]).length /
                      FAMILY_MEMBERS[tab].length) *
                    100
                  }%`,
                }}
              />
            </div>
          </div>
          {s.claimedFamilies.includes(tab) && <span style={{ fontSize: 11 }}>OK</span>}
        </div>
      )}

      <div className="grid">
        {list.map((f) => {
          const entry = s.album[f.id];
          const rar = RARITIES[f.rarity];
          return (
            <div key={f.id} className={`card${entry ? '' : ' locked'}`}>
              <div style={{ height: 54, display: 'grid', placeItems: 'center' }}>
                {entry ? (
                  <FishSprite fish={f} size={44} />
                ) : (
                  <span style={{ fontSize: 26, opacity: 0.5 }}>?</span>
                )}
              </div>
              <div className="name" style={{ color: entry ? rar.color : undefined }}>
                {entry ? f.name : '???'}
              </div>
              <span className="rarity-tag" style={{ color: rar.color, alignSelf: 'flex-start' }}>
                {rar.label}
              </span>
              {entry ? (
                <div className="meta">
                  {entry.count}x capturado
                  <br />
                  Recorde: {entry.bestWeight} kg / {entry.bestLength} cm
                  <br />
                  {f.regions.map((r) => REGIONS[r].name).join(', ')}
                </div>
              ) : (
                <div className="meta">Ainda nao registrado.</div>
              )}
            </div>
          );
        })}
      </div>
    </Panel>
  );
}
