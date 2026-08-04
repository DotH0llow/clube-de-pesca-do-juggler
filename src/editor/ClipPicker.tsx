import { useEffect, useRef, useState } from 'react';
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
 * ------------------------------------------------------ pose é quadro, não clipe
 *
 * E é essa a parte que dá as "poses que faltavam". O pacote tem treze pastas,
 * mas trinta e sete DESENHOS - a pescaria sozinha tem seis, cada um uma pose
 * inteira de corpo (vara pronta, braço para trás, arremesso, espera, fisgada,
 * recolhimento). Pelo combo antigo, escolher `fish-left` te dava o clipe e o
 * campo QUADRO era um número solto que ninguém sabia preencher. Aqui os
 * trinta e sete estão à mão, um clique cada.
 *
 * O que continua faltando é ARTE, e isso não se resolve na interface: as
 * poses de frente, de três quartos e as outras quatro do `sentado/` existem no
 * pacote de origem e nunca foram importadas. `scripts/import-character.py`
 * agora as traz sozinho - basta rodar o importador com as pastas de origem à
 * mão, e elas aparecem aqui sem mexer em código nenhum (ver
 * `docs/animacoes-do-personagem.md`).
 */

/** Os clipes que existem, na ordem em que ficam bons de olhar. */
const CLIPES = Object.entries(CLIP_FRAMES)
  .map(([nome, quadros]) => ({ nome, quadros }))
  .sort((a, b) => a.nome.localeCompare(b.nome));

/** Miniatura que roda o clipe sozinha, para diferenciar andar de correr. */
function Miniatura({ clipe, quadros, rodando }: { clipe: string; quadros: number; rodando: boolean }) {
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

  return <img src={clipFrame(`char/${clipe}`, Math.min(i, quadros - 1))} alt={clipe} />;
}

interface Props {
  /** clipe escolhido agora */
  clipe: string;
  /** quadro escolhido; `undefined` esconde a tira de quadros (áreas de ANIMAÇÃO) */
  quadro?: number;
  onClipe: (nome: string) => void;
  onQuadro?: (n: number) => void;
}

export function ClipPicker({ clipe, quadro, onClipe, onQuadro }: Props) {
  const [hover, setHover] = useState<string | null>(null);
  const quadros = CLIP_FRAMES[clipe] ?? 0;

  return (
    <div className="eclip">
      <div className="eanim-label">POSE</div>
      <div className="eclip-grade">
        {CLIPES.map((c) => (
          <button
            key={c.nome}
            className={`eclip-item${c.nome === clipe ? ' on' : ''}`}
            onMouseEnter={() => setHover(c.nome)}
            onMouseLeave={() => setHover((v) => (v === c.nome ? null : v))}
            onClick={() => {
              onClipe(c.nome);
              // trocar de clipe com um quadro alto guardado deixaria a área
              // apontando para um quadro que o clipe novo não tem
              if (onQuadro) onQuadro(0);
            }}
            title={`${c.nome} · ${c.quadros} quadro${c.quadros > 1 ? 's' : ''}`}
          >
            {/* a miniatura só anima com o cursor em cima: quinze bonecos
                andando de uma vez transformam o painel numa vitrine */}
            <Miniatura clipe={c.nome} quadros={c.quadros} rodando={hover === c.nome} />
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
