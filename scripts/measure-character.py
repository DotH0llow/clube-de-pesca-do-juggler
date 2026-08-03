"""
Mede os quadros do Juggler e gera src/world/charFrames.ts.

Por que isso existe: os quadros foram desenhados com o boneco em posicoes e
escalas diferentes dentro do canvas de 113x170. Sem correcao, o boneco parece
teletransportar de lado no idle e mudar de tamanho quando troca de animacao.

O script mede, para cada quadro:
  * ancora horizontal  -> centroide da faixa do quadril (estavel: nao balanca
    com braco nem com vara);
  * ancora vertical    -> base do conteudo (o pe que esta no chao) nas
    animacoes com o boneco em pe; no pulo usa a linha do quadril, senao o
    boneco "afunda" quando encolhe as pernas no ar;
  * escala relativa    -> raiz da area opaca comparada com o side-idle, que e
    a referencia de tamanho do personagem.

Rode de novo depois de regerar a arte:  python3 scripts/measure-character.py
Com quadros padronizados os offsets caem para perto de zero e as escalas para 1.

Requer: pillow e numpy.
"""
import glob
import os

import numpy as np
from PIL import Image

CHAR_DIR = 'src/assets/game/char'
OUT = 'src/world/charFrames.ts'
REF = 'side-idle-right'          # animacao de referencia para a escala
HIP_BAND = (0.42, 0.60)          # faixa do quadril, em fracao da altura do conteudo
AIRBORNE = {'jump-left', 'jump-right'}


def frame_metrics(path):
    a = np.array(Image.open(path).convert('RGBA'))[:, :, 3] > 40
    rows = np.where(a.any(1))[0]
    cols = np.where(a.any(0))[0]
    top, bottom = int(rows[0]), int(rows[-1])
    h = bottom - top + 1
    y0 = top + int(h * HIP_BAND[0])
    y1 = max(y0 + 1, top + int(h * HIP_BAND[1]))
    band = a[y0:y1]
    bx = np.where(band.any(0))[0]
    hip_x = float(bx.mean()) if len(bx) else float(cols.mean())
    hip_y = (y0 + y1) / 2.0
    return {
        'hip_x': hip_x,
        'hip_y': hip_y,
        'top': top,
        'bottom': bottom,
        'area': float(a.sum()),
        'w': a.shape[1],
        'h': a.shape[0],
    }


def main():
    anims = sorted(d for d in os.listdir(CHAR_DIR) if os.path.isdir(os.path.join(CHAR_DIR, d)))
    data = {}
    for anim in anims:
        files = sorted(glob.glob(os.path.join(CHAR_DIR, anim, '*.webp')))
        data[anim] = [frame_metrics(f) for f in files]

    canvas_w = data[REF][0]['w']
    canvas_h = data[REF][0]['h']
    ref_area = np.mean([np.sqrt(m['area']) for m in data[REF]])

    lines = []
    scales = {}
    for anim, frames in data.items():
        scales[anim] = float(ref_area / np.mean([np.sqrt(m['area']) for m in frames]))

    fixes = {}
    for anim, frames in data.items():
        if anim in AIRBORNE:
            # o pulo se ancora pelo quadril: a fisica ja levanta o boneco, entao
            # o quadro nao pode subir junto. A referencia e o quadro de impulso.
            base = frames[0]
            hip_line = base['hip_y'] + (canvas_h - 1 - base['bottom'])
            anchor_y = [m['hip_y'] - hip_line for m in frames]
        else:
            anchor_y = [-(canvas_h - 1 - m['bottom']) for m in frames]
        fixes[anim] = [
            {'dx': round(canvas_w / 2 - m['hip_x'], 2), 'dy': round(dy, 2)}
            for m, dy in zip(frames, anchor_y)
        ]

    lines.append('/**')
    lines.append(' * GERADO por scripts/measure-character.py - nao edite na mao os numeros;')
    lines.append(' * rode o script de novo depois de trocar a arte.')
    lines.append(' *')
    lines.append(' * dx/dy estao em pixels do canvas original do quadro. O renderizador')
    lines.append(' * multiplica pelo fator de escala do sprite antes de aplicar.')
    lines.append(' */')
    lines.append('')
    lines.append('export interface FrameFix {')
    lines.append('  /** deslocamento horizontal para o quadril cair no eixo do jogador */')
    lines.append('  dx: number;')
    lines.append('  /** deslocamento vertical para o pe cair no chao */')
    lines.append('  dy: number;')
    lines.append('}')
    lines.append('')
    lines.append(f'export const CHAR_CANVAS = {{ w: {canvas_w}, h: {canvas_h} }};')
    lines.append('')
    lines.append('/**')
    lines.append(' * Compensacao de tamanho enquanto a arte nao estiver padronizada.')
    lines.append(' * Referencia: ' + REF + '. Com quadros no mesmo tamanho, tudo vira 1.')
    lines.append(' */')
    lines.append('export const ANIM_SCALE: Record<string, number> = {')
    for anim in sorted(scales):
        lines.append(f'  {js_key(anim)}: {scales[anim]:.3f},')
    lines.append('};')
    lines.append('')
    lines.append('export const FRAME_FIX: Record<string, FrameFix[]> = {')
    for anim in sorted(fixes):
        body = ', '.join(f"{{ dx: {f['dx']}, dy: {f['dy']} }}" for f in fixes[anim])
        lines.append(f'  {js_key(anim)}: [{body}],')
    lines.append('};')
    lines.append('')

    with open(OUT, 'w', encoding='utf-8') as fh:
        fh.write('\n'.join(lines))
    print('escrito', OUT)
    for anim in sorted(scales):
        print(f'  {anim:20s} escala {scales[anim]:.3f}')


def js_key(name):
    return f"'{name}'"


if __name__ == '__main__':
    main()
