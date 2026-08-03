import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { CastBar } from './components/CastBar';
import { CasinoHud } from './components/casino/CasinoHud';
import {
  BonusSchoolSummary,
  CashOutModal,
  LuckyCardPicker,
  PrizeLadderModal,
  DebugPanel,
} from './components/casino/CasinoModals';
import { CatchPopup } from './components/CatchPopup';
import { DevPanel } from './components/DevPanel';
import { EditorOverlay } from './editor/EditorOverlay';
import { getFx, type StepId } from './editor/fx';
import { currentStep, usePreview } from './editor/preview';
import { MarketApp } from './components/MarketPanel';
import { Sheet } from './components/Sheet';
import { Phone } from './components/Phone';
import { ReelMinigame } from './components/ReelMinigame';
import { Sprite } from './components/Sprite';
import { TitleScreen } from './components/TitleScreen';
import { World } from './components/World';
import { ACHIEVEMENTS_BY_ID } from './data/achievements';
import { FAMILIES } from './data/fish';
import { FISH } from './data/fish';
import { REGIONS } from './data/regions';
import { skyPhase } from './data/skies';
import { initAudio, playSfx, startAmbience, stopAmbience } from './engine/audio';
import { fireStep, stopMechanicAudio } from './engine/fxAudio';
import { autoStartRadio } from './engine/music';
import { SHARDS_FOR_LEGENDARY } from './engine/outcomes';
import { useFishingLoop, type Outcome, type Phase } from './hooks/useFishingLoop';
import {
  bonusSchoolActive,
  debugActions,
  endBonusSchool,
  resetSession,
  useSession,
} from './state/casino';
import { debugEnabled } from './game/balance';
import { setFreeCam, useDevFlags } from './state/dev';
import { useSettings } from './state/settings';
import { claimDaily, dailyAvailable, dailyPreview, syncRegion, useGame } from './state/store';
import { usePlayer, type FishPose } from './world/usePlayer';
import { clockLabel, useDayPhase, useGameClock, useSkyPhase } from './world/dayCycle';

/** Peixe de mentira: so a simulacao do editor usa, para ter o que desenhar. */
const DEMO_CAST = {
  category: 'comum' as const,
  fish: FISH[0],
  weight: 2.4,
  length: 42,
  value: 120,
  eyes: 0,
  difficulty: 0.4,
  headline: 'SIMULAÇÃO DO EDITOR',
  pityTriggered: false,
};

interface Toast {
  id: number;
  text: string;
  kind: 'coin' | 'eye' | 'ach';
}

export default function App() {
  const s = useGame();
  const settings = useSettings();
  const dev = useDevFlags();
  const [view, setView] = useState<'titulo' | 'mundo'>('titulo');
  const [phoneOpen, setPhoneOpen] = useState(false);
  const [fishing, setFishing] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [showDaily, setShowDaily] = useState(false);
  const [showCashOut, setShowCashOut] = useState(false);
  const [ladderBase, setLadderBase] = useState<number | null>(null);
  const [schoolSummary, setSchoolSummary] = useState<
    { catches: number; coinsSecured: number; coinsBonus: number; bestMultiplier: number } | null
  >(null);
  const [showDebug, setShowDebug] = useState(false);
  const [showMarket, setShowMarket] = useState(false);
  const [showDev, setShowDev] = useState(false);
  const [editor, setEditor] = useState(false);
  const toastId = useRef(0);
  const session = useSession();

  // radio ligado desde a tela de titulo
  useEffect(() => {
    autoStartRadio();
  }, []);

  const pushToast = useCallback((text: string, kind: Toast['kind'] = 'coin') => {
    const id = ++toastId.current;
    setToasts((t) => [...t.slice(-3), { id, text, kind }]);
    window.setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3600);
  }, []);

  // o dia anda sozinho: o save so acompanha a fase que esta no ar
  const dayPhase = useDayPhase();
  const hora = useSkyPhase();
  const clock = useGameClock();
  const firstPhase = useRef(true);
  useEffect(() => {
    syncRegion(dayPhase);
    // a primeira passada e so o estado inicial: nao vira aviso de virada
    if (firstPhase.current) {
      firstPhase.current = false;
      return;
    }
    pushToast(`${REGIONS[dayPhase].name.toUpperCase()} - ${clockLabel()}`, 'ach');
    playSfx('ui');
  }, [dayPhase, pushToast]);

  const handleOutcome = useCallback(
    (o: Outcome) => {
      if (o.unlocks.newSpecies && o.result.fish) {
        pushToast(`Nova espécie no álbum: ${o.result.fish.name}`, 'ach');
      }
      for (const famId of o.unlocks.families) {
        const fam = FAMILIES.find((f) => f.id === famId);
        if (fam) pushToast(`Família completa: ${fam.name}! +${fam.reward.sazoncoins} SZ`, 'ach');
      }
      for (const id of o.unlocks.achievements) {
        pushToast(`Conquista: ${ACHIEVEMENTS_BY_ID[id]?.name ?? id}`, 'ach');
      }
      if (o.unlocks.achievements.length || o.unlocks.families.length) {
        window.setTimeout(() => playSfx('unlock'), 420);
      }

      // ------------------------------------------- mecanicas de sequencia
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
    editor ||
    phoneOpen ||
    showDaily ||
    showCashOut ||
    showMarket ||
    ladderBase !== null ||
    Boolean(session.cardOffer);
  /**
   * O quadro de arremesso nao tem fase propria na maquina de estados: ele e o
   * comecinho da espera. Segurar esse quadro aqui (e nao dentro do laco de
   * animacao) faz a pose ficar disponivel para todo mundo - inclusive para a
   * linha de pesca, que precisa saber onde esta a ponta da vara neste momento.
   */
  const [castHeld, setCastHeld] = useState(false);
  useEffect(() => {
    if (phase !== 'waiting') {
      setCastHeld(false);
      return;
    }
    setCastHeld(true);
    const t = window.setTimeout(() => setCastHeld(false), getFx().timings.castHoldMs);
    return () => window.clearTimeout(t);
  }, [phase]);

  // ------------------------------------------------- simulacao do editor
  // Com a secao MECANICAS aberta, quem manda na fase e a etapa escolhida: o
  // mundo desenhado e o de verdade, so congelado no momento que voce quer ver.
  const preview = usePreview();
  const step = preview.mechanic ? currentStep() : null;
  const shownPhase: Phase = step ? step.phase : phase;
  const shownFishing = step ? true : fishing;
  const shownPending = step
    ? pending ?? { ...DEMO_CAST }
    : pending;

  // a arte da pescaria tem uma pose por momento do lance
  const fishPose: FishPose = step
    ? step.pose
    : phase === 'result'
      ? 'idle'
      : castHeld
        ? 'cast'
        : phase;

  const player = usePlayer({
    active: view === 'mundo' && !busy,
    fishing: shownFishing,
    fishPose,
    paused: phoneOpen || editor,
  });

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

  /*
   * Os sons das mecanicas.
   *
   * Cada etapa do lance avisa quando entra e quando sai; a lista de sons da
   * configuracao de mecanicas decide o que toca em cada uma. Sair da pescaria
   * corta o que ficou em loop.
   */
  const etapaAnterior = useRef<StepId | null>(null);
  useEffect(() => {
    /*
     * A etapa do SOM e a mesma que o mundo desenha, nao a fase crua da maquina
     * de estados. A diferenca importa: `cast` (o quadro do arremesso) nao e uma
     * fase - e o comecinho da espera. Disparar pela fase deixaria o zunido do
     * lance sem tocar nunca.
     */
    const etapa: StepId = phase === 'result' ? 'result' : fishPose;
    if (!fishing) {
      if (etapaAnterior.current) fireStep(etapaAnterior.current, 'sair');
      etapaAnterior.current = null;
      stopMechanicAudio();
      return;
    }
    if (etapaAnterior.current === etapa) return;
    if (etapaAnterior.current) fireStep(etapaAnterior.current, 'sair');
    fireStep(etapa, 'entrar');
    etapaAnterior.current = etapa;
  }, [phase, fishPose, fishing]);

  useEffect(() => stopMechanicAudio, []);

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
      if (e.code === 'F8') {
        e.preventDefault();
        setShowDev((d) => !d);
        return;
      }
      if (editor) return;
      if (e.code === 'F9' && debugEnabled()) {
        e.preventDefault();
        setShowDebug((d) => !d);
        return;
      }
      if (e.code === 'Escape') {
        e.preventDefault();
        // com a camera livre ligada, Esc devolve o controle ao Juggler antes
        // de qualquer outra coisa - e a saida obvia de um modo que prende a tela
        if (dev.freeCam) {
          setFreeCam(false);
          return;
        }
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
    editor,
    dev.freeCam,
  ]);

  const enterGame = () => {
    setView('mundo');
    if (dailyAvailable()) setShowDaily(true);
  };

  const region = REGIONS[dayPhase];
  /*
   * A cor do mar segue a HORA, nao a regiao: sao oito ceus e quatro regioes, e
   * duas horas seguidas na mesma regiao precisam de agua de tom diferente.
   */
  const paleta = skyPhase(hora).palette;
  const styleVars = useMemo(
    () =>
      ({
        '--sea-top': paleta.seaTop,
        '--sea-bottom': paleta.seaBottom,
        '--sun': paleta.sun,
        '--haze': paleta.haze,
      }) as CSSProperties,
    [paleta],
  );

  const rootClass = [
    'app',
    s.relics.includes('skin_neon') ? 'neon' : '',
    settings.animations ? '' : 'no-anim',
    settings.hints ? '' : 'no-hints',
    phoneOpen || editor ? 'paused' : '',
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
        hour={hora}
        phase={shownPhase}
        pose={fishPose}
        pending={shownPending}
        fishing={shownFishing}
        playerXRef={player.playerX}
        cameraRef={player.cameraRef}
        worldRef={player.worldRef}
        shadowRef={player.shadowRef}
        farRef={player.farRef}
        midRef={player.midRef}
        playerRef={player.playerRef}
        spriteRef={player.spriteRef}
        scale={player.scale}
        viewY={player.viewY}
      />

      {dev.freeCam && !editor && (
        <div className="freecam-tag">
          CÂMERA LIVRE
          <small>WASD OU SETAS &middot; MOUSE NA BORDA &middot; SHIFT ACELERA &middot; ESC SAI</small>
        </div>
      )}

      {!editor && (
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
          {/* O editor era um botão dentro do painel de cheat: dois cliques e um
              painel na frente para chegar na ferramenta que mais se usa. */}
          <button
            className="dev-chip"
            onClick={() => {
              abort();
              setFishing(false);
              setPhoneOpen(false);
              setEditor(true);
            }}
            title="Modo editor: pausa o jogo e deixa mexer na cena"
          >
            EDITOR
          </button>
          <button className="dev-chip" onClick={() => setShowDev(true)} title="Painel de dev (F8)">
            DEV
          </button>
          <div className="region-tag">
            {region.name}
            <small>
              {clock} &middot; {region.subtitle}
            </small>
          </div>
        </div>

        <CasinoHud fishing={fishing} />

        {shards > 0 && fishing && (
          <div className="chip" style={{ alignSelf: 'flex-start', fontSize: 13 }}>
            Escamas lendárias {shards}/{SHARDS_FOR_LEGENDARY}
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
            ) : null}
            {/* A faixa de tutorial saiu do rodapé: quem quiser a lista de
                controles abre COMO JOGAR no menu ou no celular. Os botões
                abaixo só existem onde o ponteiro é dedo (ver `.touch-pad`). */}
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
      )}

      {phase === 'result' && outcome && (
        <CatchPopup
          outcome={outcome}
          onStop={() => {
            dismiss();
            stopFishing();
          }}
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
      {session.cardOffer && <LuckyCardPicker cards={session.cardOffer} />}
      {ladderBase !== null && (
        <PrizeLadderModal baseValue={ladderBase} onClose={() => setLadderBase(null)} />
      )}
      {schoolSummary && (
        <BonusSchoolSummary summary={schoolSummary} onClose={() => setSchoolSummary(null)} />
      )}
      {showDev && <DevPanel onClose={() => setShowDev(false)} />}

      {editor && (
        <EditorOverlay
          camXRef={player.camXRef}
          scale={player.scale}
          viewY={player.viewY}
          zoom={player.zoom}
          onResetZoom={player.resetZoom}
          playerXRef={player.playerX}
          onExit={() => setEditor(false)}
        />
      )}

      {showDebug && (
        <DebugPanel
          onClose={() => setShowDebug(false)}
          actions={{
            'SEQUÊNCIA 8': () => debugActions.setStreak(8),
            '+500 PENDENTE': () => debugActions.addPending(500),
            'MEDIDOR CHEIO': debugActions.fillMeter,
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
                Dia {daily.streak} seguido no cais. O clube guardou uma ajuda pra você.
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
