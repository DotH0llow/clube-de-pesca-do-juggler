import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { AchievementsPanel } from './components/AchievementsPanel';
import { AlbumPanel } from './components/AlbumPanel';
import { CastBar } from './components/CastBar';
import { CatchPopup } from './components/CatchPopup';
import { PauseMenu } from './components/PauseMenu';
import { ReelMinigame } from './components/ReelMinigame';
import { Scene } from './components/Scene';
import { ShopPanel } from './components/ShopPanel';
import { Sprite } from './components/Sprite';
import { TitleScreen } from './components/TitleScreen';
import { ACHIEVEMENTS_BY_ID } from './data/achievements';
import { FAMILIES } from './data/fish';
import { REGIONS } from './data/regions';
import { initAudio, playSfx, startAmbience, stopAmbience } from './engine/audio';
import { SHARDS_FOR_LEGENDARY } from './engine/outcomes';
import { useFishingLoop, type Outcome } from './hooks/useFishingLoop';
import { useSettings } from './state/settings';
import { claimDaily, dailyAvailable, dailyPreview, useGame } from './state/store';

type PanelId = 'album' | 'loja' | 'conquistas' | null;

interface Toast {
  id: number;
  text: string;
  kind: 'coin' | 'eye' | 'ach';
}

export default function App() {
  const s = useGame();
  const settings = useSettings();
  const [view, setView] = useState<'titulo' | 'jogo'>('titulo');
  const [paused, setPaused] = useState(false);
  const [panel, setPanel] = useState<PanelId>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [showDaily, setShowDaily] = useState(false);
  const toastId = useRef(0);

  const pushToast = useCallback((text: string, kind: Toast['kind'] = 'coin') => {
    const id = ++toastId.current;
    setToasts((t) => [...t.slice(-3), { id, text, kind }]);
    window.setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3600);
  }, []);

  const handleOutcome = useCallback(
    (o: Outcome) => {
      if (o.unlocks.newSpecies && o.result.fish) {
        pushToast(`Nova especie no album: ${o.result.fish.name}`, 'ach');
      }
      for (const famId of o.unlocks.families) {
        const fam = FAMILIES.find((f) => f.id === famId);
        if (fam) pushToast(`Familia completa: ${fam.name}! +${fam.reward.sazoncoins} SZ`, 'ach');
      }
      for (const id of o.unlocks.achievements) {
        pushToast(`Conquista: ${ACHIEVEMENTS_BY_ID[id]?.name ?? id}`, 'ach');
      }
      if (o.unlocks.achievements.length || o.unlocks.families.length) {
        window.setTimeout(() => playSfx('unlock'), 420);
      }
    },
    [pushToast],
  );

  const loop = useFishingLoop(handleOutcome);
  const { phase, pending, outcome, startCast, lockPower, hook, finishReel, dismiss, abort } = loop;

  // ---------------------------------------------------- ambiencia liga/desliga
  useEffect(() => {
    if (view !== 'jogo') return;
    if (settings.muted || settings.music <= 0) {
      stopAmbience();
      return;
    }
    initAudio();
    startAmbience();
  }, [view, settings.muted, settings.music]);

  // -------------------------------------------------------------- atalhos
  useEffect(() => {
    if (view !== 'jogo') return;
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'Escape') {
        e.preventDefault();
        if (panel) {
          setPanel(null);
        } else {
          setPaused((p) => {
            if (!p) abort();
            return !p;
          });
        }
        return;
      }
      if (panel || paused || showDaily) return;
      if (e.code !== 'Space' && e.code !== 'Enter') return;
      if (phase === 'idle') {
        e.preventDefault();
        startCast();
      } else if (phase === 'bite') {
        e.preventDefault();
        hook();
      } else if (phase === 'result') {
        e.preventDefault();
        dismiss();
        startCast();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [view, phase, panel, paused, showDaily, startCast, hook, dismiss, abort]);

  const openPanel = (id: PanelId) => {
    playSfx('ui');
    abort();
    setPanel(id);
  };

  const enterGame = () => {
    setView('jogo');
    if (dailyAvailable()) setShowDaily(true);
  };

  const backToTitle = () => {
    abort();
    setPaused(false);
    setPanel(null);
    setView('titulo');
  };

  const region = REGIONS[s.region];
  const styleVars = useMemo(
    () =>
      ({
        '--sky-top': region.palette.skyTop,
        '--sky-bottom': region.palette.skyBottom,
        '--sea-top': region.palette.seaTop,
        '--sea-bottom': region.palette.seaBottom,
        '--sun': region.palette.sun,
        '--island': region.palette.island,
        '--haze': region.palette.haze,
      }) as CSSProperties,
    [region],
  );

  const rootClass = [
    'app',
    s.relics.includes('skin_neon') ? 'neon' : '',
    settings.animations ? '' : 'no-anim',
    settings.hints ? '' : 'no-hints',
  ]
    .filter(Boolean)
    .join(' ');

  if (view === 'titulo') {
    return (
      <div className={rootClass} style={styleVars}>
        <TitleScreen onPlay={enterGame} />
      </div>
    );
  }

  const shards = s.pity.legendaryShards;
  const daily = dailyPreview(s);

  return (
    <div className={rootClass} style={styleVars}>
      <Scene region={s.region} phase={phase} pending={pending} />

      <div className="ui-layer">
        <div className="topbar">
          <button
            className="btn ghost small"
            onClick={() => {
              playSfx('ui');
              abort();
              setPaused(true);
            }}
            aria-label="Pausar"
          >
            <Sprite path="ui/settings-icon" size={18} className="btn-icon" />
            MENU
          </button>
          <div className="wallet">
            <span className="chip coin">
              <i className="dot" />
              {s.sazoncoins.toLocaleString('pt-BR')}
            </span>
            <span className="chip eye">
              <i className="dot" />
              {s.hydraEyes}
            </span>
          </div>
          <div className="spacer" />
          <div className="region-tag">
            {region.name}
            <small>{region.subtitle}</small>
          </div>
        </div>

        {shards > 0 && (
          <div className="chip" style={{ alignSelf: 'flex-start', fontSize: 13 }}>
            Escamas lendarias {shards}/{SHARDS_FOR_LEGENDARY}
          </div>
        )}

        <div className="spacer" />

        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
          {phase === 'idle' && (
            <>
              <button
                className="btn primary"
                onClick={startCast}
                style={{ fontSize: 22, padding: '18px 34px' }}
              >
                LANCAR
              </button>
              <div className="btn-row">
                <button className="btn ghost" onClick={() => openPanel('album')}>
                  <Sprite path="ui/fish-album-icon" size={18} className="btn-icon" />
                  ALBUM
                </button>
                <button className="btn ghost" onClick={() => openPanel('loja')}>
                  <Sprite path="ui/upgrade-icon" size={18} className="btn-icon" />
                  CAIS
                </button>
                <button className="btn ghost" onClick={() => openPanel('conquistas')}>
                  <Sprite path="ui/ranking-icon" size={18} className="btn-icon" />
                  CONQUISTAS
                </button>
              </div>
            </>
          )}

          {phase === 'power' && <CastBar onLock={lockPower} />}

          {phase === 'waiting' && settings.hints && (
            <div className="pixel-box" style={{ textAlign: 'center', width: 'min(460px, 92vw)' }}>
              <p className="reel-hint">Linha na agua. Espere a boia mexer...</p>
            </div>
          )}

          {phase === 'bite' && (
            <button
              className="btn danger"
              onClick={hook}
              style={{ fontSize: 24, padding: '20px 38px' }}
            >
              FISGAR!
            </button>
          )}

          {phase === 'reeling' && pending && <ReelMinigame target={pending} onDone={finishReel} />}
        </div>
      </div>

      {phase === 'result' && outcome && (
        <CatchPopup
          outcome={outcome}
          onAgain={() => {
            dismiss();
            startCast();
          }}
        />
      )}

      {panel === 'album' && <AlbumPanel onClose={() => setPanel(null)} />}
      {panel === 'loja' && <ShopPanel onClose={() => setPanel(null)} />}
      {panel === 'conquistas' && <AchievementsPanel onClose={() => setPanel(null)} />}

      {paused && <PauseMenu onResume={() => setPaused(false)} onTitle={backToTitle} />}

      {showDaily && (
        <div className="modal-backdrop">
          <div className="pixel-box catch-card" style={{ width: 'min(380px, 92vw)' }}>
            <div className="headline" style={{ color: 'var(--coin)' }}>
              BOM DIA, PESCADOR
            </div>
            <Sprite path="sky/setting-sun" size={92} />
            <div className="flavor">
              Dia {daily.streak} seguido no cais. O clube guardou uma ajuda pra voce.
            </div>
            <div className="reward-line">
              <span style={{ color: 'var(--coin)' }}>+{daily.sazoncoins} SZ</span>
              {daily.hydraEyes > 0 && (
                <span style={{ color: 'var(--eye)' }}>+{daily.hydraEyes} Olhos</span>
              )}
            </div>
            <button
              className="btn primary"
              onClick={() => {
                claimDaily();
                playSfx('coin');
                setShowDaily(false);
              }}
            >
              PEGAR
            </button>
          </div>
        </div>
      )}

      <div className="toasts">
        {toasts.map((t) => (
          <div key={t.id} className={`toast ${t.kind}`}>
            {t.text}
          </div>
        ))}
      </div>
    </div>
  );
}
