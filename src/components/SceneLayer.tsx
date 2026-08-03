import { memo } from 'react';
import { asset } from '../assets';
import { useScene } from '../editor/scene';
import type { LayerId, SceneObject } from '../editor/types';

/**
 * Desenha uma camada da cena. O jogo e o editor leem a MESMA lista de objetos,
 * entao o que voce move no editor e o que aparece no jogo.
 *
 * Cada objeto e um div posicionado (posicao, tamanho, rotacao) com a imagem
 * dentro. A separacao existe para as animacoes de CSS (cardume, bolha, barco)
 * poderem usar transform sem brigar com a rotacao do objeto.
 */
function ObjectView({ o }: { o: SceneObject }) {
  const rot = o.rot;
  const style: React.CSSProperties = {
    left: o.x,
    top: o.y,
    width: o.w,
    height: o.h,
    opacity: o.opacity,
    transform: `${rot ? `rotate(${rot}deg)` : ''}${o.flip ? ' scaleX(-1)' : ''}` || undefined,
  };

  // a treeline nao e sprite: e uma massa de mata desenhada em CSS
  if (!o.sprite) {
    return <div className={`wobj ${o.anim ?? ''}`} data-obj={o.id} style={style} />;
  }

  return (
    <div className={`wobj${o.role === 'vara' ? ' rod-obj' : ''}`} data-obj={o.id} style={style}>
      <img
        className={`wobj-img${o.under ? ' under-tint' : ''}${o.anim ? ` ${o.anim}` : ''}`}
        src={asset(o.sprite)}
        alt=""
        draggable={false}
      />
    </div>
  );
}

export const SceneLayer = memo(function SceneLayer({
  layer,
  hideRod = false,
}: {
  layer: LayerId;
  /** esconde a vara fincada no deck (o Juggler esta com a dele na mao) */
  hideRod?: boolean;
}) {
  const scene = useScene();
  if (scene.hidden.includes(layer)) return null;
  return (
    <div className={`scene-layer layer-${layer}`}>
      {scene.objects
        .filter((o) => o.layer === layer && o.kind === 'sprite')
        .filter((o) => !(hideRod && o.role === 'vara'))
        .map((o) => (
          <ObjectView key={o.id} o={o} />
        ))}
    </div>
  );
});
