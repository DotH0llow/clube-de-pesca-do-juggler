# music-restaurante

Trilha da area de restaurante. **Guardada de proposito.**

Estas seis faixas ficam fora de `src/`, entao nao entram no bundle nem aparecem
no radio do jogo. Elas so passam a tocar quando a parte de restaurante existir.

Para ativar depois: mover os arquivos para `src/assets/music/restaurante/`,
apontar o glob de `src/engine/music.ts` para a pasta nova e trocar a lista
`RESTAURANT_TRACKS` (hoje so titulos, para o app de playlist mostrar como
"EM BREVE") por faixas de verdade.

| Arquivo | Duracao aproximada |
| --- | --- |
| `alex-malheiros-papaia-1984-latin-jazz-funk-fusion.m4a` | 5m45 |
| `circuit-groove.m4a` | 4m31 |
| `cuban-crunch.m4a` | 3m32 |
| `holiznacc0-busted-jazz.m4a` | 2m29 |
| `holiznacc0-make-funk-public-domain-music.m4a` | 2m43 |
| `latin-life.m4a` | 3m10 |

Todas foram reencodadas de MP3 para AAC 80 kbps: 51 MB viraram 14 MB, sem perda
audivel em alto-falante de jogo.

## Atencao com licenca

Parte das faixas enviadas e de catalogo comercial. Antes de publicar o jogo,
vale conferir a licenca de cada uma - as `HoliznaCC0` sao dominio publico, mas
as demais provavelmente exigem substituicao ou licenciamento.
