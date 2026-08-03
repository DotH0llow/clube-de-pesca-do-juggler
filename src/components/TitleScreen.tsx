import { useState } from 'react';
import { asset } from '../assets';
import cover from '../assets/fundador.webp';
import { initAudio, playSfx, startAmbience } from '../engine/audio';
import { useGame } from '../state/store';
import { useSettings } from '../state/settings';
import { ControlsApp } from './ControlsPanel';
import { SettingsApp } from './SettingsPanel';
import { Sheet } from './Sheet';
import { Sky } from './Sky';

type Overlay = 'config' | 'controles' | null;

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
      {/* horizonte tropical de verdade no fundo */}
      <Sky region="enseada" />
      <div className="title-sea" />
      <img className="title-islands" src={asset('sky/distant-island-strip')} alt="" />
      <img className="title-waves" src={asset('fx/large-wave-strip')} alt="" />
      <img className="title-foam" src={asset('fx/foam-strip')} alt="" />
      <div className="title-vignette" />

      {/* o Juggler encostado no canto direito */}
      <img className="title-art" src={cover} alt="O Juggler" />

      <div className="title-content">
        <div className="title-brand">
          <img className="title-mark" src={asset('ui/temporary-logo-mark')} alt="" />
          <h1>
            JUGGLER'S
            <br />
            <em>FISHING CLUB</em>
          </h1>
          <p className="title-sub">
            Lança a linha, fisga o que aparecer e reza pra não ser a Hydra.
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
            {hasProgress ? 'CONTINUAR' : 'COMEÇAR'}
          </button>
          {hasProgress && (
            <div className="title-progress">
              {s.stats.casts.toLocaleString('pt-BR')} lançamentos &middot;{' '}
              {Object.keys(s.album).length} espécies &middot; {s.sazoncoins.toLocaleString('pt-BR')} SZ
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
            CONFIGURAÇÕES
          </button>
        </div>

        <div className="title-foot">
          <span className="founder-plate">FUNDADOR</span>
          <span>v0.2</span>
        </div>
      </div>

      {overlay === 'config' && <Sheet title="CONFIGURAÇÕES" onClose={() => setOverlay(null)}><SettingsApp /></Sheet>}
      {overlay === 'controles' && (
        <Sheet title="COMO JOGAR" onClose={() => setOverlay(null)}>
          <ControlsApp />
        </Sheet>
      )}
    </div>
  );
}
