import assert from 'node:assert/strict';
import {test} from 'node:test';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {once} from 'node:events';
import WebSocket,{type RawData} from 'ws';
import {startServer} from '../server';
import {openServerFiles} from '../storage';
import type {CharacterId,ServerPacket} from '../../src/shared/protocol';

function next(ws:WebSocket,predicate:(message:ServerPacket)=>boolean):Promise<ServerPacket>{
  return new Promise((resolve,reject)=>{
    const timer=setTimeout(()=>{ws.off('message',listener);reject(new Error('Furniture network timeout'));},6000);
    function listener(raw:RawData){
      const packet=JSON.parse(raw.toString()) as ServerPacket;
      if(!predicate(packet))return;
      clearTimeout(timer);ws.off('message',listener);resolve(packet);
    }
    ws.on('message',listener);
  });
}
async function enter(port:number,role:CharacterId,code:string):Promise<WebSocket>{
  const ws=new WebSocket('ws://127.0.0.1:'+port+'/sync');
  await once(ws,'open');
  const ready=next(ws,packet=>packet.type==='ready'||packet.type==='error');
  ws.send(JSON.stringify({type:'auth',role,code}));
  assert.equal((await ready).type,'ready');
  return ws;
}
test('both players can edit furniture during sleep and active tasks; only affected actions stop',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'sim-life-furniture-network-'));
 const files=openServerFiles(dir),initial=files.load();
 initial.money=10000;
 initial.characters.vlad.energy=10;
 initial.furnishing.stored=[1,2,3].map(id=>({id,sku:'stool-basic',finish:'sage'}));
 initial.furnishing.nextId=4;
 files.save(initial);
 const server=await startServer({port:0,dataDir:dir,taskTimeScale:.1});
 const sockets:WebSocket[]=[];
 try{
  const v=await enter(server.port,'vlad',files.access.vlad),a=await enter(server.port,'alina',files.access.alina);sockets.push(v,a);
  const started=next(a,p=>p.type==='time_status'&&p.status.sleepers.vlad==='full');
  v.send(JSON.stringify({type:'sleep_start',mode:'full'}));await started;
  const own=next(v,p=>p.type==='snapshot'&&p.state.furnishing.placed.some(i=>i.id===1));
  v.send(JSON.stringify({type:'furniture_place',id:1,x:13.5,z:-5.5,rotation:0}));
  assert.equal((await own).type,'snapshot');
  assert.equal(files.load().characters.vlad.pose,'sleep');
  const other=next(a,p=>p.type==='snapshot'&&p.state.furnishing.placed.some(i=>i.id===2));
  a.send(JSON.stringify({type:'furniture_place',id:2,x:13.5,z:-4.8,rotation:0}));
  await other;
  assert.equal(files.load().characters.vlad.pose,'sleep');
  const sale=next(a,p=>p.type==='snapshot'&&p.state.furnishing.orders.length===1);
  v.send(JSON.stringify({type:'furniture_order',sku:'stool-basic',finish:'sage',shipping:'express',quantity:1}));
  await sale;assert.equal(files.load().money,6910);
  const denied=next(a,p=>p.type==='error');
  a.send(JSON.stringify({type:'furniture_order',sku:'plant-mini',finish:'sage',shipping:'express',quantity:1}));
  await denied;assert.equal(files.load().money,6910);
  const waking=next(a,p=>p.type==='time_status'&&!p.status.sleepers.vlad);
  v.send(JSON.stringify({type:'sleep_stop'}));await waking;
  const taskStart=next(a,p=>p.type==='task_started'&&p.role==='alina');
  a.send(JSON.stringify({type:'act',actionId:'sofaRest'}));
  const task=await taskStart;assert.equal(task.type,'task_started');
  const finished=next(a,p=>p.type==='task_ended'&&p.role==='alina'&&p.taskId===task.taskId);
  const third=next(a,p=>p.type==='snapshot'&&p.state.furnishing.placed.some(i=>i.id===3));
  a.send(JSON.stringify({type:'furniture_place',id:3,x:14.4,z:-5.5,rotation:0}));await third;
  const ended=await finished;assert.equal(ended.type,'task_ended');assert.equal(ended.outcome,'completed');
  assert.equal(files.load().furnishing.placed.length,3);
 }finally{for(const ws of sockets)ws.terminate();await server.close();rmSync(dir,{recursive:true,force:true});}
});
