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

import {FITNESS_PROGRAMS} from '../../src/shared/fitness';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {once} from 'node:events';
import WebSocket from 'ws';
import {startServer} from '../server';
import {openServerFiles} from '../storage';
import type {ServerPacket} from '../../src/shared/protocol';

test('all compact programs contain only valid beginner-friendly stations',()=>{
 for(const p of Object.values(FITNESS_PROGRAMS)){
  assert.ok(p.stations.length>=2&&p.stations.length<=3);
  for(const id of p.stations){
   const s=stationById('fitness',id);
   assert.ok(s?.action.kind==='fitness'&&fitnessExercise(s.action.facility)?.minLevel===0);
   assert.ok(planTask({type:'local_activity',station:id,action:'fitnessTrain'}));
  }
 }
});
async function gymClient(fn:(send:(o:object)=>void,take:<K extends ServerPacket['type']>(kind:K,where?:(e:Extract<ServerPacket,{type:K}>)=>boolean)=>Promise<Extract<ServerPacket,{type:K}>>)=>Promise<void>,paid=true){
 const dir=mkdtempSync(join(tmpdir(),'pulse-program-'));const files=openServerFiles(dir);
 const s=initialState();s.world.places.vlad='fitness';s.world.carDriver='vlad';s.world.fitness=initialFitness();
 if(paid)s.world.fitness.vlad.until=clockMinutes(s.clock)+1440;
 Object.assign(s.characters.vlad,doorwayArrival('fitness','district','vlad'),{energy:100,hunger:100,hygiene:100});
 files.save(s);
 const server=await startServer({port:0,dataDir:dir,taskTimeScale:.015,autonomyTiming:{idleMs:99999999,careCooldownMs:99999999,leisureCooldownMs:99999999}});
 const ws=new WebSocket('ws://127.0.0.1:'+server.port+'/sync');
 const inbox:ServerPacket[]=[];ws.on('message',m=>inbox.push(JSON.parse(m.toString())));
 const send=(o:object)=>ws.send(JSON.stringify(o));
 async function take<K extends ServerPacket['type']>(kind:K,where:(e:Extract<ServerPacket,{type:K}>)=>boolean=()=>true){
  const end=Date.now()+7000;
  while(Date.now()<end){const i=inbox.findIndex(e=>e.type===kind&&where(e as Extract<ServerPacket,{type:K}>));if(i>=0)return inbox.splice(i,1)[0] as Extract<ServerPacket,{type:K}>;await new Promise(r=>setTimeout(r,10));}
  throw Error('Missing '+kind+'; '+inbox.map(e=>e.type).join(','));
 }
 try{await once(ws,'open');send({type:'auth',role:'vlad',code:files.access.vlad});await take('ready');await fn(send,take);}
 finally{ws.terminate();await server.close();rmSync(dir,{recursive:true,force:true});}
}
test('one click runs every program station in order through the actual server',async()=>{
 await gymClient(async(send,take)=>{
  send({type:'fitness_program',program:'cardio'});
  for(const id of FITNESS_PROGRAMS.cardio.stations){
   const started=await take('task_started',p=>p.command.type==='local_activity'&&p.command.station===id);
   await take('task_ended',p=>p.taskId===started.taskId&&p.outcome==='completed');
  }
  const final=await take('snapshot',p=>fitnessProfile(p.state,'vlad').workouts===3);
  assert.equal(fitnessProfile(final.state,'vlad').history?.length,3);
  assert.equal(fitnessProfile(final.state,'vlad').history?.[0].facility,'elliptical');
  assert.deepEqual({x:final.state.characters.vlad.x,z:final.state.characters.vlad.z},approachFor(stationById('fitness','fitness-elliptical')!,'vlad'));
 });
});
test('cancelling a running program removes its remaining queued steps',async()=>{
 await gymClient(async(send,take)=>{
  send({type:'fitness_program',program:'cardio'});
  const first=await take('task_started');
  await take('task_queue',p=>p.tasks.length===2);
  send({type:'cancel_task',taskId:first.taskId});
  await take('task_queue',p=>p.tasks.length===0);
  await take('task_ended',p=>p.taskId===first.taskId&&p.outcome==='cancelled');
 });
});
test('program cannot start without paid access',async()=>{
 await gymClient(async(send,take)=>{send({type:'fitness_program',program:'cardio'});await take('error');},false);
});

import {FITNESS_BAR} from '../../src/shared/fitness';
test('locker rooms, showers and toilets validate membership and character; bar charges once on completion',()=>{
 let s=initialState();s.money=10000;s.world.places.vlad='fitness';
 s.world.fitness=initialFitness();s.world.fitness.vlad.until=clockMinutes(s.clock)+1440;
 const perform=(station:string,action:import('../../src/shared/locations').LocalActivity)=>{
  Object.assign(s.characters.vlad,approachFor(stationById('fitness',station)!,'vlad'));
  return localActivity(s,'vlad',action,station);
 };
 s.characters.vlad.hygiene=20;s.characters.vlad.bladder=12;
 assert.equal(perform('fitness-shower-a','fitnessShower').ok,false);
 let r=perform('fitness-shower-v','fitnessShower');assert.ok(r.ok);s=r.state;assert.equal(s.characters.vlad.hygiene,100);
 r=perform('fitness-toilet-v','fitnessToilet');assert.ok(r.ok);s=r.state;assert.equal(s.characters.vlad.bladder,100);
 s.characters.vlad.hunger=20;s.world.fitness!.vlad.fatigue=50;
 r=perform('fitness-bar','fitnessShake');assert.ok(r.ok);s=r.state;
 assert.equal(s.money,10000-FITNESS_BAR.fitnessShake.price);assert.equal(s.characters.vlad.hunger,45);assert.equal(fitnessProfile(s,'vlad').fatigue,42);
 assert.equal(perform('fitness-bar','fitnessShower').ok,false);
 s.money=0;assert.equal(perform('fitness-bar','fitnessShake').ok,false);
});
test('both live players consent to a club trip, exercise concurrently and return independently',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'pulse-pair-')),files=openServerFiles(dir);
 const s=initialState();s.money=100000;s.autonomy={vlad:'off',alina:'off'};
 for(const r of ['vlad','alina'] as const)Object.assign(s.characters[r],{energy:100,hunger:100});
 files.save(s);
 const server=await startServer({port:0,dataDir:dir,taskTimeScale:.025,autonomyTiming:{idleMs:99999999,careCooldownMs:99999999,leisureCooldownMs:99999999}});
 const sockets:WebSocket[]=[];
 async function connect(role:'vlad'|'alina'){
  const ws=new WebSocket('ws://127.0.0.1:'+server.port+'/sync');sockets.push(ws);
  const inbox:ServerPacket[]=[];ws.on('message',m=>inbox.push(JSON.parse(m.toString())));
  const send=(o:object)=>ws.send(JSON.stringify(o));
  async function take<K extends ServerPacket['type']>(kind:K,where:(e:Extract<ServerPacket,{type:K}>)=>boolean=()=>true){
   const end=Date.now()+8000;
   while(Date.now()<end){const i=inbox.findIndex(e=>e.type===kind&&where(e as Extract<ServerPacket,{type:K}>));if(i>=0)return inbox.splice(i,1)[0] as Extract<ServerPacket,{type:K}>;await new Promise(r=>setTimeout(r,10));}
   throw Error('Missing '+kind+'; '+inbox.map(e=>e.type).join(','));
  }
  await once(ws,'open');send({type:'auth',role,code:files.access[role]});await take('ready');return {send,take};
 }
 try{
  const v=await connect('vlad'),a=await connect('alina');
  v.send({type:'fitness_pass',pass:'family'});
  await a.take('snapshot',p=>fitnessAccess(p.state,'vlad')&&fitnessAccess(p.state,'alina'));
  v.send({type:'fitness_trip'});await a.take('world_event',p=>p.role==='alina');
  const before=files.load();assert.equal(before.world.places.alina,'home');assert.equal(before.world.places.vlad,'home');
  a.send({type:'fitness_trip'});
  const arrived=await v.take('snapshot',p=>p.state.world.places.vlad==='fitness'&&p.state.world.places.alina==='fitness');
  assert.equal(arrived.state.world.carDriver,'vlad');
  v.send({type:'local_activity',action:'fitnessTrain',station:'fitness-treadmill-a'});
  a.send({type:'local_activity',action:'fitnessTrain',station:'fitness-treadmill-b'});
  const x=await v.take('task_started',p=>p.role==='vlad'),y=await v.take('task_started',p=>p.role==='alina');
  await v.take('task_ended',p=>p.taskId===x.taskId&&p.outcome==='completed');
  await v.take('task_ended',p=>p.taskId===y.taskId&&p.outcome==='completed');
  await v.take('snapshot',p=>fitnessProfile(p.state,'vlad').workouts===1&&fitnessProfile(p.state,'alina').workouts===1);
  a.send({type:'approach',place:'fitness',station:'fitness-exit'});
  await a.take('world_path',p=>p.role==='alina'&&p.station==='fitness-exit');
  a.send({type:'travel',place:'district',via:'fitness-exit'});
  await v.take('snapshot',p=>p.state.world.places.alina==='home'&&p.state.world.places.vlad==='fitness');
  v.send({type:'approach',place:'fitness',station:'fitness-exit'});
  await v.take('world_path',p=>p.role==='vlad'&&p.station==='fitness-exit');
  v.send({type:'travel',place:'district',via:'fitness-exit'});
  const final=await a.take('snapshot',p=>p.state.world.places.vlad==='home'&&p.state.world.places.alina==='home');
  assert.equal(final.state.world.carDriver,undefined);
 }finally{sockets.forEach(ws=>ws.terminate());await server.close();rmSync(dir,{recursive:true,force:true});}
});
