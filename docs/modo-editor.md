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
