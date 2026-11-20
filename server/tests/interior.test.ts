import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { batchRigidParts } from '../../src/game/ArtKit';
import { EAST_WALL, HOME_FLOOR, HOME_FURNITURE, HOME_DOORS, KITCHEN_WORK } from '../../src/shared/home';
import { placeObstacles, spawn } from '../../src/shared/locations';
import { buildFurniture, buildPersonalFurniture } from '../../src/game/InteriorArt';
import { buildYard } from '../../src/game/YardArt';
import { findRoute, pointIsClear, segmentIsClear, type FloorRect } from '../../src/game/navigation';
import { PETS, PET_IDS, petApproach } from '../../src/shared/pets';
import { points, SOCIAL_SPOTS } from '../../src/shared/protocol';

test('both players can reach every interaction around the assembled interior', () => {
  const obstacles: FloorRect[] = placeObstacles('home');
  const furnished = new Map<string, { x: number; z: number }>();
  const counts = { meshes: 0, shadows: 0 };
  const sharedGeometries = new Set<THREE.BufferGeometry>();

  const register: Parameters<typeof buildFurniture>[0] = (id, root, point) => {
    assert.deepEqual(point, points[id], id + ' approach must match server coordinates');
    furnished.set(id, point);
    if (id !== 'bookcase' && id !== 'grill' && id !== 'yardTable') root.traverse((object) => {
      if (object instanceof THREE.Mesh) sharedGeometries.add(object.geometry);
    });
    else assert.ok(root.children.length <= 9, id + ' should stay batched');
    batchRigidParts(root);
    root.updateMatrixWorld(true);
    if (id !== 'shower') {
      const { minX, maxX, minZ, maxZ } = HOME_FURNITURE[id];
      const box = new THREE.Box3().setFromObject(root);
      assert.ok(box.min.x >= minX - .27 && box.max.x <= maxX + .27 &&
        box.min.z >= minZ - .27 && box.max.z <= maxZ + .27, id + ' must fit its collider');
    }
    root.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return;
      counts.meshes++;
      if (object.castShadow) counts.shadows++;
    });
  };
  buildFurniture(register);
  buildPersonalFurniture(new THREE.Scene(), library => register('bookcase',library,points.bookcase));
  const yard = buildYard(new THREE.Scene());
  register('grill', yard.grill, points.grill);
  register('yardTable', yard.table, points.yardTable);
  assert.deepEqual([...furnished.keys()].sort(), Object.keys(points).sort());

  const destinations = new Map(furnished);
  for (const id of PET_IDS) {
    const approach = petApproach(PETS[id].home, obstacles, HOME_FLOOR);
    assert.ok(approach, id + ' must have a reachable approach');
    destinations.set(id, approach);
  }
  for (const [id, point] of Object.entries(SOCIAL_SPOTS)) destinations.set(id + ' social', point);
  for (const [name, work] of Object.entries(KITCHEN_WORK)) destinations.set(name, work.position);
  const starts = new Map([
    ['yard', { x: 1, z: 9.02 }],
    ['spare room', { x: -7, z: .35 }],
    ...Object.entries(HOME_DOORS).map(([name, door]) => [name + ' threshold', { x: door.x, z: door.z }] as const),
    ['Vlad spawn', spawn('home', 'vlad')],
    ['Alina spawn', spawn('home', 'alina')],
    ...destinations,
  ]);
  for (const [id, point] of destinations) {
    assert.ok(pointIsClear(point, obstacles, HOME_FLOOR), id + ' interaction anchor blocked');
    for (const [from, start] of starts) {
      assert.ok(findRoute(start, point, obstacles, HOME_FLOOR), from + ' cannot reach ' + id);
    }
  }
  assert.ok(counts.meshes <= 135, 'too many furniture meshes: ' + counts.meshes);
  assert.ok(counts.shadows < 45, 'too many furniture shadow casters: ' + counts.shadows);
  assert.ok(sharedGeometries.size <= 11, 'furniture parts should reuse the shared geometry kit');
  console.log('INTERIOR_BUDGET ' + JSON.stringify({ ...counts, sharedGeometries: sharedGeometries.size }));
});

test('The bathroom is entered through its doorway and the shower is entered from the open side', () => {
  const obstacles = placeObstacles('home');
  const livingSide = { x: EAST_WALL - .84, z: 1.00 };
  const bathroomSide = { x: EAST_WALL + .81, z: 1.00 };
  assert.ok(pointIsClear(livingSide, obstacles, HOME_FLOOR));
  assert.ok(pointIsClear(bathroomSide, obstacles, HOME_FLOOR));
  assert.equal(segmentIsClear(livingSide, bathroomSide, obstacles, HOME_FLOOR), false);
  const throughDoor = findRoute(livingSide, bathroomSide, obstacles, HOME_FLOOR);
  assert.ok(throughDoor && throughDoor.length > 1);
  assert.ok(segmentIsClear({ x: 7.27, z: .55 }, points.shower, obstacles, HOME_FLOOR));
  assert.equal(segmentIsClear({ x: 8.08, z: 1.63 }, points.shower, obstacles, HOME_FLOOR), false);
});
