import { playSfx } from '../engine/audio';
import { grantCheat, unlockRegion, useGame } from '../state/store';
import { REGION_ORDER } from '../data/regions';

interface Props {
  onClose: () => void;
  onEditor: () => void;
}

/**
 * Painel de dev. Abre com F8 (ou pelo chip DEV no topo) e nao aparece para
 * jogador nenhum sem querer: e ferramenta de teste, entao pode ser direto.
 */
export function DevPanel({ onClose, onEditor }: Props) {
  const s = useGame();

  const pay = (coins: number, eyes: number) => {
    grantCheat(coins, eyes);
    playSfx('coin');
  };

  return (
    <div className="dev-panel">
      <div className="dev-head">
        <span className="dev-badge">DEV</span>
        <span className="grow">CHEATS</span>
        <button className="ebtn" onClick={onClose}>
          FECHAR
        </button>
      </div>

      <div className="dev-wallet">
        <span style={{ color: 'var(--coin)' }}>{s.sazoncoins.toLocaleString('pt-BR')} SZ</span>
        <span style={{ color: 'var(--eye)' }}>{s.hydraEyes.toLocaleString('pt-BR')} Olhos</span>
      </div>

      <div className="dev-grid">
        <button className="ebtn" onClick={() => pay(100000, 0)}>
          +100.000 SZ
        </button>
        <button className="ebtn" onClick={() => pay(0, 100000)}>
          +100.000 OLHOS
        </button>
        <button className="ebtn" onClick={() => pay(100000, 100000)}>
          +100K NOS DOIS
        </button>
        <button
          className="ebtn"
          onClick={() => {
            for (const id of REGION_ORDER) unlockRegion(id);
            playSfx('unlock');
          }}
        >
          LIBERAR PESQUEIROS
        </button>
      </div>

      <button className="ebtn primary wide" onClick={onEditor}>
        ABRIR MODO EDITOR
      </button>
      <div className="dev-hint">
        O editor pausa o jogo, deixa mover e apagar asset e guarda a cena no navegador.
      </div>
    </div>
  );
}
