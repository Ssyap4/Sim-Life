import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {initialState} from '../../src/shared/protocol';
import {catPerchCandidates} from '../../src/shared/CatPerches';
import {PetActor} from '../../src/game/PetActor';
import type {SimbaRig} from '../../src/game/SimbaRig';

/** Exercise the actual imported-rig branch without fetching the GLB or
 * opening an expensive WebGL context on ALINA-PC. */
test('Simba GLB rests compactly on built-in sofa/bed and a rotated purchased chair',()=>{
  const state=initialState();
  state.furnishing.placed.push({
    id:807,sku:'chair-cloud',finish:'sage',x:2.45,z:2.1,rotation:1,
  });
  const perches=catPerchCandidates(state.furnishing);
  for(const [key,kind,maxDepth] of [
    ['starter:sofa','curl',.78],
    ['starter:bed','curl',.78],
    ['placed:807','watch',.84],
  ] as const){
    const perch=perches.find(p=>p.key===key);
    assert.ok(perch,key+' must have a real resting surface');
    assert.equal(perch.kind,kind);
    let poseCalls=0;
    const dummyRig={
      model:new THREE.Group(),
      pose:()=>{poseCalls++;},
      hindContactHeight:()=>0,
    } as unknown as SimbaRig;
    const simba=new PetActor('simba',dummyRig);
    const floor=simba.root.position.clone();
    simba.followRoute([],'perch',undefined,perch,undefined,false,perch.surface.y-.085);
    for(let i=0;i<90;i++)simba.update(.025);
    const body=simba.root.children[0] as THREE.Group;
    assert.ok(poseCalls>0,key+' must use the imported skeleton branch');
    assert.ok(body.scale.z<maxDepth,key+' must tuck its long body, not reset scale to 1');
    assert.ok(Math.abs(body.rotation.z)<.15,key+' must not fall onto its back');
    simba.root.updateWorldMatrix(true,true);
    const contact=body.getWorldPosition(new THREE.Vector3());
    assert.ok(Math.hypot(contact.x-perch.surface.x,contact.z-perch.surface.z)<.025,
      key+' must land at the actual cushion position');
    assert.ok(contact.y>.3 && contact.y<1.3,key+' must remain near cushion height');
    assert.ok(simba.root.position.distanceTo(floor)<.001,
      key+' must keep the navigation root on the ground');
    simba.stop();
    for(let i=0;i<60;i++)simba.update(.025);
    assert.ok(body.scale.z>.98,key+' must recover full standing proportions');
    assert.ok(body.position.length()<.23,key+' must descend to the ground root');
  }
});
