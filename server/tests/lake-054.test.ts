import * as THREE from 'three';
import {buildCampFood,buildDetailedTent} from '../../src/game/LakeCampArt';
import {planTask} from '../tasks';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {initialState} from '../../src/shared/protocol';
import {LAKE_PASSES,lakeAccess,residentLook,validLake} from '../../src/shared/lake';
import {defaultWardrobe} from '../../src/shared/previewWardrobe';
import {STATIONS,stationById,approachFor,doorwayArrival,floorFor,placeObstacles} from '../../src/shared/locations';
import {applyWorld,lakeTogetherTrip,validWorld,localActivity} from '../locations';
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

test('fire is tied to installed campsite, shared, persisted and extinguishes on exit',()=>{
 let s=initialState();s.money=12000;const q=lakeTogetherTrip(s,'vlad','night');assert.ok(q.ok);s=q.state;
 at(s,'vlad','lake-fire-2');assert.equal(applyWorld(s,'vlad',{type:'lake_fire',station:'lake-fire-2',lit:true}).ok,false);
 at(s,'vlad','lake-rental');s=apply(s,'vlad',{type:'lake_rent',category:'tent',item:'family'});
 at(s,'vlad','lake-pitch-2');s=apply(s,'vlad',{type:'lake_pitch',station:'lake-pitch-2'});
 at(s,'alina','lake-fire-2');s=apply(s,'alina',{type:'lake_fire',station:'lake-fire-2',lit:true});assert.equal(s.world.lake?.vlad?.fire,true);
 assert.ok(validWorld(s.world));
 at(s,'vlad','lake-exit');s=apply(s,'vlad',{type:'travel',place:'district',via:'lake-exit'});assert.equal(s.world.lake?.alina?.fire,true);
 at(s,'alina','lake-exit');s=apply(s,'alina',{type:'travel',place:'district',via:'lake-exit'});assert.deepEqual(s.world.lake,{});
});
test('campfire meals cost once, make two servings and can be shared without duplication',()=>{
 let s=initialState();s.money=10000;const q=lakeTogetherTrip(s,'vlad','night');assert.ok(q.ok);s=q.state;
 at(s,'vlad','lake-rental');s=apply(s,'vlad',{type:'lake_rent',category:'tent',item:'basic'});
 at(s,'vlad','lake-pitch-1');s=apply(s,'vlad',{type:'lake_pitch',station:'lake-pitch-1'});
 at(s,'vlad','lake-fire-1');assert.equal(localActivity(s,'vlad','lakeCookSausages','lake-fire-1').ok,false);
 s=apply(s,'vlad',{type:'lake_fire',station:'lake-fire-1',lit:true});
 const cook=localActivity(s,'vlad','lakeCookSausages','lake-fire-1');assert.ok(cook.ok);assert.equal(cook.state.money,s.money-220);s=cook.state;
 assert.equal(s.world.lake?.vlad?.meals?.sausages,2);assert.ok(validWorld(s.world));
 for(const role of ['alina','vlad'] as const){at(s,role,'lake-fire-1');s.characters[role].hunger=10;const eat=localActivity(s,role,'lakeEatSausages','lake-fire-1');assert.ok(eat.ok);s=eat.state;assert.equal(s.characters[role].hunger,75);}
 assert.equal(localActivity(s,'vlad','lakeEatSausages','lake-fire-1').ok,false);
 assert.equal(planTask({type:'local_activity',station:'lake-fire-1',action:'lakeCookSausages'})?.durationMs,35000);
 assert.equal(planTask({type:'local_activity',station:'park-fire',action:'lakeCookSausages'}),null);
});
test('four tents differ in dimensions, food props are real geometry and fire only shows for live visits',()=>{
 const sizes=(['basic','nord','family','summit'] as const).map(id=>new THREE.Box3().setFromObject(buildDetailedTent(id),true).getSize(new THREE.Vector3()));
 for(let i=1;i<sizes.length;i++){assert.ok(sizes[i].x>sizes[i-1].x);assert.ok(sizes[i].y>sizes[i-1].y);}
 for(const k of ['fish','soup','sausages','marshmallow'] as const)assert.ok(new THREE.Box3().setFromObject(buildCampFood(k)).getSize(new THREE.Vector3()).length()>.15);
 const scene=createLocation('lake');try{
 const fire=scene.stations.get('lake-fire-1')!.userData.fire;
 const visit={vlad:{pass:'night' as const,until:1000,tent:'basic' as const,pitch:'lake-pitch-1',fire:true}};
 syncLakeTents(scene.stations,visit,900);assert.equal(fire.getObjectByName('Campfire active').visible,true);
 fire.userData.setFood('sausages');assert.equal(fire.getObjectByName('Camp food sausages').visible,true);
 fire.userData.setFood();assert.equal(fire.getObjectByName('Camp food sausages').visible,false);
 scene.animate?.(1.7);syncLakeTents(scene.stations,visit,1000);assert.equal(fire.getObjectByName('Campfire active').visible,false);
 }finally{scene.dispose();}
});
