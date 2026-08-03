# Animações do Juggler

Como a arte do personagem entra no jogo e por que o importador é do jeito que é.

## De onde vem a arte

Dois pacotes, ambos desenhados olhando para a **esquerda** (o mar aberto fica à
esquerda do mapa; a direita é espelhada no importador):

* `juggler_new_anim/` — poses estáticas (frente, costas, perfis e três-quartos),
  `andando/` com dois quadros, `pulo/` com impulso e aterrissagem, e `sentado/`
  com cinco poses;
* `fishing-left/` — seis quadros da pescaria, um por momento do lance:
  `01_ready`, `02_cast_backswing`, `03_cast_forward`, `04_wait_reel`,
  `05_hook_set`, `06_reel_in`.

## Clipes que o jogo monta

| clipe | quadros | de onde sai |
|---|---|---|
| `side-idle` | 1 | perfil esquerdo parado |
| `walk` | 4 | pé esquerdo → perfil → pé direito → perfil |
| `run` | 4 | a mesma arte da caminhada, 25% mais rápida |
| `jump` | 2 | impulso subindo, aterrissagem descendo |
| `sit` | 1 | perfil sentado |
| `fish` | 6 | um quadro por fase do lance |
| `back-idle` | 1 | vista de costas |

Cada clipe vira duas pastas, `-left` e `-right`; a versão da direita é o espelho
da esquerda, gerado na importação.

### Correr é caminhar acelerado

`RUN_ANIM_SPEEDUP = 1.25` em `src/world/usePlayer.ts`. O clipe de corrida usa
exatamente os mesmos quadros da caminhada, só com o tempo de quadro dividido por
1,25. A velocidade de deslocamento (`RUN_SPEED`) é outra coisa e continua sendo
decisão de jogabilidade — se um dia o deslize dos pés incomodar, é esse número
que se mexe.

### A pescaria não roda em loop

Como a arte tem uma pose por momento do lance, o quadro sai da fase e não do
relógio: `idle` mostra a pose de espera, `power` o movimento para trás, `bite` a
fisgada, e por aí vai. A fase `waiting` passa rápido pelo arremesso
(`CAST_HOLD_MS`) antes de assentar. Enquanto o Juggler está com a vara na mão, a
vara fincada no deck some — a arte já traz uma.

### O pulo segue a física, não o cronômetro

Subindo mostra o impulso, descendo mostra a aterrissagem. Quem decide é o sinal
da velocidade vertical.

## O que o importador resolve

`scripts/import-character.py` existe porque a arte crua não é utilizável direto:

1. **Escala.** Cada PNG foi desenhado numa resolução diferente, então o boneco
   tem tamanho diferente em cada arquivo. A normalização usa a **largura do
   chapéu** nas vistas de perfil (é a única medida que não muda com a pose) e a
   altura do corpo nas vistas de frente e de costas.
2. **Fundo branco.** Os quadros de caminhada e de pescaria vieram com fundo
   chapado. A remoção é por preenchimento a partir da borda, nunca por limiar
   global — o Juggler tem barba branca e flores brancas na camisa.
3. **A vara.** É uma linha fina que atravessa metade do quadro e estragaria
   qualquer medida de âncora. O "corpo" sai de uma erosão da máscara: o que
   sobra é só o volume do personagem.
4. **Alinhamento.** Todo quadro é colado num canvas único com o quadril no mesmo
   x e o pé no mesmo y. Por isso `charFrames.ts` não tem mais tabela de correção
   por quadro: sobrou uma constante (`CHAR_ANCHOR`).

## Rodando de novo

```bash
ANIM_DIR=~/juggler_new_anim FISH_DIR=~/fishing-left python3 scripts/import-character.py
```

O script reescreve `src/assets/game/char/` e `src/world/charFrames.ts`
(canvas, altura do quadro em unidades de mundo, âncora e contagem de quadros).
Requer `pillow`, `numpy` e `scipy`.

## Se a arte mudar de novo

O importador aguenta canvas de tamanhos diferentes, mas ajuda muito se a arte
nova vier com:

* o personagem sempre de perfil olhando para a **esquerda** nos clipes laterais;
* fundo transparente (ou branco chapado, que o script resolve);
* nenhum pixel solto longe do corpo — vira sujeira e bagunça a medição.
