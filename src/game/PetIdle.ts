import type { PetId } from '../shared/pets';

export type PetIdleGesture = 'greet' | 'sniff' | 'groom' | 'stretch' | 'observe' | 'hungryLook';
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
  if (state.satiety < 25 && state.bowl === 0) return 'hungryLook';
  if (state.energy < 27 && turn % 3 === 0) return 'stretch';
  if (id === 'verdell') {
    if (state.personNearby && state.happiness >= 43 && turn % 3 !== 2) return 'greet';
    return turn % 4 === 0 ? 'stretch' : turn % 4 === 1 ? 'observe' : 'sniff';
  }
  // The cat is independent: grooming and stretching happen often, and
  // nearby people mostly get a curious, quiet glance.
  // Lead with a distinctive, recognizable action so the player sees a cat,
  // not just a walking orange silhouette. Still leave room for variation.
  return turn % 4 === 0 || turn % 4 === 2 ? 'groom'
    : turn % 4 === 1 ? 'stretch' : 'observe';
}

/** Smoothly enters and exits a gesture without a sudden body pop. */
export function petIdleWeight(time: number): number {
  if (!Number.isFinite(time) || time <= 0 || time >= PET_IDLE_SECONDS) return 0;
  const fade = Math.max(0, Math.min(1, time / .48, (PET_IDLE_SECONDS - time) / .65));
  return fade * fade * (3 - 2 * fade);
}
