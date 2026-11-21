import { GAME_MINUTES_PER_REAL_SECOND } from './life';

export type NeighborAction = 'walk' | 'look' | 'phone' | 'chat' | 'wave' | 'adjust' | 'stretch';
export type HairStyle = 'short' | 'swept' | 'bob' | 'long' | 'ponytail' | 'bun' | 'curly' | 'cap' | 'buzz' | 'braid';
export type OutfitStyle = 'hoodie' | 'jacket' | 'coat' | 'sweater' | 'dress' | 'shirt' | 'vest' | 'overalls';
export type AccessoryStyle = 'none' | 'backpack' | 'tote';
export interface NeighborPose {
  x: number; z: number; yaw: number; action: NeighborAction; visible: boolean;
  /** Deterministic fade as a resident enters/leaves the public sidewalk. */
  opacity: number;
  /** 0 walking, 1 fully settled in a gesture; blends at both ends. */
  gestureBlend: number;
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

const clamp01 = (value: number) => Math.max(0, Math.min(1, value));
const smooth = (t: number) => { const x = clamp01(t); return x * x * (3 - 2 * x); };
const fadeBetween = (value:number, start:number, end:number) => smooth((value - start) / (end - start));
const spent = (time:number, start:number, end:number) => Math.max(0, Math.min(time - start, end - start));

/** Restrict crowd density smoothly around day/night schedule transitions. */
function dailyVisibility(slot:number, minute:number):number {
  if (slot === 0) return 1;
  if (slot < 4) return fadeBetween(minute,360,365) * (1 - fadeBetween(minute,1315,1320));
  if (slot === 4) return fadeBetween(minute,540,545) * (1 - fadeBetween(minute,1315,1320));
  return fadeBetween(minute,540,545) * (1 - fadeBetween(minute,1075,1080));
}

function routePoint(metres:number) {
  const distance = Math.max(0, Math.min(NEIGHBOR_ROUTE_LENGTH, metres));
  if (distance <= side) return { x: NEIGHBOR_PATH[0].x, z: NEIGHBOR_PATH[0].z - distance };
  if (distance <= side + rear) return { x: NEIGHBOR_PATH[1].x + distance - side, z: NEIGHBOR_PATH[1].z };
  return { x: NEIGHBOR_PATH[2].x, z: NEIGHBOR_PATH[2].z + distance - side - rear };
}

function pathPosition(fraction:number, reverse:boolean, lane:number) {
  const routeDistance = (reverse ? 1-fraction : fraction) * NEIGHBOR_ROUTE_LENGTH;
  const base = routePoint(routeDistance);
  const from = routePoint(Math.max(0, routeDistance - .55));
  const to = routePoint(Math.min(NEIGHBOR_ROUTE_LENGTH, routeDistance + .55));
  const sign = reverse ? -1 : 1;
  const dx = (to.x-from.x)*sign, dz=(to.z-from.z)*sign;
  const length = Math.hypot(dx,dz) || 1;
  const tangentX = dx / length, tangentZ = dz / length;
  return { x: base.x + lane*tangentZ, z: base.z - lane*tangentX,
    yaw: Math.atan2(tangentX,tangentZ) };
}

/** Visual-only, reproducible by both connected clients. Each lane has two
 * different people: the first fades away before the other enters next trip.
 * No reversing/teleporting is ever visible to a player. */
export function neighborPose(index: number, gameMinute: number): NeighborPose {
  const person = NEIGHBORS[index];
  const hidden: NeighborPose = { x:0,z:0,yaw:0,action:'look',visible:false,opacity:0,gestureBlend:0 };
  if (!person || !Number.isFinite(gameMinute)) return hidden;
  const slot = index % NEIGHBOR_SLOT_COUNT;
  const seconds = gameMinute / GAME_MINUTES_PER_REAL_SECOND;
  // Two opposite walkers can meet in the middle of the rear sidewalk.
  const offset = slot < 2 ? 0 : slot * 13.9;
  const time = seconds + offset;
  const cycle = Math.floor(time / NEIGHBOR_TRIP_SECONDS);
  const phase = time - cycle * NEIGHBOR_TRIP_SECONDS;
  const variant = Math.floor(index / NEIGHBOR_SLOT_COUNT);
  if (((cycle % 2) + 2) % 2 !== variant) return hidden;
  const dayMinute = ((gameMinute % 1440) + 1440) % 1440;
  const schedule = dailyVisibility(slot, dayMinute);
  if (schedule <= 0) return hidden;

  const paired = slot < 2;
  // Conversations and brief street gestures stop forward travel, not just
  // the animated feet. This avoids sliding NPCs during idle animations.
  const lost = paired ? spent(phase,44,56)
    : spent(phase,29,34) + spent(phase,65,69);
  const movingTime = paired ? 88 : 91;
  const fraction = clamp01((phase - lost) / movingTime);
  const reverse = slot === 1 || (slot > 1 && (slot + cycle) % 2 === 1);
  // Both directions keep their own physical side of the 1.8m pavement.
  // pathPosition reverses its tangent for oncoming residents, so a positive
  // lane offset separates them; per-slot variation avoids marching rows.
  const lane = paired ? .30 : .47 + ((slot % 3) - 1) * .075;
  const pose = pathPosition(fraction,reverse,lane);
  if (paired) {
    const nearMeeting = smooth((fraction-.41)/.09) * (1 - smooth((fraction-.5)/.09));
    pose.x += (slot === 0 ? -.70 : .70) * nearMeeting;
    if (phase >= 44 && phase < 56) pose.yaw = slot === 0 ? Math.PI/2 : -Math.PI/2;
  }
  const travelFade = smooth(Math.min(fraction,1-fraction) * NEIGHBOR_ROUTE_LENGTH / NEIGHBOR_FADE_METERS);
  const opacity = travelFade * schedule;
  const chatBlend = paired ? smooth((phase - 42.4)/1.6) * (1 - smooth((phase - 55.2)/2.2)) : 0;
  const firstBlend = !paired ? smooth((phase - 27.5)/1.5) * (1 - smooth((phase - 33.2)/2.5)) : 0;
  const secondBlend = !paired ? smooth((phase - 63.5)/1.5) * (1 - smooth((phase - 68.2)/2.4)) : 0;
  const gestureBlend = Math.max(chatBlend,firstBlend,secondBlend);
  const action:NeighborAction = paired ? phase >= 42.4 && phase < 57.4 ? 'chat' : 'walk'
    : phase >= 27.5 && phase < 35.7 ? (slot % 3 === 0 ? 'adjust' : slot % 3 === 1 ? 'phone' : 'look')
    : phase >= 63.5 && phase < 70.6 ? (slot % 4 === 0 ? 'stretch' : slot % 4 === 1 ? 'wave' :
      slot % 4 === 2 ? 'phone' : 'adjust') : 'walk';
  return {...pose, action, opacity, gestureBlend, visible: opacity > .001};
}
