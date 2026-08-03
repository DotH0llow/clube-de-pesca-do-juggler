/**
 * Caçador de acento perdido.
 *
 * Varre `src/` atrás de palavra em português escrita sem acento DENTRO de texto
 * que o jogador lê. Ignora comentário (a convenção do repo é comentar sem
 * acento) e ignora id de dado, que não pode mudar sem quebrar save antigo.
 *
 *   node scripts/check-texts.mjs
 *
 * Sai com código 1 quando acha alguma coisa, para travar o commit.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

/** forma errada (sem acento) -> forma certa */
const FIX = {
  nao: 'não', voce: 'você', voces: 'vocês', ate: 'até', so: 'só', ja: 'já',
  tambem: 'também', especie: 'espécie', especies: 'espécies', album: 'álbum',
  lendario: 'lendário', lendaria: 'lendária', lendarios: 'lendários', lendarias: 'lendárias',
  epico: 'épico', epica: 'épica', epicos: 'épicos', mitico: 'mítico', mitica: 'mítica',
  miticos: 'míticos', familia: 'família', familias: 'famílias', regiao: 'região',
  regioes: 'regiões', musica: 'música', musicas: 'músicas', sequencia: 'sequência',
  sequencias: 'sequências', area: 'área', areas: 'áreas', proximo: 'próximo',
  proxima: 'próxima', ultimo: 'último', ultima: 'última', opcao: 'opção', opcoes: 'opções',
  memoria: 'memória', distancia: 'distância', codigo: 'código', numero: 'número',
  mare: 'maré', mares: 'marés', pier: 'píer', agua: 'água', aguas: 'águas', oleo: 'óleo',
  ceu: 'céu', peca: 'peça', pecas: 'peças', preco: 'preço', precos: 'preços',
  lancamento: 'lançamento', lancamentos: 'lançamentos', lancar: 'lançar',
  atencao: 'atenção', posicao: 'posição', duracao: 'duração', colecao: 'coleção',
  nivel: 'nível', niveis: 'níveis', dificil: 'difícil', facil: 'fácil',
  possivel: 'possível', util: 'útil', historia: 'história', premio: 'prêmio',
  premios: 'prêmios', tres: 'três', porem: 'porém', alem: 'além', ninguem: 'ninguém',
  alguem: 'alguém', prestigio: 'prestígio', misterio: 'mistério', silencio: 'silêncio',
  maximo: 'máximo', minimo: 'mínimo', unico: 'único', unica: 'única', publico: 'público',
  magico: 'mágico', basico: 'básico', rapido: 'rápido', mecanica: 'mecânica',
  mecanicas: 'mecânicas', ancora: 'âncora', bencao: 'bênção', manha: 'manhã',
  amanha: 'amanhã', cafe: 'café', sao: 'são', estao: 'estão', vao: 'vão',
  serao: 'serão', experiencia: 'experiência', paciencia: 'paciência',
  referencia: 'referência', diferenca: 'diferença', seguranca: 'segurança',
  confianca: 'confiança', cabeca: 'cabeça', forca: 'força', servico: 'serviço',
  inicio: 'início', edicao: 'edição', versao: 'versão', razao: 'razão',
  pressao: 'pressão', tensao: 'tensão', fisica: 'física', logica: 'lógica',
  automatico: 'automático', descricao: 'descrição', conclusao: 'conclusão',
};

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.tsx?$/.test(name)) out.push(full);
  }
  return out;
}

const TEMPLATE = /`([^`]*)`/gs;
const QUOTED = /(['"])((?:(?!\1)[^\\\n]|\\.)*)\1/g;
const JSX_TEXT = />([^<>]{3,}?)</gs;

const hits = [];
for (const file of walk('src')) {
  const raw = readFileSync(file, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '') // bloco
    .replace(/^\s*\/\/.*$/gm, ''); // linha

  // texto solto de JSX só existe em .tsx; em .ts o par > < é genérico ou comparação
  const rules = file.endsWith('.tsx') ? [TEMPLATE, QUOTED, JSX_TEXT] : [TEMPLATE, QUOTED];
  const chunks = [];
  for (const rx of rules) {
    rx.lastIndex = 0;
    let m;
    while ((m = rx.exec(raw))) chunks.push([m.index, m[m.length - 1]]);
  }

  for (const [at, chunk] of chunks) {
    // tira interpolação; id não tem espaço, então frase precisa ter duas palavras
    const text = chunk.replace(/\$?\{[^{}]*\}/g, ' ');
    if (!/[A-Za-zÀ-ÿ]{3,}\s+[A-Za-zÀ-ÿ]/.test(text)) continue;
    // sobrou pontuação de código: era trecho de programa, não frase de tela
    if (/[;={}()[\]]/.test(text)) continue;
    if (/^[\w\-./#%:\s]*$/.test(text) && !/\s[A-Za-z]{3,}/.test(text)) continue;
    for (const word of text.match(/[A-Za-zÀ-ÿ]+/g) ?? []) {
      const right = FIX[word.toLowerCase()];
      if (!right) continue;
      const line = raw.slice(0, at).split('\n').length;
      hits.push(`${file}:${line}  ${word} -> ${right}   | ${text.trim().slice(0, 80)}`);
    }
  }
}

const unique = [...new Set(hits)];
if (unique.length === 0) {
  console.log('textos ok: nenhum acento faltando em texto de tela.');
  process.exit(0);
}
console.log('acento faltando em texto que o jogador lê:\n');
for (const h of unique) console.log('  ' + h);
console.log(`\n${unique.length} ocorrência(s). Ver docs/textos-do-jogo.md.`);
process.exit(1);
