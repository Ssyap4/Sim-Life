import {applyFoodAction} from '../food';
import {levelXP} from '../../src/shared/education';
import {recipeAvailability} from '../../src/shared/recipeAvailability';
import {LAKE_TALK_TOPICS,lakeTalkStation} from '../../src/shared/socialLife';
import {cooperationDenial,pairScenes,completeTogether} from '../society';
import {lakeCanSwim,lakeSwimFrame,LAKE_LEISURE,residentLook as lakeLook} from '../../src/shared/lake';
import {clockAt} from '../../src/shared/life';
import {syncLakeCutaway} from '../../src/game/LakeArt';
import {advanceLife} from '../life';
import {lakeSleepAnchor,LAKE_REST} from '../../src/shared/lake';
import {LAKE_FISH,LAKE_RODS,rollFish,validCatch,validFishing,emptyFishing,freshFish} from '../../src/shared/lake';
import {buildLakeFish,FishingProp} from '../../src/game/LakeFishingArt';
import {applyPetAction} from '../pets';
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

test('all fishing tackle durations and catch weights are bounded, nine fish have visible geometry',()=>{
 let seed=943;const rng=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
 const counts=new Set<string>();for(const rod of ['float','spin','feeder'] as const){let misses=0;for(let i=0;i<1500;i++){const fish=rollFish(rod,100,rng);if(!fish){misses++;continue;}assert.ok(validCatch(fish));counts.add(fish.species);}assert.ok(misses>150&&misses<550);assert.ok(LAKE_RODS[rod].seconds>=40);}
 assert.equal(counts.size,9);assert.equal(rollFish('float',100,()=>.999),null);
 for(const id of Object.keys(LAKE_FISH) as (keyof typeof LAKE_FISH)[]){const g=buildLakeFish(id);assert.ok(new THREE.Box3().setFromObject(g).getSize(new THREE.Vector3()).x>.2);}
 const root=new THREE.Group(),prop=new FishingProp('float');root.add(prop.group);for(const t of [0,1,6,30,39]){prop.frame(t,root,new THREE.Vector3(.13,1,.4));assert.ok(prop.rod.position.toArray().every(Number.isFinite));}prop.dispose();assert.equal(root.children.length,0);
});
test('fishing only at a fishing station with the rented rod, single-use catch and fridge stock',()=>{
 let s=initialState();s.money=10000;const q=lakeTogetherTrip(s,'vlad','night');assert.ok(q.ok);s=q.state;
 at(s,'vlad','lake-fish-1');assert.equal(localActivity(s,'vlad','lakeFishFloat','lake-fish-1').ok,false);
 at(s,'vlad','lake-rental');s=apply(s,'vlad',{type:'lake_rent',category:'rod',item:'float'});
 at(s,'vlad','lake-fish-1');assert.equal(localActivity(s,'vlad','lakeFishSpin','lake-fish-1').ok,false);
 const original=Math.random;try{Math.random=()=>.10;const r=localActivity(s,'vlad','lakeFishFloat','lake-fish-1');assert.ok(r.ok);s=r.state;}finally{Math.random=original;}
 assert.ok(s.world.lake?.vlad?.catch);assert.equal(localActivity(s,'vlad','lakeFishFloat','lake-fish-1').ok,false);
 s=apply(s,'vlad',{type:'lake_catch',keep:true});assert.equal(freshFish(s).length,1);assert.equal(applyWorld(s,'vlad',{type:'lake_catch',keep:true}).ok,false);
 assert.ok(validWorld(s.world));assert.ok(validFishing(s.world.fishing));
 at(s,'vlad','lake-exit');s=apply(s,'vlad',{type:'travel',place:'district',via:'lake-exit'});assert.equal(freshFish(s).length,1);
 s.pets.simba.bond=10;s.pets.simba.satiety=10;s.pets.simba.happiness=10;
 const treat=applyPetAction(s,'vlad','simba','fishTreat');assert.ok(treat.ok);s=treat.state;assert.equal(s.pets.simba.bond,45);assert.equal(s.pets.simba.satiety,100);assert.equal(s.pets.simba.happiness,100);assert.equal(freshFish(s).length,0);
 assert.equal(applyPetAction(s,'vlad','simba','fishTreat').ok,false);
});
test('fish and ukha require a real catch; no double-spend; release gives skill practice',()=>{
 let s=initialState();s.money=10000;const q=lakeTogetherTrip(s,'vlad','night');assert.ok(q.ok);s=q.state;
 at(s,'vlad','lake-rental');s=apply(s,'vlad',{type:'lake_rent',category:'tent',item:'basic'});
 at(s,'vlad','lake-pitch-1');s=apply(s,'vlad',{type:'lake_pitch',station:'lake-pitch-1'});at(s,'vlad','lake-fire-1');s=apply(s,'vlad',{type:'lake_fire',station:'lake-fire-1',lit:true});
 assert.equal(localActivity(s,'vlad','lakeCookSoup','lake-fire-1').ok,false);
 s.world.fishing=emptyFishing();s.world.fishing.fish.push({species:'carp',grams:1500,expires:99999});
 const r=localActivity(s,'vlad','lakeCookSoup','lake-fire-1');assert.ok(r.ok);s=r.state;assert.equal(freshFish(s).length,0);assert.equal(s.world.lake?.vlad?.meals?.soup,2);assert.equal(localActivity(s,'vlad','lakeCookFish','lake-fire-1').ok,false);
 s.world.lake!.vlad!.catch={species:'trout',grams:800,expires:99999};const before=s.education.characters.vlad.xp.attention;s=apply(s,'vlad',{type:'lake_catch',keep:false});assert.ok(s.education.characters.vlad.xp.attention>before);
 assert.ok(validWorld(s.world));
});

test('camp rest requires a live campsite; two sleeping lanes and tier comfort, day ticket excludes full sleep',()=>{
 let s=initialState();s.money=10000;let q=lakeTogetherTrip(s,'vlad','day');assert.ok(q.ok);s=q.state;
 at(s,'vlad','lake-pitch-2');assert.equal(localActivity(s,'vlad','lakeNap','lake-pitch-2').ok,false);
 at(s,'vlad','lake-rental');s=apply(s,'vlad',{type:'lake_rent',category:'tent',item:'nord'});
 at(s,'vlad','lake-pitch-2');s=apply(s,'vlad',{type:'lake_pitch',station:'lake-pitch-2'});
 assert.equal(localActivity(s,'vlad','lakeSleep','lake-pitch-2').ok,false);
 s.characters.vlad.energy=10;s.characters.vlad.comfort=10;let r=localActivity(s,'vlad','lakeNap','lake-pitch-2');assert.ok(r.ok);s=r.state;assert.equal(s.characters.vlad.energy,40);assert.equal(s.characters.vlad.comfort,35);
 s.world.lake!.vlad!.pass='night';s.world.lake!.alina!.pass='night';
 at(s,'alina','lake-pitch-2');s.characters.alina.energy=10;r=localActivity(s,'alina','lakeSleep','lake-pitch-2');assert.ok(r.ok);s=r.state;assert.equal(s.characters.alina.energy,85);
 at(s,'alina','lake-fire-2');assert.equal(localActivity(s,'alina','lakeFireRest','lake-fire-2').ok,false);
 s=apply(s,'alina',{type:'lake_fire',station:'lake-fire-2',lit:true});assert.ok(localActivity(s,'alina','lakeFireRest','lake-fire-2').ok);
 assert.equal(planTask({type:'local_activity',station:'lake-pitch-2',action:'lakeSleep'})?.durationMs,LAKE_REST.lakeSleep.seconds*1000);
 assert.equal(planTask({type:'local_activity',station:'lake-pitch-2',action:'lakeFireRest'}),null);
 for(const id of ['basic','nord','family','summit'] as const){const v=lakeSleepAnchor(id,'vlad'),a=lakeSleepAnchor(id,'alina');assert.ok(a.x-v.x>.9);assert.equal(a.z,v.z);}
});

test('lake dog joins only by choice, uses toilet, shares treats, transfers to partner and returns home',()=>{
 let s=initialState();s.money=10000;let q=lakeTogetherTrip(s,'vlad','night',true);assert.ok(q.ok);s=q.state;
 assert.equal(s.world.dogWalker,'vlad');assert.ok(s.pets.verdell.parkPosition);assert.ok(validWorld(s.world));
 s.pets.verdell.bladder=20;s=advanceLife(s,8,['vlad','alina']);assert.equal(s.pets.verdell.bladder,100);assert.ok(s.world.parkDog?.toiletUntil);
 at(s,'vlad','lake-rental');s=apply(s,'vlad',{type:'lake_rent',category:'tent',item:'basic'});at(s,'vlad','lake-pitch-1');s=apply(s,'vlad',{type:'lake_pitch',station:'lake-pitch-1'});
 at(s,'vlad','lake-fire-1');at(s,'alina','lake-fire-1');s.pets.verdell.satiety=10;
 s.world.lake!.vlad!.meals={fish:1};s=apply(s,'alina',{type:'lake_dog_treat',station:'lake-fire-1',fish:true});
 assert.equal(s.pets.verdell.satiety,55);assert.equal(s.world.lake!.vlad!.meals!.fish,0);assert.equal(applyWorld(s,'alina',{type:'lake_dog_treat',station:'lake-fire-1',fish:true}).ok,false);
 for(let i=0;i<2;i++)s=apply(s,'vlad',{type:'lake_dog_treat',station:'lake-fire-1',fish:false});
 assert.equal(applyWorld(s,'vlad',{type:'lake_dog_treat',station:'lake-fire-1',fish:false}).ok,false);
 at(s,'vlad','lake-pitch-1');s.pets.verdell.energy=10;const rest=localActivity(s,'vlad','lakeSleep','lake-pitch-1');assert.ok(rest.ok);s=rest.state;assert.equal(s.pets.verdell.energy,55);
 const dir=mkdtempSync(join(tmpdir(),'lake-dog-'));try{const f=openServerFiles(dir);f.save(s);assert.equal(f.load()!.world.dogWalker,'vlad');}finally{rmSync(dir,{recursive:true,force:true});}
 at(s,'vlad','lake-exit');s=apply(s,'vlad',{type:'travel',place:'district',via:'lake-exit'});assert.equal(s.world.dogWalker,'alina');
 at(s,'alina','lake-exit');s=apply(s,'alina',{type:'travel',place:'district',via:'lake-exit'});assert.equal(s.world.dogWalker,null);assert.equal(s.pets.verdell.parkPosition,undefined);
});

test('occupied tent cutaway hides only the roof and restores it without changing rental visibility',()=>{
 const scene=createLocation('lake');try{
 const visit={vlad:{pass:'night' as const,until:1000,tent:'summit' as const,pitch:'lake-pitch-2'}};
 syncLakeTents(scene.stations,visit,0);const models=scene.stations.get('lake-pitch-2')!.userData.tents;
 const model=models.get('summit');assert.ok(model.visible);assert.ok(model.userData.shell.visible);
 syncLakeCutaway(scene.stations,new Set(['lake-pitch-2']));assert.equal(model.userData.shell.visible,false);assert.ok(model.visible);assert.ok(model.children.some((c:THREE.Object3D)=>c!==model.userData.shell&&c.visible));
 syncLakeCutaway(scene.stations,new Set());assert.ok(model.userData.shell.visible);assert.equal(models.get('basic').visible,false);
 }finally{scene.dispose();}
});

test('club hygiene is included in valid ticket, toilet restores bladder and wash restores hygiene',()=>{
 let s=initialState();s.money=10000;const q=lakeTogetherTrip(s,'vlad','day');assert.ok(q.ok);s=q.state;s.characters.vlad.bladder=12;s.characters.vlad.hygiene=30;
 assert.equal(localActivity(s,'vlad','lakeToilet','lake-wash').ok,false);
 at(s,'vlad','lake-toilet');let r=localActivity(s,'vlad','lakeToilet','lake-toilet');assert.ok(r.ok);s=r.state;assert.equal(s.characters.vlad.bladder,100);
 at(s,'vlad','lake-wash');r=localActivity(s,'vlad','lakeWash','lake-wash');assert.ok(r.ok);assert.equal(r.state.characters.vlad.hygiene,65);assert.equal(r.state.money,s.money);
});

test('lake leisure is location and weather gated; two separate swimming lanes, outfit restored',()=>{
 let s=initialState();s.money=10000;const q=lakeTogetherTrip(s,'vlad','night',true);assert.ok(q.ok);s=q.state;
 at(s,'vlad','lake-swim');assert.equal(lakeCanSwim(s),false);assert.equal(localActivity(s,'vlad','lakeSwim','lake-swim').ok,false);
 // Use a warm day with a fresh visit, never bypass the ticket duration.
 for(let day=90;day<190;day++){s.clock=clockAt(day*1440+900);if(lakeCanSwim(s))break;}
 assert.ok(lakeCanSwim(s));for(const v of Object.values(s.world.lake!))v.until=999999;
 s.characters.vlad.energy=90;let r=localActivity(s,'vlad','lakeSwim','lake-swim');assert.ok(r.ok);s=r.state;assert.equal(s.characters.vlad.energy,78);
 assert.equal(lakeLook(s,'vlad',true),'spa-visit');assert.equal(lakeLook(s,'vlad',false),'lake-visit');
 for(let t=0;t<60;t+=.1){const a=lakeSwimFrame(t,'vlad'),b=lakeSwimFrame(t,'alina');assert.ok(a.x>6&&b.x>6);assert.ok(Math.hypot(a.x-b.x,a.z-b.z)>1.3);}
 at(s,'alina','lake-view');s.characters.alina.comfort=10;r=localActivity(s,'alina','lakeView','lake-view');assert.ok(r.ok);s=r.state;assert.equal(s.characters.alina.comfort,25);
 assert.equal(planTask({type:'local_activity',station:'lake-swim',action:'lakeSwim'})?.durationMs,LAKE_LEISURE.lakeSwim.seconds*1000);
 assert.equal(planTask({type:'local_activity',station:'lake-view',action:'lakeSwim'}),null);
});
test('extra meals use real catch, cost once and have distinct grill props',()=>{
 let s=initialState();s.money=10000;const q=lakeTogetherTrip(s,'vlad','night');assert.ok(q.ok);s=q.state;
 at(s,'vlad','lake-rental');s=apply(s,'vlad',{type:'lake_rent',category:'tent',item:'basic'});at(s,'vlad','lake-pitch-1');s=apply(s,'vlad',{type:'lake_pitch',station:'lake-pitch-1'});at(s,'vlad','lake-fire-1');s=apply(s,'vlad',{type:'lake_fire',station:'lake-fire-1',lit:true});
 assert.equal(localActivity(s,'vlad','lakeCookFoil','lake-fire-1').ok,false);
 let r=localActivity(s,'vlad','lakeCookPotato','lake-fire-1');assert.ok(r.ok);s=r.state;
 s.world.fishing=emptyFishing();s.world.fishing.fish.push({species:'carp',grams:1500,expires:99999},{species:'perch',grams:500,expires:99999});
 for(const action of ['lakeCookFoil','lakeCookSkewers'] as const){r=localActivity(s,'vlad',action,'lake-fire-1');assert.ok(r.ok);s=r.state;}
 assert.equal(freshFish(s).length,0);assert.equal(s.world.lake!.vlad!.meals!.foil,2);assert.equal(s.world.lake!.vlad!.meals!.skewers,2);
 for(const k of ['foil','potato','skewers'] as const)assert.ok(new THREE.Box3().setFromObject(buildCampFood(k)).getSize(new THREE.Vector3()).length()>.15);
 assert.ok(validWorld(s.world));
});
test('fire chat needs nearby partner; dog games need Verdell and improve bond',()=>{
 let s=initialState();s.money=10000;const q=lakeTogetherTrip(s,'vlad','night',true);assert.ok(q.ok);s=q.state;
 at(s,'vlad','lake-rental');s=apply(s,'vlad',{type:'lake_rent',category:'tent',item:'basic'});at(s,'vlad','lake-pitch-1');s=apply(s,'vlad',{type:'lake_pitch',station:'lake-pitch-1'});at(s,'vlad','lake-fire-1');s=apply(s,'vlad',{type:'lake_fire',station:'lake-fire-1',lit:true});
 const cmd={type:'together' as const,action:LAKE_TALK_TOPICS[0].id};assert.ok(cooperationDenial(s,'vlad',cmd));at(s,'alina','lake-fire-1');s.characters.vlad.social=10;s.characters.alina.social=10;assert.equal(cooperationDenial(s,'vlad',cmd),undefined);assert.equal(lakeTalkStation(s,'vlad')?.id,'lake-fire-1');const scenes=pairScenes(s,'vlad',cmd)!;assert.ok(scenes);let r=completeTogether(s,'vlad',cmd,['vlad','alina'],1,scenes);assert.ok(r.ok);s=r.state;assert.ok(s.characters.vlad.social>10&&s.characters.alina.social>10);assert.ok(s.relationship.memories.some(m=>m.action===cmd.action));
 at(s,'vlad','lake-dog');s.pets.verdell.bond=10;r=localActivity(s,'vlad','lakeDogFetch','lake-dog');assert.ok(r.ok);s=r.state;assert.equal(s.pets.verdell.bond,20);
 s.world.dogWalker=null;assert.equal(localActivity(s,'vlad','lakeDogRoll','lake-dog').ok,false);
});

test('bait purchased once per visit, automatic rare bonus with no change to bite rate',()=>{let s=initialState();s.money=10000;const q=lakeTogetherTrip(s,'vlad','night');assert.ok(q.ok);s=q.state;at(s,'vlad','lake-rental');const cash=s.money;s=apply(s,'vlad',{type:'lake_buy_bait'});assert.equal(s.money,cash-250);assert.equal(s.world.lake?.vlad?.bait,true);assert.equal(applyWorld(s,'vlad',{type:'lake_buy_bait'}).ok,false);assert.equal(s.world.lake?.alina?.bait,undefined);const rng=()=>{let i=0;return ()=>[.1,.94,.1,.1,.5][i++%5];};const a=rollFish('float',100,rng(),false)!,b=rollFish('float',100,rng(),true)!;assert.equal(LAKE_FISH[a.species].tier,1);assert.equal(LAKE_FISH[b.species].tier,2);assert.equal(rollFish('float',100,()=>.99,true),null);assert.ok(validWorld(s.world));});

test('three home catch recipes require a fresh fish and consume one only after successful cooking',()=>{
 let s=initialState();s.education.characters.vlad.xp.cooking=levelXP(10);s.characters.vlad.energy=100;
 for(const k of ['potato','oil','onion','carrot','herbs','tomato','lemon','butter'] as const)s.pantry[k]=10;
 s.world.fishing=emptyFishing();
 assert.equal(recipeAvailability(s,'vlad','lakeUkha').available,false);
 s.world.fishing.fish.push({species:'carp',grams:1500,expires:0});
 assert.equal(applyFoodAction(s,'vlad',{type:'cook',recipe:'lakeUkha'}).ok,false);
 for(const id of ['lakeFriedFish','lakeUkha','lakeBakedFish'] as const){
  s.world.fishing!.fish.push({species:'carp',grams:1500,expires:99999});
  const old=s.meals[id];const r=applyFoodAction(s,'vlad',{type:'cook',recipe:id},()=>.5);assert.ok(r.ok,JSON.stringify(r));s=r.state;assert.equal(freshFish(s).length,0);assert.ok(s.meals[id]>old);assert.equal(applyFoodAction(s,'vlad',{type:'cook',recipe:id}).ok,false);
  s.readyFood=[];for(const k of Object.keys(s.meals) as (keyof typeof s.meals)[])s.meals[k]=0;
 }
});
test('lake trail lights turn on at night and off by day',()=>{
 const scene=createLocation('lake');try{const lamps=scene.root.getObjectByName('Lake trail lanterns')!;assert.ok(lamps);const group=lamps.children.find(x=>x instanceof THREE.Group)!;assert.equal(group.visible,false);scene.setNight(true);assert.equal(group.visible,true);scene.setNight(false);assert.equal(group.visible,false);}finally{scene.dispose();}
});
