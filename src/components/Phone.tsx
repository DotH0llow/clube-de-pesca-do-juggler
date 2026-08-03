import { useEffect, useState } from 'react';
import { playSfx } from '../engine/audio';
import { useGame } from '../state/store';
import { AchievementsApp } from './AchievementsPanel';
import { AlbumApp } from './AlbumPanel';
import { ControlsApp } from './ControlsPanel';
import { SettingsApp } from './SettingsPanel';
import { ShopApp } from './ShopPanel';
import { MissionApp } from './casino/MissionApp';
import { PlaylistApp } from './PlaylistApp';
import { Sprite } from './Sprite';

type AppId = 'album' | 'cartela' | 'radio' | 'cais' | 'conquistas' | 'config' | 'ajuda';

interface AppMeta {
  id: AppId;
  label: string;
  icon: string;
  /** cor do azulejo do icone na tela inicial */
  tint: string;
}

const APPS: AppMeta[] = [
  { id: 'album', label: 'ÁLBUM', icon: 'ui/fish-album-icon', tint: '#1e6f9b' },
  { id: 'cais', label: 'CAIS', icon: 'ui/upgrade-icon', tint: '#0f7a63' },
  { id: 'cartela', label: 'CARTELA', icon: 'ui/rarity-rare', tint: '#7a3fa8' },
  { id: 'radio', label: 'RÁDIO', icon: 'ui/depth-indicator', tint: '#a8543f' },
  { id: 'conquistas', label: 'TROFÉUS', icon: 'ui/ranking-icon', tint: '#9c7d16' },
  { id: 'config', label: 'CONFIG', icon: 'ui/settings-icon', tint: '#4a5b68' },
  { id: 'ajuda', label: 'AJUDA', icon: 'ui/tooltip', tint: '#2f6b8f' },
];

const TITLE: Record<AppId, string> = {
  album: 'ÁLBUM DO PESCADOR',
  cartela: 'CARTELA E ODDS',
  radio: 'RÁDIO DO CLUBE',
  cais: 'CAIS DO CLUBE',
  conquistas: 'CONQUISTAS',
  config: 'CONFIGURAÇÕES',
  ajuda: 'COMO JOGAR',
};

/** Relogio de verdade na barra de status, como num celular. */
function useClock(): string {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 20000);
    return () => window.clearInterval(id);
  }, []);
  return now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

/**
 * O celular do Juggler, agora com tela inicial de verdade: os apps ficam numa
 * grade e cada um abre em tela cheia, com botao de voltar. O botao fisico volta
 * para a home; na home, fecha o celular.
 *
 * Enquanto ele esta aberto o jogo fica pausado (a musica continua tocando).
 */
export function Phone({ onClose }: { onClose: () => void }) {
  const s = useGame();
  const [app, setApp] = useState<AppId | null>(null);
  const clock = useClock();

  const open = (id: AppId) => {
    playSfx('ui');
    setApp(id);
  };

  const back = () => {
    playSfx('ui');
    if (app) setApp(null);
    else onClose();
  };

  // ESC volta um nivel de cada vez, igual a um celular de verdade
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code !== 'Escape') return;
      e.preventDefault();
      e.stopPropagation();
      if (app) setApp(null);
      else onClose();
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [app, onClose]);

  return (
    <div className="modal-backdrop phone-backdrop" onClick={onClose}>
      <div className="phone" onClick={(e) => e.stopPropagation()}>
        <div className="phone-body">
          <div className="phone-speaker" />

          <div className="phone-screen">
            <div className="phone-status">
              <span>{clock}</span>
              <span className="phone-os">JUGGLER OS</span>
              <span className="phone-wallet">
                <i className="dot coin" />
                {s.sazoncoins.toLocaleString('pt-BR')}
                <i className="dot eye" />
                {s.hydraEyes}
              </span>
            </div>

            {app === null ? (
              <div className="phone-home-screen">
                <div className="phone-hero">
                  <div className="phone-hero-title">CLUBE DE PESCA</div>
                  <div className="phone-hero-sub">
                    {Object.keys(s.album).length} espécies &middot; {s.stats.casts.toLocaleString('pt-BR')} lançamentos
                  </div>
                </div>

                <div className="phone-grid">
                  {APPS.map((a) => (
                    <button key={a.id} className="phone-icon" onClick={() => open(a.id)}>
                      <span className="tile" style={{ background: a.tint }}>
                        <Sprite path={a.icon} size={30} />
                      </span>
                      <span className="name">{a.label}</span>
                    </button>
                  ))}
                </div>

                <div className="phone-hint">TOQUE NUM APP &middot; ESC FECHA O CELULAR</div>
              </div>
            ) : (
              <>
                <div className="phone-titlebar">
                  <button className="phone-back" onClick={back} aria-label="Voltar">
                    &lt;
                  </button>
                  <span>{TITLE[app]}</span>
                  <button className="phone-x" onClick={onClose} aria-label="Fechar">
                    X
                  </button>
                </div>

                <div className="phone-content">
                  {app === 'album' && <AlbumApp />}
                  {app === 'cartela' && <MissionApp />}
                  {app === 'radio' && <PlaylistApp />}
                  {app === 'cais' && <ShopApp />}
                  {app === 'conquistas' && <AchievementsApp />}
                  {app === 'config' && <SettingsApp />}
                  {app === 'ajuda' && <ControlsApp />}
                </div>
              </>
            )}
          </div>

          <button
            className="phone-home"
            onClick={back}
            aria-label={app ? 'Voltar para a tela inicial' : 'Fechar celular'}
          />
        </div>
      </div>
    </div>
  );
}
