import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { batchRigidParts } from '../../src/game/ArtKit';
import { decorObstacles } from '../../src/game/HomeStyling';
import { buildFurniture, furnitureFootprints } from '../../src/game/InteriorArt';
import { findRoute, nearestClearPoint, pointIsClear, type FloorRect } from '../../src/game/navigation';
import { PETS, PET_IDS } from '../../src/shared/pets';
import { points, SOCIAL_SPOTS } from '../../src/shared/protocol';

test('both players can reach every interaction around the assembled interior', () => {
  const obstacles: FloorRect[] = [...decorObstacles];
  const furnished = new Map<string, { x: number; z: number }>();
  const counts = { meshes: 0, shadows: 0 };
  const sharedGeometries = new Set<THREE.BufferGeometry>();

  buildFurniture((id, root, point) => {
    assert.deepEqual(point, points[id], id + ' approach must match server coordinates');
    furnished.set(id, point);
    root.traverse((object) => {
      if (object instanceof THREE.Mesh) sharedGeometries.add(object.geometry);
    });
    batchRigidParts(root);
    root.updateMatrixWorld(true);
    const { minX, maxX, minZ, maxZ } = furnitureFootprints[id];
    const obstacle = { minX: minX - 0.27, maxX: maxX + 0.27, minZ: minZ - 0.27, maxZ: maxZ + 0.27 };
    obstacles.push(obstacle);
    const box = new THREE.Box3().setFromObject(root);
    assert.ok(box.min.x >= obstacle.minX && box.max.x <= obstacle.maxX &&
      box.min.z >= obstacle.minZ && box.max.z <= obstacle.maxZ, id + ' must fit its collider');
    root.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return;
      counts.meshes++;
      if (object.castShadow) counts.shadows++;
    });
  });
  assert.deepEqual([...furnished.keys()].sort(), Object.keys(points).sort());

  const destinations = new Map(furnished);
  for (const id of PET_IDS) {
    const { x, z } = PETS[id].home;
    const approach = nearestClearPoint({ x, z: z + 0.78 }, obstacles);
    assert.ok(approach, id + ' must have a reachable approach');
    destinations.set(id, approach);
  }
  for (const [id, point] of Object.entries(SOCIAL_SPOTS)) destinations.set(id + ' social', point);
  const starts = new Map([
    ['Vlad spawn', { x: 0.5, z: 3.5 }],
    ['Alina spawn', { x: 1.65, z: 3.2 }],
    ...destinations,
  ]);
  for (const [id, point] of destinations) {
    assert.ok(pointIsClear(point, obstacles), id + ' interaction anchor blocked');
    for (const [from, start] of starts) {
      assert.ok(findRoute(start, point, obstacles), from + ' cannot reach ' + id);
    }
  }
  assert.ok(counts.meshes <= 135, 'too many furniture meshes: ' + counts.meshes);
  assert.ok(counts.shadows < 45, 'too many furniture shadow casters: ' + counts.shadows);
  assert.ok(sharedGeometries.size <= 9, 'furniture parts should reuse the shared geometry kit');
  console.log('INTERIOR_BUDGET ' + JSON.stringify({ ...counts, sharedGeometries: sharedGeometries.size }));
});
