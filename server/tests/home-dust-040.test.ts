import WebSocket from 'ws';
import {once} from 'node:events';
import {startServer} from '../server';
import type {ServerPacket,CharacterId} from '../../src/shared/protocol';
import test from 'node:test';
import assert from 'node:assert/strict';
import {initialState} from '../../src/shared/protocol';
import {DUST_ROOMS,initialDust,advanceDust,dustStage,dustLoss,DUST_MAX,validDust,roomAt} from '../../src/shared/homeDust';
import {dustRoute} from '../../src/shared/dustRoute';
import {advanceLife} from '../life';
import {evaluateTask,planTask} from '../tasks';
import {openServerFiles} from '../storage';
import {mkdtempSync,rmSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
test('all ten rooms accumulate exactly 25% per day, cap and remain independent',()=>{
 const d=initialDust();assert.equal(DUST_ROOMS.length,10);
 const one=advanceDust(d,1440);assert.ok(Object.values(one).every(v=>v===1440));
 one.kitchen=0;const next=advanceDust(one,1440);assert.equal(next.kitchen,1440);assert.equal(next.wingSouth,2880);
 assert.ok(Object.values(advanceDust(next,10000)).every(v=>v===DUST_MAX));
 assert.ok(!validDust({...d,kitchen:-1}));assert.ok(!validDust({kitchen:0}));
});
test('stages integrate across exact boundaries without a retroactive penalty',()=>{
 assert.equal(dustLoss(0,1440).mood,0);
 assert.deepEqual(dustLoss(1380,120),{mood:.6,comfort:.6});
 assert.deepEqual(dustLoss(2880,60),{mood:1.2,comfort:1.8});
 assert.deepEqual(dustLoss(4320,60),{mood:2.4,comfort:3});
 assert.equal(dustStage(DUST_MAX).comfort,3);
});
test('dust drains only the online resident inside a dirty room; not yard or another clean room',()=>{
 const s=initialState();s.homeDust={...initialDust(),bedroom:4320};
 Object.assign(s.characters.vlad,{x:-7,z:-4});Object.assign(s.characters.alina,{x:0,z:1});
 const next=advanceLife(s,60,['vlad','alina']);
 assert.equal(next.characters.vlad.mood,s.characters.vlad.mood-2.4);
 assert.equal(next.characters.alina.mood,s.characters.alina.mood);
 assert.equal(next.characters.vlad.comfort,s.characters.vlad.comfort-3.45);
 const yard=structuredClone(s);Object.assign(yard.characters.vlad,{x:0,z:7});
 assert.equal(advanceLife(yard,60,['vlad']).characters.vlad.mood,yard.characters.vlad.mood);
 assert.equal(advanceLife(s,60,[]).homeDust!.bedroom,4320);
});
test('each room has a navigable cleaning point and cleaning only resets that room',()=>{
 const s=initialState();s.homeDust=advanceDust(initialDust(),2880);
 for(const r of DUST_ROOMS){
  const route=dustRoute(s,'vlad',r.id);assert.ok(route,r.id);
  assert.equal(roomAt(route.path.at(-1)??route.from)?.id,r.id);
  const result=evaluateTask(s,'vlad',{type:'clean_room',room:r.id});assert.ok(result.ok,r.id);
  assert.equal(result.state.homeDust![r.id],0);
  for(const other of DUST_ROOMS.filter(x=>x.id!==r.id))assert.equal(result.state.homeDust![other.id],2880);
  assert.equal(evaluateTask(result.state,'vlad',{type:'clean_room',room:r.id}).ok,false);
 }
 assert.equal(planTask({type:'clean_room',room:'yard'}),null);
 s.world.places.vlad='park';assert.equal(evaluateTask(s,'vlad',{type:'clean_room',room:'kitchen'}).ok,false);
});
test('legacy save migrates clean and persisted dust survives restart',()=>{
 const dir=mkdtempSync(join(tmpdir(),'sim-dust-040-'));
 try{
  const s=initialState();delete s.homeDust;
  writeFileSync(join(dir,'household.json'),JSON.stringify(s));
  const files=openServerFiles(dir),loaded=files.load();assert.deepEqual(loaded.homeDust,initialDust());
  loaded.homeDust!.living=3137;files.save(loaded);
  assert.equal(openServerFiles(dir).load().homeDust!.living,3137);
 }finally{rmSync(dir,{recursive:true,force:true});}
});
function packet(ws:WebSocket,predicate:(p:ServerPacket)=>boolean):Promise<ServerPacket>{
 return new Promise((resolve,reject)=>{const timer=setTimeout(()=>{ws.off('message',on);reject(Error('packet timeout'));},6000);
 function on(raw:WebSocket.RawData){const p=JSON.parse(raw.toString()) as ServerPacket;if(predicate(p)){clearTimeout(timer);ws.off('message',on);resolve(p);}}ws.on('message',on);});
}
test('live two-player cleaning reserves a room, cancellation does not clean and completion syncs',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'dust-live-'));const files=openServerFiles(dir),s=initialState();
 s.homeDust=advanceDust(initialDust(),2880);s.autonomy={vlad:'off',alina:'off'};files.save(s);
 const server=await startServer({port:0,dataDir:dir,taskTimeScale:.06});const sockets:WebSocket[]=[];
 try{
  async function connect(role:CharacterId){const ws=new WebSocket('ws://127.0.0.1:'+server.port+'/sync');sockets.push(ws);await once(ws,'open');
   const ready=packet(ws,p=>p.type==='ready');ws.send(JSON.stringify({type:'auth',role,code:files.access[role]}));await ready;return ws;}
  const v=await connect('vlad'),a=await connect('alina');
  const cmd={type:'clean_room',room:'wingSouth'};
  let started=packet(v,p=>p.type==='task_started');v.send(JSON.stringify(cmd));const first=await started;assert.equal(first.type,'task_started');
  const rejected=packet(a,p=>p.type==='error');a.send(JSON.stringify(cmd));await rejected;
  const cancelled=packet(v,p=>p.type==='task_ended'&&p.outcome==='cancelled');v.send(JSON.stringify({type:'cancel_task',taskId:first.taskId}));await cancelled;
  assert.ok(files.load().homeDust!.wingSouth>=2880);
  started=packet(v,p=>p.type==='task_started');v.send(JSON.stringify(cmd));await started;
  const synced=packet(a,p=>p.type==='snapshot'&&p.state.homeDust?.wingSouth===0);await synced;
  assert.equal(files.load().homeDust!.wingSouth,0);assert.ok(files.load().homeDust!.bedroom>=2880);
 }finally{sockets.forEach(w=>w.terminate());await server.close();rmSync(dir,{recursive:true,force:true});}
});