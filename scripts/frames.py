"""
Gera as MOLDURAS DE JANELA a partir do pacote do píer.

Os pop-ups usavam `ui/decorative-frame`, uma moldura de folhagem tropical, com
`border-image-slice: 46 fill`. A palavra `fill` é o defeito: ela manda o CENTRO
da imagem preencher o fundo do elemento - e o centro daquela arte é a própria
folhagem. Cada janela do jogo virava um mosaico de folhas repetidas atrás do
texto, que é o que aparece no print da "boia nem piscou".

A moldura nova é de madeira, montada com as tábuas do píer, e é uma 9-slice de
verdade: só borda, centro transparente. O fundo da janela passa a ser cor
sólida definida no CSS - azul escuro, como pedido - em vez de vir de dentro da
imagem.

    python3 scripts/frames.py

Requer: pillow e numpy.
"""
import os

import numpy as np
from PIL import Image

# ==========================================================================
# CONSTANTES
# ==========================================================================

AQUI = os.path.dirname(os.path.abspath(__file__))
RAIZ = os.path.dirname(AQUI)
PIER = os.path.join(RAIZ, 'src/assets/game/pier')
DESTINO = os.path.join(RAIZ, 'src/assets/game/ui')

# A célula da 9-slice. A imagem final tem 3x3 células; o CSS corta em
# `border-image-slice: BORDA`.
BORDA = 32
LADO = BORDA * 3

# Peças do píer usadas como matéria-prima
TABUA = 'deck-fascia'      # a borda: tábua grossa, com as pontas amarradas
POSTE = 'piling-slim'      # os cantos: tronco curto, visto de topo
CORDA = 'joint-lashed'     # o nó que disfarça a emenda do canto

QUALIDADE = 92


def abre(pasta, nome):
    return Image.open(os.path.join(pasta, nome + '.webp')).convert('RGBA')


def recorta(im):
    """Só a parte com desenho, sem a folga transparente da célula."""
    a = np.array(im)[:, :, 3]
    ys, xs = np.where(a > 16)
    if not len(ys):
        return im
    return im.crop((int(xs.min()), int(ys.min()), int(xs.max()) + 1, int(ys.max()) + 1))


def barra(nome, comprimento, espessura):
    """Uma tábua do comprimento pedido, repetindo o desenho em vez de esticar."""
    src = recorta(abre(PIER, nome))
    src = src.resize((max(1, round(src.width * espessura / src.height)), espessura), Image.LANCZOS)
    out = Image.new('RGBA', (comprimento, espessura), (0, 0, 0, 0))
    for x in range(0, comprimento, src.width):
        out.alpha_composite(src, (x, 0))
    return out


def moldura():
    """
    A 9-slice: quatro tábuas nas bordas e quatro nós nos cantos.

    O centro fica VAZIO de propósito. É essa a diferença para a moldura antiga:
    quem pinta o fundo da janela é o CSS, então dá para trocar a cor sem
    reexportar imagem nenhuma.
    """
    im = Image.new('RGBA', (LADO, LADO), (0, 0, 0, 0))

    horizontal = barra(TABUA, LADO, BORDA)
    im.alpha_composite(horizontal, (0, 0))
    im.alpha_composite(horizontal.transpose(Image.FLIP_TOP_BOTTOM), (0, LADO - BORDA))

    # as laterais são a mesma tábua girada: madeira é madeira em qualquer eixo
    vertical = barra(TABUA, LADO, BORDA).transpose(Image.ROTATE_90)
    im.alpha_composite(vertical, (0, 0))
    im.alpha_composite(vertical.transpose(Image.FLIP_LEFT_RIGHT), (LADO - BORDA, 0))

    # cantos: o nó amarrado cobre a emenda das duas tábuas
    no = recorta(abre(PIER, CORDA)).resize((BORDA, BORDA), Image.LANCZOS)
    im.alpha_composite(no, (0, 0))
    im.alpha_composite(no.transpose(Image.FLIP_LEFT_RIGHT), (LADO - BORDA, 0))
    im.alpha_composite(no.transpose(Image.FLIP_TOP_BOTTOM), (0, LADO - BORDA))
    im.alpha_composite(no.transpose(Image.ROTATE_180), (LADO - BORDA, LADO - BORDA))

    # o centro volta a ser transparente: as tábuas invadiram ao serem coladas
    centro = Image.new('RGBA', (LADO - 2 * BORDA, LADO - 2 * BORDA), (0, 0, 0, 0))
    im.paste(centro, (BORDA, BORDA))
    return im


def placa():
    """
    A placa do título, para o cabeçalho das janelas.

    Uma tábua horizontal com os topos arrematados - serve de faixa atrás do
    texto do título, no lugar do `fx/capture-banner`, que é uma arte de largura
    fixa e por isso cortava título comprido.
    """
    # `deck-fascia` ja vem com as pontas amarradas em corda, entao ela e a
    # placa inteira - colar um `deck-end` em cima so empilhava duas pontas
    alt = BORDA
    return barra(TABUA, BORDA * 6, alt)


def main():
    os.makedirs(DESTINO, exist_ok=True)
    saidas = {'window-frame': moldura(), 'window-title': placa()}
    for nome, im in saidas.items():
        # ampliação inteira com vizinho mais próximo: pixel art escalada por
        # fator quebrado vira pixel de tamanhos diferentes lado a lado
        g = im.resize((im.width * 2, im.height * 2), Image.NEAREST)
        g.save(os.path.join(DESTINO, nome + '.webp'), 'WEBP', quality=QUALIDADE, method=5)
        print(f'  ui/{nome}  {g.size[0]}x{g.size[1]}')
    print(f'corte da 9-slice: border-image-slice: {BORDA * 2}')


if __name__ == '__main__':
    main()
