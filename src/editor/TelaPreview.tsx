import { useMemo } from 'react';
import { CastBar } from '../components/CastBar';
import { CatchPopup } from '../components/CatchPopup';
import { HuntHud } from '../components/HookHunt';
import { DevPanel } from '../components/DevPanel';
import { MarketApp } from '../components/MarketPanel';
import { ShopApp } from '../components/ShopPanel';
import { AlbumApp } from '../components/AlbumPanel';
import { AchievementsApp } from '../components/AchievementsPanel';
import { ControlsApp } from '../components/ControlsPanel';
import { SettingsApp } from '../components/SettingsPanel';
import { Phone } from '../components/Phone';
import { ReelMinigame } from '../components/ReelMinigame';
import { Sheet } from '../components/Sheet';
import { Sprite } from '../components/Sprite';
import {
  BonusSchoolSummary,
  CashOutModal,
  LuckyCardPicker,
  PrizeLadderModal,
} from '../components/casino/CasinoModals';
import { FISH } from '../data/fish';
import { LUCKY_CARDS } from '../data/luckyCards';
import type { CastResult } from '../state/types';
import type { Outcome } from '../hooks/useFishingLoop';
import { abrirTela, useTelaAberta } from './telas';

/**
 * A TELA ESCOLHIDA, DESENHADA DE VERDADE.
 *
 * Não é uma maquete: é o mesmo componente que o jogo monta, com o mesmo CSS.
 * Uma maquete seria mais fácil de escrever e mentiria na primeira vez que
 * alguém mexesse na tela de verdade sem lembrar de mexer na cópia.
 *
 * O que muda é só a ENTRADA. Cada tela precisa de um pedaço de estado de jogo
 * para desenhar - um peixe capturado, uma sequência de moedas pendentes, um
 * cardume terminando - e provocar esse estado no jogo é justamente o trabalho
 * que esta seção existe para evitar. Então os dados são de mentira, e ficam
 * todos aqui, num lugar só.
 *
 * As telas que leem a partida (mercado, loja, álbum, conquistas) aparecem com
 * o SAVE DE VERDADE, porque para elas isso é mais útil do que qualquer
 * invenção: é o conteúdo que você vai ver jogando.
 */

/** Um peixe qualquer do pacote, para as telas de resultado. */
function peixeDeMentira(): CastResult {
  const fish = FISH.find((f) => f.rarity === 'raro') ?? FISH[0];
  return {
    category: 'raro',
    headline: 'PEIXE NA LINHA!',
    fish,
    value: 640,
    eyes: 0,
    difficulty: 0.5,
    weight: 3.2,
    length: 48,
    pityTriggered: false,
  };
}

function resultadoDeMentira(pegou: boolean): Outcome {
  const result = peixeDeMentira();
  return {
    result: pegou ? result : { ...result, headline: 'NEM UM TOQUE NA LINHA.' },
    landed: pegou,
    unlocks: { achievements: [], families: [], newSpecies: false },
    escapeText: pegou ? undefined : 'A linha bateu na estaca e arrebentou.',
  };
}

const NADA = () => undefined;

export function TelaPreview() {
  const aberta = useTelaAberta();
  const fake = useMemo(() => resultadoDeMentira(true), []);
  const falha = useMemo(() => resultadoDeMentira(false), []);
  const fechar = () => abrirTela(null);

  if (!aberta) return null;

  /*
   * A tela fica ACIMA do editor, e o editor continua clicável atrás dela -
   * é para isso que ela está aberta: mexer no painel e ver a janela mudar.
   */
  const moldura = (conteudo: React.ReactNode) => (
    <div className="tela-previa">
      <div className="tela-previa-tag">
        PRÉVIA · dados de mentira
        <button className="ebtn" onClick={fechar}>
          FECHAR
        </button>
      </div>
      {conteudo}
    </div>
  );

  switch (aberta) {
    case 'castbar':
      return moldura(
        <div className="tela-previa-hud">
          <CastBar onLock={NADA} />
        </div>,
      );
    case 'hunt':
      return moldura(
        <div className="tela-previa-hud">
          <HuntHud onGiveUp={fechar} />
        </div>,
      );
    case 'reel':
      return moldura(
        <div className="tela-previa-hud">
          <ReelMinigame target={peixeDeMentira()} onDone={fechar} />
        </div>,
      );
    case 'catch':
      return moldura(<CatchPopup outcome={fake} onAgain={fechar} onStop={fechar} />);
    case 'catch-falha':
      return moldura(<CatchPopup outcome={falha} onAgain={fechar} onStop={fechar} />);

    case 'mercado':
      return moldura(
        <Sheet tela="mercado" title="MERCADO DE PEIXE" onClose={fechar}>
          <MarketApp onPaid={NADA} />
        </Sheet>,
      );
    case 'loja':
      return moldura(
        <Sheet tela="loja" title="LOJA DE EQUIPAMENTO" onClose={fechar}>
          <ShopApp />
        </Sheet>,
      );
    case 'album':
      return moldura(
        <Sheet tela="album" title="ÁLBUM DE ESPÉCIES" onClose={fechar}>
          <AlbumApp />
        </Sheet>,
      );
    case 'conquistas':
      return moldura(
        <Sheet tela="conquistas" title="CONQUISTAS" onClose={fechar}>
          <AchievementsApp />
        </Sheet>,
      );
    case 'controles':
      return moldura(
        <Sheet tela="controles" title="COMO JOGAR" onClose={fechar}>
          <ControlsApp />
        </Sheet>,
      );
    case 'config':
      return moldura(
        <Sheet tela="config" title="CONFIGURAÇÕES" onClose={fechar}>
          <SettingsApp />
        </Sheet>,
      );

    case 'cashout':
      return moldura(<CashOutModal onClose={fechar} />);
    case 'escada':
      return moldura(<PrizeLadderModal baseValue={500} onClose={fechar} />);
    case 'carta':
      return moldura(<LuckyCardPicker cards={LUCKY_CARDS.slice(0, 3)} />);
    case 'cardume':
      return moldura(
        <BonusSchoolSummary
          summary={{ catches: 7, coinsSecured: 4200, coinsBonus: 1800, bestMultiplier: 3 }}
          onClose={fechar}
        />,
      );

    case 'celular':
      return moldura(<Phone onClose={fechar} />);
    case 'dev':
      return moldura(<DevPanel onClose={fechar} />);

    case 'encerrar':
      return moldura(
        <Sheet tela="encerrar" title="ENCERRAR O DIA 3" onClose={fechar}>
          <div className="daily-body">
            <div className="flavor">
              A vara fica guardada e o cais amanhece de novo. O que você pescou continua no álbum.
            </div>
            <div className="reward-line">
              <span style={{ color: 'var(--coin)' }}>128 lançamentos até aqui</span>
            </div>
            <button className="btn primary" onClick={fechar}>
              DORMIR · COMEÇAR O DIA 4
            </button>
            <button className="btn ghost" onClick={fechar}>
              AINDA NÃO
            </button>
          </div>
        </Sheet>,
      );

    case 'diario':
      return moldura(
        <div className="modal-backdrop">
          <div className="sheet daily">
            <div className="sheet-body daily-body">
              <div className="headline" style={{ color: 'var(--coin)' }}>
                BOM DIA, PESCADOR
              </div>
              <Sprite path="sky/setting-sun" size={92} />
              <div className="flavor">
                Dia 3 seguido no cais. O clube guardou uma ajuda pra você.
              </div>
              <button className="btn primary" onClick={fechar}>
                PEGAR
              </button>
            </div>
          </div>
        </div>,
      );

    default:
      return null;
  }
}
