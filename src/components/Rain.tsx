import { useMemo } from 'react';
import { asset } from '../assets';
import { useScene } from '../editor/scene';
import { groundAt } from '../world/layout';
import { faixaDosPisos, temPiso } from '../world/ground';

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
 *   BATENDO     o respingo (`rain-drop-13..16`), quatro quadros, no chão
 *   ESCORRENDO  o que pinga das bordas (`water-runoff-*`), no píer
 *
 * ------------------------------------------------------ a gota cai deitada
 *
 * A arte das fitas é DIAGONAL: a cabeça brilhante fica embaixo à esquerda e o
 * rastro sobe para a direita, num ângulo de uns 40° com a vertical. Isso não
 * é enfeite - é o desenho dizendo para onde a gota está indo.
 *
 * O percurso, porém, era `translate3d(14vh, 118vh)`: sete graus, praticamente
 * uma queda a prumo, e ainda por cima para o LADO ERRADO. O resultado é o
 * defeito clássico de chuva em jogo: o risco aponta para um lado e anda para
 * outro, então cada gota parece deslizar de lado em vez de cair. Agora o
 * percurso segue o próprio eixo do desenho (`INCLINACAO`, medido na arte), e a
 * gota vai para onde ela aponta.
 *
 * O `x` é declarado em `vh` nas duas direções de propósito: `vw` e `vh` são
 * unidades diferentes, e usar uma em cada eixo faria o ângulo mudar conforme a
 * janela - a chuva ficaria mais deitada numa tela larga.
 *
 * -------------------------------------------------- as gotas gordas saíram
 *
 * `rain-drop-09..12` são gotas VERTICAIS, de pingo parado. Elas entravam
 * esparsas "para quebrar a regularidade" e faziam o oposto: num temporal
 * inclinado, uma gota a prumo no meio das outras é a única coisa que o olho
 * pega. Saíram.
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

/**
 * Quanto a gota anda de lado para cada unidade que ela desce.
 *
 * Sai da arte, não do gosto: as fitas têm por volta de 140 px de largura para
 * 160 de altura, então o eixo do risco é 0,86. Arredondado para 0,8 - um fio
 * mais em pé do que o desenho, o que dá margem para o rastro não parecer que
 * ficou para trás.
 */
const INCLINACAO = 0.8;

/** Quanto a gota desce ao atravessar a tela, em vh. */
const PERCURSO = 118;

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
 *
 * As alturas estão em 30% do que eram - o pedido foi tirar 70% do tamanho. A
 * chuva antiga tinha fitas de 9vh na camada da frente: quase um décimo da tela
 * por gota, o que de perto lê como riscos de tinta e não como água.
 */
const REDUCAO = 0.3;

const CAMADAS: Camada[] = [
  { n: 34, alt: 3.2 * REDUCAO, opacidade: 0.35, segundos: 1.5, seed: 11, z: 1 },
  { n: 26, alt: 5.5 * REDUCAO, opacidade: 0.55, segundos: 1.0, seed: 29, z: 2 },
  { n: 14, alt: 9.0 * REDUCAO, opacidade: 0.8, segundos: 0.65, seed: 47, z: 3 },
];

/** As oito fitas que caem. São TODAS diagonais - é o pacote inteiro menos as verticais. */
const FITAS = Array.from({ length: 8 }, (_, i) => `rain/rain-drop-${String(i + 1).padStart(2, '0')}`);
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
  return Array.from({ length: c.n }, (_, i) => ({
    key: `${c.seed}-${i}`,
    sprite: FITAS[Math.floor(r() * FITAS.length)],
    /*
     * A faixa de nascimento acompanha a INCLINAÇÃO.
     *
     * Enquanto a queda era quase vertical, nascer de −10% a 110% da largura
     * bastava. Andando quase uma tela para a esquerda, a mesma faixa deixaria
     * a direita seca: as gotas que nascem na borda direita chegam ao rodapé
     * ainda no meio da tela, e nada nasce depois delas. Então a faixa passa da
     * borda direita pelo tanto que a gota anda de lado.
     */
    x: -10 + r() * 200,
    alt: c.alt * (0.8 + r() * 0.45),
    opacidade: c.opacidade * (0.75 + r() * 0.4),
    dur: c.segundos * (0.85 + r() * 0.35),
    // o atraso espalhado no tempo é o que impede a chuva de cair em levas
    atraso: -r() * c.segundos * 2,
    z: c.z,
  }));
}

export function Rain({ forte = false }: { forte?: boolean }) {
  const gotas = useMemo(() => CAMADAS.flatMap(gotasDe), []);

  return (
    <div
      className={`rain-layer${forte ? ' forte' : ''}`}
      style={
        {
          '--queda-x': `${-INCLINACAO * PERCURSO}vh`,
          '--queda-y': `${PERCURSO}vh`,
        } as React.CSSProperties
      }
      aria-hidden
    >
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
    </div>
  );
}

/**
 * O RESPINGO, onde a água encontra o chão.
 *
 * Ele MUDOU DE SISTEMA DE COORDENADAS, e é essa a mudança que importa. Antes
 * ele vivia dentro da chuva, que é de TELA: dezoito respingos parados em
 * `bottom: 2vh`, ou seja, colados no rodapé da janela. Andar não mudava nada,
 * e a água batia igualmente no ar, na areia e no meio do mar aberto - porque
 * "o rodapé da tela" não é lugar nenhum do mundo.
 *
 * Agora ele é de MUNDO e pergunta ao chão: cada respingo sorteia um `x` dentro
 * da faixa dos pisos (as caixas de CHÃO da cena), descarta o que cair num vão,
 * e assenta em `groundAt(x)`. Ou seja: pinga no deck e na praia, e não pinga
 * onde não há o que molhar. Mexer numa caixa de chão no editor muda onde a
 * chuva bate.
 *
 * ------------------------------------------------------------- a frequência
 *
 * Cada respingo tem um CICLO cinco vezes maior que a própria animação: quatro
 * quadros acendendo e depois um tempo morto de quatro animações. É o pedido de
 * 80% menos frequência sem tirar respingo da tela inteira - com menos pontos e
 * ritmo igual, a chuva bate sempre nos mesmos lugares, o que é pior.
 */
const RESPINGO_CICLO = 5;

/**
 * Quantos pontos de respingo existem no MAPA INTEIRO.
 *
 * Não confundir com "quantos aparecem": eles se espalham por uns 2 900 de
 * mundo e a tela mostra cerca de 1 300, então uns 18 estão em quadro por vez -
 * e cada um só acende num quinto do ciclo. A conta que importa é a de
 * respingos por segundo na tela: eram 18 pontos piscando sem parar a cada 0,6 s,
 * uns 29 por segundo; agora são pouco menos de 6. É o corte de 80% pedido.
 */
const RESPINGO_PONTOS = 40;

export function Splashes({ semente = 83, quantos = RESPINGO_PONTOS }: { semente?: number; quantos?: number }) {
  /*
   * O respingo acompanha o EDITOR.
   *
   * Ele lê as caixas de chão, e caixa de chão se arrasta. Sem assinar a cena,
   * mudar o piso no editor não moveria a chuva junto - ela só se acertaria no
   * próximo recarregamento, que é o tipo de defasagem que faz duvidar se a
   * edição funcionou.
   */
  const cena = useScene('mundo');
  const pontos = useMemo(() => {
    const faixa = faixaDosPisos();
    if (!faixa) return [];
    const r = rng(semente);
    const out: { key: string; x: number; y: number; alt: number; op: number; dur: number; atraso: number }[] = [];
    // tenta mais vezes do que precisa: os sorteios que caem num vão sem chão
    // são descartados, e um mapa cheio de vãos ainda assim se enche
    for (let i = 0; i < quantos * 3 && out.length < quantos; i++) {
      const x = faixa.x0 + r() * (faixa.x1 - faixa.x0);
      const alt = 8 + r() * 7;
      const op = 0.45 + r() * 0.3;
      const dur = 0.48 + r() * 0.3;
      const atraso = -r() * dur * RESPINGO_CICLO;
      if (!temPiso(x)) continue;
      out.push({ key: `sp-${i}`, x, y: groundAt(x), alt, op, dur, atraso });
    }
    return out;
  }, [semente, quantos, cena]);

  return (
    <>
      {pontos.map((s) => (
        <span
          key={s.key}
          className="rain-splash"
          style={{ left: s.x, top: s.y - s.alt, height: s.alt, opacity: s.op }}
        >
          {/* Quatro arquivos empilhados, acendendo um de cada vez. Não é um
              sprite sheet com `steps(4)`: são imagens separadas, e empilhar
              sai mais barato do que montar um atlas em tempo de execução. */}
          {RESPINGO.map((frame, i) => (
            <img
              key={frame}
              src={asset(frame)}
              alt=""
              style={{
                animationDuration: `${s.dur * RESPINGO_CICLO}s`,
                animationDelay: `${s.atraso + (i * s.dur) / 4}s`,
              }}
            />
          ))}
        </span>
      ))}
    </>
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

/**
 * De quanto em quanto nasce um pingo na borda do deck.
 *
 * Era 110 unidades. A 275 são 60% menos pingos ao longo da mesma testeira, que
 * é o que se pediu - e é o número certo pela razão certa: a testeira não muda
 * de tamanho, então mexer no espaçamento é a única forma honesta de mexer na
 * quantidade. Diminuir o tamanho de cada um (que também acontece, logo abaixo)
 * não tira nenhum da tela.
 */
const PASSO_DO_PINGO = 275;

export function Runoff({ left, width, top }: { left: number; width: number; top: number }) {
  const itens = useMemo(() => {
    const r = rng(101);
    const out: { key: string; sprite: string; x: number; h: number; op: number; dur: number; atraso: number }[] = [];
    // a posição é sorteada dentro da fatia: espaçamento regular denunciaria
    // que aquilo é uma fileira
    for (let x = 0, i = 0; x < width; x += PASSO_DO_PINGO, i++) {
      const cortina = r() < 0.35;
      out.push({
        key: `r-${i}`,
        sprite: cortina
          ? CORTINAS[Math.floor(r() * CORTINAS.length)]
          : PINGOS[Math.floor(r() * PINGOS.length)],
        x: x + r() * (PASSO_DO_PINGO * 0.6),
        // 30% do que era: um lençol de 70 unidades pendurado no deck lia como
        // cachoeira, não como chuva pingando
        h: (cortina ? 42 + r() * 30 : 26 + r() * 22) * REDUCAO,
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
