import type { CharacterId } from './protocol';

export type SleepMode = 'full' | 'half';
export interface TimeStatus {
  multiplier: 1 | 1.5 | 2 | 3;
  shiftVotes: CharacterId[];
  sleepers: Partial<Record<CharacterId, SleepMode>>;
}

/** Never speed up an awake online resident without their agreement. */
export function timeMultiplier(
  online: readonly CharacterId[],
  shifts: Partial<Record<CharacterId, unknown>>,
  sleepers: ReadonlyMap<CharacterId, SleepMode>,
  shiftVotes: ReadonlySet<CharacterId>,
): TimeStatus['multiplier'] {
  if (online.length === 0) return 1;
  if (online.every(role => sleepers.has(role))) {
    // The full-rest option has a gentler speed when two sleep modes differ.
    return online.some(role => sleepers.get(role) === 'full') ? 2 : 3;
  }
  if (Object.values(shifts).some(Boolean) && online.every(role => shiftVotes.has(role))) return 1.5;
  return 1;
}

/** Half rest fills to 50%, not 50 additional percentage points. */
export const sleepTarget = (mode: SleepMode) => mode === 'full' ? 100 : 50;
// Net recovery is 13.8 points per in-game hour after normal energy drain.
export const SLEEP_ENERGY_GAIN_PER_GAME_MINUTE = 0.25;
