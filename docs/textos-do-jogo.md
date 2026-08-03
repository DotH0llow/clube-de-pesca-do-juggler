# Textos do jogo

Regra curta: **todo texto que o jogador lê vai acentuado. Todo o resto, não.**

Esta página existe porque a mesma falha voltou algumas vezes — `RODA DA MARE`,
`Escamas lendarias`, `Nova especie no album`, `VOLUME DA MUSICA`, `PROXIMO`,
`NAO`. Nada disso é bug de codificação: os arquivos sempre foram UTF-8. É texto
digitado sem acento porque o código em volta é escrito sem acento.

## As duas zonas

| Zona | Acento? | Por quê |
| --- | --- | --- |
| Texto na tela (JSX, `pushToast`, `confirm`, rótulo de botão, `headline`, `flavor`, `desc`, `name`) | **sim** | é o produto |
| Comentário, nome de variável, id de dado (`'lendario'`, `'mare-favoravel'`), chave de `localStorage`, classe de CSS, nome de arquivo | **não** | é código, e id acentuado quebra save antigo |

O ponto de confusão é sempre o mesmo: `rarity: 'lendario'` é **id** e fica como
está; `RARITIES.lendario.name` é **rótulo** e tem que ser `'Lendário'`.

## Antes de commitar

Rode o caçador de acento perdido:

```bash
npm run textos
```

Ele varre `src/`, ignora comentário e id, e lista toda palavra em texto de tela
que aparece sem acento. Saída vazia = nada a fazer. Se ele apontar algo que é
id de propósito, o certo é renomear a variável — não afrouxar o script.

## Ao escrever texto novo

1. Escreva em português de verdade, com acento e cedilha (`ç`, `ã`, `é`, `ê`).
2. Caixa alta não perde acento: é `LANÇAR`, `MARÉ`, `NÃO`, `PRÓXIMO`,
   `CONFIGURAÇÕES` — a fonte VCR tem todos esses glifos.
3. `&middot;` para o ponto do meio; nunca `·` cru colado em outra palavra.
4. Texto que muda com o estado do jogo entra por template literal — confira o
   acento **dentro** da crase também, que é onde ele mais escapa.
5. Terminou? `npm run textos` e depois `npm run build`.
