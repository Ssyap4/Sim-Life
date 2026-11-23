import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { PetActor } from '../../src/game/PetActor';
import { SimbaRig } from '../../src/game/SimbaRig';
import { catPerchCandidates } from '../../src/shared/CatPerches';
import { initialState } from '../../src/shared/protocol';

test('the exported Simba rig plants its paws and reaches a physical cushion before resuming its route', async () => {
  const file = new URL('../../src/assets/pets/simba.glb', import.meta.url);
  const bytes = await readFile(file);
  const { scene } = await new GLTFLoader().parseAsync(Uint8Array.from(bytes).buffer, '');
  let triangles = 0, meshes = 0;
  scene.traverse(part => {
    if (part instanceof THREE.SkinnedMesh) {
      meshes++;
      triangles += (part.geometry.index?.count ?? 0) / 3;
    }
  });
  assert.equal(meshes, 2, 'keep two draw calls for the mobile coat and eyes');
  assert.ok(triangles > 0 && triangles < 12000, 'keep the mobile geometry budget');

  const simba = new PetActor('simba', new SimbaRig(scene));
  const [sofa, bed] = catPerchCandidates(initialState().furnishing);
  for (const perch of [sofa, bed]) {
    simba.syncGround(perch.approach.x, perch.approach.z);
    simba.update(.02);
    const bounds = () => {
      simba.root.updateMatrixWorld(true);
      return new THREE.Box3().setFromObject(scene, true);
    };
    assert.ok(Math.abs(bounds().min.y) < .055, `ground height ${bounds().min.y}`);
    const cushion = perch.surface.y - .055;
    simba.followRoute([], 'perch', undefined, perch, undefined, false, cushion);
    for (let i = 0; i < 35; i++) simba.update(.04);
    assert.ok(Math.abs(bounds().min.y - cushion) < .095, `cushion height ${bounds().min.y} vs ${cushion}`);
    assert.deepEqual(simba.root.position.toArray(), [perch.approach.x, 0, perch.approach.z]);

    const exit = new THREE.Vector3(perch.approach.x + 1, 0, perch.approach.z);
    simba.followRoute([exit], 'wander');
    simba.update(.1);
    assert.equal(simba.root.position.x, perch.approach.x, 'floor route waits for the landing');
    for (let i = 0; i < 56; i++) simba.update(.04);
    assert.ok(simba.root.position.distanceTo(exit) < .04);
    simba.stop();
  }
});
