"""
Importa o pacote de ilhas (`islands-pack-20-v1`) para dentro do jogo.

O horizonte era UMA faixa costurada (`sky/distant-island-strip`) repetida ate
o fim do mar: a mesma silhueta a cada 1600 unidades, e nada disso dava para
mover. As ilhas agora sao sprite por sprite, na pasta `island/`, e entram na
cena como objeto de verdade - arrasta, estica, muda de profundidade.

    ISLANDS_DIR=/caminho/do/pacote python3 scripts/import-islands.py

O `keep_mask` e o mesmo do `import-new-assets.py`: corta a margem transparente
e joga fora pixel solto que a IA deixou boiando fora da silhueta.

Requer: pillow e numpy.
"""
import glob
import os
import re
import sys

import numpy as np
from PIL import Image

SRC = os.environ.get('ISLANDS_DIR', './islands-pack-20-v1')
OUT = os.environ.get('OUT_DIR', './src/assets/game/island')

# As ilhas de "fundo" sao morro baixo de horizonte: entram menores, porque
# nunca vao aparecer perto. As outras sao silhueta de verdade e merecem pixel.
CAP_FUNDO = 460
CAP_FRENTE = 720
QUALITY = 80


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


def slug(name):
    """`15-fundo-ilha-baixa-arborizada.png` -> `fundo-ilha-baixa-arborizada`."""
    base = re.sub(r'\.png$', '', name)
    base = re.sub(r'^\d+[-_]', '', base)
    return re.sub(r'[^a-z0-9-]+', '-', base.lower()).strip('-')


def emit(src, dst, cap):
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
    im.save(dst, 'WEBP', quality=QUALITY, method=5)
    return os.path.getsize(dst), im.size


def main():
    files = sorted(glob.glob(os.path.join(SRC, '*.png')))
    if not files:
        print(f'nada em {SRC}', file=sys.stderr)
        return 1
    total = 0
    for f in files:
        name = slug(os.path.basename(f))
        cap = CAP_FUNDO if name.startswith('fundo-') else CAP_FRENTE
        size, dims = emit(f, os.path.join(OUT, name + '.webp'), cap)
        total += size
        print(f'  island/{name}  {dims[0]}x{dims[1]}  {size / 1024:.0f} KB')
    print(f'total {len(files)} ilhas, {total / 1024:.0f} KB')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
