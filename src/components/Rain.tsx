import { useMemo } from 'react';
import { asset } from '../assets';

/**
 * A CHUVA.
 *
 * O que havia antes eram duas cópias de `sky/rain-streaks` - uma única imagem
 * de riscos, esticada na tela inteira e deslizada em loop. De longe passava
 * por chuva; de perto era um papel de parede andando, sempre com os mesmos
 * riscos nas mesmas posições relativas, sem nada acontecendo quando a água
 * encostava em alguma coisa.
 *
 * Agora a chuva é feita de gotas de verdade, do pacote novo, e tem três
 * momentos - que é o que faz chuva parecer chuva:
 *
 *   CAINDO      as fitas (`rain-drop-01..08`), em três distâncias
 *   BATENDO     o respingo (`rain-drop-13..16`), quatro quadros, onde a água
 *               encontra alguma coisa
 *   ESCORRENDO  o que pinga das bordas (`water-runoff-*`), no píer
 *
 * ---------------------------------------------------------------- distância
 *
 * As três camadas não são enfeite: são o que dá volume. A de trás é pequena,
 * apagada e lenta; a da frente é grande, opaca e rápida, e passa por cima do
 * Juggler. Com uma camada só, a chuva vira uma cortina chapada na frente da
 * cena - foi o defeito da versão antiga.
 *
 * ------------------------------------------------------------- o sorteio
 *
 * Posição, sprite e ritmo saem de um gerador com semente fixa, e não de
 * `Math.random()`. Assim a chuva é sempre a mesma entre um render e outro: com
 * `Math.random()` cada re-render do React reposicionaria todas as gotas, e a
 * chuva daria um salto toda vez que qualquer outra coisa na tela mudasse.
 */

/** Gerador com semente: mesma entrada, mesma chuva. */
function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

interface Camada {
  /** quantas gotas */
  n: number;
  /** altura da gota, em vh */
  alt: number;
  opacidade: number;
  /** segundos que a gota leva para atravessar a tela */
  segundos: number;
  /** semente, para as camadas não saírem idênticas */
  seed: number;
  z: number;
}

/**
 * As três distâncias.
 *
 * A gota da frente é quase quatro vezes maior que a do fundo e cai em menos da
 * metade do tempo. É um exagero de propósito: parallax discreto demais não é
 * lido como profundidade, é lido como borrão.
 */
const CAMADAS: Camada[] = [
  { n: 34, alt: 3.2, opacidade: 0.35, segundos: 1.5, seed: 11, z: 1 },
  { n: 26, alt: 5.5, opacidade: 0.55, segundos: 1.0, seed: 29, z: 2 },
  { n: 14, alt: 9.0, opacidade: 0.8, segundos: 0.65, seed: 47, z: 3 },
];

/** As oito fitas que caem. */
const FITAS = Array.from({ length: 8 }, (_, i) => `rain/rain-drop-${String(i + 1).padStart(2, '0')}`);
/** As quatro gotas gordas: entram esparsas, para quebrar a regularidade. */
const GORDAS = ['rain/rain-drop-09', 'rain/rain-drop-10', 'rain/rain-drop-11', 'rain/rain-drop-12'];
/** Os quatro quadros do respingo. */
const RESPINGO = ['rain/rain-drop-13', 'rain/rain-drop-14', 'rain/rain-drop-15', 'rain/rain-drop-16'];

interface Gota {
  key: string;
  sprite: string;
  x: number;
  alt: number;
  opacidade: number;
  dur: number;
  atraso: number;
  z: number;
}

function gotasDe(c: Camada): Gota[] {
  const r = rng(c.seed);
  return Array.from({ length: c.n }, (_, i) => {
    const gorda = r() < 0.12;
    return {
      key: `${c.seed}-${i}`,
      sprite: gorda ? GORDAS[Math.floor(r() * GORDAS.length)] : FITAS[Math.floor(r() * FITAS.length)],
      // −10 a 110: a chuva começa e termina fora da tela, então não há uma
      // coluna vazia na borda esquerda nem na direita
      x: -10 + r() * 120,
      alt: c.alt * (0.8 + r() * 0.45),
      opacidade: c.opacidade * (0.75 + r() * 0.4),
      dur: c.segundos * (0.85 + r() * 0.35),
      // o atraso espalhado no tempo é o que impede a chuva de cair em levas
      atraso: -r() * c.segundos * 2,
      z: c.z,
    };
  });
}

/** Os respingos da linha de baixo, onde a água bate. */
function respingosDe(quantos: number): Gota[] {
  const r = rng(83);
  return Array.from({ length: quantos }, (_, i) => ({
    key: `sp-${i}`,
    sprite: RESPINGO[0],
    x: r() * 100,
    alt: 2.2 + r() * 1.6,
    opacidade: 0.5 + r() * 0.3,
    dur: 0.48 + r() * 0.3,
    atraso: -r() * 2,
    z: 2,
  }));
}

export function Rain({ forte = false }: { forte?: boolean }) {
  const gotas = useMemo(() => CAMADAS.flatMap(gotasDe), []);
  const respingos = useMemo(() => respingosDe(18), []);

  return (
    <div className={`rain-layer${forte ? ' forte' : ''}`} aria-hidden>
      {gotas.map((g) => (
        <img
          key={g.key}
          className="rain-drop"
          src={asset(g.sprite)}
          alt=""
          style={
            {
              left: `${g.x}vw`,
              height: `${g.alt}vh`,
              opacity: g.opacidade,
              zIndex: g.z,
              animationDuration: `${g.dur}s`,
              animationDelay: `${g.atraso}s`,
            } as React.CSSProperties
          }
        />
      ))}

      {/* O RESPINGO.

          Ele é um sprite só trocando de quadro por `steps(4)` num sprite
          sheet? Não: são quatro arquivos separados, então o truque é empilhar
          os quatro e acender um de cada vez com atrasos escalonados. Sai mais
          barato do que montar um atlas em tempo de execução e dá no mesmo. */}
      {respingos.map((s) => (
        <span
          key={s.key}
          className="rain-splash"
          style={
            {
              left: `${s.x}vw`,
              height: `${s.alt}vh`,
              opacity: s.opacidade,
              animationDuration: `${s.dur}s`,
              animationDelay: `${s.atraso}s`,
            } as React.CSSProperties
          }
        >
          {RESPINGO.map((frame, i) => (
            <img
              key={frame}
              src={asset(frame)}
              alt=""
              style={{ animationDuration: `${s.dur}s`, animationDelay: `${s.atraso + (i * s.dur) / 4}s` }}
            />
          ))}
        </span>
      ))}
    </div>
  );
}

/**
 * O que escorre das bordas.
 *
 * Fica separado da chuva de propósito: a chuva é de TELA (ela cai na frente de
 * tudo, sem posição no mundo), e o escorrimento é de MUNDO - ele pinga de uma
 * borda específica, o deck do píer, e tem de andar junto com a câmera. Juntar
 * os dois num componente só obrigaria um deles a viver no sistema de
 * coordenadas errado.
 */
const PINGOS = [
  'rain/water-runoff-01',
  'rain/water-runoff-03',
  'rain/water-runoff-05',
  'rain/water-runoff-08',
  'rain/water-runoff-09',
  'rain/water-runoff-11',
];
/** As cortinas mais largas, que escorrem em lençol. */
const CORTINAS = ['rain/water-runoff-02', 'rain/water-runoff-07', 'rain/water-runoff-10', 'rain/water-runoff-12'];

export function Runoff({ left, width, top }: { left: number; width: number; top: number }) {
  const itens = useMemo(() => {
    const r = rng(101);
    const out: { key: string; sprite: string; x: number; h: number; op: number; dur: number; atraso: number }[] = [];
    // um pingo a cada ~110 unidades, com a posição sorteada dentro da fatia:
    // espaçamento regular denunciaria que aquilo é uma fileira
    for (let x = 0, i = 0; x < width; x += 110, i++) {
      const cortina = r() < 0.35;
      out.push({
        key: `r-${i}`,
        sprite: cortina
          ? CORTINAS[Math.floor(r() * CORTINAS.length)]
          : PINGOS[Math.floor(r() * PINGOS.length)],
        x: x + r() * 70,
        h: cortina ? 42 + r() * 30 : 26 + r() * 22,
        op: 0.45 + r() * 0.3,
        dur: 1.6 + r() * 1.6,
        atraso: -r() * 3,
      });
    }
    return out;
  }, [width]);

  return (
    <div className="runoff-layer" style={{ left, width, top }} aria-hidden>
      {itens.map((it) => (
        <img
          key={it.key}
          className="runoff-drip"
          src={asset(it.sprite)}
          alt=""
          style={{
            left: it.x,
            height: it.h,
            opacity: it.op,
            animationDuration: `${it.dur}s`,
            animationDelay: `${it.atraso}s`,
          }}
        />
      ))}
    </div>
  );
}
