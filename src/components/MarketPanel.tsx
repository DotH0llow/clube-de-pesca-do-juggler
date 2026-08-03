import { RARITIES } from '../data/rarities';
import { FAMILIES } from '../data/fish';
import { playSfx } from '../engine/audio';
import { claimMarketOrder, marketView, useGame } from '../state/store';
import { Sprite } from './Sprite';

/**
 * Balcão do mercado de peixe. A barraca pede uma encomenda por dia; o peixe
 * entra sozinho conforme você pesca e a recompensa sai aqui, no balcão.
 */
export function MarketApp({ onPaid }: { onPaid?: (coins: number, eyes: number) => void }) {
  useGame();
  const { order, progress, claimed, ready } = marketView();
  const pct = Math.round((progress / order.target) * 100);

  const family = order.family ? FAMILIES.find((f) => f.id === order.family)?.name : null;
  const rarity = order.minRarity ? RARITIES[order.minRarity].label : null;

  const claim = () => {
    const paid = claimMarketOrder();
    if (!paid) return;
    playSfx('coin');
    onPaid?.(paid.reward.sazoncoins, paid.reward.hydraEyes ?? 0);
  };

  return (
    <div className="market">
      <div className="market-head">
        <Sprite path={order.icon} size={64} />
        <div>
          <div className="market-title">{order.title}</div>
          <div className="market-desc">{order.desc}</div>
        </div>
      </div>

      <div className="market-tags">
        {family && <span className="chip">Família: {family}</span>}
        {rarity && <span className="chip">Mínimo: {rarity}</span>}
        {!family && !rarity && <span className="chip">Qualquer peixe</span>}
      </div>

      <div className="market-progress">
        <div className="bar">
          <i style={{ width: `${pct}%` }} />
        </div>
        <span>
          {progress}/{order.target} peixes
        </span>
      </div>

      <div className="market-reward">
        <span className="coins">+{order.reward.sazoncoins.toLocaleString('pt-BR')} SZ</span>
        {order.reward.hydraEyes ? (
          <span className="eyes">+{order.reward.hydraEyes} Olhos</span>
        ) : null}
      </div>

      {claimed ? (
        <div className="market-note">
          Encomenda do dia entregue. O peixeiro fecha o caixa e some até amanhã.
        </div>
      ) : ready ? (
        <button className="btn primary" onClick={claim}>
          ENTREGAR ENCOMENDA
        </button>
      ) : (
        <div className="market-note">
          Faltam {order.target - progress}. Volte aqui quando a caixa estiver cheia.
        </div>
      )}
    </div>
  );
}
