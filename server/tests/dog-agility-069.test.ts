import test from 'node:test';
import assert from 'node:assert/strict';
import {initialState} from '../../src/shared/protocol';
import {AGILITY_ACTIONS,DOG_AGILITY,agilityPath,agilityHeight,validAgilityVisit,agilityConfidence} from '../../src/shared/dogAgility';
import {localActivity,validWorld,setDogParkPosition} from '../locations';
import {approachFor,stationById,placeObstacles,floorFor} from '../../src/shared/locations';
import {segmentIsClear,pointIsClear,findRoute} from '../../src/game/navigation';
import {planTask} from '../tasks';
import {openServerFiles} from '../storage';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
const station=stationById('park','park-dog')!;
function fixture(){const s=initialState();s.world.places={vlad:'park',alina:'park'};for(const role of ['vlad','alina'] as const)Object.assign(s.characters[role],approachFor(station,role));s.world.dogWalker='vlad';s.world.parkDog={minutes:0,toilets:0};setDogParkPosition(s);return s;}
test('all four physical routes stay inside park and avoid existing structures',()=>{
 const s=fixture(),floor=floorFor('park'),blocks=placeObstacles('park'),from=s.pets.verdell.parkPosition!;
 for(const a of AGILITY_ACTIONS){const path=agilityPath(a);assert.ok(path.every(p=>pointIsClear(p,blocks,floor)),a);assert.ok(path.slice(1).every((p,i)=>segmentIsClear(path[i],p,blocks,floor)),a);assert.ok(findRoute(from,path[0],blocks,floor),a);}
 assert.ok(agilityHeight('dogHurdle',DOG_AGILITY.dogHurdle)>.28);assert.equal(agilityHeight('dogTunnel',DOG_AGILITY.dogTunnel),0);assert.equal(agilityHeight('dogBalance',DOG_AGILITY.dogBalance),.19);assert.equal(agilityHeight('dogHurdle',{x:0,z:0}),0);
});
test('four voluntary exercises train existing commands, count actual completed attempts and are free',()=>{
 let s=fixture();const startMoney=s.money;
 for(const [i,a] of AGILITY_ACTIONS.entries()){const role=i%2?'alina':'vlad';const skill=DOG_AGILITY[a].skill;const before=s.pets.verdell.training?.[skill]?.xp??0;const energy=s.pets.verdell.energy;
 const plan=planTask({type:'local_activity',station:'park-dog',action:a});assert.equal(plan?.durationMs,24000);assert.equal(plan?.resource,'pet:verdell');
 const result=localActivity(s,role,a,'park-dog');assert.ok(result.ok,result.ok?'':result.reason);assert.equal(s.world.parkDog?.agility?.attempts,i===0?undefined:i);
 s=result.state;assert.equal(s.world.parkDog?.agility?.attempts,i+1);assert.equal(s.world.parkDog?.agility?.last?.owner,role);assert.equal(s.pets.verdell.energy,energy-4);assert.ok((s.pets.verdell.training?.[skill]?.xp??0)>before);assert.equal(s.money,startMoney);assert.ok(validWorld(s.world));}
 const dir=mkdtempSync(join(tmpdir(),'agility-069-'));try{const f=openServerFiles(dir);f.save(s);assert.deepEqual(f.load().world.parkDog?.agility,s.world.parkDog?.agility);}finally{rmSync(dir,{recursive:true,force:true});}
});
test('training and condition improve independent passages, new dog is helped',()=>{
 const s=fixture(),p=s.pets.verdell;assert.ok(agilityConfidence(p,'dogHurdle')<DOG_AGILITY.dogHurdle.threshold);
 const first=localActivity(s,'vlad','dogHurdle','park-dog');assert.ok(first.ok);assert.equal(first.state.world.parkDog?.agility?.last?.independent,false);
 p.training={fetch:{xp:100,attempts:10,successes:10},stay:{xp:100,attempts:10,successes:10}};p.happiness=90;p.bond=90;p.energy=90;
 const next=localActivity(s,'alina','dogBalance','park-dog');assert.ok(next.ok);assert.equal(next.state.world.parkDog?.agility?.last?.independent,true);assert.equal(next.state.world.parkDog?.agility?.independent,1);
});
test('no course without dog, proper location or safe needs; invalid visit rejected',()=>{
 const s=fixture();s.world.dogWalker=null;assert.equal(localActivity(s,'vlad','dogHurdle','park-dog').ok,false);
 s.world.dogWalker='vlad';s.pets.verdell.energy=39;assert.equal(localActivity(s,'vlad','dogBalance','park-dog').ok,false);
 s.pets.verdell.energy=90;s.characters.vlad.x=-6;assert.equal(localActivity(s,'alina','dogTunnel','park-dog').ok,false);
 assert.equal(localActivity(s,'alina','dogHurdle','park-picnic').ok,false);
 assert.equal(validAgilityVisit({attempts:1,independent:2}),false);assert.equal(validAgilityVisit({attempts:1,independent:0,last:{action:'wrong',owner:'vlad',independent:false}}),false);
});
