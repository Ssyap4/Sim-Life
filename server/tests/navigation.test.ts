import assert from 'node:assert/strict';
import test from 'node:test';
import { findRoute, nearestClearPoint, pointIsClear, segmentIsClear, type FloorPoint, type FloorRect } from '../../src/game/navigation';

const room: FloorRect = { minX: -4, maxX: 4, minZ: -3, maxZ: 3 };
const obstacle: FloorRect = { minX: -0.6, maxX: 0.6, minZ: -1, maxZ: 1 };

function assertSafeRoute(start: FloorPoint, target: FloorPoint, blocks: FloorRect[], route: FloorPoint[]): void {
  assert.deepEqual(route.at(-1), target);
  let previous = start;
  for (const point of route) {
    assert.ok(segmentIsClear(previous, point, blocks, room), 'Every segment stays outside furniture and walls');
    previous = point;
  }
}

test('unobstructed targets use a single direct waypoint', () => {
  const start = { x: -2, z: -2 };
  const target = { x: 2, z: -2 };
  assert.deepEqual(findRoute(start, target, [obstacle], room), [target]);
});

test('a character navigates around furniture instead of walking through it', () => {
  const start = { x: -2, z: 0 };
  const target = { x: 2, z: 0 };
  const route = findRoute(start, target, [obstacle], room);
  assert.ok(route && route.length > 1);
  assertSafeRoute(start, target, [obstacle], route);
});

test('a narrow route around multiple pieces of furniture remains collision-free', () => {
  const blocks = [
    { minX: -1.7, maxX: -0.5, minZ: -1.2, maxZ: 1.8 },
    { minX: 0.4, maxX: 1.8, minZ: -1.8, maxZ: 1.0 },
  ];
  const start = { x: -3, z: 0 };
  const target = { x: 3, z: 0 };
  const route = findRoute(start, target, blocks, room);
  assert.ok(route);
  assertSafeRoute(start, target, blocks, route);
});

test('old saved character positions inside furniture recover to a free nearby space', () => {
  const original = { x: 0, z: 0 };
  const safe = nearestClearPoint(original, [obstacle], room);
  assert.ok(safe);
  assert.ok(pointIsClear(safe, [obstacle], room));
  assert.ok(Math.hypot(safe.x - original.x, safe.z - original.z) < 2);
});

test('unreachable locations or goals inside furniture are rejected', () => {
  const wall: FloorRect = { minX: -0.3, maxX: 0.3, minZ: -3, maxZ: 3 };
  assert.equal(findRoute({ x: -2, z: 0 }, { x: 2, z: 0 }, [wall], room), null);
  assert.equal(findRoute({ x: -2, z: 0 }, { x: 0, z: 0 }, [obstacle], room), null);
  assert.equal(findRoute({ x: -5, z: 0 }, { x: 2, z: 0 }, [], room), null);
});
