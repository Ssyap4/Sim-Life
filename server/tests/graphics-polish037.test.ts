import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {snowPreview} from '../../src/game/LandscapePalette';
import {PlantBatch,growTree,growFlowers} from '../../src/game/LandscapePlants';
test('snow is strictly an explicit visual preset',()=>{
 assert.equal(snowPreview('?weather=snow'),true);
 for(const q of ['', '?weather=rain','?weather=storm','?weather=unknown'])assert.equal(snowPreview(q),false);
});
test('each species keeps a finite single opaque batched mesh and cheaper distant form',()=>{
 for(const kind of ['birch','linden','maple','ornamental','spruce'] as const){
  const counts=[];
  for(const distant of [false,true]){
   const batch=new PlantBatch(),group=new THREE.Group();
   growTree(batch,0,0,kind,1,42,distant);batch.attach(group,kind);
   assert.equal(group.children.length,1);
   const mesh=group.children[0] as THREE.Mesh;
   const p=mesh.geometry.getAttribute('position'),n=mesh.geometry.getAttribute('normal'),c=mesh.geometry.getAttribute('color');
   assert.equal(p.count,n.count);assert.equal(p.count,c.count);
   assert.ok(Array.from(p.array).every(Number.isFinite));assert.ok(Array.from(c.array).every(Number.isFinite));
   assert.equal((mesh.material as THREE.Material).transparent,false);
   counts.push(mesh.geometry.getIndex()!.count);
  }
  assert.ok(counts[1]<counts[0],kind);
 }
});
test('fuller flowers stay in one draw and preserve bed placement',()=>{
 const batch=new PlantBatch(),group=new THREE.Group();growFlowers(batch,0,0,0,1,.5,1,22,975);batch.attach(group,'bed');
 assert.equal(group.children.length,1);const mesh=group.children[0] as THREE.Mesh;
 mesh.geometry.computeBoundingBox();const b=mesh.geometry.boundingBox!;
 assert.ok(b.min.x>-.8&&b.max.x<.8&&b.min.z>-.6&&b.max.z<.6&&b.max.y<1);
 assert.ok(mesh.geometry.getIndex()!.count<18000);
});
