import {
  GRUPOS,
  TELAS,
  abrirTela,
  padraoTela,
  resetTela,
  resetTelas,
  setTela,
  telaCfg,
  useTelaAberta,
  useTelas,
  type TelaId,
} from './telas';
import { NumberField, SliderField } from './fields';

/**
 * Seção TELAS do editor.
 *
 * Três coisas, na ordem em que a mão precisa delas: ACHAR a tela (lista
 * agrupada por para que serve), ABRIR (ela aparece por cima do editor com
 * dados de mentira) e AJUSTAR (largura, altura, deslocamento, escala e o
 * quanto o fundo escurece).
 *
 * O agrupamento é por UTILIDADE e não por arquivo: as cinco telas da sequência
 * de pesca ficam juntas mesmo morando em quatro componentes diferentes, porque
 * quem vai mexer nelas está pensando "a pescaria está feia", e não "o
 * CatchPopup está feio".
 */
export function TelasPanel() {
  useTelas();
  const aberta = useTelaAberta();
  const sel = aberta;
  const cfg = sel ? telaCfg(sel) : null;
  const padrao = padraoTela(sel ?? undefined);

  return (
    <div className="editor-panel">
      <div className="etitle">TELAS DE INTERAÇÃO</div>
      <div className="ehint">
        Abrir mostra a tela de verdade por cima do editor, com dados de mentira. O que você ajusta
        aqui vale no jogo — é a mesma janela.
      </div>

      {GRUPOS.map((g) => {
        const doGrupo = TELAS.filter((t) => t.grupo === g.id);
        if (doGrupo.length === 0) return null;
        return (
          <div key={g.id}>
            <div className="eanim-label">
              {g.label} ({doGrupo.length})
            </div>
            <div className="elist telas">
              {doGrupo.map((t) => (
                <button
                  key={t.id}
                  className={`eitem${aberta === t.id ? ' on' : ''}`}
                  onClick={() => abrirTela(aberta === t.id ? null : (t.id as TelaId))}
                  title={`Abre no jogo: ${t.quando}`}
                >
                  <span className="grow">
                    {t.label}
                    <small> · {t.quando}</small>
                  </span>
                  <span className="mini">{aberta === t.id ? 'FECHAR' : 'ABRIR'}</span>
                </button>
              ))}
            </div>
          </div>
        );
      })}

      {sel && cfg && (
        <>
          <div className="etitle" style={{ marginTop: 10 }}>
            {TELAS.find((t) => t.id === sel)?.label}
          </div>
          <div className="ehint">
            A janela aberta arrasta pelo cabeçalho e estica pelo canto de baixo à direita, como
            qualquer objeto de cena.
          </div>
          <div className="efields">
            <NumberField
              label="LARGURA"
              value={cfg.larg}
              step={10}
              onChange={(v) => setTela(sel, { larg: Math.max(180, v) })}
              suffix={`padrão ${padrao.larg}`}
            />
            <NumberField
              label="ALTURA"
              value={cfg.alt}
              step={10}
              onChange={(v) => setTela(sel, { alt: Math.max(140, v) })}
              suffix={`padrão ${padrao.alt}`}
            />
            <NumberField
              label="DESLOCAR X"
              value={cfg.dx}
              step={5}
              onChange={(v) => setTela(sel, { dx: Math.round(v) })}
              suffix="a partir do centro"
            />
            <NumberField
              label="DESLOCAR Y"
              value={cfg.dy}
              step={5}
              onChange={(v) => setTela(sel, { dy: Math.round(v) })}
              suffix="a partir do centro"
            />
            <SliderField
              label="ESCALA"
              value={cfg.escala}
              min={0.4}
              max={2}
              step={0.05}
              onChange={(v) => setTela(sel, { escala: Number(v.toFixed(2)) })}
              suffix="× a janela inteira"
            />
            <SliderField
              label="ESCURECER O FUNDO"
              value={cfg.fundo}
              min={0}
              max={1}
              onChange={(v) => setTela(sel, { fundo: Number(v.toFixed(2)) })}
            />
          </div>
          <div className="erow">
            <button className="ebtn" onClick={() => resetTela(sel)}>
              VOLTAR ESTA AO PADRÃO
            </button>
            <button className="ebtn" onClick={() => abrirTela(null)}>
              FECHAR A TELA
            </button>
          </div>
        </>
      )}

      <button
        className="ebtn danger"
        style={{ marginTop: 10 }}
        onClick={() => confirm('Voltar TODAS as telas ao padrão?') && resetTelas()}
      >
        RESETAR TODAS
      </button>
    </div>
  );
}
