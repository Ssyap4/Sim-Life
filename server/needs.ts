import { VITAL_NEEDS } from '../src/shared/life';
import type { NeedEffects } from '../src/shared/homeLife';
import type { CharacterId, GameState } from '../src/shared/protocol';

export function gains(before: GameState, after: GameState, role: CharacterId): NeedEffects {
  const result: NeedEffects = {};
  for (const key of [...VITAL_NEEDS, 'mood' as const]) {
    const delta = after.characters[role][key] - before.characters[role][key];
    if (delta > .001) result[key] = Math.round(delta * 10) / 10;
  }
  return result;
}
