import { livingNeighborPose } from './neighborLife';
export { neighborVisits, neighborDoorOpen } from './neighborLife';

export type NeighborAction = 'walk' | 'look' | 'phone' | 'chat' | 'wave' | 'adjust' | 'stretch' | 'water' | 'sip' | 'mail' | 'carry';
export type HairStyle = 'short' | 'swept' | 'bob' | 'long' | 'ponytail' | 'bun' | 'curly' | 'cap' | 'buzz' | 'braid';
export type OutfitStyle = 'hoodie' | 'jacket' | 'coat' | 'sweater' | 'dress' | 'shirt' | 'vest' | 'overalls';
export type AccessoryStyle = 'none' | 'backpack' | 'tote';
export interface NeighborPose {
  x: number; z: number; yaw: number; action: NeighborAction; visible: boolean;
  /** Deterministic fade as a resident enters/leaves the public sidewalk. */
  opacity: number;
  /** 0 walking, 1 fully settled in a gesture; blends at both ends. */
  gestureBlend: number;
  carrying?: boolean;
}
export interface NeighborProfile {
  name: string; hair: number; clothes: number; trousers: number;
  skin: number; height: number; speed: number; habit: string;
  hairStyle: HairStyle; outfit: OutfitStyle; accessory: AccessoryStyle; accent: number;
}

export const NEIGHBORS: readonly NeighborProfile[] = [
  { name: 'Марина', hair: 0x6d3e2c, clothes: 0xb77e65, trousers: 0x505b70, skin: 0xeac3a5, height: 1.00, speed: .98, habit: 'Любит утренние встречи', hairStyle:'bob', outfit:'jacket', accessory:'tote', accent:0xdabf98 },
  { name: 'Денис', hair: 0x362c2b, clothes: 0x577e73, trousers: 0x444f5e, skin: 0xdfad8e, height: 1.08, speed: .99, habit: 'Всегда здоровается со знакомыми', hairStyle:'swept', outfit:'hoodie', accessory:'backpack', accent:0xd3b18b },
  { name: 'Виктория', hair: 0xc49a65, clothes: 0x6e83a0, trousers: 0x373e53, skin: 0xf4cfaf, height: .98, speed: 1.01, habit: 'Часто смотрит телефон', hairStyle:'ponytail', outfit:'coat', accessory:'none', accent:0xd1d0b6 },
  { name: 'Артём', hair: 0x302b29, clothes: 0x9a7756, trousers: 0x505a6d, skin: 0xdcb096, height: 1.10, speed: 1.18, habit: 'Ходит быстрым шагом', hairStyle:'buzz', outfit:'vest', accessory:'backpack', accent:0xc2aa70 },
  { name: 'Екатерина', hair: 0xa07853, clothes: 0x8e698d, trousers: 0x4d5551, skin: 0xe9b99f, height: 1.03, speed: 1.00, habit: 'Прогуливается после обеда', hairStyle:'long', outfit:'dress', accessory:'tote', accent:0xe4ba96 },
  { name: 'Илья', hair: 0x624d37, clothes: 0x72919c, trousers: 0x4b4b51, skin: 0xe9bb9e, height: 1.07, speed: 1.14, habit: 'Останавливается осмотреться', hairStyle:'curly', outfit:'shirt', accessory:'none', accent:0xd2cab1 },
  { name: 'Ольга', hair: 0x4a352a, clothes: 0xa4a678, trousers: 0x665a55, skin: 0xd9a483, height: .96, speed: .92, habit: 'Любит вечерние прогулки', hairStyle:'bun', outfit:'sweater', accessory:'tote', accent:0xc4a2a0 },
  { name: 'Максим', hair: 0x3e322a, clothes: 0xb18563, trousers: 0x454c58, skin: 0xf0c7a2, height: 1.12, speed: 1.23, habit: 'Почти всегда куда-то спешит', hairStyle:'short', outfit:'jacket', accessory:'backpack', accent:0x536d77 },
  { name: 'Полина', hair: 0x805633, clothes: 0x6a9581, trousers: 0x51596c, skin: 0xeac4a6, height: 1.00, speed: .96, habit: 'Часто встречает соседей', hairStyle:'braid', outfit:'overalls', accessory:'none', accent:0xd3b27f },
  { name: 'Егор', hair: 0x322d2b, clothes: 0x7784a1, trousers: 0x595657, skin: 0xc89572, height: 1.05, speed: 1.13, habit: 'Любит прогулки по вечерам', hairStyle:'cap', outfit:'hoodie', accessory:'none', accent:0xe7a771 },
  { name: 'София', hair: 0xad8250, clothes: 0xc08488, trousers: 0x3f5660, skin: 0xecc6b0, height: .97, speed: 1.00, habit: 'Иногда машет знакомым', hairStyle:'long', outfit:'coat', accessory:'tote', accent:0xe8d4a0 },
  { name: 'Кирилл', hair: 0x4e4135, clothes: 0x6f9474, trousers: 0x4e555c, skin: 0xd6a789, height: 1.10, speed: 1.05, habit: 'Гуляет по соседним дорожкам', hairStyle:'swept', outfit:'overalls', accessory:'none', accent:0xd8bd87 },
  { name: 'Наталья', hair: 0x694835, clothes: 0x9a879c, trousers: 0x455b62, skin: 0xe9bfa4, height: 1.02, speed: 1.00, habit: 'Вечером выходит прогуляться', hairStyle:'curly', outfit:'dress', accessory:'none', accent:0xb9d5c5 },
  { name: 'Роман', hair: 0x3b3029, clothes: 0x887a63, trousers: 0x505569, skin: 0xd9ad8e, height: 1.09, speed: 1.12, habit: 'Иногда задерживается у фонарей', hairStyle:'short', outfit:'vest', accessory:'backpack', accent:0xabb6bb },
] as const;

// All three existing paths move TOGETHER. The ring leaves about eight metres
// for future extensions beyond the current west/east/rear walls.
export const NEIGHBOR_PATH = [
  { x: -17.50, z: 9.50 }, { x: -17.50, z: -15.35 },
  { x: 23.50, z: -15.35 }, { x: 23.50, z: 9.50 },
] as const;
export const NEIGHBOR_SLOT_COUNT = 7;
export const NEIGHBOR_TRIP_SECONDS = 100;
export const NEIGHBOR_FADE_METERS = 5.5;

const side = NEIGHBOR_PATH[0].z - NEIGHBOR_PATH[1].z;
const rear = NEIGHBOR_PATH[2].x - NEIGHBOR_PATH[1].x;
export const NEIGHBOR_ROUTE_LENGTH = side * 2 + rear;

/**
 * Daily schedules are deterministic from the synced household game clock;
 * NPCs have a home, a reason to go out, and an actual return to the door.
 * No additional server state or household progress is required.
 */
export function neighborPose(index:number,gameMinute:number):NeighborPose {
  return livingNeighborPose(index,gameMinute,NEIGHBORS);
}
