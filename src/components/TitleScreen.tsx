import { useEffect, useState } from 'react';
import { asset } from '../assets';
import cutscene from '../assets/juggler-cutscene.webp';
import { EditorOverlay } from '../editor/EditorOverlay';
import { MENU_H, MENU_W, menuSlot, setActiveScene, useScene } from '../editor/scene';
import { depthZ, type SceneObject } from '../editor/types';
import { SceneLayer } from './SceneLayer';
import { initAudio, playSfx, startAmbience } from '../engine/audio';
import { useGame } from '../state/store';
import { useSettings } from '../state/settings';
import { useWorld } from '../world/worldConfig';
import { ControlsApp } from './ControlsPanel';
import { SettingsApp } from './SettingsPanel';
import { Sheet } from './Sheet';
import { Sky } from './Sky';
import { WaterSurface } from './WaterSurface';

type Overlay = 'config' | 'controles' | null;

/**
 * Enquadramento da tela de menu.
 *
 * O menu tem um tamanho de desenho fixo (1280x720) e e escalado para COBRIR a
 * viewport - sobra corta, nunca aparece faixa preta. Escala e deslocamento sao
 * devolvidos porque o editor precisa deles para converter tela em coordenada de
 * cena; sem isso, a caixa de selecao nao cairia em cima do sprite.
 */
export function useMenuView() {
  const [view, setView] = useState(() => menuView());
  useEffect(() => {
    const onResize = () => setView(menuView());
    onResize();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);
  return view;
}

function menuView() {
  const vw = typeof window === 'undefined' ? MENU_W : window.innerWidth;
  const vh = typeof window === 'undefined' ? MENU_H : window.innerHeight;
  const scale = Math.max(vw / MENU_W, vh / MENU_H);
  return { scale, x: (vw - MENU_W * scale) / 2, y: (vh - MENU_H * scale) / 2 };
}

/** Onde o mar comeca dentro da caixa do menu. */
const MENU_SEA_Y = 430;

/**
 * Um lugar reservado na cena do menu.
 *
 * O Juggler, o bloco do titulo, a coluna de botoes e a vinheta sao objetos de
 * cena: tem caixa, profundidade, giro e opacidade, e o editor mexe neles como
 * mexe num coqueiro. Este componente pega a caixa e desenha o conteudo dentro.
 *
 * Devolve `null` quando a peca foi apagada ou escondida no editor - esconder o
 * Juggler da tela de titulo passou a ser uma caixinha, nao uma edicao de codigo.
 */
function MenuSlot({
  role,
  className,
  children,
}: {
  role: NonNullable<SceneObject['role']>;
  className?: string;
  children?: React.ReactNode;
}) {
  // a assinatura da cena mora aqui: mexer no editor redesenha na hora
  useScene('menu');
  const o = menuSlot(role);
  if (!o) return null;
  return (
    <div
      className={`menu-slot ${className ?? ''}`}
      style={{
        left: o.x,
        top: o.y,
        width: o.w,
        height: o.h,
        opacity: o.opacity,
        zIndex: depthZ(o.depth),
        transform: `${o.rot ? `rotate(${o.rot}deg)` : ''}${o.flip ? ' scaleX(-1)' : ''}` || undefined,
      }}
    >
      {children}
    </div>
  );
}

/**
 * O cenario do menu, montado com os mesmos assets do jogo.
 *
 * A ideia e o menu ser um pedaco do mundo visto da ponta do pier, e nao uma
 * arte separada: o ceu, o mar, o horizonte e a tralha do deck sao exatamente os
 * sprites que o jogo usa.
 *
 * O que ele NAO faz mais e seguir o relogio. A hora do menu e escolhida na
 * secao MUNDO do editor e fica quieta: uma tela de apresentacao que muda de cor
 * sozinha enquanto voce olha nao apresenta nada.
 */
function TitleScene({ view }: { view: { scale: number; x: number; y: number } }) {
  const w = useWorld();

  return (
    <div className="title-scene">
      <Sky hour={w.menuHour} />

      <div
        className="menu-world"
        style={{
          width: MENU_W,
          height: MENU_H,
          transform: `translate3d(${view.x}px,${view.y}px,0) scale(${view.scale})`,
        }}
      >
        {/* horizonte: faixas que andam devagar (aqui sem camera, so o desenho) */}
        <SceneLayer scene="menu" band="longe" />
        <SceneLayer scene="menu" band="meio" />

        {/* o mar, com a paleta da hora escolhida */}
        <div className="title-sea" style={{ top: MENU_SEA_Y }} />

        {/* A mesma superficie do jogo: linha desenhada por quadro, e nao
            faixa deslizando. O menu tinha exatamente o mesmo problema. */}
        <WaterSurface
          left={0}
          width={MENU_W}
          top={MENU_SEA_Y}
          altura={38}
          corAgua="var(--sea-top, #35c6e0)"
          profundidade={90}
        />

        {/* barco, estacas, deck, tralha e vegetacao: tudo objeto de cena */}
        <SceneLayer scene="menu" band="perto" />
      </div>
    </div>
  );
}

export function TitleScreen({ onPlay }: { onPlay: () => void }) {
  const s = useGame();
  const settings = useSettings();
  const [overlay, setOverlay] = useState<Overlay>(null);
  const [editor, setEditor] = useState(false);
  const view = useMenuView();

  // o editor do menu edita a cena `menu`; sair devolve o foco para o mundo
  useEffect(() => {
    if (!editor) return;
    setActiveScene('menu');
    return () => setActiveScene('mundo');
  }, [editor]);

  const hasProgress = s.stats.casts > 0;

  const wake = () => {
    initAudio();
    if (!settings.muted && settings.music > 0) startAmbience();
    playSfx('ui');
  };

  return (
    <div className="title-screen" onPointerDown={initAudio}>
      <TitleScene view={view} />

      {editor && (
        <EditorOverlay
          camXRef={{ current: 0 }}
          scale={view.scale}
          viewX={view.x}
          viewY={view.y}
          onExit={() => setEditor(false)}
        />
      )}

      {/* A interface do menu vive DENTRO da caixa de desenho, junto com o resto
          da cena: é assim que ela pode ser arrastada no editor.

          Ela também é desenhada COM o editor aberto, e essa é a correção: antes
          o bloco inteiro saía da tela no modo editor, então as quatro peças
          editáveis (o Juggler, o título, os botões e a vinheta) viravam caixas
          invisíveis — dava para arrastar no escuro e só. Agora elas continuam
          à vista; o que muda é que param de responder ao mouse, para o clique
          chegar no editor e não no botão CONTINUAR. */}
      <div
          className={`menu-world menu-ui${editor ? ' editando' : ''}`}
          style={{
            width: MENU_W,
            height: MENU_H,
            transform: `translate3d(${view.x}px,${view.y}px,0) scale(${view.scale})`,
          }}
        >
          {/* Cada peça é uma caixa. O CSS aqui embaixo não empilha mais nada:
              onde a peça fica é a caixa que diz, e a caixa vem do editor. */}
          <MenuSlot role="vinheta">
            <div className="title-vignette" />
          </MenuSlot>

          <MenuSlot role="juggler">
            <img className="title-art" src={cutscene} alt="O Juggler" />
          </MenuSlot>

          <MenuSlot role="marca">
            <img className="title-mark" src={asset('ui/temporary-logo-mark')} alt="" />
          </MenuSlot>

          <MenuSlot role="titulo" className="title-brand">
            <h1>
              JUGGLER'S
              <br />
              <em>FISHING CLUB</em>
            </h1>
          </MenuSlot>

          <MenuSlot role="subtitulo">
            <p className="title-sub">
              Lança a linha, fisga o que aparecer e reza pra não ser a Hydra.
            </p>
          </MenuSlot>

          <MenuSlot role="jogar">
            <button
              className="btn primary title-btn"
              onClick={() => {
                wake();
                onPlay();
              }}
            >
              {hasProgress ? 'CONTINUAR' : 'COMEÇAR'}
            </button>
          </MenuSlot>

          {hasProgress && (
            <MenuSlot role="progresso">
              <div className="title-progress">
                {s.stats.casts.toLocaleString('pt-BR')} lançamentos &middot;{' '}
                {Object.keys(s.album).length} espécies &middot;{' '}
                {s.sazoncoins.toLocaleString('pt-BR')} SZ
              </div>
            </MenuSlot>
          )}

          <MenuSlot role="comojogar">
            <button
              className="btn title-btn"
              onClick={() => {
                wake();
                setOverlay('controles');
              }}
            >
              COMO JOGAR
            </button>
          </MenuSlot>

          <MenuSlot role="config">
            <button
              className="btn title-btn"
              onClick={() => {
                wake();
                setOverlay('config');
              }}
            >
              CONFIGURAÇÕES
            </button>
          </MenuSlot>

          <MenuSlot role="editor">
            <button
              className="btn title-btn ghost"
              onClick={() => {
                wake();
                setEditor(true);
              }}
              title="Mesmo editor do jogo, editando a tela de menu"
            >
              EDITOR DO MENU
            </button>
          </MenuSlot>
      </div>

      {!editor && (
        <div className="title-foot">
          <span className="founder-plate">FUNDADOR</span>
          <span>v0.3</span>
        </div>
      )}

      {overlay === 'config' && (
        <Sheet title="CONFIGURAÇÕES" onClose={() => setOverlay(null)}>
          <SettingsApp />
        </Sheet>
      )}
      {overlay === 'controles' && (
        <Sheet title="COMO JOGAR" onClose={() => setOverlay(null)}>
          <ControlsApp />
        </Sheet>
      )}
    </div>
  );
}
