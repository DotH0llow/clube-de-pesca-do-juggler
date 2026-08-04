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

# A areia, do jeito que o `World.tsx` desenha. Duas regras importam aqui, e as
# duas existem para nao aparecer emenda:
#
#   1. a fase do tile sai da posicao no MUNDO, e nao do topo do elemento - e
#      uma grade so, entao dois pedacos vizinhos encaixam;
#   2. as colunas da orla tem topo diferente e PE IGUAL, e o corte do pe fica
#      escondido debaixo do veu de profundidade.
ORLA_COLUNAS, ORLA_FUNDO = 22, 560


def tile_band(img_path, x, y, w, h):
    """Preenche uma caixa com o tile, na grade global da areia."""
    if h <= 0 or w <= 0:
        return
    src = Image.open(os.path.join(GAME, img_path)).convert('RGBA').resize((TILE, TILE), Image.NEAREST)
    band = Image.new('RGBA', (w, h))
    for ty in range(-(y % TILE), h, TILE):
        for tx in range(-(x % TILE), w, TILE):
            band.alpha_composite(src, (tx, ty))
    sheet.alpha_composite(band, (x - X0, y - Y0))


BORDA, CHEIA = 'sand/sand_12_01110110.webp', 'sand/sand_46_11111111.webp'
# o corpo da praia, de uma vez so, do topo ate bem abaixo do mundo
tile_band(CHEIA, SHORE_X - 60, SAND_Y, 4000, 900)
tile_band(BORDA, SHORE_X - 60, SAND_Y, 4000, TILE)

# a orla: queda em curva, com deslocamento sorteado por coluna
_s = 20260804


def _r():
    global _s
    _s = (_s * 1664525 + 1013904223) % (2 ** 32)
    return _s / 2 ** 32


orla_fundo = WATER_Y + ORLA_FUNDO
for n in range(ORLA_COLUNAS):
    dx = SHORE_X - 60 - (n + 1) * TILE
    dy = round(SAND_Y + max(2, 5 * (n + 1) ** 1.4 + (_r() - 0.5) * 16))
    tile_band(CHEIA, dx, dy, TILE, max(0, orla_fundo - dy))
    tile_band(BORDA, dx, dy, TILE, TILE)

# o veu de profundidade: aproximacao chapada do gradiente que o CSS faz
veu_x = SHORE_X - 60 - ORLA_COLUNAS * TILE - 220
veu_w = ORLA_COLUNAS * TILE + 280
veu = Image.new('RGBA', (veu_w, ORLA_FUNDO))
for yy in range(ORLA_FUNDO):
    t = yy / ORLA_FUNDO
    a = 0 if t < 0.02 else min(1.0, (t - 0.02) / 0.62)
    cor = (32, 120, 160) if t < 0.3 else (6, 62, 99)
    if t > 0.7:
        cor = (2, 19, 31)
    veu.paste(cor + (int(a * 255),), (0, yy, veu_w, yy + 1))
mask = Image.new('L', (veu_w, ORLA_FUNDO))
for xx in range(veu_w):
    t = xx / veu_w
    m = min(1.0, t / 0.22) if t < 0.22 else (1.0 if t < 0.92 else max(0.0, (1 - t) / 0.08))
    mask.paste(int(m * 255), (xx, 0, xx + 1, ORLA_FUNDO))
alfa = Image.new('L', veu.size)
alfa.putdata([round(a * m / 255) for a, m in zip(veu.getchannel('A').getdata(), mask.getdata())])
veu.putalpha(alfa)
sheet.alpha_composite(veu, (veu_x - X0, WATER_Y - Y0))

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
