import { useSyncExternalStore } from 'react';
import { getSettings, onSettingsChange } from '../state/settings';

/**
 * Radio do Juggler.
 *
 * As faixas ficam em `src/assets/music` e sao carregadas sob demanda por um
 * unico `<audio>` - nada entra no bundle de JS. O volume acompanha o barramento
 * de musica das configuracoes, o mesmo da ambiencia procedural.
 *
 * A pasta `music-restaurante/` do repositorio esta guardada de proposito: as
 * faixas existem, mas so entram no jogo quando o restaurante existir.
 */

const FILES = import.meta.glob('../assets/music/*.m4a', {
  eager: true,
  query: '?url',
  import: 'default',
}) as Record<string, string>;

export interface Track {
  id: string;
  title: string;
  artist: string;
  url: string;
}

/** Titulos legiveis para os arquivos que vieram com nome de download. */
const TITLES: Record<string, { title: string; artist: string }> = {
  '311-amber-instrumental': { title: 'AMBER', artist: '311 (INSTRUMENTAL)' },
  'antonio-carlos-jobim-garota-de-ipanema-instrumental': {
    title: 'GAROTA DE IPANEMA',
    artist: 'ANTONIO CARLOS JOBIM',
  },
  'dave-the-diver-ost-seals-and-dolphins': { title: 'SEALS AND DOLPHINS', artist: 'DAVE THE DIVER OST' },
  'flutter-the-grey-room-clark-sims': { title: 'FLUTTER', artist: 'THE GREY ROOM / CLARK SIMS' },
  'island-dream-chris-haugen': { title: 'ISLAND DREAM', artist: 'CHRIS HAUGEN' },
  'vibrant-life': { title: 'VIBRANT LIFE', artist: 'BIBLIOTECA' },
  'you-da-bossa': { title: 'YOU DA BOSSA', artist: 'BIBLIOTECA' },
};

export const TRACKS: Track[] = Object.entries(FILES)
  .map(([path, url]) => {
    const id = path.split('/').pop()!.replace('.m4a', '');
    const meta = TITLES[id] ?? { title: id.replace(/-/g, ' ').toUpperCase(), artist: 'DESCONHECIDO' };
    return { id, url, ...meta };
  })
  .sort((a, b) => a.title.localeCompare(b.title));

// ------------------------------------------------------------------ estado

interface RadioState {
  playing: boolean;
  index: number;
  shuffle: boolean;
}

let audio: HTMLAudioElement | null = null;
let state: RadioState = { playing: false, index: 0, shuffle: true };
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

function volume(): number {
  const s = getSettings();
  return s.muted ? 0 : s.master * s.music;
}

function ensure(): HTMLAudioElement | null {
  if (typeof Audio === 'undefined' || TRACKS.length === 0) return null;
  if (!audio) {
    audio = new Audio();
    audio.preload = 'none';
    audio.volume = volume();
    audio.addEventListener('ended', () => next());
  }
  return audio;
}

onSettingsChange(() => {
  if (audio) audio.volume = volume();
});

export function currentTrack(): Track | null {
  return TRACKS[state.index] ?? null;
}

export function getRadio(): RadioState {
  return state;
}

export function subscribeRadio(fn: () => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

export function useRadio(): RadioState {
  return useSyncExternalStore(subscribeRadio, getRadio, getRadio);
}

export function playIndex(i: number): void {
  const el = ensure();
  if (!el) return;
  state = { ...state, index: ((i % TRACKS.length) + TRACKS.length) % TRACKS.length, playing: true };
  el.src = TRACKS[state.index].url;
  el.volume = volume();
  void el.play().catch(() => {
    state = { ...state, playing: false };
    emit();
  });
  emit();
}

export function toggle(): void {
  const el = ensure();
  if (!el) return;
  if (state.playing) {
    el.pause();
    state = { ...state, playing: false };
    emit();
    return;
  }
  if (!el.src) {
    playIndex(state.shuffle ? Math.floor(Math.random() * TRACKS.length) : state.index);
    return;
  }
  void el.play().catch(() => undefined);
  state = { ...state, playing: true };
  emit();
}

export function next(): void {
  playIndex(state.shuffle ? Math.floor(Math.random() * TRACKS.length) : state.index + 1);
}

export function prev(): void {
  playIndex(state.index - 1);
}

export function setShuffle(v: boolean): void {
  state = { ...state, shuffle: v };
  emit();
}

export function stopRadio(): void {
  audio?.pause();
  state = { ...state, playing: false };
  emit();
}

/**
 * Liga o radio assim que o jogo abre, ja na tela de titulo.
 *
 * Navegador moderno bloqueia audio antes de qualquer gesto do usuario, entao a
 * tentativa direta pode falhar. Quando falha, a gente arma o primeiro clique,
 * toque ou tecla da pagina para ligar - sem pedir nada para o jogador.
 */
let autoStarted = false;
export function autoStartRadio(): void {
  if (autoStarted || TRACKS.length === 0) return;
  autoStarted = true;

  const el = ensure();
  if (!el) return;

  /** Tenta tocar agora. Se o navegador recusar, arma o proximo gesto. */
  const attempt = () => {
    const s = getSettings();
    if (s.muted || s.music <= 0) {
      arm();
      return;
    }
    if (state.playing) return;
    if (!el.src) {
      state = {
        ...state,
        index: state.shuffle ? Math.floor(Math.random() * TRACKS.length) : state.index,
      };
      el.src = TRACKS[state.index].url;
    }
    el.volume = volume();
    el.play().then(
      () => {
        state = { ...state, playing: true };
        emit();
      },
      () => {
        // autoplay bloqueado (ou faixa ainda nao liberada): espera um gesto
        state = { ...state, playing: false };
        emit();
        arm();
      },
    );
  };

  let armed = false;
  const arm = () => {
    if (armed) return;
    armed = true;
    const once = () => {
      armed = false;
      window.removeEventListener('pointerdown', once);
      window.removeEventListener('keydown', once);
      window.removeEventListener('touchstart', once);
      attempt();
    };
    window.addEventListener('pointerdown', once);
    window.addEventListener('keydown', once);
    window.addEventListener('touchstart', once);
  };

  attempt();
}

/** Faixas do restaurante: existem no repo, mas ainda nao no jogo. */
export const RESTAURANT_TRACKS = [
  'ALEX MALHEIROS - PAPAIA',
  'CIRCUIT GROOVE',
  'CUBAN CRUNCH',
  'HOLIZNACC0 - BUSTED JAZZ',
  'HOLIZNACC0 - MAKE FUNK',
  'LATIN LIFE',
];
