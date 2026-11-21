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
import {RECIPES} from '../../src/shared/food';

function next(ws:WebSocket,match:(p:ServerPacket)=>boolean,timeoutMs=7500):Promise<ServerPacket>{
  return new Promise((resolve,reject)=>{
    const timer=setTimeout(()=>{ws.off('message',handle);reject(new Error('Furniture use network timeout'));},timeoutMs);
    function handle(raw:RawData){
      const p=JSON.parse(raw.toString()) as ServerPacket;
      if(!match(p))return;
      clearTimeout(timer);ws.off('message',handle);resolve(p);
    }
    ws.on('message',handle);
  });
}
async function joinServer(port:number,role:CharacterId,code:string){
 const ws=new WebSocket('ws://127.0.0.1:'+port+'/sync');
 await once(ws,'open');
 const ready=next(ws,p=>p.type==='ready'||p.type==='error');
 ws.send(JSON.stringify({type:'auth',role,code}));
 assert.equal((await ready).type,'ready');
 return ws;
}
test('two-player sofa use has a real route/reward and partner cannot sell sofa mid-action',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'sim-life-sofa-use-'));
 const files=openServerFiles(dir);
 const s=files.load();
 s.furnishing.soldFixtures=['sofa'];
 s.furnishing.placed=[{id:1,sku:'sofa-luna',finish:'sage',x:-2.36,z:2.02,rotation:0}];
 s.furnishing.nextId=2;
 s.characters.vlad.energy=35;
 files.save(s);
 const server=await startServer({port:0,dataDir:dir,taskTimeScale:.04});
 const sockets:WebSocket[]=[];
 try{
  const v=await joinServer(server.port,'vlad',files.access.vlad);
  const a=await joinServer(server.port,'alina',files.access.alina);
  sockets.push(v,a);
  const start=next(v,p=>p.type==='task_started'&&p.command.type==='furniture_use');
  v.send(JSON.stringify({type:'furniture_use',furnitureId:1,action:'sofaRest'}));
  const packet=await start;
  assert.equal(packet.type,'task_started');
  assert.equal(packet.home?.station,'furniture');
  assert.equal(packet.home?.furnitureId,1);
  assert.equal(packet.home?.furnitureSeat,true);
  const denied=next(a,p=>p.type==='error');
  a.send(JSON.stringify({type:'furniture_sell',id:1}));
  assert.match((await denied as Extract<ServerPacket,{type:'error'}>).reason,/действия|дождись|мебел/i);
  const finished=next(v,p=>p.type==='task_ended'&&p.outcome==='completed');
  assert.equal((await finished).type,'task_ended');
  const saved=files.load();
  assert.ok(saved.characters.vlad.energy>35);
  assert.equal(saved.furnishing.placed.length,1);
  const invalid=next(v,p=>p.type==='error');
  v.send(JSON.stringify({type:'furniture_use',furnitureId:500,action:'sofaRest'}));
  assert.match((await invalid as Extract<ServerPacket,{type:'error'}>).reason,/мебель|предмет/i);
  const sold=next(a,p=>p.type==='snapshot'&&p.state.furnishing.placed.length===0);
  a.send(JSON.stringify({type:'furniture_sell',id:1}));
  assert.equal((await sold).type,'snapshot');
 }finally{
  for(const ws of sockets)ws.terminate();
  await server.close();
  rmSync(dir,{recursive:true,force:true});
 }
});
test('two players see bought-table eating rather than invisible old dining table',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'sim-life-table-use-'));
 const files=openServerFiles(dir);
 const s=files.load();
 s.furnishing.soldFixtures=['table'];
 s.furnishing.placed=[{id:1,sku:'table-family',finish:'sage',x:2.39,z:-2.22,rotation:0}];
 s.furnishing.nextId=2;
 const meal=Object.keys(RECIPES)[0] as keyof typeof RECIPES;
 s.meals[meal]=2;s.characters.vlad.hunger=30;
 files.save(s);
 const server=await startServer({port:0,dataDir:dir,taskTimeScale:.03});
 const sockets:WebSocket[]=[];
 try{
  const v=await joinServer(server.port,'vlad',files.access.vlad);
  const a=await joinServer(server.port,'alina',files.access.alina);
  sockets.push(v,a);
  const started=next(a,p=>p.type==='task_started'&&p.command.type==='eat');
  v.send(JSON.stringify({type:'eat',recipe:meal,furnitureId:1}));
  const task=await started;
  assert.equal(task.type,'task_started');
  assert.equal(task.command.type,'eat');
  assert.equal(task.command.type==='eat'?task.command.furnitureId:undefined,1);
  const complete=next(a,p=>p.type==='task_ended'&&p.outcome==='completed');
  assert.equal((await complete).type,'task_ended');
  const state=files.load();
  assert.equal(state.meals[meal],1);
  assert.ok(state.characters.vlad.hunger>30);
  assert.equal(state.characters.vlad.pose,'idle',
    'without an installed chair, eating at bought table remains standing');
  assert.ok(Math.hypot(state.characters.vlad.x-2.39,state.characters.vlad.z+2.22)>.5,
    'must record real approach instead of placing the diner inside the table');
  const invalid=next(v,p=>p.type==='error');
  v.send(JSON.stringify({type:'eat',recipe:meal,furnitureId:1000}));
  assert.match((await invalid as Extract<ServerPacket,{type:'error'}>).reason,/стол/i);
 }finally{
  for(const ws of sockets)ws.terminate();
  await server.close();
  rmSync(dir,{recursive:true,force:true});
 }
});
