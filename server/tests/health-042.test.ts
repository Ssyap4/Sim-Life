import {test} from 'node:test';
import assert from 'node:assert/strict';
import {initialState} from '../../src/shared/protocol';
import {advanceLife} from '../life';
import {advancePetHealth,foodIllness,humanHealth,petHealth,validHealth} from '../../src/shared/health';
test('Healthy routine and offline resident do not acquire illness',()=>{
 const s=initialState();s.characters.alina.hunger=0;
 const n=advanceLife(s,720,['vlad']);assert.equal(humanHealth(n,'vlad').illness,undefined);assert.equal(humanHealth(n,'alina').risk.hunger,0);assert.equal(s.health,undefined);assert.ok(validHealth(n.health));
});
test('Only sustained critical hunger causes gastritis; recovery grants grace period',()=>{
 const s=initialState();s.characters.vlad.hunger=0;
 let n=advanceLife(s,719,['vlad']);assert.equal(humanHealth(n,'vlad').illness,undefined);
 n=advanceLife(n,1,['vlad']);assert.equal(humanHealth(n,'vlad').illness?.id,'gastritis');
 n=advanceLife(n,1440,['vlad']);n=advanceLife(n,1440,['vlad']);assert.equal(humanHealth(n,'vlad').illness,undefined);assert.equal(humanHealth(n,'vlad').cooldown,1440);
});
test('Food risk is quality-dependent and cannot replace an existing illness',()=>{
 const s=initialState();assert.equal(foodIllness(s,'alina','perfect',()=>0),false);
 assert.equal(foodIllness(s,'alina','bad',()=>.09),false);
 assert.equal(foodIllness(s,'alina','bad',()=>.01),true);
 assert.equal(foodIllness(s,'alina','average',()=>0),false);
 assert.equal(humanHealth(s,'alina').illness?.id,'poisoning');
});
test('Pets have independent neglect counters and recover with grace',()=>{
 const s=initialState();s.pets.verdell.satiety=0;
 advancePetHealth(s,1439);assert.equal(petHealth(s,'verdell').illness,undefined);
 advancePetHealth(s,1);assert.equal(petHealth(s,'verdell').illness?.id,'digestive');assert.equal(petHealth(s,'simba').illness,undefined);
 advancePetHealth(s,1440);advancePetHealth(s,1440);assert.equal(petHealth(s,'verdell').illness,undefined);assert.equal(petHealth(s,'verdell').cooldown,1440);
});
test('Invalid persisted illnesses are rejected',()=>{
 const s=initialState();foodIllness(s,'vlad','bad',()=>0);assert.ok(validHealth(s.health));
 (s.health!.people.vlad.illness as any).id='not-a-condition';assert.equal(validHealth(s.health),false);
});

import {STATIONS,approachFor,placeObstacles,floorFor,doorwayArrival,stationById,clockMinutes} from '../../src/shared/locations';
import {findRoute,pointIsClear} from '../../src/game/navigation';
import {createLocation} from '../../src/game/LocationScene';
import {applyWorld,validWorld,localActivity} from '../locations';
import {planTask} from '../tasks';
import {healthBookingSlots,clinicAvailable} from '../../src/shared/health';
import {openServerFiles} from '../storage';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
test('Clinic station approaches, arrival and return are navigable for both residents',()=>{
 const floor=floorFor('clinic'),obstacles=placeObstacles('clinic');
 for(const role of ['vlad','alina'] as const){
  const origin=doorwayArrival('clinic','district',role);assert.ok(pointIsClear(origin,obstacles,floor));
  for(const station of STATIONS.clinic){
   const target=approachFor(station,role);
   assert.ok(pointIsClear(target,obstacles,floor),station.id);
   assert.ok(findRoute(origin,target,obstacles,floor),station.id+' outbound');
   assert.ok(findRoute(target,origin,obstacles,floor),station.id+' return');
  }
 }
 const scene=createLocation('clinic');try{assert.equal(scene.stations.size,STATIONS.clinic.length);}finally{scene.dispose();}
});
test('Clinic services require correct location and approach; prescription and funds are server controlled',()=>{
 let s=initialState();s.money=100000;foodIllness(s,'vlad','bad',()=>0);
 const send=(cmd:Record<string,unknown>)=>{const result=applyWorld(s,'vlad',cmd);if(!result.ok)assert.fail(result.reason);s=result.state;};
 assert.equal(applyWorld(s,'vlad',{type:'health_book',at:-1}).ok,false);
 const at=healthBookingSlots(clockMinutes(s.clock))[0];send({type:'health_book',at});assert.equal(humanHealth(s,'vlad').booking,at);
 assert.equal(localActivity(s,'vlad','clinicExam','clinic-doctor').ok,false);
 assert.equal(applyWorld(s,'vlad',{type:'travel',place:'clinic'}).ok,false);
 Object.assign(s.characters.vlad,approachFor(stationById('home','family-car')!,'vlad'));
 send({type:'car_travel',place:'clinic'});assert.equal(s.world.places.vlad,'clinic');assert.ok(validWorld(s.world));
 assert.equal(localActivity(s,'vlad','clinicExam','clinic-doctor').ok,false);
 const perform=(action:import('../../src/shared/health').ClinicAction,station:string)=>{send({type:'approach',place:'clinic',station});const result=localActivity(s,'vlad',action,station);if(!result.ok)assert.fail(result.reason);s=result.state;};
 perform('clinicExam','clinic-doctor');assert.equal(s.money,98500);assert.equal(humanHealth(s,'vlad').illness?.diagnosed,true);assert.equal(humanHealth(s,'vlad').booking,undefined);
 assert.equal(localActivity(s,'vlad','clinicExam','clinic-doctor').ok,false);
 assert.equal(planTask({type:'local_activity',action:'clinicMedicine',station:'clinic-doctor'}),null);
 assert.equal(planTask({type:'local_activity',action:'clinicMedicine',station:'clinic-pharmacy'})?.durationMs,8000);
 perform('clinicDiagnosis','clinic-diagnostics');assert.equal(s.money,96000);
 perform('clinicProcedure','clinic-procedure');assert.equal(s.money,91500);
 perform('clinicMedicine','clinic-pharmacy');assert.equal(s.money,90850);
 assert.equal(clinicAvailable(s,'vlad','clinicMedicine'),false);assert.equal(applyWorld(s,'alina',{type:'health_medicine'}).ok,false);
 send({type:'approach',place:'clinic',station:'clinic-exit'});send({type:'travel',place:'district',via:'clinic-exit'});assert.equal(s.world.places.vlad,'home');assert.equal(s.world.carDriver,undefined);
 const before=humanHealth(s,'vlad').illness!.remaining;send({type:'health_medicine'});assert.ok(humanHealth(s,'vlad').illness!.remaining<before);assert.equal(applyWorld(s,'vlad',{type:'health_medicine'}).ok,false);
 assert.equal(s.ledger.filter(x=>x.label.startsWith('Добрый доктор')).length,4);
 const dir=mkdtempSync(join(tmpdir(),'simlife-health-'));
 try{const files=openServerFiles(dir);files.save(s);assert.deepEqual(files.load().health,s.health);}finally{rmSync(dir,{recursive:true,force:true});}
});
test('Unaffordable service never charges or diagnoses',()=>{
 let s=initialState();s.money=1499;foodIllness(s,'alina','bad',()=>0);s.world.places.alina='clinic';Object.assign(s.characters.alina,approachFor(stationById('clinic','clinic-doctor')!,'alina'));
 assert.equal(localActivity(s,'alina','clinicExam','clinic-doctor').ok,false);assert.equal(s.money,1499);assert.equal(humanHealth(s,'alina').illness?.diagnosed,false);
});