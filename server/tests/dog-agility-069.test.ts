import test from 'node:test';
import assert from 'node:assert/strict';
import {initialState} from '../../src/shared/protocol';
import {AGILITY_ACTIONS,DOG_AGILITY,agilityPath,agilityHeight,validAgilityVisit,agilityConfidence,agilityCueQuality} from '../../src/shared/dogAgility';
import {localActivity,validWorld,setDogParkPosition} from '../locations';
import {approachFor,stationById,placeObstacles,floorFor,STATIONS,spawn,meeting} from '../../src/shared/locations';
import {segmentIsClear,pointIsClear,findRoute} from '../../src/game/navigation';
import {planTask} from '../tasks';
import {openServerFiles} from '../storage';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
const station=stationById('park','park-dog')!;
function fixture(){const s=initialState();s.world.places={vlad:'park',alina:'park'};for(const role of ['vlad','alina'] as const)Object.assign(s.characters[role],approachFor(station,role));s.world.dogWalker='vlad';s.world.parkDog={minutes:0,toilets:0};setDogParkPosition(s);return s;}
test('all four physical routes stay inside park and avoid existing structures',()=>{
 const s=fixture(),floor=floorFor('park'),from=s.pets.verdell.parkPosition!;
 for(const a of AGILITY_ACTIONS){const blocks=placeObstacles('park',undefined,a),path=agilityPath(a);assert.equal(pointIsClear(DOG_AGILITY[a],placeObstacles('park'),floor),false);assert.ok(path.every(p=>pointIsClear(p,blocks,floor)),a);assert.ok(path.slice(1).every((p,i)=>segmentIsClear(path[i],p,blocks,floor)),a);assert.ok(findRoute(from,path[0],blocks,floor),a);for(const role of ['vlad','alina'] as const)assert.ok(pointIsClear(approachFor(station,role),placeObstacles('park'),floor));}
 assert.ok(agilityHeight('dogHurdle',DOG_AGILITY.dogHurdle)>.28);assert.equal(agilityHeight('dogTunnel',DOG_AGILITY.dogTunnel),0);assert.equal(agilityHeight('dogBalance',DOG_AGILITY.dogBalance),.19);assert.equal(agilityHeight('dogHurdle',{x:0,z:0}),0);
});
test('all park arrival and station routes remain open with the physical course installed',()=>{const floor=floorFor('park'),blocks=placeObstacles('park');for(const role of ['vlad','alina'] as const){const ends=[...STATIONS.park.map(s=>approachFor(s,role)),meeting('park',role)];for(const start of [spawn('park',role),...ends])for(const end of ends)assert.ok(findRoute(start,end,blocks,floor),JSON.stringify({role,start,end}));}});
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

import {once} from 'node:events';
import WebSocket from 'ws';
import {startServer} from '../server';
import type {ServerPacket} from '../../src/shared/protocol';
test('two actual clients alternate course attempts; busy and cancelled attempts grant no rewards',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'agility-net-069-')),files=openServerFiles(dir),s=fixture();s.world.dogWalker=null;delete s.pets.verdell.parkPosition;s.autonomy={vlad:'off',alina:'off'};files.save(s);
 const server=await startServer({port:0,dataDir:dir,testNoCodes:true,taskTimeScale:.07,lifeClock:{now:()=>0,tickMs:600000},autonomyTiming:{idleMs:99999999,careCooldownMs:99999999,leisureCooldownMs:99999999}});const sockets:WebSocket[]=[];
 async function connect(role:'vlad'|'alina'){
  const ws=new WebSocket('ws://127.0.0.1:'+server.port+'/sync');sockets.push(ws);const inbox:ServerPacket[]=[];ws.on('message',m=>inbox.push(JSON.parse(m.toString())));
  const send=(o:object)=>ws.send(JSON.stringify(o));
  async function take<K extends ServerPacket['type']>(kind:K,predicate:(p:Extract<ServerPacket,{type:K}>)=>boolean=()=>true){
   const end=Date.now()+7000;while(Date.now()<end){const i=inbox.findIndex(p=>p.type===kind&&predicate(p as Extract<ServerPacket,{type:K}>));if(i>=0)return inbox.splice(i,1)[0] as Extract<ServerPacket,{type:K}>;await new Promise(r=>setTimeout(r,5));}throw Error('Missing '+kind);
  }
  await once(ws,'open');send({type:'auth',role,code:'TEST-LOCAL-NO-CODES'});await take('ready');return {send,take};
 }
 try{
 const v=await connect('vlad'),a=await connect('alina');v.send({type:'dog_leash'});await v.take('snapshot',p=>p.state.world.dogWalker==='vlad');
 v.send({type:'local_activity',station:'park-dog',action:'dogHurdle'});
 const start=await v.take('task_started',p=>p.role==='vlad');await a.take('task_started',p=>p.taskId===start.taskId);
 a.send({type:'local_activity',station:'park-dog',action:'dogBalance'});await a.take('error');
 v.send({type:'cancel_task',taskId:start.taskId});await a.take('task_ended',p=>p.taskId===start.taskId&&p.outcome==='cancelled');
 assert.equal(files.load().world.parkDog?.agility,undefined);assert.equal(files.load().pets.verdell.training,undefined);
 a.send({type:'local_activity',station:'park-dog',action:'dogTunnel'});
 const next=await a.take('task_started',p=>p.role==='alina');await new Promise(r=>setTimeout(r,640));a.send({type:'agility_cue',taskId:next.taskId});v.send({type:'agility_cue',taskId:next.taskId});const own=await a.take('agility_feedback',p=>p.role==='alina');assert.ok(own.quality!==undefined&&own.quality>=5);await v.take('agility_feedback',p=>p.role==='vlad');a.send({type:'agility_cue',taskId:next.taskId});await v.take('task_ended',p=>p.taskId===next.taskId&&p.outcome==='completed');
 assert.equal(files.load().world.parkDog?.agility?.attempts,1);assert.equal(files.load().world.parkDog?.agility?.last?.owner,'alina');assert.equal(files.load().world.parkDog?.agility?.last?.helper,'vlad');assert.equal(files.load().world.parkDog?.agility?.last?.cue,own.quality);assert.equal(agilityCueQuality(.38),10);assert.equal(agilityCueQuality(.9),0);assert.equal(files.load().money,s.money);
 }finally{sockets.forEach(ws=>ws.terminate());await server.close();rmSync(dir,{recursive:true,force:true});}
});
