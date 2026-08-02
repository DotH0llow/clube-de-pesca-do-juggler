import type { ReactNode } from 'react';

interface Props {
  title: string;
  onClose: () => void;
  children: ReactNode;
}

/**
 * Janela de tamanho FIXO usada fora do jogo (tela de titulo).
 * O tamanho nao muda com a quantidade de conteudo: o corpo rola por dentro.
 * Regra valida para qualquer tela nova daqui pra frente.
 */
export function Sheet({ title, onClose, children }: Props) {
  return (
    <div className="modal-backdrop" onClick={onClose}>
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
