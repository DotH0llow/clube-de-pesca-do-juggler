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

from PIL import Image, ImageDraw

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

# A AGUA, A AREIA E A COSTA - o mesmo desenho do `World.tsx`.
#
# As constantes estao repetidas aqui porque o Python nao le TypeScript: se
# `src/world/shore.ts` ou `worldConfig.ts` mudarem, muda aqui tambem.
WATER_Y, SAND_Y, SHORE_X, TILE = 372, 368, 1400, 32
SHORE = dict(irregular=10, passo=28, raso=42, raso_avanco=28, raso_alfa=0.34,
             molhada=16, molhada_alfa=0.3, espuma=5)
# a cor do mar da hora que o render usa (meio-dia)
SEA_TOP, SEA_BOTTOM, SEA_DEEP = (0x25, 0xd2, 0xe8), (0x04, 0x6a, 0x97), (0x02, 0x13, 0x1f)
SEA_DEPTH = 2088


def cor_do_mar(prof):
    """Mesmas paradas do `.sea`: topo ate 4%, meio em 42%, fundo em 100%."""
    t = max(0.0, min(1.0, prof / SEA_DEPTH))
    if t <= 0.04:
        return SEA_TOP
    if t <= 0.42:
        k = (t - 0.04) / 0.38
        return tuple(round(a + (b - a) * k) for a, b in zip(SEA_TOP, SEA_BOTTOM))
    k = (t - 0.42) / 0.58
    return tuple(round(a + (b - a) * k) for a, b in zip(SEA_BOTTOM, SEA_DEEP))


def mistura(a, b, t):
    return tuple(round(x + (y - x) * max(0.0, min(1.0, t))) for x, y in zip(a, b))


def clareia(c, t):
    return mistura(c, (255, 255, 255), t)


def esverdeia(c, t):
    return mistura(c, (0x7f, 0xe3, 0xd2), t)


def na_grade(v, passo=4):
    return round(v / passo) * passo


# ------------------------------------------------------------ a linha de costa
#
# UM caminho, e todo o resto derivado dele - o mesmo passeio aleatorio com
# semente do `shore.ts`, entao o render sai com a mesma costa do jogo.
_s = 20260805


def _r():
    global _s
    _s = (_s * 1664525 + 1013904223) % (2 ** 32)
    return _s / 2 ** 32


topo_c = na_grade(min(SAND_Y, WATER_Y) - 48)
fundo_c = na_grade(WATER_Y + SEA_DEPTH)
perfil = []
_x, _y = SHORE_X, topo_c
while _y < fundo_c:
    perfil.append((na_grade(_x), na_grade(_y)))
    _x = max(SHORE_X - SHORE['irregular'],
             min(SHORE_X + SHORE['irregular'],
                 _x + [-8, -4, -4, 0, 0, 4, 4, 8][int(_r() * 8)]))
    _y += SHORE['passo'] * (1 + int(_r() * 3))
perfil.append((na_grade(_x), fundo_c))


def costa_x_em(y):
    """Onde a costa esta na altura y, em degraus."""
    x = perfil[0][0]
    for px, py in perfil:
        if py <= y:
            x = px
        else:
            break
    return x


# 1. o mar: UMA forma, com o degrade continuo, terminando na costa
agua = Image.new('RGBA', (W, H))
ap = agua.load()
for yy in range(H):
    y = yy + Y0
    if y < WATER_Y:
        continue
    cor = cor_do_mar(y - WATER_Y) + (255,)
    lim = costa_x_em(y) - X0
    for xx in range(0, min(W, max(0, lim))):
        ap[xx, yy] = cor
sheet.alpha_composite(agua)

# 2. a areia: o autotile, comecando na costa
BORDA, CHEIA = 'sand/sand_12_01110110.webp', 'sand/sand_46_11111111.webp'


def tile_band(img_path, x, y, w, h, alvo=None):
    """Preenche uma caixa com o tile, na grade global da areia."""
    if h <= 0 or w <= 0:
        return
    src = Image.open(os.path.join(GAME, img_path)).convert('RGBA').resize((TILE, TILE), Image.NEAREST)
    band = Image.new('RGBA', (w, h))
    for ty in range(-(y % TILE), h, TILE):
        for tx in range(-(x % TILE), w, TILE):
            band.alpha_composite(src, (tx, ty))
    (alvo if alvo is not None else sheet).alpha_composite(
        band, (x - X0, y - Y0) if alvo is None else (0, 0)
    )


areia_x = SHORE_X - 240
areia = Image.new('RGBA', (4000, 1400))
tile_band(CHEIA, areia_x, SAND_Y, 4000, 1400, alvo=areia)
tile_band(BORDA, areia_x, SAND_Y, 4000, TILE, alvo=areia)
mask = Image.new('L', (4000, 1400), 0)
mp = mask.load()
for yy in range(1400):
    x0 = max(0, costa_x_em(SAND_Y + yy) - areia_x)
    for xx in range(x0, 4000):
        mp[xx, yy] = 255
areia.putalpha(Image.eval(areia.getchannel('A'), lambda v: v).point(lambda v: v))
areia_rec = Image.new('RGBA', (4000, 1400))
areia_rec.paste(areia, (0, 0), mask)
sheet.alpha_composite(areia_rec, (areia_x - X0, SAND_Y - Y0))


def faixa(esq, dir_, cor, alfa):
    """Uma faixa acompanhando a costa, deslocada em x para os dois lados."""
    im = Image.new('RGBA', (W, H))
    px = im.load()
    c = tuple(cor) + (int(alfa * 255),)
    for yy in range(H):
        y = yy + Y0
        if y < topo_c:
            continue
        cx = costa_x_em(y)
        for xx in range(max(0, cx - esq - X0), min(W, cx + dir_ - X0)):
            px[xx, yy] = c
    sheet.alpha_composite(im)


# 3. agua rasa: do lado da agua, e a lamina que entra na areia
faixa(round(SHORE['raso'] * 2.2), 0, esverdeia(SEA_TOP, 0.38), SHORE['raso_alfa'] * 0.55)
faixa(SHORE['raso'], 0, esverdeia(SEA_TOP, 0.7), SHORE['raso_alfa'])
faixa(0, SHORE['raso_avanco'], clareia(esverdeia(SEA_TOP, 0.72), 0.5), SHORE['raso_alfa'] * 0.9)

# 4. areia molhada: depois do avanco da agua rasa, ja em areia exposta
faixa(-SHORE['raso_avanco'], SHORE['raso_avanco'] + SHORE['molhada'],
      (0xc8, 0x9f, 0x58), SHORE['molhada_alfa'])

# 5. espuma: traco quebrado em cima da costa
espuma = Image.new('RGBA', (W, H))
ed = ImageDraw.Draw(espuma)
padrao = [18, 7, 5, 11, 26, 9, 3, 14]
pos, k, ligado = topo_c, 0, True
while pos < fundo_c:
    passo = padrao[k % len(padrao)]
    if ligado:
        for y in range(int(pos), int(min(pos + passo, fundo_c))):
            if Y0 <= y < Y1:
                cx = costa_x_em(y) - X0
                ed.rectangle([cx - SHORE['espuma'] // 2, y - Y0,
                              cx + SHORE['espuma'] // 2, y - Y0],
                             fill=(0xea, 0xf7, 0xff, 220))
    pos += passo
    k += 1
    ligado = not ligado
sheet.alpha_composite(espuma)

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
