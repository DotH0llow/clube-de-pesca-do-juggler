"""
Importa a arte nova do Juggler e monta os clipes de animacao do jogo.

    ANIM_DIR=~/juggler_new_anim FISH_DIR=~/fishing-left python3 scripts/import-character.py

Por que este script e menos ingenuo que um "recorta e salva":

  1. cada PNG de origem foi desenhado numa resolucao diferente, entao o boneco
     tem tamanho diferente em cada arquivo. A escala e normalizada pela largura
     do CHAPEU (a unica medida que nao muda com a pose) nas vistas de perfil, e
     pela altura do corpo nas vistas de frente/costas;

  2. os quadros de caminhada e de pescaria vieram com fundo branco chapado. O
     fundo e removido por preenchimento a partir da borda, e nao por limiar
     global - o boneco tem barba branca e flores brancas na camisa;

  3. a vara de pescar e uma linha fina que atravessa metade do quadro. Ela
     estragaria qualquer medida de ancora, entao o "corpo" e obtido erodindo a
     mascara: o que sobra e so o volume do personagem;

  4. todo quadro e colado num canvas unico com o QUADRIL no mesmo x e o PE no
     mesmo y. Com isso o boneco nao desliza nem afunda ao trocar de clipe, e o
     charFrames.ts sai com correcao constante em vez de uma tabela de gambiarra.

Requer: pillow, numpy e scipy.
"""
import os
import sys

import numpy as np
from PIL import Image
from scipy.ndimage import binary_erosion, label

ANIM = os.environ.get('ANIM_DIR', './juggler_new_anim')
FISH = os.environ.get('FISH_DIR', './fishing-left')
OUT = os.environ.get('OUT_DIR', './src/assets/game/char')
FRAMES_TS = os.environ.get('FRAMES_TS', './src/world/charFrames.ts')

# altura do corpo em pe, em unidades de mundo
TARGET_BODY = 170.0
# resolucao extra do arquivo em relacao ao tamanho de tela (nitidez no zoom)
SUPERSAMPLE = 1.6

P = lambda *a: os.path.join(ANIM, *a)
F = lambda *a: os.path.join(FISH, *a)

# vista lateral: escala pela largura do chapeu. frontal/costas: pela altura.
SIDE, FRONT = 'side', 'front'

# clipe -> (lista de quadros de origem, vista, espelhar para gerar o par)
CLIPS = {
    'side-idle': ([P('03_left_profile.png')], SIDE),
    'walk': (
        [
            P('andando', '01_left_foot_forward.png'),
            P('03_left_profile.png'),
            P('andando', '02_right_foot_forward.png'),
            P('03_left_profile.png'),
        ],
        SIDE,
    ),
    # correr e a mesma arte da caminhada, so que 25% mais rapida (ver usePlayer)
    'run': (
        [
            P('andando', '01_left_foot_forward.png'),
            P('03_left_profile.png'),
            P('andando', '02_right_foot_forward.png'),
            P('03_left_profile.png'),
        ],
        SIDE,
    ),
    'jump': ([P('pulo', '01_takeoff.png'), P('pulo', '02_landing.png')], SIDE),
    'sit': ([P('sentado', '03_lateral_esquerda_sentado.png')], SIDE),
    'fish': (
        [
            F('01_ready.png'),
            F('02_cast_backswing.png'),
            F('03_cast_forward.png'),
            F('04_wait_reel.png'),
            F('05_hook_set.png'),
            F('06_reel_in.png'),
        ],
        SIDE,
    ),
}
# clipes sem par espelhado
SINGLE = {'back-idle': ([P('01_back.png')], FRONT)}

# a arte de origem olha para a esquerda; a direita e o espelho
BASE_FACING = 'left'


# --------------------------------------------------------------- leitura

def load_rgba(path):
    """Abre o PNG ja com alfa. Fundo branco chapado vira transparencia."""
    im = Image.open(path)
    if im.mode == 'RGBA':
        return im
    rgb = np.array(im.convert('RGB'))
    light = rgb.min(-1) >= 216
    lab, n = label(light)
    if n:
        edge = np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))
        edge = edge[edge > 0]
        bg = np.isin(lab, edge)
    else:
        bg = np.zeros(light.shape, bool)
    alpha = np.where(bg, 0, 255).astype(np.uint8)
    return Image.fromarray(np.dstack([rgb, alpha]), 'RGBA')


def body_mask(alpha, frac=0.012):
    """Volume do personagem: erode a mascara ate a vara fina desaparecer."""
    m = alpha > 40
    r = max(2, int(round(min(m.shape) * frac)))
    eroded = binary_erosion(m, np.ones((r, r), bool))
    lab, n = label(eroded)
    if n == 0:
        return m
    sizes = np.bincount(lab.ravel())
    sizes[0] = 0
    return lab == sizes.argmax()


def metrics(im):
    """Escala, quadril e pe de um quadro, medidos so no volume do corpo."""
    a = np.array(im)[:, :, 3]
    b = body_mask(a)
    ys, xs = np.where(b)
    top, bottom = int(ys.min()), int(ys.max())
    h = bottom - top + 1
    band = b[top:top + max(1, int(h * 0.16))]
    hat = max((np.where(r)[0][-1] - np.where(r)[0][0] + 1) for r in band if r.any())
    lo = top + int(h * 0.42)
    hi = max(lo + 1, top + int(h * 0.60))
    hip = b[lo:hi]
    hx = np.where(hip.any(0))[0]
    return {
        'hip_x': float(hx.mean()) if len(hx) else float(xs.mean()),
        'foot_y': float(bottom),
        'hat': float(hat),
        'body_h': float(h),
        'full': np.array(im).shape,
    }


# ---------------------------------------------------------------- montagem

def main():
    jobs = {**CLIPS, **SINGLE}
    loaded = {}
    for clip, (paths, view) in jobs.items():
        loaded[clip] = [(load_rgba(p), view) for p in paths]

    # a referencia de tamanho e o perfil parado
    ref_im, _ = loaded['side-idle'][0]
    ref = metrics(ref_im)
    unit = TARGET_BODY / ref['body_h']          # px de origem -> unidade de mundo
    hat_ref = ref['hat'] * unit                 # largura do chapeu no mundo

    placed = {}
    for clip, frames in loaded.items():
        placed[clip] = []
        for im, view in frames:
            m = metrics(im)
            k = (hat_ref / m['hat']) if view == SIDE else (TARGET_BODY / m['body_h'])
            k *= SUPERSAMPLE
            w = max(1, round(im.width * k))
            h = max(1, round(im.height * k))
            scaled = im.resize((w, h), Image.LANCZOS)
            placed[clip].append({
                'im': scaled,
                'hip': m['hip_x'] * k,
                'foot': m['foot_y'] * k,
            })

    # canvas comum: cabe todo mundo, com o quadril no mesmo x e o pe no mesmo y
    left = right = up = down = 0.0
    for frames in placed.values():
        for f in frames:
            left = max(left, f['hip'])
            right = max(right, f['im'].width - f['hip'])
            up = max(up, f['foot'])
            down = max(down, f['im'].height - f['foot'])
    pad = 2
    half = int(np.ceil(max(left, right))) + pad     # canvas simetrico no eixo x
    CW = half * 2
    CH = int(np.ceil(up)) + int(np.ceil(down)) + pad * 2
    AX, AY = half, int(np.ceil(up)) + pad           # ancora dentro do canvas
    print(f'canvas {CW}x{CH}  ancora ({AX},{AY})  unidade {unit:.4f}')

    total = 0
    for clip, frames in placed.items():
        outs = [(clip, False)] if clip in SINGLE else [
            (f'{clip}-{BASE_FACING}', False),
            (f'{clip}-{"right" if BASE_FACING == "left" else "left"}', True),
        ]
        for name, mirror in outs:
            for i, f in enumerate(frames):
                canvas = Image.new('RGBA', (CW, CH), (0, 0, 0, 0))
                src = f['im']
                canvas.paste(src, (round(AX - f['hip']), round(AY - f['foot'])), src)
                if mirror:
                    canvas = canvas.transpose(Image.FLIP_LEFT_RIGHT)
                dst = os.path.join(OUT, name, f'{i:02d}.webp')
                os.makedirs(os.path.dirname(dst), exist_ok=True)
                canvas.save(dst, 'WEBP', quality=82, method=5)
                total += os.path.getsize(dst)
            print(f'  {name}: {len(frames)} quadros')

    # ------------------------------------------------------- charFrames.ts
    # a ancora ja esta baked; sobra so levar o ponto (AX,AY) para o
    # canto de baixo/centro, que e onde o renderizador ancora a imagem.
    dx = CW / 2 - AX
    dy = -(CH - AY)
    # 1 px do canvas vale 1/SUPERSAMPLE unidade de mundo (a escala ja foi
    # normalizada la em cima), entao a altura do quadro sai direto da divisao.
    player_h = CH / SUPERSAMPLE
    names = sorted(
        [n for c in CLIPS for n in (f'{c}-left', f'{c}-right')] + list(SINGLE)
    )
    counts = {}
    for c, (paths, _) in {**CLIPS, **SINGLE}.items():
        if c in SINGLE:
            counts[c] = len(paths)
        else:
            counts[f'{c}-left'] = counts[f'{c}-right'] = len(paths)

    lines = [
        '/**',
        ' * GERADO por scripts/import-character.py - nao edite na mao.',
        ' *',
        ' * Todo quadro ja sai do importador alinhado pelo quadril e pelo pe dentro',
        ' * de um canvas unico, entao nao existe mais tabela de correcao por quadro:',
        ' * basta levar a ancora do canvas ate o ponto onde o renderizador encosta o',
        ' * sprite (centro embaixo).',
        ' */',
        '',
        '/** tamanho do arquivo de cada quadro, em px */',
        f'export const CHAR_CANVAS = {{ w: {CW}, h: {CH} }};',
        '',
        '/** altura do quadro inteiro, em unidades de mundo */',
        f'export const CHAR_FRAME_H = {player_h:.1f};',
        '',
        '/**',
        ' * Deslocamento do quadro, em px do canvas, para o quadril cair no eixo do',
        ' * jogador e o pe encostar no chao.',
        ' */',
        f'export const CHAR_ANCHOR = {{ dx: {dx:.1f}, dy: {dy:.1f} }};',
        '',
        '/** quantos quadros cada clipe tem */',
        'export const CLIP_FRAMES: Record<string, number> = {',
    ]
    for n in names:
        lines.append(f"  '{n}': {counts[n]},")
    lines += ['};', '']

    with open(FRAMES_TS, 'w', encoding='utf-8') as fh:
        fh.write('\n'.join(lines))
    print(f'escrito {FRAMES_TS}  altura do quadro {player_h:.1f}  total {total / 1024:.0f} KB')


if __name__ == '__main__':
    main()
