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
| `MARCADORES` | referências de jogo: nascimento, limiar da câmera, áreas de ação e as caixas de CHÃO |

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
| Copiar / colar | `Ctrl+C` / `Ctrl+V` |
| Duplicar ao lado | `Ctrl+D` |
| Agrupar / desagrupar | `G` / `Shift+G` |
| Pegar uma peça de um grupo | `Alt` + clique |
| Sair da seleção | `Esc` |

O menu do botão direito tem cadeado, troca de camada, duplicar e apagar.

## Grupos

`G` junta a seleção num grupo; `Shift+G` desmancha. Depois disso, **clicar em
qualquer peça pega o grupo inteiro** — é para isso que ele existe: o cais são
vinte peças, e mover o cais não deveria ser um exercício de laço de seleção.
`Alt` + clique pega uma peça só, sem desmanchar nada.

O grupo é uma **etiqueta**, não um pai. As peças continuam soltas na lista, com
posição própria; quem sabe do grupo é o clique. Um objeto-grupo de verdade teria
caixa própria, e aí passariam a existir duas verdades sobre onde cada peça está.

Grupo de grupo não aninha, **funde**: selecionar peças de dois grupos e apertar
`G` faz um só. A alternativa (aninhar) deixaria "clicar numa peça" com duas
respostas certas e nenhuma forma de saber qual sai.

**Travar** um grupo trava cada peça dele, e peça travada não responde ao clique
na tela — que é a razão de travar. A saída fica na aba `CENA`, numa lista de
grupos com o número de peças e um botão de destravar: sem ela, travar vinte
peças seria uma porta só de ida.

## Copiar e colar

`Ctrl+C` copia a seleção, `Ctrl+V` cola no meio da tela do editor. O **arranjo
relativo** entre as peças é preservado — o que importa ao copiar cinco peças de
cais não é onde cada uma cai, é a distância entre elas.

A cópia guarda os objetos, e não os ids: colar depois de apagar o original
funciona. Ela vive na sessão, então recarregar a página esvazia — uma área de
transferência de uma semana atrás, colada por engano, é pior que uma vazia.

Área de interação **única** (PESCAR, MERCADO, LIMIAR, NASCIMENTO) não cola: duas
caixas de PESCAR na cena é um estado que o jogo não sabe ler.

`Ctrl+D` continua duplicando no lugar, 40 unidades ao lado. São gestos
diferentes: duplicar é "mais uma aqui", colar é "aquilo, ali".

## Seleção múltipla

**Tudo o que o inspetor escreve vale para a seleção inteira**, num passo só do
`Ctrl+Z`: profundidade, opacidade, virar, girar, cor, ligar/desligar, o clipe da
ação. As medidas mostradas e as alças na tela continuam sendo da última peça
clicada — esticar dez peças de tamanhos diferentes de uma vez daria dez
resultados que ninguém pediu.

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

## O chão é uma área

`FORMAS ▾ → CHÃO` cria um trecho de piso. **A linha de cima da caixa é a altura
em que o Juggler anda** — o corpo dela é só volume de seleção, e é por isso que
só a borda superior vem acesa.

Isto era `groundAt`, três linhas de `if` sobre o piso do deck, o topo da areia e
um comprimento de rampa. O mapa começa com três caixas dizendo exatamente a
mesma coisa que aquele `if` dizia:

| caixa | o que é |
| --- | --- |
| `chao-deck` | o tabuado, plano |
| `chao-rampa` | a descida para a praia, com `QUEDA` |
| `chao-praia` | a areia, dali até o fim do mapa |

- **encoste** duas caixas e o piso continua; deixe um vão e não há onde pisar;
- **`QUEDA`** é quanto o piso desce da esquerda para a direita. `0` é plano,
  negativo sobe. É o único campo que uma rampa precisa — não há tipo separado
  para ela;
- **onde duas se sobrepõem vale a mais alta**, então um estrado jogado em cima
  do deck vira degrau em vez de buraco;
- **duplicar e arrastar a borda** é como se corta um trecho em dois.

Apagar todas devolve o chão para o cálculo antigo, que continua no
`layout.ts` como rede de segurança — o Juggler nunca fica sem piso, mesmo com a
cena vazia.

A chuva lê estas caixas: o respingo só cai onde há chão.

## Escolher pose

Nas áreas de `AÇÃO · ANIMAÇÃO` e `AÇÃO · POSE`, a pose se escolhe **olhando para
ela**: uma grade de miniaturas, uma por clipe, que anima quando o cursor passa
por cima. Em `AÇÃO · POSE` abre embaixo a tira com **todos os quadros** do clipe
escolhido — é ali que moram as poses de verdade, porque a pescaria sozinha tem
seis desenhos de corpo inteiro dentro de uma pasta só.

Era um combo com nome de pasta (`sit-right (1 quadro)`) e um campo de número ao
lado. Escolher significava adivinhar, fechar o inspetor, olhar o boneco na cena
e voltar.

No topo fica o **personagem**. A arte era `char/<clipe>` e virou
`char/<personagem>/<clipe>`: sem a pasta do personagem no meio só cabe um elenco
no jogo inteiro, porque dois personagens com uma pose `sit-left` cada
disputariam o mesmo arquivo. Hoje há um só (o Juggler), e com um a barra de
escolha não aparece — escolha de uma opção só é ruído. Ela aparece sozinha
quando a segunda pasta existir.

Clipe novo aparece aqui sozinho: a lista sai do registro que o importador gera,
não de uma relação escrita à mão.

## Linha de costa

`MUNDO` no editor tem quatro blocos para a beirada da praia: **PERFIL**, **ÁGUA
RASA**, **AREIA MOLHADA** e **ESPUMA**. Tudo o que desenha a transição entre
água e areia sai dali, e nada disso é número solto no código — é assim que se
chega num degradê preto de 460 unidades sem ninguém perceber que ele existe.

Como funciona: `src/world/shore.ts` calcula **um** perfil (a superfície da areia
mergulhando) e deriva dele os cinco recortes — massa de areia, bandas de
profundidade, água rasa, areia molhada e espuma. Formas geradas em separado
desalinham no primeiro ajuste de `sandY`, e o desalinho aparece como costura
branca entre as camadas.

Dois detalhes que valem saber antes de mexer:

- as **bandas de profundidade** usam a cor que a *água* tem naquela
  profundidade, e não uma cor escura escolhida à mão. É isso que faz a beirada
  combinar com o mar aberto ao lado dela;
- a **areia molhada** é uma cor por cima do tile (`multiply`), e não uma textura
  nova: o asset de areia original continua aparecendo por baixo.

A **sombra do píer** é camada separada, com opacidade própria — ela existe
porque o cais tapa o sol, e não porque a praia precisa de uma emenda escura.

## Telas

`TELAS` na barra do topo lista **todas as janelas do jogo**, agrupadas por para
que servem: PESCARIA, MERCADO E LOJA, SEQUÊNCIA E PRÊMIO, CELULAR, SISTEMA.

O agrupamento é por utilidade e não por arquivo. As cinco telas da sequência de
pesca ficam juntas mesmo morando em quatro componentes diferentes, porque quem
vai mexer nelas está pensando "a pescaria está feia", e não "o `CatchPopup` está
feio".

`ABRIR` desenha a tela **de verdade** por cima do editor — mesmo componente,
mesmo CSS — com dados de mentira. Antes, ver a tela de ESCAPOU exigia perder um
peixe e ver a ESCADA DE PRÊMIO exigia uma sequência. As telas que leem a partida
(mercado, loja, álbum, conquistas) aparecem com o save de verdade, porque para
elas isso é mais útil do que qualquer invenção.

Cada tela tem largura, altura, deslocamento, escala e o quanto o fundo escurece.
Isso **vale no jogo**, e não só na prévia: a janela lê as mesmas variáveis.

Não há edição peça a peça dentro de cada tela, e isso é escolha: as janelas do
jogo são todas a mesma estrutura (moldura, cabeçalho, corpo), e marcar cada
bloco de cada uma na mão faria o primeiro botão novo nascer de fora do editor.

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
