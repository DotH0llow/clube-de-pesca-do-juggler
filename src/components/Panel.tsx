import type { ReactNode } from 'react';

interface Props {
  title: string;
  onClose: () => void;
  children: ReactNode;
  right?: ReactNode;
}

export function Panel({ title, onClose, children, right }: Props) {
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="pixel-box framed panel" onClick={(e) => e.stopPropagation()}>
        <div className="panel-head">
          <h2>{title}</h2>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {right}
            <button className="btn ghost small" onClick={onClose}>
              FECHAR
            </button>
          </div>
        </div>
        <div className="panel-body">{children}</div>
      </div>
    </div>
  );
}
