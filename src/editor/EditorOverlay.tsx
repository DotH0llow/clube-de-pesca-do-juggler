import { useCallback, useEffect, useRef, useState } from 'react';
import { asset } from '../assets';
import {
  addShape,
  addSprite,
  addWall,
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
  SHAPES,
  ZONE_LABEL,
  type LayerId,
  type SceneObject,
  type ShapeKind,
} from './types';
import { LibraryPanel } from './LibraryPanel';
import { AnimationsPanel, MechanicsPanel } from './AnimationsPanel';
import { WorldPanel } from './WorldPanel';
import { FloatersPanel } from './FloatersPanel';
import { ColorField, SliderField } from './fields';
import {
  beginFxBatch,
  canRedoFx,
  canUndoFx,
  endFxBatch,
  redoFx,
  undoFx,
  updateFx,
  useFx,
  type FxItem,
} from './fx';
import { currentStep, getPreview, stopPreview, usePreview } from './preview';
import { zoneRect } from './scene';
import { groundAt } from '../world/layout';
import { panMaxY, panMinY, useWorld } from '../world/worldConfig';

/** Prende o deslocamento vertical da tela dentro do mundo. */
function clampPan(v: number): number {
  return Math.min(panMaxY(), Math.max(panMinY(), v));
}

type Handle = 'nw' | 'ne' | 'sw' | 'se' | 'n' | 's' | 'e' | 'w';
type Drag =
  | { mode: 'move'; id: string; ox: number; oy: number; px: number; py: number }
  | { mode: 'scale'; id: string; handle: Handle; start: SceneObject; px: number; py: number }
  | { mode: 'rot'; id: string; cx: number; cy: number; start: number; base: number }
  | { mode: 'fx-move'; id: string; ox: number; oy: number; px: number; py: number }
  | { mode: 'fx-scale'; id: string; handle: Handle; start: FxItem; px: number; py: number }
  | { mode: 'pan'; px: number; py: number; cam: number; camY: number }
  | { mode: 'guia'; px: number; base: number }
  | null;

interface Props {
  camXRef: React.MutableRefObject<number>;
  /** deslocamento vertical da camera: e por aqui que a tela do editor desce */
  camYRef?: React.MutableRefObject<number>;
  scale: number;
  /** deslocamento da cena quando o zoom passa do tamanho da tela */
  viewY: number;
  viewX?: number;
  zoom?: number;
  onResetZoom?: () => void;
  /** manda o zoom para um valor exato: usado pela trava de enquadramento */
  onZoomTo?: (z: number) => void;
  /** onde o Juggler esta: ancora das pecas presas nele (ponta da vara) */
  playerXRef?: React.MutableRefObject<number>;
  onExit: () => void;
}

const HANDLES: Handle[] = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'];

/**
 * A MOLDURA DO JOGADOR: que pedaco de mundo cabe na tela de quem joga.
 *
 * Isto era a pergunta sem resposta do editor. Voce colocava um coqueiro na
 * praia sem saber se ele ia aparecer inteiro, se ia ser cortado ao meio ou se
 * ia ficar fora da tela - porque o editor tem zoom proprio e mostrava um
 * enquadramento que nao e o do jogo. Descobrir dava uma volta inteira: sair do
 * editor, andar ate la, olhar, voltar, corrigir.
 *
 * A conta vem do `usePlayer`, ao contrario:
 *
 *   escala = (altura da tela / frameH) * moldura
 *   altura visivel = altura da tela / escala = frameH / moldura
 *   largura visivel = altura visivel * (largura da tela / altura da tela)
 *
 * e o topo sai da ancora da linha d'agua, que e o que fica parado quando a
 * camera abre. As duas molduras do jogo (`frameLand` na praia, `frameSea` no
 * pier) dao dois retangulos diferentes, e sao os dois que interessam ver.
 */
function molduraRect(
  frame: number,
  mundo: { frameH: number; waterY: number; waterAnchor: number },
  centroX: number,
): { x: number; y: number; w: number; h: number } {
  const h = mundo.frameH / frame;
  const razao = window.innerWidth / Math.max(1, window.innerHeight);
  const w = h * razao;
  return { x: centroX - w / 2, y: mundo.waterY - h * mundo.waterAnchor, w, h };
}

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
  camYRef,
  scale,
  viewY,
  viewX = 0,
  zoom = 1,
  onResetZoom,
  onZoomTo,
  playerXRef,
  onExit,
}: Props) {
  const sceneId = useActiveScene();
  const scene = useScene();
  const fx = useFx();
  const preview = usePreview();
  const mundo = useWorld();
  /** o menu nao tem pescaria, entao nao tem o que simular la */
  const hasMechanics = sceneId === 'mundo' && Boolean(playerXRef);

  const [layer, setLayer] = useState<WorkLayer>('todas');
  const [selected, setSelected] = useState<string | null>(null);
  const [fxSel, setFxSel] = useState<string | null>(null);
  const [panel, setPanel] = useState<
    'biblioteca' | 'cena' | 'animacoes' | 'mecanicas' | 'mundo' | 'flutuadores' | null
  >('biblioteca');
  /** menu de formas geometricas aberto no topo */
  const [formas, setFormas] = useState(false);
  const [menu, setMenu] = useState<{ x: number; y: number; id: string } | null>(null);
  /** filtro da lista da cena, por nome do sprite / da area / do id */
  const [busca, setBusca] = useState('');
  const [cam, setCam] = useState(() => camXRef.current);
  /**
   * A tela do editor tambem desce.
   *
   * Antes so existia `cam` (o eixo X): o editor era um trilho horizontal, e o
   * mar fundo e o subsolo da praia so davam para ver na camera livre, fora do
   * editor - ou seja, davam para OLHAR e nao para editar. Agora ha os dois
   * eixos, e o limite e o mundo inteiro.
   */
  const [camY, setCamY] = useState(() => camYRef?.current ?? 0);
  /** enquadramento do jogador desenhado por cima da cena */
  const [guia, setGuia] = useState(false);
  /** onde a moldura do jogador esta centrada, em unidades de mundo */
  const [guiaX, setGuiaX] = useState<number | null>(null);
  /** a tela do editor esta travada numa das molduras do jogo */
  const [travado, setTravado] = useState<'praia' | 'mar' | null>(null);
  const [dragAsset, setDragAsset] = useState<string | null>(null);
  const [ghost, setGhost] = useState<{ x: number; y: number } | null>(null);
  const drag = useRef<Drag>(null);

  useEffect(() => {
    camXRef.current = cam;
  }, [cam, camXRef]);

  useEffect(() => {
    if (camYRef) camYRef.current = camY;
  }, [camY, camYRef]);

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

  /**
   * Leva a tela ate o objeto e o deixa selecionado.
   *
   * Numa cena de quase cem pecas, achar na lista e depois cacar no mapa era o
   * trabalho chato de verdade. No menu nao ha para onde andar (a cena cabe
   * inteira na tela), entao ali isso so seleciona.
   */
  const goTo = useCallback(
    (o: SceneObject) => {
      setLayer('todas');
      setSelected(o.locked ? null : o.id);
      if (sceneId === 'menu') return;
      const view = window.innerWidth / scale;
      // sem `Math.max(0, ...)`: metade do cenario mora em x negativo (o mar
      // aberto comeca em -5800) e a lista precisa conseguir chegar la
      setCam(o.x + o.w / 2 - view / 2);
      setCamY(clampPan(-(o.y + o.h / 2 - mundo.waterY)));
      setTravado(null);
    },
    [sceneId, scale, mundo.waterY],
  );

  /*
   * Tela <-> mundo.
   *
   * O mundo e desenhado com `translate(0, viewY + camY*escala) scale(escala)`
   * por dentro e `translate(-cam)` por fora. As duas contas abaixo sao essa
   * mesma transformacao, para frente e para tras - e e por isso que elas
   * PRECISAM conhecer o `camY`: sem ele, descer a tela deixaria toda caixa de
   * selecao do editor flutuando longe do sprite que ela deveria cercar.
   */
  const toScreen = useCallback(
    (x: number, y: number) => ({
      x: (x - cam) * scale + viewX,
      y: (y + camY) * scale + viewY,
    }),
    [cam, camY, scale, viewX, viewY],
  );
  const toWorld = useCallback(
    (px: number, py: number) => ({
      x: (px - viewX) / scale + cam,
      y: (py - viewY) / scale - camY,
    }),
    [cam, camY, scale, viewX, viewY],
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
  // peca escondida continua na lista do painel, mas some da area de trabalho
  const stepItems = step ? fx.items.filter((i) => i.steps.includes(step.id) && !i.off) : [];
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

      /*
       * Desfazer / refazer, na pilha certa.
       *
       * Com a simulacao de mecanica ligada voce esta mexendo em PECA DE
       * MECANICA, nao em cena - e o Ctrl+Z tem de desfazer isso. Antes havia
       * uma pilha so, entao desfazer dentro da animacao ia comendo mudanca de
       * cenario que voce nem estava olhando. Sao duas pilhas separadas agora.
       */
      if ((e.ctrlKey || e.metaKey) && (e.code === 'KeyZ' || e.code === 'KeyY')) {
        e.preventDefault();
        const wantRedo = e.code === 'KeyY' || e.shiftKey;
        const naMecanica = getPreview().mechanic !== null;
        if (naMecanica) {
          if (wantRedo) redoFx();
          else undoFx();
        } else if (wantRedo) {
          redo();
        } else {
          undo();
        }
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
      drag.current = { mode: 'pan', px, py, cam, camY };
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
          beginFxBatch();
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
      drag.current = { mode: 'pan', px, py, cam, camY };
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
        // travado numa moldura do jogo, a tela nao sai do lugar: e esse o
        // sentido de travar - o que voce ve e o que o jogador ve
        if (travado) return;
        /*
         * Arrasto livre, nos dois eixos.
         *
         * O `Math.max(0, ...)` que estava aqui prendia a tela no zero do mundo.
         * So que o mar aberto comeca em -5800: metade da agua ficava do outro
         * lado de uma parede invisivel, e era por isso que so dava para ver o
         * resto do mar na camera livre. Sem limite nenhum agora - no editor a
         * tela vai aonde voce arrastar.
         */
        setCam(d.cam - (px - d.px) / scale);
        setCamY(clampPan(d.camY + (py - d.py) / scale));
        return;
      }

      if (d.mode === 'guia') {
        setGuiaX(Math.round(d.base + (px - d.px) / scale));
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
      endFxBatch();
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
  }, [dragAsset, scale, cam, camY, layer, sceneId, travado, toWorld]);

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
    beginFxBatch();
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

  /**
   * O centro da area de trabalho, em unidades de mundo.
   *
   * E onde cai tudo o que voce cria com um clique - asset da biblioteca, forma
   * geometrica, parede. Antes so dava para criar arrastando, e no editor do
   * MENU o arrasto nao chegava a lugar nenhum: era esse o motivo de "o editor
   * do menu nao me deixa adicionar objeto".
   */
  const centro = useCallback(() => {
    if (sceneId === 'menu') return { x: MENU_W / 2, y: MENU_H / 2 };
    return { x: cam + window.innerWidth / scale / 2, y: 320 };
  }, [sceneId, cam, scale]);

  /** Poe um asset da biblioteca na cena e o deixa selecionado. */
  const soltarAsset = useCallback(
    (path: string) => {
      const c = centro();
      const obj = addSprite(path, layer === 'todas' ? 'objetos' : layer, c.x, c.y, 120);
      setLayer('todas');
      setSelected(obj.id);
    },
    [centro, layer],
  );

  const criarForma = useCallback(
    (shape: ShapeKind) => {
      const c = centro();
      const obj = addShape(shape, c.x, c.y, layer === 'todas' ? 'objetos' : layer);
      setLayer('todas');
      setSelected(obj.id);
      setFormas(false);
    },
    [centro, layer],
  );

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

  const zones = scene.objects.filter(
    (o) => o.kind === 'zone' && !o.off && !scene.hidden.includes(o.layer),
  );
  const selBox = sel ? toScreen(sel.x, sel.y) : null;

  // ------------------------------------------- moldura do jogador (a guia)
  const centroGuia = guiaX ?? playerXRef?.current ?? rodX();
  const molduras =
    guia && sceneId === 'mundo'
      ? ([
          { id: 'praia' as const, label: 'TELA NA ILHA', frame: mundo.frameLand },
          { id: 'mar' as const, label: 'TELA NO PÍER', frame: mundo.frameSea },
        ].map((m) => ({ ...m, rect: molduraRect(m.frame, mundo, centroGuia) })))
      : [];

  /**
   * Trava a tela do editor numa das molduras do jogo.
   *
   * Ver o retangulo ja ajuda; trabalhar DENTRO dele e outra coisa. Travar poe
   * o zoom e a camera do editor exatamente nos valores que o jogo usaria, e
   * entao a area de trabalho vira a tela do jogador - o que couber aqui, coube
   * la. Enquanto travado o arrasto de tela fica desligado, senao o primeiro
   * puxao ja desfaz a trava sem avisar.
   */
  const travar = useCallback(
    (qual: 'praia' | 'mar') => {
      if (!onZoomTo) return;
      const alvoFrame = qual === 'praia' ? mundo.frameLand : mundo.frameSea;
      const r = molduraRect(alvoFrame, mundo, centroGuia);

      /*
       * Que zoom do editor da a escala do jogo nesta moldura.
       *
       * A escala e sempre `(altura da tela / frameH) * zoom * moldura`. O
       * editor nao recebe a moldura em que o jogo esta, mas recebe a escala e
       * o zoom - e a moldura sai dessa divisao. Dai o zoom que se quer e o que
       * substitui a moldura de agora pela moldura pedida.
       */
      const base = window.innerHeight / mundo.frameH;
      const molduraAtual = scale / (base * zoom);
      onZoomTo((zoom * alvoFrame) / molduraAtual);

      // com a escala do jogo, `camY = 0` e exatamente a ancora da linha d'agua:
      // e assim que a tela do editor passa a ser a tela do jogador
      setCam(r.x);
      setCamY(0);
      setTravado(qual);
      setGuia(true);
    },
    [centroGuia, mundo, onZoomTo, scale, zoom],
  );

  return (
    <div className="editor">
      {/* --------------------------------------------------- area de trabalho */}
      <div
        className="editor-canvas"
        onPointerDown={onPointerDown}
        // dar zoom desfaz a trava: a moldura travada so vale enquanto a escala
        // for exatamente a do jogo, e seria pior deixar o rotulo mentindo
        onWheel={() => travado && setTravado(null)}
        onContextMenu={(e) => e.preventDefault()}
      >
        {/* areas de interacao: so aparecem aqui dentro */}
        {zones.map((z) => {
          const p = toScreen(z.x, z.y);
          return (
            <div
              key={z.id}
              className={`editor-zone ${z.zone ?? ''}${selected === z.id ? ' on' : ''}`}
              style={{ left: p.x, top: p.y, width: z.w * scale, height: z.h * scale }}
            >
              <span>{ZONE_LABEL[z.zone ?? 'vara']}</span>
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

        {/* ------------------------------------- a moldura do jogador */}
        {molduras.map((m) => {
          const p = toScreen(m.rect.x, m.rect.y);
          return (
            <div
              key={m.id}
              className={`editor-moldura ${m.id}${travado === m.id ? ' travada' : ''}`}
              style={{ left: p.x, top: p.y, width: m.rect.w * scale, height: m.rect.h * scale }}
            >
              <span className="moldura-tag">
                {m.label}
                <small>
                  {Math.round(m.rect.w)} × {Math.round(m.rect.h)} un
                  {travado === m.id ? ' · TRAVADA' : ''}
                </small>
              </span>
            </div>
          );
        })}

        {/* a haste que arrasta as duas molduras pelo mapa de uma vez */}
        {guia && sceneId === 'mundo' && !travado && (
          <div
            className="editor-guia-haste"
            style={{ left: toScreen(centroGuia, 0).x }}
            onPointerDown={(e) => {
              if (e.button !== 0) return;
              e.stopPropagation();
              const rect = (e.currentTarget.closest('.editor-canvas') as HTMLElement).getBoundingClientRect();
              drag.current = { mode: 'guia', px: e.clientX - rect.left, base: centroGuia };
            }}
            title="Arraste para levar a moldura ao ponto do mapa que você quer conferir"
          >
            <i />
          </div>
        )}

        {ghost && dragAsset && (
          <img className="editor-ghost" src={asset(dragAsset)} alt="" style={{ left: ghost.x, top: ghost.y }} />
        )}
      </div>

      {/* ------------------------------------------------------------ topo */}
      <div className="editor-bar">
        <span className="editor-badge">{sceneId === 'menu' ? 'EDITOR DO MENU' : 'MODO EDITOR'}</span>
        {/* Na simulacao de mecanica os botoes desfazem MECANICA; fora dela,
            CENA. E a mesma regra do Ctrl+Z, so que visivel. */}
        <button
          className="ebtn"
          disabled={preview.mechanic ? !canUndoFx() : !canUndo()}
          onClick={() => (preview.mechanic ? undoFx() : undo())}
          title={preview.mechanic ? 'Ctrl+Z · desfaz na mecânica' : 'Ctrl+Z · desfaz na cena'}
        >
          DESFAZER{preview.mechanic ? ' (MEC.)' : ''}
        </button>
        <button
          className="ebtn"
          disabled={preview.mechanic ? !canRedoFx() : !canRedo()}
          onClick={() => (preview.mechanic ? redoFx() : redo())}
          title="Ctrl+Shift+Z"
        >
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
        <button
          className="ebtn"
          onClick={() => {
            stopPreview();
            setPanel(panel === 'mundo' ? null : 'mundo');
          }}
          title="Altura do mar, profundidade, largura, areia, ondas e enquadramento"
        >
          MUNDO
        </button>
        <button
          className="ebtn"
          onClick={() => {
            stopPreview();
            setPanel(panel === 'flutuadores' ? null : 'flutuadores');
          }}
          title="Nuvens, pássaros e o que mais atravessa o céu"
        >
          FLUTUADORES
        </button>
        <div className="eshape-wrap">
          <button className="ebtn" onClick={() => setFormas((v) => !v)} title="Criar uma forma geométrica colorida">
            FORMAS ▾
          </button>
          {formas && (
            <div className="eshapes">
              {SHAPES.map((f) => (
                <button key={f.id} onClick={() => criarForma(f.id)}>
                  {f.label}
                </button>
              ))}
              <button
                onClick={() => {
                  const c = centro();
                  const w = addWall(c.x, c.y);
                  setLayer('todas');
                  setSelected(w.id);
                  setFormas(false);
                }}
              >
                PAREDE NOVA
              </button>
            </div>
          )}
        </div>
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
        {sceneId === 'mundo' && (
          <button
            className={`ebtn${guia ? ' primary' : ''}`}
            onClick={() => {
              setGuia((v) => !v);
              if (guia) setTravado(null);
            }}
            title="Mostra o retângulo que o jogador enxerga, nas duas molduras do jogo"
          >
            TELA DO JOGADOR
          </button>
        )}
        {guia && sceneId === 'mundo' && onZoomTo && (
          <div className="eshape-wrap">
            <button
              className={`ebtn${travado ? ' primary' : ''}`}
              onClick={() => {
                if (travado) {
                  setTravado(null);
                  return;
                }
                travar('praia');
              }}
              title="Põe a área de trabalho exatamente no enquadramento do jogo"
            >
              {travado ? `DESTRAVAR (${travado === 'praia' ? 'ILHA' : 'PÍER'})` : 'TRAVAR NA ILHA'}
            </button>
            {!travado && (
              <button className="ebtn" onClick={() => travar('mar')} title="Enquadramento aberto do píer">
                TRAVAR NO PÍER
              </button>
            )}
          </div>
        )}
        {onResetZoom && (
          <button
            className="ebtn"
            onClick={() => {
              onResetZoom();
              setTravado(null);
            }}
            title="Roda do mouse dá zoom (sem Ctrl, aqui dentro) · clique volta a 100%"
          >
            ZOOM {Math.round(zoom * 100)}%
          </button>
        )}
        {sceneId === 'mundo' && (camY !== 0 || cam !== 0) && (
          <button
            className="ebtn"
            onClick={() => {
              setCamY(0);
              setTravado(null);
            }}
            title="Devolve a altura da tela para a linha d'água"
            disabled={camY === 0}
          >
            CENTRAR ALTURA
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
          ARRASTAR NO VAZIO MOVE A TELA (PRA CIMA E PRA BAIXO TAMBÉM) &middot; RODA DÁ ZOOM
          &middot; ALÇAS REDIMENSIONAM &middot; BOTÃO DIREITO ABRE O MENU &middot; CTRL+Z DESFAZ
          &middot; DEL APAGA
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

            {/* Opacidade vale para TUDO: sprite, faixa e forma. Era o que
                faltava para enfiar um vulto no fundo do mar sem ele gritar. */}
            <SliderField
              label="OPACIDADE"
              value={sel.opacity ?? 1}
              onChange={(v) => updateObject(sel.id, { opacity: v })}
            />

            {/* ------------------------------------------- forma geométrica */}
            {sel.kind === 'forma' && (
              <>
                <div className="etitle" style={{ marginTop: 8 }}>
                  FORMA
                </div>
                <label className="efield">
                  DESENHO
                  <select
                    value={sel.shape ?? 'retangulo'}
                    onChange={(e) => updateObject(sel.id, { shape: e.target.value as ShapeKind })}
                  >
                    {SHAPES.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.label}
                      </option>
                    ))}
                  </select>
                </label>
                <ColorField
                  label="COR DE DENTRO"
                  value={sel.fill ?? '#2fd6c9'}
                  onChange={(v) => updateObject(sel.id, { fill: v })}
                />
                <ColorField
                  label="COR DA BORDA"
                  value={sel.stroke ?? ''}
                  allowEmpty
                  onChange={(v) => updateObject(sel.id, { stroke: v })}
                />
                {sel.stroke && (
                  <label className="efield">
                    GROSSURA DA BORDA
                    <input
                      type="number"
                      min={1}
                      value={sel.strokeW ?? 4}
                      onChange={(e) => updateObject(sel.id, { strokeW: Math.max(1, Number(e.target.value)) })}
                    />
                  </label>
                )}
                {sel.shape === 'retangulo' && (
                  <label className="efield">
                    CANTO ARREDONDADO
                    <input
                      type="number"
                      min={0}
                      value={sel.radius ?? 0}
                      onChange={(e) => updateObject(sel.id, { radius: Math.max(0, Number(e.target.value)) })}
                    />
                  </label>
                )}
              </>
            )}

            {/* --------------------------------------- área de interação */}
            {sel.kind === 'zone' && (
              <>
                <div className="etitle" style={{ marginTop: 8 }}>
                  {ZONE_LABEL[sel.zone ?? 'vara']}
                </div>
                <div className="ehint">
                  {sel.zone === 'parede'
                    ? 'Barra o Juggler pelo lado de onde ele vem. Arraste para abrir ou fechar o mapa; apague para tirar o limite.'
                    : sel.zone === 'limiar'
                      ? 'A fronteira dos dois enquadramentos: à esquerda a câmera abre para o mar, à direita ela fecha na superfície. Ajuste o zoom de cada lado na seção MUNDO.'
                      : sel.zone === 'vara'
                        ? 'Onde a pescaria abre. O Juggler para no meio dela.'
                        : sel.zone === 'spawn'
                          ? 'Onde o Juggler nasce. É para o meio desta caixa que o botão "Travei!" do celular o traz de volta — arraste-a e o ponto de partida muda junto.'
                          : 'Onde o mercado de peixe abre.'}
                </div>
                {sel.zone === 'parede' && (
                  <div className="erow">
                    <button className="ebtn" onClick={() => updateObject(sel.id, { off: !sel.off })}>
                      {sel.off ? 'LIGAR PAREDE' : 'DESLIGAR PAREDE'}
                    </button>
                    <button
                      className="ebtn danger"
                      onClick={() => {
                        removeObject(sel.id);
                        setSelected(null);
                      }}
                    >
                      APAGAR
                    </button>
                  </div>
                )}
              </>
            )}

            {/* ---------------------- peça de interface da tela de título */}
            {sel.role && sel.role !== 'vara' && (
              <div className="ehint">
                Peça da interface do menu. A caixa é onde ela é desenhada - arraste e estique para
                recolocar o Juggler, o título, os botões ou a vinheta.
              </div>
            )}

            <div className="erow">
              <button className="ebtn" onClick={() => updateObject(sel.id, { off: !sel.off })}>
                {sel.off ? 'MOSTRAR' : 'ESCONDER'}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ------------------------------------------------------- biblioteca */}
      {panel === 'biblioteca' && (
        <LibraryPanel
          onAddAsset={soltarAsset}
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
          <div className="elib-tools">
            <input
              value={busca}
              placeholder="buscar por nome"
              onChange={(e) => setBusca(e.target.value)}
            />
            {busca && (
              <button className="ebtn" onClick={() => setBusca('')}>
                LIMPAR
              </button>
            )}
          </div>

          <div className="elist">
            {LAYERS.map((l) => {
              const termo = busca.trim().toLowerCase();
              const list = scene.objects.filter((o) => {
                if (o.layer !== l.id) return false;
                if (!termo) return true;
                return `${o.sprite ?? ''} ${o.zone ?? ''} ${o.id}`.toLowerCase().includes(termo);
              });
              if (termo && list.length === 0) return null;
              return (
                <div key={l.id}>
                  <div className="elib-cat">
                    <span className="grow">{l.label}</span>
                    <small>{list.length}</small>
                    {scene.hidden.includes(l.id) && <span className="off">ESCONDIDA</span>}
                  </div>
                  {list.map((o) => (
                    <button
                      key={o.id}
                      className={`eitem eitem-thumb${selected === o.id ? ' on' : ''}${o.locked ? ' locked' : ''}`}
                      title={`${o.sprite || o.zone || o.id}\nClique seleciona · duplo clique leva a tela até ele`}
                      onClick={() => {
                        setLayer('todas');
                        setSelected(o.locked ? null : o.id);
                      }}
                      onDoubleClick={() => goTo(o)}
                    >
                      <span className="ethumb">
                        {o.sprite ? (
                          <img src={asset(o.sprite)} alt="" />
                        ) : (
                          <i className={o.kind === 'zone' ? 'ezone' : 'emass'} />
                        )}
                      </span>
                      <span className="grow">{o.sprite || o.zone || o.id}</span>
                      <span className="edepth-tag">{o.depth}</span>
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
              );
            })}
          </div>
          <div className="ehint">
            Duplo clique leva a tela até o objeto. O número à direita é a profundidade.
          </div>
        </div>
      )}

      {panel === 'animacoes' && <AnimationsPanel />}

      {panel === 'mundo' && <WorldPanel />}

      {panel === 'flutuadores' && <FloatersPanel />}

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
                    {/* INTERAGÍVEIS e MARCADORES são gavetas de área, não de
                        sprite: mandar um coqueiro para lá só o esconderia numa
                        lista onde ninguém vai procurar por coqueiro */}
                    {LAYERS.filter((l) => l.id !== 'interagiveis' && l.id !== 'marcadores').map((l) => (
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
