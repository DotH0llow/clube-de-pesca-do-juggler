import { asset } from '../assets';
import { RARITIES, rarityBadge } from '../data/rarities';
import type { Outcome } from '../hooks/useFishingLoop';
import type { Rarity } from '../state/types';
import { FishSprite, JunkSprite, Sprite } from './Sprite';
import { telaVars, useTelas } from '../editor/telas';

interface Props {
  outcome: Outcome;
  onAgain: () => void;
  /** guardar a vara: sai da pescaria e devolve o controle do Juggler */
  onStop: () => void;
}

/** Efeito de fundo por raridade: quanto mais raro, mais escandaloso. */
const BURST: Record<Rarity, string | null> = {
  comum: null,
  incomum: 'fx/common-particles',
  raro: 'fx/rare-sparkles',
  epico: 'fx/epic-particle-burst',
  lendario: 'fx/reward-glow',
  mitico: 'fx/reward-glow',
};

export function CatchPopup({ outcome, onAgain, onStop }: Props) {
  const { result, landed, escapeText } = outcome;
  const fish = result.fish;
  const rarity = fish ? RARITIES[fish.rarity] : null;
  const failed = Boolean(fish) && !landed;
  const burst = fish && !failed ? BURST[fish.rarity] : null;

  const accent = failed ? '#ff5f7e' : rarity ? rarity.color : '#cfe8f5';

  /*
   * A geometria da janela vem da secao TELAS do editor.
   *
   * `pegou` e `escapou` sao a MESMA tela com dados diferentes - por isso as
   * duas leem a mesma configuracao. Separa-las daria duas caixas para manter
   * alinhadas na mao, e a diferenca entre elas e o texto, nao o tamanho.
   */
  useTelas();

  return (
    <div className="catch-popup" style={telaVars('catch')}>
      <div className="catch-card" onClick={(e) => e.stopPropagation()}>
        {/* A placa agora estica com o texto (ver `.catch-banner`), entao ela
            nao precisa mais da imagem solta por dentro nem de posicao em
            porcentagem para centralizar o titulo. */}
        <div className="catch-banner">
          <span className="headline" style={{ color: failed ? '#7a1e12' : undefined }}>
            {failed ? 'ESCAPOU' : result.headline}
          </span>
        </div>

        <div className="sprite-frame">
          {burst && <img className="burst" src={asset(burst)} alt="" />}
          {fish ? (
            <div className={failed ? '' : 'bobbing'} style={{ opacity: failed ? 0.4 : 1 }}>
              <FishSprite fish={fish} size={140} />
            </div>
          ) : result.junk ? (
            <JunkSprite junk={result.junk} size={120} />
          ) : result.category === 'bau' ? (
            <Sprite path={landed ? 'fx/chest-open' : 'fx/chest-closed'} size={130} />
          ) : result.category === 'evento' ? (
            <Sprite path="props/distant-underwater-silhouette" size={120} className="sprite-silhouette" />
          ) : (
            <Sprite path="fx/snapped-fishing-line" size={110} />
          )}
          {failed && <img className="burst" src={asset('fx/escape-swirl')} alt="" />}
        </div>

        {fish && (
          <>
            <div className="fish-name" style={{ color: accent }}>
              {fish.name}
            </div>
            <div className="rarity-line">
              <Sprite path={rarityBadge(fish.rarity)} size={30} />
              <span className="rarity-tag" style={{ color: rarity?.color }}>
                {rarity?.label}
              </span>
            </div>
            <div className="flavor">
              {result.weight} kg &middot; {result.length} cm
            </div>
            <div className="flavor">{failed ? escapeText : fish.flavor}</div>
          </>
        )}

        {result.junk && (
          <>
            <div className="fish-name">{result.junk.name}</div>
            <div className="flavor">{result.junk.flavor}</div>
          </>
        )}

        {result.category === 'bau' && landed && (
          <div className="flavor">Alguém afundou isso aqui faz tempo.</div>
        )}

        {result.category === 'evento' && !fish && (
          <div className="flavor">Três vultos passaram embaixo do barco. Não voltaram.</div>
        )}

        {/* O texto do lance vazio saia DUAS vezes: uma na placa do titulo e
            outra aqui embaixo, palavra por palavra. E o que se ve no print da
            "boia nem piscou". A placa ja diz; aqui fica o comentario. */}
        {result.category === 'nada' && (
          <div className="flavor">Nem todo lance traz peixe. Joga de novo.</div>
        )}

        {!failed && (result.value > 0 || result.eyes > 0) && (
          <div className="reward-line">
            {result.value > 0 && <span style={{ color: 'var(--coin)' }}>+{result.value} SZ</span>}
            {result.eyes > 0 && <span style={{ color: 'var(--eye)' }}>+{result.eyes} Olhos</span>}
          </div>
        )}

        {result.pityTriggered && !failed && (
          <div className="flavor" style={{ color: 'var(--neon)' }}>
            A maré virou a seu favor.
          </div>
        )}

        {/* Duas saidas, nao uma. Antes o unico caminho era LANCAR DE NOVO -
            para parar de pescar era preciso lancar mais uma vez e so entao
            achar o botao de guardar. */}
        <div className="btn-row">
          <button className="btn primary" onClick={onAgain} autoFocus>
            LANÇAR DE NOVO
          </button>
          <button className="btn ghost" onClick={onStop}>
            GUARDAR A VARA
          </button>
        </div>
      </div>
    </div>
  );
}

