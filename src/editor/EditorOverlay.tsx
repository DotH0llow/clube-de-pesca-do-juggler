import { useCallback, useEffect, useRef, useState } from 'react';
import { asset } from '../assets';
import {
  addAction,
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
  parallaxFactor,
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
import { panMaxY, panMinY, updateWorld, useWorld } from '../world/worldConfig';
import { CLIP_FRAMES } from '../world/charFrames';

/**
 * Os clipes de personagem que existem no pacote, para o editor oferecer.
 *
 * Sai do registro gerado pelo importador, e nao de uma lista escrita na mao:
 * soltar uma pasta de quadros nova em `game/char/` faz ela aparecer aqui
 * sozinha, que e a mesma regra da secao ANIMAÇÕES.
 */
const CLIPES = Object.entries(CLIP_FRAMES)
  .map(([nome, quadros]) => ({ nome, quadros }))
  .sort((a, b) => a.nome.localeCompare(b.nome));

/** Prende o deslocamento vertical da tela dentro do mundo. */
function clampPan(v: number): number {
  return Math.min(panMaxY(), Math.max(panMinY(), v));
}

/**
 * Limites do enquadramento.
 *
 * Abaixo de 0,15 a camera abre tanto que o Juggler vira um ponto; acima de 2,5
 * ela fecha no rosto dele. Sao os mesmos limites do slider da secao MUNDO, para
 * arrastar a moldura e mexer no slider nao darem resultados diferentes.
 */
function clampFrame(v: number): number {
  return Math.min(2.5, Math.max(0.15, Number(v.toFixed(4))));
}

type Handle = 'nw' | 'ne' | 'sw' | 'se' | 'n' | 's' | 'e' | 'w';
type Drag =
  | { mode: 'move'; id: string; ox: number; oy: number; px: number; py: number; grupo: { id: string; ox: number; oy: number }[] }
  | { mode: 'scale'; id: string; handle: Handle; start: SceneObject; px: number; py: number }
  | { mode: 'rot'; id: string; cx: number; cy: number; start: number; base: number }
  | { mode: 'fx-move'; id: string; ox: number; oy: number; px: number; py: number }
  | { mode: 'fx-scale'; id: string; handle: Handle; start: FxItem; px: number; py: number }
  | { mode: 'pan'; px: number; py: number; cam: number; camY: number }
  | { mode: 'guia'; px: number; base: number }
  | { mode: 'moldura'; qual: 'praia' | 'mar'; borda: 'n' | 's'; py: number; frame: number }
  | { mode: 'ancora'; py: number; base: number }
  | { mode: 'laco'; px: number; py: number; base: string[] }
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
  /**
   * A SELECAO, agora no plural.
   *
   * Era um id so. Virou lista, e o ULTIMO da lista e o principal: e dele que o
   * inspetor mostra as medidas, e e em volta dele que a caixa com alcas e
   * desenhada. Redimensionar e girar continuam valendo para um objeto de cada
   * vez - esticar dez pecas de tamanhos diferentes ao mesmo tempo daria dez
   * resultados que ninguem pediu. Arrastar, apagar, esconder e mover com as
   * setas valem para a lista inteira.
   *
   * `setSelected` continua existindo com a assinatura antiga (um id ou nulo)
   * de proposito: as duas dezenas de lugares que ja chamavam essa funcao
   * querem exatamente isso - trocar a selecao por uma peca so.
   */
  const [selIds, setSelIds] = useState<string[]>([]);
  const selected = selIds.length ? selIds[selIds.length - 1] : null;
  const setSelected = useCallback((id: string | null) => setSelIds(id ? [id] : []), []);

  /** Soma ou tira uma peca da selecao, sem mexer no resto (Ctrl+clique). */
  const alternarSel = useCallback((id: string) => {
    setSelIds((atual) =>
      atual.includes(id) ? atual.filter((x) => x !== id) : [...atual, id],
    );
  }, []);

  /** O painel de camadas recolhe para liberar o canto esquerdo da tela. */
  const [camadasAbertas, setCamadasAbertas] = useState(true);
  /** Pastas fechadas na aba CENA, por camada. */
  const [pastasFechadas, setPastasFechadas] = useState<LayerId[]>([]);
  /** Retangulo do laco de selecao, em coordenada de tela. */
  const [laco, setLaco] = useState<{ x0: number; y0: number; x1: number; y1: number } | null>(null);
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
   * A ordem em que a lista da aba CENA aparece na tela.
   *
   * O intervalo do Shift precisa seguir a ORDEM VISIVEL, e nao a ordem da cena:
   * a lista e agrupada por camada, e dentro de pasta fechada nao ha item para
   * pegar. Sem isto, Shift entre duas pecas de camadas diferentes arrastaria
   * junto tudo que estivesse entre elas na lista interna - inclusive coisa que
   * voce nao esta vendo.
   */
  const ordemVisivel = useCallback((): string[] => {
    const termo = busca.trim().toLowerCase();
    const out: string[] = [];
    for (const l of LAYERS) {
      if (!termo && pastasFechadas.includes(l.id)) continue;
      for (const o of scene.objects) {
        if (o.layer !== l.id) continue;
        if (termo && !`${o.sprite ?? ''} ${o.zone ?? ''} ${o.id}`.toLowerCase().includes(termo)) {
          continue;
        }
        out.push(o.id);
      }
    }
    return out;
  }, [scene.objects, busca, pastasFechadas]);

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
   * por dentro e `translate(-cam × fator)` por fora. As duas contas abaixo sao
   * essa mesma transformacao, para frente e para tras.
   *
   * Dois detalhes que elas PRECISAM conhecer:
   *
   *   - o `camY`, senao descer a tela deixaria toda caixa de selecao flutuando
   *     longe do sprite que ela deveria cercar;
   *   - o FATOR DE PARALLAX. O horizonte e desenhado em containers que andam
   *     0,22 e 0,52 do que a camera anda. Enquanto so as tiras de horizonte
   *     tinham parallax ninguem reparou; com as ilhas viradas sprite solto,
   *     a caixa aparecia a metade da tela de distancia da ilha. `fator = 1` e
   *     o mundo que anda junto com a camera, que e o caso da grande maioria.
   *
   * No MENU nao ha camera nem containers de parallax - a cena e desenhada num
   * quadro fixo - entao la o fator e sempre 1.
   */
  const fatorDe = useCallback(
    (o?: Pick<SceneObject, 'parallax'>) =>
      !o || sceneId === 'menu' ? 1 : parallaxFactor(o),
    [sceneId],
  );

  const toScreen = useCallback(
    (x: number, y: number, fator = 1) => ({
      x: (x - cam * fator) * scale + viewX,
      y: (y + camY) * scale + viewY,
    }),
    [cam, camY, scale, viewX, viewY],
  );
  const toWorld = useCallback(
    (px: number, py: number, fator = 1) => ({
      x: (px - viewX) / scale + cam * fator,
      y: (py - viewY) / scale - camY,
    }),
    [cam, camY, scale, viewX, viewY],
  );

  /** A caixa de um objeto já em coordenada de tela, com o parallax dele. */
  const caixaNaTela = useCallback(
    (o: SceneObject) => {
      const p = toScreen(o.x, o.y, fatorDe(o));
      return { x: p.x, y: p.y, w: o.w * scale, h: o.h * scale };
    },
    [toScreen, fatorDe, scale],
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
    (px: number, py: number): SceneObject | null => {
      const list = scene.objects
        .filter((o) => layer === 'todas' || o.layer === layer)
        .filter((o) => !o.locked && !scene.hidden.includes(o.layer))
        // o teste e feito em coordenada de TELA, um objeto por vez: cada um
        // tem o proprio fator de parallax, entao nao existe um "ponto do
        // mundo" unico que sirva para todos ao mesmo tempo
        .filter((o) => {
          const r = caixaNaTela(o);
          return px >= r.x && px <= r.x + r.w && py >= r.y && py <= r.y + r.h;
        });
      if (list.length === 0) return null;
      return list.reduce((best, o) => (o.depth >= best.depth ? o : best));
    },
    [scene.objects, scene.hidden, layer, caixaNaTela],
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
      /* Ctrl+A pega a camada de trabalho inteira. */
      if ((e.ctrlKey || e.metaKey) && e.code === 'KeyA') {
        e.preventDefault();
        setSelIds(
          scene.objects
            .filter((o) => layer === 'todas' || o.layer === layer)
            .filter((o) => !o.locked && !scene.hidden.includes(o.layer))
            .map((o) => o.id),
        );
        return;
      }

      if (selIds.length === 0) return;
      // apagar e empurrar com as setas valem para a SELECAO INTEIRA
      const alvos = scene.objects.filter((x) => selIds.includes(x.id) && !x.locked);
      if (alvos.length === 0) return;
      const step = e.shiftKey ? 10 : 1;
      if (e.code === 'Delete' || e.code === 'Backspace') {
        e.preventDefault();
        for (const a of alvos) removeObject(a.id);
        setSelIds([]);
      } else if (e.code === 'ArrowLeft') {
        e.preventDefault();
        for (const a of alvos) updateObject(a.id, { x: a.x - step });
      } else if (e.code === 'ArrowRight') {
        e.preventDefault();
        for (const a of alvos) updateObject(a.id, { x: a.x + step });
      } else if (e.code === 'ArrowUp') {
        e.preventDefault();
        for (const a of alvos) updateObject(a.id, { y: a.y - step });
      } else if (e.code === 'ArrowDown') {
        e.preventDefault();
        for (const a of alvos) updateObject(a.id, { y: a.y + step });
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [selIds, scene.objects, scene.hidden, layer]);

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
        .find((o) => {
          const r = caixaNaTela(o);
          return px >= r.x && px <= r.x + r.w && py >= r.y && py <= r.y + r.h;
        });
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

    const found = hit(px, py);
    if (found) {
      /*
       * Ctrl SOMA a peca a selecao; sem Ctrl, ela vira a selecao.
       *
       * Clicar numa peca que JA esta selecionada nao refaz a selecao - senao
       * arrastar um grupo pelo meio de uma das pecas jogaria as outras fora
       * no primeiro clique, que e o oposto do que arrastar um grupo quer
       * dizer.
       */
      let alvo = selIds;
      if (e.ctrlKey || e.metaKey) {
        alvo = selIds.includes(found.id)
          ? selIds.filter((x) => x !== found.id)
          : [...selIds, found.id];
        setSelIds(alvo);
      } else if (!selIds.includes(found.id)) {
        alvo = [found.id];
        setSelIds(alvo);
      }
      if (!alvo.includes(found.id)) return;
      beginBatch();
      const grupo = scene.objects
        .filter((o) => alvo.includes(o.id) && !o.locked)
        .map((o) => ({ id: o.id, ox: o.x, oy: o.y }));
      drag.current = { mode: 'move', id: found.id, ox: found.x, oy: found.y, px, py, grupo };
      return;
    }

    /*
     * No vazio: LACO DE SELECAO, e nao mais arrastar a tela.
     *
     * Arrastar a tela mudou para o botao do MEIO e para Alt+esquerdo. A troca e
     * proposital: o laco e o gesto que se usa o tempo todo montando cena, e o
     * botao esquerdo no vazio e onde a mao vai primeiro. Com Ctrl o laco SOMA a
     * quem ja estava selecionado.
     */
    if (e.altKey) {
      drag.current = { mode: 'pan', px, py, cam, camY };
      return;
    }
    const base = e.ctrlKey || e.metaKey ? selIds : [];
    if (!e.ctrlKey && !e.metaKey) setSelIds([]);
    setLaco({ x0: px, y0: py, x1: px, y1: py });
    drag.current = { mode: 'laco', px, py, base };
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

      /*
       * Esticar a moldura MUDA O ENQUADRAMENTO DO JOGO.
       *
       * A moldura mostrava o que o jogador ve e nao deixava mexer em nada -
       * era um adesivo. Mas ela e um retangulo derivado de dois numeros da
       * secao MUNDO, e a conta inverte:
       *
       *   altura visivel = frameH / moldura   =>   moldura = frameH / altura
       *
       * Entao arrastar a borda de cima ou de baixo e escrever direto em
       * `frameLand` ou `frameSea`. Puxar para fora abre a camera (mostra mais
       * mundo, tudo menor); empurrar para dentro fecha. A largura acompanha
       * sozinha, porque ela e a altura vezes a proporcao da tela - o jogador
       * nao tem como ver um retangulo de outro formato que nao o do monitor
       * dele.
       */
      if (d.mode === 'moldura') {
        const alturaAtual = mundo.frameH / d.frame;
        const arrasto = (py - d.py) / scale;
        // a borda de cima cresce para cima: puxar para cima aumenta a altura
        const nova = alturaAtual + (d.borda === 'n' ? -arrasto : arrasto) * 2;
        const alvo = clampFrame(mundo.frameH / Math.max(120, nova));
        updateWorld(d.qual === 'praia' ? { frameLand: alvo } : { frameSea: alvo });
        return;
      }

      /*
       * Mover a moldura inteira no vertical MUDA A ANCORA DA LINHA D'AGUA.
       *
       * `waterAnchor` e a altura da tela em que a linha d'agua fica parada, de
       * 0 (topo) a 1 (pe). E o que decide quanto de ceu e quanto de mar o
       * jogador ve, e ate agora so dava para mexer nele no slider da secao
       * MUNDO, sem ver o resultado. Aqui e a moldura que arrasta.
       */
      if (d.mode === 'ancora') {
        const alvo = d.base + (py - d.py) / Math.max(1, window.innerHeight);
        updateWorld({ waterAnchor: Math.min(0.95, Math.max(0.05, Number(alvo.toFixed(4)))) });
        return;
      }
      if (d.mode === 'move') {
        // o grupo inteiro anda o MESMO tanto: cada peca sai da posicao em que
        // ela estava quando o arrasto comecou, e nao da posicao da peca clicada
        const dx = (px - d.px) / scale;
        const dy = (py - d.py) / scale;
        for (const g of d.grupo) {
          updateObject(g.id, { x: Math.round(g.ox + dx), y: Math.round(g.oy + dy) });
        }
        return;
      }

      if (d.mode === 'laco') {
        setLaco({ x0: d.px, y0: d.py, x1: px, y1: py });
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
      const d = drag.current;
      drag.current = null;
      endBatch();
      endFxBatch();

      /*
       * Fecha o laco: entra tudo que ENCOSTA no retangulo.
       *
       * Intersecao, e nao contencao total. Exigir a peca inteira dentro do
       * laco obrigaria a laçar o coqueiro de 300 unidades por completo so para
       * pega-lo junto com a tralha do deck; encostar e o que a mao espera.
       */
      if (d && d.mode === 'laco') {
        const el0 = host();
        const r0 = el0?.getBoundingClientRect();
        const px = r0 ? ev.clientX - r0.left : d.px;
        const py = r0 ? ev.clientY - r0.top : d.py;
        const x0 = Math.min(d.px, px);
        const x1 = Math.max(d.px, px);
        const y0 = Math.min(d.py, py);
        const y1 = Math.max(d.py, py);
        setLaco(null);
        // um arrasto de menos de 4 px e um clique que tremeu, nao um laco
        if (x1 - x0 < 4 && y1 - y0 < 4) {
          setSelIds(d.base);
          return;
        }
        const pegos = scene.objects
          .filter((o) => layer === 'todas' || o.layer === layer)
          .filter((o) => !o.locked && !scene.hidden.includes(o.layer))
          .filter((o) => {
            const c = caixaNaTela(o);
            return c.x < x1 && c.x + c.w > x0 && c.y < y1 && c.y + c.h > y0;
          })
          .map((o) => o.id);
        setSelIds([...new Set([...d.base, ...pegos])]);
        return;
      }

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
  }, [dragAsset, scale, cam, camY, layer, sceneId, travado, toWorld, mundo, scene.objects, scene.hidden, caixaNaTela]);

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
    const c = toScreen(sel.x + sel.w / 2, sel.y + sel.h / 2, fatorDe(sel));
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
  const selBox = sel ? caixaNaTela(sel) : null;

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
              width: selBox.w,
              height: selBox.h,
              transform: sel.rot ? `rotate(${sel.rot}deg)` : undefined,
            }}
          >
            {HANDLES.map((h) => (
              <i key={h} className={`h ${h}`} onPointerDown={(e) => startHandle(e, h)} />
            ))}
            <i className="rot" onPointerDown={startRotate} />
            {/* A ALÇA DE MOVER, como a do Canva.

                Arrastar pelo meio do objeto sempre funcionou, e continua
                funcionando - mas em peça fina (uma tábua de 9 unidades, uma
                corda) o "meio" é uma faixa de três pixels, e a mira escorrega
                para o que está atrás. A alça é um alvo grande e no mesmo lugar
                sempre, independente do tamanho da peça. */}
            <i
              className="mover"
              title="Arraste para mover a peça"
              onPointerDown={(e) => {
                if (!sel || e.button !== 0) return;
                e.stopPropagation();
                const host = (e.currentTarget as HTMLElement).closest('.editor-canvas') as HTMLElement;
                const r = host.getBoundingClientRect();
                beginBatch();
                drag.current = {
                  mode: 'move',
                  id: sel.id,
                  ox: sel.x,
                  oy: sel.y,
                  // a alça arrasta a SELEÇÃO INTEIRA, não só a peça principal
                  grupo: scene.objects
                    .filter((o) => selIds.includes(o.id) && !o.locked)
                    .map((o) => ({ id: o.id, ox: o.x, oy: o.y })),
                  px: e.clientX - r.left,
                  py: e.clientY - r.top,
                };
              }}
            />
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
          const inicio = (borda: 'n' | 's') => (e: React.PointerEvent) => {
            if (e.button !== 0) return;
            e.stopPropagation();
            const host = (e.currentTarget as HTMLElement).closest('.editor-canvas') as HTMLElement;
            drag.current = {
              mode: 'moldura',
              qual: m.id,
              borda,
              py: e.clientY - host.getBoundingClientRect().top,
              frame: m.frame,
            };
          };
          return (
            <div
              key={m.id}
              className={`editor-moldura ${m.id}${travado === m.id ? ' travada' : ''}`}
              style={{ left: p.x, top: p.y, width: m.rect.w * scale, height: m.rect.h * scale }}
            >
              <span className="moldura-tag">
                {m.label}
                <small>
                  {Math.round(m.rect.w)} × {Math.round(m.rect.h)} un &middot; {m.frame.toFixed(2)}×
                  {travado === m.id ? ' · TRAVADA' : ''}
                </small>
              </span>
              {/* as bordas de cima e de baixo esticam o enquadramento */}
              <i className="mborda n" onPointerDown={inicio('n')} title="Arraste para abrir ou fechar a câmera" />
              <i className="mborda s" onPointerDown={inicio('s')} title="Arraste para abrir ou fechar a câmera" />
              {/* e a pega do meio sobe e desce a linha d'água na tela */}
              <i
                className="mancora"
                title="Arraste para escolher em que altura da tela a linha d'água fica"
                onPointerDown={(e) => {
                  if (e.button !== 0) return;
                  e.stopPropagation();
                  const host = (e.currentTarget as HTMLElement).closest('.editor-canvas') as HTMLElement;
                  drag.current = {
                    mode: 'ancora',
                    py: e.clientY - host.getBoundingClientRect().top,
                    base: mundo.waterAnchor,
                  };
                }}
              />
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

        {/* as OUTRAS pecas da selecao: contorno simples, sem alcas.

            So o principal ganha alcas - esticar dez pecas de tamanhos
            diferentes de uma vez daria dez resultados que ninguem pediu. */}
        {selIds.length > 1 &&
          scene.objects
            .filter((o) => selIds.includes(o.id) && o.id !== selected)
            .map((o) => {
              const r = caixaNaTela(o);
              return (
                <div
                  key={o.id}
                  className="editor-sel-extra"
                  style={{ left: r.x, top: r.y, width: r.w, height: r.h }}
                />
              );
            })}

        {/* o laco */}
        {laco && (
          <div
            className="editor-laco"
            style={{
              left: Math.min(laco.x0, laco.x1),
              top: Math.min(laco.y0, laco.y1),
              width: Math.abs(laco.x1 - laco.x0),
              height: Math.abs(laco.y1 - laco.y0),
            }}
          />
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
              {sceneId === 'mundo' && (
                <>
                  <div className="emenu-sep">MARCADORES</div>
                  <button
                    onClick={() => {
                      const c = centro();
                      const a = addAction('animacao', c.x, groundAt(c.x) - 110);
                      setLayer('todas');
                      setSelected(a.id);
                      setFormas(false);
                    }}
                    title="Área que faz o Juggler tocar uma animação quando o jogador aperta E"
                  >
                    AÇÃO · ANIMAÇÃO
                  </button>
                  <button
                    onClick={() => {
                      const c = centro();
                      const a = addAction('pose', c.x, groundAt(c.x) - 110);
                      setLayer('todas');
                      setSelected(a.id);
                      setFormas(false);
                    }}
                    title="Área que trava o Juggler num quadro só, como sentar"
                  >
                    AÇÃO · POSE
                  </button>
                </>
              )}
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
          ARRASTAR NO VAZIO LAÇA &middot; ALT+ARRASTAR (OU BOTÃO DO MEIO) MOVE A TELA
          &middot; CTRL SOMA À SELEÇÃO &middot; SHIFT PEGA O INTERVALO NA LISTA &middot; CTRL+A
          PEGA TUDO &middot; RODA DÁ ZOOM &middot; CTRL+Z DESFAZ &middot; DEL APAGA
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
      {/* O painel recolhe.

          Ele ocupa o canto esquerdo inteiro e fica ali o tempo todo, mesmo
          quando o que voce quer e olhar o cenario que esta EMBAIXO dele.
          Recolhido, sobra so o cabecalho - e o cabecalho continua sendo o
          botao, entao voltar e um clique no mesmo lugar. */}
      <div className={`editor-layers${camadasAbertas ? '' : ' recolhido'}`}>
        <button
          className="etitle etoggle"
          onClick={() => setCamadasAbertas((v) => !v)}
          title={camadasAbertas ? 'Recolher o painel' : 'Abrir o painel'}
        >
          <span>TRABALHANDO EM</span>
          <i>{camadasAbertas ? '−' : '+'}</i>
        </button>
        {camadasAbertas && (
        <>
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
        </>
        )}

        {camadasAbertas && sel && (
          <div className="einspect">
            <div className="etitle">
              {selIds.length > 1 ? `SELECIONADOS (${selIds.length})` : 'SELECIONADO'}
            </div>
            {selIds.length > 1 && (
              <div className="ehint">
                Arrastar, apagar, esconder e as setas valem para as {selIds.length}. As medidas e
                as alças abaixo são da última que você clicou.
              </div>
            )}
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

                {/* ------------------------------ configuração da ação

                    Três campos e nada mais: o que a área faz, o que ela diz e
                    (em pose) qual quadro. A lista de clipes sai sozinha da
                    pasta de assets - clipe novo no pacote aparece aqui sem
                    ninguém escrever nada. */}
                {(sel.zone === 'animacao' || sel.zone === 'pose') && (
                  <>
                    <label className="efield">
                      ANIMAÇÃO
                      <select
                        value={sel.clip ?? ''}
                        onChange={(e) => updateObject(sel.id, { clip: e.target.value })}
                      >
                        {CLIPES.map((c) => (
                          <option key={c.nome} value={c.nome}>
                            {c.nome} ({c.quadros} quadro{c.quadros > 1 ? 's' : ''})
                          </option>
                        ))}
                      </select>
                    </label>

                    {sel.zone === 'pose' && (
                      <label className="efield">
                        QUADRO
                        <input
                          type="number"
                          min={0}
                          max={Math.max(0, (CLIP_FRAMES[sel.clip ?? ''] ?? 1) - 1)}
                          value={sel.poseFrame ?? 0}
                          onChange={(e) =>
                            updateObject(sel.id, { poseFrame: Math.max(0, Number(e.target.value)) })
                          }
                        />
                      </label>
                    )}

                    <label className="efield">
                      AVISO PARA O JOGADOR
                      <input
                        value={sel.prompt ?? ''}
                        placeholder="Sentar"
                        onChange={(e) => updateObject(sel.id, { prompt: e.target.value })}
                      />
                    </label>
                    <div className="ehint">
                      Chegando na caixa, o jogador vê “{sel.prompt?.trim() || 'Interagir'} E”.
                      {sel.zone === 'pose'
                        ? ' Apertando, ele trava no quadro escolhido.'
                        : ' Apertando, o clipe roda em ciclo.'}{' '}
                      Andar levanta.
                    </div>
                    <div className="erow">
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
                  </>
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
              /* Buscando, a pasta abre sozinha: esconder resultado de busca
                 dentro de pasta fechada faz a busca parecer quebrada. */
              const aberta = Boolean(termo) || !pastasFechadas.includes(l.id);
              return (
                <div key={l.id}>
                  <button
                    className={`elib-cat epasta${aberta ? ' aberta' : ''}`}
                    onClick={() =>
                      setPastasFechadas((f) =>
                        f.includes(l.id) ? f.filter((x) => x !== l.id) : [...f, l.id],
                      )
                    }
                    title={aberta ? 'Fechar a pasta' : 'Abrir a pasta'}
                  >
                    <i className="epasta-seta">{aberta ? '▾' : '▸'}</i>
                    <span className="grow">{l.label}</span>
                    <small>{list.length}</small>
                    {scene.hidden.includes(l.id) && <span className="off">ESCONDIDA</span>}
                  </button>
                  {aberta && list.map((o) => (
                    <button
                      key={o.id}
                      className={`eitem eitem-thumb${selIds.includes(o.id) ? ' on' : ''}${o.locked ? ' locked' : ''}`}
                      title={`${o.sprite || o.zone || o.id}\nClique seleciona · Ctrl soma · Shift pega o intervalo · duplo clique leva a tela até ele`}
                      onClick={(e) => {
                        if (o.locked) return;
                        setLayer('todas');
                        if (e.ctrlKey || e.metaKey) {
                          alternarSel(o.id);
                          return;
                        }
                        /*
                         * Shift pega o INTERVALO, nos dois sentidos.
                         *
                         * A ancora e a ultima peca que voce selecionou. De A
                         * para E pega B, C e D; de E para A pega os mesmos
                         * quatro - o intervalo e entre as duas pontas, e nao
                         * na ordem em que voce clicou.
                         */
                        if (e.shiftKey && selected) {
                          const visiveis = ordemVisivel();
                          const i0 = visiveis.indexOf(selected);
                          const i1 = visiveis.indexOf(o.id);
                          if (i0 >= 0 && i1 >= 0) {
                            const [a, b] = i0 < i1 ? [i0, i1] : [i1, i0];
                            setSelIds([...new Set([...selIds, ...visiveis.slice(a, b + 1)])]);
                            return;
                          }
                        }
                        setSelected(o.id);
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
