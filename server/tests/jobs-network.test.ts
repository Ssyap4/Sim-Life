import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { once } from 'node:events';
import WebSocket, {type RawData} from 'ws';
import {startServer} from '../server';
import {openServerFiles} from '../storage';
import {beginShift} from '../jobs';
import {initialState} from '../../src/shared/protocol';
import {clockAt} from '../../src/shared/life';
import {homeQuestContent,correctQuestChoice} from '../../src/shared/homeJobQuests';
import type {CharacterId,ServerPacket} from '../../src/shared/protocol';

function next(ws:WebSocket,predicate:(msg:ServerPacket)=>boolean):Promise<ServerPacket> {
  return new Promise((resolve,reject)=>{
    const timer=setTimeout(()=>{ws.off('message',listener);reject(new Error('Job message timeout'));},3500);
    function listener(raw:RawData){
      const msg=JSON.parse(raw.toString()) as ServerPacket;
      if(!predicate(msg))return;
      clearTimeout(timer);ws.off('message',listener);resolve(msg);
    }
    ws.on('message',listener);
  });
}
async function enter(port:number,role:CharacterId,key:string):Promise<WebSocket>{
  const socket=new WebSocket('ws://127.0.0.1:'+port+'/sync');
  await once(socket,'open');
  const answer=next(socket,msg=>msg.type==='ready'||msg.type==='error');
  socket.send(JSON.stringify({type:'auth',role,code:key}));
  assert.equal((await answer).type,'ready');
  return socket;
}
test('Two players see long-term job status; reconnect keeps the shift; cancel pays nothing',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'sim-life-shift-network-'));
 const server=await startServer({port:0,host:'127.0.0.1',dataDir:dir});
 const sockets:WebSocket[]=[];
 try {
  const keys=JSON.parse(readFileSync(join(dir,'access.json'),'utf8')) as Record<CharacterId,string>;
  const v=await enter(server.port,'vlad',keys.vlad);
  const a=await enter(server.port,'alina',keys.alina);
  sockets.push(v,a);
  const started=next(a,m=>m.type==='job_event'&&m.outcome==='started');
  const sync=next(a,m=>m.type==='snapshot'&&Boolean(m.state.activeShifts.vlad));
  v.send(JSON.stringify({type:'job_start',job:'ozon',hours:1,pay:999999}));
  await started;
  const snap=await sync;
  assert.equal(snap.type,'snapshot');
  if(snap.type==='snapshot'){
    assert.ok(snap.state.activeShifts.vlad!.hours>=11&&snap.state.activeShifts.vlad!.hours<=13);
    assert.equal(snap.state.money,10000);
  }
  const refused=next(v,m=>m.type==='error');
  v.send(JSON.stringify({type:'checkout',lines:[{id:'grocery:milk',quantity:1}]}));
  assert.equal((await refused).type,'error');
  const offline=next(a,m=>m.type==='online'&&!m.online.includes('vlad'));
  v.terminate();
  await offline;
  const resumed=await enter(server.port,'vlad',keys.vlad);
  sockets.push(resumed);
  const assigned=next(a,m=>m.type==='job_event'&&m.outcome==='left_early');
  resumed.send(JSON.stringify({type:'job_leave_early'}));
  await assigned;
  const saved=JSON.parse(readFileSync(join(dir,'household.json'),'utf8'));
  assert.equal(saved.activeShifts.vlad,undefined);
  assert.equal(saved.money,10000);
  assert.equal(saved.ledger.length,0);
 } finally {
  sockets.forEach(s=>s.terminate());
  await server.close();
  rmSync(dir,{recursive:true,force:true});
 }
});

test('Home quest websocket answers are synchronized, owner-only, durable and replay-safe',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'sim-life-home-quest-network-'));
 const files=openServerFiles(dir);
 const result=beginShift(initialState(),'vlad','gameFix','desktop');assert.ok(result.ok);
 const state=result.state,shift=state.activeShifts.vlad!,run=shift.quests![0];
 const choice=correctQuestChoice(homeQuestContent(shift,run)!,run);
 shift.targetPay=2200;state.clock=clockAt(run.at);files.save(state);
 const server=await startServer({port:0,host:'127.0.0.1',dataDir:dir});
 const sockets:WebSocket[]=[];
 try{
  const v=await enter(server.port,'vlad',files.access.vlad);sockets.push(v);
  const a=await enter(server.port,'alina',files.access.alina);sockets.push(a);
  const rejected=next(a,m=>m.type==='error');
  a.send(JSON.stringify({type:'home_job_answer',nonce:run.nonce,choice}));await rejected;
  const sync=next(a,m=>m.type==='snapshot'&&m.state.activeShifts.vlad?.quests?.[0]?.result==='correct');
  v.send(JSON.stringify({type:'home_job_answer',nonce:run.nonce,choice}));await sync;
  const saved=files.load();
  assert.equal(saved.activeShifts.vlad?.targetPay,2350);
  assert.equal(saved.activeShifts.vlad?.quests?.[0].result,'correct');
  assert.equal(saved.money,10000);
  const duplicate=next(v,m=>m.type==='error');
  v.send(JSON.stringify({type:'home_job_answer',nonce:run.nonce,choice}));await duplicate;
  assert.equal(files.load().activeShifts.vlad?.targetPay,2350);
 }finally{
  sockets.forEach(s=>s.terminate());await server.close();rmSync(dir,{recursive:true,force:true});
 }
});
