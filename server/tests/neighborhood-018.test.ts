import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { NEIGHBOR_PATH, NEIGHBORS, neighborVisits, neighborDoorOpen } from '../../src/shared/neighbors';
import { NeighborPeople } from '../../src/game/NeighborPeople';
import { buildNeighborhood, NEIGHBOR_HOMES } from '../../src/game/NeighborhoodArt';

test('0.18 background homes are one rear, one east, two west with generous real spacing', () => {
  assert.equal(NEIGHBOR_HOMES.length, 4);
  assert.equal(NEIGHBOR_HOMES.filter(home => home.side === 'west').length, 2);
  assert.equal(NEIGHBOR_HOMES.filter(home => home.side === 'east').length, 1);
  assert.equal(NEIGHBOR_HOMES.filter(home => home.side === 'rear').length, 1);
  assert.equal(new Set(NEIGHBOR_HOMES.map(home => home.id)).size, 4);
  assert.equal(new Set(NEIGHBOR_HOMES.map(home => home.plaster)).size, 4);
  assert.equal(new Set(NEIGHBOR_HOMES.map(home => home.roof)).size, 4);

  const [west, back, , east] = NEIGHBOR_PATH;
  const western = NEIGHBOR_HOMES.filter(home => home.side === 'west');
  const gap = Math.abs(western[0].z - western[1].z) - (western[0].width + western[1].width) / 2;
  assert.ok(gap > 14, 'western properties must not look like a tight row');
  for (const home of NEIGHBOR_HOMES) {
    if (home.side === 'west')
      assert.ok(home.x + home.depth / 2 + 3 < west.x - 5, 'west property clear of walkway');
    if (home.side === 'east')
      assert.ok(home.x - home.depth / 2 - 3 > east.x + 5, 'east property clear of walkway');
    if (home.side === 'rear')
      assert.ok(home.z + home.depth / 2 + 3 < back.z - 5, 'rear property clear of walkway');
  }
});

test('0.18 neighborhood remains one static, noninteractive scene and is batched on mobile', () => {
  const scene = new THREE.Scene();
  buildNeighborhood(scene);
  assert.equal(scene.children.length, 1);
  const root = scene.children[0];
  assert.equal(root.name.includes('0.18'), true);
  const houses = root.children.filter(child => child.name.startsWith('Фоновый дом'));
  assert.equal(houses.length, 4);
  let meshes = 0;
  root.traverse(obj => {
    if (!(obj instanceof THREE.Mesh)) return;
    meshes++;
    assert.equal(obj.userData.interactable, undefined);
    assert.equal(obj.castShadow, false, 'distant decorative houses should not cast shadow maps');
  });
  assert.ok(meshes < 70, 'batching should avoid one draw call per small visual part: ' + meshes);
  const box = new THREE.Box3().setFromObject(root);
  assert.ok(box.min.x < -32 && box.max.x > 37);
  assert.ok(box.min.z < -29, 'back cottage is beyond the public rear path');
});

test('each household has a genuinely hinged door opening before exits and after returns', () => {
  const scene=new THREE.Scene();
  buildNeighborhood(scene);
  const crowd=new NeighborPeople();
  crowd.bindDoors(scene);
  const events=neighborVisits(0,NEIGHBORS.length);
  assert.equal(new Set(events.map(e=>e.home)).size,4);
  for(let home=0;home<NEIGHBOR_HOMES.length;home++) {
    const first=events.find(e=>e.home===home)!;
    assert.ok(first);
    const hinge=scene.getObjectByName('neighbor-door-'+NEIGHBOR_HOMES[home].id) as THREE.Group;
    assert.ok(hinge && hinge.children.length>=1,'door must be a separate animated pivot');
    crowd.update(first.start);
    assert.ok(hinge.rotation.y<-.90,'door should be visibly open when someone emerges');
    assert.ok(neighborDoorOpen(home,first.start,NEIGHBORS.length)>.85);
    crowd.update(first.end-1.3);
    assert.ok(hinge.rotation.y<-.55,'door should be open when someone comes home');
    crowd.update(first.end+8);
    assert.ok(Math.abs(hinge.rotation.y)<.001,'door closes behind each outing');
  }
});

test('refined neighbor models have sculpted human faces, textured eyes and individual outfits', () => {
  const crowd=new NeighborPeople();
  let faceCount=0,eyes=0,heads=0;
  for(const resident of crowd.group.children) {
    const head=resident.getObjectByName('neighbor-head') as THREE.Group;
    assert.ok(head,'articulated neck and head');
    heads++;
    let hasFace=false,hasEye=false;
    head.traverse(obj=>{
      if(!(obj instanceof THREE.Mesh))return;
      const mesh=obj as THREE.Mesh;
      const verts=mesh.geometry.getAttribute('position')?.count??0;
      if(verts>450)hasFace=true;
      // Headless Node cannot create CanvasTexture, but can verify the
      // shared human-eye aperture geometry used by textured browser eyes.
      if(verts===85)hasEye=true;
    });
    faceCount+=Number(hasFace);
    eyes+=Number(hasEye);
  }
  assert.equal(heads,14);
  assert.equal(faceCount,14,'no primitive single-ball heads');
  assert.equal(eyes,14,'distinct illustrated eye details instead of dot eyes');
});
