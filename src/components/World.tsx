import { useMemo } from 'react';
import { asset } from '../assets';
import { skyPhase, type SkyPhaseId } from '../data/skies';
import type { CastResult } from '../state/types';
import type { Phase } from '../hooks/useFishingLoop';
import { useSettings } from '../state/settings';
import { rodX, zoneRect } from '../editor/scene';
import { rodTip, useFx, type StepId } from '../editor/fx';
import type { FishPose } from '../world/usePlayer';
import { groundAt, WORLD_W } from '../world/layout';

/**
 * Lado do tile de areia em unidades de mundo.
 *
 * A peca do autotile tem 64 px. Desenhar a 32 dobra a densidade da textura, que
 * e o que faz a praia parecer areia e nao um tabuleiro.
 */
const SAND_TILE = 32;
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
}: Props) {
  const settings = useSettings();
  const fx = useFx();
  const w = useWorld();
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
   * A escadinha de areia que entra na agua.
   *
   * Doze degraus de um tile cada, descendo para a esquerda a partir da orla.
   * O ultimo mergulha bem abaixo da linha d'agua, e a agua (que e desenhada
   * depois, com transparencia) cobre o pe da escada - o que se ve e a praia
   * afundando, e nao um corte.
   */
  const degraus = useMemo(() => {
    const list: { x: number; y: number; h: number }[] = [];
    for (let n = 0; n < 12; n++) {
      const x = w.shoreX - 60 - (n + 1) * SAND_TILE;
      const y = w.sandY + n * 14;
      list.push({ x, y, h: Math.max(SAND_TILE, w.sandDepth + n * 22) });
    }
    return list;
  }, [w.shoreX, w.sandY, w.sandDepth]);

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
            {/* raios de luz atravessando a coluna de agua */}
            {!sky.night && (
              <>
                <img className="ray" src={asset('props/light-ray-strip')} alt="" style={{ left: 520 - left, height: w.seaDepth * 0.42 }} />
                <img className="ray ray-b" src={asset('props/light-ray-strip')} alt="" style={{ left: 900 - left, height: w.seaDepth * 0.34 }} />
                <img className="ray" src={asset('props/light-ray-strip')} alt="" style={{ left: 1300 - left, height: w.seaDepth * 0.46 }} />
              </>
            )}
            {/* Areia do fundo do mar: o mesmo autotile da praia, escurecido
                pela agua. Era um gradiente bege desbotando para cima. */}
            <div
              className="seabed"
              style={{ backgroundImage: `url(${asset('sand/sand_12_01110110')})` }}
            />
          </div>

          {/* espuma e ondas na linha d agua */}
          <div
            className="surf"
            style={{ left, width: seaW, top: w.waterY - w.waveLift, height: w.waveH }}
          >
            <div
              className="foam"
              style={{
                backgroundImage: `url(${asset('fx/foam-strip')})`,
                opacity: w.foamOpacity,
                animationDuration: `${w.foamSeconds * 2.8}s`,
              }}
            />
            <div
              className="swell"
              style={{
                backgroundImage: `url(${asset('fx/small-wave-strip')})`,
                opacity: w.swellOpacity,
                animationDuration: `${w.swellSeconds}s`,
              }}
            />
            <div
              className="swell swell-b"
              style={{
                backgroundImage: `url(${asset('fx/large-wave-strip')})`,
                opacity: w.swellOpacity * 0.8,
                animationDuration: `${w.swellSeconds * 1.9}s`,
              }}
            />
            <div
              className="glint"
              style={{
                backgroundImage: `url(${asset('fx/sun-glint-strip')})`,
                opacity: w.glintOpacity,
              }}
            />
          </div>

          {/* -------------------------------- a terra, da praia para a direita */}
          {/* A areia e AUTOTILE, e nao mais um gradiente com um tile por cima.

              O pacote tem as 47 pecas de um blob autotile; o que estava em uso
              era so a peca cheia (`46`), esticada sobre uma rampa de cor que
              fazia o servico de verdade. Agora a borda de cima usa a peca de
              BORDA (`12`, sem vizinho ao norte) e o corpo usa a cheia. Nao ha
              mais gradiente nenhum aqui: a luz da areia e a que veio desenhada
              no tile. */}
          <div
            className="sand-top"
            style={{
              left: w.shoreX - 60,
              width: WORLD_W - w.shoreX + 160,
              top: w.sandY,
              backgroundImage: `url(${asset('sand/sand_12_01110110')})`,
            }}
          />
          <div
            className="sand"
            style={{
              left: w.shoreX - 60,
              width: WORLD_W - w.shoreX + 160,
              top: w.sandY + SAND_TILE,
              height: Math.max(0, w.sandDepth - SAND_TILE),
              backgroundImage: `url(${asset('sand/sand_46_11111111')})`,
            }}
          />
          {/* Sobra sob o mundo: a agua termina numa tira chapada (nao ha o que
              desenhar no breu do fundo) e a areia continua com o proprio tile,
              para nao aparecer faixa lisa quando a camera abre. */}
          <div className="world-spill" style={{ left, width: seaW, top: fundo, background: '#02131f' }} />
          <div
            className="world-spill sand"
            style={{
              left: w.shoreX - 60,
              width: WORLD_W - w.shoreX + 160,
              top: w.sandY + w.sandDepth,
              backgroundImage: `url(${asset('sand/sand_46_11111111')})`,
            }}
          />

          {/* A beira da praia desce em DEGRAU, tile por tile.

              Era uma cunha de gradiente cortada em diagonal - a unica coisa no
              cenario com borda perfeitamente reta, que berrava no meio do
              pixel art. Cada degrau aqui e a peca de borda em cima e a peca
              cheia embaixo: a mesma areia do resto da praia, descendo para
              dentro da agua. */}
          {degraus.map((d) => (
            <div key={d.x} className="sand-degrau" style={{ left: d.x, top: d.y, width: SAND_TILE }}>
              <div
                className="sand-top"
                style={{ backgroundImage: `url(${asset('sand/sand_12_01110110')})` }}
              />
              <div
                className="sand"
                style={{
                  top: SAND_TILE,
                  height: d.h,
                  backgroundImage: `url(${asset('sand/sand_46_11111111')})`,
                }}
              />
            </div>
          ))}
          {/* a linha de mare e a espuma do proprio jogo, e nao um degrade */}
          <div
            className="tide-line"
            style={{
              left: w.shoreX - 380,
              width: 420,
              top: w.sandY + 6,
              backgroundImage: `url(${asset('fx/foam-strip')})`,
            }}
          />

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

          {/* ------------------------------------------------- o Juggler */}
          {/* A sombra e irma do personagem, nao filha: assim ela fica no chao
              enquanto ele pula, encolhendo conforme ganha altura. */}
          <div className="player-shadow" ref={shadowRef} />
          <div className="player" ref={playerRef}>
            <img
              ref={spriteRef}
              className="player-sprite"
              src={asset('char/side-idle-left/00')}
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
