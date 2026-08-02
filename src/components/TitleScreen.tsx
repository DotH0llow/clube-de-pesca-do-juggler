import { useState } from 'react';
import { asset } from '../assets';
import cover from '../assets/fundador.webp';
import { initAudio, playSfx, startAmbience } from '../engine/audio';
import { useGame } from '../state/store';
import { useSettings } from '../state/settings';
import { ControlsPanel } from './ControlsPanel';
import { CreditsPanel } from './CreditsPanel';
import { SettingsPanel } from './SettingsPanel';

type Overlay = 'config' | 'controles' | 'creditos' | null;

export function TitleScreen({ onPlay }: { onPlay: () => void }) {
  const s = useGame();
  const settings = useSettings();
  const [overlay, setOverlay] = useState<Overlay>(null);

  const hasProgress = s.stats.casts > 0;

  const wake = () => {
    initAudio();
    if (!settings.muted && settings.music > 0) startAmbience();
    playSfx('ui');
  };

  return (
    <div className="title-screen" onPointerDown={initAudio}>
      <img className="title-art" src={cover} alt="O Fundador do Clube de Pesca do Juggler" />
      <div className="title-vignette" />

      <div className="title-content">
        <div className="title-brand">
          <img className="title-mark" src={asset('ui/temporary-logo-mark')} alt="" />
          <span className="title-kicker">UNIVERSO HYDRA</span>
          <h1>
            CLUBE DE PESCA
            <br />
            <em>DO JUGGLER</em>
          </h1>
          <p className="title-sub">
            Lanca a linha, fisga o que aparecer e reza pra nao ser a Hydra.
          </p>
        </div>

        <div className="title-menu">
          <button
            className="btn primary title-btn"
            onClick={() => {
              wake();
              onPlay();
            }}
          >
            {hasProgress ? 'CONTINUAR' : 'COMECAR'}
          </button>
          {hasProgress && (
            <div className="title-progress">
              {s.stats.casts.toLocaleString('pt-BR')} lancamentos &middot;{' '}
              {Object.keys(s.album).length} especies &middot; {s.sazoncoins.toLocaleString('pt-BR')} SZ
            </div>
          )}
          <button
            className="btn title-btn"
            onClick={() => {
              wake();
              setOverlay('controles');
            }}
          >
            COMO JOGAR
          </button>
          <button
            className="btn title-btn"
            onClick={() => {
              wake();
              setOverlay('config');
            }}
          >
            CONFIGURACOES
          </button>
          <button
            className="btn ghost title-btn"
            onClick={() => {
              wake();
              setOverlay('creditos');
            }}
          >
            CREDITOS
          </button>
        </div>

        <div className="title-foot">
          <span className="founder-plate">FUNDADOR</span>
          <span>v0.1</span>
        </div>
      </div>

      {overlay === 'config' && <SettingsPanel onClose={() => setOverlay(null)} />}
      {overlay === 'controles' && <ControlsPanel onClose={() => setOverlay(null)} />}
      {overlay === 'creditos' && <CreditsPanel onClose={() => setOverlay(null)} />}
    </div>
  );
}
