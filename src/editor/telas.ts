import { useSyncExternalStore } from 'react';

/**
 * AS TELAS DE INTERAÇÃO, em forma de lista.
 *
 * O jogo tem quinze janelas - resultado da pescaria, mercado, celular, saque,
 * escada de prêmio, encerrar o dia, painel de teste - e até agora a única forma
 * de olhar uma delas era PROVOCAR a situação que a abre. Ver a tela de escapou
 * exigia perder um peixe; ver a escada de prêmio exigia uma sequência. Ajustar
 * o tamanho de qualquer uma exigia abrir o CSS e recarregar.
 *
 * Aqui elas viram lista, agrupadas por para que servem, com um botão de abrir
 * e uma geometria editável.
 *
 * ------------------------------------------------------- quem desenha o quê
 *
 * Este arquivo NÃO desenha tela nenhuma - ele só diz qual está aberta. Quem
 * desenha é o `App`, que já tem todos os componentes importados e sabe montar
 * os dados de mentira que cada um precisa. A alternativa seria o editor
 * importar as quinze telas e reconstruir o estado de jogo de cada uma, e aí
 * haveria duas montagens da mesma tela para manter em dia.
 *
 * ------------------------------------------------------------- a geometria
 *
 * Cada tela tem uma caixa: largura, altura, deslocamento e escala. Não é uma
 * lista de peças por tela de propósito - as janelas do jogo são todas a mesma
 * estrutura (moldura, cabeçalho, corpo), e o que muda de uma para outra é o
 * TAMANHO. Um editor de peça a peça exigiria marcar cada bloco de cada tela na
 * mão, e o primeiro botão novo em qualquer uma delas nasceria de fora do
 * editor.
 */

export type GrupoTela = 'pescaria' | 'mercado' | 'cassino' | 'celular' | 'sistema';

export const GRUPOS: { id: GrupoTela; label: string; hint: string }[] = [
  { id: 'pescaria', label: 'PESCARIA', hint: 'a sequência do lance, do arremesso ao resultado' },
  { id: 'mercado', label: 'MERCADO E LOJA', hint: 'onde o peixe vira moeda' },
  { id: 'cassino', label: 'SEQUÊNCIA E PRÊMIO', hint: 'saque, escada, carta e cardume' },
  { id: 'celular', label: 'CELULAR', hint: 'os aplicativos do bolso do Juggler' },
  { id: 'sistema', label: 'SISTEMA', hint: 'dia, ajuda e painel de teste' },
];

export interface Tela {
  id: TelaId;
  label: string;
  grupo: GrupoTela;
  /** o que abre esta tela no jogo de verdade */
  quando: string;
  /** false = a lista mostra, mas não há como abrir sem estado de jogo real */
  previa: boolean;
}

export type TelaId =
  | 'catch'
  | 'catch-falha'
  | 'castbar'
  | 'reel'
  | 'hunt'
  | 'mercado'
  | 'loja'
  | 'cashout'
  | 'escada'
  | 'carta'
  | 'cardume'
  | 'celular'
  | 'album'
  | 'conquistas'
  | 'controles'
  | 'config'
  | 'encerrar'
  | 'diario'
  | 'dev';

export const TELAS: Tela[] = [
  { id: 'castbar', label: 'BARRA DE FORÇA', grupo: 'pescaria', quando: 'segurando o lançamento', previa: true },
  { id: 'hunt', label: 'CAÇADA · MEDIDOR', grupo: 'pescaria', quando: 'guiando o anzol debaixo d’água', previa: true },
  { id: 'reel', label: 'RECOLHIMENTO', grupo: 'pescaria', quando: 'depois de fisgar', previa: true },
  { id: 'catch', label: 'RESULTADO · PEGOU', grupo: 'pescaria', quando: 'o peixe subiu', previa: true },
  { id: 'catch-falha', label: 'RESULTADO · ESCAPOU', grupo: 'pescaria', quando: 'a linha arrebentou', previa: true },

  { id: 'mercado', label: 'MERCADO DE PEIXE', grupo: 'mercado', quando: 'E na barraca da praia', previa: true },
  { id: 'loja', label: 'LOJA DE EQUIPAMENTO', grupo: 'mercado', quando: 'aplicativo do celular', previa: true },

  { id: 'cashout', label: 'SACAR A SEQUÊNCIA', grupo: 'cassino', quando: 'com moedas pendentes', previa: true },
  { id: 'escada', label: 'ESCADA DE PRÊMIO', grupo: 'cassino', quando: 'oferecida depois de uma boa captura', previa: true },
  { id: 'carta', label: 'CARTA DA SORTE', grupo: 'cassino', quando: 'sorteada entre lances', previa: true },
  { id: 'cardume', label: 'RESUMO DO CARDUME', grupo: 'cassino', quando: 'ao fim de um cardume', previa: true },

  { id: 'celular', label: 'CELULAR', grupo: 'celular', quando: 'tecla C', previa: true },
  { id: 'album', label: 'ÁLBUM DE ESPÉCIES', grupo: 'celular', quando: 'aplicativo do celular', previa: true },
  { id: 'conquistas', label: 'CONQUISTAS', grupo: 'celular', quando: 'aplicativo do celular', previa: true },

  { id: 'controles', label: 'COMO JOGAR', grupo: 'sistema', quando: 'tela de título', previa: true },
  { id: 'config', label: 'CONFIGURAÇÕES', grupo: 'sistema', quando: 'tela de título', previa: true },
  { id: 'encerrar', label: 'ENCERRAR O DIA', grupo: 'sistema', quando: 'botão do topo', previa: true },
  { id: 'diario', label: 'BÔNUS DIÁRIO', grupo: 'sistema', quando: 'primeira entrada do dia', previa: true },
  { id: 'dev', label: 'PAINEL DE TESTE', grupo: 'sistema', quando: 'F8', previa: true },
];

export interface TelaCfg {
  /** largura da janela, em px de tela */
  larg: number;
  /** altura da janela, em px de tela */
  alt: number;
  /** deslocamento a partir do centro, em px */
  dx: number;
  dy: number;
  /** multiplicador de tamanho da janela inteira */
  escala: number;
  /** o quanto o fundo atrás dela escurece, de 0 a 1 */
  fundo: number;
}

/**
 * O PADRÃO DE CADA TELA mora aqui, e não na folha de estilo.
 *
 * A regra geral do jogo é uma janela de 560 por 620, e a maioria segue. Três
 * não seguem, e não é descuido: o resultado da pescaria é estreito porque é uma
 * coluna (placa, peixe, números), a carta da sorte é larga porque são três
 * cartas lado a lado, e o bônus diário é pequeno porque tem quatro linhas.
 *
 * Esses números estavam no CSS, cada um na regra da sua janela. Trazê-los para
 * cá é o que permite a seção TELAS mostrar "padrão 420" em vez de um 560 que
 * mentiria - e, mais importante, evita dois lugares dizendo o tamanho da mesma
 * janela.
 */
const GERAL: TelaCfg = { larg: 560, alt: 620, dx: 0, dy: 0, escala: 1, fundo: 0.74 };

const PADROES: Partial<Record<TelaId, Partial<TelaCfg>>> = {
  catch: { larg: 420, alt: 600, fundo: 0.6 },
  'catch-falha': { larg: 420, alt: 600, fundo: 0.6 },
  carta: { larg: 700, alt: 540 },
  diario: { larg: 400, alt: 420 },
};

export function padraoTela(id?: string): TelaCfg {
  return { ...GERAL, ...(PADROES[id as TelaId] ?? {}) };
}

const KEY = 'juggler-fishing/telas/v1';

function load(): Record<string, TelaCfg> {
  if (typeof localStorage === 'undefined') return {};
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Record<string, TelaCfg>) : {};
  } catch {
    return {};
  }
}

let cfgs: Record<string, TelaCfg> = load();
/** qual tela está aberta em cima do editor; `null` = nenhuma */
let aberta: TelaId | null = null;
const listeners = new Set<() => void>();

function notify() {
  try {
    localStorage.setItem(KEY, JSON.stringify(cfgs));
  } catch {
    /* sem espaco: vale so em memoria */
  }
  for (const l of listeners) l();
}

function subscribe(fn: () => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

export function telaCfg(id: string): TelaCfg {
  return { ...padraoTela(id), ...(cfgs[id] ?? {}) };
}

export function setTela(id: string, patch: Partial<TelaCfg>): void {
  cfgs = { ...cfgs, [id]: { ...telaCfg(id), ...patch } };
  notify();
}

export function resetTela(id: string): void {
  const { [id]: _fora, ...resto } = cfgs;
  cfgs = resto;
  notify();
}

export function resetTelas(): void {
  cfgs = {};
  notify();
}

function lerCfgs(): Record<string, TelaCfg> {
  return cfgs;
}

export function useTelas(): Record<string, TelaCfg> {
  return useSyncExternalStore(subscribe, lerCfgs, lerCfgs);
}

// ------------------------------------------------------------ qual está aberta

function lerAberta(): TelaId | null {
  return aberta;
}

export function abrirTela(id: TelaId | null): void {
  aberta = id;
  notify();
}

export function telaAberta(): TelaId | null {
  return aberta;
}

export function useTelaAberta(): TelaId | null {
  return useSyncExternalStore(subscribe, lerAberta, lerAberta);
}

/**
 * As variáveis que a janela lê.
 *
 * Vão no elemento RAIZ de cada tela (o fundo escuro), e não na janela em si:
 * assim `.sheet`, `.catch-card` e qualquer janela futura herdam sem precisar
 * saber que existe um editor.
 */
export function telaVars(id: string): React.CSSProperties {
  const c = telaCfg(id);
  return {
    '--tela-larg': `${Math.round(c.larg)}px`,
    '--tela-alt': `${Math.round(c.alt)}px`,
    '--tela-dx': `${Math.round(c.dx)}px`,
    '--tela-dy': `${Math.round(c.dy)}px`,
    '--tela-esc': String(c.escala),
    '--tela-fundo': String(c.fundo),
  } as React.CSSProperties;
}
