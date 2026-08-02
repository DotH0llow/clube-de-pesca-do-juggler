import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { CastBar } from './components/CastBar';
import { CatchPopup } from './components/CatchPopup';
import { Phone } from './components/Phone';
import { ReelMinigame } from './components/ReelMinigame';
import { Sprite } from './components/Sprite';
import { TitleScreen } from './components/TitleScreen';
import { World } from './components/World';
import { ACHIEVEMENTS_BY_ID } from './data/achievements';
import { FAMILIES } from './data/fish';
import { REGIONS } from './data/regions';
import { initAudio, playSfx, startAmbience, stopAmbience } from './engine/audio';
import { SHARDS_FOR_LEGENDARY } from './engine/outcomes';
import { useFishingLoop, type Outcome } from './hooks/useFishingLoop';
import { useSettings } from './state/settings';
import { claimDaily, dailyAvailable, dailyPreview, useGame } from './state/store';
import { usePlayer } from './world/usePlayer';

interface Toast {
  id: number;
  text: string;
  kind: 'coin' | 'eye' | 'ach';
}

export default function App() {
  const s = useGame();
  const settings = useSettings();
  const [view, setView] = useState<'titulo' | 'mundo'>('titulo');
  const [phoneOpen, setPhoneOpen] = useState(false);
  const [fishing, setFishing] = useState(false);
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

  const busy = phoneOpen || showDaily;
  const player = usePlayer({ active: view === 'mundo' && !busy, fishing });

  // ---------------------------------------------------- ambiencia liga/desliga
  useEffect(() => {
    if (view !== 'mundo') return;
    if (settings.muted || settings.music <= 0) {
      stopAmbience();
      return;
    }
    initAudio();
    startAmbience();
  }, [view, settings.muted, settings.music]);

  const startFishing = useCallback(() => {
    playSfx('ui');
    setFishing(true);
  }, []);

  const stopFishing = useCallback(() => {
    abort();
    setFishing(false);
    playSfx('ui');
  }, [abort]);

  // -------------------------------------------------------------- atalhos
  useEffect(() => {
    if (view !== 'mundo') return;
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'Escape') {
        e.preventDefault();
        setPhoneOpen((p) => {
          if (!p) abort();
          return !p;
        });
        return;
      }
      if (busy) return;
      if (e.code === 'KeyE' && player.nearRod && !fishing) {
        e.preventDefault();
        startFishing();
        return;
      }
      if (!fishing) return;
      if (e.code !== 'Enter' && e.code !== 'Space') return;
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
  }, [view, phase, busy, fishing, player.nearRod, startCast, hook, dismiss, abort, startFishing]);

  const enterGame = () => {
    setView('mundo');
    if (dailyAvailable()) setShowDaily(true);
  };

  const region = REGIONS[s.region];
  const styleVars = useMemo(
    () =>
      ({
        '--sea-top': region.palette.seaTop,
        '--sea-bottom': region.palette.seaBottom,
        '--sun': region.palette.sun,
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
      <World
        region={s.region}
        phase={phase}
        pending={pending}
        fishing={fishing}
        cameraRef={player.cameraRef}
        farRef={player.farRef}
        midRef={player.midRef}
        playerRef={player.playerRef}
        spriteRef={player.spriteRef}
        scale={player.scale}
      />

      <div className="ui-layer">
        <div className="topbar">
          <button
            className="btn ghost small"
            onClick={() => {
              playSfx('ui');
              abort();
              setPhoneOpen(true);
            }}
          >
            <Sprite path="ui/settings-icon" size={18} className="btn-icon" />
            CELULAR
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

        {shards > 0 && fishing && (
          <div className="chip" style={{ alignSelf: 'flex-start', fontSize: 13 }}>
            Escamas lendarias {shards}/{SHARDS_FOR_LEGENDARY}
          </div>
        )}

        <div className="spacer" />

        {/* --------------------------------------------- fora da pescaria */}
        {!fishing && (
          <div className="world-hud">
            {player.nearRod ? (
              <button className="btn primary" onClick={startFishing} style={{ fontSize: 20 }}>
                PESCAR &nbsp;<span className="key">E</span>
              </button>
            ) : (
              settings.hints && (
                <div className="hint-strip">
                  SETAS OU A/D PARA ANDAR &middot; SHIFT CORRE &middot; ESPACO PULA &middot; ESC ABRE O CELULAR
                </div>
              )
            )}
            <div className="touch-pad">
              <button
                className="btn ghost small"
                onPointerDown={() => player.press('ArrowLeft', true)}
                onPointerUp={() => player.press('ArrowLeft', false)}
                onPointerLeave={() => player.press('ArrowLeft', false)}
              >
                &lt;
              </button>
              <button
                className="btn ghost small"
                onPointerDown={() => player.press('Space', true)}
                onPointerUp={() => player.press('Space', false)}
                onPointerLeave={() => player.press('Space', false)}
              >
                PULO
              </button>
              <button
                className="btn ghost small"
                onPointerDown={() => player.press('ArrowRight', true)}
                onPointerUp={() => player.press('ArrowRight', false)}
                onPointerLeave={() => player.press('ArrowRight', false)}
              >
                &gt;
              </button>
            </div>
          </div>
        )}

        {/* ---------------------------------------------------- pescaria */}
        {fishing && (
          <div className="world-hud">
            {phase === 'idle' && (
              <>
                <button
                  className="btn primary"
                  onClick={startCast}
                  style={{ fontSize: 22, padding: '18px 34px' }}
                >
                  LANCAR
                </button>
                <button className="btn ghost small" onClick={stopFishing}>
                  GUARDAR A VARA
                </button>
              </>
            )}

            {phase === 'power' && <CastBar onLock={lockPower} />}

            {phase === 'waiting' && settings.hints && (
              <div className="hint-strip">LINHA NA AGUA. ESPERE A BOIA MEXER...</div>
            )}

            {phase === 'bite' && (
              <button className="btn danger" onClick={hook} style={{ fontSize: 24, padding: '20px 38px' }}>
                FISGAR!
              </button>
            )}

            {phase === 'reeling' && pending && <ReelMinigame target={pending} onDone={finishReel} />}
          </div>
        )}
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

      {phoneOpen && <Phone onClose={() => setPhoneOpen(false)} />}

      {showDaily && (
        <div className="modal-backdrop">
          <div className="sheet daily">
            <div className="sheet-body daily-body">
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
