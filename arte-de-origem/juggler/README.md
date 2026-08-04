# arte de origem — Juggler

Os zips que geraram os clipes de `src/assets/game/char/juggler/`. Eles ficam
aqui pelo mesmo motivo que o `import-poses.py` existe: **a arte de origem tem
que estar no repositório**.

Quando o `import-character.py` foi reescrito, 43 quadros já importados sumiram
com a reescrita e a única cópia deles estava no histórico do git. Zip no
repositório é o conserto disso pela raiz: qualquer pessoa reimporta tudo sem
depender de um arquivo que alguém enviou por mensagem um dia.

## O que tem em cada um

`sprites_sentados.zip` — cinco poses sentadas:

| arquivo | clipe |
| --- | --- |
| `01_frontal_sentado.png` | `sit-front` |
| `02_costas_sentado.png` | `sit-back` |
| `03_lateral_esquerda_sentado.png` | já está no jogo como `sit-left` — é ele que fixa a escala do pacote |
| `04_lateral_direita_sentado.png` | `sit-side-right` |
| `05_tres_quartos_frontal_sentado.png` | `sit-three-quarter` |

`bravo_chorando.zip` — duas poses de reação, de frente:

| arquivo | clipe |
| --- | --- |
| `sprite-bravo-punhos-...png` | `angry` |
| `sprite-chorando-...png` | `crying` |

## Reimportar

```
python3 scripts/import-poses.py arte-de-origem/juggler/*.zip
```

O script acrescenta um clipe por arquivo, normaliza a escala e a âncora
(quadril e pé no mesmo ponto de todos os outros quadros) e escreve as linhas
novas em `src/world/charFrames.ts`. Ele não apaga clipe nenhum.
