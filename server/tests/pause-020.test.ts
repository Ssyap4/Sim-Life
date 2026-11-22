import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { once } from 'node:events';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import WebSocket from 'ws';
import { PausableTimers } from '../pausableTimers';
import { startServer } from '../server';
import { openServerFiles } from '../storage';
import type { ServerPacket } from '../../src/shared/protocol';

const delay = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));

test('Game timers and virtual time stop and resume without completing during pause', async () => {
  const timers = new PausableTimers();
  let fired = 0;
  const start = timers.now();
  timers.schedule(() => fired++, 70);
  await delay(19);
  timers.pause();
  const still = timers.now();
  await delay(105);
  assert.equal(fired, 0);
  assert.equal(timers.now(), still);
  assert.ok(still >= start);
  timers.resume();
  await delay(85);
  assert.equal(fired, 1);
  timers.dispose();
});

type Client = {send(packet:object):void;next(type:ServerPacket['type'], check?:(packet:any)=>boolean):Promise<any>; close():Promise<void>};
async function client(port:number):Promise<Client>{
  const socket = new WebSocket('ws://127.0.0.1:'+port+'/sync');
  const received:ServerPacket[]=[];
  socket.on('message',raw=>received.push(JSON.parse(raw.toString())));
  await once(socket,'open');
  return {
    send(packet){socket.send(JSON.stringify(packet));},
    async next(type,check=()=>true){
      for(let i=0;i<220;i++){
        const idx=received.findIndex(p=>p.type===type&&check(p));
        if(idx>=0)return received.splice(idx,1)[0];
        await delay(10);
      }
      throw new Error('Expected '+type+', received '+received.map(p=>p.type));
    },
    async close(){
      if(socket.readyState===WebSocket.CLOSED)return;
      const done=once(socket,'close');socket.close();await done;
    },
  };
}

test('Pause alone is instant; with two players it requires consent and blocks gameplay', async()=>{
  const dir=mkdtempSync(join(tmpdir(),'sim-life-pause-020-'));
  const files=openServerFiles(dir);
  const server=await startServer({port:0,dataDir:dir});
  const sockets:Client[]=[];
  try{
    const a=await client(server.port); sockets.push(a);
    a.send({type:'auth',role:'vlad',code:files.access.vlad});
    await a.next('ready');
    a.send({type:'pause_toggle'});
    await a.next('time_status',p=>p.status.paused===true);
    a.send({type:'act',actionId:'sofaRest'});
    await a.next('error',p=>p.reason.includes('паузе'));
    a.send({type:'pause_toggle'});
    await a.next('time_status',p=>p.status.paused===false);

    const b=await client(server.port);sockets.push(b);
    b.send({type:'auth',role:'alina',code:files.access.alina});
    await b.next('ready');

    a.send({type:'pause_toggle'});
    await a.next('time_status',p=>p.status.paused===false&&p.status.pauseRequestedBy==='vlad');
    await b.next('time_status',p=>p.status.paused===false&&p.status.pauseRequestedBy==='vlad');
    b.send({type:'pause_reply',accept:false});
    await a.next('time_status',p=>!p.status.paused&&!p.status.pauseRequestedBy);
    await b.next('time_status',p=>!p.status.paused&&!p.status.pauseRequestedBy);

    a.send({type:'pause_toggle'});
    await b.next('time_status',p=>p.status.pauseRequestedBy==='vlad');
    b.send({type:'pause_reply',accept:true});
    await a.next('time_status',p=>p.status.paused===true);
    await b.next('clock_sync',p=>p.sample.multiplier===0);
    b.send({type:'buy',item:'milk'});
    await b.next('error',p=>p.reason.includes('паузе'));
    assert.equal(files.load().money,10000,'pause must reject purchases without spending money');

    a.send({type:'pause_toggle'});
    await b.next('time_status',p=>p.status.paused===false);
  }finally {
    for(const s of sockets)await s.close();
    await server.close();
    rmSync(dir,{recursive:true,force:true});
  }
});