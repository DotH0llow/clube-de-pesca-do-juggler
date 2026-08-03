import { useState } from 'react';
import { asset } from '../assets';
import {
  addFolder,
  diskFolder,
  foldersOf,
  moveAsset,
  moveFolder,
  removeFolder,
  resetLibrary,
  toggleFolder,
  useLibraryState,
} from './library';

/**
 * Biblioteca de assets.
 *
 * Pasta abre e fecha no clique do titulo. O titulo tambem arrasta: solte em
 * cima de outro titulo para reordenar. Item arrastado para dentro de um titulo
 * troca de pasta - e etiqueta, nao arquivo, entao da para desfazer com RESETAR.
 * Item arrastado para a cena vira objeto (isso quem cuida e o editor).
 */
export function LibraryPanel({
  onDragAsset,
  onAddAsset,
}: {
  onDragAsset: (path: string, clientX: number, clientY: number) => void;
  /** clique simples: joga o asset no meio da tela, sem arrastar nada */
  onAddAsset: (path: string) => void;
}) {
  const lib = useLibraryState();
  const folders = foldersOf(lib);

  /** o que esta na mao: uma pasta (reordenar) ou um asset (refilar) */
  const [held, setHeld] = useState<{ kind: 'pasta' | 'asset'; id: string } | null>(null);
  const [over, setOver] = useState<string | null>(null);
  const [novo, setNovo] = useState('');

  const drop = (folder: string) => {
    if (!held) return;
    if (held.kind === 'pasta') moveFolder(held.id, folder);
    else moveAsset(held.id, folder);
    setHeld(null);
    setOver(null);
  };

  return (
    <div className="editor-panel">
      <div className="etitle">BIBLIOTECA &middot; ARRASTE PARA A CENA</div>

      <div className="elib-tools">
        <input
          value={novo}
          placeholder="nova pasta"
          onChange={(e) => setNovo(e.target.value)}
          onKeyDown={(e) => {
            if (e.key !== 'Enter') return;
            addFolder(novo);
            setNovo('');
          }}
        />
        <button
          className="ebtn"
          onClick={() => {
            addFolder(novo);
            setNovo('');
          }}
        >
          CRIAR
        </button>
        <button className="ebtn danger" onClick={() => confirm('Voltar a biblioteca ao padrão?') && resetLibrary()}>
          RESETAR
        </button>
      </div>

      <div className="elib">
        {folders.map((f) => (
          <div
            key={f.name}
            className={`elib-group${over === f.name ? ' over' : ''}`}
            onDragOver={(e) => {
              e.preventDefault();
              setOver(f.name);
            }}
            onDragLeave={() => setOver((v) => (v === f.name ? null : v))}
            onDrop={(e) => {
              e.preventDefault();
              drop(f.name);
            }}
          >
            <div
              className="elib-cat"
              draggable
              onDragStart={() => setHeld({ kind: 'pasta', id: f.name })}
              onDragEnd={() => {
                setHeld(null);
                setOver(null);
              }}
              onClick={() => toggleFolder(f.name)}
              title="Clique abre e fecha. Arraste para reordenar."
            >
              <span className="elib-arrow">{f.open ? '▾' : '▸'}</span>
              <span className="grow">{f.name.toUpperCase()}</span>
              <small>{f.items.length}</small>
              {lib.custom.includes(f.name) && (
                <span
                  className="mini"
                  title="Apagar esta pasta (os assets voltam para a pasta de origem)"
                  onClick={(e) => {
                    e.stopPropagation();
                    removeFolder(f.name);
                  }}
                >
                  ×
                </span>
              )}
            </div>

            {f.open && (
              <div className="elib-grid">
                {f.items.map((path) => (
                  <button
                    key={path}
                    className="elib-item"
                    title={`${path}${lib.moved[path] ? ` (origem: ${diskFolder(path)})` : ''}`}
                    draggable
                    onDragStart={() => setHeld({ kind: 'asset', id: path })}
                    onDragEnd={() => {
                      setHeld(null);
                      setOver(null);
                    }}
                    onClick={() => onAddAsset(path)}
                    onPointerDown={(e) => {
                      // CLIQUE simples ja poe na cena (`onClick`). Segurar shift
                      // e arrastar deixa escolher o lugar; arrastar sem shift e o
                      // drag nativo, que serve para trocar de pasta.
                      if (e.button !== 0 || !e.shiftKey) return;
                      e.preventDefault();
                      onDragAsset(path, e.clientX, e.clientY);
                    }}
                  >
                    <img src={asset(path)} alt="" />
                  </button>
                ))}
                {f.items.length === 0 && <div className="elib-empty">solte um asset aqui</div>}
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="ehint">
        <strong>Clique põe o asset na cena</strong>, no meio da tela e já selecionado. Shift +
        arrastar deixa escolher o ponto na mão. Arrastar um item para outra pasta só muda onde ele
        aparece aqui - não mexe em arquivo.
      </div>
    </div>
  );
}
