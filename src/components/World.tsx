import { asset } from '../assets';
import { skyPhase, type SkyPhaseId } from '../data/skies';
import type { CastResult } from '../state/types';
import type { Phase } from '../hooks/useFishingLoop';
import { useSettings } from '../state/settings';
import { rodX, zoneRect } from '../editor/scene';
import { rodTip, useFx, type StepId } from '../editor/fx';
import type { FishPose } from '../world/usePlayer';
import { groundAt, PIER_END, PIER_RAMP, PIER_START, WORLD_W } from '../world/layout';
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
 * cabana, treeline e o Juggler. Nada aqui re-renderiza por quadro - câmera e
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
            {/* areia do fundo */}
            <div className="seabed" />
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
          {/* A areia ganhou textura: a peca central do autotile de 47 pecas,
              repetida por cima da rampa de cor. O gradiente continua embaixo
              para a faixa nao virar um tabuleiro de xadrez. */}
          <div
            className="sand"
            style={{
              left: w.shoreX - 60,
              width: WORLD_W - w.shoreX + 160,
              top: w.sandY,
              height: w.sandDepth,
              backgroundImage: `url(${asset('sand/sand_46_11111111')})`,
            }}
          />
          {/* Sobra sob o mundo: duas tiras chapadas na cor com que o fundo do
              mar e a areia terminam, para nao aparecer faixa preta quando a
              camera abre. */}
          <div className="world-spill" style={{ left, width: seaW, top: fundo, background: '#02131f' }} />
          <div
            className="world-spill"
            style={{ left: w.shoreX - 60, width: WORLD_W - w.shoreX + 160, top: w.sandY + w.sandDepth, background: '#a88750' }}
          />

          {/* a areia nao termina num corte reto: desce em rampa para dentro da agua */}
          <div
            className="sand-slope"
            style={{ left: w.shoreX - 460, top: w.sandY, height: Math.max(40, w.sandDepth) }}
          />
          <div className="tide-line" style={{ left: w.shoreX - 300, width: 330, top: w.sandY + 18 }} />

          {/* --------------------------------------------------- o pier */}
          <div
            className="pier-deck"
            style={{
              left: PIER_START - 70,
              width: PIER_END - PIER_START + 80,
              top: w.pierY,
              // tabua do pacote novo de pier, repetida - nunca esticada
              backgroundImage: `url(${asset('pier/deck-long')})`,
            }}
          />
          {/* rampinha do deck para a areia */}
          <div className="pier-ramp" style={{ left: PIER_END, width: PIER_RAMP + 10, top: w.pierY }} />
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
