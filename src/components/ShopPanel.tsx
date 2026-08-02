import { useState } from 'react';
import { REGION_ORDER, REGIONS } from '../data/regions';
import { RELICS, UPGRADES, upgradeCost } from '../data/upgrades';
import { buyRelic, buyUpgrade, setRegion, unlockRegion, useGame } from '../state/store';
import { Panel } from './Panel';

type Tab = 'loja' | 'altar' | 'mapa';

export function ShopPanel({ onClose }: { onClose: () => void }) {
  const s = useGame();
  const [tab, setTab] = useState<Tab>('loja');

  return (
    <Panel
      title="Cais do Clube"
      onClose={onClose}
      right={
        <span style={{ fontSize: 11 }}>
          {s.sazoncoins.toLocaleString('pt-BR')} SZ &middot; {s.hydraEyes} Olhos
        </span>
      }
    >
      <div className="tabs">
        <button className={`tab${tab === 'loja' ? ' active' : ''}`} onClick={() => setTab('loja')}>
          LOJA
        </button>
        <button className={`tab${tab === 'altar' ? ' active' : ''}`} onClick={() => setTab('altar')}>
          ALTAR DA HYDRA
        </button>
        <button className={`tab${tab === 'mapa' ? ' active' : ''}`} onClick={() => setTab('mapa')}>
          MAPA
        </button>
      </div>

      {tab === 'loja' &&
        UPGRADES.map((u) => {
          const level = s.upgrades[u.id];
          const maxed = level >= u.maxLevel;
          const cost = upgradeCost(u.id, level);
          const wallet = u.currency === 'sazoncoins' ? s.sazoncoins : s.hydraEyes;
          const canBuy = !maxed && wallet >= cost;
          return (
            <div className="row" key={u.id}>
              <div style={{ fontSize: 22 }}>{u.icon}</div>
              <div className="grow">
                <div className="title">{u.name}</div>
                <div className="desc">{u.desc}</div>
                <div className="desc" style={{ color: 'var(--neon)' }}>
                  {level > 0 ? u.effectText(level) : 'Sem bonus ainda'}
                </div>
                <div className="pips">
                  {Array.from({ length: u.maxLevel }, (_, i) => (
                    <span key={i} className={`pip${i < level ? ' on' : ''}`} />
                  ))}
                </div>
              </div>
              <button className="btn small" disabled={!canBuy} onClick={() => buyUpgrade(u.id)}>
                {maxed ? 'MAX' : `${cost} ${u.currency === 'sazoncoins' ? 'SZ' : 'OLHOS'}`}
              </button>
            </div>
          );
        })}

      {tab === 'altar' && (
        <>
          <div className="row">
            <div className="grow desc">
              O Altar so aceita Olhos da Hydra. Cada compra e unica e permanente.
            </div>
          </div>
          {RELICS.map((r) => {
            const owned = s.relics.includes(r.id);
            return (
              <div className="row" key={r.id}>
                <div style={{ fontSize: 22 }}>{r.icon}</div>
                <div className="grow">
                  <div className="title">{r.name}</div>
                  <div className="desc">{r.desc}</div>
                </div>
                <button
                  className="btn small"
                  disabled={owned || s.hydraEyes < r.cost}
                  onClick={() => buyRelic(r.id)}
                >
                  {owned ? 'SEU' : `${r.cost} OLHOS`}
                </button>
              </div>
            );
          })}
        </>
      )}

      {tab === 'mapa' &&
        REGION_ORDER.map((id) => {
          const r = REGIONS[id];
          const unlocked = s.unlockedRegions.includes(id);
          const active = s.region === id;
          const cost = r.unlock;
          const canBuy =
            !unlocked &&
            cost !== null &&
            (cost.currency === 'sazoncoins' ? s.sazoncoins : s.hydraEyes) >= cost.cost;
          return (
            <div className="row" key={id}>
              <div
                style={{
                  width: 34,
                  height: 34,
                  background: `linear-gradient(180deg, ${r.palette.skyTop}, ${r.palette.seaBottom})`,
                  border: '2px solid #041b28',
                }}
              />
              <div className="grow">
                <div className="title" style={{ color: active ? 'var(--neon)' : undefined }}>
                  {r.name}
                </div>
                <div className="desc">{r.subtitle}</div>
                <div className="desc">
                  Valor x{r.valueMultiplier} &middot; raridade +{Math.round(r.rarityBonus * 100)}%
                  &middot; dificuldade +{Math.round(r.difficulty * 100)}%
                </div>
              </div>
              {unlocked ? (
                <button className="btn small" disabled={active} onClick={() => setRegion(id)}>
                  {active ? 'AQUI' : 'IR'}
                </button>
              ) : (
                <button className="btn small" disabled={!canBuy} onClick={() => unlockRegion(id)}>
                  {cost?.cost} {cost?.currency === 'sazoncoins' ? 'SZ' : 'OLHOS'}
                </button>
              )}
            </div>
          );
        })}
    </Panel>
  );
}
