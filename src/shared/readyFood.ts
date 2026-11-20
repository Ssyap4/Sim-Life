import { RECIPES, TAKEOUT, type RecipeId, type TakeoutId } from './food';
import { gameMinutes, MINUTES_PER_DAY, type GameClock } from './life';
import type { GameState } from './protocol';

// Food is tracked by batches, not merely by a total quantity: making or buying
// a fresh portion must never renew the expiry of older leftovers.
export type ReadyFoodKind = 'meal' | 'takeout';
export type ReadyFoodStorage = 'fridge' | 'table';
export interface ReadyFoodBatch {
  kind: ReadyFoodKind;
  item: string;
  portions: number;
  storage: ReadyFoodStorage;
  expiresAt: number; // Absolute game minute, not wall-clock time.
}
export const READY_FOOD_SLOTS = 2; // One plated serving uses two fridge cells.
export const TABLE_READY_CAPACITY = 12; // No infinite unrefrigerated buffet.

export type ReadyFoodState = Pick<GameState, 'clock' | 'meals' | 'takeout' | 'readyFood'>;
const owns = (record: object, key: string) => Object.prototype.hasOwnProperty.call(record, key);

export function isReadyFoodBatch(raw: unknown): raw is ReadyFoodBatch {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return false;
  const batch = raw as Partial<ReadyFoodBatch>;
  return (batch.kind === 'meal' && typeof batch.item === 'string' && owns(RECIPES, batch.item) ||
    batch.kind === 'takeout' && typeof batch.item === 'string' && owns(TAKEOUT, batch.item)) &&
    (batch.storage === 'fridge' || batch.storage === 'table') &&
    Number.isSafeInteger(batch.portions) && Number(batch.portions) >= 1 && Number(batch.portions) <= 40 &&
    Number.isSafeInteger(batch.expiresAt) && Number(batch.expiresAt) >= 0;
}

export function readyFoodName(kind: ReadyFoodKind, item: string): string {
  return kind === 'meal' && owns(RECIPES, item) ? RECIPES[item as RecipeId].name
    : kind === 'takeout' && owns(TAKEOUT, item) ? TAKEOUT[item as TakeoutId].name : item;
}

/** In-game shelf life: fresh salads and sushi keep 2 days, other refrigerated meals 3.
 * Unrefrigerated takeaway always has a maximum of 2 days. */
export function readyFoodShelfDays(kind: ReadyFoodKind, item: string, storage: ReadyFoodStorage): 2 | 3 {
  if (storage === 'table') return 2;
  if (kind === 'meal' && (item === 'salad' || item === 'fruitSalad')) return 2;
  if (kind === 'takeout' && item.startsWith('rolls')) return 2;
  return 3;
}

export function addReadyFood(state: ReadyFoodState, kind: ReadyFoodKind, item: string,
  portions: number, storage: ReadyFoodStorage, bornAt = gameMinutes(state.clock)): void {
  if (!Number.isSafeInteger(portions) || portions < 1 || portions > 40 ||
    !(kind === 'meal' ? owns(RECIPES, item) : owns(TAKEOUT, item))) throw new Error('Invalid ready food');
  state.readyFood.push({ kind, item, portions, storage,
    expiresAt: bornAt + readyFoodShelfDays(kind, item, storage) * MINUTES_PER_DAY });
}

/** Older saves only contained totals; give existing portions one fixed, short expiry
 * and persist this migration exactly once so reopening cannot refresh them. */
export function reconcileReadyFood(state: ReadyFoodState): boolean {
  let changed = false;
  if (!Array.isArray(state.readyFood)) { state.readyFood = []; changed = true; }
  const now = gameMinutes(state.clock);
  for (const kind of ['meal', 'takeout'] as const) {
    const stocks = kind === 'meal' ? state.meals : state.takeout;
    for (const [item, count] of Object.entries(stocks)) {
      const batches = state.readyFood.filter(b => b.kind === kind && b.item === item);
      const covered = batches.reduce((sum,b) => sum + b.portions, 0);
      if (covered < count) {
        state.readyFood.push({ kind, item, portions: count - covered, storage: 'fridge',
          expiresAt: now + 2 * MINUTES_PER_DAY });
        changed = true;
      } else if (covered > count) {
        // Manually corrected or old inconsistent saves: remove excess from the
        // newest stock first. Never silently create additional edible portions.
        let extra = covered - count;
        for (const batch of [...batches].sort((a,b) => b.expiresAt - a.expiresAt)) {
          const reduced = Math.min(extra, batch.portions);
          batch.portions -= reduced;
          extra -= reduced;
          changed = true;
          if (!extra) break;
        }
      }
    }
  }
  if (changed) state.readyFood = state.readyFood.filter(b => b.portions > 0);
  return changed;
}

export function expireReadyFood(state: ReadyFoodState): ReadyFoodBatch[] {
  const now = gameMinutes(state.clock);
  const expired: ReadyFoodBatch[] = [];
  const still: ReadyFoodBatch[] = [];
  for (const batch of state.readyFood) {
    if (batch.expiresAt > now) { still.push(batch); continue; }
    expired.push(batch);
    if (batch.kind === 'meal') state.meals[batch.item as RecipeId] =
      Math.max(0, state.meals[batch.item as RecipeId] - batch.portions);
    else state.takeout[batch.item as TakeoutId] =
      Math.max(0, state.takeout[batch.item as TakeoutId] - batch.portions);
  }
  if (expired.length) state.readyFood = still;
  return expired;
}

/** Eat the oldest fresh batch first, across fridge and table. */
export function consumeReadyFood(state: ReadyFoodState, kind: ReadyFoodKind, item: string): boolean {
  reconcileReadyFood(state);
  expireReadyFood(state);
  const batch = state.readyFood.filter(b => b.kind === kind && b.item === item)
    .sort((a,b) => a.expiresAt - b.expiresAt)[0];
  if (!batch) return false;
  batch.portions--;
  if (!batch.portions) state.readyFood.splice(state.readyFood.indexOf(batch), 1);
  if (kind === 'meal') state.meals[item as RecipeId]--;
  else state.takeout[item as TakeoutId]--;
  return true;
}

/** Moving a serving must preserve the original expiry timestamp. */
export function moveReadyFoodToFridge(state: ReadyFoodState, kind: ReadyFoodKind, item: string): boolean {
  reconcileReadyFood(state);
  expireReadyFood(state);
  const batch = state.readyFood.filter(b => b.kind === kind && b.item === item && b.storage === 'table')
    .sort((a,b) => a.expiresAt - b.expiresAt)[0];
  if (!batch) return false;
  batch.portions--;
  state.readyFood.push({ ...batch, portions: 1, storage: 'fridge' });
  if (!batch.portions) state.readyFood.splice(state.readyFood.indexOf(batch), 1);
  return true;
}

/** Throw away exactly one portion from the selected surface, not another batch. */
export function discardReadyFood(state: ReadyFoodState, kind: ReadyFoodKind, item: string,
  storage: ReadyFoodStorage): boolean {
  reconcileReadyFood(state);
  expireReadyFood(state);
  const batch = state.readyFood.filter(b => b.kind === kind && b.item === item && b.storage === storage)
    .sort((a,b) => a.expiresAt - b.expiresAt)[0];
  if (!batch) return false;
  batch.portions--;
  if (!batch.portions) state.readyFood.splice(state.readyFood.indexOf(batch), 1);
  if (kind === 'meal') state.meals[item as RecipeId]--;
  else state.takeout[item as TakeoutId]--;
  return true;
}

export function readyFoodTableUsage(state: { readyFood?: ReadyFoodBatch[] }): number {
  return (state.readyFood ?? []).reduce((used,b) => used + (b.storage === 'table' ? b.portions : 0), 0);
}
export function readyFoodRemaining(expiresAt: number, clock: GameClock): string {
  const minutes = Math.max(0, expiresAt - gameMinutes(clock));
  if (!minutes) return 'срок истёк';
  const hours = Math.ceil(minutes / 60);
  if (hours < 24) return 'осталось ' + hours + ' ч';
  const days = Math.floor(hours / 24), rest = hours % 24;
  return 'осталось ' + days + ' д' + (rest ? ' ' + rest + ' ч' : '');
}
