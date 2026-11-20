import { pointIsClear, segmentIsClear, type FloorPoint, type FloorRect } from './navigation';

// Keep visible shoulders, arms and gait away from the other resident;
// .62 m was barely the static torso width and let animated meshes intersect.
export const RESIDENT_CLEARANCE = .82;
const passes = [.97, 1.45, 1.86, 2.37].map(angle => [Math.cos(angle), Math.sin(angle)] as const);

function clearsBody(from: FloorPoint, to: FloorPoint, body: FloorPoint, clearance: number): boolean {
  const clearanceSquared = clearance * clearance;
  const x = from.x - body.x, z = from.z - body.z;
  const dx = to.x - from.x, dz = to.z - from.z;
  const travel = dx * dx + dz * dz;
  if (!travel) return true;
  const dot = x * dx + z * dz;
  if (x * x + z * z < clearanceSquared) return dot >= 0;
  const t = Math.max(0, Math.min(1, -dot / travel));
  return (x + dx * t) ** 2 + (z + dz * t) ** 2 >= clearanceSquared;
}

/** Sweep each movement step between frames. Both residents pass on the same side
 * relative to their own direction, including when they approach head-on. */
export function residentStep(from: FloorPoint, desired: FloorPoint, body: FloorPoint,
  obstacles: readonly FloorRect[], floor: FloorRect): FloorPoint {
  return residentStepAroundBodies(from, desired,
    [{ position: body, clearance: RESIDENT_CLEARANCE }], obstacles, floor);
}

/** A single swept movement must clear *all* nearby bodies. Unlike pushing a
 * pet aside, this changes only the walking resident's next visual step.
 * It also preserves the old resident-vs-resident right-hand passing rule.
 */
export function residentStepAroundBodies(
  from: FloorPoint, desired: FloorPoint,
  bodies: readonly { position: FloorPoint; clearance: number }[],
  obstacles: readonly FloorRect[], floor: FloorRect,
): FloorPoint {
  const clears = (to: FloorPoint): boolean => bodies.every(({ position, clearance }) =>
    clearsBody(from, to, position, clearance));
  if (clears(desired) &&
      (segmentIsClear(from, desired, obstacles, floor) || !pointIsClear(from, obstacles, floor))) return desired;
  const dx = desired.x - from.x, dz = desired.z - from.z;
  for (const [cosine, sine] of passes) for (const side of [1, -1]) {
    const step = { x: from.x + dx * cosine - side * dz * sine,
      z: from.z + side * dx * sine + dz * cosine };
    if (clears(step) && segmentIsClear(from, step, obstacles, floor)) return step;
  }
  return from;
}

export function unoccupiedDestination(target: FloorPoint, body: FloorPoint,
  obstacles: readonly FloorRect[], floor: FloorRect): FloorPoint | undefined {
  if (Math.hypot(target.x - body.x, target.z - body.z) >= RESIDENT_CLEARANCE) return target;
  for (const distance of [.42, .64, .84, 1.04, 1.28, 1.52]) for (let i = 0; i < 24; i++) {
    const angle = i * Math.PI / 12;
    const point = { x: target.x + distance * Math.cos(angle), z: target.z + distance * Math.sin(angle) };
    if (Math.hypot(point.x - body.x, point.z - body.z) >= RESIDENT_CLEARANCE && pointIsClear(point, obstacles, floor)) return point;
  }
}
