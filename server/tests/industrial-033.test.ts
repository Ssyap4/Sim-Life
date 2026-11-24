import test from 'node:test';
import assert from 'node:assert/strict';
import {initialState} from '../../src/shared/protocol';
import {approachFor, stationById, placeObstacles, floorFor, spawn} from '../../src/shared/locations';
import {districtArrival,districtStation,DISTRICT_SITES} from '../../src/shared/district';
import {findRoute} from '../../src/game/navigation';
import {applyWorld,validWorld} from '../locations';
import {beginShift,leaveShiftEarly} from '../jobs';
import {JOBS} from '../../src/shared/jobs';
test('industrial zone is separate from the trading district, both warehouses reachable, shifts unchanged',()=>{
 const s=initialState();
 assert.equal(DISTRICT_SITES.some(x=>String(x.place)==='industrial'),false);
 for(const role of ['vlad','alina'] as const){
  const gate=stationById('district',districtStation('industrial'))!;
  assert.ok(findRoute(districtArrival('home',role),approachFor(gate,role),placeObstacles('district'),floorFor('district')));
  const state=structuredClone(s);state.world.places[role]='district';Object.assign(state.characters[role],approachFor(gate,role));
  const enter=applyWorld(state,role,{type:'travel',place:'industrial',via:gate.id});assert.ok(enter.ok);
  for(const job of ['ozon','wildberries'] as const){
   const warehouse=stationById('industrial','warehouse-'+job)!;
   assert.ok(findRoute(enter.state.characters[role],approachFor(warehouse,role),placeObstacles('industrial'),floorFor('industrial')));
   assert.ok(warehouse.action.kind==='warehouse'&&warehouse.action.job===job);
   const working=beginShift(enter.state,role,job);assert.ok(working.ok);
   const shift=working.state.activeShifts[role]!;
   assert.ok(shift.hours>=14&&shift.hours<=16);
   assert.ok(shift.targetPay!>=JOBS[job].payMin&&shift.targetPay!<=JOBS[job].payMax);
   assert.ok(leaveShiftEarly(working.state,role).ok);
  }
  const exit=stationById('industrial','industrial-exit')!;
  Object.assign(enter.state.characters[role],approachFor(exit,role));
  const back=applyWorld(enter.state,role,{type:'travel',place:'district',via:exit.id});assert.ok(back.ok);
  assert.deepEqual({x:back.state.characters[role].x,z:back.state.characters[role].z},districtArrival('industrial',role));
  state.world.places[role]='home';Object.assign(state.characters[role],approachFor(stationById('home','family-car')!,role));
  const car=applyWorld(state,role,{type:'car_travel',place:'industrial'});assert.ok(car.ok);assert.ok(validWorld(car.state.world));
  assert.ok(findRoute(spawn('industrial',role),approachFor(exit,role),placeObstacles('industrial'),floorFor('industrial')));
  Object.assign(car.state.characters[role],approachFor(exit,role));
  const home=applyWorld(car.state,role,{type:'travel',place:'district',via:exit.id});assert.ok(home.ok);assert.equal(home.state.world.places[role],'home');
 }
});
