"""
Gerador do PÍER 2.5D.

O pacote `pier/` é desenhado de PERFIL: tábua vista de canto, estaca vista de
lado, tudo num plano só. Isso funciona enquanto o cais corre paralelo à tela,
mas não dá para mostrar um deck em que se anda "para dentro" - e é isso que a
imagem de referência tem: um tabuado que entra na água, com as tábuas
atravessadas e os postes em pares, um de cada lado do corrimão.

Este script não desenha madeira nova. Ele RECORTA a textura das peças que já
existem e re-renderiza em projeção 2.5D, então a paleta e o grão continuam
sendo os do jogo - o que muda é a geometria.

    python3 scripts/pier25.py            # gera as peças em src/assets/game/pier2d/
    python3 scripts/pier25.py --sheet    # gera só o contact sheet das variações

LUZ: nenhuma de propósito. Nada aqui aplica sombra direcional, gradiente de
face ou oclusão - a madeira sai chapada, com a variação que já vinha na
textura. É o pedido: com o píer neutro, dá para pôr poste, lampião e recorte de
luz por cima depois sem brigar com uma iluminação assada no sprite.

Requer: pillow e numpy.
"""
import argparse
import os
import random

import numpy as np
from PIL import Image

# ==========================================================================
# CONSTANTES
# ==========================================================================

# ------------------------------------------------------------------ caminhos
AQUI = os.path.dirname(os.path.abspath(__file__))
RAIZ = os.path.dirname(AQUI)
ORIGEM = os.path.join(RAIZ, 'src/assets/game/pier')
DESTINO = os.path.join(RAIZ, 'src/assets/game/pier2d')

# ------------------------------------------------------------- projeção 2.5D
#
# A projeção é oblíqua: um passo "para dentro" da cena anda DENTRO_X para o
# lado e DENTRO_Y para cima na tela. Não há ponto de fuga - em 2.5D de pixel
# art, linhas paralelas continuam paralelas, senão cada tábua precisaria de uma
# largura diferente e o tile deixaria de ser tile.
DENTRO_X = 0.5   # quanto um passo de profundidade desloca no eixo X
DENTRO_Y = 0.5   # ... e no eixo Y (0,5/0,5 = a diagonal clássica de 2:1)

# --------------------------------------------------------------- dimensões
#
# TUDO AQUI TRIPLICOU, e isso é o conserto de um defeito real: na primeira
# versão o tampo do deck tinha 14 pixels de altura no desenho e era ampliado 3x
# na gravação. Ou seja, a peça no jogo tinha o tamanho certo e a RESOLUÇÃO de
# 14 px - cada pixel de fonte virava um bloco de 3, e o chão do cais ficava
# grosseiro perto do resto da arte.
#
# Agora o desenho já nasce no tamanho final: o tampo tem 42 px de verdade, a
# borda tem 21, o mourão tem 39 de largura. A gravação não amplia mais nada.
TILE = 192       # lado da célula, em px
PROFUNDIDADE = 4 # quantas tábuas de largura tem o deck
ESPESSURA = 21   # espessura do tabuado, em px
TABUA_L = 39     # largura de uma tábua, em px
FRESTA = 3       # folga entre tábuas

# ------------------------------------------------------------------ postes
POSTE_L = 39     # largura do poste, em px
POSTE_ALT = 126  # quanto o poste sobe acima do piso
ESTACA_ALT = 288 # quanto a estaca desce abaixo do piso

# ------------------------------------------------------------------ corrimão
#
# A altura da barra é medida a partir do TOPO DO MOURÃO, e não do piso. Medida
# a partir do piso, ela caía dentro da superfície do deck sempre que a projeção
# ficava mais funda - porque o tampo, ao recuar, sobe na tela. Presa ao topo do
# mourão, a barra fica onde a mão a alcançaria em qualquer ângulo.
CORRIMAO_DO_TOPO = 36
CORRIMAO_ESP = 12

# ------------------------------------------------------- separação de face
#
# Não é luz - é o que distingue o tampo da testeira num desenho sem sombra.
# Sem isto o píer vira uma barra chapada: foi o defeito da primeira versão.
FACE_FRENTE = 0.62   # quanto a face de frente escurece em relação ao tampo
FACE_FRESTA = 0.42   # a linha entre uma tábua e a seguinte
GRAO = 0.5           # quanto da textura original entra por cima da cor sólida

# ------------------------------------------------------------ fileira de trás
#
# O par de postes é o que a imagem de referência tem e o perfil não tinha: um
# mourão de cada lado do tabuado. A fileira de trás é menor porque está mais
# longe, e é ela que fecha a leitura de profundidade.
POSTE_FUNDO = 0.82

# -------------------------------------------------------------------- saída
#
# A ampliação na gravação SAIU (ESCALA_SAIDA = 1). Ela existia porque o desenho
# era pequeno demais; agora ele já nasce no tamanho final, com pixel de
# verdade em vez de bloco de três.
ESCALA_SAIDA = 1
QUALIDADE = 94
SEED = 7

# As variações do contact sheet. Cada uma é um conjunto de sobrescritas das
# constantes acima - é assim que se compara ângulo e proporção sem editar o
# arquivo entre um render e outro.
VARIACOES = [
    ('a-raso', dict(DENTRO_X=0.62, DENTRO_Y=0.26, PROFUNDIDADE=4, TABUA_L=39, POSTE_ALT=126)),
    ('b-classico', dict(DENTRO_X=0.50, DENTRO_Y=0.45, PROFUNDIDADE=5, TABUA_L=39, POSTE_ALT=144)),
    ('c-fundo', dict(DENTRO_X=0.34, DENTRO_Y=0.66, PROFUNDIDADE=6, TABUA_L=36, POSTE_ALT=168)),
]

# ------------------------------------------------------------------- rampa
#
# Quanto a rampa desce, em fração da própria largura.
#
# 0,111 não é um número escolhido por gosto: a peça tem 481 px de largura e o
# jogo a desenha a 0,6 unidade por pixel, ou seja 289 unidades. O deck está 32
# unidades acima da areia. 32/289 = 0,111.
#
# Se a escala do cais mudar, este número muda junto - e o `PIER_RAMP` do
# `layout.ts` também, senão o Juggler desce a rampa no desenho e continua no
# nível do deck na física.
RAMPA_QUEDA = 0.111
RAMPA_LARG = 2  # em células


# ==========================================================================
# TEXTURA: de onde a madeira vem
# ==========================================================================

def _abre(nome):
    return Image.open(os.path.join(ORIGEM, nome + '.webp')).convert('RGBA')


def faixa_opaca(im):
    """A parte do sprite que tem desenho, sem a folga transparente da célula."""
    a = np.array(im)[:, :, 3]
    ys, xs = np.where(a > 16)
    if not len(ys):
        return im
    return im.crop((int(xs.min()), int(ys.min()), int(xs.max()) + 1, int(ys.max()) + 1))


def textura(nome, w, h):
    """
    Um retalho de madeira do tamanho pedido, tirado de uma peça do pacote.

    A peça é recortada no desenho, esticada para a altura pedida e repetida na
    largura. Repetir em vez de esticar nos dois eixos é o que preserva o grão:
    madeira esticada na horizontal vira plástico.
    """
    src = faixa_opaca(_abre(nome))
    escala = max(1, round(src.height * (h / src.height)))
    filtro = Image.NEAREST if escala > src.height else Image.LANCZOS
    src = src.resize((max(1, round(src.width * escala / src.height)), escala), filtro)
    out = Image.new('RGBA', (w, h))
    for x in range(0, w, src.width):
        out.alpha_composite(src, (x, 0))
    return out


def cor_media(nome):
    """A cor sólida de uma peça: usada para tampo e face lateral."""
    im = faixa_opaca(_abre(nome))
    a = np.array(im)
    m = a[:, :, 3] > 128
    if not m.any():
        return (140, 96, 54, 255)
    return tuple(int(v) for v in a[:, :, :3][m].mean(axis=0)) + (255,)


def escurece(cor, f):
    return (int(cor[0] * f), int(cor[1] * f), int(cor[2] * f), cor[3])


# ==========================================================================
# DESENHO
# ==========================================================================

def _linha(d, p0, p1, cor, larg=1):
    d.line([p0, p1], fill=cor, width=larg)


def deck_tile(cfg):
    """
    Um pedaço de deck: o tampo em perspectiva mais a testeira da borda.

    O tile se repete no eixo X. A altura é a profundidade projetada mais a
    espessura, então dois tiles lado a lado dão um deck contínuo.

    O que faz isto LER como 2.5D não é a projeção sozinha - é a SEPARAÇÃO DE
    FACE. Tampo e testeira são o mesmo pedaço de madeira vistos de ângulos
    diferentes, e sem diferença de valor entre eles o desenho vira uma barra
    chapada (foi o que aconteceu na primeira tentativa). Isto não é luz: não há
    direção, não há sombra projetada, não há gradiente. São dois tons fixos, do
    jeito que pixel art isométrica sempre fez.
    """
    from PIL import ImageDraw

    prof = cfg['PROFUNDIDADE'] * cfg['TABUA_L']
    dx = round(prof * cfg['DENTRO_X'])
    dy = round(prof * cfg['DENTRO_Y'])
    largura = cfg['TILE'] * 2
    alt = dy + cfg['ESPESSURA'] + 2

    im = Image.new('RGBA', (largura + dx, alt), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)

    tampo = cor_media('deck-long')
    testeira = escurece(tampo, cfg['FACE_FRENTE'])
    fresta = escurece(tampo, cfg['FACE_FRESTA'])

    base_y = dy

    # ---- o tampo, tábua por tábua, da mais funda para a mais próxima
    for i in range(cfg['PROFUNDIDADE'] - 1, -1, -1):
        p0 = i * cfg['TABUA_L']
        p1 = p0 + cfg['TABUA_L']
        x0, y0 = round(p0 * cfg['DENTRO_X']), base_y - round(p0 * cfg['DENTRO_Y'])
        x1, y1 = round(p1 * cfg['DENTRO_X']), base_y - round(p1 * cfg['DENTRO_Y'])
        d.polygon([(x0, y0), (x0 + largura, y0), (x1 + largura, y1), (x1, y1)], fill=tampo)
        # a fresta entre uma tábua e a seguinte: é ela que conta ao olho
        # quantas tábuas existem e para onde elas correm
        _linha(d, (x1, y1), (x1 + largura, y1), fresta)

    # ---- a testeira (a espessura do tabuado, de frente)
    d.polygon(
        [(0, base_y), (largura, base_y), (largura, base_y + cfg['ESPESSURA']), (0, base_y + cfg['ESPESSURA'])],
        fill=testeira,
    )
    _linha(d, (0, base_y), (largura, base_y), escurece(tampo, 0.55))

    # ---- o grão, recortado na silhueta
    grao = textura('deck-long', im.width, im.height)
    grao.putalpha(im.getchannel('A'))
    return Image.blend(im, grao, cfg['GRAO'])


def deck_fim(cfg):
    """
    A ponta do deck: a face que fecha o tabuado no fim do cais.

    Sem ela o último tile termina no bico do paralelogramo - um triângulo
    afiado saindo para o lado, que entrega na hora que aquilo é um tile
    repetido e não um cais. Esta peça é a face transversal, a que se veria de
    quem está na água olhando para a ponta.
    """
    from PIL import ImageDraw

    prof = cfg['PROFUNDIDADE'] * cfg['TABUA_L']
    dx = round(prof * cfg['DENTRO_X'])
    dy = round(prof * cfg['DENTRO_Y'])
    im = Image.new('RGBA', (dx + 2, dy + cfg['ESPESSURA'] + 2), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)

    tampo = cor_media('deck-long')
    face = escurece(tampo, cfg['FACE_FRENTE'] * 0.88)
    d.polygon(
        [
            (0, dy),
            (dx, 0),
            (dx, cfg['ESPESSURA']),
            (0, dy + cfg['ESPESSURA']),
        ],
        fill=face,
    )
    grao = textura('deck-fascia', im.width, im.height)
    grao.putalpha(im.getchannel('A'))
    return Image.blend(im, grao, cfg['GRAO'])


def deck_rampa(cfg, celulas=RAMPA_LARG, queda_frac=RAMPA_QUEDA):
    """
    A RAMPA que desce do deck para a areia.

    Faltava por completo - o cais terminava no ar e quem descia para a praia
    dava um degrau invisível. Ela não é uma peça nova desenhada do zero: é o
    PRÓPRIO TABUADO cisalhado na vertical, coluna por coluna. Assim a tábua, a
    fresta, a testeira e o grão são exatamente os do deck reto, e a emenda
    entre os dois não aparece.

    O cisalhamento é feito com `numpy`, deslocando cada coluna de pixels para
    baixo por um tanto proporcional à distância percorrida. Desenhar a rampa
    como polígonos inclinados daria o mesmo resultado com três vezes mais
    código - e com o risco de a inclinação da fresta não bater com a da borda.
    """
    largura = cfg['TILE'] * celulas
    base = deck_tile(dict(cfg, TILE=largura // 2))
    queda = int(largura * queda_frac)

    a = np.array(base)
    alt, larg = a.shape[0], a.shape[1]
    out = np.zeros((alt + queda, larg, 4), dtype=a.dtype)
    for x in range(larg):
        desce = int(queda * x / max(1, larg - 1))
        out[desce:desce + alt, x] = a[:, x]
    return Image.fromarray(out, 'RGBA')


def poste(cfg, altura, sprite='piling-heavy-round'):
    """
    Um poste, reaproveitando a estaca redonda do pacote.

    A primeira versão desenhava dois paralelogramos - e um poste quadrado no
    meio de um cais todo feito de tronco roliço grita. Aqui o sprite original é
    só reescalado: a silhueta arredondada, a corda e o grão vêm prontos, que é
    exatamente o que "recortar as peças e re-renderizar" quer dizer.
    """
    src = faixa_opaca(_abre(sprite))
    l = cfg['POSTE_L']
    h = max(4, altura)
    return src.resize((l, h), Image.LANCZOS)


def corrimao(cfg, largura):
    """A barra horizontal que liga dois mourões, com a face de topo visível."""
    from PIL import ImageDraw
    dx = round(cfg['POSTE_L'] * cfg['DENTRO_X'])
    dy = round(cfg['POSTE_L'] * cfg['DENTRO_Y'])
    esp = cfg['CORRIMAO_ESP']
    im = Image.new('RGBA', (largura + dx, esp + dy + 2), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    c = cor_media('rail-long')
    # topo da barra, indo para dentro
    d.polygon([(0, dy), (dx, 0), (largura + dx, 0), (largura, dy)], fill=c)
    # frente da barra
    d.polygon(
        [(0, dy), (largura, dy), (largura, dy + esp), (0, dy + esp)],
        fill=escurece(c, cfg['FACE_FRENTE']),
    )
    return im


# ==========================================================================
# MONTAGEM
# ==========================================================================

def cfg_de(extra=None):
    base = dict(
        DENTRO_X=DENTRO_X,
        DENTRO_Y=DENTRO_Y,
        TILE=TILE,
        PROFUNDIDADE=PROFUNDIDADE,
        ESPESSURA=ESPESSURA,
        TABUA_L=TABUA_L,
        FRESTA=FRESTA,
        POSTE_L=POSTE_L,
        POSTE_ALT=POSTE_ALT,
        ESTACA_ALT=ESTACA_ALT,
        CORRIMAO_DO_TOPO=CORRIMAO_DO_TOPO,
        CORRIMAO_ESP=CORRIMAO_ESP,
        FACE_FRENTE=FACE_FRENTE,
        FACE_FRESTA=FACE_FRESTA,
        GRAO=GRAO,
        POSTE_FUNDO=POSTE_FUNDO,
    )
    if extra:
        base.update(extra)
    return base


def trecho(cfg, vaos=4):
    """
    Um trecho de píer montado: fileira de trás, deck, fileira da frente e barra.

    Serve para o contact sheet - o jogo usa as PEÇAS, não a montagem pronta,
    porque o cais tem comprimento variável e quem monta é a cena.

    A ordem de composição é a ordem de profundidade, e é ela que faz a coisa
    parecer sólida: postes de trás, tabuado por cima deles, postes da frente
    por cima do tabuado. Errar essa ordem entrega o truque na hora.
    """
    tile = deck_tile(cfg)
    prof = cfg['PROFUNDIDADE'] * cfg['TABUA_L']
    dx = round(prof * cfg['DENTRO_X'])
    dy = round(prof * cfg['DENTRO_Y'])

    p_frente = poste(cfg, cfg['POSTE_ALT'] + cfg['ESTACA_ALT'])
    l_fundo = max(4, round(cfg['POSTE_L'] * cfg['POSTE_FUNDO']))
    p_fundo = poste(dict(cfg, POSTE_L=l_fundo), cfg['POSTE_ALT'] + cfg['ESTACA_ALT'])

    passo = cfg['TILE'] * 2
    largura = passo * vaos + tile.width + 20
    alt = cfg['POSTE_ALT'] + tile.height + cfg['ESTACA_ALT'] + 24
    im = Image.new('RGBA', (largura, alt), (0, 0, 0, 0))

    # y do piso (o topo da tábua da frente)
    piso = cfg['POSTE_ALT'] + 12

    # ---- fileira de TRÁS: deslocada para dentro, e mais curta na tela
    for i in range(vaos + 1):
        x = i * passo + 8 + dx - l_fundo // 2
        im.alpha_composite(p_fundo, (x, piso - cfg['POSTE_ALT'] - dy))

    # ---- o tabuado
    for i in range(vaos + 1):
        im.alpha_composite(tile, (i * passo, piso - dy))

    # ---- fileira da FRENTE
    for i in range(vaos + 1):
        x = i * passo + 8 - cfg['POSTE_L'] // 2
        im.alpha_composite(p_frente, (x, piso - cfg['POSTE_ALT']))

    # ---- a ponta do cais, fechando o bico do último tile
    fim = deck_fim(cfg)
    im.alpha_composite(fim, (vaos * passo + tile.width - fim.width, piso - dy))

    # ---- a barra que liga os mourões da frente
    barra = corrimao(cfg, passo * vaos)
    im.alpha_composite(barra, (8, piso - cfg['POSTE_ALT'] + cfg['CORRIMAO_DO_TOPO']))

    return im


def contact_sheet(destino):
    """As três variações lado a lado, para escolher ângulo antes de fechar."""
    from PIL import ImageDraw

    random.seed(SEED)
    partes = [(nome, trecho(cfg_de(extra))) for nome, extra in VARIACOES]
    larg = max(p.width for _, p in partes) + 40
    altura_um = max(p.height for _, p in partes) + 54
    sheet = Image.new('RGBA', (larg, altura_um * len(partes)), (24, 30, 40, 255))
    d = ImageDraw.Draw(sheet)

    for i, (nome, im) in enumerate(partes):
        y = i * altura_um
        # xadrez, para ler o alpha
        for yy in range(y + 34, y + altura_um - 4, 12):
            for xx in range(8, larg - 8, 12):
                if ((xx // 12) + (yy // 12)) % 2 == 0:
                    d.rectangle([xx, yy, xx + 11, yy + 11], fill=(38, 46, 58, 255))
        sheet.alpha_composite(im, (20, y + 40))
        cfg = cfg_de(dict(VARIACOES[i][1]))
        d.text(
            (12, y + 12),
            f"{nome}   dentro {cfg['DENTRO_X']}/{cfg['DENTRO_Y']}   "
            f"{cfg['PROFUNDIDADE']} tábuas de {cfg['TABUA_L']}px   mourão {cfg['POSTE_ALT']}px",
            fill=(255, 230, 150, 255),
        )
    sheet.save(destino)
    return sheet.size


def gera_pecas(nome_var):
    """Escreve as peças da variação escolhida em `pier2d/`."""
    extra = dict(dict(VARIACOES)[nome_var])
    cfg = cfg_de(extra)
    os.makedirs(DESTINO, exist_ok=True)
    l_fundo = max(4, round(cfg['POSTE_L'] * cfg['POSTE_FUNDO']))
    saidas = {
        'deck': deck_tile(cfg),
        'deck-fim': deck_fim(cfg),
        'deck-rampa': deck_rampa(cfg),
        'poste': poste(cfg, cfg['POSTE_ALT'] + cfg['ESTACA_ALT']),
        'poste-fundo': poste(dict(cfg, POSTE_L=l_fundo), cfg['POSTE_ALT'] + cfg['ESTACA_ALT']),
        'corrimao': corrimao(cfg, cfg['TILE'] * 2),
    }
    finais = {}
    for nome, im in saidas.items():
        grande = im.resize(
            (im.width * ESCALA_SAIDA, im.height * ESCALA_SAIDA), Image.NEAREST
        )
        grande.save(os.path.join(DESTINO, nome + '.webp'), 'WEBP', quality=QUALIDADE, method=5)
        finais[nome] = grande.size
    return finais


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--sheet', default='')
    ap.add_argument('--gerar', default='')
    a = ap.parse_args()
    if a.sheet:
        print('contact sheet:', contact_sheet(a.sheet))
    if a.gerar:
        print('peças:', gera_pecas(a.gerar))
    if not a.sheet and not a.gerar:
        print('nada a fazer: use --sheet ou --gerar')


if __name__ == '__main__':
    main()
