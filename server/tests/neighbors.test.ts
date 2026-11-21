import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { NEIGHBORS, neighborPose } from '../../src/shared/neighbors';
import { HOUSE, HOUSE_WING, HOME_FLOOR, HOME_PLACEMENTS, KITCHEN_WORK } from '../../src/shared/home';
import { buildFurniture } from '../../src/game/InteriorArt';
import { NeighborPeople } from '../../src/game/NeighborPeople';
import { buildNeighborhood } from '../../src/game/NeighborhoodArt';
import { buildHomeWing } from '../../src/game/HomeWing';
import { findRoute, pointIsClear, segmentIsClear } from '../../src/game/navigation';
import { placeObstacles } from '../../src/shared/locations';

test('three new rooms are connected to the original office by walkable doors', () => {
  const blocks = placeObstacles('home');
  const origin = { x: 7.50, z: -2.25 };
  const destinations = [
    { x: 12.55, z: -5.45 }, // back room
    { x: 12.55, z: -1.60 }, // central landing
    { x: 12.55, z: 2.15 }, // forward room
  ];
  assert.equal(HOUSE.maxX, HOUSE_WING.minX, 'the new wing must meet the old wall');
  for (const destination of destinations) {
    assert.ok(pointIsClear(destination, blocks, HOME_FLOOR), 'room must be free');
    assert.ok(findRoute(origin, destination, blocks, HOME_FLOOR), 'room door must be reachable');
  }
  assert.equal(segmentIsClear(origin, destinations[1], blocks, HOME_FLOOR), true,
    'office-to-wing doorway should not be blocked');
  assert.equal(segmentIsClear({ x: 10.4, z: -5.45 }, { x: 10.4, z: 2.15 }, blocks, HOME_FLOOR), false,
    'partitions should require doorways away from their openings');
});

test('tea and coffee machines have independent click geometry and clear counters', () => {
  const objects = new Map<string, THREE.Box3>();
  buildFurniture((id, root) => {
    root.updateMatrixWorld(true);
    objects.set(id, new THREE.Box3().setFromObject(root));
  });
  assert.ok(objects.get('kettle'));
  assert.ok(objects.get('coffeeMaker'));
  const kettle = objects.get('kettle')!;
  const coffee = objects.get('coffeeMaker')!;
  assert.equal(kettle.intersectsBox(coffee), false, 'the appliances must not overlap');
  assert.ok(Math.abs(HOME_PLACEMENTS.coffeeMaker.x - HOME_PLACEMENTS.kettle.x) > 1.4);
  assert.ok(pointIsClear(KITCHEN_WORK.tea.position, placeObstacles('home'), HOME_FLOOR));
  assert.ok(pointIsClear(KITCHEN_WORK.coffee.position, placeObstacles('home'), HOME_FLOOR));
});

test('neighbors are distinct, deterministic, safe outside the private property and capped by time of day', () => {
  assert.equal(NEIGHBORS.length, 14);
  assert.equal(new Set(NEIGHBORS.map(p => p.name)).size, 14);
  for (const minute of [8*60, 12*60, 17*60, 19*60, 23*60, 25*60, 28*60]) {
    const poses = NEIGHBORS.map((_,index) => neighborPose(index, minute));
    const hour = minute % 1440 / 60;
    const cap = hour < 6 || hour >= 22 ? 1 : hour < 9 ? 4 : hour < 18 ? 7 : 5;
    assert.ok(poses.filter(p => p.visible).length <= cap);
    for (const [index, pose] of poses.entries()) {
      assert.deepEqual(pose, neighborPose(index,minute));
      if (!pose.visible) continue;
      assert.ok(pose.x < HOUSE.minX - .5 || pose.x > HOUSE_WING.maxX + .5
        || pose.z < HOUSE.minZ - .5, NEIGHBORS[index].name + ' entered private property');
    }
  }
});

test('two residents meet, face each other and talk before resuming their paths', () => {
  // Day one, 08:30: the paired wanderers meet on the public rear sidewalk.
  const a = neighborPose(0, 510);
  const b = neighborPose(1, 510);
  assert.equal(a.action, 'chat');
  assert.equal(b.action, 'chat');
  assert.equal(a.visible, true);
  assert.equal(b.visible, true);
  assert.ok(Math.hypot(a.x - b.x, a.z - b.z) < 1.7);
  assert.ok(a.yaw > 1 && b.yaw < -1);
  assert.equal(neighborPose(0, 530).action, 'walk');
});

test('sidewalks, wing and all 14 articulated NPCs remain lightweight and noninteractive', () => {
  const scene = new THREE.Scene();
  buildHomeWing(scene);
  buildNeighborhood(scene);
  assert.equal(scene.children.length, 2);
  const crowd = new NeighborPeople();
  assert.equal(crowd.group.children.length, NEIGHBORS.length);
  crowd.update(12 * 60);
  let shown = 0, activeMeshes = 0;
  for (const person of crowd.group.children) {
    if (!person.visible) continue;
    shown++;
    person.traverse(obj => { if (obj instanceof THREE.Mesh && obj.visible) activeMeshes++; });
    assert.equal(person.userData.interactable, undefined);
  }
  assert.equal(shown, 7);
  assert.ok(activeMeshes < 85, 'animated crowd should have a small draw-call budget');
});

test('idling NPCs genuinely pause rather than sliding while using their phone', () => {
  let stop: number | undefined;
  for (let minute = 12 * 60; minute < 13 * 60; minute += .1) {
    if (neighborPose(3, minute).action !== 'walk' &&
        neighborPose(3, minute + .2).action !== 'walk') {
      stop = minute; break;
    }
  }
  assert.ok(stop !== undefined, 'should encounter a scheduled stop');
  const before = neighborPose(3, stop);
  const after = neighborPose(3, stop + .2);
  assert.ok(Math.hypot(before.x - after.x, before.z - after.z) < .0001);
});
