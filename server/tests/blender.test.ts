import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { Actor } from '../../src/game/Actor';
import { createBlenderCharacter } from '../../src/game/BlenderCharacter';

for (const id of ['vlad', 'alina'] as const) {
  test(`${id}: exported skin and blink load, and the game rig reaches the keyboard`, async () => {
    const buffer = await readFile(new URL(`../../src/assets/characters/${id}.glb`, import.meta.url));
    const gltf = await new GLTFLoader().parseAsync(Uint8Array.from(buffer).buffer, '');
    const model = createBlenderCharacter(gltf, id);
    const actor = new Actor(id, [3.17, 3.65], model);
    const copy = new Actor(id, [3.17, 3.65], model);
    const skins = actor.root.getObjectsByProperty('isSkinnedMesh', true) as THREE.SkinnedMesh[];
    const spareSkins = copy.root.getObjectsByProperty('isSkinnedMesh', true) as THREE.SkinnedMesh[];
    assert.ok(skins.length > 0);
    assert.equal(new Set(skins.map(mesh => mesh.skeleton)).size, 1);
    assert.notEqual(skins[0].skeleton.bones[0], spareSkins[0].skeleton.bones[0]);
    assert.equal(skins[0].geometry, spareSkins[0].geometry);

    const keys = [new THREE.Vector3(3.37, 1.116, 1.896), new THREE.Vector3(3.03, 1.116, 1.896)] as const;
    actor.setFurniturePose('work', new THREE.Vector3(3.2, id === 'vlad' ? -.24 : -.19, 2.47), Math.PI, keys);
    let blinked = false;
    const eye = actor.root.getObjectByName('EyeL')!;
    for (let frame = 0; frame < 168; frame++) {
      actor.update(1 / 60);
      blinked ||= eye.scale.y < .30;
    }
    assert.ok(blinked, 'the Blender eyelid clip should animate the rig');
    for (const [i, bone] of ['WristL', 'WristR'].entries()) {
      const wrist = actor.root.getObjectByName(bone)?.getWorldPosition(new THREE.Vector3());
      assert.ok(wrist && wrist.distanceTo(keys[i]) < 0.065, `${bone} should reach the keys`);
    }
    assert.deepEqual(actor.root.position.toArray(), [3.17, 0, 3.65]);

    actor.setPose('idle');
    actor.walkPath([new THREE.Vector3(3.17, 0, 4.3)], () => {});
    for (let frame = 0; frame < 90; frame++) actor.update(1 / 60);
    assert.deepEqual(actor.root.position.toArray(), [3.17, 0, 4.3]);
    assert.ok(actor.root.children[0].position.length() < .01);
  });
}
