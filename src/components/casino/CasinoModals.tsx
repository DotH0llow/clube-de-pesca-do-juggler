import { useEffect, useRef, useState } from 'react';
import { asset } from '../../assets';
import type { LuckyCard } from '../../data/luckyCards';
import { PRIZE_LADDER, TIDE_WHEEL_REWARDS } from '../../game/balance';
import { playCatch, playSfx } from '../../engine/audio';
import {
  applyWheelReward,
  cashOut,
  chooseCard,
  creditLadder,
  dismissCardOffer,
  registerLadderStep,
  spinTideWheel,
  useSession,
} from '../../state/casino';
import { useGame } from '../../state/store';
import { Sprite } from '../Sprite';

// ============================================================ pescar ou sacar

/**
 * Decisao de risco. O botão de sacar e o primeiro, o maior e o mais claro -
 * nunca escondido, como manda a spec de transparencia.
 */
export function CashOutModal({ onClose }: { onClose: () => void }) {
  const s = useGame();
  const { pendingCoins, multiplier } = s.casino.streak;

  return (
    <div className="modal-backdrop">
      <div className="sheet risk-sheet">
        <div className="sheet-body daily-body">
          <div className="headline" style={{ color: 'var(--coin)' }}>
            MARÉ FAVORÁVEL
          </div>
          <Sprite path="fx/reward-glow" size={80} />
          <div className="risk-lines">
            <div>
              VALOR GARANTIDO <b>{s.sazoncoins.toLocaleString('pt-BR')}</b>
            </div>
            <div className="at-risk">
              BONUS PENDENTE <b>{pendingCoins.toLocaleString('pt-BR')}</b>
            </div>
            <div>
              MULTIPLICADOR ATUAL <b>X{multiplier}</b>
            </div>
          </div>
          <div className="flavor">
            O bônus pendente é perdido se a próxima pescaria falhar. Suas
            Sazoncoins já garantidas nunca são tocadas.
          </div>
          <button
            className="btn primary"
            style={{ fontSize: 20 }}
            onClick={() => {
              const amount = cashOut();
              if (amount > 0) playSfx('coin');
              onClose();
            }}
          >
            SACAR {pendingCoins.toLocaleString('pt-BR')}
          </button>
          <button className="btn" onClick={onClose}>
            CONTINUAR PESCANDO
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================================ roda da mare

/**
 * Roda da Mare. O premio JA foi sorteado por `spinTideWheel` antes de a
 * animacao comecar; aqui a roda so gira ate o segmento certo.
 */
export function TideWheelModal({ onClose }: { onClose: () => void }) {
  const s = useGame();
  const session = useSession();
  const [angle, setAngle] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  const slice = 360 / TIDE_WHEEL_REWARDS.length;

  const spin = () => {
    if (spinning) return;
    const result = spinTideWheel();
    if (!result) return;
    setSpinning(true);
    setDone(null);
    playSfx('unlock');
    // 5 voltas cheias + o segmento sorteado
    const target = 360 * 5 + (360 - result.index * slice - slice / 2);
    setAngle(target);
    timer.current = window.setTimeout(() => {
      applyWheelReward(result.id);
      setDone(result.label);
      setSpinning(false);
      playCatch('raro');
    }, 3400);
  };

  const spins = s.casino.tideWheel.availableSpins;

  return (
    <div className="modal-backdrop" onClick={spinning ? undefined : onClose}>
      <div className="sheet wheel-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-head">
          <h2>RODA DA MARÉ</h2>
          <button className="btn ghost small" onClick={onClose} disabled={spinning}>
            FECHAR
          </button>
        </div>
        <div className="sheet-body daily-body">
          <div className="wheel-wrap">
            <div className="wheel-pin" />
            <div
              className="wheel"
              style={{
                transform: `rotate(${angle}deg)`,
                transition: spinning ? 'transform 3.3s cubic-bezier(.17,.67,.24,1)' : 'none',
              }}
            >
              {TIDE_WHEEL_REWARDS.map((r, i) => (
                <div
                  key={r.id}
                  className={`wheel-slice s${i % 4}`}
                  style={{ transform: `rotate(${i * slice}deg) skewY(${90 - slice}deg)` }}
                />
              ))}
            </div>
          </div>

          <div className="flavor">
            {done ? done : spinning ? 'A MARÉ ESTÁ GIRANDO...' : `GIROS DISPONÍVEIS: ${spins}`}
          </div>

          <div className="wheel-legend">
            {TIDE_WHEEL_REWARDS.map((r) => (
              <div key={r.id} className="legend-line">
                <span>{r.label}</span>
                <b>{r.weight}%</b>
              </div>
            ))}
          </div>

          <button className="btn primary" onClick={spin} disabled={spinning || spins <= 0}>
            {spins > 0 ? 'GIRAR' : 'SEM GIROS'}
          </button>
        </div>
      </div>
      {session.wheelResult && null}
    </div>
  );
}

// ============================================================ cartas de sorte

export function LuckyCardPicker({ cards }: { cards: LuckyCard[] }) {
  return (
    <div className="modal-backdrop">
      <div className="sheet cards-sheet">
        <div className="sheet-head">
          <h2>CARTA DE SORTE</h2>
          <button className="btn ghost small" onClick={dismissCardOffer}>
            PULAR
          </button>
        </div>
        <div className="sheet-body card-row">
          {cards.map((c) => (
            <button
              key={c.id}
              className={`lucky-card ${c.rarity}`}
              onClick={() => {
                playSfx('unlock');
                chooseCard(c.id);
              }}
            >
              <Sprite path={c.icon} size={48} />
              <div className="title">{c.name}</div>
              <div className="desc">{c.description}</div>
              <div className="card-tag">
                {c.durationType === 'instant'
                  ? 'IMEDIATO'
                  : c.durationType === 'session'
                    ? 'ATÉ O FIM DA SESSÃO'
                    : `${c.durationValue} ${c.durationType === 'next-catch' ? 'CAPTURA' : 'LANCAMENTOS'}`}
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ============================================================ escada de premios

/**
 * Escada de Premios: minigame de habilidade de verdade (marcador correndo e
 * zona que encolhe), nunca sorteio. So o bonus da escada esta em risco - o
 * peixe e o valor-base ja foram garantidos antes de a escada abrir.
 */
export function PrizeLadderModal({
  baseValue,
  onClose,
}: {
  baseValue: number;
  onClose: () => void;
}) {
  const [step, setStep] = useState(0); // etapas ja vencidas
  const [pos, setPos] = useState(0);
  const [running, setRunning] = useState(true);
  const [failed, setFailed] = useState(false);
  const posRef = useRef(0);
  const dirRef = useRef(1);
  const raf = useRef(0);
  const lockedRef = useRef(false);

  const cfg = PRIZE_LADDER[Math.min(step, PRIZE_LADDER.length - 1)];
  const zoneStart = 0.5 - cfg.zone / 2;
  const currentBonus = step > 0 ? Math.round(baseValue * PRIZE_LADDER[step - 1].bonusMultiplier) : 0;
  const nextBonus = Math.round(baseValue * cfg.bonusMultiplier);

  useEffect(() => {
    if (!running) return;
    lockedRef.current = false;
    let last = performance.now();
    const loop = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      posRef.current += dirRef.current * cfg.speed * dt * 2;
      if (posRef.current >= 1) {
        posRef.current = 1;
        dirRef.current = -1;
      }
      if (posRef.current <= 0) {
        posRef.current = 0;
        dirRef.current = 1;
      }
      setPos(posRef.current);
      raf.current = requestAnimationFrame(loop);
    };
    raf.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf.current);
  }, [running, cfg.speed, step]);

  const attempt = () => {
    if (lockedRef.current || !running) return;
    lockedRef.current = true;
    cancelAnimationFrame(raf.current);
    const hit = posRef.current >= zoneStart && posRef.current <= zoneStart + cfg.zone;
    if (hit) {
      playSfx('unlock');
      registerLadderStep(step + 1);
      setStep(step + 1);
      setRunning(false);
    } else {
      playSfx('fail');
      setFailed(true);
      setRunning(false);
    }
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'Space' || e.code === 'Enter') {
        e.preventDefault();
        attempt();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const take = () => {
    if (currentBonus > 0) {
      creditLadder(currentBonus, step);
      playSfx('coin');
    }
    onClose();
  };

  const maxed = step >= PRIZE_LADDER.length;

  return (
    <div className="modal-backdrop">
      <div className="sheet ladder-sheet">
        <div className="sheet-head">
          <h2>ESCADA DE PRÊMIOS</h2>
          <span style={{ fontSize: 13 }}>ETAPA {Math.min(step + 1, PRIZE_LADDER.length)}/4</span>
        </div>
        <div className="sheet-body daily-body">
          {failed ? (
            <>
              <div className="headline" style={{ color: '#a3301f' }}>
                ERROU A JANELA
              </div>
              <div className="flavor">
                O bônus da escada foi embora. O peixe e o valor-base continuam seus.
              </div>
              <button className="btn primary" onClick={onClose}>
                VOLTAR
              </button>
            </>
          ) : (
            <>
              <div className="risk-lines">
                <div>
                  BONUS ATUAL <b>{currentBonus.toLocaleString('pt-BR')}</b>
                </div>
                {!maxed && (
                  <div className="at-risk">
                    PRÓXIMO <b>{nextBonus.toLocaleString('pt-BR')}</b> &middot; {cfg.difficulty.toUpperCase()}
                  </div>
                )}
              </div>

              {!maxed && running && (
                <div className="ladder-track" onPointerDown={attempt}>
                  <div
                    className="ladder-zone"
                    style={{ left: `${zoneStart * 100}%`, width: `${cfg.zone * 100}%` }}
                  />
                  <div className="ladder-marker" style={{ left: `${pos * 100}%` }} />
                </div>
              )}

              <div className="flavor">
                {maxed
                  ? 'VOCÊ LIMPOU A ESCADA INTEIRA.'
                  : running
                    ? 'TOQUE OU ESPAÇO QUANDO O MARCADOR ESTIVER NA ZONA.'
                    : 'ETAPA VENCIDA. SACAR OU SUBIR?'}
              </div>

              <button className="btn primary" style={{ fontSize: 18 }} onClick={take}>
                SACAR {currentBonus.toLocaleString('pt-BR')}
              </button>
              {!maxed && !running && (
                <button className="btn danger" onClick={() => setRunning(true)}>
                  SUBIR PARA {nextBonus.toLocaleString('pt-BR')}
                </button>
              )}
              {running && (
                <button className="btn ghost small" onClick={take}>
                  DESISTIR E SACAR
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================================ cardume: resumo

export function BonusSchoolSummary({
  summary,
  onClose,
}: {
  summary: { catches: number; coinsSecured: number; coinsBonus: number; bestMultiplier: number };
  onClose: () => void;
}) {
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="sheet risk-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-body daily-body">
          <div className="headline" style={{ color: 'var(--coin)' }}>
            CARDUME ENCERRADO
          </div>
          <img src={asset('props/decorative-fish-school')} alt="" style={{ height: 70 }} />
          <div className="risk-lines">
            <div>
              PEIXES CAPTURADOS <b>{summary.catches}</b>
            </div>
            <div>
              VALOR GARANTIDO <b>{summary.coinsSecured.toLocaleString('pt-BR')}</b>
            </div>
            <div className="at-risk">
              BONUS DO EVENTO <b>{summary.coinsBonus.toLocaleString('pt-BR')}</b>
            </div>
            <div>
              MAIOR MULTIPLICADOR <b>X{summary.bestMultiplier}</b>
            </div>
          </div>
          <button className="btn primary" onClick={onClose}>
            CONTINUAR
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================================ debug

export function DebugPanel({ actions, onClose }: { actions: Record<string, () => void>; onClose: () => void }) {
  return (
    <div className="debug-panel">
      <div className="debug-head">
        DEBUG
        <button onClick={onClose}>X</button>
      </div>
      {Object.entries(actions).map(([label, fn]) => (
        <button key={label} className="btn ghost small" onClick={fn}>
          {label}
        </button>
      ))}
    </div>
  );
}
