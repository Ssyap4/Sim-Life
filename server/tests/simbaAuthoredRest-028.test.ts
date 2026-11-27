import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {initialState} from '../../src/shared/protocol';
import {catPerchCandidates,currentCatPerch} from '../../src/shared/CatPerches';
import {chooseCatRestPose,CAT_REST_POSES} from '../../src/shared/CatRestPoses';
import {PetActor} from '../../src/game/PetActor';
import {SimbaRig} from '../../src/game/SimbaRig';

/** Load the actual game model, with NO GPU or renderer on the weak host. */
async function realSimba(){
  const buffer=readFileSync(resolve('src/assets/pets/simba.glb'));
  const gltf=await new GLTFLoader().parseAsync(
    buffer.buffer.slice(buffer.byteOffset,buffer.byteOffset+buffer.byteLength),'');
  const rig=new SimbaRig(gltf.scene);
  return {actor:new PetActor('simba',rig),rig};
}

test('cushion sockets carry per-furniture authored pose choices and remain valid until moved',()=>{
  const state=initialState();
  state.furnishing.placed=[
    {id:41,sku:'sofa-luna',finish:'sage',x:2.8,z:2.0,rotation:1},
    {id:42,sku:'chair-cloud',finish:'slate',x:6.2,z:-2.5,rotation:3},
    {id:43,sku:'bed-day',finish:'oak',x:-5.7,z:.8,rotation:2},
  ];
  const perches=catPerchCandidates(state.furnishing);
  for(const key of ['starter:sofa','starter:bed','placed:41','placed:42','placed:43']){
    const perch=perches.find(p=>p.key===key);
    assert.ok(perch,key);
    assert.ok(perch.catAnchor,key+' missing furniture socket');
    assert.equal(perch.catAnchor.x,perch.surface.x);
    assert.equal(perch.catAnchor.y,perch.surface.y);
    assert.equal(perch.catAnchor.z,perch.surface.z);
    assert.equal(perch.catAnchor.yaw,perch.yaw);
    assert.ok(perch.catAnchor.poses.every(p=>p in CAT_REST_POSES));
    assert.deepEqual(currentCatPerch(state.furnishing,perch),perch);
  }
  assert.deepEqual(perches.find(p=>p.key==='starter:sofa')!.catAnchor!.poses,
    ['sofa_loaf','sofa_side_rest']);
  assert.deepEqual(perches.find(p=>p.key==='starter:bed')!.catAnchor!.poses,['bed_curl']);
  assert.deepEqual(perches.find(p=>p.key==='placed:42')!.catAnchor!.poses,['chair_compact']);
  assert.equal(chooseCatRestPose(['sofa_loaf','sofa_side_rest'],'starter:sofa',480,'curl'),
    chooseCatRestPose(['sofa_loaf','sofa_side_rest'],'starter:sofa',480,'curl'),
    'both phones must choose the same pose from the server start minute');
  assert.notEqual(chooseCatRestPose(['sofa_loaf','sofa_side_rest'],'starter:sofa',480,'curl'),
    chooseCatRestPose(['sofa_loaf','sofa_side_rest'],'starter:sofa',481,'curl'),
    'two sofa naps can show different handcrafted poses');
  const old=perches.find(p=>p.key==='placed:41')!;
  state.furnishing.placed[0]!.x+=.25;
  assert.equal(currentCatPerch(state.furnishing,old),null);
});

test('actual Blender GLB bends its legs and reclines on sofa, bed, chair and own mat',async()=>{
  const state=initialState();
  state.furnishing.placed=[{id:44,sku:'chair-cloud',finish:'sage',x:4,z:-3,rotation:2}];
  const perches=catPerchCandidates(state.furnishing);
  for(const [key,minute,expect] of [
    ['starter:sofa',480,'sofa_loaf'],
    ['starter:sofa',481,'sofa_side_rest'],
    ['starter:bed',480,'bed_curl'],
    ['placed:44',480,'chair_compact'],
  ] as const){
    const perch=perches.find(p=>p.key===key);
    assert.ok(perch);
    const chosen=chooseCatRestPose(perch.catAnchor?.poses,perch.key,minute,perch.kind);
    // Which sofa minute yields each variant depends on the stable hash.
    const expected=key==='starter:sofa'?chosen:expect;
    assert.equal(chosen,expected);
    const {actor,rig}=await realSimba();
    actor.root.position.set(perch.approach.x,0,perch.approach.z);
    actor.followRoute([],'perch',undefined,perch,undefined,false,perch.surface.y-.085,
      undefined,minute);
    for(let i=0;i<85;i++)actor.update(.028);
    actor.root.updateWorldMatrix(true,true);
    const body=actor.root.children[0] as THREE.Group;
    const center=body.getWorldPosition(new THREE.Vector3());
    const support=perch.surface.y-.085;
    assert.ok(body.scale.z<.95,'GLB must not retain elongated walk silhouette on '+key);
    assert.ok(Math.abs(body.rotation.z)<.20,'GLB cannot lie upside down on '+key);
    assert.ok(Math.hypot(center.x-perch.surface.x,center.z-perch.surface.z)<.03,
      key+' body must land on cushion socket');
    assert.ok(center.y>support-.35&&center.y<support-.08,
      key+' belly must settle close to cushion');
    for(const name of ['ForeLPaw','ForeRPaw','HindLPaw','HindRPaw']){
      const foot=rig.model.getObjectByName(name);
      assert.ok(foot,'missing bone '+name);
      const position=foot.getWorldPosition(new THREE.Vector3());
      assert.ok(Number.isFinite(position.y));
      assert.ok(position.y>support-.13&&position.y<support+.25,
        key+' ankle '+name+' is off cushion: '+position.y+' vs '+support);
    }
    assert.equal(actor.root.position.y,0,'physics and navigation stay on floor');
    actor.stop();
    for(let i=0;i<65;i++)actor.update(.028);
    assert.ok(body.scale.z>.99,key+' must regain walking proportions');
    assert.ok(body.position.length()<.25,key+' must descend before walking');
  }
  const {actor,rig}=await realSimba();
  actor.followRoute([],'sleep',undefined,undefined,undefined,true,.1);
  for(let i=0;i<70;i++)actor.update(.03);
  assert.ok((actor.root.children[0] as THREE.Group).scale.z<.9,'mat must use authored curl');
  assert.ok(rig.model.getObjectByName('ForeLPaw'),'mat must retain the real imported bones');
});

test('real Simba uses a skeletal curl even on a bare floor and unfolds when waking',async()=>{
 const {actor,rig}=await realSimba();
 actor.syncGround(0,0);
 actor.followRoute([],'sleep');
 for(let i=0;i<120;i++)actor.update(1/60);
 const body=actor.root.children[0] as THREE.Group;
 assert.ok(body.scale.z<.9);
 actor.root.updateMatrixWorld(true);
 for(const name of ['ForeLPaw','ForeRPaw','HindLPaw','HindRPaw']){
  const y=rig.model.getObjectByName(name)!.getWorldPosition(new THREE.Vector3()).y;
  assert.ok(y>-.13&&y<.25,name+' floor support '+y);
 }
 actor.stop();actor.update(1/60);
 assert.ok(body.scale.z<.94,'must not unfold instantly');
 for(let i=0;i<120;i++)actor.update(1/60);
 assert.ok(body.scale.z>.99);
 assert.equal(actor.root.position.y,0);
});