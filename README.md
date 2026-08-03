# Juggler's Fishing Club

Jogo casual de pesca em browser, ambientado no universo Hydra. Voce lanca a linha,
fisga o que aparecer, vende por **Sazoncoins**, completa o **Album do Pescador**,
compra upgrades permanentes e, de vez em quando, encontra algo no fundo que
prefere nao ter encontrado.

Estetica: pixel art tropical/oceanica com cara de anos 2000 - agua turquesa,
ilhas ao longe, por do sol, barco ancorado. Nada de fantasia medieval.


## Regra de texto (leia antes de escrever qualquer frase)

Texto que o jogador lê vai **acentuado**; comentário, nome de variável e id de
dado ficam **sem acento**. `npm run textos` caça acento perdido e o `npm run
build` já roda essa checagem antes de compilar. Detalhes e o porquê em
[`docs/textos-do-jogo.md`](docs/textos-do-jogo.md).


## Mundo e personagem

O jogo nao e uma tela parada: e um cenario lateral que vai da **floresta da ilha**
ate a **ponta do pier**, com a camera arrastando junto com o Juggler.

| Tecla | Acao |
| --- | --- |
| Setas ou `A`/`D` | Andar |
| `Shift` | Correr |
| `Espaco`, `W` ou seta pra cima | Pular |
| `E` | Pescar (perto da vara) |
| `ESC` | Abrir/fechar o celular |

O Juggler usa os clipes montados por `scripts/import-character.py` a partir da
arte nova (parado, andar, correr, pular, pescar, sentar e idle de costas), com
esquerda e direita separadas - a direita e o espelho da esquerda, gerado na
importacao. Correr e a mesma arte da caminhada rodando 25% mais rapido, e a
pescaria nao roda em loop: cada fase do lance trava no seu quadro. Detalhes em
`docs/animacoes-do-personagem.md`.

A pescaria so abre quando o Juggler chega perto da vara fincada no fim do pier.
Ali o personagem troca para a pose de pesca e o HUD de lancamento aparece.

### O corte do cenario

A cena e um corte transversal, como no sketch: ceu e ilhas no alto, linha d'agua
com espuma e ondas, e abaixo dela a coluna de agua com raios de luz, corais,
algas, cardumes, bolhas e a boca de uma caverna no fim. O pier e montado com a
tabua e o poste do kit **repetidos**, nao esticados.

## Tipografia

**VCR OSD Mono**, servida localmente em woff2. A fonte nao tem descendentes -
`g`, `p`, `q` e `y` sao desenhados inteiros acima da linha de base, o que faz
minuscula parecer defeito de renderizacao. Ela foi desenhada para OSD de video,
ou seja, para caixa alta. Por isso o jogo forca `text-transform: uppercase` em
tudo.

## Rodando

```bash
npm install
npm run dev       # servidor de desenvolvimento
npm run build     # typecheck + build de producao em dist/
npm run preview   # serve o build
npm run simulate  # simulador de economia (sem UI)
```

Node 18+ recomendado. Nao precisa de backend: o save fica em `localStorage`.

## Assets

Todo o visual vem do kit de pixel art do projeto. O pipeline de importacao
(`scripts/import-assets.py`) faz, para cada PNG:

1. recorta a margem transparente **e os pixels soltos** - rotulagem de
   componentes conexos por propagacao vetorizada, descartando fragmentos com
   menos de 6% da area do maior blob (varios sprites vinham com respingo de
   nadadeira solta na borda do canvas);
2. redimensiona para o teto da categoria (peixe 340 px, lixo 200, UI 340, ceu 380);
3. exporta webp com qualidade por categoria.

Resultado: **217 PNGs (49 MB) viraram 175 webp (2,2 MB)**.

O acesso e por nome, via `src/assets/index.ts`:

```ts
import { asset } from './assets';
asset('fish/mahi-mahi');   // URL versionada pelo Vite
```

O registro usa `import.meta.glob`, entao adicionar um arquivo na pasta ja o
disponibiliza - nao existe lista de imports para manter em sincronia. O smoke
test valida que **todo sprite referenciado em dados existe** (peixes, lixo,
upgrades, reliquias e familias).

### Onde cada grupo foi parar

| Grupo do kit | Uso |
| --- | --- |
| `04_sprites/fish` | as 24 especies pescaveis do album |
| `05_sprites/trash` | os 20 itens da categoria "Lixo" |
| `10_weather-and-sky/backgrounds` | ceu de cada pesqueiro (dia / por do sol / noite) |
| `10_weather-and-sky` (nuvens, chuva, raio) | clima: o Naufragio e o ceu de dia sob tempestade |
| `07_effects` | ondas em parallax, brilho do sol, linha, ondulacao, fuga, bolhas |
| `02_sprites/boats-and-pier` | barco em duas poses alternadas + sombra |
| `03_sprites/fishing-gear` | icones dos upgrades (vara, carretel, isca, balde, chumbada) |
| `01_sprites/environment` | floresta, cabana, corais, algas, caverna e a silhueta da Hydra |
| `12_nature/trees` (pacote `new`) | `nature/`: 20 arvores da mata do fim do mapa |
| `13_marine-life` (pacote `new`) | `marine/`: 53 bichos e corais do fundo do mar |
| `02_sprites/boats-and-pier` (tabua, poste, escada) | o pier inteiro, montado por repeticao |
| `11_characters/juggler` | 68 quadros do personagem jogavel |
| `08_interface` | moldura dos paineis, botoes, selos de raridade, icones do HUD |
| `09_rewards-and-feedback` | faixa de captura, bau, particulas por raridade, alerta de mordida |
| `06_backgrounds/ocean` | miniaturas de pesqueiro e fundo do minigame de puxada |

44 arquivos ficaram de fora e estao separados em
[`assets-inuteis/`](assets-inuteis/README.md), com o motivo de cada um.

### Duas licencas poeticas

- **Sombra da Hydra** e **Hydrinho Abissal** usam a mesma silhueta submersa do
  kit, tratada com filtro escuro e brilho vermelho. E de proposito: a lenda diz
  que ninguem nunca viu a Hydra direito.
- O kit traz tres selos de raridade e o jogo tem seis. Comum e Incomum dividem o
  selo comum, Raro fica com o proprio, e Epico/Lendario/Mitico dividem o epico.

## O celular

Dentro do jogo, **tudo mora no celular do Juggler**: `ESC` abre o aparelho com
album, cais, trofeus, ajustes e ajuda em abas. A tela de titulo tem so COMECAR,
COMO JOGAR e AJUSTES.

Duas regras de interface valendo para qualquer tela nova:

1. **Tamanho fixo.** A janela nunca cresce nem encolhe conforme a aba; o conteudo
   rola por dentro.
2. **Moldura repetida, nunca esticada.** As molduras do kit sao pequenas
   (o botao tem 241x129). Esticar borrava a madeira, entao o `border-image` usa
   `repeat: round` - as bordas se repetem no tamanho nativo e so o miolo estica.
   O fundo das telas e azul claro chapado.

As configuracoes ficam num `localStorage` separado do save, entao apagar o
progresso nao mexe nos ajustes:

| Grupo | Opcao | O que faz |
|---|---|---|
| Audio | Silenciar | Corta tudo sem perder os volumes |
| Audio | Volume geral / Musica / Efeitos | Tres barramentos independentes |
| Imagem | Animacoes | Liga/desliga toda animacao CSS (classe `no-anim`) |
| Imagem | Tremor de tela | Sacudida da boia e da tela na mordida |
| Jogo | Dicas na tela | Textos de ajuda dos minigames (classe `no-hints`) |
| Jogo | Vibracao | `navigator.vibrate` no celular |
| Jogo | Confirmar gasto de Olhos | Segundo clique antes de gastar moeda de prestigio |
| Dados | Restaurar configuracoes / Apagar progresso | Reset separado de cada coisa |

O ceu tem nuvens e passaros com tamanho, altura, opacidade e velocidade
sorteados. Nuvens andam a 30% da velocidade antiga e passaros a 10%.

`Animacoes` e `Tremor de tela` ja nascem desligados se o sistema pedir
`prefers-reduced-motion`.

## Audio

Nao ha nenhum arquivo de som no repositorio. Tudo e sintetizado em tempo real com
WebAudio em `src/engine/audio.ts`:

- **Ambiencia**: ruido filtrado com envelope lento (0,09 Hz) = quebra de onda, com
  um pad grave por baixo. Vai para o barramento de musica.
- **Efeitos**: lancamento, splash, mordida, moeda, bau, falha e cliques de UI.
- **Fanfarra de captura**: arpejo que cresce com a raridade - uma nota para comum,
  seis notas e timbre serrilhado para mitico.

O contexto de audio so nasce depois de um gesto do jogador (politica de autoplay
dos navegadores). Quando entrarem trilha e SFX de verdade, basta trocar o corpo de
`playSfx` e `playCatch` - o resto do jogo nao muda.

## Risco e recompensa

O jogo continua sendo de habilidade: quem decide se o peixe entra no balde e o
minigame de puxada, nunca o dado. Por cima disso existe uma camada de
antecipacao e decisao, com uma regra que vale para tudo:

> **Sazoncoins que ja entraram no save nunca saem.** O unico valor que pode ser
> perdido e o *bonus pendente* de uma sequencia, e a interface sempre diz quanto
> esta em risco.

| Mecanica | O que faz |
| --- | --- |
| Multiplicador de sequencia | 3/5/8/12 capturas seguidas viram x1,2 / x1,5 / x2 / x3. So o bonus fica pendente; o valor-base entra garantido. |
| Pescar ou Sacar | A partir de 3 capturas, oferece sacar o bonus ou seguir arriscando. O botao de sacar e sempre o primeiro e o maior. |
| Peixe Jackpot | Uma especie real do catalogo com tratamento dourado, mais dificil de puxar. Minor x5, Major x15, Grand x50. |
| Mare da Fortuna | Medidor 0-100 que enche com capturas. Cheio, o proximo encontro elegivel vira Peixe Jackpot. |
| Multiplicadores escondidos | Prateado x1,5, Dourado x2, Coroado x3 - revelados so depois da fisgada, nunca antes de o jogador assumir o risco. |
| Roda da Mare | Um giro gratuito a cada 5 capturas. O premio e sorteado ANTES da animacao. |
| Cartas de Sorte | Nove cartas roguelite de sessao, escolha de 3. |
| Cartela de Missoes | Bingo 3x3; cada linha paga uma unica vez. |
| Cardume Bonus | 25s de pescaria acelerada, multiplicador interno ate x3. Falhar consome tempo, nao encerra. |
| Escada de Premios | Depois de um raro, um minigame de timing de verdade: +20%, +50%, +100%, +200%. So o bonus da escada esta em risco. |

Toda a matematica vive em [`src/game/systems/RewardCalculator.ts`](src/game/systems/RewardCalculator.ts)
e todo numero sorteavel em [`src/game/balance.ts`](src/game/balance.ts). A ordem
dos multiplicadores e fixa e os tetos sao 10x normal, 25x em evento e 50x em
jackpot.

`npm test` roda 37 asserts do calculador, incluindo um fuzz de 2000 sorteios que
verifica que o valor garantido nunca fica abaixo do valor-base.

A aba CARTELA do celular mostra a cartela e uma **tela de probabilidades** com
todos os pesos. Nao existe dinheiro real, compra de giro nem item negociavel.

Debug: `localStorage.setItem('juggler-debug','1')` e `F9` no jogo.

## Radio

O celular tem um app de playlist com as sete faixas de pescaria. O volume usa o
mesmo barramento de musica das configuracoes. As faixas de restaurante ficam
guardadas em [`music-restaurante/`](music-restaurante/README.md) e aparecem no
app como "EM BREVE" ate a area existir.

## Loop de jogo

1. **LANCAR** - barra de forca oscilando. Parar no centro vale lancamento perfeito
   (mais chance de peixe bom e +15% no valor).
2. **Espera** - a boia fica na agua por um tempo aleatorio.
3. **FISGAR!** - janela de ~1,1s para reagir. Perdeu a janela, perdeu o peixe.
4. **Puxada** - minigame de segurar/soltar: mantenha o vulto dentro da faixa verde
   para encher a barra. Quanto mais raro o peixe, mais nervoso ele fica.
5. **Resultado** - peixe vai pro album, Sazoncoins pro bolso, e as vezes um Olho da Hydra.

## Arquitetura de RNG

O sorteio segue a filosofia do Hydrinho Lucky Spin: **primeiro sorteia a categoria
do resultado, depois materializa o item compativel**. Isso deixa controlar ritmo,
emocao e economia sem mexer na lista de peixes.

| Categoria | Peso base | Papel |
|---|---|---|
| Nada | 30 | Frustracao leve |
| Lixo | 10 | Recompensa minima, piada |
| Peixe comum | 35 | Resultado base |
| Peixe incomum | 15 | Pequena vitoria |
| Peixe raro | 6 | Pico de sorte |
| Peixe epico | 2,5 | Grande evento |
| Peixe lendario | 0,8 | Jackpot |
| Bau afundado | 0,5 | Recompensa alternativa |
| Evento Hydra | 0,2 | Sombra no lago / encontro mitico |

A falha critica ("a linha arrebentou") nao e sorteada: ela nasce de perder o
minigame de puxada, entao a culpa e sempre do jogador, nunca do dado.

### O ciclo do dia

Os quatro cenarios deixaram de ser mapas que o jogador compra e escolhe: viraram
as quatro fases de um mesmo dia. **Um dia dura 24 minutos reais** e cada fase
fica 6 minutos no ar, virando sozinha. O relogio vem de `Date.now()`
(`src/world/dayCycle.ts`), entao o mundo continua girando com o jogo fechado -
ninguem volta ao amanhecer so por reabrir a aba.

Cada fase tem um teto de raridade. O peso do que passa do teto **desce para a
maior raridade permitida ali** - por isso de manha tem muito peixe raro e nenhum
lendario. Esperar a fase virar e o que abre raridade nova, nao so multiplicador.

| Fase | Hora | Teto | Valor |
|---|---|---|---|
| Manha na Enseada | 06:00 | Raro | x1 |
| Tarde de Temporal | 12:00 | Lendario | x1,8 |
| Entardecer no Recife | 18:00 | Epico | x1,35 |
| Madrugada na Fossa | 00:00 | Mitico | x2,6 |

Cada fase tem ceu e clima proprios: dia limpo de manha, tempestade com chuva e
raio a tarde, por do sol no fim do dia, noite estrelada de madrugada. A aba
`CICLO DO DIA` no celular mostra qual esta valendo e quanto cada uma muda.

### Pity e streak correction

- **Seca**: cada lancamento sem peixe tira peso de "Nada" e devolve para comum/incomum (ate 22 pontos).
- **Soft pity de raro**: depois de 45 lancamentos sem raro, o peso de raro sobe ate 4x.
- **Soft pity de epico**: depois de 120 lancamentos sem epico, epico e lendario sobem.
- **Escamas lendarias**: raro da 5, epico da 15, bau da 2. Aos 120 fragmentos o
  proximo lancamento e lendario garantido - desde que voce esteja numa regiao que tenha lendario.

## Economia

Duas moedas, herdadas do universo Hydra:

- **Sazoncoins (SZ)** - moeda comum. Vem de peixe vendido, lixo, baus e conquistas.
- **Olhos da Hydra** - moeda de prestigio. Vem de peixe epico+, baus, eventos Hydra
  e conquistas. So o **Altar da Hydra** aceita.

Numeros medidos com `npm run simulate` (40k lancamentos por perfil):

| Perfil | SZ / lancamento | Olhos / 1.000 lancamentos |
|---|---|---|
| Novato, Enseada, sem upgrade | ~63 | ~4 |
| Meio de jogo, Recife | ~190 | ~15 |
| Veterano, Fossa, tudo no maximo | ~1.285 | ~106 |

O simulador roda a engine de verdade, entao qualquer ajuste de peso pode ser
verificado antes de ir pro jogo.

## Estrutura

```
src/
  assets/      capa, fonte VCR OSD Mono e os 175 sprites do kit
  data/        peixes, lixo, regioes, upgrades, reliquias, conquistas, raridades
  engine/      rng, modificadores, pesos + pity, resolucao do lancamento, audio
  state/       tipos, estado inicial, store do jogo, store de configuracoes
  hooks/       maquina de estados da pescaria
  components/  titulo, pausa, cena SVG, sprites, minigames, HUD e paineis
  styles/      css global (paleta vem da regiao via CSS vars)
scripts/
  simulate.ts  simulador de economia
```

O estado vive num store vanilla lido com `useSyncExternalStore` - sem Redux, sem
context, sem prop drilling. A engine e pura: ela devolve o resultado, o store aplica.

## Assets

Os sprites de peixe sao **placeholders procedurais** desenhados em grid de
caracteres dentro de `src/components/FishSprite.tsx` (`1` corpo, `2` detalhe,
`3` olho). Para trocar por PNG de verdade basta reescrever esse componente - o
resto do jogo nao sabe como o peixe e desenhado.

A cena de fundo (`src/components/Scene.tsx`) e SVG puro, com a paleta vindo da
regiao ativa. Trocar por spritesheet depois tambem e isolado ali.

A arte do menu (`src/assets/juggler-cutscene.webp`) e a unica imagem solta fora
do registro de assets. O cenario do menu e montado com os mesmos sprites do jogo
e segue a fase do dia.

## Roadmap curto

- [ ] Aplicar as molduras restantes do kit (barra de forca, tensao, tooltip)
- [ ] Usar as poses `sit` e `back-idle` em cutscenes e no banco da praia
- [ ] Os outros personagens do kit (Bombado, Cesar, Chorinho, Sazon, Madrugaras) como NPCs
- [ ] Trilha e SFX definitivos no lugar do audio procedural
- [ ] Eventos temporarios / temporada
- [ ] Cameo do Hydrinho como NPC no cais
- [ ] Ranking e compartilhamento de captura
