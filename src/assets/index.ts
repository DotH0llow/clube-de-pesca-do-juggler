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
    console.warn(`[assets] nao encontrado: ${path}`);
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
