import type { FloorRect } from '../game/navigation';

export const HOUSE_ENTRY = { x: .48, z: 5.17, width: 2.42 };
export const HOUSE = { minX: -9.50, maxX: 9.50, minZ: -7.58, maxZ: HOUSE_ENTRY.z };
export const WEST_WALL = -4.35;
export const EAST_WALL = 4.95;
export const BEDROOM_END = -1.35;
export const WC_START = 2.00;
export const OFFICE_END = -1.10;
// The three future-purpose rooms form a self-contained east wing.
// The original occupied floor plan and its furniture coordinates never move.
export const HOUSE_WING = {
  minX: HOUSE.maxX, maxX: 15.65, minZ: HOUSE.minZ, maxZ: HOUSE.maxZ,
  connector: { z: -2.24, width: 1.90 },
  crossWalls: [-3.60, .88] as const,
  crossDoor: { x: 12.62, width: 1.86 },
};
export const HOME_FLOOR = { minX: -13.5, maxX: 20.0, minZ: -11.5, maxZ: 11.70 };

const WALL_THICKNESS = .19;
const ACTOR_CLEARANCE = .26;
export const HOME_DOORS = {
  bedroom: { x: WEST_WALL, z: -3.60, width: 2.00 },
  spare: { x: WEST_WALL, z: .25, width: 1.95 },
  toilet: { x: WEST_WALL, z: 3.64, width: 1.90 },
  office: { x: EAST_WALL, z: -3.58, width: 2.04 },
  bathroom: { x: EAST_WALL, z: 2.47, width: 2.08 },
} as const;

/** Wall segments stop at the visible jambs. Navigation expands them by body clearance. */
export const HOME_WALLS: readonly FloorRect[] = [
  ...[-1, 1].map(side => {
    const edge = side < 0 ? HOUSE.minX : HOUSE.maxX;
    const jamb = HOUSE_ENTRY.x + side * HOUSE_ENTRY.width / 2;
    return { minX: Math.min(edge, jamb), maxX: Math.max(edge, jamb),
      minZ: HOUSE_ENTRY.z - WALL_THICKNESS / 2, maxZ: HOUSE_ENTRY.z + WALL_THICKNESS / 2 };
  }),
  ...[
    { x: WEST_WALL, doors: [HOME_DOORS.bedroom, HOME_DOORS.spare, HOME_DOORS.toilet] },
    { x: EAST_WALL, doors: [HOME_DOORS.office, HOME_DOORS.bathroom] },
  ].flatMap(({ x, doors }) => {
    const edges = [HOUSE.minZ, ...doors.flatMap(({ z, width }) => [z - width / 2, z + width / 2]), HOUSE.maxZ];
    return edges.flatMap((mark, i) => i % 2 === 0 ? [{
      minX: x - WALL_THICKNESS / 2, maxX: x + WALL_THICKNESS / 2, minZ: mark, maxZ: edges[i + 1],
    }] : []);
  }),
  // New eastern wing: a doorway from the existing office leads to the
  // central landing, with two further internal doors into empty rooms.
  ...[
    [HOUSE.minZ, HOUSE_WING.connector.z - HOUSE_WING.connector.width / 2],
    [HOUSE_WING.connector.z + HOUSE_WING.connector.width / 2, HOUSE.maxZ],
  ].map(([minZ, maxZ]) => ({ minX: HOUSE.maxX - WALL_THICKNESS / 2,
    maxX: HOUSE.maxX + WALL_THICKNESS / 2, minZ, maxZ })),
  ...HOUSE_WING.crossWalls.flatMap(z => [
    { minX: HOUSE_WING.minX, maxX: HOUSE_WING.crossDoor.x - HOUSE_WING.crossDoor.width / 2,
      minZ: z - WALL_THICKNESS / 2, maxZ: z + WALL_THICKNESS / 2 },
    { minX: HOUSE_WING.crossDoor.x + HOUSE_WING.crossDoor.width / 2, maxX: HOUSE_WING.maxX,
      minZ: z - WALL_THICKNESS / 2, maxZ: z + WALL_THICKNESS / 2 },
  ]),
  { minX: HOUSE_WING.maxX - WALL_THICKNESS / 2, maxX: HOUSE_WING.maxX + WALL_THICKNESS / 2,
    minZ: HOUSE.minZ, maxZ: HOUSE.maxZ },
  { minX: HOUSE.maxX, maxX: HOUSE_WING.maxX, minZ: HOUSE.minZ - WALL_THICKNESS / 2,
    maxZ: HOUSE.minZ + WALL_THICKNESS / 2 },
  { minX: HOUSE.maxX, maxX: HOUSE_WING.maxX, minZ: HOUSE.maxZ - WALL_THICKNESS / 2,
    maxZ: HOUSE.maxZ + WALL_THICKNESS / 2 },
  ...[
    { minX: HOUSE.minX, maxX: WEST_WALL, z: BEDROOM_END },
    { minX: HOUSE.minX, maxX: WEST_WALL, z: WC_START },
    { minX: EAST_WALL, maxX: HOUSE.maxX, z: OFFICE_END },
  ].map(({ minX, maxX, z }) => ({ minX, maxX,
    minZ: z - WALL_THICKNESS / 2, maxZ: z + WALL_THICKNESS / 2 })),
];

export const COUNTER = { x: .79, z: -6.86 };
export const HOME_PLACEMENTS = {
  sofa: { x: -2.36, z: 2.02 },
  bed: { x: -6.97, z: -5.86 },
  kitchen: COUNTER,
  kettle: { x: COUNTER.x - 1.68, z: COUNTER.z + .16 },
  coffeeMaker: { x: COUNTER.x + .40, z: COUNTER.z - .12 },
  desk: { x: 7.18, z: -6.72 },
  tv: { x: -2.39, z: -.38 },
  table: { x: 2.39, z: -2.22 },
  vanity: { x: -8.70, z: -2.86 },
  fridge: { x: 3.72, z: COUNTER.z - .26 },
  bedroomLampLeft: { x: -8.84, z: -6.70 },
  bedroomLampRight: { x: -5.12, z: -6.70 },
  bookcase: { x: 8.97, z: -4.49 },
  officeChair: { x: 6.47, z: -2.84 },
  grill: { x: -4.72, z: 6.49 },
  yardTable: { x: -2.68, z: 6.43 },
} as const;

export const BATH_FIXTURES = {
  toilet: { center: { x: -8.30, z: 3.59 }, approach: { x: -7.13, z: 3.59 } },
  shower: { center: { x: 8.36, z: .50 }, approach: { x: 8.08, z: .55 } },
  bathtub: { center: { x: 8.32, z: 3.72 }, approach: { x: 7.21, z: 3.72 } },
  basin: { center: { x: 5.98, z: -.44 }, approach: { x: 5.98, z: .59 } },
  wcBasin: { center: { x: -6.28, z: 2.39 }, approach: { x: -6.28, z: 2.99 } },
} as const;

export const LIBRARY_APPROACH = { x: 8.12, z: -4.48 };
export const HOME_WALK_SPEED = 1.8;

export function homeSeat(id: import('./homeLife').HomeSeat, role: import('./protocol').CharacterId, layout?: HomeLayout) {
  const first = role === 'vlad';
  const p = furniturePosition(id, layout);
  const seat = {
    sofa: [first ? -.50 : .50, first ? .057 : .106, -.27, Math.PI, first ? -.50 : .50, -1.01],
    officeChair: [.14, first ? -.30 : -.25, 0, Math.PI / 2, 1.02, 0],
    table: [first ? .99 : -.99, first ? -.37 : -.32, 0, first ? -Math.PI / 2 : Math.PI / 2, first ? 1.80 : -1.80, 0],
    yardTable: [first ? -.57 : .57, first ? -.35 : -.30, .72, Math.PI, first ? -.57 : .57, 1.42],
  }[id];
  const [x,y,z,yaw,approachX,approachZ] = seat;
  return { position: {x:p.x+x,y,z:p.z+z}, yaw, approach: {x:p.x+approachX,z:p.z+approachZ} };
}

export const DINING_TOP = .86;

export function homeFootprint(center: { x: number; z: number },
  minX: number, maxX: number, minZ: number, maxZ: number): FloorRect {
  return { minX: center.x + minX, maxX: center.x + maxX,
    minZ: center.z + minZ, maxZ: center.z + maxZ };
}

const movableBounds = {
  sofa: [-1.34, 1.34, -.53621, .60],
  bed: [-1.34, 1.34, -1.38, 1.35],
  desk: [-1.125, 1.125, -.49, 1.46],
  tv: [-.96, .96, -.275, .284],
  table: [-1.36, 1.36, -.62, .62],
  bookcase: [-.44, .44, -1.02, 1.02],
  officeChair: [-.56, .52, -.64, .64],
  grill: [-.60, .60, -.45, .47],
  yardTable: [-.98, .98, -.46, 1.01],
} as const;
export type HomeFurnitureId = keyof typeof movableBounds;
export type HomeLayout = Partial<Record<HomeFurnitureId, { x: number; z: number }>>;

/** Shared layout input for furniture roots and walkable footprints. */
export function furniturePosition(id: HomeFurnitureId, layout?: HomeLayout) {
  return layout?.[id] ?? HOME_PLACEMENTS[id];
}

export function furnitureBounds(id: HomeFurnitureId, layout?: HomeLayout) {
  const [minX, maxX, minZ, maxZ] = movableBounds[id];
  return homeFootprint(furniturePosition(id, layout), minX, maxX, minZ, maxZ);
}

const defaultFurnitureBounds = Object.fromEntries(
  (Object.keys(movableBounds) as HomeFurnitureId[]).map(id => [id, furnitureBounds(id)]),
) as Record<HomeFurnitureId, FloorRect>;

export const HOME_FURNITURE = {
  ...defaultFurnitureBounds,
  vanity:homeFootprint(HOME_PLACEMENTS.vanity,-.51,1.14,-.90,.90),
  kitchen: homeFootprint(COUNTER, -2.70, 2.21, -.575, .49),
  kettle: homeFootprint(HOME_PLACEMENTS.kettle, -.31, .31, -.29, .29),
  coffeeMaker: homeFootprint(HOME_PLACEMENTS.coffeeMaker, -.21, .21, -.20, .19),
  toilet: homeFootprint(BATH_FIXTURES.toilet.center, -.66, .62, -.39, .39),
  bathtub: homeFootprint(BATH_FIXTURES.bathtub.center, -.67, .67, -1.08, 1.08),
  basin: homeFootprint(BATH_FIXTURES.basin.center, -.63, .63, -.32, .36),
  wcBasin: homeFootprint(BATH_FIXTURES.wcBasin.center, -.40, .40, -.27, .32),
};

const shower = BATH_FIXTURES.shower.center;
export const HOME_DECOR = [
  homeFootprint(HOME_PLACEMENTS.bedroomLampLeft, -.34, .34, -.38, .38),
  homeFootprint(HOME_PLACEMENTS.bedroomLampRight, -.35, .35, -.38, .38),
  // The shower tray is walkable. Its glazing forms a U with the entrance facing west.
  homeFootprint(shower, -.73, .77, -.91, -.54),
  homeFootprint(shower, -.72, .77, .54, .91),
  homeFootprint(shower, .52, .88, -.91, .91),
];

export const HOME_YARD = {
  gate: { x: HOUSE_ENTRY.x, z: 12.06, width: 1.46 },
  parking: { x: 14.2, z: 8.63 },
  sideOpening: { minZ: 6.85, maxZ: 9.65 },
  planter: { x: -5.73, z: 8.15 },
};

export const HOME_STRUCTURE_OBSTACLES = [
  ...HOME_WALLS.map(wall => ({
    minX: wall.minX - ACTOR_CLEARANCE, maxX: wall.maxX + ACTOR_CLEARANCE,
    minZ: wall.minZ - ACTOR_CLEARANCE, maxZ: wall.maxZ + ACTOR_CLEARANCE,
  })),
  // The old floor boundary used to be the outer wall. Keep the actual walls solid on the expanded plot.
  {minX:HOUSE.minX-.28,maxX:HOUSE.minX+.28,minZ:HOUSE.minZ-.28,maxZ:HOUSE.maxZ+.28},
  {minX:HOUSE.minX-.28,maxX:HOUSE.maxX+.28,minZ:HOUSE.minZ-.28,maxZ:HOUSE.minZ+.28},
  // Keep the central courtyard fence, but open side reserve lawns from the front.
  { minX:-6.22,maxX:-5.68,minZ:HOUSE_ENTRY.z,maxZ:10.10 },
  { minX:5.68,maxX:6.22,minZ:HOUSE_ENTRY.z,maxZ:HOME_YARD.sideOpening.minZ },
  { minX:5.68,maxX:6.22,minZ:HOME_YARD.sideOpening.maxZ,maxZ:10.10 },
  homeFootprint(HOME_YARD.parking, -.99, .99, 2.25, 2.79),
  homeFootprint(HOME_YARD.planter, -.45, .50, -2.11, 2.11),
];

const work = (x: number, y: number, z: number) => ({
  position: { x: COUNTER.x + x, z: COUNTER.z + .83 },
  target: { x: COUNTER.x + x, y, z: COUNTER.z + z },
});
export const KITCHEN_WORK = {
  stove: work(-.87, 1.17, .15),
  wash: work(1.28, 1.09, .14),
  dishes: work(1.28, 1.09, .14),
  tidy: work(.37, 1.04, .29),
  tea: work(-1.68, 1.18, .16),
  coffee: work(.40, 1.20, -.12),
} as const;

export const KITCHEN_ACTIONS = {
  kitchenWash: 'wash', kitchenTidy: 'tidy', kitchenTea: 'tea', kitchenDishes: 'dishes',
} as const;

export const BATH_ACTIONS = {
  toiletUse: 'toilet', wcWash: 'wcBasin', bathShower: 'shower', bathSoak: 'bathtub', bathFoam: 'bathtub', bathWash: 'basin', bathTeeth: 'basin',
} as const;
export const GRILL_WORK = { position: { x: HOME_PLACEMENTS.grill.x, z: HOME_PLACEMENTS.grill.z + .75 },
  target: { x: HOME_PLACEMENTS.grill.x, y: .93, z: HOME_PLACEMENTS.grill.z + .12 } };
export type BathFixture = keyof typeof BATH_FIXTURES;
export type HomeLeisure = 'tv' | 'computer' | 'verdell' | 'simba' | 'chat' | 'stroll';
export const HOME_STROLL_STOPS = [{x:-2.8,z:9.0},{x:2.65,z:8.0},{x:4.65,z:9.35},{x:6.85,z:8.10}] as const;
