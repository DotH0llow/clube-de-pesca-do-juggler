import { useState } from 'react';
import { REGION_ORDER, REGIONS } from '../data/regions';
import type { RegionId } from '../state/types';
import { RELICS, UPGRADES, upgradeCost } from '../data/upgrades';
import { playSfx } from '../engine/audio';
import { useSettings } from '../state/settings';
import { buyRelic, buyUpgrade, setRegion, unlockRegion, useGame } from '../state/store';
import { Panel } from './Panel';
import { Sprite } from './Sprite';
import { asset } from '../assets';

type Tab = 'loja' | 'altar' | 'mapa';

/** Miniatura do ceu de cada pesqueiro no mapa. */
const REGION_SKY: Record<RegionId, string> = {
  enseada: 'bg/sky-day',
  recife: 'bg/sky-sunset',
  naufragio: 'bg/reef-deep',
  fossa: 'bg/sky-night',
};

/**
 * Botao de compra. Gastos em Olhos da Hydra pedem um segundo clique,
 * se a configuracao "Confirmar gasto de Olhos" estiver ligada.
 */
function BuyButton({
  label,
  disabled,
  needsConfirm,
  onBuy,
}: {
  label: string;
  disabled?: boolean;
  needsConfirm: boolean;
  onBuy: () => boolean;
}) {
  const [armed, setArmed] = useState(false);

  const click = () => {
    if (needsConfirm && !armed) {
      setArmed(true);
      playSfx('ui');
      window.setTimeout(() => setArmed(false), 4000);
      return;
    }
    setArmed(false);
    if (onBuy()) playSfx('coin');
  };

  return (
    <button className={`btn small${armed ? ' danger' : ''}`} disabled={disabled} onClick={click}>
      {armed ? 'CONFIRMAR?' : label}
    </button>
  );
}

export function ShopPanel({ onClose }: { onClose: () => void }) {
  const s = useGame();
  const settings = useSettings();
  const [tab, setTab] = useState<Tab>('loja');

  return (
    <Panel
      title="Cais do Clube"
      onClose={onClose}
      right={
        <span style={{ fontSize: 13 }}>
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
              <Sprite path={u.icon} size={36} />
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
              <BuyButton
                label={maxed ? 'MAX' : `${cost} ${u.currency === 'sazoncoins' ? 'SZ' : 'OLHOS'}`}
                disabled={!canBuy}
                needsConfirm={settings.confirmEyes && u.currency === 'hydraEyes'}
                onBuy={() => buyUpgrade(u.id)}
              />
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
                <Sprite path={r.icon} size={36} />
                <div className="grow">
                  <div className="title">{r.name}</div>
                  <div className="desc">{r.desc}</div>
                </div>
                <BuyButton
                  label={owned ? 'SEU' : `${r.cost} OLHOS`}
                  disabled={owned || s.hydraEyes < r.cost}
                  needsConfirm={settings.confirmEyes}
                  onBuy={() => buyRelic(r.id)}
                />
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
                className="region-thumb"
                style={{ backgroundImage: `url(${asset(REGION_SKY[id])})` }}
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
                <button
                  className="btn small"
                  disabled={active}
                  onClick={() => {
                    setRegion(id);
                    playSfx('ui');
                  }}
                >
                  {active ? 'AQUI' : 'IR'}
                </button>
              ) : (
                <BuyButton
                  label={`${cost?.cost} ${cost?.currency === 'sazoncoins' ? 'SZ' : 'OLHOS'}`}
                  disabled={!canBuy}
                  needsConfirm={settings.confirmEyes && cost?.currency === 'hydraEyes'}
                  onBuy={() => unlockRegion(id)}
                />
              )}
            </div>
          );
        })}
    </Panel>
  );
}
