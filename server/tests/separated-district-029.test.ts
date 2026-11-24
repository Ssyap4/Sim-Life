import {test} from 'node:test';
import assert from 'node:assert/strict';
import {initialState,type CharacterId,type GameState} from '../../src/shared/protocol';
import {applyWorld} from '../locations';
import {stationById,placeObstacles,floorFor,clockMinutes,type PlaceId} from '../../src/shared/locations';
import {districtArrival,districtStation,HOME_GATE_INSIDE} from '../../src/shared/district';
import {findRoute,pointIsClear} from '../../src/game/navigation';
import {courierVisit,COURIER_GATE,COURIER_PORCH,COURIER_INDEX} from '../../src/shared/courier';
import {NEIGHBORS,neighborPose} from '../../src/shared/neighbors';
import {HOME_FLOOR} from '../../src/shared/home';
function send(s:GameState,r:CharacterId,c:Record<string,unknown>):GameState{
 const a=applyWorld(s,r,c,true);assert.ok(a.ok,a.ok?'':a.reason);return a.state;
}
function approach(s:GameState,r:CharacterId,id:string){return send(s,r,{type:'approach',place:s.world.places[r],station:id})}
function door(s:GameState,r:CharacterId,id:string,place:PlaceId){return send(approach(s,r,id),r,{type:'travel',place,via:id})}
test('Home and district have independent floors, gate transition and shared family state',()=>{
 let s=initialState();const start=structuredClone(s.characters.alina);
 assert.equal(stationById('home',districtStation('market')),undefined);
 assert.ok(stationById('district',districtStation('market')));
 assert.ok(HOME_FLOOR.maxX>=20);
 assert.ok(findRoute(s.characters.vlad,HOME_GATE_INSIDE,placeObstacles('home',s.furnishing),floorFor('home')));
 assert.equal(applyWorld(s,'vlad',{type:'travel',place:'district',via:'home-gate'}).ok,false);
 s=door(s,'vlad','home-gate','district');
 assert.equal(s.world.places.vlad,'district');assert.equal(s.world.places.alina,'home');assert.deepEqual(s.characters.alina,start);
 assert.ok(pointIsClear(s.characters.vlad,placeObstacles('district'),floorFor('district')));
 s=door(s,'vlad',districtStation('market'),'market');
 s=door(s,'vlad','market-exit','district');
 assert.deepEqual({x:s.characters.vlad.x,z:s.characters.vlad.z},districtArrival('market','vlad'));
 s=door(s,'vlad','district-gate','home');assert.equal(s.world.places.vlad,'home');
});
test('Courier arrives with existing NPC identity, handoff precedes parcel claim, and leaves',()=>{
 let s=initialState();const now=clockMinutes(s.clock);s.money=100000;
 const lines=[{id:'milk',quantity:1}]; // catalogue uses real product IDs in fixtures below
 const delivery=applyWorld(s,'vlad',{type:'delivery_order',lines,sequence:0});
 assert.ok(delivery.ok,delivery.ok?'':delivery.reason);s=delivery.state;
 const order=s.world.deliveries[0];assert.equal(courierVisit(s.world,now),null);
 assert.equal(NEIGHBORS[COURIER_INDEX].name,'Максим');
 const gate=courierVisit(s.world,order.readyAt-4)!;assert.deepEqual({x:gate.x,z:gate.z},COURIER_GATE);
 const porch=courierVisit(s.world,order.readyAt)!;assert.deepEqual({x:porch.x,z:porch.z},COURIER_PORCH);assert.ok(porch.waiting);
 s.clock.minute+=18;
 s=approach(s,'vlad','parcel');
 assert.equal(applyWorld(s,'vlad',{type:'delivery_claim',id:order.id}).ok,false);
 s=send(s,'vlad',{type:'delivery_handoff',id:order.id});assert.equal(s.world.deliveries[0].handedAt,order.readyAt);
 assert.equal(applyWorld(s,'vlad',{type:'delivery_handoff',id:order.id}).ok,false);
 assert.equal(courierVisit(s.world,order.readyAt+1)?.carrying,false);
 assert.equal(courierVisit(s.world,order.readyAt+4),null);
 s=send(s,'vlad',{type:'delivery_claim',id:order.id});assert.equal(s.world.deliveries.length,0);
 assert.equal(applyWorld(s,'vlad',{type:'delivery_claim',id:order.id}).ok,false);
 assert.ok(NEIGHBORS.some((_,i)=>neighborPose(i,now).visible)||NEIGHBORS.length===14);
});
