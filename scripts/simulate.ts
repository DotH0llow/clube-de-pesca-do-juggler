/**
 * Simulador de economia do Clube de Pesca do Juggler.
 *
 *   npm run simulate            -> 200k lancamentos por perfil
 *   npm run simulate -- 500000  -> numero customizado
 *
 * Roda a engine de verdade (mesmo codigo do jogo), sem UI e sem localStorage.
 * Serve para ajustar os pesos sem mexer no balanceamento no escuro.
 */
import { resolveCast, shardGain } from '../src/engine/fishing';
import { SHARDS_FOR_LEGENDARY } from '../src/engine/outcomes';
import { createInitialState } from '../src/state/defaults';
import type { GameState, OutcomeCategory, Rarity, RegionId, UpgradeId } from '../src/state/types';

interface Profile {
  label: string;
  region: RegionId;
  upgrades: Partial<Record<UpgradeId, number>>;
  /** habilidade do jogador no minigame de puxada, 0 a 1 */
  skill: number;
}

const PROFILES: Profile[] = [
  { label: 'Novato / Enseada', region: 'enseada', upgrades: {}, skill: 0.75 },
  {
    label: 'Meio de jogo / Recife',
    region: 'recife',
    upgrades: { vara: 4, linha: 3, isca: 4, balde: 5, olho: 2 },
    skill: 0.85,
  },
  {
    label: 'Avancado / Naufragio',
    region: 'naufragio',
    upgrades: { vara: 6, linha: 4, isca: 6, balde: 7, olho: 3, bencao: 1 },
    skill: 0.88,
  },
  {
    label: 'Veterano / Fossa',
    region: 'fossa',
    upgrades: { vara: 8, linha: 6, isca: 8, balde: 10, olho: 5, bencao: 5 },
    skill: 0.92,
  },
];

const CASTS = Number(process.argv[2] ?? 200_000);

function baseState(p: Profile): GameState {
  const s = createInitialState();
  s.region = p.region;
  s.unlockedRegions = ['enseada', 'recife', 'naufragio', 'fossa'];
  s.upgrades = { ...s.upgrades, ...p.upgrades };
  return s;
}

function run(p: Profile) {
  const s = baseState(p);
  const cats: Record<string, number> = {};
  const rars: Record<string, number> = {};
  let coins = 0;
  let eyes = 0;
  let landed = 0;
  let firstLegendary = -1;

  for (let i = 0; i < CASTS; i++) {
    const quality = Math.random() < 0.35 ? 'perfeito' : Math.random() < 0.85 ? 'bom' : 'fraco';
    const { result } = resolveCast(s, quality);
    const cat = result.category as OutcomeCategory;
    cats[cat] = (cats[cat] ?? 0) + 1;

    const needsReel = result.difficulty > 0.06;
    const success = !needsReel || Math.random() < p.skill * (1 - result.difficulty * 0.55) + 0.22;

    if (result.fish && success) {
      const r = result.fish.rarity as Rarity;
      rars[r] = (rars[r] ?? 0) + 1;
      if ((r === 'lendario' || r === 'mitico') && firstLegendary < 0) firstLegendary = i;
    }

    if (success || cat === 'lixo') {
      coins += result.value;
      eyes += result.eyes;
      landed++;
    }

    // pity espelhando o que o store faz
    const caught = Boolean(result.fish) && success;
    if (caught && result.fish) {
      const r = result.fish.rarity;
      s.pity.dryStreak = 0;
      s.pity.castsSinceRare = r === 'comum' || r === 'incomum' ? s.pity.castsSinceRare + 1 : 0;
      s.pity.castsSinceEpic =
        r === 'epico' || r === 'lendario' || r === 'mitico' ? 0 : s.pity.castsSinceEpic + 1;
      s.pity.legendaryShards =
        r === 'lendario' || r === 'mitico'
          ? 0
          : Math.min(SHARDS_FOR_LEGENDARY, s.pity.legendaryShards + shardGain(result));
    } else {
      s.pity.dryStreak++;
      s.pity.castsSinceRare++;
      s.pity.castsSinceEpic++;
      if (cat === 'bau' && success) {
        s.pity.dryStreak = 0;
        s.pity.legendaryShards = Math.min(SHARDS_FOR_LEGENDARY, s.pity.legendaryShards + 2);
      }
    }
  }

  const pctOf = (n: number) => `${((n / CASTS) * 100).toFixed(2)}%`;

  console.log(`\n=== ${p.label} (${CASTS.toLocaleString('pt-BR')} lancamentos) ===`);
  console.log('categorias sorteadas:');
  for (const [k, v] of Object.entries(cats).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${k.padEnd(10)} ${pctOf(v).padStart(7)}  (${v})`);
  }
  console.log('raridades efetivamente capturadas:');
  for (const [k, v] of Object.entries(rars).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${k.padEnd(10)} ${pctOf(v).padStart(7)}  (${v})`);
  }
  console.log(`taxa de sucesso: ${((landed / CASTS) * 100).toFixed(1)}%`);
  console.log(`Sazoncoins por lancamento: ${(coins / CASTS).toFixed(1)}`);
  console.log(`Olhos da Hydra por 1.000 lancamentos: ${((eyes / CASTS) * 1000).toFixed(2)}`);
  console.log(
    `primeiro lendario/mitico no lancamento: ${firstLegendary >= 0 ? firstLegendary : 'nao saiu'}`,
  );
}

for (const p of PROFILES) run(p);
