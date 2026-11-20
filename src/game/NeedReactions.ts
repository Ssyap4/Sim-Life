import type { Needs } from '../shared/protocol';

// These are visual-only, client-side reactions to the server's real needs.
// They never change a need, interrupt an action or create a game command.
export type NeedReaction = 'yawn' | 'hunger' | 'bladder' | 'hygiene' | 'lowMood';
export type ReactionNeeds = Pick<Needs, 'energy' | 'hunger' | 'bladder' | 'hygiene' | 'mood'>;

export const NEED_REACTION_DURATION = 3.6;

const triggers: readonly { kind: NeedReaction; key: keyof ReactionNeeds; below: number }[] = [
  { kind: 'bladder', key: 'bladder', below: 35 },
  { kind: 'yawn', key: 'energy', below: 35 },
  { kind: 'hunger', key: 'hunger', below: 35 },
  { kind: 'hygiene', key: 'hygiene', below: 24 },
  { kind: 'lowMood', key: 'mood', below: 24 },
];

export function reactionAllowed(needs: ReactionNeeds | null, reaction: NeedReaction): boolean {
  const trigger = triggers.find(item => item.kind === reaction);
  return !!needs && !!trigger && Number.isFinite(needs[trigger.key]) &&
    needs[trigger.key] < trigger.below;
}

/** Give the most urgent need priority, but vary the gesture if several are close. */
export function pickNeedReaction(needs: ReactionNeeds | null, turn: number): NeedReaction | null {
  if (!needs) return null;
  const eligible = triggers
    .filter(item => reactionAllowed(needs, item.kind))
    .map(item => ({ kind: item.kind, urgency: (item.below - needs[item.key]) / item.below }))
    .sort((a, b) => b.urgency - a.urgency);
  if (!eligible.length) return null;
  const similar = eligible.filter(item => eligible[0].urgency - item.urgency < 0.28);
  return similar[Math.abs(Math.trunc(turn)) % similar.length].kind;
}

/** Soft entry/exit without snapping the arms back into their resting pose. */
export function needReactionWeight(seconds: number): number {
  if (!Number.isFinite(seconds) || seconds <= 0 || seconds >= NEED_REACTION_DURATION) return 0;
  const fade = Math.max(0, Math.min(1, seconds / 0.62, (NEED_REACTION_DURATION - seconds) / 0.76));
  return fade * fade * (3 - 2 * fade);
}
