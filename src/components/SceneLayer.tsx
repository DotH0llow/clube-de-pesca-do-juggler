import { memo } from 'react';
import { asset } from '../assets';
import { useScene } from '../editor/scene';
import { bandOf, depthZ, type BandId, type SceneId, type SceneObject } from '../editor/types';
import { getWorld } from '../world/worldConfig';

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
function ObjectView({ o, waterY, shoreX, shoreLean, shoreTop }: { o: SceneObject; waterY: number; shoreX: number; shoreLean: number; shoreTop: number }) {
  const prototype = /^prototype\/v[23]\//.test(o.sprite ?? '');
  const coastAtObject = shoreX - Math.min(Math.max(0, o.y + o.h / 2 - shoreTop), 760) * shoreLean;
  const undersea = Boolean(o.under || (o.x + o.w / 2 < coastAtObject - 8 && /^(marine\/|fish\/|prototype\/v3\/coral-reef|props\/(?:coral|kelp|aquatic|seafloor|sunken|decorative-fish|starfish))/.test(o.sprite ?? '')));
  const environmentalMotion = /marine\/(?:blue-)?crab/.test(o.sprite ?? '')
    ? ' env-crab'
    : o.sprite?.includes('jellyfish')
      ? ' env-jelly'
      : o.sprite?.startsWith('nature/')
    ? ' env-foliage'
    : o.sprite?.includes('boat') || o.sprite?.includes('prototype/v2/boat')
      ? ' env-boat'
      : o.sprite?.includes('market-stall') || o.sprite?.includes('cabana') || o.sprite?.includes('prototype/v2/market')
        ? ' env-hanging'
        : '';
  const style: React.CSSProperties = {
    left: o.x,
    top: o.y,
    width: o.w,
    height: o.h,
    opacity: (o.opacity ?? 1) * (undersea ? .78 : 1),
    zIndex: depthZ(o.depth),
    transform: `${o.rot ? `rotate(${o.rot}deg)` : ''}${o.flip ? ' scaleX(-1)' : ''}` || undefined,
    clipPath: undersea && o.y < waterY ? `inset(${Math.min(100, Math.max(0, (waterY - o.y) / Math.max(1, o.h) * 100))}% 0 0 0)` : undefined,
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
    <div className={`wobj${o.role === 'vara' ? ' rod-obj' : ''}${undersea ? ' wobj-undersea' : ''}`} data-obj={o.id} style={style}>
      <img
        className={`wobj-img${prototype ? ' prototype-asset' : ''}${o.under ? ' under-tint' : ''}${o.anim ? ` ${o.anim}` : ''}${environmentalMotion}`}
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
  waterY?: number;
  shoreX?: number;
  shoreLean?: number;
  shoreTop?: number;
  /** 'perto' = anda junto com a camera; os outros dois sao horizonte */
  band?: BandId;
  /** esconde a vara fincada no deck (o Juggler esta com a dele na mao) */
  hideRod?: boolean;
  /** O mundo usa a nova composicao, mas continua guardando os dados antigos. */
  hideLegacyBase?: boolean;
}

export const SceneLayer = memo(function SceneLayer({
  scene,
  waterY = getWorld().waterY,
  shoreX = getWorld().shoreX,
  shoreLean = getWorld().shoreLean,
  shoreTop = Math.min(getWorld().sandY, waterY) - 48,
  band = 'perto',
  hideRod = false,
  hideLegacyBase = false,
}: Props) {
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
        .filter((o) => !(hideLegacyBase && o.legacyBase))
        .map((o) => (
          <ObjectView key={o.id} o={o} waterY={waterY} shoreX={shoreX} shoreLean={shoreLean} shoreTop={shoreTop} />
        ))}
    </>
  );
});
