import {
  pointIsClear, segmentIsClear,
  type FloorPoint, type FloorRect,
} from './navigation';

// These are footprint distances in *world* metres, not scaled rig units.
// Both pet bodies are a little wider than their feet.
export const PET_PET_CLEARANCE = .82;
export const PET_PERSON_CLEARANCE = .68;

export function petGap(a: FloorPoint, b: FloorPoint): number {
  return Math.hypot(a.x - b.x, a.z - b.z);
}

function validMove(from: FloorPoint, to: FloorPoint,
  obstacles: readonly FloorRect[], floor: FloorRect): boolean {
  return pointIsClear(to, obstacles, floor) && segmentIsClear(from, to, obstacles, floor);
}

/**
 * Choose a tiny, clearance-respecting walking step around another body.
 * No teleportation or navmesh. The character continues to follow their
 * original saved waypoints and can resume when the obstruction clears.
 */
export function petTrafficStep(
  from: FloorPoint, toward: FloorPoint, blockers: readonly FloorPoint[],
  obstacles: readonly FloorRect[], floor: FloorRect, distance: number,
  clearance = PET_PET_CLEARANCE,
): FloorPoint {
  const deltaX = toward.x - from.x, deltaZ = toward.z - from.z;
  const span = Math.hypot(deltaX, deltaZ);
  if (!span || !distance) return { x: from.x, z: from.z };
  const step = Math.min(span, distance);
  const angle = Math.atan2(deltaZ, deltaX);
  const nearby = blockers.filter(b => petGap(from, b) < clearance + step + .7);
  const straight = { x: from.x + deltaX / span * step, z: from.z + deltaZ / span * step };
  if (validMove(from, straight, obstacles, floor) &&
      nearby.every(b => petGap(straight, b) >= clearance))
    return straight;

  // Side-step to the right first. Two animals meeting head-on therefore
  // sidestep to opposite sides rather than choosing the same passing lane.
  const turns = [-.35, -.7, -1.1, -1.55, -2.0, -2.6, Math.PI,
    .35, .7, 1.1, 1.55, 2.0, 2.6];
  const startGap = Math.min(Infinity, ...nearby.map(b => petGap(from, b)));
  for (const turn of turns) {
    const candidate = {
      x: from.x + Math.cos(angle + turn) * step,
      z: from.z + Math.sin(angle + turn) * step,
    };
    if (!validMove(from, candidate, obstacles, floor)) continue;
    // Once overlapping, a step that increases the gap is still useful.
    const gap = Math.min(Infinity, ...nearby.map(b => petGap(candidate, b)));
    if (gap >= clearance || (startGap < clearance && gap > startGap + .001)) return candidate;
  }
  return { x: from.x, z: from.z };
}

/**
 * Resolve an existing overlap (old saves, simultaneous arrivals or a
 * low-framerate jump) with small pushes that avoid furniture and walls.
 * Priority is shared: neither pet is forced to carry all the displacement.
 */
export function separatePetBodies(
  a: FloorPoint, b: FloorPoint, obstacles: readonly FloorRect[],
  floor: FloorRect, clearance = PET_PET_CLEARANCE,
): [FloorPoint, FloorPoint] {
  const gap = petGap(a, b);
  if (gap >= clearance - .0001) return [{ ...a }, { ...b }];
  const ux = gap > .00001 ? (b.x - a.x) / gap : 1;
  const uz = gap > .00001 ? (b.z - a.z) / gap : 0;
  const extra = clearance - gap + .002;
  const shift = (p: FloorPoint, direction: number, amount: number): FloorPoint => ({
    x: p.x + ux * direction * amount, z: p.z + uz * direction * amount,
  });
  const halfA = shift(a, -1, extra / 2);
  const halfB = shift(b, 1, extra / 2);
  if (validMove(a, halfA, obstacles, floor) && validMove(b, halfB, obstacles, floor))
    return [halfA, halfB];

  // At a wall, move only the animal that has open space on its side.
  const wholeA = shift(a, -1, extra);
  if (validMove(a, wholeA, obstacles, floor)) return [wholeA, { ...b }];
  const wholeB = shift(b, 1, extra);
  if (validMove(b, wholeB, obstacles, floor)) return [{ ...a }, wholeB];

  // A tight doorway may block both radial pushes. Find a nearby free
  // direction around one fixed body; prefer the smallest possible move.
  for (const [moving, fixed, reverse] of [[a, b, false], [b, a, true]] as const) {
    let best: FloorPoint | null = null;
    let bestTravel = Infinity;
    for (let index = 0; index < 32; index++) {
      const t = index / 32 * Math.PI * 2;
      const candidate = { x: fixed.x + Math.cos(t) * (clearance + .002),
        z: fixed.z + Math.sin(t) * (clearance + .002) };
      const travel = petGap(moving, candidate);
      if (travel >= bestTravel || !validMove(moving, candidate, obstacles, floor)) continue;
      bestTravel = travel;
      best = candidate;
    }
    if (best) return reverse ? [{ ...a }, best] : [best, { ...b }];
  }
  return [{ ...a }, { ...b }];
}

/** A pet yields to a human instead of walking straight through their legs. */
export function separatePetFromFixed(
  pet: FloorPoint, person: FloorPoint, obstacles: readonly FloorRect[],
  floor: FloorRect, clearance = PET_PERSON_CLEARANCE,
): FloorPoint {
  const distance = petGap(pet, person);
  if (distance >= clearance - .0001) return { ...pet };
  const angle = distance > .00001
    ? Math.atan2(pet.z - person.z, pet.x - person.x) : Math.PI / 2;
  const desired = { x: person.x + Math.cos(angle) * (clearance + .002),
    z: person.z + Math.sin(angle) * (clearance + .002) };
  if (validMove(pet, desired, obstacles, floor)) return desired;
  for (let offset = 1; offset <= 16; offset++) for (const sign of [1, -1]) {
    const theta = angle + sign * offset * Math.PI / 16;
    const candidate = { x: person.x + Math.cos(theta) * (clearance + .002),
      z: person.z + Math.sin(theta) * (clearance + .002) };
    if (validMove(pet, candidate, obstacles, floor)) return candidate;
  }
  return { ...pet };
}
