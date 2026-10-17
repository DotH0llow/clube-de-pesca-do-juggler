import { useEffect, useRef } from 'react';
import { asset } from '../assets';
import { RARITIES } from '../data/rarities';
import { rodX } from '../editor/scene';
import { getFx } from '../editor/fx';
import type { CastResult } from '../state/types';
import { getSettings } from '../state/settings';
import { getState } from '../state/store';
import { seaBottom, getWorld } from '../world/worldConfig';
import { hookPos, huntInput, setHookAtivo, triggerSonar } from '../world/hookPos';
import { FishSprite, JunkSprite, Sprite } from './Sprite';

/**
 * A CAÇADA: guiar o anzol debaixo d'água.
 *
 * O lance antigo era: joga a linha, espera um cronômetro, aperta no susto.
 * Entre lançar e fisgar o jogador não fazia nada - a boia decidia sozinha, e o
 * único input do lance inteiro era um reflexo de meio segundo. O mar tem 2088
 * unidades de profundidade e nada acontecia lá embaixo.
 *
 * Agora o anzol afunda e quem guia é o jogador. Setas ou WASD movem; a linha
 * tem comprimento maximo e vai acabando; encostar no alvo fisga ou recolhe.
 *
 * ------------------------------------------------------- o que ela decide
 *
 * Ela decide se você ALCANÇA o peixe - não QUAL peixe. O sorteio continua
 * sendo do `resolveCast`, no momento do arremesso, junto com toda a tabela de
 * raridade, pity e cartas. Trocar isso aqui seria reescrever o balanceamento
 * inteiro do jogo de carona numa mudança de controle.
 *
 * O que a raridade faz é escolher a PROFUNDIDADE: peixe comum nada logo abaixo
 * da superfície, lendário mora no fundo. Então a raridade vira distância a
 * percorrer, e a linha que vai acabando vira o custo de tentar.
 */

// ==========================================================================
// CONSTANTES
// ==========================================================================

/** Velocidade de afundamento livre, em unidades por segundo. */
const AFUNDA = 130;
/** Velocidade do comando, em unidades por segundo. */
const NADO = 320;
/** Raio de captura: o quanto o anzol precisa chegar perto, em unidades. */
const ALCANCE = 46;

/**
 * Alcance minimo da linha, em unidades.
 *
 * É o orçamento do lance: enquanto o anzol desce, a linha vai sendo gasta, e
 * quando acaba ele volta. Sem um teto, guiar o anzol seria só uma questão de
 * insistir - e o mergulho fundo atrás do peixe raro deixaria de ser uma
 * aposta. O alcance final cresce com a profundidade do alvo e com o upgrade.
 */
const LINHA_BASE = 1100;

/** Quanto a profundidade do peixe cresce com a raridade, de 0 a 1. */
const FUNDURA: Record<string, number> = {
  comum: 0.12,
  incomum: 0.22,
  raro: 0.38,
  epico: 0.55,
  lendario: 0.74,
  mitico: 0.9,
};

/** De quanto em quanto o peixe muda de rumo, em segundos. */
const VIRA_A_CADA = 1.4;
/** Velocidade com que o peixe passeia, em unidades por segundo. */
const PEIXE_NADA = 46;

interface Props {
  alvo: CastResult;
  /** o anzol alcançou o peixe */
  onCatch: () => void;
  /** a linha acabou, ou o jogador recolheu */
  onGiveUp: () => void;
  /** onde o anzol está agora, para a linha de pesca ser desenhada por fora */
  hookRef: React.MutableRefObject<{ x: number; y: number }>;
}

export function HookHunt({ alvo, onCatch, onGiveUp, hookRef }: Props) {
  const w = getWorld();
  const anzol = useRef<HTMLDivElement | null>(null);
  const peixe = useRef<HTMLDivElement | null>(null);
  const sonar = useRef<HTMLElement | null>(null);
  const feito = useRef(false);

  /*
   * A posição de partida do anzol é a mesma da boia de antes.
   *
   * Ela sai da configuração de MECÂNICAS, que o editor edita - então mexer
   * onde a linha cai continua sendo trabalho do editor, e não deste arquivo.
   */
  const inicio = useRef({
    x: rodX() + getFx().timings.bobberDx,
    y: getFx().timings.bobberY,
  });

  /** A profundidade em que o peixe mora, pela raridade. */
  const alvoY = useRef(
    (() => {
      const r = alvo.fish?.rarity;
      const f = r ? FUNDURA[r] ?? 0.2 : 0.14;
      const fundo = seaBottom();
      return w.waterY + (fundo - w.waterY) * f;
    })(),
  );
  const alvoX = useRef(inicio.current.x - 140 + Math.random() * 280);
  const linhaMax = useRef(Math.max(LINHA_BASE, (alvoY.current - inicio.current.y) * 1.7 + 320) + getState().upgrades.linha * 180);

  useEffect(() => {
    hookRef.current = { ...inicio.current };
    hookPos.x = inicio.current.x;
    hookPos.y = inicio.current.y;
    hookPos.targetX = alvoX.current;
    hookPos.targetY = alvoY.current;
    hookPos.linha = 1;
    hookPos.maxLine = linhaMax.current;
    hookPos.sonarUntil = 0;
    hookPos.sonarReadyAt = 0;
    setHookAtivo(true);
    const teclas = new Set<string>();
    const down = (e: KeyboardEvent) => {
      teclas.add(e.code);
      if (e.code === 'Space' && !e.repeat) triggerSonar();
      if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'KeyA', 'KeyD', 'KeyW', 'KeyS', 'Space'].includes(e.code)) {
        e.preventDefault();
      }
    };
    const up = (e: KeyboardEvent) => teclas.delete(e.code);
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);

    let raf = 0;
    let last = performance.now();
    let gasto = 0;
    let rumo = 0;
    let troca = 0;
    const pos = { ...inicio.current };
    const px = { x: alvoX.current, y: alvoY.current };

    const passo = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;

      // ---------------------------------------------------------- o peixe
      // Ele passeia; não foge nem persegue. Fugir viraria uma corrida de
      // resistência, e o que se quer aqui é uma descida com pontaria.
      troca -= dt;
      if (troca <= 0) {
        troca = VIRA_A_CADA * (0.6 + Math.random() * 0.8);
        rumo = Math.random() < 0.5 ? -1 : 1;
      }
      px.x = Math.max(alvoX.current - 190, Math.min(alvoX.current + 190, px.x + rumo * PEIXE_NADA * (1 + (alvo.difficulty ?? 0)) * dt));
      px.y = alvoY.current + Math.sin(now / 900) * 13;

      // ---------------------------------------------------------- o anzol
      const esq = teclas.has('ArrowLeft') || teclas.has('KeyA') || huntInput.left;
      const dir = teclas.has('ArrowRight') || teclas.has('KeyD') || huntInput.right;
      const cima = teclas.has('ArrowUp') || teclas.has('KeyW') || huntInput.up;
      const baixo = teclas.has('ArrowDown') || teclas.has('KeyS') || huntInput.down;

      pos.x += ((dir ? 1 : 0) - (esq ? 1 : 0)) * NADO * dt;
      pos.x = Math.max(w.shoreX - w.seaWidth + 70, Math.min(w.shoreX - 90, pos.x));
      /* O anzol afunda sozinho. Subir e descer gastam linha pela distancia
         percorrida; a subida precisa permitir corrigir um mergulho excessivo. */
      const vertical = AFUNDA * .65 + (baixo ? 250 : 0) - (cima ? 360 : 0);
      pos.y += vertical * dt;

      // não sobe acima da linha d'água nem passa do fundo
      pos.y = Math.max(w.waterY + 10, Math.min(seaBottom() - 20, pos.y));

      // ------------------------------------------------------------ linha
      // o gasto é a DISTÂNCIA percorrida, e não o tempo: ficar parado não
      // consome nada, e é o movimento que custa
      gasto += Math.abs(vertical * dt) + Math.abs(((dir ? 1 : 0) - (esq ? 1 : 0)) * NADO * dt);
      const resta = Math.max(0, 1 - gasto / linhaMax.current);
      hookPos.linha = resta;

      hookRef.current = { x: pos.x, y: pos.y };
      // a camera le daqui para descer junto com o anzol
      hookPos.x = pos.x;
      hookPos.y = pos.y;
      hookPos.targetX = px.x;
      hookPos.targetY = px.y;
      if (anzol.current) {
        anzol.current.style.transform = `translate3d(${pos.x}px,${pos.y}px,0)`;
      }
      if (peixe.current) {
        peixe.current.style.transform = `translate3d(${px.x}px,${px.y}px,0)`;
        peixe.current.style.opacity = now < hookPos.sonarUntil || Math.hypot(pos.x - px.x, pos.y - px.y) < 185 ? '1' : '.42';
      }
      if (sonar.current) sonar.current.style.opacity = now < hookPos.sonarUntil ? '.65' : '0';

      // ---------------------------------------------------------- encostou?
      const dx = pos.x - px.x;
      const dy = pos.y - px.y;
      if (!feito.current && Math.hypot(dx, dy) < ALCANCE) {
        feito.current = true;
        onCatch();
        return;
      }
      if (!feito.current && resta <= 0) {
        feito.current = true;
        onGiveUp();
        return;
      }

      raf = requestAnimationFrame(passo);
    };
    raf = requestAnimationFrame(passo);

    return () => {
      cancelAnimationFrame(raf);
      setHookAtivo(false);
      huntInput.left = huntInput.right = huntInput.up = huntInput.down = false;
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
    };
    // as referências são estáveis; o efeito monta uma vez por lance
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const cor = alvo.fish ? RARITIES[alvo.fish.rarity].color : '#cfe8f5';
  const animar = getSettings().animations;

  return (
    <>
      {/* O PEIXE.

          É o peixe que o sorteio já escolheu - não um decoy. Mostrar o bicho
          de verdade é o que transforma a descida numa decisão: dá para ver o
          que está em jogo antes de gastar linha atrás dele. */}
      <div className="hunt-fish" ref={peixe}>
        {alvo.fish ? (
          <FishSprite fish={alvo.fish} size={72} />
        ) : alvo.junk ? (
          <JunkSprite junk={alvo.junk} size={62} />
        ) : alvo.category === 'bau' ? (
          <Sprite path="fx/chest-closed" size={72} />
        ) : (
          <img src={asset('props/distant-underwater-silhouette')} alt="" style={{ height: 62 }} />
        )}
        <i className="hunt-halo" style={{ borderColor: cor }} />
      </div>

      {/* O ANZOL */}
      <div className="hunt-hook" ref={anzol}>
        <img src={asset('props/single-hook')} alt="" />
        {animar && <i className="hunt-ping" />}
        <i className="hunt-sonar" ref={sonar} />
      </div>
    </>
  );
}

/**
 * O medidor de linha, na interface.
 *
 * Fica fora do mundo de propósito: é informação de jogo, não coisa que existe
 * dentro d'água, e tem de continuar legível com a câmera onde quer que esteja.
 */
export function HuntHud({ onGiveUp, target }: { onGiveUp: () => void; target?: CastResult }) {
  const barra = useRef<HTMLElement | null>(null);
  const info = useRef<HTMLDivElement | null>(null);
  const sonarLabel = useRef<HTMLButtonElement | null>(null);

  /*
   * A barra e atualizada no DOM, e nao por estado do React.
   *
   * Ela muda a cada quadro; um `setState` por quadro aqui re-renderizaria a
   * interface inteira sessenta vezes por segundo - que e exatamente o que o
   * resto do jogo evita, e por nada, porque o unico pixel que muda e a largura
   * de um retangulo.
   */
  useEffect(() => {
    let raf = 0;
    const tick = () => {
      if (barra.current) barra.current.style.width = `${Math.round(hookPos.linha * 100)}%`;
      if (info.current) {
        const dx = hookPos.targetX - hookPos.x;
        const dy = hookPos.targetY - hookPos.y;
        const arrow = Math.abs(dx) > Math.abs(dy) * .6 ? (dx > 0 ? '→' : '←') : dy > 0 ? '↓' : '↑';
        info.current.textContent = `${arrow}  ${Math.round(Math.hypot(dx, dy) / 10)} m  ·  PROF. ${Math.max(0, Math.round((hookPos.y - getWorld().waterY) / 10))} m`;
      }
      if (sonarLabel.current) {
        const left = Math.max(0, (hookPos.sonarReadyAt - performance.now()) / 1000);
        sonarLabel.current.textContent = left > 0 ? `SONAR ${left.toFixed(1)}s` : 'SONAR · ESPAÇO';
        sonarLabel.current.disabled = left > 0;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <div className="hunt-hud">
      <div className="hunt-title">{target?.fish ? 'PERSEGUIÇÃO SUBMARINA' : target?.category === 'bau' ? 'BAÚ AFUNDADO' : target?.category === 'lixo' ? 'OBJETO PERDIDO' : 'SOMBRA DA HYDRA'}</div>
      <div className="hunt-sonar-readout" ref={info}>LOCALIZANDO ALVO...</div>
      <div className="hunt-linha">
        <i ref={barra} />
        <span>LINHA</span>
      </div>
      <div className="hint-strip">SETAS OU WASD GUIAM O ANZOL &middot; ENCOSTE NO ALVO</div>
      <div className="hunt-actions">
        <button className="btn ghost small" ref={sonarLabel} onClick={triggerSonar}>SONAR · ESPAÇO</button>
      <button className="btn ghost small" onClick={onGiveUp}>
        RECOLHER
      </button>
      </div>
      <div className="hunt-touch" aria-label="Controles do anzol">
        {(['left', 'up', 'down', 'right'] as const).map((direction) => (
          <button key={direction} className="btn ghost small" onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); huntInput[direction] = true; }} onPointerUp={() => { huntInput[direction] = false; }} onPointerCancel={() => { huntInput[direction] = false; }}>
            {{ left: '←', up: '↑', down: '↓', right: '→' }[direction]}
          </button>
        ))}
      </div>
    </div>
  );
}
