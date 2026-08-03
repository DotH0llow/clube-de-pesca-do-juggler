import { useEffect, useState } from 'react';
import { LUCKY_CARDS_BY_ID } from '../../data/luckyCards';
import { JACKPOT_METER_MAX } from '../../game/balance';
import { nextStreakTier } from '../../game/systems/RewardCalculator';
import { useSession } from '../../state/casino';
import { useGame } from '../../state/store';
import { Sprite } from '../Sprite';

/**
 * HUD das mecânicas de risco/recompensa.
 *
 * Prioridade em tela pequena (spec 15): bonus pendente > multiplicador >
 * medidor > tempo de evento. O resto entra num painel recolhivel.
 */
export function CasinoHud({ fishing }: { fishing: boolean }) {
  const s = useGame();
  const session = useSession();
  const [open, setOpen] = useState(false);
  const [now, setNow] = useState(Date.now());

  const school = session.bonusSchool;
  const schoolOn = school.active && now < school.endsAt;

  useEffect(() => {
    if (!school.active) return;
    const id = window.setInterval(() => setNow(Date.now()), 200);
    return () => window.clearInterval(id);
  }, [school.active]);

  const streak = s.casino.streak;
  const meter = s.casino.jackpotMeter;
  const tier = nextStreakTier(streak.current);

  if (!fishing && streak.pendingCoins === 0 && !schoolOn) return null;

  const tierProgress = tier
    ? Math.min(1, streak.current / tier.catches)
    : 1;

  return (
    <div className={`casino-hud${open ? ' open' : ''}`}>
      {/* --------------------------------------------------- prioridade 1 */}
      {streak.pendingCoins > 0 && (
        <div className="hud-pending" title="Bônus ainda não garantido">
          EM RISCO <strong>{streak.pendingCoins.toLocaleString('pt-BR')}</strong> SZ
        </div>
      )}

      {/* --------------------------------------------------- prioridade 2 */}
      <div className={`hud-streak${streak.multiplier > 1 ? ' hot' : ''}`}>
        <span className="hud-mult">X{streak.multiplier.toFixed(1).replace('.0', '')}</span>
        <span className="hud-streak-count">SEQ {streak.current}</span>
        <div className="hud-bar">
          <div className="fill" style={{ width: `${tierProgress * 100}%` }} />
        </div>
        <small>{tier ? `${tier.catches} CAPTURAS = X${tier.multiplier}` : 'MULTIPLICADOR MÁXIMO'}</small>
      </div>

      {/* --------------------------------------------------- prioridade 3 */}
      <div className={`hud-meter${meter.jackpotReady ? ' ready' : ''}`}>
        <span>MARÉ DA FORTUNA</span>
        <div className="hud-bar">
          <div className="fill gold" style={{ width: `${(meter.value / JACKPOT_METER_MAX) * 100}%` }} />
        </div>
        <small>{meter.jackpotReady ? 'A MARÉ DA FORTUNA ESTÁ COMPLETA' : `${Math.round(meter.value)}%`}</small>
      </div>

      {/* --------------------------------------------------- prioridade 4 */}
      {schoolOn && (
        <div className="hud-school">
          CARDUME BÔNUS
          <strong>{Math.max(0, Math.ceil((school.endsAt - now) / 1000))}s</strong>
          <small>{school.catches} PEIXES</small>
        </div>
      )}

      <button className="hud-toggle" onClick={() => setOpen((o) => !o)}>
        {open ? 'MENOS' : 'MAIS'}
      </button>

      {open && (
        <div className="hud-extra">
          <div className="hud-line">
            CARTELA {s.casino.missionBoard.tiles.filter((t) => t.completed).length}/9
          </div>
          {s.casino.activeCards.length > 0 && (
            <div className="hud-cards">
              {s.casino.activeCards.map((c) => {
                const def = LUCKY_CARDS_BY_ID[c.id];
                return (
                  <span className="hud-card" key={c.id} title={def.description}>
                    <Sprite path={def.icon} size={18} />
                    {def.name}
                    {c.remaining > 0 && <b> {c.remaining}</b>}
                  </span>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
