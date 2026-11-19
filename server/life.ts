import {
  type GameState, type CharacterId,
} from '../src/shared/protocol';
import { VITAL_NEEDS, type VitalNeed } from '../src/shared/life';

/** Slow decay per in-game hour. No drain at all if the entire household is offline. */
const HOURLY_DRAIN: Record<VitalNeed, number> = {
  hunger: 1.8, energy: 1.2, hygiene: 0.85, social: 0.65, fun: 0.9, comfort: 0.45,
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
  for (const role of online) {
    const character = state.characters[role];
    for (const need of VITAL_NEEDS) {
      character[need] = clamp(character[need] - HOURLY_DRAIN[need] * gameMinutes / 60);
    }
    const urgent = VITAL_NEEDS.filter(need => character[need] < 20).length;
    if (urgent) character.mood = clamp(character.mood - urgent * gameMinutes / 60 * 0.8);
  }
  state.revision++;
  return state;
}
