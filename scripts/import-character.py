"""
Importa os quadros do Juggler.

Diferente dos props, aqui NAO da para recortar quadro a quadro: cada frame
precisa do mesmo enquadramento, senao o personagem treme na animacao. Entao:

  1. todo quadro e colado num canvas comum, alinhado embaixo e centralizado;
  2. calcula-se um unico bbox valido para a animacao inteira;
  3. os quadros de pulo tem o colete rosa remapeado para o azul das demais poses.
"""
import glob, os, sys
import numpy as np
from PIL import Image

SRC = '/tmp/unz/chars/11_characters/juggler/final-dark-vest/frames'
OUT = sys.argv[1]
TARGET_H = 170

def fix_vest(im):
    """Os quadros de pulo vieram com colete rosa; joga o matiz para o azul."""
    a = np.array(im).astype(np.float32)
    rgb, al = a[..., :3] / 255, a[..., 3]
    mx, mn = rgb.max(-1), rgb.min(-1)
    d = mx - mn
    r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    h = np.zeros_like(mx)
    m = d > 1e-6
    i = (mx == r) & m; h[i] = ((g - b)[i] / d[i]) % 6
    i = (mx == g) & m; h[i] = ((b - r)[i] / d[i]) + 2
    i = (mx == b) & m; h[i] = ((r - g)[i] / d[i]) + 4
    h *= 60
    s = np.where(mx > 0, d / np.maximum(mx, 1e-6), 0)
    sel = (al > 0) & (s > 0.12) & (h >= 295) & (h <= 358)
    if not sel.any():
        return im
    # rosa (~325) -> azul-petroleo (~190), mantendo luminancia e saturacao
    h2 = np.where(sel, 190.0, h)
    hp = h2 / 60.0
    c = mx * s
    x = c * (1 - np.abs(hp % 2 - 1))
    z = np.zeros_like(c)
    seg = np.floor(hp).astype(int) % 6
    r2 = np.select([seg == 0, seg == 1, seg == 2, seg == 3, seg == 4, seg == 5], [c, x, z, z, x, c])
    g2 = np.select([seg == 0, seg == 1, seg == 2, seg == 3, seg == 4, seg == 5], [x, c, c, x, z, z])
    b2 = np.select([seg == 0, seg == 1, seg == 2, seg == 3, seg == 4, seg == 5], [z, z, x, c, c, x])
    m0 = mx - c
    out = np.stack([r2 + m0, g2 + m0, b2 + m0], -1)
    out = np.where(sel[..., None], out, rgb)
    a[..., :3] = np.clip(out * 255, 0, 255)
    return Image.fromarray(a.astype(np.uint8), 'RGBA')

anims = sorted(os.path.basename(d) for d in glob.glob(f'{SRC}/*') if os.path.isdir(d))
frames = {}
CW, CH = 0, 0
for a in anims:
    for f in sorted(glob.glob(f'{SRC}/{a}/*.png')):
        im = Image.open(f).convert('RGBA')
        CW, CH = max(CW, im.size[0]), max(CH, im.size[1])

for a in anims:
    frames[a] = []
    for f in sorted(glob.glob(f'{SRC}/{a}/*.png')):
        im = Image.open(f).convert('RGBA')
        if a.startswith('jump'):
            im = fix_vest(im)
        canvas = Image.new('RGBA', (CW, CH), (0, 0, 0, 0))
        canvas.paste(im, ((CW - im.size[0]) // 2, CH - im.size[1]), im)
        frames[a].append(canvas)

# bbox unico para tudo
box = None
for a in anims:
    for im in frames[a]:
        bb = im.getbbox()
        if not bb:
            continue
        box = bb if box is None else (min(box[0], bb[0]), min(box[1], bb[1]),
                                      max(box[2], bb[2]), max(box[3], bb[3]))
bw, bh = box[2] - box[0], box[3] - box[1]
scale = TARGET_H / bh
size = (max(1, round(bw * scale)), TARGET_H)
print('canvas', (CW, CH), 'bbox', box, '->', size)

total = 0
for a in anims:
    for i, im in enumerate(frames[a]):
        out = im.crop(box).resize(size, Image.LANCZOS)
        dst = f'{OUT}/char/{a}/{i:02d}.webp'
        os.makedirs(os.path.dirname(dst), exist_ok=True)
        out.save(dst, 'WEBP', quality=80, method=5)
        total += os.path.getsize(dst)
    print(f'  {a}: {len(frames[a])} quadros')
print(f'total {total/1024:.0f} KB')
