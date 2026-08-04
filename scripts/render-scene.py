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

# uma faixa de agua chapada so para dar referencia visual da linha d'agua
WATER_Y, SAND_Y, SHORE_X, SAND_DEPTH, TILE = 372, 368, 1400, 70, 32
water_y = WATER_Y - Y0
if 0 < water_y < H:
    sheet.paste(Image.new('RGBA', (W, H - water_y), (32, 120, 160, 255)), (0, water_y))

# A AREIA E A COSTA, do jeito que o `World.tsx` desenha.
#
# O perfil, os recortes e as bandas de profundidade sao os MESMOS de
# `src/world/shore.ts` - as constantes estao repetidas aqui porque o Python nao
# le TypeScript. Se um mudar, muda o outro.
SHORE = dict(
    colunas=30, queda=2.2, curva=1.28, irregular=10,
    fundo=300, absorcao=150,
    raso=34, raso_larg=260, raso_alfa=0.5,
    molhada=14, molhada_recuo=90, molhada_avanco=120, molhada_alfa=0.42,
    espuma=6, espuma_recuo=130, espuma_avanco=90,
)
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


def clareia(c, t):
    return tuple(round(a + (255 - a) * t) for a in c)


def na_grade(v, passo=4):
    return round(v / passo) * passo


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


BORDA, CHEIA = 'sand/sand_12_01110110.webp', 'sand/sand_46_11111111.webp'
# o corpo da praia seca, de uma vez so
tile_band(CHEIA, SHORE_X - 60, SAND_Y, 4000, 900)
tile_band(BORDA, SHORE_X - 60, SAND_Y, 4000, TILE)

# ------------------------------------------------------------------- o perfil
_s = 20260805


def _r():
    global _s
    _s = (_s * 1664525 + 1013904223) % (2 ** 32)
    return _s / 2 ** 32


seco = SHORE_X - 60
perfil = []
for n in range(SHORE['colunas'], 0, -1):
    q = SHORE['queda'] * n ** SHORE['curva'] + (_r() - 0.5) * SHORE['irregular']
    perfil.append((na_grade(seco - n * TILE, TILE), na_grade(SAND_Y + max(2, q))))
direita = na_grade(seco + SHORE['molhada_avanco'] + 200, TILE)
perfil.append((seco, na_grade(SAND_Y)))
perfil.append((direita, na_grade(SAND_Y)))

costa_x = next((x for x, y in reversed(perfil) if y >= WATER_Y), direita)
esq = perfil[0][0]
topo = na_grade(min(SAND_Y, WATER_Y) - SHORE['raso'] * 2 - 16)
fundo_c = na_grade(WATER_Y + SHORE['fundo'])
CW, CH = direita - esq, fundo_c - topo


def perfil_y(x):
    """Altura da areia em x, em degraus (o valor do ponto a esquerda)."""
    y = perfil[0][1]
    for px, py in perfil:
        if px <= x:
            y = py
        else:
            break
    return y


def mascara(dentro):
    """Mascara CH x CW com 255 onde `dentro(x, y)` for verdadeiro."""
    m = Image.new('L', (CW, CH), 0)
    px = m.load()
    for xx in range(CW):
        y0, y1 = dentro(esq + xx)
        for yy in range(max(0, y0 - topo), min(CH, y1 - topo)):
            px[xx, yy] = 255
    return m


# 1. massa de areia submersa: do perfil para baixo
areia = Image.new('RGBA', (CW, CH))
tile_band(CHEIA, esq, topo, CW, CH, alvo=areia)
areia.putalpha(mascara(lambda x: (perfil_y(x), fundo_c)))

# 2. bandas de profundidade, na cor que a AGUA tem naquela profundidade
alto = WATER_Y + SHORE['raso']
passos = 8
alcance = fundo_c - alto
for i in range(passos):
    y0 = na_grade(alto + alcance * i / passos)
    y1 = fundo_c if i == passos - 1 else na_grade(alto + alcance * (i + 1) / passos)
    cor = cor_do_mar((y0 + y1) / 2 - WATER_Y)
    alfa = min(1.0, (y0 - WATER_Y) / max(1, SHORE['absorcao']))
    # a banda para na COSTA: para a direita dela o que existe e subsolo de
    # praia seca, e nao fundo de mar
    larg = max(1, costa_x + TILE - esq)
    faixa = Image.new('RGBA', (larg, max(1, y1 - y0)), cor + (int(alfa * 255),))
    areia.alpha_composite(faixa, (0, max(0, y0 - topo)))
sheet.alpha_composite(areia, (esq - X0, topo - Y0))

# 3. agua rasa: duas faixas chapadas acompanhando o perfil
for espessura, clara, alfa in (
    (SHORE['raso'] * 2.2, 0.12, SHORE['raso_alfa'] * 0.55),
    (SHORE['raso'], 0.34, SHORE['raso_alfa']),
):
    lim = costa_x - SHORE['raso_larg'] * (1.8 if espessura > SHORE['raso'] else 1)
    faixa = Image.new('RGBA', (CW, CH), clareia(SEA_TOP, clara) + (int(alfa * 255),))
    # a faixa rasa PARA NA COSTA: a direita dela o perfil e praia seca, e a
    # faixa viraria uma tira de agua pairando acima da areia enxuta
    faixa.putalpha(Image.eval(
        mascara(lambda x, e=espessura, l=lim: (
            (round(perfil_y(x) - e), perfil_y(x)) if l <= x <= costa_x else (0, 0)
        )),
        lambda v, a=alfa: int(v * a),
    ))
    sheet.alpha_composite(faixa, (esq - X0, topo - Y0))

# 4. areia molhada: cor por cima do tile, sem trocar a textura
molhada = Image.new('RGBA', (CW, CH), (0x8a, 0x6a, 0x3f, 255))
molhada.putalpha(Image.eval(
    mascara(lambda x: (
        (perfil_y(x), perfil_y(x) + SHORE['molhada'])
        if costa_x - SHORE['molhada_recuo'] <= x <= costa_x + SHORE['molhada_avanco']
        else (0, 0)
    )),
    lambda v: int(v * SHORE['molhada_alfa']),
))
sheet.alpha_composite(molhada, (esq - X0, topo - Y0))

# 5. espuma: tracos irregulares em cima do perfil
espuma = Image.new('RGBA', (CW, CH))
ed = ImageDraw.Draw(espuma)
padrao = [18, 7, 5, 11, 26, 9, 3, 14]
pos, k, ligado = costa_x - SHORE['espuma_recuo'], 0, True
while pos < costa_x + SHORE['espuma_avanco']:
    passo = padrao[k % len(padrao)]
    if ligado:
        for xx in range(int(pos), int(min(pos + passo, costa_x + SHORE['espuma_avanco']))):
            y = perfil_y(xx) - topo
            ed.rectangle([xx - esq, y - SHORE['espuma'] // 2, xx - esq, y + SHORE['espuma'] // 2],
                         fill=(0xea, 0xf7, 0xff, 220))
    pos += passo
    k += 1
    ligado = not ligado
sheet.alpha_composite(espuma, (esq - X0, topo - Y0))

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
