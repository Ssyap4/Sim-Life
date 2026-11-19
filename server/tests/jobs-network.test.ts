import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { once } from 'node:events';
import WebSocket, {type RawData} from 'ws';
import {startServer} from '../server';
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
    assert.ok(snap.state.activeShifts.vlad!.hours>=14&&snap.state.activeShifts.vlad!.hours<=16);
    assert.equal(snap.state.money,2500);
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
  assert.equal(saved.money,2500);
  assert.equal(saved.ledger.length,0);
 } finally {
  sockets.forEach(s=>s.terminate());
  await server.close();
  rmSync(dir,{recursive:true,force:true});
 }
});
