import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {initialState,type GameState} from '../../src/shared/protocol';
import {FURNITURE_BY_ID,FURNITURE_CATALOG, type PlacedFurniture} from '../../src/shared/furniture';
import {checkFurniturePlacement} from '../../src/shared/furnishingPlacement';
import {petBeds,petScratchers,currentPetEquipment,petEquipmentRef} from '../../src/shared/petFurniture';
import {buildFurnishingModel} from '../../src/game/FurnishingArt';
import {applyFurnishing} from '../furnishing';
import {applyPetAction,runPetRoutines} from '../pets';
import {openServerFiles} from '../storage';

const items:PlacedFurniture[]=[
 {id:31,sku:'pet-bed-verdell',finish:'sage',x:-2.90,z:3.34,rotation:0},
 {id:32,sku:'pet-bed-simba',finish:'ivory',x:-.25,z:1.32,rotation:0},
 {id:33,sku:'pet-scratcher-simba',finish:'walnut',x:1.12,z:1.84,rotation:0},
];
function furnished():GameState{
 const s=initialState();
 s.furnishing.nextId=34;
 s.furnishing.placed=structuredClone(items);
 return s;
}

test('0.28: pet equipment has three distinct real furniture products and lightweight models',()=>{
 for(const item of items){
  const info=FURNITURE_BY_ID.get(item.sku);
  assert.ok(info&&info.category==='pets');
  assert.ok(FURNITURE_CATALOG.includes(info));
  const model=buildFurnishingModel(item.sku,item.finish);
  const bounds=new THREE.Box3().setFromObject(model);
  const size=new THREE.Vector3();
  bounds.getSize(size);
  assert.ok(size.x<=info.width+.02&&size.z<=info.depth+.02&&size.y<=info.height+.02);
  assert.ok(size.y>.05&&size.x>.35&&size.z>.35);
 }
 assert.equal(petBeds(furnished().furnishing,'verdell').length,1);
 assert.equal(petBeds(furnished().furnishing,'simba').length,1);
 assert.equal(petScratchers(furnished().furnishing).length,1);
});

test('0.28: pet beds are walkable but cannot be hidden inside large furniture',()=>{
 const state=initialState();
 const bed=items[0];
 assert.equal(checkFurniturePlacement(state,bed).valid,true);
 const product=FURNITURE_BY_ID.get(bed.sku)!;
 assert.equal(product.walkable,true);
 assert.equal(checkFurniturePlacement(state,bed,[{...bed,id:200,sku:'sofa-nord'}]).valid,false);
 assert.equal(checkFurniturePlacement(state,bed,[{...bed,id:201,sku:'pet-bed-simba'}]).valid,false);
 assert.equal(checkFurniturePlacement(state,{...items[2],x:bed.x,z:bed.z},[bed]).valid,false,
   'a scratcher cannot be placed ON an installed pet bed');
});

test('0.28: old furniture commerce can actually buy, deliver, unpack and install pet bed',()=>{
 const state=initialState();
 const product=FURNITURE_BY_ID.get('pet-bed-verdell')!;
 const order=applyFurnishing(state,'vlad',{
  type:'furniture_order',sku:product.id,finish:'sage',quantity:1,shipping:'express'
 },480);
 assert.equal(order.ok,true,order.ok?'':order.reason);
 if(!order.ok)return;
 assert.equal(order.state.money,10000-product.price-990);
 const parcel=order.state.furnishing.orders[0]!;
 assert.equal(parcel.sku,product.id);
 const unbox=applyFurnishing(order.state,'vlad',{type:'furniture_unbox',id:parcel.id},496);
 assert.equal(unbox.ok,true,unbox.ok?'':unbox.reason);
 if(!unbox.ok)return;
 const installed=applyFurnishing(unbox.state,'vlad',{
  type:'furniture_place',id:parcel.id,x:items[0].x,z:items[0].z,rotation:0
 },496);
 assert.equal(installed.ok,true,installed.ok?'':installed.reason);
 if(!installed.ok)return;
 assert.equal(petBeds(installed.state.furnishing,'verdell').length,1);
 assert.equal(installed.state.furnishing.stored.length,0);
 const sold=applyFurnishing(installed.state,'vlad',{type:'furniture_sell',id:parcel.id},497);
 assert.equal(sold.ok,true,sold.ok?'':sold.reason);
 if(sold.ok)assert.equal(petBeds(sold.state.furnishing,'verdell').length,0);
});

test('0.28: both pets use their OWN reachable purchased mats, keep favorites only for installed beds',()=>{
 const state=furnished();
 for(const id of ['verdell','simba'] as const){
  const previous=structuredClone(state.pets[id].position);
  const out=applyPetAction(state,'vlad',id,'mat');
  assert.equal(out.ok,true,out.ok?'':out.reason);
  if(!out.ok)continue;
  assert.deepEqual(out.state.pets[id].position,previous);
  const routine=out.state.pets[id].routine!;
  assert.equal(routine.kind,'sleep');
  assert.equal(routine.equipment?.sku,'pet-bed-'+id);
  assert.deepEqual(routine.route.path.at(-1)??routine.route.from,routine.goal);
  const complete=out.state;
  runPetRoutines(complete,0,routine.until,new Set(),()=>.99);
  assert.equal(complete.pets[id].favoriteBedId,routine.equipment?.id);
  const saved=structuredClone(complete);
  saved.furnishing.placed=saved.furnishing.placed.filter(x=>x.id!==routine.equipment?.id);
  runPetRoutines(saved,0,routine.until+2,new Set(),()=>.99);
  assert.equal(saved.pets[id].favoriteBedId,undefined);
 }
});

test('0.28: real scratching requires an installed reachable post, and never rewards sold posts',()=>{
 const state=initialState();
 assert.equal(applyPetAction(state,'alina','simba','scratch').ok,false);
 state.furnishing.nextId=34;
 state.furnishing.placed=[items[2]];
 const result=applyPetAction(state,'alina','simba','scratch');
 assert.equal(result.ok,true,result.ok?'':result.reason);
 if(!result.ok)return;
 const pet=result.state.pets.simba;
 assert.equal(pet.routine?.kind,'scratch');
 assert.ok(pet.routine?.goal&&pet.routine?.equipment);
 assert.deepEqual(pet.routine.route.path.at(-1)??pet.routine.route.from,pet.routine.goal);
 const happy=pet.happiness;
 const removed=structuredClone(result.state);
 removed.furnishing.placed=[];
 runPetRoutines(removed,0,pet.routine!.until,new Set(),()=>.99);
 assert.equal(removed.pets.simba.happiness,happy);
 assert.equal(currentPetEquipment(removed.furnishing,petEquipmentRef(items[2])),null);
 const earned=structuredClone(result.state);
 runPetRoutines(earned,0,pet.routine!.until,new Set(),()=>.99);
 assert.equal(earned.pets.simba.happiness,Math.min(100,happy+9));
});

test('0.28: automatic bedtime prefers installed equipment instead of an imaginary bed',()=>{
 const state=furnished();
 state.pets.verdell.energy=24;
 runPetRoutines(state,0,480,new Set(),()=>.99);
 assert.equal(state.pets.verdell.routine?.kind,'sleep');
 assert.equal(state.pets.verdell.routine?.equipment?.sku,'pet-bed-verdell');
});

test('0.28: sold or repositioned beds are invalid on reload, legacy save unaffected',()=>{
 const dir=mkdtempSync(join(tmpdir(),'pet-furniture028-'));
 try{
  const files=openServerFiles(dir);
  const state=furnished();
  const out=applyPetAction(state,'vlad','verdell','mat');
  assert.equal(out.ok,true,out.ok?'':out.reason);
  if(!out.ok)return;
  files.save(out.state);
  assert.equal(files.load().pets.verdell.routine?.equipment?.sku,'pet-bed-verdell');
  const moved=structuredClone(out.state);
  moved.furnishing.placed[0].x+=.52;
  moved.pets.verdell.favoriteBedId=31;
  files.save(moved);
  const recovered=files.load();
  assert.equal(recovered.pets.verdell.routine,undefined);
  assert.equal(recovered.pets.verdell.favoriteBedId,31,
    'favorite may remain when the bed moved, but routine must be invalidated');
  moved.furnishing.placed=moved.furnishing.placed.filter(it=>it.id!==31);
  files.save(moved);
  assert.equal(files.load().pets.verdell.favoriteBedId,undefined);
  const older=initialState();
  files.save(older);
  assert.equal(files.load().version,2);
  assert.equal(files.load().pets.simba.favoriteBedId,undefined);
 }finally{rmSync(dir,{recursive:true,force:true});}
});
