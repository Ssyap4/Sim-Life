import type { CharacterId } from '../shared/protocol';

// Purely visual personality gestures. They never emit commands, move roots,
// change server needs, or pretend to complete a social/pet interaction.
export type ResidentIdleGesture =
  'think' | 'fixHair' | 'lookAround' | 'adjustSleeve' | 'shiftWeight' |
  'stretchNeck' | 'noticePet' | 'noticePartner';

export interface ResidentIdleContext {
  // Relative direction of a nearby visible pet/partner. Null when out of range.
  petYaw: number | null;
  partnerYaw: number | null;
}

export const RESIDENT_IDLE_SECONDS = 3.8;

const vladCycle: readonly ResidentIdleGesture[] = [
  'think', 'lookAround', 'adjustSleeve', 'shiftWeight',
  'stretchNeck', 'think', 'lookAround', 'adjustSleeve',
];

const alinaCycle: readonly ResidentIdleGesture[] = [
  'fixHair', 'lookAround', 'shiftWeight', 'adjustSleeve',
  'stretchNeck', 'fixHair', 'lookAround', 'shiftWeight',
];

export function residentIdleAllowed(gesture: ResidentIdleGesture, context: ResidentIdleContext): boolean {
  if (gesture === 'noticePet') return context.petYaw !== null && Number.isFinite(context.petYaw);
  if (gesture === 'noticePartner') return context.partnerYaw !== null && Number.isFinite(context.partnerYaw);
  return true;
}

/** Distinct habits, with occasional situational glances instead of fake actions. */
export function chooseResidentIdle(id: CharacterId, context: ResidentIdleContext, turn: number): ResidentIdleGesture {
  const slot = Number.isFinite(turn) ? Math.abs(Math.trunc(turn)) : 0;
  if (slot % 5 === 2 && residentIdleAllowed('noticePet', context)) return 'noticePet';
  if (slot % 7 === 4 && residentIdleAllowed('noticePartner', context)) return 'noticePartner';
  const cycle = id === 'vlad' ? vladCycle : alinaCycle;
  return cycle[slot % cycle.length];
}

export function residentIdleWeight(seconds: number): number {
  if (!Number.isFinite(seconds) || seconds <= 0 || seconds >= RESIDENT_IDLE_SECONDS) return 0;
  const fade = Math.max(0, Math.min(1, seconds / 0.58, (RESIDENT_IDLE_SECONDS - seconds) / 0.78));
  return fade * fade * (3 - 2 * fade);
}
