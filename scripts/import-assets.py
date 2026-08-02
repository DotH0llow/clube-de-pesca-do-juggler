"""
Importa o kit de pixel art para dentro do jogo.

    KIT_DIR=~/Downloads/fishing-game-assets python3 scripts/import-assets.py fish
    ... e o mesmo para: trash fx ui sky props bg

Para cada PNG do kit:
  1. recorta a margem transparente e os pixels soltos (rotulagem de componentes
     conexos por propagacao vetorizada - varios sprites vinham com respingo de
     nadadeira solta perto da borda do canvas);
  2. redimensiona para o teto da categoria;
  3. exporta webp.

Requer: pillow e numpy. Roda uma categoria por vez porque a rotulagem e cara.
"""
import os, sys, glob
import numpy as np
from PIL import Image

SRC = os.environ.get('KIT_DIR', './fishing-game-assets')
OUT = os.environ.get('OUT_DIR', './src/assets/game')

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
            p[2:,   0:-2], p[2:,   1:-1], p[2:,   2:],
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

def emit(src, rel, cap, quality=78, clean=True, opaque=False):
    dst = os.path.join(OUT, rel + '.webp')
    if os.path.exists(dst):
        return os.path.getsize(dst)
    im = Image.open(src).convert('RGB' if opaque else 'RGBA')
    if not opaque:
        a = np.array(im)[:, :, 3]
        m = keep_mask(a) if clean else (a > 12)
        ys, xs = np.where(m)
        if len(ys):
            im = im.crop((int(xs.min()), int(ys.min()), int(xs.max()) + 1, int(ys.max()) + 1))
    w, h = im.size
    scale = min(1.0, cap / max(w, h))
    if scale < 1.0:
        im = im.resize((max(1, round(w * scale)), max(1, round(h * scale))), Image.LANCZOS)
    os.makedirs(os.path.dirname(dst), exist_ok=True)
    im.save(dst, 'WEBP', quality=quality, method=5)
    return os.path.getsize(dst)

JOBS = {
    'fish':   [('04_sprites/fish/*.png',             'fish',   340, 80)],
    'trash':  [('05_sprites/trash/*.png',            'trash',  200, 78)],
    'fx':     [('07_effects/water-and-catch/*.png',  'fx',     340, 76),
               ('09_rewards-and-feedback/*.png',     'fx',     340, 78)],
    'ui':     [('08_interface/*.png',                'ui',     340, 80)],
    'sky':    [('10_weather-and-sky/*.png',          'sky',    380, 76)],
    'props':  [('01_sprites/environment/*.png',      'props',  260, 78),
               ('02_sprites/boats-and-pier/*.png',   'props',  340, 80),
               ('03_sprites/fishing-gear/*.png',     'props',  240, 78)],
}
BG = [
    ('10_weather-and-sky/backgrounds/sky-day.png',    'bg/sky-day',      760, 74),
    ('10_weather-and-sky/backgrounds/sky-sunset.png', 'bg/sky-sunset',   760, 74),
    ('10_weather-and-sky/backgrounds/sky-night.png',  'bg/sky-night',    760, 74),
    ('06_backgrounds/ocean/shallow-reef-depth.png',   'bg/reef-shallow', 620, 70),
    ('06_backgrounds/ocean/deep-ocean-layers.png',    'bg/reef-deep',    620, 70),
    ('06_backgrounds/ocean/underwater-cave.png',      'bg/reef-cave',    620, 70),
    ('06_backgrounds/ocean/surface-from-below.png',   'bg/reef-surface', 620, 70),
]

which = sys.argv[1]
total = n = 0
if which == 'bg':
    for f, rel, cap, q in BG:
        total += emit(os.path.join(SRC, f), rel, cap, q, False, True); n += 1
else:
    for pattern, cat, cap, q in JOBS[which]:
        for f in sorted(glob.glob(os.path.join(SRC, pattern))):
            total += emit(f, f'{cat}/{os.path.basename(f)[:-4]}', cap, q); n += 1
print(f'{which}: {n} arquivos, {total/1024:.0f} KB')
