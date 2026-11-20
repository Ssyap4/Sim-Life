import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Vector3 } from 'three';
import { Actor } from '../../src/game/Actor';
import { pointIsClear, type FloorRect } from '../../src/game/navigation';
import { residentStep, RESIDENT_CLEARANCE } from '../../src/game/residentCollision';
import { furnitureBounds, homeSeat } from '../../src/shared/home';
import { initialState, points } from '../../src/shared/protocol';
import { applyWorld } from '../locations';

test('Both actors pass head-on through a doorway without crossing bodies or walls', () => {
  const floor = { minX: -3, maxX: 3, minZ: -2, maxZ: 2 };
  const walls: FloorRect[] = [
    { minX: -.19, maxX: .19, minZ: -2, maxZ: -.68 },
    { minX: -.19, maxX: .19, minZ: .68, maxZ: 2 },
  ];
  for (const dt of [1 / 60, .08, .20]) {
    const vlad = new Actor('vlad', [-2, 0]);
    const alina = new Actor('alina', [2, 0]);
    let arrived = 0;
    vlad.walkPath([new Vector3(2, 0, 0)], () => arrived++);
    alina.walkPath([new Vector3(-2, 0, 0)], () => arrived++);
    for (let elapsed = 0; elapsed < 10 && arrived < 2; elapsed += dt) {
      for (const [actor, other] of [[vlad, alina], [alina, vlad]]) {
        actor.update(dt, (from, target) => residentStep(from, target, other.root.position, walls, floor));
        assert.ok(actor.root.position.distanceTo(other.root.position) >= RESIDENT_CLEARANCE - 1e-6);
        assert.ok(pointIsClear(actor.root.position, walls, floor));
      }
    }
    assert.equal(arrived, 2);
  }
});

test('Co-op approaches to the same store checkout keep two valid positions', () => {
  let state = initialState();
  for (const role of ['vlad', 'alina'] as const) {
    const travel = applyWorld(state, role, { type: 'travel', place: 'market' }, true);
    assert.ok(travel.ok);
    const walk = applyWorld(travel.state, role, { type: 'approach', place: 'market', station: 'checkout' }, true);
    assert.ok(walk.ok);
    state = walk.state;
  }
  const { vlad, alina } = state.characters;
  assert.ok(Math.hypot(vlad.x - alina.x, vlad.z - alina.z) >= RESIDENT_CLEARANCE);
  const pay = applyWorld(state, 'alina', { type: 'store_pay', sequence: 0,
    lines: [{ id: 'grocery:bread', quantity: 1 }] }, true);
  assert.ok(pay.ok);
});

test('Furniture positions translate the collision box and seat together', () => {
  const original = furnitureBounds('yardTable');
  const layout = { yardTable: { x: -1.68, z: 7.43 } };
  const translated = furnitureBounds('yardTable', layout);
  assert.ok(Math.abs(translated.minX - original.minX - 1) < 1e-9);
  assert.ok(Math.abs(translated.maxZ - original.maxZ - 1) < 1e-9);
  const stand = homeSeat('yardTable', 'alina').approach;
  const moved = homeSeat('yardTable', 'alina', layout).approach;
  assert.ok(Math.abs(moved.x - stand.x - 1) < 1e-9 && Math.abs(moved.z - stand.z - 1) < 1e-9);
  assert.notDeepEqual(points.yardTable, moved);
});
