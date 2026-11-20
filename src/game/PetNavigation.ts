import { planWalk, type FloorPoint, type FloorRect, type WalkRoute } from './navigation';

// Server plans, client steering and local recovery must share the same
// physical clearance. Old paths used zero extra pet body margin and let
// a dog's belly brush cabinets and the corners of doorways.
export const PET_OBSTACLE_MARGIN = 0.14;
export const PET_FLOOR_MARGIN = 0.14;

export function petNavigationGeometry(obstacles: readonly FloorRect[], floor: FloorRect): {
  obstacles: readonly FloorRect[]; floor: FloorRect;
} {
  const margin = PET_OBSTACLE_MARGIN;
  return {
    obstacles: obstacles.map(rect => ({
      minX: rect.minX - margin, maxX: rect.maxX + margin,
      minZ: rect.minZ - margin, maxZ: rect.maxZ + margin,
    })),
    floor: {
      minX: floor.minX + PET_FLOOR_MARGIN, maxX: floor.maxX - PET_FLOOR_MARGIN,
      minZ: floor.minZ + PET_FLOOR_MARGIN, maxZ: floor.maxZ - PET_FLOOR_MARGIN,
    },
  };
}

export function planPetRoute(from: FloorPoint, to: FloorPoint,
  geometry: ReturnType<typeof petNavigationGeometry>): WalkRoute | null {
  return planWalk(from, to, geometry.obstacles, geometry.floor);
}

/**
 * If another pet/person blocks a waypoint for a sustained period, search a
 * broad path around their footprint. Never blindly push through a character
 * or teleport through furniture. Return null when this temporary obstruction
 * has no reachable detour, and allow another attempt after a cooldown.
 */
export function petTemporaryDetour(from: FloorPoint, destination: FloorPoint,
  blockers: readonly FloorPoint[], geometry: ReturnType<typeof petNavigationGeometry>,
  bodyRadius = 0.85): WalkRoute | null {
  // Never silently exclude a blocker already within clearance. Doing so
  // planned a new straight line through the same body and retriggered jitter.
  // If the temporary obstacle contains the start, return null and yield.
  const dynamic = blockers.map(b => ({
      minX: b.x - bodyRadius, maxX: b.x + bodyRadius,
      minZ: b.z - bodyRadius, maxZ: b.z + bodyRadius,
    }));
  const detour = planWalk(from, destination,
    [...geometry.obstacles, ...dynamic], geometry.floor);
  const last = detour?.path.at(-1);
  // If the destination itself is occupied, wait for it to become free;
  // don't accept an A* endpoint snapped beside a bowl and mime eating there.
  return detour && last &&
    Math.hypot(detour.from.x - from.x, detour.from.z - from.z) < 0.015 &&
    Math.hypot(last.x - destination.x, last.z - destination.z) < .02
    ? detour : null;
}
