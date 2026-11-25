import assert from 'node:assert/strict';
import test from 'node:test';
import {Vector3,Raycaster} from 'three';
import {Actor} from '../../src/game/Actor';
import {buildFurnishingModel} from '../../src/game/FurnishingArt';
import {poolEntryFrame,POOL_ENTRY_SECONDS,poolSwimFrame} from '../../src/shared/oasisPool';

test('exposed side staircase has three real ascending treads and an unobstructed deck',()=>{
 const root=buildFurnishingModel('oasis-pool','oak');root.updateMatrixWorld(true);
 for(const [x,y] of [[-.60,.235],[-.20,.435],[.20,.635],[.91,.8325]]){
  const hits=new Raycaster(new Vector3(x,1.5,1.93),new Vector3(0,-1,0)).intersectObject(root,true);
  assert.ok(hits.length&&Math.abs(hits[0].point.y-y)<.018,'tread '+x+': '+hits[0]?.point.y);
 }
 for(const role of ['vlad','alina'] as const){
  let prev=poolEntryFrame(0,role);
  for(let t=.02;t<=POOL_ENTRY_SECONDS;t+=.02){const p=poolEntryFrame(t,role);assert.ok(Math.hypot(p.x-prev.x,p.y-prev.y,p.z-prev.z)<.10);prev=p;}
  assert.ok(Math.abs(poolEntryFrame(3.6,role).y-.8325)<.001);
  assert.ok(Math.abs(poolEntryFrame(6,role).y-.46)<.001);
 }
});
test('authored pool swim anchors do not orbit the approach point during changes of yaw',()=>{
 for(const role of ['vlad','alina'] as const){
  const actor=new Actor(role,[-8.55,10.83]);
  actor.playDomesticActivity('spaSwim');
  const target=new Vector3(),actual=new Vector3();
  for(let i=0;i<180;i++){
   const f=poolSwimFrame(i*.1,role);target.set(-9.95+f.x,f.y,8.1+f.z);
   actor.updateWaterAnchor(target,f.yaw);actor.update(1/30);
   actor.root.updateMatrixWorld(true);actor.bodyPosition(actual);
   assert.ok(Math.hypot(actual.x-target.x,actual.z-target.z)<.06,role+' horizontal drift '+actual.distanceTo(target));
  }
 }
});