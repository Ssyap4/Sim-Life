import test from 'node:test';
import assert from 'node:assert/strict';
import {initialState} from '../../src/shared/protocol';
import {DUST_ROOMS,DUST_MAX,advanceDust,initialDust} from '../../src/shared/homeDust';
import {VACUUM_MODELS} from '../../src/shared/vacuumCatalog';
import {vacuumDock,vacuumItem,planVacuum,controlVacuum,advanceVacuum,validVacuum} from '../../src/shared/vacuum';
import {placeObstacles,stationById,approachFor,floorFor} from '../../src/shared/locations';
import {segmentIsClear,planWalk} from '../../src/game/navigation';
import {applyWorld} from '../locations';
import {applyFurnishing} from '../furnishing';
import {buildVacuumModel} from '../../src/game/VacuumArt';
import {checkFurniturePlacement} from '../../src/shared/furnishingPlacement';
import {advanceLife} from '../life';
import * as THREE from 'three';
const placed={id:1,sku:'vacuum-dreame',finish:'ivory' as const,x:14,z:-6,rotation:0 as const};
function household(){
 const s=initialState();s.furnishing.placed=[placed];s.furnishing.nextId=2;s.homeDust=advanceDust(initialDust(),DUST_MAX);
 return s;
}
test('all rooms are visited on static obstacle-safe routes with characters and pets ignored',()=>{
 const s=household(),item=vacuumItem(s)!;
 const rooms=DUST_ROOMS.map(r=>r.id),plan=planVacuum(s,item,vacuumDock(item),rooms);
 assert.ok(plan);assert.deepEqual(plan.skipped,[]);assert.deepEqual(plan.route.filter(p=>p.room).map(p=>p.room),rooms);
 const obs=placeObstacles('home',{...s.furnishing,placed:[]});
 let prev=vacuumDock(item);
 for(const p of plan.route){assert.ok(segmentIsClear(prev,p,obs,floorFor('home')),JSON.stringify([prev,p]));prev=p;}
 assert.deepEqual(prev,vacuumDock(item));
 Object.assign(s.characters.vlad,plan.route[0]);s.pets.verdell.position=plan.route[1];
 assert.deepEqual(planVacuum(s,item,vacuumDock(item),rooms),plan);
});
test('all three tiers clean only visited rooms and return to dock',()=>{
 for(const [sku,m] of Object.entries(VACUUM_MODELS)){
  const s=household();s.furnishing.placed[0]={...placed,sku};
  assert.equal(controlVacuum(s,{type:'vacuum_control',action:'start',room:'kitchen'}),undefined);
  assert.ok(validVacuum(s.vacuum));assert.equal(s.homeDust!.kitchen,DUST_MAX);
  for(let i=0;i<500&&s.vacuum!.mode!=='docked';i++)advanceVacuum(s,1);
  assert.equal(s.vacuum!.mode,'docked');assert.deepEqual(s.vacuum!.position,vacuumDock(s.furnishing.placed[0]));
  assert.equal(s.homeDust!.kitchen,Math.round(DUST_MAX*(100-m.clean)/100));assert.equal(s.homeDust!.bedroom,DUST_MAX);
 }
});
test('stop preserves dust and position; return does not clean; daily mode starts only once',()=>{
 const s=household();
 controlVacuum(s,{type:'vacuum_control',action:'start',room:'kitchen'});advanceVacuum(s,2);
 controlVacuum(s,{type:'vacuum_control',action:'stop'});const position={...s.vacuum!.position};
 advanceVacuum(s,60);assert.deepEqual(s.vacuum!.position,position);assert.equal(s.homeDust!.kitchen,DUST_MAX);
 controlVacuum(s,{type:'vacuum_control',action:'return'});advanceVacuum(s,200);assert.equal(s.vacuum!.mode,'docked');assert.equal(s.homeDust!.kitchen,DUST_MAX);
 s.clock.day++;s.clock.minute=600;controlVacuum(s,{type:'vacuum_control',action:'auto',enabled:true});advanceVacuum(s,1);
 assert.equal(s.vacuum!.mode,'cleaning');advanceVacuum(s,1440);assert.equal(s.vacuum!.mode,'docked');
 advanceVacuum(s,5);assert.equal(s.vacuum!.mode,'docked');
 const offline=advanceLife(s,60,[]);assert.deepEqual(offline.vacuum,s.vacuum);
});
test('purchase is store-only, shared, affordable, and installs via existing furniture placement',()=>{
 let s=initialState();s.money=100000;
 assert.equal(applyWorld(s,'vlad',{type:'vacuum_buy',sku:'vacuum-xiaomi'}).ok,false);
 s.world.places.vlad='electronics';Object.assign(s.characters.vlad,approachFor(stationById('electronics','tech-cash')!,'vlad'));
 const r=applyWorld(s,'vlad',{type:'vacuum_buy',sku:'vacuum-xiaomi'});assert.ok(r.ok);s=r.state;
 assert.equal(s.money,80100);assert.equal(s.furnishing.stored[0].sku,'vacuum-xiaomi');
 assert.equal(applyWorld(s,'vlad',{type:'vacuum_buy',sku:'vacuum-xiaomi'}).ok,false);
 const stations=['tech-vacuum','tech-cash','tech-exit'].map(id=>stationById('electronics',id)!);
 const obs=placeObstacles('electronics');
 for(const p of stations)assert.ok(planWalk(stations[2].approach,p.approach,obs,floorFor('electronics')),p.id);
 s.world.places.vlad='home';
 const candidate={...s.furnishing.stored[0],x:14,z:-6,rotation:0 as const};
 assert.ok(checkFurniturePlacement(s,candidate).valid);
 const install=applyFurnishing(s,'vlad',{type:'furniture_place',id:candidate.id,x:14,z:-6,rotation:0},0);assert.ok(install.ok);
 assert.ok(vacuumItem(install.state));
});
test('three station models have separate moving robot body and fit their placement footprint',()=>{
 for(const [sku,m] of Object.entries(VACUUM_MODELS)){
  const model=buildVacuumModel(sku as keyof typeof VACUUM_MODELS);
  assert.ok(model.getObjectByName('Vacuum moving body'));
  const b=new THREE.Box3().setFromObject(model),size=b.getSize(new THREE.Vector3());
  assert.ok(size.x<=m.width+.01&&size.z<=m.depth+.01&&size.y<=m.height+.01,sku+': '+size.toArray());
 }
});