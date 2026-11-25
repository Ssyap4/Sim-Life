import {sleepHealthMultiplier} from '../src/shared/health';
import {fitnessBonuses} from '../src/shared/fitness';
import { sleepRecoveryMultiplier, furnitureComfort } from '../src/shared/furnitureComfort';
import type { CharacterId, GameState } from '../src/shared/protocol';
import { SLEEP_ENERGY_GAIN_PER_GAME_MINUTE, sleepTarget, type SleepMode } from '../src/shared/timeControl';

/** Called after normal needs decay, in the same authoritative clock transaction. */
export function recoverSleep(state: GameState, minutes: number,
  sleepers: ReadonlyMap<CharacterId, SleepMode>): CharacterId[] {
  const completed: CharacterId[] = [];
  for (const [role, mode] of sleepers) {
    const resident = state.characters[role];
    const goal = sleepTarget(mode);
    const installed=state.furnishing.placed.find(item=>item.id===resident.sleepingOn);
    const grade=installed?furnitureComfort(installed.sku):3;
    const multiplier=installed?sleepRecoveryMultiplier(installed.sku):1;
    resident.energy = Math.min(goal,
      Math.round((resident.energy + SLEEP_ENERGY_GAIN_PER_GAME_MINUTE * minutes * multiplier * fitnessBonuses(state,role).sleepGain * sleepHealthMultiplier(state,role)) * 100) / 100);
    resident.comfort=Math.min(100,Math.round((resident.comfort+minutes*(.025+.013*grade))*100)/100);
    if (resident.energy >= goal) {
      resident.energy = goal;
      resident.pose = 'idle';
      delete resident.sleepingOn;
      delete resident.sleepMode;
      completed.push(role);
    }
  }
  return completed;
}
