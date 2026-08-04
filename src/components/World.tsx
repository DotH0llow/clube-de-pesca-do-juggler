import { useEffect, useMemo, useRef } from 'react';
import { asset } from '../assets';
import { skyPhase, type SkyPhaseId } from '../data/skies';
import type { CastResult } from '../state/types';
import type { Phase } from '../hooks/useFishingLoop';
import { useSettings } from '../state/settings';
import { rodX, zoneRect } from '../editor/scene';
import { rodTip, useFx, type StepId } from '../editor/fx';
import type { FishPose } from '../world/usePlayer';
import { groundAt, PIER_END, PIER_START, WORLD_W } from '../world/layout';
import { Runoff, Splashes } from './Rain';
import { WaterSurface } from './WaterSurface';
import { HookHunt } from './HookHunt';
import { useDevFlags } from '../state/dev';

/** A faixa do deck em que a água escorre: a mesma que `world/pier.ts` monta. */
const PIER_X0 = PIER_START - 70;
const PIER_LARG = PIER_END - PIER_X0;

/**
 * Lado do tile de areia em unidades de mundo.
 *
 * A peca do autotile tem 64 px. Desenhar a 32 dobra a densidade da textura, que
 * e o que faz a praia parecer areia e nao um tabuleiro.
 */
const SAND_TILE = 32;

/** As duas peças do autotile que a praia usa. */
const SAND_BORDA = 'sand/sand_12_01110110';
const SAND_CHEIA = 'sand/sand_46_11111111';

/**
 * A GRADE ÚNICA DA AREIA.
 *
 * Isto aqui é o conserto das linhas que cruzavam a praia. A areia era três
 * elementos empilhados - a borda, o corpo e a sobra sob o mundo - e cada um
 * começava a repetir o tile do próprio topo. Como as alturas não eram
 * múltiplas de 32 (a faixa de areia tem 70), o desenho do tile chegava
 * cortado na emenda e recomeçava do zero logo abaixo: o olho lê essa quebra
 * de padrão como uma linha, e havia uma em cada junta.
 *
 * Agora todo pedaço de areia - o corpo, a orla que entra na água, a sobra -
 * declara a fase do tile a partir da posição no MUNDO. É uma grade só, do
 * mesmo jeito que um mapa de tiles de verdade: dois pedaços vizinhos encaixam
 * porque estão na mesma malha, e não porque alguém acertou a altura.
 */
function fase(v: number): number {
  return -(((v % SAND_TILE) + SAND_TILE) % SAND_TILE);
}

function grade(x: number, y: number): string {
  return `${fase(x)}px ${fase(y)}px`;
}

/*
 * A ORLA saiu daqui.
 *
 * Quantas colunas, com que curva, quanto de água rasa, quanta espuma e quanto
 * de areia molhada agora são CONFIGURAÇÃO (`worldConfig`, seção COSTA do
 * editor), e a geometria é calculada em `world/shore.ts`. Números de praia
 * espalhados por um componente de 500 linhas é como se chega num degradê preto
 * sem ninguém perceber.
 */

import { calcularCosta, clareia, corDoMar } from '../world/shore';
import { seaBottom, seaLeft, useWorld, worldBottom } from '../world/worldConfig';
import { PLAYER_SPRITE_STYLE } from '../world/usePlayer';
import { SceneLayer } from './SceneLayer';
import { FishSprite } from './Sprite';
import { Sky } from './Sky';

interface Props {
  /** a hora do dia: manda no ceu e na cor da agua */
  hour: SkyPhaseId;
  phase: Phase;
  /** momento do lance ja resolvido pelo App (inclui o quadro de arremesso) */
  pose: FishPose;
  pending: CastResult | null;
  fishing: boolean;
  /** onde o Juggler esta: a linha de pesca sai da ponta da vara dele */
  playerXRef: React.MutableRefObject<number>;
  cameraRef: React.MutableRefObject<HTMLDivElement | null>;
  worldRef: React.MutableRefObject<HTMLDivElement | null>;
  shadowRef: React.MutableRefObject<HTMLDivElement | null>;
  farRef: React.MutableRefObject<HTMLDivElement | null>;
  midRef: React.MutableRefObject<HTMLDivElement | null>;
  playerRef: React.MutableRefObject<HTMLDivElement | null>;
  spriteRef: React.MutableRefObject<HTMLImageElement | null>;
  scale: number;
  /** deslocamento vertical da cena, calculado pelo enquadramento */
  viewY: number;
  /** a cacada esta rodando: o anzol e o peixe entram na cena */
  hunt?: { alvo: CastResult; onCatch: () => void; onGiveUp: () => void } | null;
}

/**
 * O mundo inteiro: céu, camadas de parallax, mar aberto, píer, praia, mercado,
 * cabana, mata e o Juggler. Nada aqui re-renderiza por quadro - câmera e
 * personagem sao movidos direto no DOM pelo `usePlayer`.
 *
 * Toda a geometria do cenário (linha d'água, profundidade, largura da água,
 * faixa de areia, ritmo das ondas) sai de `worldConfig`, que a seção MUNDO do
 * editor edita. Aqui não há número de mar escrito na mão.
 */
export function World({
  hour,
  phase,
  pose,
  pending,
  fishing,
  playerXRef,
  cameraRef,
  worldRef,
  shadowRef,
  farRef,
  midRef,
  playerRef,
  spriteRef,
  scale,
  viewY,
  hunt = null,
}: Props) {
  const settings = useSettings();
  const fx = useFx();
  const w = useWorld();
  const dev = useDevFlags();
  /** posicao do anzol na cacada, escrita por quadro pelo `HookHunt` */
  const anzolRef = useRef({ x: 0, y: 0 });
  const linhaRef = useRef<SVGSVGElement | null>(null);
  // mesma regra do céu: o interruptor de teste manda; sem ele, a hora do dia
  const chovendo = dev.rain === null ? skyPhase(hour).storm : dev.rain;
  const sky = skyPhase(hour);
  const p = sky.palette;
  const inWater = fishing && (phase === 'waiting' || phase === 'bite' || phase === 'reeling');
  const biting = phase === 'bite';
  const step: StepId = phase === 'result' ? 'result' : pose;

  const left = seaLeft();
  const seaW = w.shoreX - left;
  const fundo = seaBottom();
  const chao = worldBottom();

  /*
   * A LINHA DE COSTA, calculada uma vez e usada por todas as camadas.
   *
   * `calcularCosta` devolve o perfil da areia e, derivados dele, os recortes da
   * massa de areia, da faixa de água rasa, da areia molhada e o traço da
   * espuma. Nenhuma dessas formas é gerada em separado - quatro geradores
   * independentes desalinham no primeiro ajuste de `sandY`, e o desalinho
   * aparece como costura branca entre as camadas.
   *
   * Ver `world/shore.ts` para o porquê de cada parte, inclusive o do degradê
   * preto que estava aqui antes.
   */
  const costa = useMemo(() => calcularCosta(w), [w]);

  // ------------------------------------------------ apetrecho (linha e boia)
  // Ancora da boia e ponta da vara saem da configuracao de mecanicas: e o que o
  // editor edita na secao MECANICAS, entao o jogo desenha o que voce ajustou.
  const bobberX = rodX() + fx.timings.bobberDx;
  const bobberY = fx.timings.bobberY;
  const tip = rodTip(pose);
  const px = playerXRef.current;
  const tipX = px + tip.x;
  const tipY = groundAt(px) + tip.y;
  const sag = phase === 'reeling' ? 0 : fx.timings.lineSag;
  const rigItems = fx.items.filter((i) => !i.point && !i.off && i.steps.includes(step));

  const mercado = zoneRect('mercado');
  const marketMark = mercado ? mercado.x + mercado.w / 2 : null;

  /*
   * A linha da cacada, quadro a quadro.
   *
   * O `path` e reescrito direto no DOM em vez de sair de um render: o anzol se
   * move sessenta vezes por segundo e um `setState` por quadro colocaria a
   * cena inteira para re-renderizar junto com ele.
   */
  useEffect(() => {
    if (!hunt) return;
    let raf = 0;
    const desenha = () => {
      const path = linhaRef.current?.querySelector('path');
      if (path) {
        const a = anzolRef.current;
        const meioX = (tipX + a.x) / 2;
        const meioY = (tipY + a.y) / 2 + sag * 0.4;
        path.setAttribute('d', `M ${tipX} ${tipY} Q ${meioX} ${meioY} ${a.x} ${a.y}`);
      }
      raf = requestAnimationFrame(desenha);
    };
    raf = requestAnimationFrame(desenha);
    return () => cancelAnimationFrame(raf);
  }, [hunt, tipX, tipY, sag]);

  return (
    <div className="stage">
      <Sky hour={hour} />

      {/* O mundo é escalado pelo ENQUADRAMENTO, não pela altura total: a cena
          tem 720 unidades de moldura e um mar muito mais fundo embaixo dela.
          `viewY` vem do `usePlayer` e é o que mantém a linha d'água parada na
          tela quando a câmera abre no píer. */}
      <div
        className="world-scale"
        ref={worldRef}
        style={{ transform: `translate3d(0,${viewY}px,0) scale(${scale})` }}
      >
        {/* Horizonte. As faixas sao objetos de cena como qualquer outro - dao
            para esconder, mover e trocar no editor - e so ficam em containers
            proprios porque andam mais devagar que a camera. */}
        <div className="layer" ref={farRef}>
          <SceneLayer scene="mundo" band="longe" />
        </div>

        <div className="layer" ref={midRef}>
          <SceneLayer scene="mundo" band="meio" />
        </div>

        {/* ---------------------------------------------------- plano do jogo */}
        <div className="layer" ref={cameraRef}>
          {/* ------------------------------------ o mar, na metade esquerda */}
          <div
            className="sea"
            style={{
              left,
              width: seaW,
              top: w.waterY,
              height: w.seaDepth,
              background: `linear-gradient(180deg, ${p.seaTop} 0%, ${p.seaTop} 4%, ${p.seaBottom} 42%, #02131f 100%)`,
            }}
          >
            {/* OS RAIOS DE LUZ SAIRAM.

                Eram tres copias de `props/light-ray-strip` penduradas na
                coluna de agua, balancando em `ray-sway`. O sprite e uma faixa
                de listras verticais claras, e esticado na altura do mar ele
                nao lia como luz atravessando agua - lia como risco vertical
                por cima do azul, que e o que o print mostrava. Nao ha
                substituto aqui de proposito: a agua ja tem a rampa de cor e a
                superficie desenhada, e enfeite que nao le como o que promete e
                pior do que ausencia.

                O sprite continua no pacote, para quem quiser jogar um na cena
                pelo editor e posicionar na mao. */}
            {/* Areia do fundo do mar: o mesmo autotile da praia, escurecido
                pela agua. Era um gradiente bege desbotando para cima. */}
            <div
              className="seabed"
              style={{ backgroundImage: `url(${asset('sand/sand_12_01110110')})` }}
            />
          </div>

          {/* A SUPERFICIE DA AGUA.

              Eram quatro faixas repetidas deslizando em `background-position`.
              O problema nao era a arte: uma imagem que desliza so TRANSLADA -
              nenhuma crista nasce, nenhuma morre, e o olho pega o periodo. E
              como as quatro andavam em velocidades diferentes, o conjunto lia
              como quatro adesivos escorregando.

              Agora e uma linha desenhada por quadro, soma de quatro senoides
              com comprimentos incomensuraveis e metade delas indo para tras -
              ver `WaterSurface`. */}
          {/* A crista da onda termina na COSTA, e não no fim da caixa d'água.

              `shoreX` é a borda direita do retângulo do mar; a água de verdade
              acaba onde o perfil da areia cruza a linha d'água, umas duas
              colunas antes. Desenhar a crista até `shoreX` a fazia passar por
              cima da praia molhada. */}
          <WaterSurface
            left={left}
            width={Math.max(80, costa.costaX - left)}
            top={w.waterY - w.waveLift * 0.5}
            altura={w.waveH}
            corAgua={p.seaTop}
            profundidade={160}
            espuma={w.foamOpacity}
            fundo={w.swellOpacity}
            segundos={w.swellSeconds}
          />

          {/* -------------------------------- a terra, da praia para a direita */}
          {/* A areia e AUTOTILE, e nao mais um gradiente com um tile por cima.

              O pacote tem as 47 pecas de um blob autotile; o que estava em uso
              era so a peca cheia (`46`), esticada sobre uma rampa de cor que
              fazia o servico de verdade. Agora a borda de cima usa a peca de
              BORDA (`12`, sem vizinho ao norte) e o corpo usa a cheia. Nao ha
              mais gradiente nenhum aqui: a luz da areia e a que veio desenhada
              no tile.

              A PRAIA É UM CORPO SÓ, e é por isso que ela não tem mais linha
              atravessada. Eram três elementos - borda, corpo e sobra sob o
              mundo - cada um repetindo o tile a partir do próprio topo. Com
              alturas que não são múltiplas de 32 (a faixa de areia tem 70), o
              tile chegava cortado na emenda e recomeçava inteiro logo abaixo:
              é essa quebra de padrão que se via como risco na areia, uma por
              junta. Agora o corpo vai do topo da praia até o fundo do mundo de
              uma vez, e a fase do tile sai da posição no mundo (`grade`). */}
          <div
            className="sand"
            style={{
              left: w.shoreX - 60,
              width: WORLD_W - w.shoreX + 160,
              top: w.sandY,
              height: Math.max(0, chao + 420 - w.sandY),
              backgroundImage: `url(${asset(SAND_CHEIA)})`,
              backgroundPosition: grade(w.shoreX - 60, w.sandY),
            }}
          />
          <div
            className="sand-top"
            style={{
              left: w.shoreX - 60,
              width: WORLD_W - w.shoreX + 160,
              top: w.sandY,
              backgroundImage: `url(${asset(SAND_BORDA)})`,
              backgroundPositionX: `${fase(w.shoreX - 60)}px`,
            }}
          />
          {/* Sobra sob o mundo: a agua termina numa tira chapada, porque nao ha
              o que desenhar no breu do fundo. A areia nao precisa mais de
              sobra - o corpo dela ja desce ate embaixo. */}
          <div className="world-spill" style={{ left, width: seaW, top: fundo, background: '#02131f' }} />

          {/* ================================================== A COSTA

              Cinco camadas, todas recortadas pelo MESMO perfil (`costa`), na
              ordem: areia submersa, bandas de profundidade, água rasa, areia
              molhada e espuma. O que saiu daqui foi o `.shore-veil` - um
              degradê vertical que ia de transparente a `#02131f` em 460
              unidades. Ele é o "degradê preto" do relato, e o defeito dele é
              aritmético: a rampa do MAR só chega nessa cor a 2 088 unidades de
              profundidade, então a beirada da praia ficava preta enquanto o mar
              aberto ao lado dela, na mesma altura, continuava azul médio. */}

          {/* 1. A MASSA DE AREIA SUBMERSA, com o tile de sempre.

              Uma peça só recortada pelo perfil. Era 22 divs lado a lado, e
              borda de elemento em escala fracionária cai entre pixels: à noite
              cada emenda virava um risco vertical da superfície ao fundo. */}
          <div
            className="sand-orla"
            style={{
              left: costa.caixa.x,
              top: costa.caixa.y,
              width: costa.caixa.w,
              height: costa.caixa.h,
              backgroundImage: `url(${asset(SAND_CHEIA)})`,
              backgroundPosition: grade(costa.caixa.x, costa.caixa.y),
              clipPath: costa.areia,
            }}
          >
            {/* 2. AS BANDAS DE PROFUNDIDADE.

                Cinco degraus de cor, sem interpolação, cada um na cor que a
                ÁGUA tem naquela profundidade. É isso que faz a areia sumir sem
                escurecer: a beirada da praia passa a combinar com o mar aberto
                que está do lado dela, porque as duas usam a mesma rampa.

                Elas são filhas do elemento recortado, então herdam o recorte -
                não há como uma banda vazar para fora da areia. */}
            {costa.faixas.map((f) => (
              <i
                key={f.topo}
                className="orla-faixa"
                style={{
                  top: f.topo,
                  height: f.alt,
                  // a banda para na COSTA: para a direita dela o que existe é
                  // subsolo de praia seca, e não fundo de mar
                  width: costa.faixaLarg,
                  background: corDoMar(f.profundidade, p, w.seaDepth),
                  opacity: f.alfa,
                }}
              />
            ))}
          </div>

          {/* 3. A ÁGUA RASA, em duas bandas discretas.

              A de trás é mais grossa e mais apagada; a da frente é fina e mais
              clara. Duas faixas chapadas em vez de um degradê: é assim que água
              rasa se desenha em pixel art, e é o que deixa ver a areia por
              baixo em vez de cobri-la. */}
          <div
            className="mar-raso fundo"
            style={{
              left: costa.caixa.x,
              top: costa.caixa.y,
              width: costa.caixa.w,
              height: costa.caixa.h,
              background: clareia(p.seaTop, 0.12),
              opacity: w.shoreRasoAlfa * 0.55,
              clipPath: costa.rasoFundo,
            }}
          />
          <div
            className="mar-raso"
            style={{
              left: costa.caixa.x,
              top: costa.caixa.y,
              width: costa.caixa.w,
              height: costa.caixa.h,
              background: clareia(p.seaTop, 0.34),
              opacity: w.shoreRasoAlfa,
              clipPath: costa.raso,
            }}
          />

          {/* 4. A AREIA MOLHADA.

              Uma camada de cor por cima do tile de areia, e não uma textura
              nova: o asset original continua aparecendo por baixo, que é o
              ponto. A cor é a própria areia rebaixada e dessaturada - nunca
              preto nem cinza, que é o que faria a faixa ler como sombra. */}
          <div
            className="areia-molhada"
            style={{
              left: costa.caixa.x,
              top: costa.caixa.y,
              width: costa.caixa.w,
              height: costa.caixa.h,
              opacity: w.shoreMolhadaAlfa,
              clipPath: costa.molhada,
            }}
          />

          {/* 5. A ESPUMA.

              Um traço sobre o perfil, quebrado por `stroke-dasharray` em
              pedaços de tamanhos diferentes - linha branca contínua ao longo da
              costa é o defeito clássico de praia em 2D. São duas camadas com
              padrões e fases diferentes; a animação sobe alguns pixels na
              areia, fragmenta, apaga e recua, em vez de deslizar de lado. */}
          <svg
            className="espuma"
            style={{
              left: costa.caixa.x,
              top: costa.caixa.y,
              width: costa.caixa.w,
              height: costa.caixa.h,
              // @ts-expect-error variavel de CSS
              '--onda': `${w.shoreEspumaOnda}px`,
              '--onda-seg': `${w.shoreEspumaSeg}s`,
            }}
            viewBox={`0 0 ${costa.caixa.w} ${costa.caixa.h}`}
            shapeRendering="crispEdges"
            aria-hidden
          >
            <path className="espuma-a" d={costa.espuma} strokeWidth={w.shoreEspuma} />
            <path className="espuma-b" d={costa.espuma} strokeWidth={Math.max(2, w.shoreEspuma - 3)} />
          </svg>

          {/* 6. A SOMBRA DO PÍER, em camada própria.

              Ela existe porque o cais tapa o sol, e não porque a praia precisa
              de uma emenda escura - e é justamente por isso que fica separada:
              enquanto a transição água/areia era um degradê vertical escuro,
              não havia como distinguir uma coisa da outra na tela.

              Três faixas empilhadas, cada uma mais rala que a anterior, com
              padrão de xadrez em vez de esmaecimento contínuo. Dithering é como
              pixel art faz meio-tom; um degradê suave aqui brigaria com o resto
              da cena. Ela atravessa água E areia (o cais passa por cima das
              duas) e termina no meio da praia, longe da linha da costa. */}
          {chovendo || sky.night ? null : (
            <div
              className="sombra-pier"
              style={{
                left: PIER_X0 + 26,
                width: PIER_LARG,
                top: w.pierY + 26,
                opacity: w.shoreSombraPier,
              }}
            >
              <i className="densa" />
              <i className="media" />
              <i className="rala" />
            </div>
          )}

          {/* --------------------------------------------------- o pier */}
          {/* O deck e a rampa saíram daqui.

              Eram uma DIV com a tabua repetida no fundo e uma cunha de
              gradiente fazendo de rampa. Agora o cais inteiro - tabuado,
              testeira, viga, estaca, travessa, mao-francesa, corrimao e rampa -
              e cena de verdade, semeada em `world/pier.ts`, e entra logo abaixo
              junto com todo o resto. */}
          {/* A cena inteira numa passada so: quem fica na frente de quem sai da
              profundidade de cada objeto, nao da ordem deste arquivo. A vara
              fincada some quando o Juggler pega a dele - a arte da pescaria ja
              vem com uma na mao. */}
          <SceneLayer scene="mundo" hideRod={fishing} />

          {/* A LINHA durante a cacada sai da ponta da vara e chega no anzol,
              onde quer que ele esteja. Ela e redesenhada por quadro no proprio
              elemento, e nao por render do React. */}
          {hunt && (
            <svg
              className="rig-line-svg"
              ref={linhaRef}
              style={{ left, top: 0, width: WORLD_W - left, height: chao }}
              viewBox={`${left} 0 ${WORLD_W - left} ${chao}`}
              preserveAspectRatio="none"
            >
              <path fill="none" stroke="rgba(255,255,255,0.75)" strokeWidth={fx.timings.lineWidth} />
            </svg>
          )}

          {/* ------------------------------------------- linha, boia, peixe */}
          {inWater && (
            <>
              {/* A linha e desenhada, nao e sprite: assim ela sai EXATAMENTE da
                  ponta da vara e chega EXATAMENTE na boia, com o comprimento e
                  a direcao que a pose pede. */}
              <svg
                className="rig-line-svg"
                style={{ left, top: 0, width: WORLD_W - left, height: chao }}
                viewBox={`${left} 0 ${WORLD_W - left} ${chao}`}
                preserveAspectRatio="none"
              >
                <path
                  d={`M ${tipX} ${tipY} Q ${(tipX + bobberX) / 2} ${(tipY + bobberY) / 2 + sag} ${bobberX} ${bobberY}`}
                  fill="none"
                  stroke="rgba(255,255,255,0.75)"
                  strokeWidth={fx.timings.lineWidth}
                />
              </svg>

              {rigItems.map((it) => {
                const style: React.CSSProperties = {
                  left: bobberX + it.x,
                  top: bobberY + it.y,
                  width: it.w,
                  height: it.h,
                  opacity: it.opacity,
                  zIndex: 80 + (it.z ?? 0),
                  transform: it.rot ? `rotate(${it.rot}deg)` : undefined,
                };
                if (it.kind === 'peixe') {
                  return pending?.fish ? (
                    <div key={it.id} className="rig-item hooked" style={style}>
                      <FishSprite fish={pending.fish} size={Math.min(it.w, it.h)} />
                    </div>
                  ) : null;
                }
                const shake = it.wave && biting && settings.screenShake ? ' shaking' : '';
                const anim = it.anim ? ` ${it.anim}` : '';
                return (
                  <img
                    key={it.id}
                    className={`rig-item${shake}${anim}`}
                    src={asset(it.sprite)}
                    alt=""
                    style={style}
                  />
                );
              })}
            </>
          )}

          {/* A CACADA: o anzol guiado e o peixe que ele persegue.

              Mora aqui dentro, na camada da camera, porque anzol e peixe tem
              posicao no MUNDO - eles precisam andar junto com a cena quando a
              camera desce atras deles. */}
          {hunt && (
            <HookHunt
              alvo={hunt.alvo}
              onCatch={hunt.onCatch}
              onGiveUp={hunt.onGiveUp}
              hookRef={anzolRef}
            />
          )}

          {/* O QUE ESCORRE DO DECK.

              Fica aqui, e não junto da chuva, porque é coisa de MUNDO: pinga
              de uma borda específica - a testeira do píer - e tem de andar
              junto com a câmera. A chuva é de tela e cai na frente de tudo. */}
          {chovendo && <Runoff left={PIER_X0} width={PIER_LARG} top={w.pierY + 14} />}

          {/* O RESPINGO também é de mundo, e pela mesma razão - só que a borda
              dele é o CHÃO. Ele mora aqui porque precisa das caixas de piso da
              cena para saber onde há o que molhar; na camada da chuva, que é
              de tela, ele batia no rodapé da janela e pronto. */}
          {chovendo && <Splashes />}

          {/* ------------------------------------------------- o Juggler */}
          {/* A sombra e irma do personagem, nao filha: assim ela fica no chao
              enquanto ele pula, encolhendo conforme ganha altura. */}
          <div className="player-shadow" ref={shadowRef} />
          <div className="player" ref={playerRef}>
            <img
              ref={spriteRef}
              className="player-sprite"
              src={asset('char/juggler/side-idle-left/00')}
              alt="Juggler"
              style={PLAYER_SPRITE_STYLE}
            />
          </div>

          {/* marcador discreto do balcao do mercado, na area definida no editor */}
          {marketMark && <div className="spot-mark" style={{ left: marketMark, top: w.sandY - 6 }} />}
        </div>
      </div>
    </div>
  );
}
