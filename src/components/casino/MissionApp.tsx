import { MISSION_LINES } from '../../data/missions';
import {
  HIDDEN_FISH_MODIFIERS,
  JACKPOT_TIERS,
  STREAK_TIERS,
  TIDE_WHEEL_REWARDS,
} from '../../game/balance';
import { newMissionBoard } from '../../state/casino';
import { useGame } from '../../state/store';

/** Cartela 3x3 + tela de probabilidades, dentro do celular. */
export function MissionApp() {
  const s = useGame();
  const board = s.casino.missionBoard;
  const done = board.tiles.filter((t) => t.completed).length;
  const lines = board.completedLines.length;

  const cellsInLine = new Set(
    MISSION_LINES.filter((l) => board.completedLines.includes(l.id)).flatMap((l) => l.cells),
  );

  return (
    <>
      <div className="app-summary">
        {done}/9 CASAS &middot; {lines} LINHA{lines === 1 ? '' : 'S'}
      </div>

      <div className="mission-grid">
        {board.tiles.map((t, i) => (
          <div
            key={t.id}
            className={`mission-tile${t.completed ? ' done' : ''}${cellsInLine.has(i) ? ' in-line' : ''}`}
          >
            <div className="mission-desc">{t.description}</div>
            <div className="bar">
              <div className="fill" style={{ width: `${(t.progress / t.target) * 100}%` }} />
            </div>
            <div className="mission-progress">
              {Math.min(t.progress, t.target)}/{t.target}
            </div>
          </div>
        ))}
      </div>

      <div className="row">
        <div className="grow">
          <div className="title">PRÓXIMA RECOMPENSA</div>
          <div className="desc">
            {board.fullyCompleted
              ? 'CARTELA COMPLETA. PEGUE UMA NOVA.'
              : `LINHA COMPLETA PAGA ${300 + lines * 200} SZ, UM GIRO, MEDIDOR E UMA CARTA.`}
          </div>
        </div>
        {board.fullyCompleted && (
          <button className="btn small primary" onClick={newMissionBoard}>
            NOVA CARTELA
          </button>
        )}
      </div>

      <div className="section-title">PROBABILIDADES</div>
      <div className="row">
        <div className="grow desc">
          Tudo o que sorteia está aqui. Nenhuma probabilidade muda por compra -
          não existe compra de giro nem dinheiro real neste jogo.
        </div>
      </div>

      <div className="row odds">
        <div className="grow">
          <div className="title">SEQUÊNCIA</div>
          {STREAK_TIERS.map((t) => (
            <div className="desc" key={t.catches}>
              {t.catches} CAPTURAS &rarr; X{t.multiplier}
            </div>
          ))}
        </div>
      </div>

      <div className="row odds">
        <div className="grow">
          <div className="title">RODA DA MARÉ</div>
          {TIDE_WHEEL_REWARDS.map((r) => (
            <div className="desc" key={r.id}>
              {r.label} &mdash; {r.weight}%
            </div>
          ))}
        </div>
      </div>

      <div className="row odds">
        <div className="grow">
          <div className="title">MULTIPLICADOR ESCONDIDO</div>
          {(Object.keys(HIDDEN_FISH_MODIFIERS) as (keyof typeof HIDDEN_FISH_MODIFIERS)[]).map((k) => (
            <div className="desc" key={k}>
              {HIDDEN_FISH_MODIFIERS[k].label} &mdash; X{HIDDEN_FISH_MODIFIERS[k].multiplier} em{' '}
              {HIDDEN_FISH_MODIFIERS[k].chance}% dos peixes
            </div>
          ))}
        </div>
      </div>

      <div className="row odds">
        <div className="grow">
          <div className="title">PEIXE JACKPOT</div>
          {(Object.keys(JACKPOT_TIERS) as (keyof typeof JACKPOT_TIERS)[]).map((k) => (
            <div className="desc" key={k}>
              {k.toUpperCase()} &mdash; X{JACKPOT_TIERS[k].multiplier} ({JACKPOT_TIERS[k].weight}% dos jackpots)
            </div>
          ))}
          <div className="desc">MEDIDOR CHEIO GARANTE O PRÓXIMO ENCONTRO.</div>
        </div>
      </div>

      <div className="section-title">ESTATÍSTICAS</div>
      <div className="row odds">
        <div className="grow desc">
          BONUS SACADO: {s.casino.statistics.totalPendingCoinsCashedOut.toLocaleString('pt-BR')}
          <br />
          BONUS PERDIDO: {s.casino.statistics.totalPendingCoinsLost.toLocaleString('pt-BR')}
          <br />
          MAIOR MULTIPLICADOR: X{s.casino.statistics.highestStreakMultiplier}
          <br />
          PEIXES JACKPOT: {s.casino.statistics.jackpotFishCaught}
          <br />
          GIROS: {s.casino.statistics.tideWheelSpins}
          <br />
          MELHOR ETAPA DA ESCADA: {s.casino.statistics.prizeLadderBestStep}
          <br />
          CARDUMES: {s.casino.statistics.bonusSchoolsCompleted}
          <br />
          CARTELAS COMPLETAS: {s.casino.statistics.missionBoardsCompleted}
        </div>
      </div>
    </>
  );
}
