import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { buildFurniture } from '../../src/game/InteriorArt';
import { findRoute, pointIsClear, type FloorRect } from '../../src/game/navigation';

test('all six furnished interaction points remain reachable with their actual new bounds', () => {
  const obstacles: FloorRect[] = [];
  const anchors = new Map<string, {x: number;z: number}>();
  const counts = { meshes: 0, shadows: 0 };
  const geometries = new Set<THREE.BufferGeometry>();
  const furniture: string[] = [];

  buildFurniture((id, root, point) => {
    furniture.push(id);
    anchors.set(id, point);
    root.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(root);
    obstacles.push({
      minX: box.min.x - 0.27, maxX: box.max.x + 0.27,
      minZ: box.min.z - 0.27, maxZ: box.max.z + 0.27,
    });
    root.traverse((obj) => {
      if (obj instanceof THREE.Mesh) {
        counts.meshes++;
        if (obj.castShadow) counts.shadows++;
        geometries.add(obj.geometry);
      }
    });
  });
  assert.deepEqual(furniture, ['sofa','bed','kitchen','desk','tv','table']);
  obstacles.push(
    {minX:4.70,maxX:5.35,minZ:-0.26,maxZ:0.38},
    {minX:4.47,maxX:5.62,minZ:2.77,maxZ:4.05},
  );
  const starts = [{x:0.5,z:3.5},{x:1.65,z:3.2}];
  for(const [id, point] of anchors) {
    assert.ok(pointIsClear(point,obstacles), id + ' interaction anchor blocked');
    for(const start of starts) {
      assert.ok(findRoute(start,point,obstacles), id + ' unreachable from ' + JSON.stringify(start));
    }
  }
  assert.ok(counts.meshes < 270, 'too many meshes: '+counts.meshes);
  assert.ok(counts.shadows < 45, 'too many shadow casters: '+counts.shadows);
  assert.ok(geometries.size <= 6, 'geometries should be shared: '+geometries.size);
  console.log('INTERIOR_BUDGET '+JSON.stringify({...counts, sharedGeometries:geometries.size}));
});
