# Modo editor

Abre em dois lugares:

* **no jogo** — painel de dev (`F8`) → `ABRIR MODO EDITOR`. O jogo fica parado:
  não dá para andar nem pescar;
* **no menu** — botão `EDITOR DO MENU` na tela de título.

É o mesmo editor nos dois: mesma barra, mesmas camadas, mesma biblioteca,
mesmos atalhos. Muda só a cena que está sendo editada (`mundo` ou `menu`), e o
menu não tem as seções que dependem da pescaria.

## Como a cena funciona

O cenário deixou de ser constante no código e virou **dados**: cada coqueiro,
barril e área de interação é um objeto com posição, tamanho, rotação, camada e
cadeado (`src/editor/scene.ts`). O jogo desenha essa mesma lista, então o que
você move no editor é o que aparece no jogo.

Cada cena fica salva no navegador (`localStorage`, chave
`juggler-fishing/cena/v3`). `RESETAR` volta a cena aberta para a semente de
`src/editor/scene.ts`. Cena da versão anterior é migrada sozinha: as posições
que você já tinha arrumado continuam valendo, e cada objeto ganha camada e
profundidade pela família do sprite.

## Camadas e profundidade são coisas diferentes

Isto aqui é o ponto que mais confunde, então vai separado:

* **camada** é a *gaveta*. Serve para achar, esconder em bloco e travar o
  clique. Não decide quem aparece na frente de quem;
* **profundidade** (0 a 10) é a *ordem de desenho*. É ela que decide.

Dá para ter um barril de `OBJETOS` atrás de um coqueiro de `CENÁRIO`, e é isso
que se quer na maioria das cenas.

### As gavetas

| Camada | O que vive nela |
| --- | --- |
| `BACKGROUND` | o que fecha o horizonte: montanha longe, ilha, neblina da linha do mar |
| `CENÁRIO` | o que fica de pé no mapa: píer, coqueiro, cabana, mercado, barco, mata |
| `OBJETOS` | tralha solta e vida do mar: barril, caixa, vara, coral, alga, cardume |
| `INTERAGÍVEIS` | as caixas verdes de PESCAR e MERCADO |

O céu e as nuvens não são objetos de cena: eles seguem a fase do dia
(`src/components/Sky.tsx`) e trocam sozinhos de manhã, à tarde, no entardecer e
de madrugada.

### Trabalhando em

O painel da esquerda abre em **TODAS**: o clique pega qualquer objeto visível,
de qualquer camada — inclusive as áreas de interação. Escolher uma camada
**trava o clique nela**, que é o que se quer quando o cenário está cheio e você
só mexe numa coisa. Clicar de novo no nome volta para TODAS.

A caixa de seleção ao lado do nome é outra coisa: ela esconde a camada inteira.

Objeto travado não é selecionado nem apagado, nem pelo clique nem pela lista.

### A régua de profundidade

| | |
| --- | --- |
| 0 | horizonte e fundo do mar |
| 1 | vulto submerso |
| 2 | espuma e linha d'água |
| 3 | cenário distante |
| 4 | estacas e estrutura |
| 5 | deck e chão |
| 6 | tralha em cima do deck |
| **7** | **plano do Juggler** |
| 8 | na frente do Juggler |
| 9 | primeiro plano |
| 10 | colado na tela |

O `7` vem marcado de amarelo no editor porque é a referência: **de 0 a 7 o
objeto passa atrás do Juggler; de 8 para cima, na frente dele.**

As peças fixas do mundo (mar, areia, espuma, deck do píer) entram na mesma
régua, então dá para enfiar um objeto entre elas — um barril em 4 fica atrás do
deck, o mesmo barril em 6 fica em cima.

Empate de número desempata pela ordem da lista; `À FRENTE` e `ATRÁS` no
inspetor mexem nisso.

## Controles

**Selecionar e arrastar é só com o botão esquerdo.** O direito não mexe na
seleção: ele abre o menu de contexto do objeto que está embaixo do cursor.

| Ação | Como |
| --- | --- |
| Selecionar | clique **esquerdo** no objeto |
| Mover | arrastar com o **esquerdo** |
| Redimensionar | alças brancas (canto mantém a proporção) |
| Rotacionar | bolinha azul acima da seleção |
| Desfazer | `Ctrl+Z` |
| Refazer | `Ctrl+Shift+Z` ou `Ctrl+Y` |
| Apagar | `Del` ou menu do botão direito |
| Ajuste fino | setas (`Shift` = 10 px) |
| Navegar o mapa | arrastar o fundo vazio, ou o botão do meio em qualquer lugar |
| Menu | botão direito no objeto |
| Sair da seleção | `Esc` |

O menu do botão direito tem cadeado, troca de camada, duplicar e apagar.

## Desfazer

`Ctrl+Z` volta um passo; `Ctrl+Shift+Z` (ou `Ctrl+Y`) refaz. Um arrasto inteiro
conta como **um** passo — a pilha guarda o estado de antes de você pegar o
objeto, não um estado por quadro do mouse. Esconder ou mostrar uma camada é
visualização, não edição, e por isso fica fora do histórico. O histórico vive na
sessão: fechar o jogo zera a pilha (a cena, essa sim, continua salva).

## Biblioteca

Cada pasta abre e fecha no clique do título. O título também **arrasta**: solte
em cima de outro título para reordenar. Um item arrastado para dentro de outra
pasta muda de pasta — é etiqueta, não arquivo: nada é movido no disco e
`RESETAR` desfaz tudo.

`CRIAR` faz uma pasta sua, para juntar os assets que você usa toda hora sem
caçar no meio de 250 imagens. Pasta criada por você tem um `×` para apagar; os
assets voltam para a pasta de origem.

Para jogar um asset na cena: **duplo clique**, ou **shift + arrastar** até o
ponto onde ele deve entrar.

A organização fica salva em `juggler-fishing/biblioteca/v1`.

## Interagíveis

As áreas de PESCAR e MERCADO são caixas verdes: mover e redimensionar muda de
verdade onde o botão de interagir aparece no jogo. A vara e a boia acompanham a
posição da área de pesca.

## Levar a cena para o código

`EXPORTAR` baixa um JSON com a cena inteira; `IMPORTAR` carrega de volta. É o
caminho para versionar um cenário novo no repositório em vez de deixá-lo só no
navegador.

## Zoom

`Ctrl + roda do mouse` aproxima e afasta a cena, de 60% a 260%. Vale no jogo e
no editor — as alças, o arrasto e as caixas de seleção acompanham o zoom, porque
a conversão tela↔mundo usa a mesma escala. O botão `ZOOM 100%` da barra volta ao
padrão.

Com o zoom acima de 100% o mundo passa da altura da viewport, então ele é
centralizado verticalmente em vez de ficar colado no topo. Esse deslocamento
(`viewY`) atravessa junto com a escala; quem for mexer em coordenada de tela
precisa dos dois.

## Animações

`ANIMAÇÕES` na barra do topo. Duas partes.

### Sequências de quadro

A árvore da esquerda é montada sozinha: **toda pasta em `src/assets/game/` cujos
arquivos sejam `00.webp`, `01.webp`, ...** vira um clipe, agrupado pela
categoria. Soltar uma pasta nova no padrão já a faz aparecer, sem cadastro.

Escolhido o clipe, o painel mostra:

* o clipe rodando, com o passo e o número do quadro;
* a **sequência**: a ordem em que o jogo toca. Cada passo tem `‹` e `›` para
  trocar de lugar, um seletor para apontar outro quadro e `×` para tirar;
* **todos os quadros da pasta** — clicar soma o quadro no fim da sequência;
* **ritmo** (ms por quadro) e **leitura** (`CICLO`, `FÍSICA`, `FASE`).

Isso resolve o problema clássico: a pasta pode ter 4 quadros e a animação boa
usar só 2, ou usar `0,1,2,1` — a arte não muda, a ordem sim.

Fica salvo em `localStorage` (`juggler-fishing/animacoes/v1`). `RESETAR TUDO`
volta para os padrões de `src/editor/anims.ts`.

### Animações por mecânica

`MECÂNICAS` na barra do topo. Escolha a mecânica (hoje, `PESCARIA`) e o **jogo
congela na etapa escolhida** — não é uma maquete, é o mundo de verdade parado no
momento que você quer ver. O Juggler é levado até o ponto de pesca e a câmera
enquadra ali.

`◀ VOLTAR` e `AVANÇAR ▶` andam pelas sete etapas do lance (vara na mão, barra de
força, arremesso, espera, mordida, recolhendo, resultado); os números embaixo
pulam direto para uma delas.

Cada peça que aparece na etapa ganha uma caixa amarela na tela e uma linha na
lista. Clicando nela dá para:

* **arrastar** na área de trabalho;
* **redimensionar** pelas alças (canto mantém a proporção);
* digitar `X`, `Y`, largura, altura, giro e opacidade nos campos.

As pontas de vara aparecem como uma cruz rosa em vez de caixa: são pontos de
referência, e é de onde a linha de pesca sai. Existe uma por pose, porque a vara
aponta para um lado diferente em cada momento do lance.

Embaixo ficam os **tempos da mecânica**: janela do FISGAR, quanto o quadro de
arremesso segura, onde a boia cai e a grossura e a barriga da linha.

Tudo isso vale no jogo no próximo lance — é a mesma configuração que
`src/components/World.tsx` e `src/hooks/useFishingLoop.ts` leem. Fica salvo em
`juggler-fishing/mecanicas/v1`; `RESETAR` volta para `src/editor/fx.ts`.

### A linha de pesca não é sprite

Ela é desenhada (um `path` de SVG) da ponta da vara até a boia, com uma barriga
que some quando o peixe está sendo recolhido. Era um PNG de tamanho fixo largado
perto da água, que nunca batia com a direção nem com o comprimento da vara. Agora
os dois extremos são configuração, então alinhar é questão de arrastar a cruz.

## Objetos na cena

O painel `CENA` lista tudo o que existe, agrupado pela camada, com **miniatura**
de cada asset e o número da profundidade à direita.

- o campo de **busca** filtra por nome do sprite, da área ou do id;
- **clique** seleciona;
- **duplo clique** leva a tela até o objeto e o seleciona — é o caminho rápido
  quando você sabe o nome mas não onde ele foi parar no mapa.

No menu não há para onde andar (a cena cabe inteira na tela), então lá o duplo
clique só seleciona.

## Cheats de teste (F8)

| Cheat | O que faz |
| --- | --- |
| moedas | `+100.000` em Sazoncoins, Olhos ou nos dois |
| hora do dia | pula direto para uma das quatro fases; `-1H` e `+1H` andam de hora em hora; `HORA REAL` desfaz |
| chuva | `AUTOMÁTICA → LIGADA → DESLIGADA` |
| câmera livre | o Juggler fica plantado e a tela anda sozinha |

**Hora do dia** adianta um desvio em cima do relógio da máquina, como adiantar
um relógio de parede: o dia continua andando sozinho a partir dali. Pular para o
entardecer e esperar leva para a madrugada normalmente.

**Chuva** automática é o comportamento normal (só chove na tarde de temporal);
ligada e desligada mandam nela independente da fase do dia.

**Câmera livre** solta a tela do personagem: `WASD` ou as setas movem, o mouse
encostado na borda empurra, `Shift` acelera e `Esc` devolve o controle. Subir e
descer só tem efeito com o zoom acima de 100%, que é quando o mundo passa da
altura da tela.

Nada disso é salvo: recarregar a página volta tudo ao normal.
