import type { PetId } from '../shared/pets';

export type PetIdleGesture = 'greet' | 'sniff' | 'groom' | 'stretch' | 'observe' | 'hungryLook' | 'playBow' | 'pawWave' | 'slowBlink' | 'pounce' | 'beg' | 'happyHop' | 'nuzzle';
export interface PetIdleContext {
  satiety: number;
  energy: number;
  happiness: number;
  bond: number;
  bowl: number;
  personNearby: boolean;
}

export const PET_IDLE_SECONDS = 3.4;

/** Only picks a client-side animation. Never drives navigation, needs, or food. */
export function choosePetIdle(id: PetId, state: PetIdleContext, turn: number): PetIdleGesture {
  if (state.satiety < 25 && state.bowl === 0)
    return turn % 3 === 2 ? (id === 'simba' ? 'groom' : 'sniff') : 'hungryLook';
  if (state.energy < 27 && turn % 3 === 0) return 'stretch';
  if (id === 'verdell') {
    if (state.personNearby && state.bond>=55 && state.happiness>=70 &&
      state.energy>=35 && state.satiety>=25 && turn%6===4)return 'happyHop';
    // Verdell's signature two-paw 'bunny' request: only near family,
    // never during urgent hunger, exhaustion or an authoritative routine.
    if (state.personNearby && state.bond >= 38 && state.energy >= 32 &&
      state.satiety >= 25 && turn % 4 === 2) return 'beg';
    if (state.personNearby && state.happiness >= 43 && turn % 3 !== 2) return 'greet';
    return turn % 6 === 0 ? 'playBow' : turn % 6 === 1 ? 'observe'
      : turn % 6 === 2 ? 'pawWave' : turn % 6 === 3 ? 'stretch'
      : turn % 6 === 4 ? 'sniff' : 'playBow';
  }
  if (state.personNearby && state.bond>=48 && state.happiness>=54 &&
    state.energy>=25 && state.satiety>=25 && turn%5===1)return 'nuzzle';
  // The cat is independent: grooming and stretching happen often, and
  // nearby people mostly get a curious, quiet glance.
  // Lead with a distinctive, recognizable action so the player sees a cat,
  // not just a walking orange silhouette. Still leave room for variation.
  return turn % 6 === 0 ? 'groom' : turn % 6 === 1 ? 'stretch'
    : turn % 6 === 2 ? 'slowBlink' : turn % 6 === 3 ? 'observe'
    : turn % 6 === 4 ? 'pounce' : 'groom';
}

/** Smoothly enters and exits a gesture without a sudden body pop. */
export function petIdleWeight(time: number): number {
  if (!Number.isFinite(time) || time <= 0 || time >= PET_IDLE_SECONDS) return 0;
  const fade = Math.max(0, Math.min(1, time / .48, (PET_IDLE_SECONDS - time) / .65));
  return fade * fade * (3 - 2 * fade);
}
