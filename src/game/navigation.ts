export interface FloorPoint { x: number; z: number }
export interface FloorRect { minX: number; maxX: number; minZ: number; maxZ: number }

const ROOM: FloorRect = { minX: -5.62, maxX: 5.62, minZ: -4.62, maxZ: 4.62 };
const CELL = 0.32;
const STEP = 0.12;

export function pointIsClear(point: FloorPoint, obstacles: readonly FloorRect[], room: FloorRect = ROOM): boolean {
  if (point.x < room.minX || point.x > room.maxX || point.z < room.minZ || point.z > room.maxZ) return false;
  return !obstacles.some((o) => point.x >= o.minX && point.x <= o.maxX && point.z >= o.minZ && point.z <= o.maxZ);
}

export function segmentIsClear(a: FloorPoint, b: FloorPoint, obstacles: readonly FloorRect[], room: FloorRect = ROOM): boolean {
  const distance = Math.hypot(a.x - b.x, a.z - b.z);
  const steps = Math.max(1, Math.ceil(distance / STEP));
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    if (!pointIsClear({ x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t }, obstacles, room)) return false;
  }
  return true;
}

/** Move old saved positions out of furniture without rewriting server saves. */
export function nearestClearPoint(
  point: FloorPoint, obstacles: readonly FloorRect[], room: FloorRect = ROOM,
): FloorPoint | null {
  if (pointIsClear(point, obstacles, room)) return { ...point };
  for (let radius = 0.15; radius <= 2.4; radius += 0.15) {
    for (let i = 0; i < 32; i++) {
      const angle = (i / 32) * Math.PI * 2;
      const candidate = { x: point.x + Math.cos(angle) * radius, z: point.z + Math.sin(angle) * radius };
      if (pointIsClear(candidate, obstacles, room)) return candidate;
    }
  }
  return null;
}

/**
 * Small-room A* planner. Obstacles already contain actor clearance.
 * Returned waypoints include the exact destination and never intersect furniture.
 * No navmesh or runtime dependency; suitable for low-end mobile browsers.
 */
export function findRoute(
  start: FloorPoint,
  target: FloorPoint,
  obstacles: readonly FloorRect[],
  room: FloorRect = ROOM,
): FloorPoint[] | null {
  if (!pointIsClear(start, obstacles, room) || !pointIsClear(target, obstacles, room)) return null;
  if (segmentIsClear(start, target, obstacles, room)) return [{ ...target }];

  const cols = Math.floor((room.maxX - room.minX) / CELL) + 1;
  const rows = Math.floor((room.maxZ - room.minZ) / CELL) + 1;
  const total = cols * rows;
  const position = (i: number): FloorPoint => ({
    x: room.minX + (i % cols) * CELL,
    z: room.minZ + Math.floor(i / cols) * CELL,
  });
  const g = new Float64Array(total).fill(Infinity);
  const parent = new Int32Array(total).fill(-1);
  const open = new Set<number>();
  const done = new Uint8Array(total);
  const distance = (a: FloorPoint, b: FloorPoint): number => Math.hypot(a.x - b.x, a.z - b.z);

  // Several visible seed cells avoid a blocked nearest grid cell at a furniture edge.
  for (let i = 0; i < total; i++) {
    const p = position(i);
    const cost = distance(start, p);
    if (cost <= CELL * 2.2 && segmentIsClear(start, p, obstacles, room)) {
      g[i] = cost;
      open.add(i);
    }
  }
  if (!open.size) return null;

  const directions = [[-1, -1], [-1, 0], [-1, 1], [0, -1],
    [0, 1], [1, -1], [1, 0], [1, 1]] as const;

  while (open.size) {
    let best = -1;
    let score = Infinity;
    for (const i of open) {
      const s = g[i] + distance(position(i), target);
      if (s < score) { score = s; best = i; }
    }
    if (best === -1) break;
    open.delete(best);
    if (done[best]) continue;
    done[best] = 1;
    const current = position(best);

    if (segmentIsClear(current, target, obstacles, room)) {
      const chain: FloorPoint[] = [{ ...target }];
      let cursor = best;
      while (cursor !== -1) {
        chain.push(position(cursor));
        cursor = parent[cursor];
      }
      chain.push({ ...start });
      chain.reverse();

      // Remove grid zigzags without allowing a line through furniture.
      const simplified: FloorPoint[] = [];
      let from = 0;
      while (from < chain.length - 1) {
        let to = chain.length - 1;
        while (to > from + 1 && !segmentIsClear(chain[from], chain[to], obstacles, room)) to--;
        simplified.push(chain[to]);
        from = to;
      }
      return simplified;
    }

    const col = best % cols;
    const row = Math.floor(best / cols);
    for (const [dx, dz] of directions) {
      const c = col + dx;
      const r = row + dz;
      if (c < 0 || c >= cols || r < 0 || r >= rows) continue;
      const next = r * cols + c;
      if (done[next]) continue;
      const p = position(next);
      if (!segmentIsClear(current, p, obstacles, room)) continue;
      const cost = g[best] + distance(current, p);
      if (cost < g[next]) {
        g[next] = cost;
        parent[next] = best;
        open.add(next);
      }
    }
  }
  return null;
}
