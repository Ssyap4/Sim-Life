import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import * as THREE from 'three';
import {initialState} from '../../src/shared/protocol';
import {FEEDING_MODELS,feedingStation,feederReserve,validFeeder} from '../../src/shared/petFeeders';
import {FURNITURE_CATALOG} from '../../src/shared/furniture';
import {checkFurniturePlacement} from '../../src/shared/furnishingPlacement';
import {buildFurnishingModel} from '../../src/game/FurnishingArt';
import {grantStarterPetFurniture} from '../starterPets';
import {applyPetAction,runPetRoutines} from '../pets';
import {applyFurnishing} from '../furnishing';
import {openServerFiles} from '../storage';
import {planTask} from '../tasks';
test('eight purchasable feeding models have bounded 3D geometry, species-specific anchors, four rotations',()=>{
 for(const m of FEEDING_MODELS){
  const p=FURNITURE_CATALOG.find(p=>p.id===m.id)!;assert.equal(p.category,'pets');
  const size=new THREE.Box3().setFromObject(buildFurnishingModel(m.id,'sage')).getSize(new THREE.Vector3());
  assert.ok(size.x<=p.width+.025&&size.y<=p.height+.025&&size.z<=p.depth+.025,m.id);
  const s=initialState();grantStarterPetFurniture(s);
  for(const rotation of [0,1,2,3] as const){
   const item={id:3,sku:m.id,finish:'sage' as const,x:-2.9,z:3.34,rotation};
   const valid=checkFurniturePlacement(s,item);if(!valid.valid)continue;
   s.furnishing.placed.push(item);const station=feedingStation(s.furnishing,m.pet);
   assert.equal(station.item?.id,3);assert.equal(station.yaw,Math.PI+rotation*Math.PI/2);
   assert.notDeepEqual(station.goal,station.point);s.furnishing.placed.pop();
  }
  assert.ok(checkFurniturePlacement(s,{id:3,sku:m.id,finish:'sage',x:-2.9,z:3.34,rotation:1}).valid,m.id);
 }
});
test('load dry stock without duplicating it; auto dispensing consumes one refill only; real meal tracks brand',()=>{
 let s=initialState();grantStarterPetFurniture(s);
 s.furnishing.placed.push({id:s.furnishing.nextId++,sku:'pet-feed-verdell-auto',finish:'sage',x:-2.9,z:3.34,rotation:1});
 s.petFood.verdell=9;s.pets.verdell.foodQueue=['verdell-wet-3',...Array(7).fill('verdell-dry-2')];
 const fill=applyPetAction(s,'vlad','verdell','loadFeeder');assert.ok(fill.ok);s=fill.state;
 assert.equal(s.petFood.verdell,3);assert.equal(feederReserve(s.pets.verdell).length,6);
 assert.equal(s.pets.verdell.foodQueue?.[0],'verdell-wet-3');
 assert.equal(s.petBowls.verdell,0);assert.equal(applyPetAction(s,'alina','verdell','loadFeeder').ok,false);
 const p=s.pets.verdell;p.satiety=25;p.bladder=p.energy=99;Reflect.deleteProperty(p,'routine');
 runPetRoutines(s,0,480,new Set(['simba']),()=>.99);
 assert.equal(s.petBowls.verdell,3);assert.equal(feederReserve(p).length,5);assert.equal(p.bowlFood,'verdell-dry-2');
 assert.equal(p.routine?.kind,'eat');assert.deepEqual(p.routine?.goal,feedingStation(s.furnishing,'verdell').goal);
 runPetRoutines(s,0,p.routine!.until,new Set(['simba']),()=>.99);
 assert.equal(s.petBowls.verdell,2);assert.equal(p.foodPreferences?.['verdell-dry-2'],3);
 assert.equal(s.petFood.verdell,3);assert.equal(feederReserve(p).length,5);
 const dir=mkdtempSync(join(tmpdir(),'feeder-035-'));try{const f=openServerFiles(dir);f.save(s);assert.deepEqual(f.load().pets.verdell.feederReserve,p.feederReserve);}finally{rmSync(dir,{recursive:true,force:true});}
});
test('wet-only supplies cannot fill a dry hopper; selling active feeder preserves reserve and falls back to original bowl',()=>{
 const s=initialState();s.furnishing.placed=[{id:1,sku:'pet-feed-simba-plus',finish:'sage',x:-2.9,z:3.34,rotation:1}];s.furnishing.nextId=2;
 s.petFood.simba=2;s.pets.simba.foodQueue=['simba-wet-2','simba-wet-3'];
 assert.equal(applyPetAction(s,'vlad','simba','loadFeeder').ok,false);
 s.petFood.simba=0;s.pets.simba.foodQueue=[];s.pets.simba.feederReserve=['simba-dry-3',null];
 const sold=applyFurnishing(s,'vlad',{type:'furniture_sell',id:1},480);assert.ok(sold.ok);
 const next=sold.state;assert.equal(feedingStation(next.furnishing,'simba').item,undefined);
 assert.equal(feederReserve(next.pets.simba).length,2);assert.equal(next.petBowls.simba,0);
 const feed=applyPetAction(next,'alina','simba','feed');assert.ok(feed.ok);assert.equal(feed.state.petBowls.simba,3);assert.equal(feederReserve(feed.state.pets.simba).length,1);
 assert.equal(feed.state.pets.simba.bowlFood,'simba-dry-3');
 assert.equal(validFeeder({...next.pets.simba,feederReserve:['verdell-dry-3']},'simba'),false);
 assert.equal(validFeeder({...next.pets.simba,feederReserve:['simba-wet-3']},'simba'),false);
 assert.equal(planTask({type:'pet_action',pet:'simba',action:'loadFeeder'})?.resource,'pet:simba');
});
