# Clube de Pesca do Juggler

Jogo casual de pesca em browser, ambientado no universo Hydra. Voce lanca a linha,
fisga o que aparecer, vende por **Sazoncoins**, completa o **Album do Pescador**,
compra upgrades permanentes e, de vez em quando, encontra algo no fundo que
prefere nao ter encontrado.

Estetica: pixel art tropical/oceanica com cara de anos 2000 - agua turquesa,
ilhas ao longe, por do sol, barco ancorado. Nada de fantasia medieval.
Tipografia unica: **VCR OSD Mono**, servida localmente em woff2.

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
| `01_sprites/environment` | icones de familia, reliquias do Altar e a silhueta da Hydra |
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

## Menu e configuracoes

O jogo abre numa **tela de titulo** com a arte do Fundador. Dali sai para
COMECAR/CONTINUAR, COMO JOGAR, CONFIGURACOES e CREDITOS. Durante a pescaria, o
botao MENU (ou `Esc`) abre a **pausa**, que da acesso ao mesmo conjunto de telas
mais VOLTAR AO TITULO.

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

### Teto de raridade por regiao

Cada pesqueiro tem um teto. O peso do que passa do teto **desce para a maior
raridade permitida ali** - por isso a Enseada tem muito peixe raro e nenhum
lendario. Trocar de regiao e o que abre raridade nova, nao so multiplicador.

| Regiao | Teto | Valor | Desbloqueio |
|---|---|---|---|
| Enseada do Coral | Raro | x1 | inicial |
| Recife Neon | Epico | x1,35 | 6.000 SZ |
| Naufragio do Cargueiro | Lendario | x1,8 | 30.000 SZ |
| Fossa da Hydra | Mitico | x2,6 | 12 Olhos da Hydra |

Cada pesqueiro tem ceu e clima proprios: dia limpo na Enseada, por do sol no
Recife, tempestade com chuva e raio no Naufragio, noite estrelada na Fossa.

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

A capa (`src/assets/fundador.webp`, 933x1200, 181 KB) e a unica imagem do projeto.
Tudo o mais e SVG ou CSS.

## Roadmap curto

- [ ] Aplicar as molduras restantes do kit (barra de forca, tensao, tooltip)
- [ ] Trilha e SFX definitivos no lugar do audio procedural
- [ ] Eventos temporarios / temporada
- [ ] Cameo do Hydrinho como NPC no cais
- [ ] Ranking e compartilhamento de captura
