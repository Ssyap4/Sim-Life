import type { CharacterId, GameState } from './protocol';
import { dishPickupPoint } from './diningSurface';
import { homeSeat } from './home';

export type DishStation = 'table' | 'yardTable';
export type DirtyDishes = Record<DishStation, number>;
export const EMPTY_DIRTY_DISHES: DirtyDishes = { table: 0, yardTable: 0 };
export const DISH_STATIONS: readonly DishStation[] = ['table', 'yardTable'];

export function validDirtyDishes(value: unknown): value is DirtyDishes {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const dishes = value as Record<string, unknown>;
  return DISH_STATIONS.every(station => Number.isSafeInteger(dishes[station]) &&
    Number(dishes[station]) >= 0);
}

export function dishCount(dishes: DirtyDishes): number {
  return dishes.table + dishes.yardTable;
}

/** The household shares dirty dishes; one completed meal leaves one plate. */
export function addDirtyDish(dishes: DirtyDishes, station: DishStation): void {
  if (dishes[station] < Number.MAX_SAFE_INTEGER) dishes[station]++;
}

/** Order keeps the trip short, with the kitchen sink always last. */
export function dirtyDishStops(dishes: DirtyDishes, role: CharacterId,
  state?:GameState): { x: number; z: number }[] {
  return DISH_STATIONS.filter(station => dishes[station] > 0)
    .map(station => station==='table'&&state?dishPickupPoint(state,role):
      homeSeat(station,role).approach);
}
