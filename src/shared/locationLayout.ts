import type { FloorRect } from '../game/navigation';

export const PLAZA_FLOOR: FloorRect = { minX: -6.92, maxX: 6.92, minZ: -4.62, maxZ: 5.35 };
export const PLAZA_FOUNTAIN = { x: .06, z: .18, radius: 1.29 };
export const PLAZA_BEDS = [
  { x: -4.26, z: -.56, width: 2.47, depth: .74 },
  { x: -4.67, z: 3.59, width: 2.85, depth: .86 },
  { x: 3.65, z: 3.83, width: 2.45, depth: .82 },
  { x: 5.67, z: -.65, width: 1.51, depth: .80 },
] as const;
export const PLAZA_TREES = [{ x: -6.03, z: 1.89 }, { x: 6.01, z: 3.15 }] as const;
export const CASHIER_SPOT = { x: .17, z: .80, width: .68, depth: .52 };

function obstacle(x: number, z: number, width: number, depth: number): FloorRect {
  const clearance = .26;
  return { minX: x - width / 2 - clearance, maxX: x + width / 2 + clearance,
    minZ: z - depth / 2 - clearance, maxZ: z + depth / 2 + clearance };
}

const water = PLAZA_FOUNTAIN;
// Overlapping rectangles follow the octagonal footprint and leave its diagonal paths clear.
export const PLAZA_OBSTACLES = [
  obstacle(water.x, water.z, water.radius * 2, water.radius * 1.41),
  obstacle(water.x, water.z, water.radius * 1.41, water.radius * 2),
  ...PLAZA_BEDS.map(bed => obstacle(bed.x, bed.z, bed.width, bed.depth)),
  ...[3.47, 5.63].map(x => obstacle(x, 1.34, .44, .50)),
  ...PLAZA_TREES.map(tree => obstacle(tree.x, tree.z, .96, .96)),
  { minX: -6.92, maxX: 6.92, minZ: -4.62, maxZ: -4.05 },
];

export const CASHIER_OBSTACLE = obstacle(CASHIER_SPOT.x, CASHIER_SPOT.z, CASHIER_SPOT.width, CASHIER_SPOT.depth);
