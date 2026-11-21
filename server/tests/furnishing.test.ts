import assert from 'node:assert/strict';
import test from 'node:test';
import {mkdtempSync,readFileSync,rmSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import { initialState } from '../../src/shared/protocol';
import * as THREE from 'three';
import { buildFurnishingModel } from '../../src/game/FurnishingArt';
import { applyFurnishing } from '../furnishing';
import { openServerFiles } from '../storage';
import { pairScenes } from '../society';
import { taskAccessError } from '../../src/shared/serviceAccess';
import { FURNITURE_CATALOG, FURNITURE_FINISHES, FURNITURE_BY_ID, STATIC_FURNITURE, STATIC_FURNITURE_IDS, emptyFurnishing,
  furnitureFootprint, furnishingObstacles, isValidFurnishing } from '../../src/shared/furniture';
import { placeObstacles, spawn } from '../../src/shared/locations';
import { HOME_FLOOR } from '../../src/shared/home';
import { findRoute, pointIsClear, segmentIsClear } from '../../src/game/navigation';
import { PET_IDS, PETS } from '../../src/shared/pets';
import { petNavigationGeometry } from '../../src/game/PetNavigation';

function orderSmall(){
  const initial=initialState();
  const bought=applyFurnishing(initial,'vlad',
    {type:'furniture_order',sku:'plant-mini',finish:'sage',shipping:'express',quantity:1},100);
  assert.ok(bought.ok,'furniture order must succeed');
  return bought.state;
}
function unbox(){
  const bought=orderSmall();
  const unpacked=applyFurnishing(bought,'alina',{type:'furniture_unbox',id:1},115);
  assert.ok(unpacked.ok,'Alina can unpack Vlad order');
  return unpacked.state;
}
test('catalog has distinct light models and 8 colorways',()=>{
  assert.ok(FURNITURE_CATALOG.length>=35);
  assert.equal(new Set(FURNITURE_CATALOG.map(item=>item.id)).size,FURNITURE_CATALOG.length);
  assert.equal(Object.keys(FURNITURE_FINISHES).length,8);
  assert.ok(new Set(FURNITURE_CATALOG.map(item=>item.shape)).size>=16);
  assert.ok(FURNITURE_CATALOG.every(item=>item.price>=500&&item.width>0&&item.depth>0));
});
test('atomic purchase charges rubles once and prevents stale duplicate money loss',()=>{
  const state=initialState();
  const order={type:'furniture_order' as const,sku:'plant-mini',finish:'sage' as const,
    shipping:'express' as const,quantity:2};
  const result=applyFurnishing(state,'vlad',order,110);
  assert.ok(result.ok);
  assert.equal(result.state.money,state.money-1200*2-990);
  assert.equal(result.state.furnishing.orders.length,2);
  assert.equal(result.state.furnishing.nextId,3);
  assert.equal(result.state.ledger.at(-1)?.category,'furniture');
  assert.equal(state.money,10000,'source remains unchanged');
  assert.equal(applyFurnishing(result.state,'vlad',{type:'furniture_unbox',id:1},110).ok,false);
  const invalid=applyFurnishing(state,'vlad',{...order,quantity:100},110);
  assert.equal(invalid.ok,false);
  const tooExpensive=applyFurnishing(state,'vlad',{...order,sku:'sofa-arc'},110);
  assert.equal(tooExpensive.ok,false);
});
test('delivered item can be unboxed by partner but never twice',()=>{
  const state=orderSmall();
  assert.equal(applyFurnishing(state,'alina',{type:'furniture_unbox',id:1},114).ok,false);
  const done=applyFurnishing(state,'alina',{type:'furniture_unbox',id:1},115);
  assert.ok(done.ok);
  assert.equal(done.state.furnishing.orders.length,0);
  assert.equal(done.state.furnishing.stored.length,1);
  assert.equal(applyFurnishing(done.state,'vlad',{type:'furniture_unbox',id:1},115).ok,false);
});
test('server validates legal placement and forbids blocking doors, fixtures, existing furniture and actors',()=>{
  const ready=unbox();
  const good=applyFurnishing(ready,'alina',
    {type:'furniture_place',id:1,x:13.5,z:-5.5,rotation:0},125);
  assert.ok(good.ok,'free wing corner should be usable');
  assert.equal(good.state.furnishing.placed.length,1);
  assert.equal(good.state.furnishing.stored.length,0);
  const doorway=applyFurnishing(ready,'vlad',
    {type:'furniture_place',id:1,x:12.5,z:-3.6,rotation:0},125);
  assert.equal(doorway.ok,false);
  const staticSofa=applyFurnishing(ready,'vlad',
    {type:'furniture_place',id:1,x:-2.36,z:2.02,rotation:0},125);
  assert.equal(staticSofa.ok,false);
  const player=applyFurnishing(ready,'vlad',
    {type:'furniture_place',id:1,x:.5,z:3.5,rotation:0},125);
  assert.equal(player.ok,false);
  const outside=applyFurnishing(ready,'vlad',
    {type:'furniture_place',id:1,x:22,z:-18,rotation:0},125);
  assert.equal(outside.ok,false);
});
test('after placement all old paths, room entrances and mandatory pet waypoints stay reachable',()=>{
  const ready=unbox();
  const placed=applyFurnishing(ready,'vlad',
    {type:'furniture_place',id:1,x:13.5,z:-5.5,rotation:1},125);
  assert.ok(placed.ok);
  const obstacles=placeObstacles('home',placed.state.furnishing);
  const baseline=placeObstacles('home');
  for(const p of [spawn('home','vlad'),spawn('home','alina'),
    {x:12.4,z:-5.5},{x:12.5,z:-1.6},{x:12.5,z:2.4},
    {x:1.48,z:3.92},{x:-7.13,z:3.59},{x:8.08,z:.55},
    {x:6.47,z:-2.84}]) {
    if(!pointIsClear(p,baseline,HOME_FLOOR)||
      !findRoute({x:0,z:1.4},p,baseline,HOME_FLOOR))continue;
    assert.ok(pointIsClear(p,obstacles,HOME_FLOOR));
    assert.ok(findRoute({x:0,z:1.4},p,obstacles,HOME_FLOOR),'must remain reachable');
  }
  for(const id of PET_IDS) {
    const geo=petNavigationGeometry(obstacles,HOME_FLOOR);
    const p=PETS[id].home;
    assert.ok(pointIsClear(p,geo.obstacles,geo.floor));
  }
});
test('can rotate and move safely, store, sell, with no duplication',()=>{
  const starting=unbox();
  const first=applyFurnishing(starting,'vlad',
    {type:'furniture_place',id:1,x:13.5,z:-5.5,rotation:0},120);
  assert.ok(first.ok);
  const moved=applyFurnishing(first.state,'alina',
    {type:'furniture_move',id:1,x:13.48,z:-5.5,rotation:1},121);
  assert.ok(moved.ok);
  assert.equal(moved.state.furnishing.placed[0].rotation,1);
  const store=applyFurnishing(moved.state,'alina',{type:'furniture_store',id:1},122);
  assert.ok(store.ok);
  assert.equal(store.state.furnishing.stored.length,1);
  assert.equal(store.state.furnishing.placed.length,0);
  const sold=applyFurnishing(store.state,'vlad',{type:'furniture_sell',id:1},123);
  assert.ok(sold.ok);
  assert.equal(sold.state.money,store.state.money+660);
  assert.equal(sold.state.furnishing.stored.length,0);
  assert.equal(sold.state.furnishing.placed.length,0);
  assert.equal(applyFurnishing(sold.state,'vlad',{type:'furniture_sell',id:1},124).ok,false);
});

test('starter furnishings can be sold once without touching fixed cabinets, appliances or other family data',()=>{
  const original=initialState();
  const baselineMoney=original.money;
  assert.equal(STATIC_FURNITURE_IDS.length,11);
  for(const forbidden of ['kitchen','tv','toilet','bathtub','shower','vanity','coffeeMaker','kettle'])
    assert.ok(!Object.hasOwn(STATIC_FURNITURE,forbidden),forbidden+' must remain a fixed fixture');
  const sold=applyFurnishing(original,'alina',{type:'furniture_sell_static',fixture:'sofa'},101);
  assert.ok(sold.ok);
  const resale=Math.floor(FURNITURE_BY_ID.get(STATIC_FURNITURE.sofa.sku)!.price*.55);
  assert.equal(sold.state.money,baselineMoney+resale);
  assert.deepEqual(sold.state.furnishing.soldFixtures,['sofa']);
  assert.equal(sold.state.furnishing.nextId,original.furnishing.nextId);
  assert.equal(sold.state.characters.vlad.energy,original.characters.vlad.energy);
  assert.equal(sold.state.pets.simba.bond,original.pets.simba.bond);
  assert.equal(sold.state.ledger.at(-1)?.category,'furniture');
  assert.deepEqual(original.furnishing.soldFixtures,[]);
  assert.equal(applyFurnishing(sold.state,'vlad',{type:'furniture_sell_static',fixture:'sofa'},102).ok,false);
  assert.equal(applyFurnishing(sold.state,'alina',
    {type:'furniture_sell_static',fixture:'kitchen' as 'sofa'},103).ok,false);
  assert.equal(applyFurnishing(sold.state,'alina',
    {type:'furniture_sell_static',fixture:'unknown' as 'sofa'},103).ok,false);
  assert.equal(sold.state.money,baselineMoney+resale,'invalid transactions must never change money');
  assert.ok(taskAccessError(sold.state,{type:'act',actionId:'sofaRest'}));
  assert.equal(taskAccessError(sold.state,{type:'act',actionId:'tableRest'}),undefined);
});

test('selling starter furniture frees its original floor and permits replacing it with purchased furniture',()=>{
  const original=initialState();
  const before=placeObstacles('home',original.furnishing);
  assert.equal(pointIsClear({x:-2.36,z:2.02},before,HOME_FLOOR),false);
  const cleared=applyFurnishing(original,'vlad',{type:'furniture_sell_static',fixture:'sofa'},200);
  assert.ok(cleared.ok);
  const after=placeObstacles('home',cleared.state.furnishing);
  assert.ok(pointIsClear({x:-2.36,z:2.02},after,HOME_FLOOR));
  const order=applyFurnishing(cleared.state,'vlad',
    {type:'furniture_order',sku:'plant-mini',finish:'sage',shipping:'express',quantity:1},210);
  assert.ok(order.ok);
  const unboxed=applyFurnishing(order.state,'alina',{type:'furniture_unbox',id:1},225);
  assert.ok(unboxed.ok);
  const placed=applyFurnishing(unboxed.state,'vlad',
    {type:'furniture_place',id:1,x:-2.36,z:2.02,rotation:0},225);
  assert.ok(placed.ok,'old sofa space should accept newly bought furniture');
});

test('selling one starter item remains saved after restart, while older 0.15 saves migrate with a backup',()=>{
  const dir=mkdtempSync(join(tmpdir(),'sim-life-starter-furniture-'));
  try{
    const source=initialState();
    source.money=73214;
    source.characters.alina.skill=83;
    source.pets.verdell.bond=57;
    const legacy=structuredClone(source);
    delete legacy.furnishing.soldFixtures;
    writeFileSync(join(dir,'household.json'),JSON.stringify(legacy));
    const files=openServerFiles(dir);
    const migrated=files.load();
    assert.deepEqual(migrated.furnishing.soldFixtures,[]);
    assert.equal(migrated.money,73214);
    assert.equal(JSON.parse(readFileSync(join(dir,'household.pre-static-sale.json'),'utf8')).money,73214);
    const sold=applyFurnishing(migrated,'vlad',{type:'furniture_sell_static',fixture:'nightstandLeft'},230);
    assert.ok(sold.ok);
    files.save(sold.state);
    const restored=openServerFiles(dir).load();
    assert.deepEqual(restored.furnishing.soldFixtures,['nightstandLeft']);
    assert.equal(restored.money,sold.state.money);
    assert.equal(restored.characters.alina.skill,83);
    assert.equal(restored.pets.verdell.bond,57);
    assert.equal(pointIsClear({x:-8.84,z:-6.70},placeObstacles('home',restored.furnishing),HOME_FLOOR),true);
    assert.equal(applyFurnishing(restored,'alina',
      {type:'furniture_sell_static',fixture:'nightstandLeft'},240).ok,false);
  }finally{rmSync(dir,{recursive:true,force:true});}
});

test('rotated footprints, walkable carpets and metadata survive validation',()=>{
  const state=unbox();
  const model={id:1,sku:'plant-mini',finish:'sage' as const,x:12,z:-5,rotation:1 as const};
  assert.notEqual(furnitureFootprint(model).minX,0);
  assert.equal(furnishingObstacles({placed:[model]}).length,1);
  assert.equal(furnishingObstacles({placed:[{...model,sku:'rug-weave'}]}).length,0);
  assert.ok(isValidFurnishing(state.furnishing));
  const bad=structuredClone(state.furnishing);
  bad.orders.push({id:1,sku:'unknown',finish:'sage',readyAt:1,shipping:'regular'});
  assert.equal(isValidFurnishing(bad),false);
});
test('old 0.14 households migrate to empty furnishings without resetting progress',()=>{
  const folder=mkdtempSync(join(tmpdir(),'sim-life-furniture-'));
  try{
    const state=initialState();
    state.money=185357;
    state.characters.vlad.skill=64;
    state.pets.simba.bond=63;
    // Emulate old 0.14 JSON lacking the new furnishing field.
    const json=structuredClone(state) as unknown as Record<string,unknown>;
    delete json.furnishing;
    writeFileSync(join(folder,'household.json'),JSON.stringify(json));
    const files=openServerFiles(folder);
    const loaded=files.load();
    assert.equal(loaded.money,185357);
    assert.equal(loaded.characters.vlad.skill,64);
    assert.equal(loaded.pets.simba.bond,63);
    assert.deepEqual(loaded.furnishing,emptyFurnishing());
    files.save(loaded);
    const again=openServerFiles(folder).load();
    assert.equal(again.money,185357);
    assert.deepEqual(again.furnishing,loaded.furnishing);
    assert.equal(JSON.parse(readFileSync(join(folder,'household.pre-furnishing.json'),'utf8')).money,185357);
  }finally{rmSync(folder,{recursive:true,force:true});}
});

test('all 75 light 3D furniture models fit their advertised collision footprints and height',()=>{
  for(const info of FURNITURE_CATALOG){
    const model=buildFurnishingModel(info.id,'slate');
    model.updateMatrixWorld(true);
    const bounds=new THREE.Box3().setFromObject(model);
    const eps=.012;
    assert.ok(bounds.min.x>=-info.width/2-eps,info.id+': left edge');
    assert.ok(bounds.max.x<=info.width/2+eps,info.id+': right edge');
    assert.ok(bounds.min.z>=-info.depth/2-eps,info.id+': rear edge');
    assert.ok(bounds.max.z<=info.depth/2+eps,info.id+': front edge');
    assert.ok(bounds.min.y>=-.025,info.id+': floor penetration');
    assert.ok(bounds.max.y<=info.height+eps,info.id+': height');
    let count=0;
    model.traverse(part=>{if(part instanceof THREE.Mesh)count++;});
    assert.ok(count<=8,info.id+': too many separate draw calls ('+count+')');
  }
});
test('restart restores characters and pets outside purchased furniture without changing their needs',()=>{
  const folder=mkdtempSync(join(tmpdir(),'sim-life-furnished-restart-'));
  try{
    const sample=initialState();
    sample.money=98765;
    sample.furnishing.placed.push({
      id:1,sku:'wardrobe-tall',finish:'walnut',rotation:0,x:13.1,z:-5.45,
    });
    sample.furnishing.nextId=2;
    Object.assign(sample.characters.vlad,{x:13.1,z:-5.45,skill:77});
    sample.pets.simba.position={x:13.1,z:-5.45};
    sample.pets.simba.bond=56;
    const files=openServerFiles(folder);
    files.save(sample);
    const restored=files.load();
    const obstacles=placeObstacles('home',restored.furnishing);
    assert.equal(restored.money,98765);
    assert.equal(restored.characters.vlad.skill,77);
    assert.equal(restored.pets.simba.bond,56);
    assert.equal(restored.furnishing.placed.length,1);
    assert.ok(pointIsClear(restored.characters.vlad,obstacles,HOME_FLOOR),
      'a resident cannot respawn inside a wardrobe');
    const petGeo=petNavigationGeometry(obstacles,HOME_FLOOR);
    assert.ok(pointIsClear(restored.pets.simba.position,petGeo.obstacles,petGeo.floor),
      'a pet cannot respawn inside a wardrobe');
  }finally{rmSync(folder,{recursive:true,force:true});}
});

test('cooperative hugs and paths in furnished rooms route around purchased tables',()=>{
  const state=initialState();
  state.furnishing.nextId=2;
  state.furnishing.placed=[{id:1,sku:'table-round',finish:'sage',x:13,z:-5.2,rotation:0}];
  Object.assign(state.characters.vlad,{x:11.8,z:-5.5});
  Object.assign(state.characters.alina,{x:14.3,z:-5.5});
  const scene=pairScenes(state,'vlad',{type:'together',action:'softHug'});
  assert.ok(scene,'social actions must remain available after decorating a room');
  const obstacles=placeObstacles('home',state.furnishing);
  for(const role of ['vlad','alina'] as const){
    const routePoints: Array<{x:number;z:number}> = [scene[role].route.from,...scene[role].route.path];
    assert.ok(routePoints.length>=2);
    for(let i=1;i<routePoints.length;i++)
      assert.ok(segmentIsClear(routePoints[i-1],routePoints[i],obstacles,HOME_FLOOR),
        'social route crosses purchased furniture for '+role);
  }
});
