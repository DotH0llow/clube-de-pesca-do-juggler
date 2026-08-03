import { getFx, type FxSound, type StepId } from '../editor/fx';
import { TRACKS } from './music';
import { getSettings } from '../state/settings';
import { initAudio, playSfx } from './audio';

/**
 * Os sons das mecanicas.
 *
 * Que som toca, em que etapa do lance e em que momento dela nao esta mais
 * escrito no meio do laco de pesca: e a lista `sounds` da configuracao de
 * mecanicas, que a aba MECÂNICAS do editor edita. Aqui so ha o disparo.
 *
 * Duas fontes: o som procedural do motor (`playSfx`) e uma faixa de
 * `src/assets/music`, tocada num `<audio>` proprio para nao brigar com o radio.
 */

const timers = new Set<number>();
const playing = new Map<string, HTMLAudioElement>();

function volumeOf(s: FxSound): number {
  const cfg = getSettings();
  if (cfg.muted) return 0;
  return Math.max(0, Math.min(1, s.volume)) * cfg.master * cfg.sfx;
}

function fire(s: FxSound) {
  if (s.off) return;
  if (s.source === 'sfx') {
    initAudio();
    playSfx(s.sfx);
    return;
  }
  const track = TRACKS.find((t) => t.id === s.track);
  if (!track) return;
  stopSound(s.id);
  const el = new Audio(track.url);
  el.volume = volumeOf(s);
  el.loop = s.loop;
  playing.set(s.id, el);
  void el.play().catch(() => {
    /* o navegador ainda nao liberou o audio: o proximo gesto resolve */
  });
}

export function stopSound(id: string): void {
  const el = playing.get(id);
  if (!el) return;
  el.pause();
  el.currentTime = 0;
  playing.delete(id);
}

/** Para tudo: sair da pescaria nao pode deixar faixa em loop tocando. */
export function stopMechanicAudio(): void {
  for (const t of timers) window.clearTimeout(t);
  timers.clear();
  for (const id of [...playing.keys()]) stopSound(id);
}

/**
 * Dispara os sons de uma etapa.
 *
 * `entrar` toca quando a etapa comeca; `sair`, quando ela termina. O atraso de
 * cada som e respeitado, e sair de uma etapa corta o loop que ela tinha aberto.
 */
export function fireStep(step: StepId, when: 'entrar' | 'sair'): void {
  for (const s of getFx().sounds) {
    if (s.step !== step || s.when !== when || s.off) continue;
    if (s.delayMs <= 0) {
      fire(s);
      continue;
    }
    const t = window.setTimeout(() => {
      timers.delete(t);
      fire(s);
    }, s.delayMs);
    timers.add(t);
  }
  // ao sair da etapa, o que ela deixou em loop para
  if (when === 'sair') {
    for (const s of getFx().sounds) {
      if (s.step === step && s.loop) stopSound(s.id);
    }
  }
}
