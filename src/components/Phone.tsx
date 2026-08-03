import { useState } from 'react';
import { asset } from '../assets';
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

const APPS: { id: AppId; label: string; icon: string }[] = [
  { id: 'album', label: 'ÁLBUM', icon: 'ui/fish-album-icon' },
  { id: 'cartela', label: 'CARTELA', icon: 'ui/rarity-rare' },
  { id: 'radio', label: 'RÁDIO', icon: 'ui/depth-indicator' },
  { id: 'cais', label: 'CAIS', icon: 'ui/upgrade-icon' },
  { id: 'conquistas', label: 'TROFÉUS', icon: 'ui/ranking-icon' },
  { id: 'config', label: 'CONFIG', icon: 'ui/settings-icon' },
  { id: 'ajuda', label: 'AJUDA', icon: 'ui/tooltip' },
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

/**
 * O celular do Juggler. Abre com ESC e concentra álbum, cais, conquistas,
 * configurações e ajuda. Tamanho fixo: a tela nunca cresce com o conteudo, so rola.
 */
export function Phone({ onClose }: { onClose: () => void }) {
  const s = useGame();
  const [app, setApp] = useState<AppId>('album');

  const open = (id: AppId) => {
    playSfx('ui');
    setApp(id);
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="phone" onClick={(e) => e.stopPropagation()}>
        <div className="phone-body">
          <div className="phone-speaker" />

          <div className="phone-screen">
            <div className="phone-status">
              <span>JUGGLER OS</span>
              <span className="phone-wallet">
                <i className="dot coin" />
                {s.sazoncoins.toLocaleString('pt-BR')}
                <i className="dot eye" />
                {s.hydraEyes}
              </span>
            </div>

            <div className="phone-titlebar">
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

            <div className="phone-dock">
              {APPS.map((a) => (
                <button
                  key={a.id}
                  className={`phone-app${app === a.id ? ' active' : ''}`}
                  onClick={() => open(a.id)}
                >
                  <Sprite path={a.icon} size={26} />
                  <span>{a.label}</span>
                </button>
              ))}
            </div>
          </div>

          <button className="phone-home" onClick={onClose} aria-label="Fechar celular" />
        </div>
        <img className="phone-strap" src={asset('props/mooring-rope')} alt="" />
      </div>
    </div>
  );
}
