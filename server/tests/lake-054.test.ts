import {test} from 'node:test';
import assert from 'node:assert/strict';
import {initialState} from '../../src/shared/protocol';
import {LAKE_PASSES,lakeAccess,residentLook,validLake} from '../../src/shared/lake';
import {defaultWardrobe} from '../../src/shared/previewWardrobe';
import {STATIONS,stationById,approachFor,doorwayArrival,floorFor,placeObstacles} from '../../src/shared/locations';
import {applyWorld,lakeTogetherTrip,validWorld} from '../locations';
import {findRoute,pointIsClear} from '../../src/game/navigation';
import {createLocation} from '../../src/game/LocationScene';
import {syncLakeTents} from '../../src/game/LakeArt';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {openServerFiles} from '../storage';
function at(s:ReturnType<typeof initialState>,r:'vlad'|'alina',id:string){Object.assign(s.characters[r],approachFor(stationById(s.world.places[r],id)!,r));}
function apply(s:ReturnType<typeof initialState>,r:'vlad'|'alina',cmd:Record<string,unknown>){const q=applyWorld(s,r,cmd);if(!q.ok)assert.fail(q.reason);return q.state;}
test('solo lake entry charges exactly once and preserves the owned look',()=>{
 let s=initialState();s.money=10000;s.world.wardrobe=defaultWardrobe();s.world.wardrobe.vlad={owned:['signature','polo'],worn:'polo'};
 assert.equal(applyWorld(s,'vlad',{type:'travel',place:'lake'}).ok,false);
 assert.equal(applyWorld(s,'vlad',{type:'car_travel',place:'lake',pass:'day'}).ok,false);
 at(s,'vlad','family-car');s=apply(s,'vlad',{type:'car_travel',place:'lake',pass:'day'});
 assert.equal(s.money,9200);assert.ok(validWorld(s.world));assert.ok(lakeAccess(s,'vlad'));assert.equal(residentLook(s,'vlad'),'lake-visit');assert.equal(s.world.wardrobe!.vlad.worn,'polo');
 assert.equal(applyWorld(s,'vlad',{type:'car_travel',place:'lake',pass:'day'}).ok,false);
 at(s,'vlad','lake-exit');s=apply(s,'vlad',{type:'travel',place:'district',via:'lake-exit'});
 assert.equal(s.world.places.vlad,'home');assert.equal(s.world.lake?.vlad,undefined);assert.equal(residentLook(s,'vlad'),'polo');assert.ok(validWorld(s.world));
});
test('paired visit, shared tent, personal rods, return and persisted reservation',()=>{
 let s=initialState();s.money=15000;
 const trip=lakeTogetherTrip(s,'vlad','night');assert.ok(trip.ok);s=trip.state;
 assert.equal(s.money,12500);assert.ok(validWorld(s.world));
 for(const role of ['vlad','alina'] as const)at(s,role,'lake-rental');
 s=apply(s,'vlad',{type:'lake_rent',category:'tent',item:'nord'});
 assert.equal(applyWorld(s,'alina',{type:'lake_rent',category:'tent',item:'basic'}).ok,false);
 s=apply(s,'alina',{type:'lake_rent',category:'rod',item:'spin'});
 assert.equal(s.money,9950);
 at(s,'vlad','lake-pitch-2');s=apply(s,'vlad',{type:'lake_pitch',station:'lake-pitch-2'});
 assert.equal(s.world.lake?.vlad?.pitch,'lake-pitch-2');
 const dir=mkdtempSync(join(tmpdir(),'lake-save-'));
 try{const files=openServerFiles(dir);files.save(s);assert.deepEqual(files.load()!.world.lake,s.world.lake);}finally{rmSync(dir,{recursive:true,force:true});}
 at(s,'vlad','lake-exit');s=apply(s,'vlad',{type:'travel',place:'district',via:'lake-exit'});
 assert.equal(s.world.carDriver,'alina');assert.equal(s.world.lake?.alina?.tent,'nord');assert.equal(s.world.lake?.alina?.pitch,'lake-pitch-2');assert.ok(validWorld(s.world));
 at(s,'alina','lake-exit');s=apply(s,'alina',{type:'travel',place:'district',via:'lake-exit'});
 assert.deepEqual(s.world.lake,{});assert.equal(s.world.carDriver,undefined);assert.ok(validWorld(s.world));
});
test('expired or invalid passes cannot rent, and insufficient funds cannot enter',()=>{
 const s=initialState();s.money=100;assert.equal(lakeTogetherTrip(s,'vlad','weekend').ok,false);
 assert.equal(validLake({vlad:{pass:'day',until:10,tent:'bad'}}),false);
 s.money=10000;const q=lakeTogetherTrip(s,'vlad','day');assert.ok(q.ok);
 const next=q.state;next.world.lake!.vlad!.until=0;at(next,'vlad','lake-rental');
 assert.equal(applyWorld(next,'vlad',{type:'lake_rent',category:'rod',item:'float'}).ok,false);
 assert.equal(LAKE_PASSES.weekend.minutes,2880);
});
test('every station has a reachable approach, and the water is excluded from walking',()=>{
 const floor=floorFor('lake'),obs=placeObstacles('lake');
 for(const role of ['vlad','alina'] as const){
 const start=doorwayArrival('lake','district',role);
 assert.ok(pointIsClear(start,obs,floor));
 for(const station of STATIONS.lake){const end=approachFor(station,role);assert.ok(pointIsClear(end,obs,floor),station.id);assert.ok(findRoute(start,end,obs,floor),station.id);}
 }
 assert.ok(!pointIsClear({x:8,z:0},obs,floor));
});
test('club has all actual station meshes and only the rented tent becomes visible',()=>{
 const scene=createLocation('lake');
 try{assert.equal(scene.stations.size,STATIONS.lake.length);syncLakeTents(scene.stations,{vlad:{pass:'night',until:1000,tent:'family',pitch:'lake-pitch-2'}});
 for(const [id,g] of scene.stations){if(!g.userData.tents)continue;const visible=[...g.userData.tents.values()].filter((m:any)=>m.visible);assert.equal(visible.length,id==='lake-pitch-2'?1:0);}
 scene.animate?.(1);scene.setNight(true);
 }finally{scene.dispose();}
});
