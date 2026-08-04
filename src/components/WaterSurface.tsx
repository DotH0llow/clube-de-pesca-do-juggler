import { useEffect, useRef } from 'react';
import { getSettings } from '../state/settings';

/**
 * A SUPERFÍCIE DA ÁGUA: uma linha desenhada, e não uma imagem que passa.
 *
 * O que havia era quatro faixas (`foam-strip`, `small-wave-strip`,
 * `large-wave-strip`, `sun-glint-strip`) repetidas no eixo X e deslizadas em
 * loop por `background-position`. O defeito disso não é a arte - é que uma
 * imagem que desliza SÓ TRANSLADA. A onda de agora é a mesma de dez segundos
 * atrás, movida para o lado; nenhuma crista nasce, nenhuma morre, e o olho
 * pega o período na hora. E como as quatro faixas andavam cada uma na sua
 * velocidade, o conjunto lia como quatro adesivos escorregando, não como água.
 *
 * ------------------------------------------------------------- a matemática
 *
 * A linha é a SOMA DE QUATRO SENOIDES com comprimentos de onda que não são
 * múltiplos um do outro:
 *
 *     y(x,t) = Σ Aᵢ · sen(2π·x/λᵢ + t·vᵢ·2π)
 *
 * Duas coisas fazem isso parecer água em vez de uma senoide:
 *
 *   COMPRIMENTOS INCOMENSURÁVEIS. 520, 310, 170 e 95 não têm divisor comum
 *   útil, então o padrão combinado só se repetiria depois de dezenas de
 *   milhares de unidades - na prática, nunca.
 *
 *   METADE ANDA PARA TRÁS. As velocidades alternam de sinal. É isso que faz
 *   crista nascer e morrer no lugar em vez de desfilar: duas ondas em sentidos
 *   opostos se somam e se cancelam ao longo do tempo, que é o que a água faz
 *   de verdade. Com todas indo para o mesmo lado, por mais camadas que
 *   houvesse, o conjunto ainda seria uma translação.
 */

// ==========================================================================
// CONSTANTES
// ==========================================================================

/**
 * As quatro componentes: [comprimento de onda, peso, velocidade].
 *
 * O peso é relativo - eles são normalizados pela soma, então mexer num não
 * muda a altura total da onda, só o quanto aquela frequência aparece dentro
 * dela. A velocidade é em ciclos por segundo, e o SINAL é o que importa.
 */
const ONDAS: [number, number, number][] = [
  [520, 1.0, 0.22],
  [310, 0.62, -0.31],
  [170, 0.34, 0.47],
  [95, 0.17, -0.62],
];
const PESO_TOTAL = ONDAS.reduce((a, [, p]) => a + p, 0);

/**
 * Distância entre dois pontos da linha, em unidades de mundo.
 *
 * 16 dá seis amostras na onda mais curta (95), que com junção arredondada já
 * lê como curva. Menor que isso é string maior por quadro sem diferença
 * visível; maior começa a facetar a crista.
 */
const PASSO = 16;

/** A onda de trás: mesma matemática, deslocada e mais lenta. */
const FUNDO_ATRASO = 210;
const FUNDO_ESCALA = 0.62;
const FUNDO_LENTIDAO = 0.7;

interface Props {
  /** começo e largura da água, em unidades de mundo */
  left: number;
  width: number;
  /** a linha d'água: é em volta dela que a onda oscila */
  top: number;
  /** altura de pico a vale, em unidades */
  altura: number;
  /** cor da água logo abaixo da superfície */
  corAgua: string;
  /** quanto a faixa desce abaixo da linha antes de encontrar o mar chapado */
  profundidade?: number;
  /** opacidade da espuma da crista */
  espuma?: number;
  /** opacidade da onda de tras */
  fundo?: number;
  /** segundos de referencia de uma passada: maior = mar mais calmo */
  segundos?: number;
  className?: string;
}

export function WaterSurface({
  left,
  width,
  top,
  altura,
  corAgua,
  profundidade = 120,
  espuma = 0.92,
  fundo = 0.4,
  segundos = 9,
  className = '',
}: Props) {
  const frente = useRef<SVGPathElement | null>(null);
  const crista = useRef<SVGPathElement | null>(null);
  const tras = useRef<SVGPathElement | null>(null);

  useEffect(() => {
    const amp = altura / 2;
    const n = Math.ceil(width / PASSO);
    /* SEGUNDOS DE UMA PASSADA vira um multiplicador de ritmo: o slider do
       editor continua dizendo "mar calmo / mar agitado" como antes, so que
       agora ele mexe na velocidade das senoides em vez da duracao de uma
       animacao de CSS. 9 s era o padrao da faixa antiga, entao ele e o 1. */
    const ritmo = 9 / Math.max(1, segundos);

    /** A altura da onda num ponto, num instante. */
    const alturaEm = (x: number, t: number) => {
      let y = 0;
      for (const [lam, peso, vel] of ONDAS) {
        y += peso * Math.sin((2 * Math.PI * x) / lam + t * vel * ritmo * 2 * Math.PI);
      }
      return (y / PESO_TOTAL) * amp;
    };

    /*
     * O caminho é montado como POLILINHA, e não com curvas de Bézier.
     *
     * Com 16 unidades entre pontos e `stroke-linejoin: round`, a diferença
     * para uma curva de verdade é invisível - e uma polilinha custa metade da
     * string e nenhuma conta de ponto de controle por quadro.
     */
    const monta = (t: number, desloca: number, escala: number, lentidao: number) => {
      let d = '';
      for (let i = 0; i <= n; i++) {
        const x = i * PASSO;
        const y = alturaEm(x + desloca, t * lentidao) * escala;
        d += `${i === 0 ? 'M' : 'L'}${x} ${(y + amp).toFixed(1)}`;
      }
      return d;
    };

    /** O mesmo caminho, fechado até o pé da faixa: é o corpo da água. */
    const fecha = (d: string) => `${d}L${n * PASSO} ${amp + profundidade}L0 ${amp + profundidade}Z`;

    const animar = getSettings().animations;
    let raf = 0;
    const t0 = performance.now();

    const desenha = (now: number) => {
      const t = (now - t0) / 1000;
      const linha = monta(t, 0, 1, 1);
      frente.current?.setAttribute('d', fecha(linha));
      crista.current?.setAttribute('d', linha);
      tras.current?.setAttribute('d', monta(t, FUNDO_ATRASO, FUNDO_ESCALA, FUNDO_LENTIDAO));
      if (animar) raf = requestAnimationFrame(desenha);
    };
    // um quadro sempre é desenhado, mesmo com animações desligadas: sem ele a
    // água ficaria sem superfície nenhuma em vez de ficar parada
    raf = requestAnimationFrame(desenha);
    return () => cancelAnimationFrame(raf);
  }, [width, altura, profundidade, segundos]);

  const amp = altura / 2;

  return (
    <svg
      className={`water-surface ${className}`}
      style={{ left, top: top - amp, width, height: amp * 2 + profundidade }}
      viewBox={`0 0 ${width} ${amp * 2 + profundidade}`}
      preserveAspectRatio="none"
      aria-hidden
    >
      {/* a onda de trás: só uma linha, para dar uma segunda distância à água */}
      <path ref={tras} className="ws-tras" fill="none" style={{ opacity: fundo }} />
      {/* o corpo: é ele que faz a borda de cima do mar ser a onda */}
      <path ref={frente} className="ws-corpo" fill={corAgua} />
      {/* a espuma da crista, por cima do corpo */}
      <path ref={crista} className="ws-crista" fill="none" style={{ opacity: espuma }} />
    </svg>
  );
}
