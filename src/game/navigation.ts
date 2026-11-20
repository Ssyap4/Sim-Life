export interface FloorPoint { x: number; z: number }
export interface FloorRect { minX: number; maxX: number; minZ: number; maxZ: number }

const ROOM: FloorRect = { minX: -5.62, maxX: 5.62, minZ: -4.62, maxZ: 4.62 };
const CELL = 0.32;

export interface WalkRoute { from: FloorPoint; path: FloorPoint[] }

export function sampleWalk(route: WalkRoute, distance: number): WalkRoute {
  let from = route.from;
  for (let i = 0; i < route.path.length; i++) {
    const to = route.path[i];
    const span = Math.hypot(to.x - from.x, to.z - from.z);
    if (span > distance) {
      const t = distance / span;
      return { from: { x: from.x + (to.x - from.x) * t, z: from.z + (to.z - from.z) * t }, path: route.path.slice(i) };
    }
    distance -= span;
    from = to;
  }
  return { from, path: [] };
}

export function planWalk(from: FloorPoint, to: FloorPoint, obstacles: readonly FloorRect[], room: FloorRect = ROOM): WalkRoute | null {
  const origin = nearestClearPoint(from, obstacles, room);
  const target = nearestClearPoint(to, obstacles, room);
  const path = origin && target && findRoute(origin, target, obstacles, room);
  return origin && path ? { from: origin, path } : null;
}

export function pointIsClear(point: FloorPoint, obstacles: readonly FloorRect[], room: FloorRect = ROOM): boolean {
  if (point.x < room.minX || point.x > room.maxX || point.z < room.minZ || point.z > room.maxZ) return false;
  return !obstacles.some((o) => point.x >= o.minX && point.x <= o.maxX && point.z >= o.minZ && point.z <= o.maxZ);
}

export function segmentIsClear(a: FloorPoint, b: FloorPoint, obstacles: readonly FloorRect[], room: FloorRect = ROOM): boolean {
  if (!pointIsClear(a, obstacles, room) || !pointIsClear(b, obstacles, room)) return false;
  const dx = b.x - a.x, dz = b.z - a.z;
  // Exact continuous 2D segment/AABB intersection. The old .12m sampling
  // silently missed narrow corner crossings between sample points, so a
  // route could pass a planning check yet be blocked by frame-by-frame steps.
  // This is also cheaper than sampling dozens of points for long routes.
  for (const o of obstacles) {
    let enter = 0, exit = 1;
    if (Math.abs(dx) < 1e-12) {
      if (a.x < o.minX || a.x > o.maxX) continue;
    } else {
      const t0 = (o.minX - a.x) / dx, t1 = (o.maxX - a.x) / dx;
      enter = Math.max(enter, Math.min(t0, t1));
      exit = Math.min(exit, Math.max(t0, t1));
      if (enter > exit) continue;
    }
    if (Math.abs(dz) < 1e-12) {
      if (a.z < o.minZ || a.z > o.maxZ) continue;
    } else {
      const t0 = (o.minZ - a.z) / dz, t1 = (o.maxZ - a.z) / dz;
      enter = Math.max(enter, Math.min(t0, t1));
      exit = Math.min(exit, Math.max(t0, t1));
    }
    if (enter <= exit && enter <= 1 && exit >= 0) return false;
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

  // Seed only nearby cells, including alternatives around furniture edges.
  const radius = CELL * 2.2;
  const firstCol = Math.max(0, Math.ceil((start.x - radius - room.minX) / CELL));
  const lastCol = Math.min(cols - 1, Math.floor((start.x + radius - room.minX) / CELL));
  const firstRow = Math.max(0, Math.ceil((start.z - radius - room.minZ) / CELL));
  const lastRow = Math.min(rows - 1, Math.floor((start.z + radius - room.minZ) / CELL));
  for (let row = firstRow; row <= lastRow; row++) for (let col = firstCol; col <= lastCol; col++) {
    const index = row * cols + col;
    const point = position(index);
    const cost = distance(start, point);
    if (cost <= radius && segmentIsClear(start, point, obstacles, room)) {
      g[index] = cost;
      open.add(index);
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
