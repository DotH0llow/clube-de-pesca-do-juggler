import { REGIONS } from '../data/regions';
import type { GameState, Modifiers, RelicId } from '../state/types';

/**
 * Converte upgrades + reliquias + regiao atual em um pacote de modificadores.
 * Toda a engine le daqui, nunca do estado cru.
 */
export function computeModifiers(s: GameState): Modifiers {
  const u = s.upgrades;
  const has = (id: RelicId) => s.relics.includes(id);
  const region = REGIONS[s.region];

  const mods: Modifiers = {
    nothingReduction: u.vara * 1.6,
    luckMultiplier: 1 + u.isca * 0.09,
    fortuneMultiplier: 1 + region.rarityBonus,
    chestMultiplier: 1 + u.olho * 0.5,
    hydraMultiplier: 1 + u.bencao * 0.6,
    valueMultiplier: 1 + u.balde * 0.08,
    reelAssist: u.linha * 0.06,
    pitySpeed: 1,
    eyeBonus: u.bencao * 0.15,
  };

  if (has('radio_pirata')) mods.valueMultiplier += 0.25;
  if (has('vara_leviata')) mods.fortuneMultiplier += 0.35;
  if (has('amuleto_pity')) mods.pitySpeed += 0.6;
  if (has('isca_mistica')) {
    mods.fortuneMultiplier += 0.8;
    mods.hydraMultiplier += 0.8;
  }

  return mods;
}
