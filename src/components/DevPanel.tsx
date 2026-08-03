import { playSfx } from '../engine/audio';
import { cycleRain, RAIN_LABEL, rainMode, toggleFreeCam, useDevFlags } from '../state/dev';
import { REGIONS } from '../data/regions';
import { grantCheat, useGame } from '../state/store';
import {
  DAY_ORDER,
  jumpToPhase,
  resetClock,
  shiftClock,
  useDayPhase,
  useGameClock,
} from '../world/dayCycle';

interface Props {
  onClose: () => void;
  onEditor: () => void;
}

/**
 * Painel de dev. Abre com F8 (ou pelo chip DEV no topo) e nao aparece para
 * jogador nenhum sem querer: e ferramenta de teste, entao pode ser direto.
 */
export function DevPanel({ onClose, onEditor }: Props) {
  const s = useGame();
  const dev = useDevFlags();
  const rain = rainMode(dev);
  const phase = useDayPhase();
  const clock = useGameClock();

  const pay = (coins: number, eyes: number) => {
    grantCheat(coins, eyes);
    playSfx('coin');
  };

  return (
    <div className="dev-panel">
      <div className="dev-head">
        <span className="dev-badge">DEV</span>
        <span className="grow">CHEATS</span>
        <button className="ebtn" onClick={onClose}>
          FECHAR
        </button>
      </div>

      <div className="dev-wallet">
        <span style={{ color: 'var(--coin)' }}>{s.sazoncoins.toLocaleString('pt-BR')} SZ</span>
        <span style={{ color: 'var(--eye)' }}>{s.hydraEyes.toLocaleString('pt-BR')} Olhos</span>
      </div>

      <div className="dev-grid">
        <button className="ebtn" onClick={() => pay(100000, 0)}>
          +100.000 SZ
        </button>
        <button className="ebtn" onClick={() => pay(0, 100000)}>
          +100.000 OLHOS
        </button>
        <button className="ebtn" onClick={() => pay(100000, 100000)}>
          +100K NOS DOIS
        </button>
      </div>

      <div className="dev-sep">
        HORA DO DIA &middot; <b>{clock}</b>
      </div>
      <div className="dev-grid">
        {DAY_ORDER.map((id) => (
          <button
            key={id}
            className={`ebtn${phase === id ? ' primary' : ''}`}
            onClick={() => {
              jumpToPhase(id);
              playSfx('ui');
            }}
            title={REGIONS[id].subtitle}
          >
            {REGIONS[id].name.toUpperCase()}
          </button>
        ))}
      </div>
      <div className="dev-grid">
        <button className="ebtn" onClick={() => shiftClock(-60 * 1000)} title="Volta uma hora do jogo">
          -1H
        </button>
        <button className="ebtn" onClick={() => shiftClock(60 * 1000)} title="Adianta uma hora do jogo">
          +1H
        </button>
        <button className="ebtn" onClick={resetClock} title="Volta para a hora de verdade">
          HORA REAL
        </button>
      </div>

      <div className="dev-sep">CENÁRIO</div>
      <div className="dev-grid">
        <button
          className={`ebtn${rain === 'on' ? ' primary' : ''}${rain === 'off' ? ' danger' : ''}`}
          style={{ gridColumn: '1 / -1' }}
          onClick={() => {
            cycleRain();
            playSfx('ui');
          }}
          title="Automática segue a fase do dia; ligada e desligada mandam nela"
        >
          {RAIN_LABEL[rain]}
        </button>
        <button
          className={`ebtn${dev.freeCam ? ' primary' : ''}`}
          style={{ gridColumn: '1 / -1' }}
          onClick={() => {
            toggleFreeCam();
            playSfx('ui');
            if (!dev.freeCam) onClose();
          }}
          title="O Juggler fica parado e a tela anda com WASD, setas e mouse na borda"
        >
          CÂMERA LIVRE: {dev.freeCam ? 'LIGADA' : 'DESLIGADA'}
        </button>
      </div>

      <button className="ebtn primary wide" onClick={onEditor}>
        ABRIR MODO EDITOR
      </button>
      <div className="dev-hint">
        O editor pausa o jogo, deixa mover e apagar asset e guarda a cena no navegador.
      </div>
    </div>
  );
}
