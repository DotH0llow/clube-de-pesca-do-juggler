"""
Gera src/assets/dims.ts com a proporcao de cada sprite.

O editor precisa saber a largura natural de um asset para desenhar a caixa de
selecao antes de a imagem carregar. Medir no build evita layout piscando.

    python3 scripts/asset-dims.py
"""
import glob
import os

from PIL import Image

ROOT = 'src/assets/game'
OUT = 'src/assets/dims.ts'

rows = []
for path in sorted(glob.glob(os.path.join(ROOT, '**', '*.webp'), recursive=True)):
    rel = os.path.relpath(path, ROOT)[: -len('.webp')].replace(os.sep, '/')
    if rel.startswith('char/'):
        continue
    with Image.open(path) as im:
        rows.append((rel, im.width, im.height))

with open(OUT, 'w', encoding='utf-8') as fh:
    fh.write('/**\n')
    fh.write(' * GERADO por scripts/asset-dims.py - tamanho natural de cada sprite.\n')
    fh.write(' * O editor usa isso para saber a largura de um asset novo na cena.\n')
    fh.write(' */\n\n')
    fh.write('export const ASSET_DIMS: Record<string, [number, number]> = {\n')
    for rel, w, h in rows:
        fh.write(f"  '{rel}': [{w}, {h}],\n")
    fh.write('};\n\n')
    fh.write('/** largura / altura; 1 quando o asset nao for conhecido */\n')
    fh.write('export function aspectOf(path: string): number {\n')
    fh.write('  const d = ASSET_DIMS[path];\n')
    fh.write('  return d ? d[0] / d[1] : 1;\n')
    fh.write('}\n\n')
    fh.write('export const ASSET_LIST: string[] = Object.keys(ASSET_DIMS);\n')
print('escrito', OUT, len(rows), 'sprites')
