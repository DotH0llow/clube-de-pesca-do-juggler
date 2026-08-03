import { useEffect, useState } from 'react';
import { asset } from '../assets';
import cutscene from '../assets/juggler-cutscene.webp';
import { EditorOverlay } from '../editor/EditorOverlay';
import { MENU_H, MENU_W, setActiveScene } from '../editor/scene';
import { SceneLayer } from './SceneLayer';
import { initAudio, playSfx, startAmbience } from '../engine/audio';
import { useGame } from '../state/store';
import { useSettings } from '../state/settings';
import { useDayPhase, useGameClock } from '../world/dayCycle';
import { REGIONS } from '../data/regions';
import { ControlsApp } from './ControlsPanel';
import { SettingsApp } from './SettingsPanel';
import { Sheet } from './Sheet';
import { Sky } from './Sky';

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
 * O cenario do menu, montado com os mesmos assets do jogo.
 *
 * A ideia e o menu ser um pedaco do mundo visto da ponta do pier, e nao uma
 * arte separada: o ceu, o mar, o horizonte e a tralha do deck sao exatamente
 * os sprites que o jogo usa. Por isso ele tambem segue a fase do dia - abrir o
 * jogo de madrugada mostra o menu de madrugada.
 *
 * Tudo o que e sprite virou objeto de CENA (`src/editor/scene.ts`, cena
 * `menu`), entao da para arrumar o menu com o mesmo editor do jogo. O que
 * continua sendo estrutura aqui e o que nao e sprite: ceu, gradiente do mar,
 * faixa de espuma e a vinheta.
 */
function TitleScene({
  phase,
  view,
  editing,
}: {
  phase: ReturnType<typeof useDayPhase>;
  view: { scale: number; x: number; y: number };
  /** no editor a vinheta sai: ela escurece justamente o que voce foi arrumar */
  editing: boolean;
}) {
  return (
    <div className="title-scene">
      <Sky region={phase} />

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

        {/* o mar, com a paleta da fase do dia */}
        <div className="title-sea" style={{ top: MENU_SEA_Y }} />

        {/* espuma e ondas na linha d agua */}
        <div className="title-surf" style={{ top: MENU_SEA_Y - 22 }}>
          <div className="foam" style={{ backgroundImage: `url(${asset('fx/foam-strip')})` }} />
          <div className="swell" style={{ backgroundImage: `url(${asset('fx/small-wave-strip')})` }} />
          <div className="swell swell-b" style={{ backgroundImage: `url(${asset('fx/large-wave-strip')})` }} />
          <div className="glint" style={{ backgroundImage: `url(${asset('fx/sun-glint-strip')})` }} />
        </div>

        {/* barco, estacas, deck, tralha e vegetacao: tudo objeto de cena */}
        <SceneLayer scene="menu" band="perto" />
      </div>

      {!editing && <div className="title-vignette" />}
    </div>
  );
}

export function TitleScreen({ onPlay }: { onPlay: () => void }) {
  const s = useGame();
  const settings = useSettings();
  const phase = useDayPhase();
  const clock = useGameClock();
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
      <TitleScene phase={phase} view={view} editing={editor} />

      {editor && (
        <EditorOverlay
          camXRef={{ current: 0 }}
          scale={view.scale}
          viewX={view.x}
          viewY={view.y}
          onExit={() => setEditor(false)}
        />
      )}

      {editor ? null : (
      <>
      {/* o Juggler posando com a vara, encostado no canto direito */}
      <img className="title-art" src={cutscene} alt="O Juggler" />

      <div className="title-content">
        <div className="title-brand">
          <img className="title-mark" src={asset('ui/temporary-logo-mark')} alt="" />
          <h1>
            JUGGLER'S
            <br />
            <em>FISHING CLUB</em>
          </h1>
          <p className="title-sub">
            Lança a linha, fisga o que aparecer e reza pra não ser a Hydra.
          </p>
        </div>

        <div className="title-menu">
          <button
            className="btn primary title-btn"
            onClick={() => {
              wake();
              onPlay();
            }}
          >
            {hasProgress ? 'CONTINUAR' : 'COMEÇAR'}
          </button>
          {hasProgress && (
            <div className="title-progress">
              {s.stats.casts.toLocaleString('pt-BR')} lançamentos &middot;{' '}
              {Object.keys(s.album).length} espécies &middot; {s.sazoncoins.toLocaleString('pt-BR')} SZ
            </div>
          )}
          <button
            className="btn title-btn"
            onClick={() => {
              wake();
              setOverlay('controles');
            }}
          >
            COMO JOGAR
          </button>
          <button
            className="btn title-btn"
            onClick={() => {
              wake();
              setOverlay('config');
            }}
          >
            CONFIGURAÇÕES
          </button>
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
        </div>

        <div className="title-foot">
          <span className="founder-plate">FUNDADOR</span>
          <span className="title-clock">
            {clock} &middot; {REGIONS[phase].name}
          </span>
          <span>&middot; v0.2</span>
        </div>
      </div>

      {overlay === 'config' && <Sheet title="CONFIGURAÇÕES" onClose={() => setOverlay(null)}><SettingsApp /></Sheet>}
      {overlay === 'controles' && (
        <Sheet title="COMO JOGAR" onClose={() => setOverlay(null)}>
          <ControlsApp />
        </Sheet>
      )}
      </>
      )}
    </div>
  );
}
