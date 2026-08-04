/**
 * Testa o CAMINHO DE CARREGAMENTO da cena, e nao a semente.
 *
 * A diferenca importa, e foi ela que me escapou: todo teste que rodei ate
 * agora chamava `seedScene()`, que monta a cena do zero e sempre da certo.
 * Quem usa o jogo nao passa por ali - passa pelo `load()`, que le o que esta
 * salvo no navegador e migra. A troca do cais falhava exatamente ali, e o
 * `npm test` continuava verde.
 *
 * A ordem aqui e o teste inteiro: o `localStorage` de mentira e montado ANTES
 * de a cena ser importada, porque o `load()` roda na inicializacao do modulo.
 */
import { pierPieces } from '../src/world/pier';

const guardado: Record<string, string> = {};
(globalThis as unknown as { localStorage: unknown }).localStorage = {
  getItem: (k: string) => guardado[k] ?? null,
  setItem: (k: string, v: string) => {
    guardado[k] = v;
  },
  removeItem: (k: string) => {
    delete guardado[k];
  },
};
(globalThis as unknown as { window: unknown }).window = {
  setTimeout: () => 0,
  clearTimeout: () => undefined,
};

/** Uma peca qualquer, so para conferir que o resto da cena sobrevive. */
const COQUEIRO = {
  id: 'coqueiro-teste',
  layer: 'cenario',
  kind: 'sprite',
  sprite: 'nature/coconut-palm',
  x: 2500,
  y: 100,
  w: 200,
  h: 300,
  rot: 0,
  depth: 3,
  flip: true,
};

/**
 * As duas cenas que existem na natureza, e que precisam migrar igual.
 *
 * A segunda e a que me escapou: quem abriu o jogo na versao intermediaria
 * salvou um cais que JA TINHA pecas `pier25-`, so que as antigas, de baixa
 * resolucao e sem rampa. A checagem de entao perguntava "ha peca 2.5D aqui?" e
 * respondia que sim, entao a migracao nunca rodava para essas maquinas.
 */
const CASOS: { nome: string; save: Record<string, unknown> }[] = [
  {
    nome: 'save com o cais de PERFIL',
    save: { objects: [...pierPieces(), COQUEIRO], hidden: [] },
  },
  {
    nome: 'save da versao INTERMEDIARIA (ja tem pier25, sem rampa)',
    save: {
      objects: [
        // 2.5D antigo: mesmo prefixo, sem rampa
        { ...COQUEIRO, id: 'pier25-deck-1', sprite: 'pier2d/deck' },
        { ...COQUEIRO, id: 'pier25-poste-2', sprite: 'pier2d/poste' },
        // misturado com estrutura de perfil, como estava
        ...pierPieces().slice(0, 12),
        COQUEIRO,
      ],
      hidden: [],
    },
  },
];

async function main() {
  let falhou = false;

  for (const caso of CASOS) {
    guardado['juggler-fishing/cena/v5'] = JSON.stringify({
      mundo: caso.save,
      menu: { objects: [], hidden: [] },
    });

    // reimporta do zero: o `load()` roda na inicializacao do modulo, entao
    // cada caso precisa de um modulo novo
    const cena = await import('../src/editor/scene');
    cena.resetScene();
    const recarregado = cena.recarregarParaTeste();
    const depois = recarregado.objects;

    const perfil = depois.filter((o) => o.id.startsWith('pier-')).length;
    const novo = depois.filter((o) => o.id.startsWith('pier25-')).length;
    const rampa = depois.filter((o) => o.sprite === 'pier2d/deck-rampa').length;
    const coqueiro = depois.find((o) => o.id === 'coqueiro-teste');

    const checa = (nome: string, ok: boolean, valor: unknown) => {
      if (!ok) falhou = true;
      console.log(`  ${ok ? 'ok    ' : 'FALHOU'} ${nome}: ${valor}`);
    };

    console.log(`\n${caso.nome}`);
    checa('pecas de perfil restantes', perfil === 0, perfil);
    checa('pecas 2.5D', novo > 0, novo);
    checa('rampa', rampa === 1, rampa);
    checa('o coqueiro espelhado sobreviveu', coqueiro?.flip === true, String(coqueiro?.flip));
  }

  console.log(falhou ? '\nA MIGRACAO NAO ACONTECEU COMO DEVIA.' : '\nmigracao ok nos dois casos');
  if (falhou) process.exitCode = 1;
}

main();
