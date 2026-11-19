import {
  SOCIAL_SPOTS, type CharacterId, type GameState, type SocialKind,
} from '../src/shared/protocol';

export const SOCIAL_TTL_MS = 30_000;
export const SOCIAL_COOLDOWN_MS = 5_000;

export interface SocialOffer {
  id: number;
  from: CharacterId;
  to: CharacterId;
  kind: SocialKind;
  expiresAt: number;
}

export function otherRole(role: CharacterId): CharacterId {
  return role === 'vlad' ? 'alina' : 'vlad';
}

export function applySocial(source: GameState, kind: SocialKind): GameState {
  const next = structuredClone(source);
  const bonus = kind === 'hug' ? 10 : 5;
  for (const role of ['vlad', 'alina'] as const) {
    next.characters[role].mood = Math.min(100, next.characters[role].mood + bonus);
    next.characters[role].pose = 'idle';
    next.characters[role].x = SOCIAL_SPOTS[role].x;
    next.characters[role].z = SOCIAL_SPOTS[role].z;
  }
  next.revision++;
  return next;
}
