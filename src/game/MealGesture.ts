import type { CharacterId } from '../shared/protocol';

// Tiny time-based loops keep meals expressive without extra rigs, files or a
// network animation state. Different cadence avoids synchronized clone-like eating.
export interface MealGesture {
  lift: number;
  chew: number;
  settle: number;
  glance: number;
}

function smooth(edge0: number, edge1: number, value: number): number {
  const t = Math.max(0, Math.min(1, (value - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

export function mealGesture(time: number, role: CharacterId): MealGesture {
  const elapsed = Math.max(0, Number.isFinite(time) ? time : 0);
  const cycle = role === 'vlad' ? 2.55 : 2.9;
  const round = Math.floor(elapsed / cycle);
  const phase = (elapsed % cycle) / cycle;
  // After every three mouthfuls, give the character a short natural pause.
  const resting = round % 4 === 3;
  const lift = resting ? 0 : smooth(.09, .31, phase) * (1 - smooth(.43, .60, phase));
  const chew = resting ? 0 : smooth(.47, .63, phase) * (1 - smooth(.89, .98, phase));
  const settle = smooth(0, .12, phase) * (1 - smooth(.87, 1, phase));
  return {
    lift,
    chew,
    settle,
    glance: resting ? .055 : (1 - lift) * .024 * Math.sin(elapsed * 1.8),
  };
}

/** Visual shrink only; food stock and benefits are owned by the server. */
export function mealServingScale(elapsed: number, duration=10): number {
  if (!Number.isFinite(elapsed)) return 1;
  return 1 - .72 * Math.max(0, Math.min(1, elapsed / Math.max(1,duration)));
}
