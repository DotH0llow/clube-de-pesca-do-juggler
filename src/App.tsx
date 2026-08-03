import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { CastBar } from './components/CastBar';
import { CasinoHud } from './components/casino/CasinoHud';
import {
  BonusSchoolSummary,
  CashOutModal,
  LuckyCardPicker,
  PrizeLadderModal,
  TideWheelModal,
  DebugPanel,
} from './components/casino/CasinoModals';
import { CatchPopup } from './components/CatchPopup';
import { MarketApp } from './components/MarketPanel';
import { Sheet } from './components/Sheet';
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
import {
  bonusSchoolActive,
  debugActions,
  endBonusSchool,
  resetSession,
  useSession,
} from './state/casino';
import { debugEnabled } from './game/balance';
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
  const [showCashOut, setShowCashOut] = useState(false);
  const [showWheel, setShowWheel] = useState(false);
  const [ladderBase, setLadderBase] = useState<number | null>(null);
  const [schoolSummary, setSchoolSummary] = useState<
    { catches: number; coinsSecured: number; coinsBonus: number; bestMultiplier: number } | null
  >(null);
  const [showDebug, setShowDebug] = useState(false);
  const [showMarket, setShowMarket] = useState(false);
  const toastId = useRef(0);
  const session = useSession();

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

      // ------------------------------------------- mecanicas de sequencia
      if (o.casino?.gotSpin) pushToast('GIRO NA RODA DA MARÉ DISPONÍVEL', 'ach');
      if (o.casino?.tierUp) {
        pushToast(`MULTIPLICADOR X${o.casino.multiplier}`, 'coin');
        window.setTimeout(() => playSfx('unlock'), 200);
      }
      if (o.pendingLost && o.pendingLost > 0) {
        pushToast(`BONUS PENDENTE PERDIDO: ${o.pendingLost.toLocaleString('pt-BR')} SZ`, 'eye');
      }
      if (o.result.jackpot) pushToast(`PEIXE JACKPOT ${o.result.jackpot.toUpperCase()}`, 'ach');
    },
    [pushToast],
  );

  const loop = useFishingLoop(handleOutcome);
  const { phase, pending, outcome, startCast, lockPower, hook, finishReel, dismiss, abort } = loop;

  const busy =
    phoneOpen ||
    showDaily ||
    showCashOut ||
    showWheel ||
    showMarket ||
    ladderBase !== null ||
    Boolean(session.cardOffer);
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

  // o cardume tem cronometro real: nao congela com painel aberto
  useEffect(() => {
    if (!session.bonusSchool.active) return;
    const id = window.setInterval(() => {
      if (!bonusSchoolActive()) {
        setSchoolSummary(endBonusSchool());
        window.clearInterval(id);
      }
    }, 300);
    return () => window.clearInterval(id);
  }, [session.bonusSchool.active]);

  const startFishing = useCallback(() => {
    playSfx('ui');
    setFishing(true);
  }, []);

  const openMarket = useCallback(() => {
    playSfx('ui');
    setShowMarket(true);
  }, []);

  const stopFishing = useCallback(() => {
    abort();
    setFishing(false);
    resetSession();
    playSfx('ui');
  }, [abort]);

  // -------------------------------------------------------------- atalhos
  useEffect(() => {
    if (view !== 'mundo') return;
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'F9' && debugEnabled()) {
        e.preventDefault();
        setShowDebug((d) => !d);
        return;
      }
      if (e.code === 'Escape') {
        e.preventDefault();
        setPhoneOpen((p) => {
          if (!p) abort();
          return !p;
        });
        return;
      }
      if (busy) return;
      if (e.code === 'KeyE' && !fishing) {
        if (player.nearRod) {
          e.preventDefault();
          startFishing();
          return;
        }
        if (player.nearMarket) {
          e.preventDefault();
          openMarket();
          return;
        }
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
  }, [
    view,
    phase,
    busy,
    fishing,
    player.nearRod,
    player.nearMarket,
    startCast,
    hook,
    dismiss,
    abort,
    startFishing,
    openMarket,
  ]);

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

        <CasinoHud fishing={fishing} />

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
            ) : player.nearMarket ? (
              <button className="btn primary" onClick={openMarket} style={{ fontSize: 20 }}>
                MERCADO &nbsp;<span className="key">E</span>
              </button>
            ) : (
              settings.hints && (
                <div className="hint-strip">
                  SETAS OU A/D PARA ANDAR &middot; SHIFT CORRE &middot; ESPAÇO PULA &middot; ESC ABRE O CELULAR
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
                  LANÇAR
                </button>
                <div className="btn-row">
                  {s.casino.streak.pendingCoins > 0 && (
                    <button className="btn danger small" onClick={() => setShowCashOut(true)}>
                      SACAR {s.casino.streak.pendingCoins.toLocaleString('pt-BR')}
                    </button>
                  )}
                  {s.casino.tideWheel.availableSpins > 0 && (
                    <button className="btn small" onClick={() => setShowWheel(true)}>
                      RODA DA MARE ({s.casino.tideWheel.availableSpins})
                    </button>
                  )}
                  <button className="btn ghost small" onClick={stopFishing}>
                    GUARDAR A VARA
                  </button>
                </div>
              </>
            )}

            {phase === 'power' && <CastBar onLock={lockPower} />}

            {phase === 'waiting' && settings.hints && (
              <div className="hint-strip">LINHA NA ÁGUA. ESPERE A BOIA MEXER...</div>
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
            const o = outcome;
            dismiss();
            if (o.casino?.offerLadder && o.result.value > 0) {
              setLadderBase(o.result.value);
              return;
            }
            if (o.casino?.offerCashOut) {
              setShowCashOut(true);
              return;
            }
            startCast();
          }}
        />
      )}

      {phoneOpen && <Phone onClose={() => setPhoneOpen(false)} />}

      {showMarket && (
        <Sheet title="MERCADO DE PEIXE" onClose={() => setShowMarket(false)}>
          <MarketApp
            onPaid={(coins, eyes) => {
              pushToast(`Encomenda entregue: +${coins.toLocaleString('pt-BR')} SZ`, 'coin');
              if (eyes > 0) pushToast(`+${eyes} Olhos da Hydra`, 'eye');
              setShowMarket(false);
            }}
          />
        </Sheet>
      )}

      {showCashOut && <CashOutModal onClose={() => setShowCashOut(false)} />}
      {showWheel && <TideWheelModal onClose={() => setShowWheel(false)} />}
      {session.cardOffer && <LuckyCardPicker cards={session.cardOffer} />}
      {ladderBase !== null && (
        <PrizeLadderModal baseValue={ladderBase} onClose={() => setLadderBase(null)} />
      )}
      {schoolSummary && (
        <BonusSchoolSummary summary={schoolSummary} onClose={() => setSchoolSummary(null)} />
      )}
      {showDebug && (
        <DebugPanel
          onClose={() => setShowDebug(false)}
          actions={{
            'SEQUÊNCIA 8': () => debugActions.setStreak(8),
            '+500 PENDENTE': () => debugActions.addPending(500),
            'MEDIDOR CHEIO': debugActions.fillMeter,
            'GANHAR GIRO': debugActions.grantSpin,
            'ABRIR RODA': () => setShowWheel(true),
            'DAR CARTA': debugActions.grantCard,
            'CARDUME': debugActions.startSchool,
            'COMPLETAR LINHA': debugActions.completeLine,
            'ESCADA': () => setLadderBase(500),
            'SIMULAR FALHA': debugActions.simulateFail,
          }}
        />
      )}

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
