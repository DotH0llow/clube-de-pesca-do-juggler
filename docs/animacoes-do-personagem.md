# Padrão das animações do Juggler

Documento de referência para regerar os quadros do personagem. Enquanto a arte
nova não chega, o jogo compensa as diferenças por código (veja o fim do arquivo).

## O problema que a arte atual tem

Todos os arquivos já são `113x170`, mas o boneco foi **desenhado em posições e
escalas diferentes dentro do canvas**:

| animação | altura do corpo no canvas | escala relativa ao idle |
|---|---|---|
| `side-idle` | 170 px (encosta em cima e embaixo) | 1,00 |
| `walk` | 141 px | 1,21 |
| `run` | 122 px | 1,27 |
| `fish-no-rod` | 133 px | 1,19 |
| `jump` | 100 px | 1,43 |
| `sit` | 142 px | 1,05 |

Além disso, dentro do próprio `side-idle` o boneco anda **37 px de lado** entre o
quadro 00 e o 03 — era isso que fazia ele parecer teletransportar parado.

## O que a arte nova precisa entregar

1. **Canvas fixo e igual para todos os quadros.** Sugestão: `160x220`, com folga
   em cima e embaixo (o `113x170` atual corta o chapéu e as sandálias do idle).
2. **Linha do chão fixa.** O pé de apoio sempre encostando na mesma linha, por
   exemplo `y = 208` (12 px de folga embaixo). Vale para `side-idle`, `walk`,
   `run`, `fish-no-rod` e `sit`.
3. **Eixo vertical fixo.** O quadril sempre na mesma coluna, no centro do canvas
   (`x = 80`). Braço, vara e cabelo podem passar do centro à vontade; o quadril
   não.
4. **Mesma escala de corpo em todas as animações.** Referência: altura do
   personagem em pé, do chão ao topo do chapéu, de `170 px` no canvas de 220.
   Correr e pular podem ficar mais baixos pela pose — nunca pelo tamanho do
   desenho.
5. **No pulo, o boneco não sobe dentro do canvas.** Quem levanta o personagem é
   a física do jogo. No quadro do ar, o que muda é a perna encolhendo, com o
   quadril na mesma altura do quadro de impulso.
6. **Quadros por animação** (mantendo o que o código já espera):
   `side-idle` 4 · `walk` 6 · `run` 6 · `jump` 6 · `fish-no-rod` 6 · `sit` 4.
7. **Pastas e nomes** continuam iguais:
   `src/assets/game/char/<anim>-<left|right>/00.webp` … e as versões `left` são
   desenhadas de verdade (o jogo não espelha por CSS).
8. **Sem pixel solto.** Alguns quadros de `walk` e `run` têm respingo de pixel
   longe do corpo; isso vira sujeira na tela e bagunça qualquer medição
   automática.

## Como o jogo compensa hoje

`scripts/measure-character.py` mede cada quadro e gera `src/world/charFrames.ts`
com dois ajustes que o `usePlayer` aplica na hora de trocar o quadro:

* `FRAME_FIX[clip][i] = { dx, dy }` — desloca o quadro para o quadril cair no
  eixo do jogador e o pé no chão;
* `ANIM_SCALE[clip]` — corrige o tamanho do boneco por animação.

Depois de trocar a arte, rode:

```bash
python3 scripts/measure-character.py
```

Com os quadros padronizados os `dx/dy` ficam perto de zero e as escalas viram
`1.000`. Aí dá para simplesmente apagar a compensação, se quiser.
