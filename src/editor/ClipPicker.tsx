import { useEffect, useMemo, useRef, useState } from 'react';
import { clipFrame } from '../assets';
import { CLIP_FRAMES } from '../world/charFrames';

/**
 * ESCOLHER POSE OLHANDO PARA A POSE.
 *
 * O que havia era um `<select>` com treze linhas de texto: `sit-right (1
 * quadro)`, `fish-left (6 quadros)`. Nomes de pasta. Para saber o que é
 * `fish-left` quadro 4 era preciso escolher no escuro, fechar o inspetor,
 * olhar o boneco na cena e voltar - e repetir por quadro, porque a diferença
 * entre a fisgada e o recolhimento é o desenho, não a palavra.
 *
 * Aqui a lista é a arte. Cada clipe é uma miniatura do próprio primeiro
 * quadro, e o escolhido abre a tira com TODOS os quadros dele para clicar.
 *
 * ------------------------------------------------------------- personagem
 *
 * E o elenco vem antes. A arte era `char/<clipe>` e virou
 * `char/<personagem>/<clipe>`, porque sem a pasta do personagem no meio só
 * cabe UM elenco no jogo inteiro: dois personagens com uma pose `sit-left`
 * cada disputariam o mesmo arquivo. A lista de personagens sai de
 * `CLIP_FRAMES`, que o importador gera - não há relação escrita à mão aqui.
 *
 * Hoje há um personagem só, o Juggler, e com um a barra de escolha não
 * aparece: uma escolha de uma opção só é ruído. Ela aparece sozinha quando a
 * segunda pasta existir.
 *
 * ------------------------------------------------ pose é quadro, não clipe
 *
 * É essa a parte que dá as "poses que faltavam". O pacote tem treze pastas,
 * mas trinta e sete DESENHOS - a pescaria sozinha tem seis, cada um uma pose
 * inteira de corpo (vara pronta, braço para trás, arremesso, espera, fisgada,
 * recolhimento). Pelo combo antigo, escolher `fish-left` dava o clipe e o
 * campo QUADRO era um número solto que ninguém sabia preencher. Aqui os
 * trinta e sete estão à mão, um clique cada.
 *
 * O que continua faltando é ARTE, e isso não se resolve na interface: sentado
 * de frente e de costas, as vistas de três quartos e as outras quatro poses do
 * `sentado/` existem no pacote de origem e nunca foram importadas.
 * `scripts/import-character.py` agora as traz sozinho - basta rodar o
 * importador com as pastas de origem à mão (ver
 * `docs/animacoes-do-personagem.md`).
 */

interface Clipe {
  /** `personagem/clipe`, que é a chave de `CLIP_FRAMES` */
  chave: string;
  personagem: string;
  nome: string;
  quadros: number;
}

const CLIPES: Clipe[] = Object.entries(CLIP_FRAMES)
  .map(([chave, quadros]) => {
    const corte = chave.indexOf('/');
    return {
      chave,
      personagem: corte < 0 ? 'juggler' : chave.slice(0, corte),
      nome: corte < 0 ? chave : chave.slice(corte + 1),
      quadros,
    };
  })
  .sort((a, b) => a.chave.localeCompare(b.chave));

const PERSONAGENS = [...new Set(CLIPES.map((c) => c.personagem))].sort();

/** Miniatura que roda o clipe sozinha, para diferenciar andar de correr. */
function Miniatura({ chave, quadros, rodando }: { chave: string; quadros: number; rodando: boolean }) {
  const [i, setI] = useState(0);
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => {
    if (timer.current !== undefined) window.clearInterval(timer.current);
    if (!rodando || quadros <= 1) {
      setI(0);
      return;
    }
    timer.current = window.setInterval(() => setI((v) => (v + 1) % quadros), 260);
    return () => window.clearInterval(timer.current);
  }, [rodando, quadros]);

  return <img src={clipFrame(`char/${chave}`, Math.min(i, quadros - 1))} alt={chave} />;
}

interface Props {
  /** clipe escolhido agora, no formato `personagem/clipe` */
  clipe: string;
  /** quadro escolhido; `undefined` esconde a tira de quadros (áreas de ANIMAÇÃO) */
  quadro?: number;
  onClipe: (chave: string) => void;
  onQuadro?: (n: number) => void;
}

export function ClipPicker({ clipe, quadro, onClipe, onQuadro }: Props) {
  const [hover, setHover] = useState<string | null>(null);
  const quadros = CLIP_FRAMES[clipe] ?? 0;

  /*
   * De quem é a pose que está escolhida.
   *
   * Sai do próprio clipe, e não de um estado à parte: um estado próprio
   * dessincronizaria na hora em que a caixa selecionada mudasse no editor - a
   * grade mostraria o elenco de um personagem e o destaque estaria no de
   * outro.
   */
  const personagem = clipe.includes('/') ? clipe.slice(0, clipe.indexOf('/')) : PERSONAGENS[0];
  const [vendo, setVendo] = useState(personagem);
  useEffect(() => setVendo(personagem), [personagem]);

  const doElenco = useMemo(() => CLIPES.filter((c) => c.personagem === vendo), [vendo]);

  return (
    <div className="eclip">
      {PERSONAGENS.length > 1 && (
        <>
          <div className="eanim-label">PERSONAGEM</div>
          <div className="erow">
            {PERSONAGENS.map((p) => (
              <button
                key={p}
                className={`ebtn${vendo === p ? ' primary' : ''}`}
                onClick={() => setVendo(p)}
              >
                {p.toUpperCase()}
              </button>
            ))}
          </div>
        </>
      )}

      <div className="eanim-label">
        POSE {PERSONAGENS.length > 1 ? `· ${vendo.toUpperCase()}` : ''} ({doElenco.length} clipes)
      </div>
      <div className="eclip-grade">
        {doElenco.map((c) => (
          <button
            key={c.chave}
            className={`eclip-item${c.chave === clipe ? ' on' : ''}`}
            onMouseEnter={() => setHover(c.chave)}
            onMouseLeave={() => setHover((v) => (v === c.chave ? null : v))}
            onClick={() => {
              onClipe(c.chave);
              // trocar de clipe com um quadro alto guardado deixaria a área
              // apontando para um quadro que o clipe novo não tem
              if (onQuadro) onQuadro(0);
            }}
            title={`${c.chave} · ${c.quadros} quadro${c.quadros > 1 ? 's' : ''}`}
          >
            {/* a miniatura só anima com o cursor em cima: quinze bonecos
                andando de uma vez transformam o painel numa vitrine */}
            <Miniatura chave={c.chave} quadros={c.quadros} rodando={hover === c.chave} />
            <span>{c.nome}</span>
            {c.quadros > 1 && <i>{c.quadros}</i>}
          </button>
        ))}
      </div>

      {/* A TIRA DE QUADROS.

          Só aparece em área de POSE, e só quando o clipe tem mais de um: numa
          pasta de um quadro só não há o que escolher, e mostrar uma tira de um
          item sugere que há. */}
      {onQuadro && quadros > 1 && (
        <>
          <div className="eanim-label">QUADRO ({quadros} no clipe)</div>
          <div className="eclip-quadros">
            {Array.from({ length: quadros }, (_, n) => (
              <button
                key={n}
                className={`eclip-item${n === (quadro ?? 0) ? ' on' : ''}`}
                onClick={() => onQuadro(n)}
                title={`quadro ${n}`}
              >
                <img src={clipFrame(`char/${clipe}`, n)} alt="" />
                <i>{n}</i>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
