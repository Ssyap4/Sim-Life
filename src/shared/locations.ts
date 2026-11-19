import type { CharacterId } from './protocol';
import type { BasketLine, MarketCategory } from './market';
import { HOME_DECOR, HOME_FLOOR, HOME_FURNITURE, HOME_PLACEMENTS, HOME_YARD, HOME_YARD_OBSTACLES } from './home';

export const PLACES = {
  home: { name: 'Дом', icon: '⌂', detail: 'Дом и семейный двор' },
  street: { name: 'Тихий квартал', icon: '▥', detail: 'Тротуар, скамья и входы в соседние места' },
  market: { name: 'Супермаркет', icon: '🛒', detail: 'Отделы продуктов и касса самообслуживания' },
  cafe: { name: 'Кафе «Тёплый угол»', icon: '☕', detail: 'Заказ, выдача и столики для двоих' },
  park: { name: 'Сосновый парк', icon: '🌿', detail: 'Прогулки, отдых и Верделл' },
} as const;
export type PlaceId = keyof typeof PLACES;
export type Point = { x: number; z: number };
export const WORLD_FLOOR = { minX: -5.62, maxX: 5.62, minZ: -4.62, maxZ: 4.62 };
export const floorFor = (place: PlaceId) => place === 'home' ? HOME_FLOOR : WORLD_FLOOR;
export function isPlace(value: unknown): value is PlaceId {
  return typeof value === 'string' && Object.hasOwn(PLACES, value);
}
export function spawn(place: PlaceId, role: CharacterId): Point {
  if (place === 'home') return role === 'vlad' ? { x: .5, z: 3.5 } : { x: 1.12, z: 3.35 };
  return { x: role === 'vlad' ? .5 : 1.65, z: 4.10 };
}
export function meeting(place: PlaceId, role: CharacterId): Point {
  return { x: role === 'vlad' ? -0.42 : 0.42, z: place === 'home' ? 2.38 : 3.35 };
}

type SiteAction =
  | { kind: 'door'; destination: PlaceId }
  | { kind: 'shelf'; categories: MarketCategory[] }
  | { kind: 'checkout' | 'terminal' | 'pickup' | 'dine' | 'rest' | 'exercise' | 'dog' | 'fridge' | 'cupboard' | 'parcel' | 'unpack' };

export interface Station {
  id: string;
  name: string;
  center: Point;
  approach: Point;
  width: number;
  depth: number;
  action: SiteAction;
  blocks?: boolean;
}
function site(id: string, name: string, x: number, z: number, width: number, depth: number,
  action: SiteAction, options: { approach?: Point; blocks?: boolean } = {}): Station {
  return { id, name, center: { x, z }, approach: options.approach ?? { x, z: z + depth / 2 + 0.52 },
    width, depth, action, blocks: options.blocks ?? true };
}
const door = (id: string, name: string, destination: PlaceId, x: number, z: number, front = false) =>
  site(id, name, x, z, 1.22, 0.22, { kind: 'door', destination },
    { blocks: !front, approach: front ? { x, z: z - 0.70 } : undefined });
const shelf = (id: string, name: string, x: number, z: number, categories: MarketCategory[]) =>
  site(id, name, x, z, 1.86, 0.68, { kind: 'shelf', categories });

export const STATIONS: Record<PlaceId, readonly Station[]> = {
  home: [
    site('fridge', 'Холодильник', 5.24, -4.25, 0.94, 0.88, { kind: 'fridge' }, { approach: { x: 5.24, z: -3.32 } }),
    site('cupboard', 'Кухонные полки', 0.71, -4.47, 0.70, 0.46, { kind: 'cupboard' }, { blocks: false, approach: { x: 0.71, z: -3.08 } }),
    site('parcel', 'Заказы у двери', 1.48, 4.59, 0.51, 0.38, { kind: 'parcel' }, { approach: { x: 1.48, z: 3.92 } }),
    site('shopping-table', 'Покупки на столе', HOME_PLACEMENTS.table.x, HOME_PLACEMENTS.table.z,
      0.20, 0.20, { kind: 'unpack' }, { blocks: false,
        approach: { x: HOME_PLACEMENTS.table.x, z: HOME_PLACEMENTS.table.z + 1.30 } }),
    door('home-exit', 'На улицу', 'street', HOME_YARD.gate.x, HOME_YARD.gate.z, true),
  ],
  street: [
    door('street-home', 'Домой', 'home', -3.88, -3.95),
    door('street-market', 'Супермаркет', 'market', 0.11, -3.95),
    door('street-cafe', 'Кафе', 'cafe', 4.10, -3.95),
    door('street-park', 'В парк', 'park', 4.55, 1.39),
    site('street-bench', 'Скамья у клумбы', -3.90, 0.28, 1.74, 0.63, { kind: 'rest' }),
  ],
  market: [
    shelf('dairy', 'Молочное', -4.37, -3.63, ['dairy']),
    shelf('bakery', 'Хлеб и выпечка', 0, -3.63, ['bakery']),
    shelf('meat', 'Мясо', 4.39, -3.63, ['meat']),
    shelf('produce', 'Овощи и фрукты', -4.37, -0.92, ['vegetables', 'fruit']),
    shelf('pantry', 'Бакалея', 0, -0.92, ['pantry']),
    shelf('drinks', 'Напитки', 4.39, -0.92, []),
    shelf('ready', 'Готовая еда', -4.37, 1.79, ['takeout']),
    shelf('pet-shelf', 'Для питомцев', 4.39, 1.79, ['pets']),
    site('checkout', 'Касса самообслуживания', 0, 1.83, 1.50, 0.72, { kind: 'checkout' }),
    door('market-exit', 'Выход на улицу', 'street', -2.75, 4.60, true),
  ],
  cafe: [
    site('terminal', 'Терминал заказов', -3.71, -2.51, 1.25, 0.84, { kind: 'terminal' }),
    site('pickup', 'Выдача заказов', 3.44, -2.51, 1.65, 0.84, { kind: 'pickup' }),
    site('cafe-left', 'Столик у окна', -2.93, 0.63, 1.76, 1.42, { kind: 'dine' }),
    site('cafe-right', 'Столик у растений', 2.93, 0.63, 1.76, 1.42, { kind: 'dine' }),
    door('cafe-exit', 'Выход на улицу', 'street', -2.75, 4.60, true),
  ],
  park: [
    site('park-bench', 'Скамья под соснами', 3.69, -1.23, 1.69, 0.65, { kind: 'rest' }),
    site('park-path', 'Прогулочная дорожка', -3.78, -0.55, 0.67, 0.65, { kind: 'exercise' }, { blocks: false }),
    site('park-dog', 'Площадка для Верделла', 3.82, 2.12, 0.78, 0.65, { kind: 'dog' }, { blocks: false }),
    door('park-exit', 'Выход на улицу', 'street', -2.75, 4.60, true),
  ],
};
export const stationById = (place: PlaceId, id: unknown) => STATIONS[place].find(station => station.id === id);
export function approachFor(station: Station, role: CharacterId): Point {
  if (station.action.kind !== 'dine' && station.action.kind !== 'rest') return station.approach;
  return { x: station.approach.x + (role === 'vlad' ? -0.40 : 0.40), z: station.approach.z };
}
export function placeObstacles(place: PlaceId) {
  const obstacles = STATIONS[place].flatMap(({ blocks, center, width, depth }) => blocks ? [{
    minX: center.x - width / 2 - 0.26, maxX: center.x + width / 2 + 0.26,
    minZ: center.z - depth / 2 - 0.26, maxZ: center.z + depth / 2 + 0.26,
  }] : []);
  if (place === 'home') obstacles.push(...HOME_DECOR, ...HOME_YARD_OBSTACLES, ...Object.values(HOME_FURNITURE).map(bounds => ({
    minX: bounds.minX - .27, maxX: bounds.maxX + .27, minZ: bounds.minZ - .27, maxZ: bounds.maxZ + .27,
  })));
  if (place === 'park') obstacles.push({ minX: -1.8, maxX: 1.6, minZ: -3.32, maxZ: -0.58 });
  if (place === 'cafe') obstacles.push({ minX: -2.57, maxX: 2.57, minZ: -4.62, maxZ: -3.7 });
  if (place === 'street') obstacles.push({ minX: -5.62, maxX: 5.62, minZ: -4.62, maxZ: -4.05 });
  return obstacles;
}

export const CAFE_MENU = {
  cappuccino: { name: 'Капучино', price: 260, hunger: 5, energy: 14, mood: 6 },
  tea: { name: 'Чай с ягодами', price: 190, hunger: 2, energy: 8, mood: 8 },
  brioche: { name: 'Бриошь с сыром', price: 380, hunger: 29, energy: 3, mood: 10 },
  pastry: { name: 'Ягодный тарт', price: 410, hunger: 20, energy: 4, mood: 14 },
} as const;
export type CafeItem = keyof typeof CAFE_MENU;
export function isCafeItem(value: unknown): value is CafeItem {
  return typeof value === 'string' && Object.hasOwn(CAFE_MENU, value);
}
export const DELIVERY_FEE = 149;
export const DELIVERY_MINUTES = 18;
export const CAFE_MINUTES = 2;
export interface Delivery { id: string; role: CharacterId; lines: BasketLine[]; cost: number; readyAt: number }
export interface CafeOrder { item: CafeItem; readyAt: number; pickedUp: boolean }
export interface WorldState {
  places: Record<CharacterId, PlaceId>;
  sequence: Record<CharacterId, number>;
  bags: Record<CharacterId, number>;
  tableBags: number;
  deliveries: Delivery[];
  cafe: Partial<Record<CharacterId, CafeOrder>>;
  dogWalker: CharacterId | null;
}
export function initialWorld(): WorldState {
  return { places: { vlad: 'home', alina: 'home' }, sequence: { vlad: 0, alina: 0 },
    bags: { vlad: 0, alina: 0 }, tableBags: 0, deliveries: [], cafe: {}, dogWalker: null };
}
export type LocalActivity = 'rest' | 'exercise' | 'dine' | 'dog' | 'unpack';
export type WorldCommand =
  | { type: 'close_storage' }
  | { type: 'travel'; place: PlaceId; via?: string; dog?: boolean }
  | { type: 'walk'; place: PlaceId; x: number; z: number }
  | { type: 'approach'; place: PlaceId; station: string }
  | { type: 'store_pay'; lines: BasketLine[]; sequence: number }
  | { type: 'delivery_order'; lines: BasketLine[]; sequence: number }
  | { type: 'delivery_claim'; id: string }
  | { type: 'cafe_order'; item: CafeItem; sequence: number }
  | { type: 'cafe_pickup' }
  | { type: 'dog_leash' }
  | { type: 'local_activity'; action: LocalActivity; station: string };

export const clockMinutes = ({ day, minute }: { day: number; minute: number }) => (day - 1) * 1440 + minute;
