"""
Traz de volta as poses que uma importacao anterior apagou.

    python3 scripts/resgatar-poses.py

O QUE ACONTECEU
---------------

O commit `9b6b6f7` reescreveu o importador de personagem. A tabela `CLIPS` do
importador novo nomeia UM quadro de cada pose estatica - `01_back.png` virou
`back-idle`, `03_lateral_esquerda_sentado.png` virou `sit` - e o importador
reescreve a pasta `char/` inteira. Resultado: 43 quadros que existiam no
repositorio deixaram de ser gerados e sairam no mesmo commit.

Nao era arte perdida: era arte JA IMPORTADA, versionada, que a reescrita
descartou. Sentar de frente, sentar de costas, os perfis de tres quartos, o
ciclo de pescaria sem a vara - tudo isso estava em `char/` e sumiu de uma vez.

O QUE ESTE SCRIPT FAZ
---------------------

Le os 43 arquivos do proprio historico do git (`9b6b6f7^`) e os traz de volta
para `char/juggler/`. Nao e um `git checkout`, e por um motivo:

  O CANVAS MUDOU. Os quadros antigos sao 256x256 com o boneco em outra escala;
  os de agora sao 522x564, com o quadril num x fixo e o pe num y fixo
  (`CHAR_ANCHOR`). Colar o arquivo antigo direto poria um Juggler menor,
  flutuando, no meio dos outros.

Entao cada quadro passa pela MESMA normalizacao do `import-character.py`:
escala medida pela largura do chapeu, quadril e pe alinhados no canvas atual.
As duas funcoes de medida sao importadas de la, e nao copiadas - duas medidas
do mesmo boneco e um lugar a mais para discordar.

ONDE ELAS APARECEM
------------------

Como clipes NOVOS, com o sufixo `-extra`, e nao como quadros a mais dos clipes
existentes. `walk-left` tem quatro quadros e uma sequencia ajustada no editor;
somar dois quadros no fim dela mudaria a caminhada de quem ja jogava. Clipe
novo nao mexe em nada do que ja esta configurado.

`fish-no-rod-left` e `fish-no-rod-right` voltam com o nome original: eram
clipes inteiros de seis quadros, apagados por completo, e nao sobras de outro.

Requer: pillow, numpy e scipy.
"""
import os
import subprocess
import sys

from PIL import Image

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import importlib.util

_spec = importlib.util.spec_from_file_location(
    'importador', os.path.join(os.path.dirname(os.path.abspath(__file__)), 'import-character.py')
)
_importador = importlib.util.module_from_spec(_spec)
# o importador roda `main()` so no `__main__`, entao importar e seguro
_spec.loader.exec_module(_importador)

metrics = _importador.metrics
SIDE, FRONT = _importador.SIDE, _importador.FRONT

RAIZ = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
OUT = os.path.join(RAIZ, 'src/assets/game/char/juggler')
COMMIT = os.environ.get('COMMIT_ANTES', '9b6b6f7^')

# ------------------------------------------------------------------ o que volta
#
# pasta antiga -> (pasta nova, quadros que voltam, vista)
#
# A vista importa para a escala: perfil mede pela largura do chapeu (a unica
# medida que nao muda com a pose), frente e costas medem pela altura do corpo.
RESGATE = [
    ('back-idle', 'back-idle-extra', [1, 2, 3], FRONT),
    ('side-idle-left', 'side-idle-left-extra', [1, 2, 3], SIDE),
    ('side-idle-right', 'side-idle-right-extra', [1, 2, 3], SIDE),
    ('sit-left', 'sit-left-extra', [1, 2, 3], SIDE),
    ('sit-right', 'sit-right-extra', [1, 2, 3], SIDE),
    ('walk-left', 'walk-left-extra', [4, 5], SIDE),
    ('walk-right', 'walk-right-extra', [4, 5], SIDE),
    ('run-left', 'run-left-extra', [4, 5], SIDE),
    ('run-right', 'run-right-extra', [4, 5], SIDE),
    ('jump-left', 'jump-left-extra', [2, 3, 4, 5], SIDE),
    ('jump-right', 'jump-right-extra', [2, 3, 4, 5], SIDE),
    # estes voltam com o nome de origem: eram clipes inteiros, nao sobras
    ('fish-no-rod-left', 'fish-no-rod-left', [0, 1, 2, 3, 4, 5], SIDE),
    ('fish-no-rod-right', 'fish-no-rod-right', [0, 1, 2, 3, 4, 5], SIDE),
]


def do_git(caminho):
    """Le um arquivo binario do historico, sem mexer na arvore de trabalho."""
    r = subprocess.run(
        ['git', 'show', f'{COMMIT}:{caminho}'],
        cwd=RAIZ, capture_output=True,
    )
    return r.stdout if r.returncode == 0 else None


def main():
    import io

    # A REFERENCIA DE ESCALA e o perfil parado de HOJE, e nao um dos quadros
    # resgatados: e ele que define o tamanho do Juggler que esta no jogo.
    ref_path = os.path.join(OUT, 'side-idle-left/00.webp')
    ref_im = Image.open(ref_path).convert('RGBA')
    CW, CH = ref_im.size
    ref = metrics(ref_im)
    AX, AY = ref['hip_x'], ref['foot_y']
    hat_ref = ref['hat']
    body_ref = ref['body_h']
    print(f'referencia: canvas {CW}x{CH}  ancora ({AX:.0f},{AY:.0f})')

    total = 0
    linhas = []
    for antiga, nova, quadros, vista in RESGATE:
        saiu = 0
        for i, q in enumerate(quadros):
            dados = do_git(f'src/assets/game/char/{antiga}/{q:02d}.webp')
            if dados is None:
                print(f'  FALTA {antiga}/{q:02d}')
                continue
            # o arquivo do historico ja e webp com alfa, entao nao passa pelo
            # `load_rgba` (que existe para tirar fundo branco de PNG chapado)
            im = Image.open(io.BytesIO(dados)).convert('RGBA')
            m = metrics(im)
            k = (hat_ref / m['hat']) if vista == SIDE else (body_ref / m['body_h'])
            w = max(1, round(im.width * k))
            h = max(1, round(im.height * k))
            # NEAREST, e nao LANCZOS: o arquivo de origem ja e pixel art
            # exportada, e reamostrar com filtro suave borraria a borda dura
            escalado = im.resize((w, h), Image.NEAREST)

            canvas = Image.new('RGBA', (CW, CH), (0, 0, 0, 0))
            canvas.paste(escalado, (round(AX - m['hip_x'] * k), round(AY - m['foot_y'] * k)), escalado)
            dst = os.path.join(OUT, nova, f'{saiu:02d}.webp')
            os.makedirs(os.path.dirname(dst), exist_ok=True)
            canvas.save(dst, 'WEBP', quality=82, method=5)
            total += os.path.getsize(dst)
            saiu += 1
        if saiu:
            print(f'  {nova}: {saiu} quadros')
            linhas.append(f"  'juggler/{nova}': {saiu},")

    print(f'\n{total / 1024:.0f} KB. Acrescente em src/world/charFrames.ts:\n')
    print('\n'.join(sorted(linhas)))


if __name__ == '__main__':
    main()
