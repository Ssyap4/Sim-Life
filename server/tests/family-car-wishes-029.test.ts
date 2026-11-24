import {test} from 'node:test';
import assert from 'node:assert/strict';
import {initialState,type GameState,type CharacterId} from '../../src/shared/protocol';
import {applyWorld,validWorld} from '../locations';
import {applyPetAction} from '../pets';
import {CAR_APPROACH,placeObstacles,floorFor,type PlaceId} from '../../src/shared/locations';
import {findRoute,pointIsClear} from '../../src/game/navigation';
import {wishesFor} from '../../src/shared/wishes';
import {VITAL_NEEDS} from '../../src/shared/life';
import {bedPose} from '../../src/shared/bedSleep';
import {districtStation} from '../../src/shared/district';
function send(s:GameState,r:CharacterId,c:Record<string,unknown>){
 const result=applyWorld(s,r,c,true);assert.ok(result.ok,result.ok?'':result.reason);return result.state;
}
function approach(s:GameState,r:CharacterId,id:string){return send(s,r,{type:'approach',place:s.world.places[r],station:id});}
test('Car is reached by a real path, only one driver, direct round trip and partner remains in bed',()=>{
 let s=initialState();s.characters.alina.pose='sleep';s.characters.alina.sleepingOn='starter';
 const asleep=structuredClone(s.characters.alina);
 assert.ok(bedPose(s,'alina','starter'));
 assert.ok(pointIsClear(CAR_APPROACH,placeObstacles('home',s.furnishing),floorFor('home')));
 assert.ok(findRoute(s.characters.vlad,CAR_APPROACH,placeObstacles('home',s.furnishing),floorFor('home')));
 assert.equal(applyWorld(s,'vlad',{type:'car_travel',place:'market'}).ok,false);
 for(const destination of ['market','cafe'] as const){
  s=approach(s,'vlad','family-car');
  s=send(s,'vlad',{type:'car_travel',place:destination});
  assert.equal(s.world.places.vlad,destination);assert.equal(s.world.carDriver,'vlad');
  assert.ok(validWorld(s.world));assert.deepEqual(s.characters.alina,asleep);
  assert.equal(applyWorld(s,'alina',{type:'car_travel',place:'cafe'}).ok,false);
  assert.equal(applyWorld(s,'vlad',{type:'travel',place:'home'}).ok,false);
  s=approach(s,'vlad',destination+'-exit');
  s=send(s,'vlad',{type:'travel',place:'district',via:destination+'-exit'});
  assert.equal(s.world.places.vlad,'home');assert.equal(s.world.carDriver,undefined);
  assert.deepEqual({x:s.characters.vlad.x,z:s.characters.vlad.z},CAR_APPROACH);
  assert.deepEqual(s.characters.alina,asleep);
 }
});
test('Walking routes remain separate from driving',()=>{
 let s=initialState();
 function door(id:string,destination:PlaceId){s=approach(s,'vlad',id);s=send(s,'vlad',{type:'travel',place:destination,via:id});}
 door('home-gate','district');
 door(districtStation('market'),'market');
 assert.equal(s.world.carDriver,undefined);
 door('market-exit','district');
 assert.equal(s.world.places.vlad,'district');
 door('district-gate','home');assert.equal(s.world.places.vlad,'home');
 assert.notDeepEqual({x:s.characters.vlad.x,z:s.characters.vlad.z},CAR_APPROACH);
});
test('Comfortable people have personal desires rather than fake need prompts',()=>{
 const s=initialState();
 for(const r of ['vlad','alina'] as const){
   for(const n of VITAL_NEEDS)s.characters[r][n]=69;
   const plans=wishesFor(s,r);assert.ok(plans.length>=2);assert.ok(plans.every(w=>!w.need&&w.urgency==='calm'));
   s.characters[r].bladder=50;assert.equal(wishesFor(s,r)[0].need,'bladder');
   s.characters[r].bladder=51;assert.ok(wishesFor(s,r).every(w=>w.need!=='bladder'));
 }
 assert.notDeepEqual(wishesFor(s,'vlad').map(w=>w.id),wishesFor(s,'alina').map(w=>w.id));
});
test('Legacy buyFood command cannot spend money or grant food',()=>{
 const s=initialState();const old=structuredClone(s);
 for(const pet of ['verdell','simba'])assert.equal(applyPetAction(s,'vlad',pet,'buyFood').ok,false);
 assert.deepEqual(s,old);
});
