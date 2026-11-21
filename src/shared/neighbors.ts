import { GAME_MINUTES_PER_REAL_SECOND } from './life';

export type NeighborAction = 'walk' | 'look' | 'phone' | 'chat' | 'wave';
export interface NeighborPose {
  x: number; z: number; yaw: number; action: NeighborAction; visible: boolean;
}
export interface NeighborProfile {
  name: string; hair: number; clothes: number; trousers: number;
  skin: number; height: number; speed: number; habit: string;
}

export const NEIGHBORS: readonly NeighborProfile[] = [
  { name: 'Марина', hair: 0x6d3e2c, clothes: 0xb77e65, trousers: 0x505b70, skin: 0xeac3a5, height: 1.00, speed: .98, habit: 'Любит утренние встречи' },
  { name: 'Денис', hair: 0x362c2b, clothes: 0x577e73, trousers: 0x444f5e, skin: 0xdfad8e, height: 1.08, speed: .99, habit: 'Всегда здоровается со знакомыми' },
  { name: 'Виктория', hair: 0xc49a65, clothes: 0x6e83a0, trousers: 0x373e53, skin: 0xf4cfaf, height: .98, speed: 1.01, habit: 'Часто смотрит телефон' },
  { name: 'Артём', hair: 0x302b29, clothes: 0x9a7756, trousers: 0x505a6d, skin: 0xdcb096, height: 1.10, speed: 1.18, habit: 'Ходит быстрым шагом' },
  { name: 'Екатерина', hair: 0xa07853, clothes: 0x8e698d, trousers: 0x4d5551, skin: 0xe9b99f, height: 1.03, speed: 1.00, habit: 'Прогуливается после обеда' },
  { name: 'Илья', hair: 0x624d37, clothes: 0x72919c, trousers: 0x4b4b51, skin: 0xe9bb9e, height: 1.07, speed: 1.14, habit: 'Останавливается осмотреться' },
  { name: 'Ольга', hair: 0x4a352a, clothes: 0xa4a678, trousers: 0x665a55, skin: 0xd9a483, height: .96, speed: .92, habit: 'Любит вечерние прогулки' },
  { name: 'Максим', hair: 0x3e322a, clothes: 0xb18563, trousers: 0x454c58, skin: 0xf0c7a2, height: 1.12, speed: 1.23, habit: 'Почти всегда куда-то спешит' },
  { name: 'Полина', hair: 0x805633, clothes: 0x6a9581, trousers: 0x51596c, skin: 0xeac4a6, height: 1.00, speed: .96, habit: 'Часто встречает соседей' },
  { name: 'Егор', hair: 0x322d2b, clothes: 0x7784a1, trousers: 0x595657, skin: 0xc89572, height: 1.05, speed: 1.13, habit: 'Любит прогулки по вечерам' },
  { name: 'София', hair: 0xad8250, clothes: 0xc08488, trousers: 0x3f5660, skin: 0xecc6b0, height: .97, speed: 1.00, habit: 'Иногда машет знакомым' },
  { name: 'Кирилл', hair: 0x4e4135, clothes: 0x6f9474, trousers: 0x4e555c, skin: 0xd6a789, height: 1.10, speed: 1.05, habit: 'Гуляет по соседним дорожкам' },
  { name: 'Наталья', hair: 0x694835, clothes: 0x9a879c, trousers: 0x455b62, skin: 0xe9bfa4, height: 1.02, speed: 1.00, habit: 'Вечером выходит прогуляться' },
  { name: 'Роман', hair: 0x3b3029, clothes: 0x887a63, trousers: 0x505569, skin: 0xd9ad8e, height: 1.09, speed: 1.12, habit: 'Иногда задерживается у фонарей' },
] as const;

// A public C-shaped footpath: left side, behind the house, then right side.
// No segment enters the yard or the new rooms.
export const NEIGHBOR_PATH = [
  { x: -11.55, z: 6.70 }, { x: -11.55, z: -9.85 },
  { x: 17.62, z: -9.85 }, { x: 17.62, z: 6.70 },
] as const;

function between(a: {x:number;z:number}, b: {x:number;z:number}, t: number) {
  return { x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t };
}
function travel(keyframes: readonly { second:number;x:number;z:number }[], second: number) {
  for (let i = 1; i < keyframes.length; i++) {
    const next = keyframes[i], previous = keyframes[i - 1];
    if (second <= next.second) {
      const t = Math.max(0, Math.min(1, (second - previous.second) / (next.second - previous.second)));
      const p = between(previous, next, t);
      return { ...p, yaw: Math.atan2(next.x - previous.x, next.z - previous.z) };
    }
  }
  const end = keyframes[keyframes.length - 1];
  return { x: end.x, z: end.z, yaw: 0 };
}

const leftMeeting = [
  { second: 0, x: -11.55, z: 4.10 },
  { second: 19, x: -11.55, z: -9.85 },
  { second: 36, x: -.78, z: -9.85 },
  { second: 54, x: -.78, z: -9.85 },
  { second: 73, x: -11.55, z: -9.85 },
  { second: 101, x: -11.55, z: 5.90 },
  { second: 140, x: -11.55, z: 4.10 },
] as const;
const rightMeeting = [
  { second: 0, x: 17.62, z: 4.10 },
  { second: 19, x: 17.62, z: -9.85 },
  { second: 36, x: .78, z: -9.85 },
  { second: 54, x: .78, z: -9.85 },
  { second: 73, x: 17.62, z: -9.85 },
  { second: 101, x: 17.62, z: 5.90 },
  { second: 140, x: 17.62, z: 4.10 },
] as const;

function footpath(distance: number, lane: number) {
  const points = NEIGHBOR_PATH;
  const first = Math.abs(points[1].z - points[0].z);
  const middle = points[2].x - points[1].x;
  const third = points[3].z - points[2].z;
  const length = first + middle + third;
  const cycle = length * 2;
  const step = ((distance % cycle) + cycle) % cycle;
  const forward = step <= length;
  const t = forward ? step : cycle - step;
  let a: {x:number;z:number}; let b: {x:number;z:number}; let fraction: number;
  if (t < first) {
    a = points[0]; b = points[1]; fraction = t / first;
  } else if (t < first + middle) {
    a = points[1]; b = points[2]; fraction = (t - first) / middle;
  } else {
    a = points[2]; b = points[3]; fraction = (t - first - middle) / third;
  }
  const p = between(a, b, fraction);
  // Multiple traffic lanes avoid head-on overlaps without using physics.
  if (Math.abs(a.x - b.x) < .01) p.x += lane;
  else p.z += lane;
  return { ...p, yaw: Math.atan2((b.x - a.x) * (forward ? 1 : -1),
    (b.z - a.z) * (forward ? 1 : -1)) };
}

export function neighborPose(index: number, gameMinute: number): NeighborPose {
  const person = NEIGHBORS[index];
  if (!person || !Number.isFinite(gameMinute)) return {x:0,z:0,yaw:0,action:'look',visible:false};
  const day = Math.floor(gameMinute / 1440);
  const hour = ((gameMinute % 1440) + 1440) % 1440 / 60;
  const maxVisible = hour < 6 || hour >= 22 ? 1
    : hour < 9 ? 4 : hour < 18 ? 7 : 5;
  const visible = ((index + day * 3) % NEIGHBORS.length) < maxVisible;
  const seconds = gameMinute / GAME_MINUTES_PER_REAL_SECOND;
  // The first two pass through one real stop-and-chat event at the back path.
  if (index < 2) {
    const phase = ((seconds + day * 13) % 140 + 140) % 140;
    const movement = travel(index ? rightMeeting : leftMeeting, phase);
    const chat = phase >= 36 && phase <= 54;
    return { ...movement, yaw: chat ? (index ? -Math.PI / 2 : Math.PI / 2) : movement.yaw,
      action: chat ? 'chat' : 'walk', visible };
  }
  // Each resident has a different recurring stop. The walked distance is
  // frozen throughout the gesture, so they don't slide across the pavement.
  const shifted = seconds + index * 17.9 + day * 7.9;
  const period = 72 + (index % 4) * 7;
  const rest = 4 + index % 3;
  const cycles = Math.floor(shifted / period);
  const within = shifted - cycles * period;
  const walkSeconds = cycles * (period - rest) + Math.min(within, period - rest);
  const path = footpath(walkSeconds * person.speed, ((index % 3) - 1) * .22);
  const resting = within >= period - rest;
  const action: NeighborAction = resting
    ? (index % 3 === 0 ? 'wave' : index % 3 === 1 ? 'phone' : 'look') : 'walk';
  return { ...path, action, visible };
}
