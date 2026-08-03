import { useCallback, useEffect, useRef, useState } from 'react';
import { asset } from '../assets';
import { clamp } from '../engine/rng';
import { getDevFlags } from '../state/dev';
import { getSettings } from '../state/settings';
import { clipConfig, frameAt, seqLength } from '../editor/anims';
import { blockWalls, inZone, rodX, spawnX, thresholdX, zoneRect } from '../editor/scene';
import { getFx } from '../editor/fx';
import { CHAR_ANCHOR, CHAR_CANVAS, CHAR_FRAME_H, CLIP_FRAMES } from './charFrames';
import { camMinX, groundAt, WORLD_W } from './layout';
import { getWorld, panMaxY, panMinY, useWorld } from './worldConfig';

export type Facing = 'left' | 'right';
export type AnimName = 'side-idle' | 'walk' | 'run' | 'jump' | 'fish' | 'sit';
/** Pontos do mundo em que o botao de interagir aparece. */
export type Spot = 'vara' | 'mercado' | null;

/**
 * Quanto o Juggler encolheu para o mar ganhar tela.
 *
 * O quadro inteiro (`CHAR_FRAME_H`) e gerado pelo importador e nao se mexe na
 * mao; o ajuste de jogo mora aqui.
 */
export const CHAR_SCALE = 0.72;

/**
 * Quadro da pescaria por fase do lance. A arte veio com uma pose para cada
 * momento, entao nao faz sentido rodar em loop: cada fase trava no seu quadro.
 * A fase `waiting` passa rapido pelo arremesso antes de assentar na espera.
 */
export type FishPose = 'idle' | 'power' | 'cast' | 'waiting' | 'bite' | 'reeling';

/** Posicao de cada pose dentro da sequencia do clipe `fish`. */
const FISH_SLOT: Record<FishPose, number> = {
  idle: 0,
  power: 1,
  cast: 2,
  waiting: 3,
  bite: 4,
  reeling: 5,
};

const WALK_SPEED = 200;
const RUN_SPEED = 360;
const GRAVITY = 2000;
const JUMP_V = 700;

/**
 * Quanto tempo o quadro de aterrissagem fica na tela, em ms.
 *
 * Antes o clipe de pulo trocava de quadro pelo SINAL da velocidade vertical:
 * no instante em que ele parava de subir ja aparecia a pose de aterrissar, com
 * o Juggler agachado no ar durante toda a descida. Agora o quadro de
 * aterrissagem so entra quando o pe encosta - e sai sozinho depois disso.
 */
const LAND_MS = 150;

/** Velocidade da camera livre, em unidades de mundo por segundo. */
const FREE_CAM_SPEED = 900;
/** Faixa da borda da tela que empurra a camera livre, em px. */
const EDGE_BAND = 46;

/**
 * Limites do zoom.
 *
 * JOGANDO o zoom e apertado de proposito: o enquadramento faz parte do jogo e
 * afastar demais entrega o mapa inteiro. No EDITOR e na CAMERA LIVRE isso nao
 * vale - la voce esta trabalhando na cena, e precisa tanto ver o mar inteiro
 * de uma vez quanto colar o nariz num prego do deck.
 */
export const ZOOM_MIN = 0.6;
export const ZOOM_MAX = 2.6;
export const ZOOM_LIVRE_MIN = 0.05;
export const ZOOM_LIVRE_MAX = 8;

/**
 * Quanto o zoom demora para chegar onde foi mandado, em segundos.
 *
 * O zoom pulava de degrau em degrau: cada volta da roda multiplicava a escala
 * na hora e a tela dava um tranco. Agora a roda mexe num ALVO e a escala corre
 * atras dele quadro a quadro. No editor a interpolacao e desligada - la a
 * caixa de selecao precisa cair exatamente em cima do sprite no mesmo quadro.
 */
const ZOOM_EASE = 0.16;
/** Quanto uma volta da roda mexe no zoom. Passo fino: a suavizacao faz o resto. */
const ZOOM_STEP = 0.0016;

/** Altura do quadro inteiro em unidades de mundo (inclui a vara). */
export const PLAYER_H = CHAR_FRAME_H * CHAR_SCALE;

function clipName(anim: AnimName, facing: Facing): string {
  return `${anim}-${facing}`;
}

function framePath(clip: string, i: number): string {
  return `char/${clip}/${String(i).padStart(2, '0')}`;
}

/** Deixa todo quadro em cache antes de o jogador ver, para nao piscar na troca. */
let preloaded = false;
function preload() {
  if (preloaded || typeof Image === 'undefined') return;
  preloaded = true;
  for (const clip of Object.keys(CLIP_FRAMES)) {
    for (let i = 0; i < CLIP_FRAMES[clip]; i++) {
      const img = new Image();
      img.src = asset(framePath(clip, i));
    }
  }
}

interface Options {
  /** false enquanto o celular ou um modal esta aberto */
  active: boolean;
  /** true quando o Juggler esta com a vara na mao */
  fishing: boolean;
  /** em que momento do lance ele esta: define o quadro da pescaria */
  fishPose?: FishPose;
  /** congela o mundo inteiro: fisica, animacao e camera (a musica continua) */
  paused?: boolean;
  /**
   * O editor esta aberto.
   *
   * Muda duas coisas: o zoom perde as amarras do jogo e para de ser
   * interpolado. Sem isso, dar zoom no editor deixava a caixa de selecao
   * correndo atras do sprite durante a animacao.
   */
  editing?: boolean;
}

/**
 * Fisica do personagem, camera e maquina de animacao.
 *
 * O laco escreve direto no DOM (transform da camera, transform do jogador e src
 * do quadro). Sem isso, um `setState` por quadro re-renderizaria o cenario
 * inteiro 60 vezes por segundo.
 *
 * Os quadros ja saem do importador alinhados pelo quadril e pelo pe dentro de
 * um canvas unico, entao a correcao de ancora e uma constante (`CHAR_ANCHOR`)
 * em vez de uma tabela por quadro. QUAL quadro tocar, em que ordem e em que
 * ritmo vem da configuracao de animacoes (`src/editor/anims.ts`), que o editor
 * edita - aqui nao existe mais ordem de quadro escrita na mao.
 */
export function usePlayer({
  active,
  fishing,
  fishPose = 'idle',
  paused = false,
  editing = false,
}: Options) {
  const cameraRef = useRef<HTMLDivElement | null>(null);
  const worldRef = useRef<HTMLDivElement | null>(null);
  const shadowRef = useRef<HTMLDivElement | null>(null);
  const farRef = useRef<HTMLDivElement | null>(null);
  const midRef = useRef<HTMLDivElement | null>(null);
  const playerRef = useRef<HTMLDivElement | null>(null);
  const spriteRef = useRef<HTMLImageElement | null>(null);

  const world = useWorld();
  const [spot, setSpot] = useState<Spot>(null);
  const [viewH, setViewH] = useState(() =>
    typeof window === 'undefined' ? world.frameH : window.innerHeight,
  );
  const [zoom, setZoom] = useState(1);
  /**
   * O enquadramento do limiar do pier.
   *
   * 1 = a moldura normal da praia. Menor que 1 = camera aberta, mostrando o mar
   * fundo. O valor anda suave entre `frameLand` e `frameSea` conforme o Juggler
   * cruza a caixa LIMIAR DO PIER, e e por isso que a tela "respira" quando ele
   * sai do deck para a areia.
   */
  const [frame, setFrame] = useState(() => getWorld().frameLand);
  const frameRef = useRef(frame);

  // onde ele nasce sai da caixa NASCIMENTO da cena, nao de um numero aqui
  const x = useRef(spawnX());
  const vx = useRef(0);
  const y = useRef(0); // altura acima do chao
  const vy = useRef(0);
  const facing = useRef<Facing>('left');
  const anim = useRef<AnimName>('side-idle');
  /** posicao dentro da SEQUENCIA do clipe, nao o numero do arquivo */
  const step = useRef(0);
  const frameT = useRef(0);
  const camX = useRef(0);
  /** deslocamento vertical da camera livre (so faz efeito com zoom) */
  const camY = useRef(0);
  /** quanto falta do quadro de aterrissagem, em ms */
  const landT = useRef(0);
  const keys = useRef(new Set<string>());
  /** ultima posicao do mouse: a camera livre anda quando ele encosta na borda */
  const mouse = useRef({ x: -1, y: -1 });
  const activeRef = useRef(active);
  const fishingRef = useRef(fishing);
  const pausedRef = useRef(paused);
  const editingRef = useRef(editing);
  const poseRef = useRef<FishPose>(fishPose);
  const scaleRef = useRef(1);
  const viewYRef = useRef(0);
  const viewHRef = useRef(viewH);
  /** onde o zoom quer chegar; `zoomRef` e onde ele esta agora */
  const zoomAlvo = useRef(zoom);
  const zoomRef = useRef(zoom);
  activeRef.current = active;
  fishingRef.current = fishing;
  pausedRef.current = paused;
  editingRef.current = editing;
  poseRef.current = fishPose;
  viewHRef.current = viewH;

  /*
   * Escala e deslocamento.
   *
   * O mundo ficou seis vezes mais fundo, entao escalar pela altura TOTAL faria
   * o jogo virar um selo. Quem manda na escala e a MOLDURA (`frameH`): o tanto
   * de mundo que se quer ver de uma vez. O mar continua descendo bem abaixo
   * disso, so que fora da tela.
   *
   * E o deslocamento nao centraliza mais: ele ancora a LINHA D'AGUA numa altura
   * fixa da tela. Assim, quando a camera abre no pier, o horizonte fica parado
   * e o que entra e agua embaixo - em vez de a cena inteira escorregar.
   */
  const scale = (viewH / world.frameH) * zoom * frame;
  const viewY = viewH * world.waterAnchor - world.waterY * scale;
  /*
   * Os refs sao a versao de QUADRO desses dois numeros; estes aqui sao a versao
   * de RENDER, que vira propriedade para o editor desenhar as caixas.
   *
   * Quem escreve nos refs e o laco, que roda 60 vezes por segundo. Se o render
   * escrevesse tambem, um re-render no meio de um zoom suave devolveria a
   * escala para o valor da ultima vez que o React acordou - e a cena piscaria.
   * O primeiro quadro e a excecao: ai o laco ainda nao rodou.
   */
  if (scaleRef.current === 1 && viewYRef.current === 0) {
    scaleRef.current = scale;
    viewYRef.current = viewY;
  }

  useEffect(preload, []);

  /**
   * Onde o Juggler fica quando a pescaria comeca.
   *
   * Era o ponto em que ele estivesse quando apertou E, o que deixava a linha
   * saindo torta se ele parasse na beirada da area. Agora o lugar e escolhido
   * na secao MECANICAS do editor (`timings.fishX`); sem escolha, ele para no
   * meio da area de interacao da vara, que e o comportamento antigo.
   */
  useEffect(() => {
    if (!fishing) return;
    const alvo = getFx().timings.fishX;
    if (alvo !== null) {
      x.current = alvo;
      return;
    }
    const z = zoneRect('vara');
    x.current = z ? z.x + z.w / 2 : rodX();
  }, [fishing]);

  // ------------------------------------------------------------- teclado
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      keys.current.add(e.code);
      if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'Space', 'KeyA', 'KeyD', 'KeyW'].includes(e.code)) {
        if (activeRef.current) e.preventDefault();
      }
    };
    const up = (e: KeyboardEvent) => keys.current.delete(e.code);
    const blur = () => keys.current.clear();
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    window.addEventListener('blur', blur);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
      window.removeEventListener('blur', blur);
    };
  }, []);

  // ------------------------------------------------------- escala da cena
  useEffect(() => {
    const onResize = () => setViewH(window.innerHeight);
    onResize();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // a camera livre precisa saber onde o mouse esta para empurrar pelas bordas
  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      mouse.current = { x: e.clientX, y: e.clientY };
    };
    const onLeave = () => {
      mouse.current = { x: -1, y: -1 };
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseleave', onLeave);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseleave', onLeave);
    };
  }, []);

  /**
   * Zoom de roda.
   *
   * Duas mudancas em relacao ao que era:
   *
   *   - o passo virou CONTINUO. Antes cada volta multiplicava a escala por
   *     0,9 na hora: o zoom andava aos trancos, em degraus visiveis. Agora a
   *     roda mexe num alvo, com passo proporcional a distancia rolada, e o laco
   *     leva a escala ate la;
   *   - no editor e na camera livre a roda dispensa o Ctrl. Ali dentro rolar a
   *     pagina nao quer dizer nada, e pedir Ctrl para uma coisa que se usa o
   *     tempo todo e so atrito.
   *
   * O listener e nao-passivo para o `preventDefault` valer: sem ele o navegador
   * aplica o proprio zoom da pagina e o jogo sai de lugar.
   */
  useEffect(() => {
    const onWheel = (e: WheelEvent) => {
      const livre = editingRef.current || getDevFlags().freeCam;
      if (!livre && !e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      const [lo, hi] = livre ? [ZOOM_LIVRE_MIN, ZOOM_LIVRE_MAX] : [ZOOM_MIN, ZOOM_MAX];
      // exponencial: uma volta para cima desfaz exatamente uma para baixo
      const fator = Math.exp(-e.deltaY * ZOOM_STEP);
      zoomAlvo.current = clamp(zoomAlvo.current * fator, lo, hi);
      // no editor a escala tem de valer JA: a caixa de selecao e desenhada
      // por cima do sprite e nao pode ficar um quadro atras dele
      if (editingRef.current) {
        zoomRef.current = zoomAlvo.current;
        setZoom(zoomAlvo.current);
      }
    };
    window.addEventListener('wheel', onWheel, { passive: false });
    return () => window.removeEventListener('wheel', onWheel);
  }, []);

  const resetZoom = useCallback(() => {
    zoomAlvo.current = 1;
    if (editingRef.current) {
      zoomRef.current = 1;
      setZoom(1);
    }
  }, []);

  /** Manda o zoom para um valor exato: usado pelas travas do editor. */
  const setZoomTo = useCallback((z: number) => {
    const alvo = clamp(z, ZOOM_LIVRE_MIN, ZOOM_LIVRE_MAX);
    zoomAlvo.current = alvo;
    zoomRef.current = alvo;
    setZoom(alvo);
  }, []);

  /**
   * "Travei!": devolve o Juggler ao ponto de nascimento.
   *
   * Serve para a situacao boba que trava qualquer jogo de plataforma no
   * celular - ficar presa atras de uma parede que voce arrastou no editor, ou
   * num canto do deck de onde o pulo nao sai. Ele reaparece no marcador
   * NASCIMENTO, de pe, parado, com as teclas soltas e a camera ja nele.
   */
  const respawn = useCallback(() => {
    const alvo = spawnX();
    x.current = alvo;
    vx.current = 0;
    y.current = 0;
    vy.current = 0;
    landT.current = 0;
    keys.current.clear();
    facing.current = 'left';
    camY.current = 0;
    // a camera vai junto, sem deslizar do outro lado do mapa
    const view = window.innerWidth / Math.max(0.05, scaleRef.current);
    camX.current = clamp(alvo - view / 2, camMinX(), Math.max(camMinX(), WORLD_W - view));
  }, []);

  /** Move o jogador por toque/clique: usado pelos botoes de mobile. */
  const press = useCallback((code: string, on: boolean) => {
    if (on) keys.current.add(code);
    else keys.current.delete(code);
  }, []);

  // ------------------------------------------------------------- laco
  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    let lastSpot: Spot = null;
    let lastFrameKey = '';
    let frameShown = frameRef.current;
    let zoomShown = zoomRef.current;

    /** camera e parallax vao direto pro DOM, sem passar por render do React */
    const writeCamera = () => {
      if (worldRef.current) {
        worldRef.current.style.transform =
          `translate3d(0,${viewYRef.current + camY.current * scaleRef.current}px,0) scale(${scaleRef.current})`;
      }
      if (cameraRef.current) {
        cameraRef.current.style.transform = `translate3d(${-camX.current}px,0,0)`;
      }
      // parallax: quanto mais longe, menos anda
      if (farRef.current) {
        farRef.current.style.transform = `translate3d(${-camX.current * 0.22}px,0,0)`;
      }
      if (midRef.current) {
        midRef.current.style.transform = `translate3d(${-camX.current * 0.52}px,0,0)`;
      }
    };

    const stepLoop = (now: number) => {
      /*
       * Pausado (celular aberto ou editor): fisica e teclado ficam de fora, mas
       * camera, posicao e QUADRO continuam sendo escritos. E isso que deixa a
       * simulacao passo a passo do editor mostrar a pose certa - antes o mundo
       * congelava no ultimo quadro desenhado e a etapa escolhida nao aparecia.
       */
      const frozen = pausedRef.current;
      const dt = frozen ? 0 : Math.min(0.05, (now - last) / 1000);
      const dtReal = Math.min(0.05, (now - last) / 1000);
      last = now;

      /*
       * O zoom, quadro a quadro.
       *
       * A roda mexe no ALVO; aqui a escala caminha ate ele. Era isto que
       * faltava: antes a escala era trocada de uma vez no evento da roda, e o
       * mundo dava um pulo a cada clique da rodinha. Com o editor aberto (ou
       * com as animacoes desligadas nas preferencias) a interpolacao sai de
       * cena e o valor vale na hora - no editor porque a caixa de selecao
       * precisa bater com o sprite no mesmo quadro.
       */
      const instantaneo = editingRef.current || !getSettings().animations;
      if (instantaneo) {
        zoomRef.current = zoomAlvo.current;
      } else if (Math.abs(zoomAlvo.current - zoomRef.current) > 0.0005) {
        const suave = 1 - Math.pow(0.001, dtReal / ZOOM_EASE);
        zoomRef.current += (zoomAlvo.current - zoomRef.current) * suave;
      } else {
        zoomRef.current = zoomAlvo.current;
      }

      // escala e deslocamento sao recalculados aqui, e nao no render: e o que
      // deixa o zoom correr a 60 quadros sem re-renderizar a cena inteira
      const mundoAgora = getWorld();
      scaleRef.current = (viewHRef.current / mundoAgora.frameH) * zoomRef.current * frameRef.current;
      viewYRef.current = viewHRef.current * mundoAgora.waterAnchor - mundoAgora.waterY * scaleRef.current;

      // o React so precisa saber quando o numero muda de verdade (o editor le
      // esse valor para desenhar as caixas, e o topo mostra a porcentagem)
      if (Math.abs(zoomRef.current - zoomShown) > 0.002) {
        zoomShown = zoomRef.current;
        setZoom(zoomRef.current);
      }

      const free = getDevFlags().freeCam;
      const k = keys.current;
      // com camera livre o Juggler fica plantado: o teclado passa a ser da tela
      const canMove = !frozen && !free && activeRef.current && !fishingRef.current;
      const left = canMove && (k.has('ArrowLeft') || k.has('KeyA'));
      const right = canMove && (k.has('ArrowRight') || k.has('KeyD'));
      const running = !frozen && !free && (k.has('ShiftLeft') || k.has('ShiftRight'));
      const wantJump = canMove && (k.has('Space') || k.has('ArrowUp') || k.has('KeyW'));

      const speed = running ? RUN_SPEED : WALK_SPEED;
      const dir = (right ? 1 : 0) - (left ? 1 : 0);
      vx.current = dir * speed;
      if (dir !== 0) facing.current = dir > 0 ? 'right' : 'left';

      // as paredes sao objetos de cena agora: quem barra e a caixa que voce
      // arrastou no editor, nao mais duas constantes escondidas no codigo
      x.current = blockWalls(x.current, x.current + vx.current * dt);

      const grounded = y.current <= 0.001 && vy.current <= 0;
      if (wantJump && grounded) {
        vy.current = JUMP_V;
        landT.current = 0;
      }
      if (!frozen) {
        const wasUp = y.current > 0.001;
        vy.current -= GRAVITY * dt;
        y.current = Math.max(0, y.current + vy.current * dt);
        if (y.current === 0) {
          // acabou de encostar o pe: e agora que a aterrissagem aparece
          if (wasUp && vy.current < 0) landT.current = LAND_MS;
          vy.current = 0;
        }
        if (landT.current > 0) landT.current = Math.max(0, landT.current - dt * 1000);
      }

      // ------------------------------------------------- estado da animacao
      // no ar OU nos primeiros quadros depois de cair: os dois sao o clipe de pulo
      const airborne = y.current > 0.5;
      const landing = landT.current > 0;
      let next: AnimName;
      if (fishingRef.current) {
        next = 'fish';
        // o mar aberto fica a esquerda: pescando, o Juggler encara a agua
        facing.current = 'left';
      } else if (airborne || landing) next = 'jump';
      else if (dir !== 0) next = running ? 'run' : 'walk';
      else next = 'side-idle';

      if (next !== anim.current) {
        anim.current = next;
        step.current = 0;
        frameT.current = 0;
      }

      const clip = clipName(anim.current, facing.current);
      const count = CLIP_FRAMES[clip] ?? 1;
      const cfg = clipConfig(`char/${clip}`);

      if (cfg.mode === 'fase') {
        // um quadro por momento do lance, com uma passada rapida pelo arremesso
        step.current = FISH_SLOT[poseRef.current] ?? 0;
      } else if (cfg.mode === 'fisica') {
        // no ar (subindo E descendo) e o impulso; o ultimo quadro e a chegada,
        // e ele so entra quando o pe ja encostou
        step.current = landing ? seqLength(`char/${clip}`) - 1 : 0;
      } else if (seqLength(`char/${clip}`) > 1) {
        frameT.current += dt * 1000;
        const dur = Math.max(30, cfg.frameMs);
        while (frameT.current >= dur) {
          frameT.current -= dur;
          step.current += 1;
        }
      } else {
        step.current = 0;
      }

      // ------------------------------------------------------------ camera
      // congelado, quem manda na camera e o editor (ele escreve em camX/camY)
      const view = window.innerWidth / scaleRef.current;
      const minX = camMinX();
      const maxX = Math.max(minX, WORLD_W - view);
      if (frozen) {
        /*
         * Nada a fazer: o editor escreve em `camX` e `camY` direto.
         *
         * Antes o `camY` era ZERADO aqui a cada quadro. A intencao era manter a
         * caixa de selecao em cima do sprite - e o efeito era que no editor a
         * tela nao descia um pixel: dava para dar zoom no mar, mas nao para
         * chegar no fundo dele nem no subsolo da praia. Agora o editor soma o
         * mesmo `camY` na conta de tela dele, entao a caixa continua batendo e
         * a tela desce ate onde voce quiser.
         */
      } else if (free && activeRef.current) {
        // WASD e setas empurram a tela; o mouse encostado na borda faz o mesmo
        const m = mouse.current;
        let dx = 0;
        let dy = 0;
        if (k.has('KeyA') || k.has('ArrowLeft')) dx -= 1;
        if (k.has('KeyD') || k.has('ArrowRight')) dx += 1;
        /*
         * `dy` positivo = olhar para BAIXO.
         *
         * Cuidado com o sinal aqui: `camY` positivo empurra o desenho para
         * baixo na tela, o que mostra o que esta ACIMA. Ou seja, olhar para
         * baixo e DIMINUIR o `camY` - e e por isso que ele entra subtraindo
         * logo abaixo. Sem essa inversao, apertar a seta para baixo subia a
         * camera, que era o comportamento antigo e passou despercebido so
         * porque o limite vertical era de poucos pixels.
         */
        if (k.has('KeyW') || k.has('ArrowUp')) dy -= 1;
        if (k.has('KeyS') || k.has('ArrowDown')) dy += 1;
        if (m.x >= 0) {
          if (m.x < EDGE_BAND) dx -= 1;
          if (m.x > window.innerWidth - EDGE_BAND) dx += 1;
          if (m.y < EDGE_BAND) dy -= 1;
          if (m.y > window.innerHeight - EDGE_BAND) dy += 1;
        }
        const boost = k.has('ShiftLeft') || k.has('ShiftRight') ? 2.2 : 1;
        const speed = (FREE_CAM_SPEED * boost * dt) / Math.max(0.05, scaleRef.current);
        camX.current = clamp(camX.current + Math.sign(dx) * speed, minX, maxX);
        /*
         * Subir e descer, de verdade.
         *
         * A conta antiga so deixava mover no vertical quando o zoom fazia o
         * mundo transbordar da tela, e o limite era metade desse transbordo:
         * na pratica a camera livre era um trilho horizontal e o fundo do mar
         * ficava inalcancavel. O limite agora e o MUNDO - do ceu acima da linha
         * d'agua ate o subsolo da praia - e nao o quanto sobra de tela.
         */
        camY.current = clamp(camY.current - Math.sign(dy) * speed, panMinY(), panMaxY());
      } else if (free) {
        // camera livre com painel aberto: a tela fica onde estava
      } else {
        const focus = fishingRef.current ? rodX() - 90 : x.current;
        const target = clamp(focus - view / 2, minX, maxX);
        const smooth = getSettings().animations ? 1 - Math.pow(0.001, dt) : 1;
        camX.current += (target - camX.current) * smooth;
        camY.current += (0 - camY.current) * smooth;
      }

      /*
       * O limiar do pier.
       *
       * A esquerda da caixa LIMIAR o enquadramento vai para `frameSea` (camera
       * aberta, mar fundo aparecendo); a direita, para `frameLand` (fechada, so
       * a superficie). A troca e suave: `frameEase` diz em quantos segundos.
       */
      const mundo = getWorld();
      const limiar = thresholdX();
      const alvoFrame = limiar === null || x.current > limiar ? mundo.frameLand : mundo.frameSea;
      if (frozen) {
        frameRef.current = alvoFrame;
      } else if (Math.abs(frameRef.current - alvoFrame) > 0.0005) {
        const suave = mundo.frameEase <= 0 ? 1 : 1 - Math.pow(0.001, dt / mundo.frameEase);
        frameRef.current += (alvoFrame - frameRef.current) * suave;
      } else {
        frameRef.current = alvoFrame;
      }
      // so avisa o React quando o numero muda de verdade: a virada dura menos de
      // um segundo e o resto do tempo isso nao re-renderiza nada
      if (Math.abs(frameRef.current - frameShown) > 0.002) {
        frameShown = frameRef.current;
        setFrame(frameRef.current);
      }

      writeCamera();
      const ground = groundAt(x.current);
      if (playerRef.current) {
        playerRef.current.style.transform = `translate3d(${x.current}px,${ground - y.current}px,0)`;
      }
      /*
       * A sombra e um elemento separado de proposito: dentro do `.player` ela
       * subia junto com o pulo, como se o chao fosse embora com ele. Aqui ela
       * fica no chao e so encolhe e clareia conforme ele ganha altura.
       */
      if (shadowRef.current) {
        const t = Math.min(1, y.current / 220);
        shadowRef.current.style.transform = `translate3d(${x.current}px,${ground}px,0) scale(${1 - t * 0.45})`;
        shadowRef.current.style.opacity = String(0.34 - t * 0.2);
      }
      const shown = frameAt(`char/${clip}`, step.current, count);
      const frameKey = `${clip}/${shown}`;
      if (spriteRef.current && frameKey !== lastFrameKey) {
        lastFrameKey = frameKey;
        spriteRef.current.src = asset(framePath(clip, shown));
      }

      let near: Spot = null;
      if (!fishingRef.current) {
        if (inZone('vara', x.current)) near = 'vara';
        else if (inZone('mercado', x.current)) near = 'mercado';
      }
      if (near !== lastSpot) {
        lastSpot = near;
        setSpot(near);
      }

      raf = requestAnimationFrame(stepLoop);
    };

    raf = requestAnimationFrame(stepLoop);
    return () => cancelAnimationFrame(raf);
  }, []);

  return {
    cameraRef,
    worldRef,
    farRef,
    midRef,
    playerRef,
    shadowRef,
    spriteRef,
    /** posicao da camera: o editor escreve aqui para navegar pelo mapa */
    camXRef: camX,
    /** deslocamento vertical da camera: o editor escreve aqui para descer ao fundo */
    camYRef: camY,
    spot,
    nearRod: spot === 'vara',
    nearMarket: spot === 'mercado',
    scale,
    /** deslocamento vertical da cena quando o zoom passa da altura da tela */
    viewY,
    zoom,
    resetZoom,
    setZoomTo,
    respawn,
    press,
    playerX: x,
  };
}

/**
 * Estilo fixo do sprite do jogador: a ancora do canvas e constante, entao da
 * para calcular uma vez so em vez de reescrever a cada quadro.
 */
export const PLAYER_SPRITE_STYLE = {
  height: PLAYER_H,
  marginLeft: (CHAR_ANCHOR.dx * PLAYER_H) / CHAR_CANVAS.h,
  marginBottom: (CHAR_ANCHOR.dy * PLAYER_H) / CHAR_CANVAS.h,
};
