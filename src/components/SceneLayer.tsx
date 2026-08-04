import { memo } from 'react';
import { asset } from '../assets';
import { useScene } from '../editor/scene';
import { bandOf, depthZ, type BandId, type SceneId, type SceneObject } from '../editor/types';

export { bandOf };

/**
 * Desenha uma cena inteira. O jogo e o editor leem a MESMA lista, entao o que
 * voce move no editor e o que aparece na tela.
 *
 * Quem fica na frente de quem sai da `depth` de cada objeto (0 a 10), nao da
 * ordem em que o codigo desenha. Por isso aqui nao ha mais uma chamada por
 * camada: e uma passada so, e o z-index faz o resto. Empate de profundidade
 * desempata pela ordem da lista, que o menu do botao direito sabe mexer.
 *
 * `parallax` separa as faixas do horizonte em tres grupos: as que andam pouco,
 * as do meio e as que andam junto com o mundo. Os dois primeiros grupos vao
 * para containers proprios, movidos pelo laco do jogo.
 */
function ObjectView({ o }: { o: SceneObject }) {
  const style: React.CSSProperties = {
    left: o.x,
    top: o.y,
    width: o.w,
    height: o.h,
    opacity: o.opacity,
    zIndex: depthZ(o.depth),
    transform: `${o.rot ? `rotate(${o.rot}deg)` : ''}${o.flip ? ' scaleX(-1)' : ''}` || undefined,
  };

  // faixa que se repete no eixo x (horizonte, tabua do deck)
  if (o.kind === 'strip') {
    return (
      <div
        className="wobj wobj-strip"
        data-obj={o.id}
        style={{ ...style, backgroundImage: o.sprite ? `url(${asset(o.sprite)})` : undefined }}
      />
    );
  }

  /*
   * Forma geometrica: nao tem sprite, e cor.
   *
   * Retangulo e elipse saem no proprio CSS (borda arredondada); triangulo e
   * losango saem de `clip-path`, que corta o mesmo retangulo. Assim a forma
   * continua sendo uma caixa comum para o editor arrastar e redimensionar.
   */
  if (o.kind === 'forma') {
    const clip =
      o.shape === 'triangulo'
        ? 'polygon(50% 0%, 100% 100%, 0% 100%)'
        : o.shape === 'losango'
          ? 'polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)'
          : undefined;
    return (
      <div
        className="wobj wobj-shape"
        data-obj={o.id}
        style={{
          ...style,
          background: o.fill || '#2fd6c9',
          border: o.stroke ? `${o.strokeW ?? 4}px solid ${o.stroke}` : undefined,
          borderRadius: o.shape === 'elipse' ? '50%' : o.radius ? `${o.radius}px` : undefined,
          clipPath: clip,
        }}
      />
    );
  }

  /*
   * Objeto sem sprite: so a caixa, com a classe de animacao que ele pedir.
   *
   * Isto servia a `treeline`, a massa de mata feita de gradiente radial que
   * saiu do jogo. Continua valendo para quem quiser uma caixa de efeito puro em
   * CSS - e e o que sobra das pecas de interface do menu (Juggler, titulo,
   * botoes, vinheta) se elas passarem por aqui, coisa que o filtro logo abaixo
   * evita.
   */
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

/** Papeis desenhados por outro componente, nao por esta camada. */
const UI_ROLES = ['juggler', 'titulo', 'botoes', 'vinheta'];

interface Props {
  scene: SceneId;
  /** 'perto' = anda junto com a camera; os outros dois sao horizonte */
  band?: BandId;
  /** esconde a vara fincada no deck (o Juggler esta com a dele na mao) */
  hideRod?: boolean;
}

export const SceneLayer = memo(function SceneLayer({ scene, band = 'perto', hideRod = false }: Props) {
  const state = useScene(scene);
  return (
    <>
      {state.objects
        .filter((o) => o.kind !== 'zone')
        .filter((o) => !o.off)
        // peca de interface da tela de titulo: quem desenha e a tela de titulo,
        // que sabe o que vai dentro da caixa. Aqui ela sairia como um retangulo
        // vazio por cima do menu.
        .filter((o) => !UI_ROLES.includes(o.role ?? ''))
        .filter((o) => !state.hidden.includes(o.layer))
        .filter((o) => bandOf(o) === band)
        .filter((o) => !(hideRod && o.role === 'vara'))
        .map((o) => (
          <ObjectView key={o.id} o={o} />
        ))}
    </>
  );
});
