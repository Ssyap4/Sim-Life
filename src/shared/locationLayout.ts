import type { FloorRect } from '../game/navigation';

export const CASHIER_SPOT = { x: .17, z: .80, width: .68, depth: .52 };
function obstacle(x: number, z: number, width: number, depth: number): FloorRect {
  const clearance = .26;
  return { minX: x - width / 2 - clearance, maxX: x + width / 2 + clearance,
    minZ: z - depth / 2 - clearance, maxZ: z + depth / 2 + clearance };
}

export const CASHIER_OBSTACLE = obstacle(CASHIER_SPOT.x, CASHIER_SPOT.z, CASHIER_SPOT.width, CASHIER_SPOT.depth);
