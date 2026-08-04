# Como trabalhar neste repositório

## 1. NÃO APAGUE NADA SEM PERGUNTAR ANTES

Esta é a primeira regra porque foi a que já custou caro: uma reescrita do
`scripts/import-character.py` apagou 43 quadros de animação que estavam
versionados, e ninguém percebeu até a arte sumir do editor.

Vale para **arte, clipe, pasta, asset, objeto de cena, parâmetro salvo, texto e
arquivo de configuração**. Antes de remover qualquer um deles:

1. **pergunte ao Leo**, dizendo o que sai, por quê, e o que ocupa o lugar;
2. espere a resposta. Sem resposta, não apague — deixe no lugar e siga o resto
   da tarefa;
3. se a resposta for sim, remova num commit em que dê para ver o que saiu.

**Reescrever também é apagar.** Um script que regera uma pasta inteira a partir
de uma tabela remove tudo o que a tabela não cita. Importador novo acrescenta
(ver `scripts/import-poses.py`); quem reescreve a pasta precisa varrer o que
já existe antes.

**"Consertar" não autoriza apagar.** Trocar uma implementação por outra é
tarefa; levar arte junto no caminho, não.

O contrário também vale: pose apagada **a pedido** fica apagada. Se ela sumiu
porque o Leo pediu, não é para "resgatar" na próxima limpeza.

## 2. Texto acentuado, comentário sem acento

Texto que o jogador lê vai acentuado; comentário, nome de variável e id de dado
ficam sem acento. `npm run textos` verifica, e o `npm run build` roda essa
checagem antes de compilar. Ver `docs/textos-do-jogo.md`.

## 3. Comentário explica a decisão, não o código

O repositório inteiro é escrito assim: o comentário conta o que havia antes, por
que estava errado e o que o número de agora resolve. Comentário que repete o
nome da função não serve.

## 4. Antes de commitar

```
npm run build     # textos + tsc + vite build
npm test          # recompensas e migração de save
```

## 5. Arte de origem fica no repositório

Zip que gerou clipe mora em `arte-de-origem/`. O motivo é o item 1: quando os 43
quadros sumiram, a única cópia estava no histórico do git.
