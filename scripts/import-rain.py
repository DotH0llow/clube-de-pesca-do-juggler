"""
Importa o pacote de chuva tropical.

Mesma receita dos outros importadores: recorta a margem transparente, reduz
para o teto da categoria e grava em webp.

    RAIN_DIR=/caminho/do/rain_assets python3 scripts/import-rain.py

As pastas viram duas categorias no jogo:

    rain-drops/    -> rain/  (as fitas que caem, as gotas gordas e o respingo)
    water-runoff/  -> rain/  (o que escorre e pinga das bordas)

Tudo numa pasta so porque tudo e a mesma coisa em momentos diferentes: agua
caindo, agua batendo, agua escorrendo. Separa-las em duas pastas na biblioteca
so faria procurar em dois lugares.

Requer: pillow e numpy.
"""
import glob
import os
import sys

import numpy as np
from PIL import Image

SRC = os.environ.get('RAIN_DIR', './rain_assets')
OUT = os.environ.get('OUT_DIR', './src/assets/game/rain')

# teto em px por familia: a fita que cai e comprida, o respingo e pequeno
CAP = 160
QUALIDADE = 84


def recorta(im):
    a = np.array(im)[:, :, 3]
    ys, xs = np.where(a > 12)
    if not len(ys):
        return im
    return im.crop((int(xs.min()), int(ys.min()), int(xs.max()) + 1, int(ys.max()) + 1))


def emit(src, dst):
    im = recorta(Image.open(src).convert('RGBA'))
    w, h = im.size
    escala = min(1.0, CAP / max(w, h))
    if escala < 1.0:
        im = im.resize((max(1, round(w * escala)), max(1, round(h * escala))), Image.LANCZOS)
    os.makedirs(os.path.dirname(dst), exist_ok=True)
    im.save(dst, 'WEBP', quality=QUALIDADE, method=5)
    return os.path.getsize(dst), im.size


def main():
    total = n = 0
    for pasta in ('rain-drops', 'water-runoff'):
        arquivos = sorted(glob.glob(os.path.join(SRC, pasta, '*.png')))
        if not arquivos:
            print(f'  aviso: nada em {pasta}', file=sys.stderr)
        for f in arquivos:
            nome = os.path.basename(f)[:-4]
            tam, dim = emit(f, os.path.join(OUT, nome + '.webp'))
            total += tam
            n += 1
            print(f'  rain/{nome}  {dim[0]}x{dim[1]}')
    print(f'total {n} sprites, {total / 1024:.0f} KB')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
