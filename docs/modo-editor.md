# Modo editor

Abre pelo painel de dev (**F8** → `ABRIR MODO EDITOR`). Enquanto ele está
ligado o jogo fica parado: não dá para andar nem pescar.

## Como a cena funciona

O cenário deixou de ser constante no código e virou **dados**: cada coqueiro,
barril e área de interação é um objeto com posição, tamanho, rotação, camada e
cadeado (`src/editor/scene.ts`). O jogo desenha essa mesma lista, então o que
você move no editor é o que aparece no jogo.

A cena fica salva no navegador (`localStorage`). `RESETAR` volta para o layout
original de `src/world/layout.ts`, que continua sendo a semente.

## Camadas

| Camada | O que vive nela |
| --- | --- |
| `BACKGROUND` | fundo do mar, cardume, bolha e detalhe de areia |
| `CENÁRIO` | coqueiro, cabana, mercado, pier, barco e a mata do fim do mapa |
| `OBJETOS` | tralha solta: barril, caixa, corda, balde e a vara |
| `INTERAGÍVEIS` | as caixas verdes de PESCAR e MERCADO |

- A caixa de seleção do painel esconde a camada inteira.
- **Só dá para pegar objeto da camada ativa** (a de fundo amarelo). Clique no
  nome para trocar.
- Objeto travado não é selecionado nem apagado, nem pelo clique nem pela lista.

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
