import { playSfx } from '../engine/audio';
import { cycleRain, fireBolt, RAIN_LABEL, rainMode, toggleFreeCam, useDevFlags } from '../state/dev';
import { FISH } from '../data/fish';
import { SKY_PHASES } from '../data/skies';
import { clearAlbum, grantCheat, unlockAlbum, useGame } from '../state/store';
import {
  jumpToSky,
  resetClock,
  shiftClock,
  useGameClock,
  useSkyPhase,
} from '../world/dayCycle';
import { seedWorld, updateWorld, useWorld } from '../world/worldConfig';

interface Props {
  onClose: () => void;
}

/**
 * Painel de dev. Abre com F8 (ou pelo chip DEV no topo) e nao aparece para
 * jogador nenhum sem querer: e ferramenta de teste, entao pode ser direto.
 */
export function DevPanel({ onClose }: Props) {
  const s = useGame();
  const dev = useDevFlags();
  const rain = rainMode(dev);
  const hora = useSkyPhase();
  const clock = useGameClock();
  const mundo = useWorld();
  const semente = seedWorld();
  const noAlbum = Object.keys(s.album).length;

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
        ÁLBUM &middot; <b>{noAlbum}/{FISH.length}</b>
      </div>
      <div className="dev-grid">
        <button
          className="ebtn primary"
          style={{ gridColumn: '1 / -1' }}
          disabled={noAlbum >= FISH.length}
          onClick={() => {
            const novas = unlockAlbum();
            playSfx(novas > 0 ? 'unlock' : 'ui');
          }}
          title="Marca as 24 espécies como pescadas e entrega as recompensas de família"
        >
          DESBLOQUEAR O ÁLBUM INTEIRO
        </button>
        <button
          className="ebtn danger"
          style={{ gridColumn: '1 / -1' }}
          disabled={noAlbum === 0}
          onClick={() => {
            if (!confirm('Esvaziar o álbum? As famílias voltam a poder ser reivindicadas.')) return;
            clearAlbum();
            playSfx('ui');
          }}
        >
          ESVAZIAR O ÁLBUM
        </button>
      </div>

      <div className="dev-sep">
        HORA DO DIA &middot; <b>{clock}</b>
      </div>
      <div className="dev-grid">
        {SKY_PHASES.map((p) => (
          <button
            key={p.id}
            className={`ebtn${hora === p.id ? ' primary' : ''}`}
            onClick={() => {
              jumpToSky(p.id);
              playSfx('ui');
            }}
            title={`${p.name} · vale a região ${p.region}`}
          >
            {p.name.toUpperCase()}
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
        {/* O RELÂMPAGO NÃO ESPERA A TEMPESTADE.

            O raio automático cai de 17 em 17 segundos e acende por dois
            quadros. Quem quer olhar como ele ficou espera oito segundos e meio
            em média - e pisca. Este cai agora, chovendo ou não. */}
        <button
          className="ebtn"
          style={{ gridColumn: '1 / -1' }}
          onClick={() => {
            fireBolt();
            playSfx('ui');
          }}
          title="Dispara um relâmpago agora, independente da hora e do clima"
        >
          RELÂMPAGO AGORA
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

      {/* --------------------------------------------------- nível da água

          O número existe na seção MUNDO do editor, mas subir a maré é o tipo de
          ajuste que se faz OLHANDO a praia, e abrir o editor congela o jogo. Os
          dois escrevem no mesmo `waterY`, então não há duas verdades: aqui é só
          um caminho mais curto até ele.

          Subir a água acima do topo da areia alaga a praia de verdade - a linha
          de costa é calculada a partir dela, então a faixa de água rasa, a
          espuma e a areia molhada andam junto. */}
      <div className="dev-sep">NÍVEL DA ÁGUA</div>
      <div className="dev-grid">
        <button
          className="ebtn"
          onClick={() => updateWorld({ waterY: mundo.waterY + 8 })}
          title="Maré baixa: a água desce e a praia cresce"
        >
          BAIXAR
        </button>
        <button
          className="ebtn"
          onClick={() => updateWorld({ waterY: mundo.waterY - 8 })}
          title="Maré alta: a água sobe e come a praia"
        >
          SUBIR
        </button>
        <button
          className="ebtn"
          onClick={() => updateWorld({ waterY: semente.waterY })}
          title="Volta a linha d'água ao padrão"
        >
          PADRÃO
        </button>
      </div>
      <div className="dev-hint">
        Linha d'água em <b>{Math.round(mundo.waterY)}</b>, topo da areia em{' '}
        <b>{Math.round(mundo.sandY)}</b>. Acima de {Math.round(mundo.sandY)} a maré alaga a praia.
        Os controles finos (perfil da costa, água rasa, espuma) estão em MUNDO, no editor.
      </div>

      <div className="dev-hint">
        O modo editor saiu daqui: agora ele é o botão EDITOR na barra do topo, sem precisar abrir
        este painel antes.
      </div>
    </div>
  );
}
