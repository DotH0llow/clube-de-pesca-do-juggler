"""
Importa os retratos do ELENCO e a maquina de fliperama.

    ELENCO_DIR=~/characters ARCADE=~/hydrinho.png python3 scripts/import-elenco.py

O ELENCO
--------

Os cinco personagens vieram como PNG de corpo inteiro, de frente, com uns 1 800
px de altura - retrato de cutscene, e nao sprite de jogo. Eles entram em
`src/assets/game/elenco/`, com o mesmo tratamento que o `juggler-cutscene` ja
tinha: recorte da margem transparente e altura teto de 1 200 px.

O Juggler do menu entra junto. Ele estava solto em `src/assets/juggler-cutscene.webp`,
fora do registro de assets - ou seja, fora da biblioteca do editor e fora de
qualquer lista. Elenco de seis com cinco numa pasta e um sexto num canto e
exatamente o tipo de coisa que a proxima pessoa nao encontra.

A MAQUINA
---------

`hydrinho-tropical-arcade-machine.png` vem ESPELHADA: a placa do topo diz
"OHNIRDYH", que e HYDRINHO lido no espelho, e a alavanca esta na direita
enquanto a perspectiva do gabinete olha para a esquerda. O importador desvira.
Isso e conserto de origem, e nao gosto: uma placa ilegivel nao e uma escolha de
arte.

Requer: pillow.
"""
import os

from PIL import Image

RAIZ = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
ELENCO = os.environ.get('ELENCO_DIR', './characters')
ARCADE = os.environ.get('ARCADE', './hydrinho-tropical-arcade-machine.png')
JUGGLER = os.path.join(RAIZ, 'src/assets/juggler-cutscene.webp')

OUT_ELENCO = os.path.join(RAIZ, 'src/assets/game/elenco')
OUT_PROPS = os.path.join(RAIZ, 'src/assets/game/props')


# altura teto de um retrato de elenco, em px de arquivo
ALTURA_ELENCO = 1200
# a maquina e cenario, nao retrato: ela e vista no mundo, entao vai menor
ALTURA_ARCADE = 900


def recorta(im):
    """Tira a margem transparente, que e o que faz o retrato ancorar torto."""
    caixa = im.getbbox()
    return im.crop(caixa) if caixa else im


def salva(im, destino, altura):
    im = recorta(im.convert('RGBA'))
    if im.height > altura:
        larg = max(1, round(im.width * altura / im.height))
        im = im.resize((larg, altura), Image.LANCZOS)
    os.makedirs(os.path.dirname(destino), exist_ok=True)
    im.save(destino, 'WEBP', quality=86, method=5)
    return im.size, os.path.getsize(destino)


def main():
    total = 0

    # ------------------------------------------------------------- elenco
    if os.path.isdir(ELENCO):
        for pasta in sorted(os.listdir(ELENCO)):
            dir_p = os.path.join(ELENCO, pasta)
            if not os.path.isdir(dir_p):
                continue
            pngs = sorted(f for f in os.listdir(dir_p) if f.lower().endswith('.png'))
            if not pngs:
                continue
            # o nome da PASTA manda, e nao o do arquivo: `sazon-cutscene-v2.png`
            # viraria `sazon-cutscene-v2`, e a versao do arquivo nao e o nome do
            # personagem
            destino = os.path.join(OUT_ELENCO, f'{pasta}.webp')
            tam, bytes_ = salva(Image.open(os.path.join(dir_p, pngs[0])), destino, ALTURA_ELENCO)
            total += bytes_
            print(f'  elenco/{pasta}: {tam[0]}x{tam[1]}  {bytes_ / 1024:.0f} KB')
    else:
        print(f'sem pasta de elenco em {ELENCO}, pulando')

    # o Juggler do menu entra no mesmo lugar que os outros
    if os.path.exists(JUGGLER):
        tam, bytes_ = salva(Image.open(JUGGLER), os.path.join(OUT_ELENCO, 'juggler.webp'), ALTURA_ELENCO)
        total += bytes_
        print(f'  elenco/juggler: {tam[0]}x{tam[1]}  {bytes_ / 1024:.0f} KB')

    # ------------------------------------------------------------ maquina
    if os.path.exists(ARCADE):
        im = Image.open(ARCADE).convert('RGBA').transpose(Image.FLIP_LEFT_RIGHT)
        tam, bytes_ = salva(im, os.path.join(OUT_PROPS, 'hydrinho-arcade.webp'), ALTURA_ARCADE)
        total += bytes_
        print(f'  props/hydrinho-arcade: {tam[0]}x{tam[1]}  {bytes_ / 1024:.0f} KB  (desespelhada)')
    else:
        print(f'sem arquivo da maquina em {ARCADE}, pulando')

    print(f'\ntotal {total / 1024:.0f} KB. Rode `python3 scripts/asset-dims.py` em seguida.')


if __name__ == '__main__':
    main()
