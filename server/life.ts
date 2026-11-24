import {
  type GameState, type CharacterId,
} from '../src/shared/protocol';
import { VITAL_NEEDS, type VitalNeed } from '../src/shared/life';
import { activeReward, protectNeeds } from '../src/shared/happiness';
import { syncBudgetPeriod } from '../src/shared/familyBudget';

/** Slow decay per in-game hour. No drain at all if the entire household is offline. */
const HOURLY_DRAIN: Record<VitalNeed, number> = {
  hunger: 1.8, energy: 1.2, hygiene: 0.85, social: 0.65, fun: 0.9, comfort: 0.45, bladder: 6.5,
};
const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n * 100) / 100));

/** A pure, deterministic clock step suitable for server tests and offline-safe persistence. */
export function advanceLife(source: GameState, gameMinutes: number,
  online: readonly CharacterId[]): GameState {
  if (!Number.isSafeInteger(gameMinutes) || gameMinutes <= 0 || gameMinutes > 60 * 24) {
    throw new Error('Invalid life clock step');
  }
  const state = structuredClone(source);
  const total = state.clock.minute + gameMinutes;
  state.clock.day += Math.floor(total / 1440);
  state.clock.minute = total % 1440;
  // Spend caps refresh at the exact start of each ten-day household period,
  // even when nobody opens the Finance app or buys anything that day.
  syncBudgetPeriod(state.savings,state.clock);
  for (const role of online) {
    const character = state.characters[role];
    for (const need of VITAL_NEEDS) {
      const until=activeReward(source,role,need);
      const unlocked=until?Math.max(0,Math.min(gameMinutes,(state.clock.day-1)*1440+state.clock.minute-until)):gameMinutes;
      character[need] = clamp(character[need] - HOURLY_DRAIN[need] * unlocked / 60);
    }
    const urgent = VITAL_NEEDS.filter(need => need !== 'bladder' && character[need] < 20).length;
    if (urgent) character.mood = clamp(character.mood - urgent * gameMinutes / 60 * 0.8);
  }
  const walker=state.world.dogWalker;
  if(walker&&online.includes(walker)&&state.world.places[walker]==='park'){
    const visit=state.world.parkDog??={minutes:0,toilets:0};visit.minutes+=gameMinutes;
    if(visit.toilets<2&&visit.minutes>=(visit.toilets===0?8:45)){
      visit.toilets++;visit.toiletUntil=(state.clock.day-1)*1440+state.clock.minute+3;state.pets.verdell.bladder=100;
    }
  }
  protectNeeds(state);
  state.revision++;
  return state;
}
