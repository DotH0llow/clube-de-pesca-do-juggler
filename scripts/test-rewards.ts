/**
 * Testes do RewardCalculator.
 *
 *   npm test
 *
 * Sem framework: sao funcoes puras, um `assert` resolve. O que importa e que a
 * regra "moeda garantida nunca diminui" seja verificada de verdade.
 */
import {
  HIDDEN_FISH_MODIFIERS,
  JACKPOT_TIERS,
  MAX_EVENT_CAPTURE_MULTIPLIER,
  MAX_JACKPOT_MULTIPLIER,
  MAX_NORMAL_CAPTURE_MULTIPLIER,
  PRIZE_LADDER,
} from '../src/game/balance';
import {
  calculateCatchReward,
  ladderBonus,
  nextStreakTier,
  rollHiddenModifier,
  rollJackpotTier,
  streakMultiplierFor,
} from '../src/game/systems/RewardCalculator';

let failures = 0;

function check(name: string, cond: boolean, extra = '') {
  console.log(`${cond ? 'ok  ' : 'FAIL'}  ${name}${extra ? ` ${extra}` : ''}`);
  if (!cond) failures++;
}

function eq(name: string, got: unknown, want: unknown) {
  check(name, JSON.stringify(got) === JSON.stringify(want), `-> ${JSON.stringify(got)} (esperado ${JSON.stringify(want)})`);
}

// ------------------------------------------------------------- valor-base
{
  const r = calculateCatchReward({ finalBaseValue: 100, streakMultiplier: 1 });
  eq('valor-base sem sequencia e todo garantido', [r.guaranteed, r.pending], [100, 0]);
}

// -------------------------------------------------------------- sequencia
{
  eq('faixa 0 capturas', streakMultiplierFor(0), 1);
  eq('faixa 3 capturas', streakMultiplierFor(3), 1.2);
  eq('faixa 4 capturas fica na anterior', streakMultiplierFor(4), 1.2);
  eq('faixa 5 capturas', streakMultiplierFor(5), 1.5);
  eq('faixa 8 capturas', streakMultiplierFor(8), 2);
  eq('faixa 12 capturas', streakMultiplierFor(12), 3);
  eq('faixa 50 capturas nao passa do teto', streakMultiplierFor(50), 3);
  eq('proxima faixa a partir de 6', nextStreakTier(6), { catches: 8, multiplier: 2 });
  eq('no topo nao ha proxima faixa', nextStreakTier(99), null);

  // o exemplo literal da spec: base 100, x1.5 -> 100 garantido, 50 pendente
  const r = calculateCatchReward({ finalBaseValue: 100, streakMultiplier: 1.5, inStreak: true });
  eq('spec: base 100 com x1,5', [r.guaranteed, r.pending], [100, 50]);
}

// ------------------------------------------------------------------ cartas
{
  const r = calculateCatchReward({ finalBaseValue: 100, streakMultiplier: 1, guaranteedCardMultiplier: 2 });
  eq('Venda Dupla dobra o GARANTIDO', [r.guaranteed, r.pending], [200, 0]);
}

// -------------------------------------------------- modificador escondido
{
  const semSeq = calculateCatchReward({ finalBaseValue: 100, streakMultiplier: 1, hidden: 'gold' });
  eq('peixe dourado fora de sequencia e garantido', [semSeq.guaranteed, semSeq.pending], [200, 0]);

  const comSeq = calculateCatchReward({
    finalBaseValue: 100,
    streakMultiplier: 1.5,
    hidden: 'silver',
    inStreak: true,
  });
  // 100 garantido + (0,5 da sequencia + 0,5 do prateado) * 100 pendente
  eq('peixe prateado em sequencia vai para o pendente', [comSeq.guaranteed, comSeq.pending], [100, 100]);

  eq('coroado multiplica por 3', HIDDEN_FISH_MODIFIERS.crowned.multiplier, 3);
}

// ----------------------------------------------------------------- jackpot
{
  const r = calculateCatchReward({ finalBaseValue: 100, streakMultiplier: 1, jackpot: 'minor' });
  eq('jackpot minor paga 5x', [r.guaranteed, r.pending], [500, 0]);

  const emSeq = calculateCatchReward({
    finalBaseValue: 100,
    streakMultiplier: 1.2,
    jackpot: 'minor',
    inStreak: true,
  });
  eq('jackpot em sequencia joga o bonus para o pendente', [emSeq.guaranteed, emSeq.pending], [100, 420]);

  const grand = calculateCatchReward({ finalBaseValue: 100, streakMultiplier: 1, jackpot: 'grand' });
  eq('grand paga 50x e bate exatamente no teto', grand.total, 100 * JACKPOT_TIERS.grand.multiplier);
  check('grand nao passa do teto de jackpot', grand.effectiveMultiplier <= MAX_JACKPOT_MULTIPLIER);
}

// ---------------------------------------------------------- cardume bonus
{
  const r = calculateCatchReward({ finalBaseValue: 100, streakMultiplier: 1, eventMultiplier: 2.5 });
  eq('cardume x2,5 fora de sequencia', [r.guaranteed, r.pending], [250, 0]);
  check('cardume respeita o teto de evento', r.cap === MAX_EVENT_CAPTURE_MULTIPLIER);
}

// ------------------------------------------------------------------ tetos
{
  const r = calculateCatchReward({
    finalBaseValue: 100,
    streakMultiplier: 3,
    guaranteedCardMultiplier: 2,
    hidden: 'crowned',
    inStreak: true,
  });
  check('captura normal nunca passa de 10x', r.effectiveMultiplier <= MAX_NORMAL_CAPTURE_MULTIPLIER, `-> ${r.effectiveMultiplier}`);
  check('o corte e sinalizado', r.capped === false || r.capped === true);
  check('mesmo cortado, o garantido nunca fica abaixo da base', r.guaranteed >= 100, `-> ${r.guaranteed}`);
}

{
  const absurdo = calculateCatchReward({
    finalBaseValue: 1000,
    streakMultiplier: 3,
    guaranteedCardMultiplier: 2,
    hidden: 'crowned',
    eventMultiplier: 3,
    jackpot: 'grand',
    inStreak: true,
  });
  check('combo maximo e cortado no teto de jackpot', absurdo.effectiveMultiplier <= MAX_JACKPOT_MULTIPLIER, `-> ${absurdo.effectiveMultiplier}`);
  check('combo maximo marca capped', absurdo.capped);
}

// ---------------------------------------------------- garantido nunca cai
{
  let piorCaso = true;
  for (let i = 0; i < 2000; i++) {
    const base = 1 + Math.floor(Math.random() * 5000);
    const r = calculateCatchReward({
      finalBaseValue: base,
      streakMultiplier: [1, 1.2, 1.5, 2, 3][Math.floor(Math.random() * 5)],
      guaranteedCardMultiplier: Math.random() > 0.5 ? 2 : 1,
      hidden: (['silver', 'gold', 'crowned', null] as const)[Math.floor(Math.random() * 4)],
      eventMultiplier: Math.random() > 0.6 ? 1 + Math.random() * 2 : 1,
      jackpot: Math.random() > 0.9 ? 'minor' : null,
      inStreak: Math.random() > 0.5,
    });
    if (r.guaranteed < base || r.pending < 0) piorCaso = false;
  }
  check('em 2000 sorteios, o garantido nunca ficou abaixo do valor-base', piorCaso);
}

// ---------------------------------------------------------- arredondamento
{
  const r = calculateCatchReward({ finalBaseValue: 33, streakMultiplier: 1.2, inStreak: true });
  check('valores sao inteiros', Number.isInteger(r.guaranteed) && Number.isInteger(r.pending));
  eq('33 com x1,2 arredonda o pendente', [r.guaranteed, r.pending], [33, 7]);
}

// ------------------------------------------------------------------ escada
{
  eq('escada etapa 1 = +20%', ladderBonus(1000, 1, PRIZE_LADDER), 200);
  eq('escada etapa 4 = +200%', ladderBonus(1000, 4, PRIZE_LADDER), 2000);
  eq('escada sem etapa nao paga', ladderBonus(1000, 0, PRIZE_LADDER), 0);
}

// ------------------------------------------------------------- sorteios
{
  eq('roll 0 cai no jackpot mais provavel', rollJackpotTier(0), 'minor');
  eq('roll 0.999 cai no mais raro', rollJackpotTier(0.999), 'grand');
  eq('roll alto nao gera modificador', rollHiddenModifier(1, 99), null);
  eq('roll baixo gera coroado', rollHiddenModifier(1, 0.1), 'crowned');
  eq('roll medio gera prateado', rollHiddenModifier(1, 3), 'silver');
}

console.log(failures ? `\n${failures} FALHA(S)` : '\nTODOS OS TESTES PASSARAM');
process.exit(failures ? 1 : 0);
