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
