# assets-inuteis

44 dos 217 arquivos do kit que **nao entraram no jogo**, separados aqui para
revisao. Nenhum foi descartado por qualidade: todos sao redundantes, tecnicos ou
nao tem lugar neste jogo.

Os arquivos estao como previews em webp (max. 1000 px) so para conferencia
visual. Os originais em PNG continuam intactos no zip que voce enviou.

---

## `pranchas-de-contato/` — 13 arquivos

As pranchas (`sheets/`) sao o mesmo conteudo dos PNGs individuais, montado numa
folha unica. Como o kit ja vem com **cada sprite recortado em arquivo proprio**, a
prancha so serve para apresentacao. Usar spritesheet faria sentido se o jogo
fizesse batching de textura em canvas/WebGL; aqui cada sprite e um `<img>` com
URL propria e cache proprio do navegador.

- `world-props`, `boats-and-coast`, `gear-and-pier-props`, `fish-roster-01`,
  `fish-roster-02`, `trash-roster`, `water-and-catch-effects`, `interface-roster`,
  `rewards-and-feedback`, `sky-weather`, `sprite-style-proof`
- `ocean-background-quartet` — os 4 fundos de oceano lado a lado; os 4 individuais
  estao no jogo
- `sky-triptych` — os 3 ceus lado a lado; os 3 individuais estao no jogo

## `versoes-magenta/` — 11 arquivos

Mesmas pranchas com fundo magenta em vez de alpha. Sao para pipelines de engine
que fazem chroma key. **Todos os PNGs do kit ja tem canal alpha**, entao a versao
magenta so adiciona trabalho: precisaria recortar o magenta e ainda sobraria
franja colorida nas bordas.

## `kit-de-aprovacao/` — 19 arquivos

`approval-kit/` era a amostra de linguagem visual enviada para aprovar o estilo.
Cada item ali tem equivalente de producao nas pastas numeradas, com nome melhor e
mesma qualidade:

| Amostra | Equivalente usado |
| --- | --- |
| `true-sardine` | `04_sprites/fish/true-sardine` |
| `rusty-old-boot` | `05_sprites/trash/old-boot` |
| `fishing-boat` | `02_sprites/boats-and-pier/fishing-boat-idle-side` |
| `inflatable-dinghy` | `02_sprites/boats-and-pier/dinghy-idle-side` |
| `fishing-rod`, `hook-and-line` | `03_sprites/fishing-gear/*` |
| `reward-chest-icon` | `09_rewards-and-feedback/chest-closed` |
| `small-hook-splash` | `07_effects/.../hook-splash-small` |
| `underwater-bubbles` | `07_effects/.../underwater-bubbles` |
| `sun`, `coconut-palm`, `coral-rock-seafloor`, `pier-segment`, `life-buoy` | `01_sprites/environment/*`, `02_sprites/*` |
| `tension-meter-ui` | `08_interface/tension-bar` |
| `water-surface-tile`, `environment-style-proof` | substituidos pelos ceus e pelas faixas de onda |

## `sem-uso-no-jogo/` — 1 arquivo

- `chat-icon` — o jogo e single player e offline, sem chat nem qualquer campo de
  texto. E o unico icone da pasta `08_interface/` sem funcao correspondente.

---

## O que **nao** esta aqui e voce talvez esperasse

Estes ficaram no jogo mesmo sem uso na tela principal, porque tem destino claro:

- `06_backgrounds/ocean/*` — fundos submersos; entram no minigame de puxada e nos
  pesqueiros profundos (`reef-deep` ja e a miniatura do Naufragio no mapa).
- `10_weather-and-sky/storm-cloud`, `rain-streaks`, `lightning-bolt` — sao o que
  transforma o ceu de dia no clima do Naufragio do Cargueiro.
- `01_sprites/environment/distant-underwater-silhouette` — virou a **Sombra da
  Hydra** e o **Hydrinho Abissal**, as duas criaturas miticas do album.
- `ui/depth-indicator`, `ui/cursor`, `ui/nautical-panel`, `ui/catch-modal-frame`,
  `ui/tooltip`, `ui/casting-power-bar`, `ui/tension-bar` — ainda nao aplicados,
  mas sao substituicoes diretas de elementos que hoje sao CSS. Ficam no repo como
  proxima camada de polimento.
- Props de pier, barris, remos, motores, cabana e mercado — cenario para o Cais e
  para pesqueiros futuros.
