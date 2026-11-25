import assert from 'node:assert/strict';
import test from 'node:test';
import {Box3,Vector3,Raycaster} from 'three';
import {initialState} from '../../src/shared/protocol';
import {FURNITURE_BY_ID,type PlacedFurniture} from '../../src/shared/furniture';
import {checkFurniturePlacement} from '../../src/shared/furnishingPlacement';
import {furnitureActionList,furnitureUseLocation} from '../../src/shared/furnitureUse';
import {buildFurnishingModel} from '../../src/game/FurnishingArt';
import {applyFurnishing} from '../furnishing';
import {pairScenes,completeTogether} from '../society';
import {planTask,evaluateTask} from '../tasks';

const terrace:PlacedFurniture={id:1,sku:'oasis-terrace',finish:'sage',x:9.5,z:10.2,rotation:2};
test('terrace respects the yard, parking and existing paths',()=>{
 const s=initialState();
 assert.ok(checkFurniturePlacement(s,terrace).valid);
 assert.equal(checkFurniturePlacement(s,{...terrace,x:12.5,z:-5.5}).valid,false);
 assert.equal(checkFurniturePlacement(s,{...terrace,x:14.2,z:8.63}).valid,false);
 assert.equal(checkFurniturePlacement(s,{...terrace,x:9,z:8.25}).valid,false);
 assert.equal(checkFurniturePlacement(s,{...terrace,x:20,z:10}).valid,false);
 s.furnishing.placed=[terrace];
 assert.deepEqual(furnitureActionList(terrace),['terraceRest']);
 const v=furnitureUseLocation(s,'vlad',1,'terraceRest')!,a=furnitureUseLocation(s,'alina',1,'terraceRest')!;
 assert.ok(v&&a);
 assert.ok(Math.abs(Math.hypot(v.pose.x-a.pose.x,v.pose.z-a.pose.z)-.94)<1e-8);
 assert.equal(v.pose.yaw,Math.PI);
 assert.ok(v.route.path.length&&a.route.path.length);
});
test('terrace purchase, shared delivery and legal installation use existing household funds once',()=>{
 const s=initialState();s.money=100000;
 const price=FURNITURE_BY_ID.get(terrace.sku)!.price;
 const bought=applyFurnishing(s,'vlad',{type:'furniture_order',sku:terrace.sku,finish:'sage',shipping:'express',quantity:1},100);
 assert.ok(bought.ok);
 assert.equal(bought.state.money,100000-price-990);
 const unpacked=applyFurnishing(bought.state,'alina',{type:'furniture_unbox',id:1},115);
 assert.ok(unpacked.ok);
 const placed=applyFurnishing(unpacked.state,'alina',{type:'furniture_place',id:1,x:terrace.x,z:terrace.z,rotation:terrace.rotation},125);
 assert.ok(placed.ok);
 assert.equal(placed.state.money,bought.state.money);
 assert.equal(placed.state.furnishing.placed[0].sku,terrace.sku);
});
test('solo and paired terrace sessions have real routes, timed completion and no extra charge',()=>{
 const s=initialState();s.furnishing.placed=[terrace];s.furnishing.nextId=2;
 for(const role of ['vlad','alina'] as const)Object.assign(s.characters[role],{comfort:20,energy:40,fun:20,mood:20});
 const single={type:'furniture_use' as const,furnitureId:1,action:'terraceRest' as const};
 assert.equal(planTask(single)?.durationMs,45000);
 const solo=evaluateTask(s,'vlad',single);assert.ok(solo.ok);assert.ok(solo.state.characters.vlad.comfort>s.characters.vlad.comfort);
 assert.equal(solo.state.money,s.money);
 const cmd={type:'together' as const,action:'leisureTogether' as const,item:'1'};
 const homes=pairScenes(s,'vlad',cmd);assert.ok(homes);
 assert.equal(homes.vlad.furnitureId,1);assert.equal(homes.alina.furnitureId,1);
 const result=completeTogether(s,'vlad',cmd,['vlad','alina'],0,homes);assert.ok(result.ok);
 assert.equal(result.state.money,s.money);
 for(const role of ['vlad','alina'] as const)assert.ok(result.state.characters[role].comfort>s.characters[role].comfort);
 const missing=initialState();assert.equal(evaluateTask(missing,'vlad',single).ok,false);
});
test('terrace model fits its catalogue footprint and has two actual cushion surfaces',()=>{
 const root=buildFurnishingModel(terrace.sku,'sage'),size=new Box3().setFromObject(root).getSize(new Vector3());
 const info=FURNITURE_BY_ID.get(terrace.sku)!;
 assert.ok(size.x<=info.width+.001&&size.y<=info.height+.001&&size.z<=info.depth+.001);
 assert.ok(size.y>2&&size.x>3);
 root.updateMatrixWorld(true);
 for(const x of [-.47,.47]){
   const hits=new Raycaster(new Vector3(x,.79,-.27),new Vector3(0,-1,0),0,.3).intersectObject(root,true);
   assert.ok(hits.length&&Math.abs(hits[0].point.y-.645)<.015);
 }
});