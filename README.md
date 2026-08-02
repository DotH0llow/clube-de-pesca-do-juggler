# Clube de Pesca do Juggler

Jogo casual de pesca em browser, ambientado no universo Hydra. Voce lanca a linha,
fisga o que aparecer, vende por **Sazoncoins**, completa o **Album do Pescador**,
compra upgrades permanentes e, de vez em quando, encontra algo no fundo que
prefere nao ter encontrado.

Estetica: pixel art tropical/oceanica com cara de anos 2000 - agua turquesa,
ilhas de calcario, por do sol neon, barco ancorado. Nada de fantasia medieval.

## Rodando

```bash
npm install
npm run dev       # servidor de desenvolvimento
npm run build     # typecheck + build de producao em dist/
npm run preview   # serve o build
npm run simulate  # simulador de economia (sem UI)
```

Node 18+ recomendado. Nao precisa de backend: o save fica em `localStorage`.

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
  data/        peixes, lixo, regioes, upgrades, reliquias, conquistas, raridades
  engine/      rng, modificadores, tabela de pesos + pity, resolucao do lancamento
  state/       tipos, estado inicial, store com persistencia em localStorage
  hooks/       maquina de estados da pescaria
  components/  cena SVG, sprites, minigames, HUD e paineis
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

## Roadmap curto

- [ ] Sprites finais de peixe e cena
- [ ] Som e musica
- [ ] Eventos temporarios / temporada
- [ ] Cameo do Hydrinho como NPC no cais
- [ ] Ranking e compartilhamento de captura
