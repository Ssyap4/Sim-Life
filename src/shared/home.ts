import type { FloorRect } from '../game/navigation';

export const COUNTER = { x: 2.43, z: -3.91 };
export const HOME_PLACEMENTS = {
  sofa: { x: -3.48, z: 1.76 },
  bed: { x: -4.30, z: -3.35 },
  kitchen: COUNTER,
  desk: { x: 4.58, z: 1.22 },
  tv: { x: -3.43, z: -0.48 },
  table: { x: 3.02, z: -1.40 },
  wardrobe: { x: -5.33, z: -1.00 },
  vanity: { x: -1.89, z: -4.27 },
  lamp: { x: -5.28, z: 1.63 },
} as const;

export const DINING_TOP = .86;

export function homeFootprint(center: { x: number; z: number },
  minX: number, maxX: number, minZ: number, maxZ: number): FloorRect {
  return { minX: center.x + minX, maxX: center.x + maxX,
    minZ: center.z + minZ, maxZ: center.z + maxZ };
}

export const HOME_FURNITURE = {
  sofa: homeFootprint(HOME_PLACEMENTS.sofa, -1.34, 1.34, -.53621, .60),
  bed: homeFootprint(HOME_PLACEMENTS.bed, -1.34, 1.34, -1.38, 1.35),
  kitchen: homeFootprint(COUNTER, -2.195, 2.21, -.575, .49),
  desk: homeFootprint(HOME_PLACEMENTS.desk, -1.125, 1.125, -.49, 1.46),
  tv: homeFootprint(HOME_PLACEMENTS.tv, -.96, .96, -.275, .284),
  table: homeFootprint(HOME_PLACEMENTS.table, -1.36, 1.36, -.62, .62),
};

export const HOME_DECOR = [
  homeFootprint(HOME_PLACEMENTS.wardrobe, -.54, .52, -.72, .72),
  homeFootprint(HOME_PLACEMENTS.vanity, -.78, .78, -.39, 1.02),
  homeFootprint(HOME_PLACEMENTS.lamp, -.36, .36, -.36, .36),
];

export const HOUSE_ENTRY = { x: .48, z: 5.17, width: 2.42 };
export const HOME_YARD = {
  gate: { x: HOUSE_ENTRY.x, z: 12.06, width: 1.46 },
  grill: { x: -4.72, z: 6.49 },
  sideTable: { x: -3.42, z: 6.49 },
  parking: { x: 3.85, z: 8.87 },
  planter: { x: -5.73, z: 9.80 },
};
export const HOME_FLOOR = { minX: -5.62, maxX: 5.62, minZ: -4.62, maxZ: 11.70 };
export const HOME_YARD_OBSTACLES = [
  { minX: HOME_FLOOR.minX, maxX: HOUSE_ENTRY.x - HOUSE_ENTRY.width / 2 + .22,
    minZ: HOUSE_ENTRY.z - .30, maxZ: HOUSE_ENTRY.z + .30 },
  { minX: HOUSE_ENTRY.x + HOUSE_ENTRY.width / 2 - .22, maxX: HOME_FLOOR.maxX,
    minZ: HOUSE_ENTRY.z - .30, maxZ: HOUSE_ENTRY.z + .30 },
  homeFootprint(HOME_YARD.grill, -.69, .69, -.62, .62),
  homeFootprint(HOME_YARD.sideTable, -.67, .67, -.55, .55),
  homeFootprint(HOME_YARD.parking, -.99, .99, -2.79, -2.25),
  homeFootprint(HOME_YARD.planter, -.45, .50, -2.11, 2.11),
];

export const KITCHEN_WORK = {
  stove: { position: { x: COUNTER.x - .87, z: -3.08 }, target: { x: COUNTER.x - .87, y: 1.17, z: -3.76 } },
  wash: { position: { x: COUNTER.x + 1.28, z: -3.08 }, target: { x: COUNTER.x + 1.28, y: 1.09, z: -3.77 } },
  tidy: { position: { x: COUNTER.x + .37, z: -3.08 }, target: { x: COUNTER.x + .37, y: 1.04, z: -3.62 } },
  tea: { position: { x: COUNTER.x - 1.68, z: -3.08 }, target: { x: COUNTER.x - 1.68, y: 1.18, z: -3.75 } },
} as const;

export const KITCHEN_ACTIONS = {
  kitchenWash: 'wash', kitchenTidy: 'tidy', kitchenTea: 'tea',
} as const;

export type HomeLeisure = 'tv' | 'computer' | 'verdell' | 'simba' | 'chat';
