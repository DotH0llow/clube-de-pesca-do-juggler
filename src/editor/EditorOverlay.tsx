import { useCallback, useEffect, useRef, useState } from 'react';
import { asset } from '../assets';
import {
  addSprite,
  beginBatch,
  canRedo,
  canUndo,
  duplicateObject,
  endBatch,
  exportScene,
  importScene,
  moveToLayer,
  redo,
  removeObject,
  resetScene,
  toggleLayer,
  toggleLock,
  undo,
  reorder,
  rodX,
  updateObject,
  useActiveScene,
  useScene,
  MENU_H,
  MENU_W,
} from './scene';
import {
  DEPTH_HINTS,
  DEPTH_MAX,
  DEPTH_MIN,
  LAYERS,
  PLAYER_DEPTH,
  type LayerId,
  type SceneObject,
} from './types';
import { LibraryPanel } from './LibraryPanel';
import { AnimationsPanel, MechanicsPanel } from './AnimationsPanel';
import { updateFx, useFx, type FxItem } from './fx';
import { currentStep, stopPreview, usePreview } from './preview';
import { zoneRect } from './scene';
import { groundAt } from '../world/layout';

type Handle = 'nw' | 'ne' | 'sw' | 'se' | 'n' | 's' | 'e' | 'w';
type Drag =
  | { mode: 'move'; id: string; ox: number; oy: number; px: number; py: number }
  | { mode: 'scale'; id: string; handle: Handle; start: SceneObject; px: number; py: number }
  | { mode: 'rot'; id: string; cx: number; cy: number; start: number; base: number }
  | { mode: 'fx-move'; id: string; ox: number; oy: number; px: number; py: number }
  | { mode: 'fx-scale'; id: string; handle: Handle; start: FxItem; px: number; py: number }
  | { mode: 'pan'; px: number; cam: number }
  | null;

interface Props {
  camXRef: React.MutableRefObject<number>;
  scale: number;
  /** deslocamento da cena quando o zoom passa do tamanho da tela */
  viewY: number;
  viewX?: number;
  zoom?: number;
  onResetZoom?: () => void;
  /** onde o Juggler esta: ancora das pecas presas nele (ponta da vara) */
  playerXRef?: React.MutableRefObject<number>;
  onExit: () => void;
}

const HANDLES: Handle[] = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'];

/** Camada de trabalho, ou `todas` para pegar qualquer coisa que estiver visivel. */
type WorkLayer = LayerId | 'todas';
const DEPTHS = Array.from({ length: DEPTH_MAX - DEPTH_MIN + 1 }, (_, i) => DEPTH_MIN + i);

/**
 * Modo editor: uma engine simples por cima do jogo.
 *
 * Regras que valem aqui:
 *   - o jogo fica parado; nada de andar ou pescar;
 *   - so da para pegar objeto da camada ativa, e objeto travado nao responde;
 *   - selecionar e arrastar e coisa do botao ESQUERDO. O direito so abre o
 *     menu de contexto, sem mexer no que esta selecionado;
 *   - Ctrl+Z desfaz e Ctrl+Shift+Z (ou Ctrl+Y) refaz. Um arrasto inteiro conta
 *     como um passo so;
 *   - tudo o que muda vai direto para a cena, que e a mesma que o jogo desenha.
 */
export function EditorOverlay({
  camXRef,
  scale,
  viewY,
  viewX = 0,
  zoom = 1,
  onResetZoom,
  playerXRef,
  onExit,
}: Props) {
  const sceneId = useActiveScene();
  const scene = useScene();
  const fx = useFx();
  const preview = usePreview();
  /** o menu nao tem pescaria, entao nao tem o que simular la */
  const hasMechanics = sceneId === 'mundo' && Boolean(playerXRef);

  const [layer, setLayer] = useState<WorkLayer>('todas');
  const [selected, setSelected] = useState<string | null>(null);
  const [fxSel, setFxSel] = useState<string | null>(null);
  const [panel, setPanel] = useState<'biblioteca' | 'cena' | 'animacoes' | 'mecanicas' | null>(
    'biblioteca',
  );
  const [menu, setMenu] = useState<{ x: number; y: number; id: string } | null>(null);
  const [cam, setCam] = useState(() => camXRef.current);
  const [dragAsset, setDragAsset] = useState<string | null>(null);
  const [ghost, setGhost] = useState<{ x: number; y: number } | null>(null);
  const drag = useRef<Drag>(null);

  useEffect(() => {
    camXRef.current = cam;
  }, [cam, camXRef]);

  // fechar o editor nunca deixa o jogo preso numa etapa de simulacao
  useEffect(() => stopPreview, []);

  /**
   * Ligar a simulacao leva o Juggler para o ponto de pesca e enquadra a camera
   * la. Sem isso a mecanica rodava onde o editor tinha parado - normalmente na
   * praia, longe do apetrecho, e nao dava para ver nada.
   */
  useEffect(() => {
    if (!preview.mechanic || !playerXRef) return;
    const z = zoneRect('vara');
    playerXRef.current = z ? z.x + z.w / 2 : rodX();
    const view = window.innerWidth / scale;
    setCam(Math.max(0, rodX() - view * 0.45));
    setSelected(null);
  }, [preview.mechanic, playerXRef, scale]);

  const sel = selected ? scene.objects.find((o) => o.id === selected) ?? null : null;

  const toScreen = useCallback(
    (x: number, y: number) => ({ x: (x - cam) * scale + viewX, y: y * scale + viewY }),
    [cam, scale, viewX, viewY],
  );
  const toWorld = useCallback(
    (px: number, py: number) => ({ x: (px - viewX) / scale + cam, y: (py - viewY) / scale }),
    [cam, scale, viewX, viewY],
  );

  /**
   * Onde uma peca de mecanica esta, em unidades de mundo.
   *
   * Peca de apetrecho mede a partir do ponto onde a boia cai; peca presa no
   * Juggler (a ponta da vara) mede a partir dos pes dele. Assim o editor mostra
   * a peca exatamente onde o jogo vai desenhar.
   */
  const fxRect = useCallback(
    (it: FxItem) => {
      const px = playerXRef?.current ?? rodX();
      const base =
        it.anchor === 'jogador'
          ? { x: px, y: groundAt(px) }
          : { x: rodX() + fx.timings.bobberDx, y: fx.timings.bobberY };
      return { x: base.x + it.x, y: base.y + it.y, w: it.w, h: it.h };
    },
    [fx.timings.bobberDx, fx.timings.bobberY, playerXRef],
  );

  const step = preview.mechanic ? currentStep() : null;
  const stepItems = step ? fx.items.filter((i) => i.steps.includes(step.id)) : [];
  const fxItem = fxSel ? stepItems.find((i) => i.id === fxSel) ?? null : null;

  /**
   * Objeto sob o ponto, respeitando camada de trabalho, cadeado e visibilidade.
   *
   * Com `todas` (o padrao) pega qualquer coisa - inclusive as areas de
   * interacao, que antes so davam para clicar se a camada INTERAGIVEIS
   * estivesse selecionada, coisa que nao aparecia em lugar nenhum da tela.
   * Desempata por profundidade: quem esta mais na frente ganha o clique.
   */
  const hit = useCallback(
    (wx: number, wy: number): SceneObject | null => {
      const list = scene.objects
        .filter((o) => layer === 'todas' || o.layer === layer)
        .filter((o) => !o.locked && !scene.hidden.includes(o.layer))
        .filter((o) => wx >= o.x && wx <= o.x + o.w && wy >= o.y && wy <= o.y + o.h);
      if (list.length === 0) return null;
      return list.reduce((best, o) => (o.depth >= best.depth ? o : best));
    },
    [scene.objects, scene.hidden, layer],
  );

  // ------------------------------------------------------------- teclado
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === 'INPUT') return;

      // desfazer / refazer valem mesmo sem nada selecionado
      if ((e.ctrlKey || e.metaKey) && (e.code === 'KeyZ' || e.code === 'KeyY')) {
        e.preventDefault();
        const wantRedo = e.code === 'KeyY' || e.shiftKey;
        if (wantRedo) redo();
        else undo();
        return;
      }

      if (e.code === 'Escape') {
        setMenu(null);
        setSelected(null);
        return;
      }
      if (!selected) return;
      const o = scene.objects.find((x) => x.id === selected);
      if (!o || o.locked) return;
      const step = e.shiftKey ? 10 : 1;
      if (e.code === 'Delete' || e.code === 'Backspace') {
        e.preventDefault();
        removeObject(selected);
        setSelected(null);
      } else if (e.code === 'ArrowLeft') {
        e.preventDefault();
        updateObject(o.id, { x: o.x - step });
      } else if (e.code === 'ArrowRight') {
        e.preventDefault();
        updateObject(o.id, { x: o.x + step });
      } else if (e.code === 'ArrowUp') {
        e.preventDefault();
        updateObject(o.id, { y: o.y - step });
      } else if (e.code === 'ArrowDown') {
        e.preventDefault();
        updateObject(o.id, { y: o.y + step });
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [selected, scene.objects]);

  // --------------------------------------------------------- mouse na cena
  const onPointerDown = (e: React.PointerEvent) => {
    if (menu) setMenu(null);
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const px = e.clientX - rect.left;
    const py = e.clientY - rect.top;
    const w = toWorld(px, py);

    // botao direito: so o menu de contexto, sem mexer na selecao
    if (e.button === 2) {
      const any = scene.objects
        .filter((o) => layer === 'todas' || o.layer === layer)
        .filter((o) => !scene.hidden.includes(o.layer))
        .reverse()
        .find((o) => w.x >= o.x && w.x <= o.x + o.w && w.y >= o.y && w.y <= o.y + o.h);
      if (any) setMenu({ x: px, y: py, id: any.id });
      return;
    }

    // botao do meio: so navega pelo mapa
    if (e.button === 1) {
      drag.current = { mode: 'pan', px, cam };
      return;
    }

    // daqui para baixo e so o botao esquerdo
    if (e.button !== 0) return;

    // com a simulacao ligada, as pecas da mecanica pegam o clique primeiro:
    // elas estao por cima de tudo e sao o que voce veio ajustar
    if (step && hasMechanics) {
      for (let i = stepItems.length - 1; i >= 0; i--) {
        const it = stepItems[i];
        const r = fxRect(it);
        const pad = it.point ? 14 : 0;
        if (w.x >= r.x - pad && w.x <= r.x + r.w + pad && w.y >= r.y - pad && w.y <= r.y + r.h + pad) {
          setFxSel(it.id);
          setSelected(null);
          drag.current = { mode: 'fx-move', id: it.id, ox: it.x, oy: it.y, px, py };
          return;
        }
      }
      setFxSel(null);
    }

    const found = hit(w.x, w.y);
    if (found) {
      setSelected(found.id);
      beginBatch();
      drag.current = { mode: 'move', id: found.id, ox: found.x, oy: found.y, px, py };
    } else {
      setSelected(null);
      drag.current = { mode: 'pan', px, cam };
    }
  };

  /**
   * Arrastar vive no window de proposito: as alcas sao elementos proprios e,
   * com o ponteiro capturado nelas, o mousemove nunca chegaria na area de
   * trabalho. No window, todo mundo recebe.
   */
  useEffect(() => {
    const host = () => document.querySelector('.editor-canvas') as HTMLElement | null;

    const onMove = (ev: PointerEvent) => {
      const el = host();
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const px = ev.clientX - rect.left;
      const py = ev.clientY - rect.top;
      if (dragAsset) setGhost({ x: px, y: py });

      const d = drag.current;
      if (!d) return;

      if (d.mode === 'pan') {
        // o menu cabe inteiro na tela: nao ha para onde arrastar
        if (sceneId === 'menu') return;
        setCam(Math.max(0, d.cam - (px - d.px) / scale));
        return;
      }
      if (d.mode === 'move') {
        updateObject(d.id, {
          x: Math.round(d.ox + (px - d.px) / scale),
          y: Math.round(d.oy + (py - d.py) / scale),
        });
        return;
      }
      if (d.mode === 'fx-move') {
        updateFx(d.id, {
          x: Math.round(d.ox + (px - d.px) / scale),
          y: Math.round(d.oy + (py - d.py) / scale),
        });
        return;
      }
      if (d.mode === 'fx-scale') {
        const dx = (px - d.px) / scale;
        const dy = (py - d.py) / scale;
        const st = d.start;
        let { x, y, w, h } = st;
        const ratio = st.w / st.h;
        const corner = d.handle.length === 2;
        if (d.handle.includes('e')) w = st.w + dx;
        if (d.handle.includes('w')) {
          w = st.w - dx;
          x = st.x + dx;
        }
        if (d.handle.includes('s')) h = st.h + dy;
        if (d.handle.includes('n')) {
          h = st.h - dy;
          y = st.y + dy;
        }
        if (corner) {
          h = Math.max(4, w / ratio);
          if (d.handle.includes('n')) y = st.y + (st.h - h);
        }
        updateFx(d.id, {
          x: Math.round(x),
          y: Math.round(y),
          w: Math.max(4, Math.round(w)),
          h: Math.max(4, Math.round(h)),
        });
        return;
      }
      if (d.mode === 'rot') {
        const ang = (Math.atan2(py - d.cy, px - d.cx) * 180) / Math.PI;
        updateObject(d.id, { rot: Math.round(d.base + (ang - d.start)) });
        return;
      }
      if (d.mode === 'scale') {
        const dx = (px - d.px) / scale;
        const dy = (py - d.py) / scale;
        const st = d.start;
        let { x, y, w, h } = st;
        const ratio = st.w / st.h;
        const corner = d.handle.length === 2;
        if (d.handle.includes('e')) w = st.w + dx;
        if (d.handle.includes('w')) {
          w = st.w - dx;
          x = st.x + dx;
        }
        if (d.handle.includes('s')) h = st.h + dy;
        if (d.handle.includes('n')) {
          h = st.h - dy;
          y = st.y + dy;
        }
        if (corner) {
          // canto mantem a proporcao do sprite
          h = Math.max(8, w / ratio);
          if (d.handle.includes('n')) y = st.y + (st.h - h);
        }
        updateObject(d.id, {
          x: Math.round(x),
          y: Math.round(y),
          w: Math.max(8, Math.round(w)),
          h: Math.max(8, Math.round(h)),
        });
      }
    };

    const onUp = (ev: PointerEvent) => {
      drag.current = null;
      endBatch();
      if (!dragAsset) return;
      const el = host();
      const rect = el?.getBoundingClientRect();
      const overPanel = (ev.target as HTMLElement)?.closest('.editor-panel, .editor-layers, .editor-bar');
      let wx: number;
      let wy: number;
      if (!rect || overPanel) {
        // solto em cima de um painel: entra no meio da tela
        wx = sceneId === 'menu' ? MENU_W / 2 : cam + window.innerWidth / scale / 2;
        wy = sceneId === 'menu' ? MENU_H / 2 : 300;
      } else {
        const w = toWorld(ev.clientX - rect.left, ev.clientY - rect.top);
        wx = w.x;
        wy = w.y;
      }
      const obj = addSprite(dragAsset, layer === 'todas' ? 'objetos' : layer, wx, wy, 120);
      setSelected(obj.id);
      setDragAsset(null);
      setGhost(null);
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
  }, [dragAsset, scale, cam, layer, sceneId, toWorld]);

  const startHandle = (e: React.PointerEvent, handle: Handle) => {
    if (!sel || e.button !== 0) return;
    e.stopPropagation();
    beginBatch();
    const host = (e.currentTarget as HTMLElement).closest('.editor-canvas') as HTMLElement;
    const rect = host.getBoundingClientRect();
    drag.current = {
      mode: 'scale',
      id: sel.id,
      handle,
      start: { ...sel },
      px: e.clientX - rect.left,
      py: e.clientY - rect.top,
    };
  };

  const startFxHandle = (e: React.PointerEvent, handle: Handle) => {
    if (!fxItem || e.button !== 0) return;
    e.stopPropagation();
    const host = (e.currentTarget as HTMLElement).closest('.editor-canvas') as HTMLElement;
    const rect = host.getBoundingClientRect();
    drag.current = {
      mode: 'fx-scale',
      id: fxItem.id,
      handle,
      start: { ...fxItem },
      px: e.clientX - rect.left,
      py: e.clientY - rect.top,
    };
  };

  const startRotate = (e: React.PointerEvent) => {
    if (!sel || e.button !== 0) return;
    e.stopPropagation();
    beginBatch();
    const host = (e.currentTarget as HTMLElement).closest('.editor-canvas') as HTMLElement;
    const rect = host.getBoundingClientRect();
    const c = toScreen(sel.x + sel.w / 2, sel.y + sel.h / 2);
    const px = e.clientX - rect.left;
    const py = e.clientY - rect.top;
    drag.current = {
      mode: 'rot',
      id: sel.id,
      cx: c.x,
      cy: c.y,
      start: (Math.atan2(py - c.y, px - c.x) * 180) / Math.PI,
      base: sel.rot,
    };
  };

  // ------------------------------------------------------------- export
  const doExport = () => {
    const blob = new Blob([exportScene()], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'cena-do-juggler.json';
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const doImport = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json';
    input.onchange = async () => {
      const file = input.files?.[0];
      if (file) importScene(await file.text());
    };
    input.click();
  };

  const zones = scene.objects.filter((o) => o.kind === 'zone' && !scene.hidden.includes(o.layer));
  const selBox = sel ? toScreen(sel.x, sel.y) : null;

  return (
    <div className="editor">
      {/* --------------------------------------------------- area de trabalho */}
      <div
        className="editor-canvas"
        onPointerDown={onPointerDown}
        onContextMenu={(e) => e.preventDefault()}
      >
        {/* areas de interacao: so aparecem aqui dentro */}
        {zones.map((z) => {
          const p = toScreen(z.x, z.y);
          return (
            <div
              key={z.id}
              className={`editor-zone${selected === z.id ? ' on' : ''}`}
              style={{ left: p.x, top: p.y, width: z.w * scale, height: z.h * scale }}
            >
              <span>{z.zone === 'vara' ? 'PESCAR' : 'MERCADO'}</span>
            </div>
          );
        })}

        {/* caixa de selecao */}
        {sel && selBox && (
          <div
            className="editor-sel"
            style={{
              left: selBox.x,
              top: selBox.y,
              width: sel.w * scale,
              height: sel.h * scale,
              transform: sel.rot ? `rotate(${sel.rot}deg)` : undefined,
            }}
          >
            {HANDLES.map((h) => (
              <i key={h} className={`h ${h}`} onPointerDown={(e) => startHandle(e, h)} />
            ))}
            <i className="rot" onPointerDown={startRotate} />
          </div>
        )}

        {/* pecas da mecanica em simulacao: caixa por cima do efeito de verdade */}
        {step &&
          hasMechanics &&
          stepItems.map((it) => {
            const r = fxRect(it);
            const p = toScreen(r.x, r.y);
            if (it.point) {
              return (
                <div
                  key={it.id}
                  className={`editor-fxpoint${fxSel === it.id ? ' on' : ''}`}
                  style={{ left: p.x, top: p.y }}
                  title={it.label}
                >
                  <span>{it.label}</span>
                </div>
              );
            }
            return (
              <div
                key={it.id}
                className={`editor-fx${fxSel === it.id ? ' on' : ''}`}
                style={{ left: p.x, top: p.y, width: r.w * scale, height: r.h * scale }}
              >
                <b>{it.label}</b>
                {fxSel === it.id &&
                  HANDLES.map((h) => (
                    <i key={h} className={`h ${h}`} onPointerDown={(e) => startFxHandle(e, h)} />
                  ))}
              </div>
            );
          })}

        {ghost && dragAsset && (
          <img className="editor-ghost" src={asset(dragAsset)} alt="" style={{ left: ghost.x, top: ghost.y }} />
        )}
      </div>

      {/* ------------------------------------------------------------ topo */}
      <div className="editor-bar">
        <span className="editor-badge">{sceneId === 'menu' ? 'EDITOR DO MENU' : 'MODO EDITOR'}</span>
        <button className="ebtn" disabled={!canUndo()} onClick={() => undo()} title="Ctrl+Z">
          DESFAZER
        </button>
        <button className="ebtn" disabled={!canRedo()} onClick={() => redo()} title="Ctrl+Shift+Z">
          REFAZER
        </button>
        <button
          className="ebtn"
          onClick={() => {
            stopPreview();
            setPanel(panel === 'biblioteca' ? null : 'biblioteca');
          }}
        >
          BIBLIOTECA
        </button>
        <button
          className="ebtn"
          onClick={() => {
            stopPreview();
            setPanel(panel === 'cena' ? null : 'cena');
          }}
        >
          CENA ({scene.objects.length})
        </button>
        <button
          className="ebtn"
          onClick={() => {
            stopPreview();
            setPanel(panel === 'animacoes' ? null : 'animacoes');
          }}
        >
          ANIMAÇÕES
        </button>
        {hasMechanics && (
          <button
            className="ebtn"
            onClick={() => {
              const next = panel === 'mecanicas' ? null : 'mecanicas';
              setPanel(next);
              if (next === null) stopPreview();
            }}
          >
            MECÂNICAS
          </button>
        )}
        {onResetZoom && (
          <button className="ebtn" onClick={onResetZoom} title="Ctrl + roda do mouse dá zoom">
            ZOOM {Math.round(zoom * 100)}%
          </button>
        )}
        <button className="ebtn" onClick={doExport}>
          EXPORTAR
        </button>
        <button className="ebtn" onClick={doImport}>
          IMPORTAR
        </button>
        <button
          className="ebtn danger"
          onClick={() => {
            if (confirm('Voltar à cena original? Tudo que você moveu se perde.')) {
              resetScene();
              setSelected(null);
            }
          }}
        >
          RESETAR
        </button>
        <div className="grow" />
        <span className="editor-tip">
          CLIQUE ESQUERDO SELECIONA E ARRASTA &middot; ALÇAS REDIMENSIONAM &middot; BOTÃO DIREITO
          ABRE O MENU &middot; CTRL+Z DESFAZ &middot; DEL APAGA
        </span>
        <button
          className="ebtn primary"
          onClick={() => {
            stopPreview();
            onExit();
          }}
        >
          SAIR DO EDITOR
        </button>
      </div>

      {/* --------------------------------------------------------- camadas */}
      <div className="editor-layers">
        <div className="etitle">TRABALHANDO EM</div>
        <div className="elayer-pick">
          <button
            className={`ebtn${layer === 'todas' ? ' primary' : ''}`}
            onClick={() => {
              setLayer('todas');
              setSelected(null);
            }}
            title="Pega qualquer objeto visível, de qualquer camada"
          >
            TODAS
          </button>
        </div>
        {LAYERS.map((l) => {
          const count = scene.objects.filter((o) => o.layer === l.id).length;
          const visible = !scene.hidden.includes(l.id);
          return (
            <div key={l.id} className={`elayer${layer === l.id ? ' active' : ''}`}>
              <input
                type="checkbox"
                checked={visible}
                onChange={() => toggleLayer(l.id)}
                title="Mostrar ou esconder a camada"
              />
              <button
                className="ename"
                onClick={() => {
                  setLayer(layer === l.id ? 'todas' : l.id);
                  setSelected(null);
                }}
                title="Trabalhar só nesta camada"
              >
                {l.label} <small>({count})</small>
              </button>
            </div>
          );
        })}
        <div className="ehint">
          {layer === 'todas'
            ? 'Clique pega qualquer objeto visível. Escolha uma camada para travar o clique nela.'
            : LAYERS.find((l) => l.id === layer)?.hint}
        </div>

        {sel && (
          <div className="einspect">
            <div className="etitle">SELECIONADO</div>
            <div className="eline">{sel.sprite || sel.zone || sel.id}</div>
            <div className="eline">
              X {Math.round(sel.x)} &middot; Y {Math.round(sel.y)}
            </div>
            <div className="eline">
              L {Math.round(sel.w)} &middot; A {Math.round(sel.h)} &middot; {Math.round(sel.rot)}°
            </div>

            <div className="etitle" style={{ marginTop: 8 }}>
              PROFUNDIDADE
            </div>
            <div className="edepth">
              {DEPTHS.map((d) => (
                <button
                  key={d}
                  className={`edepth-step${sel.depth === d ? ' on' : ''}${d === PLAYER_DEPTH ? ' juggler' : ''}`}
                  onClick={() => updateObject(sel.id, { depth: d })}
                  title={DEPTH_HINTS[d]}
                >
                  {d}
                </button>
              ))}
            </div>
            <div className="ehint">
              {sel.depth} &middot; {DEPTH_HINTS[sel.depth] ?? ''}
              <br />
              {sel.depth > PLAYER_DEPTH ? 'na frente do Juggler' : 'atrás do Juggler'}
            </div>
            <div className="erow">
              <button className="ebtn" onClick={() => reorder(sel.id, true)} title="Desempata quem tem a mesma profundidade">
                À FRENTE
              </button>
              <button className="ebtn" onClick={() => reorder(sel.id, false)}>
                ATRÁS
              </button>
            </div>

            <div className="erow">
              <button className="ebtn" onClick={() => updateObject(sel.id, { flip: !sel.flip })}>
                ESPELHAR
              </button>
              <button className="ebtn" onClick={() => updateObject(sel.id, { rot: 0 })}>
                ZERAR GIRO
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ------------------------------------------------------- biblioteca */}
      {panel === 'biblioteca' && (
        <LibraryPanel
          onDragAsset={(path, x, y) => {
            setDragAsset(path);
            setGhost({ x, y });
          }}
        />
      )}

      {/* ------------------------------------------------------ lista da cena */}
      {panel === 'cena' && (
        <div className="editor-panel">
          <div className="etitle">OBJETOS NA CENA</div>
          <div className="elist">
            {LAYERS.map((l) => (
              <div key={l.id}>
                <div className="elib-cat">
                  {l.label} {scene.hidden.includes(l.id) && <span className="off">(ESCONDIDA)</span>}
                </div>
                {scene.objects
                  .filter((o) => o.layer === l.id)
                  .map((o) => (
                    <button
                      key={o.id}
                      className={`eitem${selected === o.id ? ' on' : ''}${o.locked ? ' locked' : ''}`}
                      onClick={() => {
                        setLayer(o.layer);
                        setSelected(o.locked ? null : o.id);
                      }}
                    >
                      <span className="lock">{o.locked ? '[X]' : '[ ]'}</span>
                      <span className="grow">{o.sprite || o.zone || o.id}</span>
                      <span
                        className="mini"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleLock(o.id);
                        }}
                      >
                        {o.locked ? 'DESTRAVAR' : 'TRAVAR'}
                      </span>
                    </button>
                  ))}
              </div>
            ))}
          </div>
        </div>
      )}

      {panel === 'animacoes' && <AnimationsPanel />}

      {panel === 'mecanicas' && hasMechanics && (
        <MechanicsPanel selected={fxSel} onSelect={setFxSel} />
      )}

      {/* ---------------------------------------------------- menu do direito */}
      {menu && (
        <div className="editor-menu" style={{ left: menu.x, top: menu.y }}>
          {(() => {
            const o = scene.objects.find((x) => x.id === menu.id);
            if (!o) return null;
            return (
              <>
                <div className="emenu-title">{o.sprite || o.zone || o.id}</div>
                <button
                  onClick={() => {
                    toggleLock(o.id);
                    setMenu(null);
                  }}
                >
                  {o.locked ? 'DESTRAVAR CADEADO' : 'TRAVAR COM CADEADO'}
                </button>
                {o.kind === 'sprite' && (
                  <>
                    <div className="emenu-sep">MOVER PARA A CAMADA</div>
                    {LAYERS.filter((l) => l.id !== 'interagiveis').map((l) => (
                      <button
                        key={l.id}
                        disabled={o.layer === l.id}
                        onClick={() => {
                          moveToLayer(o.id, l.id);
                          setLayer(l.id);
                          setMenu(null);
                        }}
                      >
                        {l.label}
                      </button>
                    ))}
                    <div className="emenu-sep" />
                    <button
                      onClick={() => {
                        const copy = duplicateObject(o.id);
                        if (copy) setSelected(copy.id);
                        setMenu(null);
                      }}
                    >
                      DUPLICAR
                    </button>
                    <button
                      className="danger"
                      disabled={o.locked}
                      onClick={() => {
                        removeObject(o.id);
                        setSelected(null);
                        setMenu(null);
                      }}
                    >
                      APAGAR
                    </button>
                  </>
                )}
              </>
            );
          })()}
        </div>
      )}
    </div>
  );
}
