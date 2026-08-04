"""
Importa POSES SOLTAS - um zip de PNGs - para a biblioteca de personagens.

    python3 scripts/import-poses.py ~/sprites_sentados.zip ~/bravo_chorando.zip

Para que serve, e por que nao e o `import-character.py`:

  O importador de personagem REESCREVE `char/<personagem>/` inteira a partir da
  tabela `CLIPS` dele. E o certo para um pacote de animacao completo, e e a
  razao de 43 quadros terem sumido de uma vez quando essa tabela foi reescrita.
  Este aqui e o oposto: ACRESCENTA um clipe por arquivo e nao apaga nada. Rodar
  duas vezes com o mesmo zip so sobrescreve os mesmos clipes.

O que ele faz com cada PNG:

  1. tira o fundo branco chapado, se houver (a mesma leitura do importador);
  2. mede o boneco - chapeu, quadril e pe - so no VOLUME do corpo, ignorando
     vara, linha e outros fiapos;
  3. escala. Aqui ha uma armadilha, e ela custou uma rodada: NAO da para medir
     pelo chapeu entre vistas diferentes. O mesmo chapeu de palha mede 189 px
     de perfil e 240 de frente - a aba e um circulo, e de perfil ela aparece
     escorcada. Medir por ele encolhia toda pose frontal em uns 20%.

     Entao sao dois casos:

       PACOTE com um arquivo que ja esta no jogo (o `03_lateral_esquerda`, que
       virou `sit-left`): a escala sai desse par e vale para o zip inteiro. Os
       desenhos de um mesmo pacote ja estao na mesma escala entre si, e assim a
       pose nova entra do tamanho exato da que ja esta na cena;

       PACOTE solto: escala pela ALTURA DO CORPO contra o perfil parado, que e
       o que o `import-character.py` faz nas vistas de frente e de costas. Vale
       para pose EM PE; pose sentada solta precisaria de um par de referencia;
  4. cola no canvas de hoje (`CHAR_CANVAS`) com o quadril no mesmo x e o pe no
     mesmo y de todos os outros quadros - e por isso a pose nova nao desliza
     nem afunda quando o editor troca de clipe;
  5. acrescenta a linha em `src/world/charFrames.ts`, sem tocar nas que ja
     estao la.

Requer: pillow, numpy e scipy.
"""
import importlib.util
import io
import os
import re
import sys
import zipfile

from PIL import Image

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PERSONAGEM = os.environ.get('PERSONAGEM', 'juggler')
OUT = os.path.join(RAIZ, 'src/assets/game/char', PERSONAGEM)
FRAMES_TS = os.path.join(RAIZ, 'src/world/charFrames.ts')

_spec = importlib.util.spec_from_file_location(
    'importador', os.path.join(RAIZ, 'scripts/import-character.py')
)
_importador = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(_importador)
metrics = _importador.metrics
load_rgba_bytes = None


# ---------------------------------------------------------------- a tabela
#
# NOME DO ARQUIVO -> nome do clipe.
#
# So os nomes: o resto (escala, ancora, canvas) e igual para todo mundo. Um
# arquivo que nao estiver aqui entra com o proprio nome, sem numero na frente -
# a tabela e conveniencia, e nao porteiro. Foi uma tabela-porteiro que descartou
# arte da ultima vez.
NOMES = {
    '01_frontal_sentado': 'sit-front',
    '02_costas_sentado': 'sit-back',
    '03_lateral_esquerda_sentado': None,      # ja esta no jogo como `sit-left`
    '04_lateral_direita_sentado': 'sit-side-right',
    '05_tres_quartos_frontal_sentado': 'sit-three-quarter',
    'sprite-bravo-punhos-sem-fundo-contorno-1px': 'angry',
    'sprite-chorando-sem-fundo-contorno-1px': 'crying',
}


# ------------------------------------------------------- a escala do pacote
#
# ARQUIVO DO ZIP -> clipe que ja esta no jogo.
#
# Um par so basta: os desenhos de um pacote estao na mesma escala entre si,
# entao o par fixa a escala do zip inteiro e a pose nova entra do tamanho exato
# da que ja esta na cena.
REFERENCIAS = {
    '03_lateral_esquerda_sentado': 'sit-left',
}


def slug(nome):
    base = os.path.splitext(os.path.basename(nome))[0].lower()
    return base.replace('_', '-').replace(' ', '-')


def nome_do_clipe(arquivo):
    chave = os.path.splitext(os.path.basename(arquivo))[0].lower()
    if chave in NOMES:
        return NOMES[chave]
    s = slug(arquivo)
    # o numero da frente e ordem de arquivo, nao faz parte do nome da pose
    return re.sub(r'^\d+-', '', s)


def abre(dados):
    """PNG cru -> RGBA, com fundo branco chapado virando transparencia."""
    im = Image.open(io.BytesIO(dados))
    if im.mode == 'RGBA':
        return im
    tmp = os.path.join('/tmp', 'pose-tmp.png')
    im.save(tmp)
    return _importador.load_rgba(tmp)


def main(zips):
    if not zips:
        print(__doc__)
        return 1

    # A REFERENCIA DE ESCALA e o perfil parado que esta no jogo hoje. Nao e um
    # numero escrito aqui: se o personagem inteiro for reimportado maior, as
    # poses soltas acompanham na proxima rodada.
    ref_im = Image.open(os.path.join(OUT, 'side-idle-left/00.webp')).convert('RGBA')
    CW, CH = ref_im.size
    ref = metrics(ref_im)
    AX, AY = ref['hip_x'], ref['foot_y']
    print(f'referencia: canvas {CW}x{CH}  ancora ({AX:.0f},{AY:.0f})  corpo {ref["body_h"]:.0f}px')

    corpo_ref = ref['body_h']
    novos = {}
    for caminho in zips:
        with zipfile.ZipFile(caminho) as z:
            pngs = [
                n for n in sorted(z.namelist())
                if n.lower().endswith('.png') and not n.startswith('__MACOSX')
            ]

            # A ESCALA DO PACOTE, se houver um par de referencia dentro dele.
            k_pacote = None
            for nome in pngs:
                chave = os.path.splitext(os.path.basename(nome))[0].lower()
                alvo = REFERENCIAS.get(chave)
                if not alvo:
                    continue
                jogo = metrics(Image.open(os.path.join(OUT, alvo, '00.webp')).convert('RGBA'))
                k_pacote = jogo['body_h'] / metrics(abre(z.read(nome)))['body_h']
                print(f'  escala do pacote por `{alvo}`: {k_pacote:.3f}')
                break

            for nome in pngs:
                clipe = nome_do_clipe(nome)
                if clipe is None:
                    print(f'  - {os.path.basename(nome)}: ja esta no jogo, pulando')
                    continue
                im = abre(z.read(nome))
                m = metrics(im)
                k = k_pacote if k_pacote else corpo_ref / m['body_h']
                w = max(1, round(im.width * k))
                h = max(1, round(im.height * k))
                # NEAREST: a origem ja e pixel art, e filtro suave borra a borda
                escalado = im.resize((w, h), Image.NEAREST)
                canvas = Image.new('RGBA', (CW, CH), (0, 0, 0, 0))
                canvas.paste(
                    escalado,
                    (round(AX - m['hip_x'] * k), round(AY - m['foot_y'] * k)),
                    escalado,
                )
                dst = os.path.join(OUT, clipe, '00.webp')
                os.makedirs(os.path.dirname(dst), exist_ok=True)
                canvas.save(dst, 'WEBP', quality=82, method=5)
                novos[f'{PERSONAGEM}/{clipe}'] = 1
                print(f'  {clipe}: 1 quadro  ({os.path.getsize(dst) / 1024:.0f} KB)')

    if not novos:
        return 0

    # ------------------------------------------------------- charFrames.ts
    # Acrescenta, e nao reescreve: as linhas que ja estao la continuam onde
    # estao, e a lista sai ordenada.
    texto = open(FRAMES_TS, encoding='utf-8').read()
    ini = texto.index('export const CLIP_FRAMES: Record<string, number> = {')
    corpo_ini = texto.index('{', ini) + 1
    corpo_fim = texto.index('};', corpo_ini)
    linhas = {}
    for linha in texto[corpo_ini:corpo_fim].splitlines():
        m = re.match(r"\s*'([^']+)':\s*(\d+),", linha)
        if m:
            linhas[m.group(1)] = int(m.group(2))
    linhas.update(novos)
    corpo = '\n' + '\n'.join(f"  '{k}': {v}," for k, v in sorted(linhas.items())) + '\n'
    open(FRAMES_TS, 'w', encoding='utf-8').write(
        texto[:corpo_ini] + corpo + texto[corpo_fim:]
    )
    print(f'\n{len(novos)} clipes em {FRAMES_TS}')
    return 0


if __name__ == '__main__':
    sys.exit(main(sys.argv[1:]))
