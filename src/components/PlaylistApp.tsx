import {
  RESTAURANT_TRACKS,
  TRACKS,
  currentTrack,
  next,
  playIndex,
  prev,
  setShuffle,
  toggle,
  useRadio,
} from '../engine/music';
import { updateSettings, useSettings } from '../state/settings';
import { Sprite } from './Sprite';

/** App de playlist do celular: toca as faixas de pescaria. */
export function PlaylistApp() {
  const radio = useRadio();
  const settings = useSettings();
  const track = currentTrack();

  return (
    <>
      <div className="app-summary">
        RADIO DO CLUBE &middot; {TRACKS.length} FAIXAS
      </div>

      <div className="now-playing">
        <Sprite path="props/pier-lantern" size={44} />
        <div className="grow">
          <div className="title">{track ? track.title: 'NADA TOCANDO'}</div>
          <div className="desc">{track ? track.artist: 'ESCOLHA UMA FAIXA'}</div>
        </div>
      </div>

      <div className="player-controls">
        <button className="btn small" onClick={prev} aria-label="Anterior">
          |&lt;
        </button>
        <button className="btn small primary" onClick={toggle}>
          {radio.playing ? 'PAUSAR' : 'TOCAR'}
        </button>
        <button className="btn small" onClick={next} aria-label="Proxima">
          &gt;|
        </button>
        <button
          className={`btn small${radio.shuffle ? ' primary' : ''}`}
          onClick={() => setShuffle(!radio.shuffle)}
        >
          ALEATÓRIO
        </button>
      </div>

      <div className="row">
        <div className="grow">
          <div className="title">
            VOLUME DA MUSICA <span style={{ opacity: 0.6 }}>{Math.round(settings.music * 100)}%</span>
          </div>
          <input
            className="range"
            type="range"
            min={0}
            max={100}
            step={5}
            value={Math.round(settings.music * 100)}
            onChange={(e) => updateSettings({ music: Number(e.target.value) / 100 })}
            aria-label="Volume da música"
          />
        </div>
      </div>

      <div className="section-title">PESCARIA</div>
      {TRACKS.map((t, i) => (
        <button
          key={t.id}
          className={`row track${i === radio.index ? ' active' : ''}`}
          onClick={() => playIndex(i)}
        >
          <span className="track-num">{i === radio.index && radio.playing ? '>' : String(i + 1).padStart(2, '0')}</span>
          <div className="grow" style={{ textAlign: 'left' }}>
            <div className="title">{t.title}</div>
            <div className="desc">{t.artist}</div>
          </div>
        </button>
      ))}

      <div className="section-title">RESTAURANTE</div>
      <div className="row">
        <div className="grow desc">
          Guardado. Estas faixas já estão no projeto, mas só entram quando o
          restaurante existir no jogo.
        </div>
      </div>
      {RESTAURANT_TRACKS.map((name) => (
        <div className="row locked-track" key={name}>
          <span className="track-num">--</span>
          <div className="grow">
            <div className="title">{name}</div>
            <div className="desc">EM BREVE</div>
          </div>
        </div>
      ))}
    </>
  );
}
