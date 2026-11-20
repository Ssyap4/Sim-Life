import type { CharacterId, GameState } from '../src/shared/protocol';
import { SLEEP_ENERGY_GAIN_PER_GAME_MINUTE, sleepTarget, type SleepMode } from '../src/shared/timeControl';

/** Called after normal needs decay, in the same authoritative clock transaction. */
export function recoverSleep(state: GameState, minutes: number,
  sleepers: ReadonlyMap<CharacterId, SleepMode>): CharacterId[] {
  const completed: CharacterId[] = [];
  for (const [role, mode] of sleepers) {
    const resident = state.characters[role];
    const goal = sleepTarget(mode);
    resident.energy = Math.min(goal,
      Math.round((resident.energy + SLEEP_ENERGY_GAIN_PER_GAME_MINUTE * minutes) * 100) / 100);
    if (resident.energy >= goal) {
      resident.energy = goal;
      resident.pose = 'idle';
      completed.push(role);
    }
  }
  return completed;
}
