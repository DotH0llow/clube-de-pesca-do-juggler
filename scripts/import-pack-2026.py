"""
Importa os pacotes novos de 2026 para dentro do jogo.

Tres pacotes, tres receitas:

  landscape-skies-final -> `bg/sky-<n>-<nome>`  ceu de cada uma das 8 fases do
      dia. Sao fundos landscape, sem alfa: nao ha o que recortar, so reduzir.

  sprites_pier          -> `pier/<nome>`  pecas de montar o pier (tabua, estaca,
      viga, escada, guarda-corpo). Ficam no tamanho nativo: sao tiles, e esticar
      tile arruina o encaixe.

  sand-autotile-47      -> `sand/<nome>`  as 47 pecas do autotile de areia, no
      tamanho nativo pelo mesmo motivo.

    PACK_DIR=/caminho/dos/zips python3 scripts/import-pack-2026.py

Requer: pillow.
"""
import glob
import os
import re
import sys

from PIL import Image

SRC = os.environ.get('PACK_DIR', './packs')
OUT = os.environ.get('OUT_DIR', './src/assets/game')

# tudo que o pacote de ceus substitui: sai do disco na mesma passada
OLD_SKIES = ['bg/sky-day.webp', 'bg/sky-night.webp', 'bg/sky-sunset.webp']


def save(im, rel, quality):
    path = os.path.join(OUT, rel + '.webp')
    os.makedirs(os.path.dirname(path), exist_ok=True)
    im.save(path, 'WEBP', quality=quality, method=6)
    return path


def import_skies():
    files = sorted(glob.glob(os.path.join(SRC, '**', 'landscape-skies-final', '*.png'), recursive=True))
    if not files:
        return 0
    for path in files:
        name = os.path.splitext(os.path.basename(path))[0]
        with Image.open(path) as im:
            im = im.convert('RGB')
            # teto de 1600 px de largura: o ceu e fundo, nao precisa de mais
            if im.width > 1600:
                im = im.resize((1600, round(im.height * 1600 / im.width)), Image.LANCZOS)
            save(im, f'bg/sky-{name}', 84)
    return len(files)


def import_tiles(folder, category, quality):
    files = sorted(glob.glob(os.path.join(SRC, '**', folder, '*.png'), recursive=True))
    for path in files:
        raw = os.path.splitext(os.path.basename(path))[0]
        # `01-deck-short_64x64` -> `deck-short`; `sand_00_00000000` fica inteiro
        name = re.sub(r'^\d+-', '', raw)
        name = re.sub(r'_\d+x\d+$', '', name)
        with Image.open(path) as im:
            save(im.convert('RGBA'), f'{category}/{name}', quality)
    return len(files)


def main():
    if not os.path.isdir(SRC):
        sys.exit(f'pacote nao encontrado: {SRC}')

    skies = import_skies()
    pier = import_tiles('sprites', 'pier', 88)
    sand = import_tiles('sand-autotile-47', 'sand', 88)

    removed = 0
    if skies:
        for rel in OLD_SKIES:
            path = os.path.join(OUT, rel)
            if os.path.exists(path):
                os.remove(path)
                removed += 1

    print(f'ceus: {skies} · pier: {pier} · areia: {sand} · ceus antigos apagados: {removed}')


if __name__ == '__main__':
    main()
