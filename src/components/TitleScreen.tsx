import { useState } from 'react';
import { asset } from '../assets';
import cutscene from '../assets/juggler-cutscene.webp';
import { initAudio, playSfx, startAmbience } from '../engine/audio';
import { useGame } from '../state/store';
import { useSettings } from '../state/settings';
import { clockLabel, useDayPhase } from '../world/dayCycle';
import { REGIONS } from '../data/regions';
import { ControlsApp } from './ControlsPanel';
import { SettingsApp } from './SettingsPanel';
import { Sheet } from './Sheet';
import { Sky } from './Sky';

type Overlay = 'config' | 'controles' | null;

/** Estacas do pier em primeiro plano, espalhadas na largura da tela. */
const POSTS = [4, 19, 34, 49, 64, 79, 94];

/**
 * O cenario do menu, montado com os mesmos assets do jogo.
 *
 * A ideia e o menu ser um pedaco do mundo visto da ponta do pier, e nao uma
 * arte separada: o ceu, o mar, o horizonte e a tralha do deck sao exatamente
 * os sprites que o jogo usa. Por isso ele tambem segue a fase do dia - abrir o
 * jogo de madrugada mostra o menu de madrugada.
 */
function TitleScene({ phase }: { phase: ReturnType<typeof useDayPhase> }) {
  return (
    <div className="title-scene">
      <Sky region={phase} />

      {/* horizonte: montanha longe, ilha um pouco mais perto, neblina na linha */}
      <img className="title-strip title-mountains" src={asset('sky/distant-mountain-strip')} alt="" />
      <img className="title-strip title-islands" src={asset('sky/distant-island-strip')} alt="" />

      {/* o mar, com a paleta da fase do dia */}
      <div className="title-sea" />
      <img className="title-strip title-haze" src={asset('sky/horizon-haze-strip')} alt="" />

      {/* barco ancorado ao longe */}
      <img className="title-boat" src={asset('props/fishing-boat-idle-side')} alt="" />

      {/* espuma e ondas na linha d agua */}
      <div className="title-surf">
        <div className="foam" style={{ backgroundImage: `url(${asset('fx/foam-strip')})` }} />
        <div className="swell" style={{ backgroundImage: `url(${asset('fx/small-wave-strip')})` }} />
        <div className="swell swell-b" style={{ backgroundImage: `url(${asset('fx/large-wave-strip')})` }} />
        <div className="glint" style={{ backgroundImage: `url(${asset('fx/sun-glint-strip')})` }} />
      </div>

      {/* primeiro plano: o deck do pier onde o jogador esta de pe */}
      <div className="title-posts">
        {POSTS.map((left) => (
          <img
            key={left}
            src={asset('props/pier-post-side')}
            alt=""
            style={{ left: `${left}%` }}
          />
        ))}
      </div>
      <div className="title-deck" style={{ backgroundImage: `url(${asset('props/pier-board-side')})` }} />

      {/* tralha do deck, em silhueta, so para dar profundidade */}
      <img className="title-prop prop-lantern" src={asset('props/pier-lantern')} alt="" />
      <img className="title-prop prop-net" src={asset('props/capture-net')} alt="" />
      <img className="title-prop prop-barrel" src={asset('props/barrel')} alt="" />
      <img className="title-prop prop-basket" src={asset('props/fish-basket')} alt="" />

      {/* vegetacao emoldurando as bordas */}
      <img className="title-palm palm-left" src={asset('nature/coconut-palm')} alt="" />
      <img className="title-palm palm-right" src={asset('nature/royal-palm')} alt="" />

      <div className="title-vignette" />
    </div>
  );
}

export function TitleScreen({ onPlay }: { onPlay: () => void }) {
  const s = useGame();
  const settings = useSettings();
  const phase = useDayPhase();
  const [overlay, setOverlay] = useState<Overlay>(null);

  const hasProgress = s.stats.casts > 0;

  const wake = () => {
    initAudio();
    if (!settings.muted && settings.music > 0) startAmbience();
    playSfx('ui');
  };

  return (
    <div className="title-screen" onPointerDown={initAudio}>
      <TitleScene phase={phase} />

      {/* o Juggler posando com a vara, encostado no canto direito */}
      <img className="title-art" src={cutscene} alt="O Juggler" />

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
          <span className="title-clock">
            {clockLabel()} &middot; {REGIONS[phase].name}
          </span>
          <span>&middot; v0.2</span>
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
