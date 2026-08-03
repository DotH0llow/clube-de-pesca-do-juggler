"""
Importa o pacote `new.zip` (arvores e vida marinha) para dentro do jogo.

Mesma receita do `import-assets.py`: recorta a margem transparente e o pixel
solto, reduz para o teto da categoria e salva em webp.

    NEW_DIR=/caminho/do/new python3 scripts/import-new-assets.py

Requer: pillow e numpy.
"""
import glob
import os
import sys

import numpy as np
from PIL import Image

SRC = os.environ.get('NEW_DIR', './new')
OUT = os.environ.get('OUT_DIR', './src/assets/game')

# pasta de origem -> (categoria no jogo, teto em px, qualidade)
JOBS = [
    ('12_nature/trees/*.png', 'nature', 380, 78),
    ('13_marine-life/*.png', 'marine', 260, 78),
]


def keep_mask(alpha, keep_ratio=0.06, grid=110):
    """Mascara sem pixels soltos: rotula componentes por propagacao vetorizada."""
    m = alpha > 12
    h, w = m.shape
    step = max(1, int(np.ceil(max(h, w) / grid)))
    s = m[::step, ::step]
    if not s.any():
        return m
    sh, sw = s.shape
    lab = np.where(s, np.arange(sh * sw).reshape(sh, sw) + 1, 0).astype(np.int32)
    for _ in range(sh * sw):
        prev = lab
        p = np.zeros((sh + 2, sw + 2), np.int32)
        p[1:-1, 1:-1] = lab
        nb = np.maximum.reduce([
            p[0:-2, 0:-2], p[0:-2, 1:-1], p[0:-2, 2:],
            p[1:-1, 0:-2], p[1:-1, 1:-1], p[1:-1, 2:],
            p[2:, 0:-2], p[2:, 1:-1], p[2:, 2:],
        ])
        lab = np.where(s, nb, 0)
        if np.array_equal(lab, prev):
            break
    ids, counts = np.unique(lab[lab > 0], return_counts=True)
    good = ids[counts >= counts.max() * keep_ratio]
    ks = np.isin(lab, good)
    big = np.repeat(np.repeat(ks, step, 0), step, 1)[:h, :w]
    if big.shape != m.shape:
        pad = np.zeros_like(m)
        pad[:big.shape[0], :big.shape[1]] = big
        big = pad
    return m & big


def emit(src, rel, cap, quality):
    dst = os.path.join(OUT, rel + '.webp')
    im = Image.open(src).convert('RGBA')
    a = np.array(im)[:, :, 3]
    ys, xs = np.where(keep_mask(a))
    if len(ys):
        im = im.crop((int(xs.min()), int(ys.min()), int(xs.max()) + 1, int(ys.max()) + 1))
    w, h = im.size
    scale = min(1.0, cap / max(w, h))
    if scale < 1.0:
        im = im.resize((max(1, round(w * scale)), max(1, round(h * scale))), Image.LANCZOS)
    os.makedirs(os.path.dirname(dst), exist_ok=True)
    im.save(dst, 'WEBP', quality=quality, method=5)
    return os.path.getsize(dst)


def main():
    total = n = 0
    for pattern, cat, cap, q in JOBS:
        files = sorted(glob.glob(os.path.join(SRC, pattern)))
        if not files:
            print(f'  aviso: nada em {pattern}', file=sys.stderr)
        for f in files:
            total += emit(f, f'{cat}/{os.path.basename(f)[:-4]}', cap, q)
            n += 1
        print(f'  {cat}: {len(files)} arquivos')
    print(f'total {n} sprites, {total / 1024:.0f} KB')


if __name__ == '__main__':
    main()
