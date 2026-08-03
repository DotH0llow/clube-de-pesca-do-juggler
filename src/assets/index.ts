/**
 * Registro unico de assets.
 *
 * Todo PNG do kit foi recortado (margem transparente e pixel solto), reduzido e
 * convertido para webp em `src/assets/game/<categoria>/<nome>.webp`.
 * O Vite resolve e versiona cada arquivo; aqui so expomos um acesso por nome.
 *
 *   asset('fish/mahi-mahi')   -> URL final do sprite
 */
const FILES = import.meta.glob('./game/**/*.webp', {
  eager: true,
  query: '?url',
  import: 'default',
}) as Record<string, string>;

export type AssetPath = string;

export function asset(path: AssetPath): string {
  const url = FILES[`./game/${path}.webp`];
  if (!url && import.meta.env.DEV) {
    console.warn(`[assets] não encontrado: ${path}`);
  }
  return url ?? '';
}

export function hasAsset(path: AssetPath): boolean {
  return Boolean(FILES[`./game/${path}.webp`]);
}

/** Usado pelos testes e pela tela de creditos. */
export function assetCount(): number {
  return Object.keys(FILES).length;
}

/**
 * Pastas de quadros: qualquer pasta cujos arquivos sejam `00.webp`, `01.webp`,
 * ... e um clipe de animacao. E assim que o editor descobre o que existe sem
 * precisar de lista escrita na mao: solte uma pasta nova em `game/` no padrao
 * e ela aparece sozinha na secao de animacoes.
 */
export interface ClipInfo {
  /** caminho da pasta, ex.: `char/walk-left` */
  path: string;
  /** categoria (primeiro nivel), ex.: `char` */
  group: string;
  /** nome curto da pasta, ex.: `walk-left` */
  name: string;
  /** quantos quadros a pasta tem */
  count: number;
}

export const CLIPS: ClipInfo[] = (() => {
  const byFolder = new Map<string, number>();
  for (const key of Object.keys(FILES)) {
    const m = key.match(/^\.\/game\/(.+)\/(\d+)\.webp$/);
    if (!m) continue;
    byFolder.set(m[1], (byFolder.get(m[1]) ?? 0) + 1);
  }
  return [...byFolder.entries()]
    .map(([path, count]) => {
      const parts = path.split('/');
      return { path, group: parts.length > 1 ? parts[0] : 'geral', name: parts[parts.length - 1], count };
    })
    .sort((a, b) => a.path.localeCompare(b.path));
})();

/** URL de um quadro do clipe. */
export function clipFrame(path: string, i: number): string {
  return asset(`${path}/${String(i).padStart(2, '0')}`);
}
