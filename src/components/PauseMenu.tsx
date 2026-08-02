import { useState } from 'react';
import { playSfx } from '../engine/audio';
import { REGIONS } from '../data/regions';
import { useGame } from '../state/store';
import { ControlsPanel } from './ControlsPanel';
import { CreditsPanel } from './CreditsPanel';
import { SettingsPanel } from './SettingsPanel';

type Overlay = 'config' | 'controles' | 'creditos' | null;

interface Props {
  onResume: () => void;
  onTitle: () => void;
}

export function PauseMenu({ onResume, onTitle }: Props) {
  const s = useGame();
  const [overlay, setOverlay] = useState<Overlay>(null);

  if (overlay === 'config') return <SettingsPanel onClose={() => setOverlay(null)} />;
  if (overlay === 'controles') return <ControlsPanel onClose={() => setOverlay(null)} />;
  if (overlay === 'creditos') return <CreditsPanel onClose={() => setOverlay(null)} />;

  const go = (fn: () => void) => () => {
    playSfx('ui');
    fn();
  };

  return (
    <div className="modal-backdrop" onClick={onResume}>
      <div
        className="pixel-box catch-card"
        style={{ width: 'min(360px, 92vw)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="headline">PAUSA</div>
        <div className="flavor">
          {REGIONS[s.region].name} &middot; {s.sazoncoins.toLocaleString('pt-BR')} SZ &middot;{' '}
          {s.hydraEyes} Olhos
        </div>
        <button className="btn primary title-btn" onClick={go(onResume)}>
          CONTINUAR
        </button>
        <button className="btn title-btn" onClick={go(() => setOverlay('controles'))}>
          COMO JOGAR
        </button>
        <button className="btn title-btn" onClick={go(() => setOverlay('config'))}>
          CONFIGURACOES
        </button>
        <button className="btn ghost title-btn" onClick={go(() => setOverlay('creditos'))}>
          CREDITOS
        </button>
        <button className="btn ghost title-btn" onClick={go(onTitle)}>
          VOLTAR AO TITULO
        </button>
      </div>
    </div>
  );
}
