import { asset } from '../assets';
import { REGIONS } from '../data/regions';
import type { CastResult, RegionId } from '../state/types';
import type { Phase } from '../hooks/useFishingLoop';
import { useSettings } from '../state/settings';
import { rodX, zoneRect } from '../editor/scene';
import { rodTip, useFx, type StepId } from '../editor/fx';
import type { FishPose } from '../world/usePlayer';
import {
  groundAt,
  PIER_END,
  PIER_RAMP,
  PIER_START,
  PIER_Y,
  SAND_Y,
  SHORE_X,
  WATER_Y,
  WORLD_H,
  WORLD_W,
} from '../world/layout';
import { PLAYER_SPRITE_STYLE } from '../world/usePlayer';
import { SceneLayer } from './SceneLayer';
import { FishSprite } from './Sprite';
import { Sky } from './Sky';

interface Props {
  region: RegionId;
  phase: Phase;
  /** momento do lance ja resolvido pelo App (inclui o quadro de arremesso) */
  pose: FishPose;
  pending: CastResult | null;
  fishing: boolean;
  /** onde o Juggler esta: a linha de pesca sai da ponta da vara dele */
  playerXRef: React.MutableRefObject<number>;
  cameraRef: React.MutableRefObject<HTMLDivElement | null>;
  farRef: React.MutableRefObject<HTMLDivElement | null>;
  midRef: React.MutableRefObject<HTMLDivElement | null>;
  playerRef: React.MutableRefObject<HTMLDivElement | null>;
  spriteRef: React.MutableRefObject<HTMLImageElement | null>;
  scale: number;
  /** deslocamento vertical da cena quando o zoom passa da altura da tela */
  viewY: number;
}

/**
 * O mundo inteiro: céu, camadas de parallax, mar aberto, píer, praia, mercado,
 * cabana, treeline e o Juggler. Nada aqui re-renderiza por quadro - câmera e
 * personagem sao movidos direto no DOM pelo `usePlayer`.
 */
export function World({
  region,
  phase,
  pose,
  pending,
  fishing,
  playerXRef,
  cameraRef,
  farRef,
  midRef,
  playerRef,
  spriteRef,
  scale,
  viewY,
}: Props) {
  const settings = useSettings();
  const fx = useFx();
  const p = REGIONS[region].palette;
  const inWater = fishing && (phase === 'waiting' || phase === 'bite' || phase === 'reeling');
  const biting = phase === 'bite';
  const step: StepId = phase === 'result' ? 'result' : pose;

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
  const rigItems = fx.items.filter((i) => !i.point && i.steps.includes(step));

  const mercado = zoneRect('mercado');
  const marketMark = mercado ? mercado.x + mercado.w / 2 : null;

  return (
    <div className="stage">
      <Sky region={region} />

      {/* escala tudo pela altura da tela: o mundo tem sempre 720 de altura.
          Com o zoom de ctrl+roda a cena passa da altura da viewport, entao ela
          tambem e centralizada em vez de ficar colada no topo. */}
      <div
        className="world-scale"
        style={{ transform: `translate3d(0,${viewY}px,0) scale(${scale})` }}
      >
        {/* ------------------------------------------------ fundo distante */}
        <div className="layer" ref={farRef}>
          <div
            className="strip"
            style={{
              backgroundImage: `url(${asset('sky/distant-mountain-strip')})`,
              top: WATER_Y - 96,
              height: 96,
              opacity: 0.55,
            }}
          />
        </div>

        <div className="layer" ref={midRef}>
          <div
            className="strip"
            style={{
              backgroundImage: `url(${asset('sky/distant-island-strip')})`,
              top: WATER_Y - 86,
              height: 92,
              opacity: 0.85,
            }}
          />
          <div
            className="strip"
            style={{
              backgroundImage: `url(${asset('sky/horizon-haze-strip')})`,
              top: WATER_Y - 26,
              height: 40,
              opacity: 0.45,
            }}
          />
        </div>

        {/* ---------------------------------------------------- plano do jogo */}
        <div className="layer" ref={cameraRef}>
          {/* ------------------------------------ o mar, na metade esquerda */}
          <div
            className="sea"
            style={{
              left: -400,
              width: SHORE_X + 400,
              top: WATER_Y,
              height: WORLD_H - WATER_Y,
              background: `linear-gradient(180deg, ${p.seaTop} 0%, ${p.seaTop} 12%, ${p.seaBottom} 78%, #02131f 100%)`,
            }}
          >
            {/* raios de luz atravessando a coluna de agua */}
            {!REGIONS[region].palette.sun.startsWith('#ff2') && (
              <>
                <img className="ray" src={asset('props/light-ray-strip')} alt="" style={{ left: 520, height: 210 }} />
                <img className="ray ray-b" src={asset('props/light-ray-strip')} alt="" style={{ left: 900, height: 180 }} />
                <img className="ray" src={asset('props/light-ray-strip')} alt="" style={{ left: 1300, height: 230 }} />
              </>
            )}
            {/* areia do fundo */}
            <div className="seabed" />
          </div>

          {/* camada de fundo: fundo do mar, vida submersa e detalhe de areia */}
          <SceneLayer layer="fundo" />

          {/* espuma e ondas na linha d agua */}
          <div
            className="surf"
            style={{
              left: -400,
              width: SHORE_X + 400,
              top: WATER_Y - 20,
            }}
          >
            <div className="foam" style={{ backgroundImage: `url(${asset('fx/foam-strip')})` }} />
            <div className="swell" style={{ backgroundImage: `url(${asset('fx/small-wave-strip')})` }} />
            <div className="swell swell-b" style={{ backgroundImage: `url(${asset('fx/large-wave-strip')})` }} />
            <div className="glint" style={{ backgroundImage: `url(${asset('fx/sun-glint-strip')})` }} />
          </div>

          {/* -------------------------------- a terra, da praia para a direita */}
          <div
            className="sand"
            style={{ left: SHORE_X - 60, width: WORLD_W - SHORE_X + 160, top: SAND_Y, height: WORLD_H - SAND_Y }}
          />
          {/* Sobra sob o mundo. Com o zoom afastado a cena fica menor que a
              viewport e sem isso aparecia uma faixa preta embaixo; sao duas
              tiras chapadas na cor com que o fundo do mar e a areia terminam. */}
          <div
            className="world-spill"
            style={{ left: -400, width: SHORE_X + 400, top: WORLD_H, background: '#b8a878' }}
          />
          <div
            className="world-spill"
            style={{ left: SHORE_X - 60, width: WORLD_W - SHORE_X + 160, top: WORLD_H, background: '#a88750' }}
          />

          {/* a areia nao termina num corte reto: desce em rampa para dentro da agua */}
          <div className="sand-slope" style={{ left: SHORE_X - 460, top: SAND_Y }} />
          <div className="tide-line" style={{ left: SHORE_X - 300, width: 330, top: SAND_Y + 18 }} />

          {/* --------------------------------------------------- o pier */}
          <div
            className="pier-deck"
            style={{
              left: PIER_START - 70,
              width: PIER_END - PIER_START + 80,
              top: PIER_Y,
              backgroundImage: `url(${asset('props/pier-board-side')})`,
            }}
          />
          {/* rampinha do deck para a areia */}
          <div className="pier-ramp" style={{ left: PIER_END, width: PIER_RAMP + 10, top: PIER_Y }} />
          {/* cenario: pier, praia, mercado, cabana e a mata do fim do mapa */}
          <SceneLayer layer="cenario" />

          {/* objetos soltos. A vara fincada some quando o Juggler pega a dele:
              a arte da pescaria ja vem com vara na mao. */}
          <SceneLayer layer="objetos" hideRod={fishing} />

          {/* ------------------------------------------- linha, boia, peixe */}
          {inWater && (
            <>
              {/* A linha e desenhada, nao e sprite: assim ela sai EXATAMENTE da
                  ponta da vara e chega EXATAMENTE na boia, com o comprimento e
                  a direcao que a pose pede. Antes era um PNG de tamanho fixo
                  solto perto da agua, que nunca batia com a vara. */}
              <svg className="rig-line-svg" viewBox={`0 0 ${WORLD_W} ${WORLD_H}`} preserveAspectRatio="none">
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
                  transform: it.rot ? `rotate(${it.rot}deg)` : undefined,
                };
                if (it.id === 'peixe-fisgado') {
                  return pending?.fish ? (
                    <div key={it.id} className="rig-item hooked" style={style}>
                      <FishSprite fish={pending.fish} size={Math.min(it.w, it.h)} />
                    </div>
                  ) : null;
                }
                const shake = it.id === 'ondinha' && biting && settings.screenShake ? ' shaking' : '';
                const pulse = it.id === 'anel-mordida' ? ' pulsing' : '';
                const bob = it.id === 'exclamacao' ? ' bobbing' : '';
                return (
                  <img
                    key={it.id}
                    className={`rig-item${shake}${pulse}${bob}`}
                    src={asset(it.sprite)}
                    alt=""
                    style={style}
                  />
                );
              })}
            </>
          )}

          {/* ------------------------------------------------- o Juggler */}
          <div className="player" ref={playerRef}>
            <img
              ref={spriteRef}
              className="player-sprite"
              src={asset('char/side-idle-left/00')}
              alt="Juggler"
              style={PLAYER_SPRITE_STYLE}
            />
            <div className="player-shadow" />
          </div>

          {/* marcador discreto do balcao do mercado, na area definida no editor */}
          {marketMark && <div className="spot-mark" style={{ left: marketMark, top: SAND_Y - 6 }} />}
        </div>
      </div>
    </div>
  );
}
