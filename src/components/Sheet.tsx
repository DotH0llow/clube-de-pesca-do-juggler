import type { ReactNode } from 'react';
import { telaVars, useTelas } from '../editor/telas';

interface Props {
  title: string;
  onClose: () => void;
  children: ReactNode;
  /**
   * Qual TELA esta janela é, para a seção TELAS do editor.
   *
   * O `Sheet` é a mesma moldura para meia dúzia de janelas diferentes -
   * mercado, loja, álbum, encerrar o dia - e sem um nome por janela o editor
   * só conseguiria ajustar todas de uma vez. Quem não passa nome cai em
   * `sheet`, que é a configuração comum a todas.
   */
  tela?: string;
}

/**
 * Janela de tamanho FIXO usada fora do jogo (tela de titulo).
 * O tamanho não muda com a quantidade de conteudo: o corpo rola por dentro.
 * Regra valida para qualquer tela nova daqui pra frente.
 *
 * "Fixo" quer dizer que ele não acompanha o CONTEÚDO - e não que ele é
 * imutável. Largura, altura, deslocamento e escala saem da seção TELAS do
 * editor e entram por variável de CSS no fundo escuro, de onde a janela herda.
 */
export function Sheet({ title, onClose, children, tela = 'sheet' }: Props) {
  useTelas();
  return (
    <div className="modal-backdrop" style={telaVars(tela)} onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-head">
          <h2>{title}</h2>
          <button className="btn ghost small" onClick={onClose}>
            FECHAR
          </button>
        </div>
        <div className="sheet-body">{children}</div>
      </div>
    </div>
  );
}
