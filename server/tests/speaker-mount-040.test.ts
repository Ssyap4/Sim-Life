import test from 'node:test';
import assert from 'node:assert/strict';
import {initialState} from '../../src/shared/protocol';
import {applyFurnishing,layoutBlock} from '../furnishing';
import {speakerSurfaces,speakerMountAt,snapSpeaker,migrateSpeakerMounts} from '../../src/shared/speakerPlacement';
import {checkFurniturePlacement} from '../../src/shared/furnishingPlacement';
import {placeObstacles} from '../../src/shared/locations';
import {buildFurnishingModel} from '../../src/game/FurnishingArt';
import type {PlacedFurniture} from '../../src/shared/furniture';
import * as THREE from 'three';
const speaker={id:2,sku:'speaker-alice',finish:'ivory' as const};
function state(sku='dresser-nora',rotation:0|1|2|3=0){
 const s=initialState();s.furnishing.placed=[{id:1,sku,finish:'oak',x:14,z:-6,rotation}];s.furnishing.stored=[speaker];s.furnishing.nextId=3;return s;
}
test('floor rejected; furniture mount computed by server, not client; navigation unchanged',()=>{
 const s=state(),before=placeObstacles('home',s.furnishing);
 assert.equal(applyFurnishing(s,'vlad',{type:'furniture_place',id:2,x:13,z:-4,rotation:0},0).ok,false);
 const r=applyFurnishing(s,'vlad',{type:'furniture_place',id:2,x:14,z:-6,rotation:0},0);assert.ok(r.ok);
 const p=r.state.furnishing.placed.find(p=>p.id===2)!;
 assert.deepEqual(p.mount,{support:'item:1',u:0,v:0});
 assert.deepEqual(placeObstacles('home',r.state.furnishing),before);assert.equal(layoutBlock(p),undefined);
 for(const type of ['furniture_store','furniture_sell'] as const)assert.equal(applyFurnishing(r.state,'alina',{type,id:1},0).ok,false);
 assert.equal(applyFurnishing(r.state,'alina',{type:'furniture_move',id:1,x:13,z:-6,rotation:0},0).ok,false);
 const removed=applyFurnishing(r.state,'vlad',{type:'furniture_store',id:2},0);assert.ok(removed.ok);
 assert.ok(applyFurnishing(removed.state,'vlad',{type:'furniture_store',id:1},0).ok);
});
test('all speaker models fit valid flat furniture surfaces with actual contact; rotations and edge constraints',()=>{
 for(const sku of ['nightstand','dresser-nora','sideboard','table-grand','desk-studio','table-nest']){
  const s=state(sku,1),host=s.furnishing.placed[0];
  const surface=speakerSurfaces(s.furnishing).find(a=>a.id.startsWith('item:1'))!;
  assert.ok(surface,sku);
  const a=surface.rotation*Math.PI/2,x=Math.round((surface.x+surface.u*Math.cos(a)+surface.v*Math.sin(a))*100)/100,z=Math.round((surface.z-surface.u*Math.sin(a)+surface.v*Math.cos(a))*100)/100;
  const p={...speaker,x,z,rotation:0 as const},mount=speakerMountAt(s.furnishing,p);assert.ok(mount,sku);
  assert.equal(checkFurniturePlacement(s,p).valid,true);
  const model=buildFurnishingModel(host.sku,host.finish);model.position.set(host.x,.01,host.z);model.rotation.y=a;model.updateMatrixWorld(true);
  const ray=new THREE.Raycaster(new THREE.Vector3(x,mount.y+.12,z),new THREE.Vector3(0,-1,0));
  const hit=ray.intersectObject(model,true)[0];assert.ok(hit,sku);
  assert.ok(Math.abs(hit.point.y-mount.y)<.045,sku+' expected '+mount.y+' actual '+hit.point.y);
  assert.equal(speakerMountAt(s.furnishing,{...p,x:x+2,z:z+2}),null);
  const snapped=snapSpeaker(s.furnishing,{...p,x:x+.02});assert.ok(speakerMountAt(s.furnishing,snapped));
 }
});
test('overlapping speakers denied and old floor installations moved to storage without losing ID',()=>{
 const s=state();
 const p:PlacedFurniture={...speaker,x:14,z:-6,rotation:0};
 s.furnishing.placed.push({...p,mount:{support:'item:1',u:0,v:0}});s.furnishing.stored=[];s.furnishing.nextId=5;
 assert.equal(speakerMountAt(s.furnishing,{...p,id:3}),null);
 s.furnishing.placed.push({...p,id:4,x:12,z:-4});
 assert.ok(migrateSpeakerMounts(s.furnishing));
 assert.ok(s.furnishing.stored.some(i=>i.id===4));assert.equal(s.furnishing.placed.some(i=>i.id===4),false);
 assert.equal(migrateSpeakerMounts(s.furnishing),false);
});
test('starter table support cannot be sold until speaker removed',()=>{
 const s=initialState();s.furnishing.stored=[speaker];s.furnishing.nextId=3;
 const r=applyFurnishing(s,'vlad',{type:'furniture_place',id:2,x:2.39,z:-1.86,rotation:0},0);assert.ok(r.ok);
 assert.equal(applyFurnishing(r.state,'alina',{type:'furniture_sell_static',fixture:'table'},0).ok,false);
});
