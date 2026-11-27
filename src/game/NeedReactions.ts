import type { Needs } from '../shared/protocol';

// These are visual-only, client-side reactions to the server's real needs.
// They never change a need, interrupt an action or create a game command.
export type NeedReaction = 'yawn' | 'tired' | 'hunger' | 'bladder' | 'hygiene' | 'lowMood';
export type ReactionNeeds = Pick<Needs, 'energy' | 'hunger' | 'bladder' | 'hygiene' | 'mood'>;

export const NEED_REACTION_DURATION = 3.6;

const triggers: readonly { kind: NeedReaction; key: keyof ReactionNeeds; below: number }[] = [
  { kind: 'bladder', key: 'bladder', below: 35 },
  { kind: 'yawn', key: 'energy', below: 50 },
  { kind: 'hunger', key: 'hunger', below: 30 },
  { kind: 'hygiene', key: 'hygiene', below: 24 },
  { kind: 'lowMood', key: 'mood', below: 24 },
];

export function reactionAllowed(needs: ReactionNeeds | null, reaction: NeedReaction): boolean {
  if(reaction==='tired')return !!needs&&Number.isFinite(needs.energy)&&needs.energy<30;
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
  const step=Math.abs(Math.trunc(turn));
  const choice=similar[step%similar.length].kind;
  // Severe fatigue alternates with ordinary yawns without double-weighting energy.
  return choice==='yawn'&&reactionAllowed(needs,'tired')&&Math.floor(step/similar.length)%2===0?'tired':choice;
}

/** Soft entry/exit without snapping the arms back into their resting pose. */
export function needReactionWeight(seconds: number): number {
  if (!Number.isFinite(seconds) || seconds <= 0 || seconds >= NEED_REACTION_DURATION) return 0;
  const fade = Math.max(0, Math.min(1, seconds / 0.62, (NEED_REACTION_DURATION - seconds) / 0.76));
  return fade * fade * (3 - 2 * fade);
}
