import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { PetActor } from '../../src/game/PetActor';
import { SimbaRig } from '../../src/game/SimbaRig';
import { catPerchCandidates } from '../../src/shared/CatPerches';
import { initialState } from '../../src/shared/protocol';

async function loadModel() {
  const file = new URL('../../src/assets/pets/simba.glb', import.meta.url);
  const bytes = await readFile(file);
  return (await new GLTFLoader().parseAsync(Uint8Array.from(bytes).buffer, '')).scene;
}

test('the exported Simba rig plants its paws and reaches a physical cushion before resuming its route', async () => {
  const scene = await loadModel();
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
    const awakeHead = scene.getObjectByName('Head')!.position.y;
    const cushion = perch.surface.y - .085;
    simba.followRoute([], 'perch', undefined, perch, undefined, false, cushion);
    for (let i = 0; i < 35; i++) simba.update(.04);
    // Authored curl folds the paws and tail below the old standing AABB.
    // Check real support bones, using the same cushion offset as World.
    assert.ok(Math.abs(bounds().min.y - cushion) < .16, `cushion height ${bounds().min.y} vs ${cushion}`);
    for(const name of ['ForeLPaw','ForeRPaw','HindLPaw','HindRPaw']){
      const y=scene.getObjectByName(name)!.getWorldPosition(new THREE.Vector3()).y;
      assert.ok(y>cushion-.13&&y<cushion+.25, name+' cushion contact '+y);
    }
    assert.ok(scene.getObjectByName('Head')!.position.y < awakeHead-.015,
      'lying on upholstery must tuck the real rig head toward its chest');
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

test('Simba reaches the installed scratching post from the saved floor approach', async () => {
  const scene = await loadModel();
  const simba = new PetActor('simba', new SimbaRig(scene));
  const post = {x:1.12,z:1.84};
  simba.syncGround(post.x,post.z+.84);
  simba.followRoute([], 'scratch', Math.PI, undefined, undefined, false, undefined, post);
  for (let i = 0; i < 45; i++) simba.update(.04);
  const paw = scene.getObjectByName('ForeLPaw')!.getWorldPosition(new THREE.Vector3());
  assert.ok(paw.y>.40 && paw.y<.75);
  assert.ok(Math.hypot(paw.x-post.x,paw.z-post.z)<.22, 'the forepaw must reach the rope');
  const rearL=scene.getObjectByName('HindLPaw')!.getWorldPosition(new THREE.Vector3());
  const rearR=scene.getObjectByName('HindRPaw')!.getWorldPosition(new THREE.Vector3());
  for(const hind of [rearL,rearR])assert.ok(hind.y>=-.035&&hind.y<.18,
    'hind paws must bear weight close to the floor, not hover during scratching: '+hind.y);
  assert.equal(simba.root.position.z,post.z+.84);
});
