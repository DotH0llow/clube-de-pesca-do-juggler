import { useCallback, useEffect, useRef, useState } from 'react';
import { playCatch, playPerfect, playSfx } from '../engine/audio';
import { biteDelay, escapeLine, resolveCast } from '../engine/fishing';
import type { CastQuality } from '../engine/outcomes';
import { buzz } from '../state/settings';
import { applyCast, getState, type Unlocks } from '../state/store';
import type { CastResult } from '../state/types';

export type Phase = 'idle' | 'power' | 'waiting' | 'bite' | 'reeling' | 'result';

export interface Outcome {
  result: CastResult;
  landed: boolean;
  unlocks: Unlocks;
  escapeText?: string;
}

/** Janela de reacao para fisgar, em ms. */
const BITE_WINDOW = 1100;

/**
 * Maquina de estados da pescaria.
 * idle -> power -> waiting -> bite -> reeling -> result -> idle
 */
export function useFishingLoop(onOutcome?: (o: Outcome) => void) {
  const [phase, setPhase] = useState<Phase>('idle');
  const [pending, setPending] = useState<CastResult | null>(null);
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [biteDeadline, setBiteDeadline] = useState(0);

  const qualityRef = useRef<CastQuality>('bom');
  const pendingRef = useRef<CastResult | null>(null);
  const timerRef = useRef<number | undefined>(undefined);
  const outcomeCb = useRef(onOutcome);
  outcomeCb.current = onOutcome;

  const clearTimer = () => {
    if (timerRef.current !== undefined) {
      clearTimeout(timerRef.current);
      timerRef.current = undefined;
    }
  };

  useEffect(() => clearTimer, []);

  const complete = useCallback((landed: boolean) => {
    clearTimer();
    const result = pendingRef.current;
    if (!result) return;
    const unlocks = applyCast(result, landed, qualityRef.current);

    if (result.fish && landed) {
      playCatch(result.fish.rarity);
      buzz(result.fish.rarity === 'comum' ? 15 : [20, 40, 30]);
    } else if (result.fish) {
      playSfx('fail');
      buzz([30, 60, 30]);
    } else if (result.category === 'bau' && landed) {
      playSfx('chest');
      buzz([15, 30, 15]);
    } else if (result.category === 'evento') {
      playSfx('unlock');
      buzz([25, 50, 25, 50, 25]);
    } else if (result.category === 'lixo') {
      playSfx('coin');
    }

    const o: Outcome = {
      result,
      landed,
      unlocks,
      escapeText: !landed && result.fish ? escapeLine() : undefined,
    };
    setOutcome(o);
    setPhase('result');
    outcomeCb.current?.(o);
  }, []);

  const startCast = useCallback(() => {
    playSfx('cast');
    setOutcome(null);
    setPending(null);
    pendingRef.current = null;
    setPhase('power');
  }, []);

  const lockPower = useCallback(
    (quality: CastQuality) => {
      qualityRef.current = quality;
      playSfx('splash');
      if (quality === 'perfeito') playPerfect();
      const { result } = resolveCast(getState(), quality);
      pendingRef.current = result;
      setPending(result);
      setPhase('waiting');

      clearTimer();
      timerRef.current = window.setTimeout(() => {
        if (result.category === 'nada') {
          complete(true);
          return;
        }
        setBiteDeadline(Date.now() + BITE_WINDOW);
        setPhase('bite');
        playSfx('bite');
        buzz([10, 40, 10]);
        timerRef.current = window.setTimeout(() => complete(false), BITE_WINDOW);
      }, biteDelay());
    },
    [complete],
  );

  const hook = useCallback(() => {
    const result = pendingRef.current;
    if (!result) return;
    clearTimer();
    if (result.difficulty <= 0.06) {
      complete(true);
      return;
    }
    setPhase('reeling');
  }, [complete]);

  const finishReel = useCallback((landed: boolean) => complete(landed), [complete]);

  const dismiss = useCallback(() => {
    clearTimer();
    setPhase('idle');
    setPending(null);
    pendingRef.current = null;
    setOutcome(null);
  }, []);

  /** Cancela tudo (usado ao trocar de regiao ou abrir um painel). */
  const abort = useCallback(() => {
    clearTimer();
    setPhase('idle');
    setPending(null);
    pendingRef.current = null;
  }, []);

  return {
    phase,
    pending,
    outcome,
    biteDeadline,
    startCast,
    lockPower,
    hook,
    finishReel,
    dismiss,
    abort,
  };
}
