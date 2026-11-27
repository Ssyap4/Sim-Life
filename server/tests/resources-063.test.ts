import {test} from 'node:test';
import assert from 'node:assert/strict';
import {PreviewQueue} from '../../src/game/PreviewQueue';
import {createLocation} from '../../src/game/LocationScene';
import {buildFurnishingModel} from '../../src/game/FurnishingArt';
import {disposeFurnitureModel} from '../../src/game/FurnitureModels';
import * as THREE from 'three';

test('preview queue coalesces duplicates and resolves abandoned subscribers without rendering',async()=>{
 const q=new PreviewQueue<string>();let old=true;
 const a=q.request('chair/oak',()=>old),b=q.request('chair/oak',()=>true),c=q.request('bed/oak',()=>old);
 assert.equal(q.size,2);old=false;assert.equal(q.prune(),1);
 assert.equal(await a,null);assert.equal(await c,null);
 const task=q.take()!;assert.equal(task.key,'chair/oak');task.finish('image');
 assert.equal(await b,'image');assert.equal(q.size,0);
});
test('failed and cancelled previews settle all promises, including after a filter change',async()=>{
 const q=new PreviewQueue<string>();let alive=true;
 const a=q.request('chair',()=>alive),b=q.request('chair',()=>true),c=q.request('bed',()=>true);
 const job=q.take()!;alive=false;job.finish('image');
 assert.equal(await a,null);assert.equal(await b,'image');q.cancelAll();assert.equal(await c,null);
 const d=q.request('bad',()=>true);q.take()!.finish(null);assert.equal(await d,null);
 assert.equal(await q.request('closed',()=>false),null);
});
test('thumbnail pool uses normal model cleanup for water and glass materials',()=>{
 const model=buildFurnishingModel('oasis-pool','oak');
 const water=model.getObjectByName('Oasis water surface') as THREE.Mesh;
 const glass=model.getObjectByName('Oasis pool glass') as THREE.Mesh;
 assert.ok(water&&glass);let released=0,geometry=0;
 (water.material as THREE.Material).addEventListener('dispose',()=>released++);
 (glass.material as THREE.Material).addEventListener('dispose',()=>released++);
 water.geometry.addEventListener('dispose',()=>geometry++);
 disposeFurnitureModel(model);assert.equal(released,2);assert.equal(geometry,1);
});
test('large scene camera bounds reuse the identical world bounds without changing framing',()=>{
 for(const place of ['lake','fitness','clinic','barber','electronics','spa','venue'] as const){
  const scene=createLocation(place);
  try{
   assert.equal(scene.horizontal,scene.vertical);
   const {min,max}=new THREE.Box3().setFromObject(scene.root);
   assert.equal(Math.min(...scene.horizontal.map(p=>p[0])),min.x);
   assert.equal(Math.max(...scene.vertical.map(p=>p[1])),max.y);
   assert.equal(Math.max(...scene.horizontal.map(p=>p[2])),max.z);
  }finally{scene.dispose();}
 }
});
