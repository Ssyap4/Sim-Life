import {test} from 'node:test';
import assert from 'node:assert/strict';
import {initialState} from '../../src/shared/protocol';
import {STATIONS,approachFor,placeObstacles,floorFor,doorwayArrival,stationById,clockMinutes} from '../../src/shared/locations';
import {findRoute,pointIsClear} from '../../src/game/navigation';
import {createLocation} from '../../src/game/LocationScene';
import {applyWorld,validWorld,localActivity} from '../locations';
import {fitnessAccess,fitnessBookingSlots,fitnessProfile,SAUNA_PRICE} from '../../src/shared/fitness';
import {planTask} from '../tasks';
test('PULSE has navigable entrance, each station and return route for both residents',()=>{
 const obstacles=placeObstacles('fitness'),floor=floorFor('fitness');
 for(const role of ['vlad','alina'] as const){
  const origin=doorwayArrival('fitness','district',role);
  assert.ok(pointIsClear(origin,obstacles,floor));
  for(const station of STATIONS.fitness){
   const target=approachFor(station,role);
   assert.ok(pointIsClear(target,obstacles,floor),station.id+' approach');
   assert.ok(findRoute(origin,target,obstacles,floor),station.id+' outbound');
   assert.ok(findRoute(target,origin,obstacles,floor),station.id+' return');
  }
 }
 const scene=createLocation('fitness');
 try{assert.equal(scene.stations.size,STATIONS.fitness.length);assert.ok(scene.root.children.length>10);}
 finally{scene.dispose();}
});
test('PULSE car trip, bookings, membership and sauna are persisted and server checked',()=>{
 let s=initialState();s.money=100000;
 const send=(cmd:Record<string,unknown>)=>{const r=applyWorld(s,'vlad',cmd);if(!r.ok)assert.fail(r.reason);s=r.state;};
 const at=fitnessBookingSlots(clockMinutes(s.clock))[0];
 assert.equal(applyWorld(s,'vlad',{type:'fitness_book',at:-1}).ok,false);
 send({type:'fitness_book',at});assert.equal(fitnessProfile(s,'vlad').booking,at);
 send({type:'fitness_pass',pass:'family'});assert.equal(s.money,80100);assert.ok(fitnessAccess(s,'vlad'));assert.ok(fitnessAccess(s,'alina'));assert.ok(validWorld(s.world));
 Object.assign(s.characters.vlad,approachFor(stationById('home','family-car')!,'vlad'));
 send({type:'car_travel',place:'fitness'});assert.equal(s.world.places.vlad,'fitness');
 assert.ok(validWorld(s.world));
 assert.equal(localActivity(s,'vlad','fitnessSauna','fitness-sauna').ok,false);
 send({type:'approach',place:'fitness',station:'fitness-sauna'});
 s.world.fitness!.vlad.fatigue=70;s.characters.vlad.energy=80;s.characters.vlad.hunger=80;
 assert.equal(planTask({type:'local_activity',action:'fitnessSauna',station:'fitness-sauna'})?.durationMs,40000);
 const sauna=localActivity(s,'vlad','fitnessSauna','fitness-sauna');assert.ok(sauna.ok);s=sauna.state;
 assert.equal(s.money,80100-SAUNA_PRICE);assert.equal(fitnessProfile(s,'vlad').fatigue,35);
 assert.equal(localActivity(s,'vlad','fitnessSauna','fitness-sauna').ok,false);
 send({type:'approach',place:'fitness',station:'fitness-exit'});send({type:'travel',place:'district',via:'fitness-exit'});assert.equal(s.world.places.vlad,'home');assert.equal(s.world.carDriver,undefined);
});

test('A prepaid single ticket is consumed once on arrival, never becomes a day pass',()=>{
 let s=initialState();s.money=10000;
 const send=(cmd:Record<string,unknown>)=>{const r=applyWorld(s,'vlad',cmd);if(!r.ok)assert.fail(r.reason);s=r.state;};
 send({type:'fitness_pass',pass:'single'});
 assert.equal(fitnessProfile(s,'vlad').ticket,true);assert.equal(fitnessAccess(s,'vlad'),false);
 assert.equal(applyWorld(s,'vlad',{type:'fitness_pass',pass:'single'}).ok,false);
 Object.assign(s.characters.vlad,approachFor(stationById('home','family-car')!,'vlad'));
 send({type:'car_travel',place:'fitness'});assert.equal(fitnessProfile(s,'vlad').ticket,undefined);assert.ok(fitnessAccess(s,'vlad'));
 send({type:'approach',place:'fitness',station:'fitness-exit'});send({type:'travel',place:'district',via:'fitness-exit'});
 assert.equal(fitnessAccess(s,'vlad'),false);assert.equal(s.money,9200);
});

import {fitnessStats,fitnessBonuses,fitnessTaskSpeed,fitnessExercise,initialFitness} from '../../src/shared/fitness';
import {levelXP} from '../../src/shared/education';
import {advanceLife} from '../life';
import {recoverSleep} from '../timeControl';
import {awardActivity} from '../education';

test('every exercise has a real timed action, server validation and progression for both residents',()=>{
 for(const role of ['vlad','alina'] as const)for(const station of STATIONS.fitness){
  const e=station.action.kind==='fitness'?fitnessExercise(station.action.facility):undefined;
  if(!e)continue;
  const s=initialState();
  s.world.places[role]='fitness';
  Object.assign(s.characters[role],approachFor(station,role),{energy:100,hunger:100,hygiene:100});
  const cmd={type:'local_activity',station:station.id,action:'fitnessTrain'} as const;
  assert.equal(planTask(cmd)?.durationMs,e.minutes*2000);
  assert.equal(localActivity(s,role,'fitnessTrain',station.id).ok,false);
  s.world.fitness=initialFitness();s.world.fitness[role].until=clockMinutes(s.clock)+1440;
  s.education.characters[role].xp.fitness=levelXP(2);
  const r=localActivity(s,role,'fitnessTrain',station.id);assert.ok(r.ok,station.id);
  assert.ok(fitnessStats(r.state,role)[e.axis]>0);
  assert.equal(fitnessProfile(r.state,role).fatigue,e.fatigue);
  assert.ok(r.state.characters[role].energy<100);
  assert.ok(r.state.characters[role].hygiene<100);
  assert.equal(fitnessProfile(s,role).fatigue,0);
  awardActivity(r.state,role,cmd,e.name);
  assert.ok(r.state.education.characters[role].xp.fitness>s.education.characters[role].xp.fitness);
  assert.ok(validWorld(r.state.world));
 }
});
test('fatigue, daily gain limits, rest and sauna prevent unlimited workout farming',()=>{
 let s=initialState();s.money=100000;s.world.places.vlad='fitness';
 s.world.fitness=initialFitness();s.world.fitness.vlad.until=clockMinutes(s.clock)+14400;
 // Choose by facility rather than depending on station IDs.
 const treadmill=STATIONS.fitness.find(st=>st.action.kind==='fitness'&&st.action.facility==='treadmill')!;
 assert.ok(treadmill);
 Object.assign(s.characters.vlad,approachFor(treadmill,'vlad'));
 for(let i=0;i<5;i++){
  Object.assign(s.characters.vlad,{energy:100,hunger:100,hygiene:100});
  const r=localActivity(s,'vlad','fitnessTrain',treadmill.id);assert.ok(r.ok);s=r.state;
 }
 assert.equal(fitnessStats(s,'vlad').endurance,8);assert.equal(fitnessProfile(s,'vlad').fatigue,70);
 s.world.fitness!.vlad.fatigue=85;
 assert.equal(localActivity(s,'vlad','fitnessTrain',treadmill.id).ok,false);
 const after=advanceLife(s,60,['vlad']);assert.equal(fitnessProfile(after,'vlad').fatigue,83);
 const sauna=STATIONS.fitness.find(st=>st.action.kind==='fitness'&&st.action.facility==='sauna')!;
 Object.assign(after.characters.vlad,approachFor(sauna,'vlad'),{energy:100,hunger:100});
 const r=localActivity(after,'vlad','fitnessSauna',sauna.id);assert.ok(r.ok);assert.equal(fitnessProfile(r.state,'vlad').fatigue,48);
});
test('maximal fitness improves passive needs, sleeping and household work; inactivity decays form only',()=>{
 const s=initialState();s.world.fitness=initialFitness();
 s.world.fitness.vlad.stats={strength:100,endurance:100,flexibility:100,recovery:100};
 s.world.fitness.vlad.lastTrainingDay=s.clock.day;
 Object.assign(s.characters.vlad,{energy:50,comfort:50,hunger:50});
 Object.assign(s.characters.alina,{energy:50,comfort:50,hunger:50});
 const bonus=fitnessBonuses(s,'vlad');
 assert.deepEqual(bonus,{energyDrain:.75,comfortDrain:.75,moodDrain:.8,sleepGain:1.3,physicalSpeed:1.2});
 assert.equal(fitnessTaskSpeed(s,'vlad',{type:'clean_room',room:'living'} as any),1.2);
 const next=advanceLife(s,60,['vlad','alina']);
 assert.ok(next.characters.vlad.energy>next.characters.alina.energy);
 assert.ok(next.characters.vlad.comfort>next.characters.alina.comfort);
 recoverSleep(next,10,new Map([['vlad','full'],['alina','full']]));
 assert.ok(next.characters.vlad.energy>next.characters.alina.energy);
 let aged=s;for(let i=0;i<6;i++)aged=advanceLife(aged,1440,['vlad']);
 assert.equal(fitnessStats(aged,'vlad').strength,99);
 assert.equal(aged.education.characters.vlad.xp.fitness,s.education.characters.vlad.xp.fitness);
});
