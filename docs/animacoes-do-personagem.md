# Animações do Juggler

Como a arte do personagem entra no jogo e por que o importador é do jeito que é.

## De onde vem a arte

Dois pacotes, ambos desenhados olhando para a **esquerda** (o mar aberto fica à
esquerda do mapa; a direita é espelhada no importador):

* `juggler_new_anim/` — poses estáticas (frente, costas, perfis e três-quartos),
  `andando/` com dois quadros, `pulo/` com impulso e aterrissagem, e `sentado/`
  com cinco poses;
* `fishing-left/` — seis quadros da pescaria, um por momento do lance:
  `01_ready`, `02_cast_backswing`, `03_cast_forward`, `04_wait_reel`,
  `05_hook_set`, `06_reel_in`.

## Clipes que o jogo monta

| clipe | quadros na pasta | sequência padrão |
|---|---|---|
| `side-idle` | 1 | `0` |
| `walk` | 4 | `0, 2` |
| `run` | 4 | `0, 2` |
| `jump` | 2 | `0, 1` (física) |
| `sit` | 1 | `0` |
| `fish` | 6 | `0..5` (uma por fase do lance) |
| `back-idle` | 1 | `0` |

**Quadros na pasta e sequência não são a mesma coisa.** A pasta é a arte que
existe; a sequência é a ordem em que o jogo toca. Andar e correr saem com
`0, 2` porque os quadros 1 e 3 são a pose parada — servem de contato num ciclo
de 4 tempos, mas dão um ar de hesitação. Quem quiser o ciclo completo escreve
`0, 1, 2, 3` no editor, sem tocar em código.

Cada clipe vira duas pastas, `-left` e `-right`; a versão da direita é o espelho
da esquerda, gerado na importação.

### O espelho que veio trocado

A importação anterior gerou parte dos quadros com o espelho invertido em relação
ao nome da pasta. Dava três sintomas, todos reclamados em jogo:

* `side-idle-left` olhava para a **direita** e `side-idle-right` para a
  **esquerda** — por isso o Juggler terminava de andar para a direita e parava
  virado para a esquerda;
* os quadros **1 e 3** de `walk` e `run` eram cópias do `side-idle` com o mesmo
  espelho errado — daí a impressão de que ele virava o rosto a cada passo, e de
  que a caminhada usava uma pose parada;
* `jump-left` e `jump-right` estavam simplesmente trocados, e `sit` também.

A correção foi espelhar esses arquivos **no lugar**. Como o canvas é simétrico
(`CHAR_ANCHOR.dx = 0`, âncora no centro), espelhar não desalinha nada.

Regra para a próxima importação: o nome da pasta manda. `-left` olha para a
esquerda, `-right` para a direita, em **todos** os quadros do clipe. Uma tira de
conferência rápida:

```bash
python3 - <<'EOF'
from PIL import Image; import glob
for f in sorted(glob.glob('src/assets/game/char/*/00.webp')):
    print(f)  # abra e confira o lado do nariz contra o nome da pasta
EOF
```

## Onde mora a ordem dos quadros

Em `src/editor/anims.ts`, não no laço de animação. Cada pasta de quadros tem uma
`ClipConfig`:

```ts
{ frames: [0, 2], frameMs: 200, mode: 'loop' }
```

* `frames` — a ordem, por índice de arquivo. Pode repetir e pode inverter.
* `frameMs` — quanto cada passo segura (só vale no modo `loop`).
* `mode` — como o jogo lê a lista:
  * `loop` — roda em ciclo (andar, correr, parado);
  * `fisica` — primeiro item subindo, último descendo (pulo);
  * `fase` — um item por momento do lance (pescaria).

Tudo isso é editável na seção **ANIMAÇÕES** do modo editor e fica salvo no
navegador. `src/world/usePlayer.ts` só pergunta qual é o quadro da vez.

### Correr é caminhar acelerado

Mesma arte da caminhada, `frameMs` menor (200 ms andando, 160 ms correndo). A
velocidade de deslocamento (`RUN_SPEED`) é outra coisa e continua sendo decisão
de jogabilidade — se um dia o deslize dos pés incomodar, é esse número que se
mexe, ou o ritmo do clipe no editor.

### Tamanho do Juggler

`CHAR_SCALE = 0.72` em `src/world/usePlayer.ts` encolhe o quadro inteiro para o
mar ganhar tela. `CHAR_FRAME_H` continua sendo gerado pelo importador e não se
mexe na mão.

### A pescaria não roda em loop

Como a arte tem uma pose por momento do lance, o quadro sai da fase e não do
relógio: `idle` mostra a pose de espera, `power` o movimento para trás, `bite` a
fisgada, e por aí vai. A fase `waiting` passa rápido pelo arremesso
(`CAST_HOLD_MS`) antes de assentar. Enquanto o Juggler está com a vara na mão, a
vara fincada no deck some — a arte já traz uma.

### O pulo segue a física, não o cronômetro

Subindo mostra o impulso, descendo mostra a aterrissagem. Quem decide é o sinal
da velocidade vertical.

## O que o importador resolve

`scripts/import-character.py` existe porque a arte crua não é utilizável direto:

1. **Escala.** Cada PNG foi desenhado numa resolução diferente, então o boneco
   tem tamanho diferente em cada arquivo. A normalização usa a **largura do
   chapéu** nas vistas de perfil (é a única medida que não muda com a pose) e a
   altura do corpo nas vistas de frente e de costas.
2. **Fundo branco.** Os quadros de caminhada e de pescaria vieram com fundo
   chapado. A remoção é por preenchimento a partir da borda, nunca por limiar
   global — o Juggler tem barba branca e flores brancas na camisa.
3. **A vara.** É uma linha fina que atravessa metade do quadro e estragaria
   qualquer medida de âncora. O "corpo" sai de uma erosão da máscara: o que
   sobra é só o volume do personagem.
4. **Alinhamento.** Todo quadro é colado num canvas único com o quadril no mesmo
   x e o pé no mesmo y. Por isso `charFrames.ts` não tem mais tabela de correção
   por quadro: sobrou uma constante (`CHAR_ANCHOR`).

## Rodando de novo

```bash
ANIM_DIR=~/juggler_new_anim FISH_DIR=~/fishing-left python3 scripts/import-character.py
```

O script reescreve `src/assets/game/char/` e `src/world/charFrames.ts`
(canvas, altura do quadro em unidades de mundo, âncora e contagem de quadros).
Requer `pillow`, `numpy` e `scipy`.

## Se a arte mudar de novo

O importador aguenta canvas de tamanhos diferentes, mas ajuda muito se a arte
nova vier com:

* o personagem sempre de perfil olhando para a **esquerda** nos clipes laterais;
* fundo transparente (ou branco chapado, que o script resolve);
* nenhum pixel solto longe do corpo — vira sujeira e bagunça a medição.
