"""
Desenha a cena semeada num PNG, sem navegador.

Le o JSON do `scripts/dump-scene.ts` e compoe os sprites nas coordenadas de
mundo, respeitando profundidade, espelho e opacidade - a mesma ordem que o
`SceneLayer` usa. Serve para conferir ENCAIXE: se a tabua do pier esta em cima
da estaca, se a testeira encosta no piso, se a ilha nasce na linha d'agua.

    python3 scripts/render-scene.py mundo 300 1700 out.png
                                    cena  x0   x1   arquivo
"""
import json
import os
import sys

from PIL import Image

ROOT = os.path.join(os.path.dirname(__file__), '..')
GAME = os.path.join(ROOT, 'src/assets/game')

CENA = sys.argv[1] if len(sys.argv) > 1 else 'mundo'
X0 = int(sys.argv[2]) if len(sys.argv) > 2 else 300
X1 = int(sys.argv[3]) if len(sys.argv) > 3 else 1700
Y0 = int(sys.argv[4]) if len(sys.argv) > 4 else 60
Y1 = int(sys.argv[5]) if len(sys.argv) > 5 else 700
OUT = sys.argv[6] if len(sys.argv) > 6 else 'cena.png'

with open(os.path.join(ROOT, '.testout/cena.json'), encoding='utf-8') as fh:
    book = json.load(fh)

objs = [o for o in book[CENA]['objects'] if o.get('kind') in ('sprite', 'strip') and o.get('sprite')]
objs = [o for o in objs if not o.get('off')]
# mesma regra do jogo: quem tem profundidade maior fica na frente; empate
# desempata pela ordem da lista
objs.sort(key=lambda o: o.get('depth', 5))

W, H = X1 - X0, Y1 - Y0
sheet = Image.new('RGBA', (W, H), (18, 40, 58, 255))

# uma faixa de agua chapada so para dar referencia visual da linha d'agua
WATER_Y, SAND_Y, SHORE_X, SAND_DEPTH, TILE = 372, 368, 1400, 70, 32
water_y = WATER_Y - Y0
if 0 < water_y < H:
    sheet.paste(Image.new('RGBA', (W, H - water_y), (32, 120, 160, 255)), (0, water_y))

# a areia, do jeito que o `World.tsx` desenha: peca de borda em cima, peca
# cheia no corpo, e a orla descendo em degrau para dentro da agua
def tile_band(img_path, x, y, w, h):
    if h <= 0 or w <= 0:
        return
    src = Image.open(os.path.join(GAME, img_path)).convert('RGBA').resize((TILE, TILE), Image.NEAREST)
    band = Image.new('RGBA', (w, h))
    for ty in range(0, h, TILE):
        for tx in range(0, w, TILE):
            band.alpha_composite(src, (tx, ty))
    sheet.alpha_composite(band, (x - X0, y - Y0))

BORDA, CHEIA = 'sand/sand_12_01110110.webp', 'sand/sand_46_11111111.webp'
tile_band(BORDA, SHORE_X - 60, SAND_Y, 4000, TILE)
tile_band(CHEIA, SHORE_X - 60, SAND_Y + TILE, 4000, SAND_DEPTH - TILE + 300)
for n in range(12):
    dx = SHORE_X - 60 - (n + 1) * TILE
    dy = SAND_Y + n * 14
    tile_band(BORDA, dx, dy, TILE, TILE)
    tile_band(CHEIA, dx, dy + TILE, TILE, max(TILE, SAND_DEPTH + n * 22))

faltando = set()
for o in objs:
    path = os.path.join(GAME, o['sprite'] + '.webp')
    if not os.path.exists(path):
        faltando.add(o['sprite'])
        continue
    w, h = max(1, int(o['w'])), max(1, int(o['h']))
    im = Image.open(path).convert('RGBA').resize((w, h), Image.NEAREST)
    if o.get('flip'):
        im = im.transpose(Image.FLIP_LEFT_RIGHT)
    op = o.get('opacity')
    if op is not None and op < 1:
        a = im.getchannel('A').point(lambda v, op=op: int(v * op))
        im.putalpha(a)
    if o.get('kind') == 'strip':
        tile = Image.new('RGBA', (w, h))
        src = Image.open(path).convert('RGBA')
        tw = max(1, round(src.width * h / src.height))
        src = src.resize((tw, h), Image.NEAREST)
        for tx in range(0, w, tw):
            tile.paste(src, (tx, 0), src)
        im = tile
    sheet.alpha_composite(im, (int(o['x']) - X0, int(o['y']) - Y0))

sheet.save(OUT)
if faltando:
    print('SPRITE FALTANDO:', ', '.join(sorted(faltando)))
print('escrito', OUT, sheet.size, len(objs), 'objetos')
