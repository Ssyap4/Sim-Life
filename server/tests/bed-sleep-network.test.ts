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

function next(ws:WebSocket,match:(value:ServerPacket)=>boolean):Promise<ServerPacket>{
  return new Promise((resolve,reject)=>{
    const timeout=setTimeout(()=>{ws.off('message',onMessage);reject(new Error('Sleep packet timeout'));},6500);
    function onMessage(raw:RawData){
      const packet=JSON.parse(raw.toString()) as ServerPacket;
      if(!match(packet))return;
      clearTimeout(timeout);ws.off('message',onMessage);resolve(packet);
    }
    ws.on('message',onMessage);
  });
}
async function connect(port:number,role:CharacterId,code:string){
  const ws=new WebSocket('ws://127.0.0.1:'+port+'/sync');
  await once(ws,'open');
  const ready=next(ws,p=>p.type==='ready'||p.type==='error');
  ws.send(JSON.stringify({type:'auth',role,code}));
  assert.equal((await ready).type,'ready');
  return ws;
}
test('two residents share one bought double bed, receive synchronized poses, and cannot sell it while occupied',async()=>{
  const dir=mkdtempSync(join(tmpdir(),'sim-life-replacement-sleep-'));
  const files=openServerFiles(dir);
  const base=files.load();
  base.furnishing.soldFixtures=['bed'];
  base.furnishing.placed=[{id:1,sku:'bed-aurora',finish:'sage',x:-6.97,z:-5.88,rotation:0}];
  base.furnishing.nextId=2;
  base.money=65000;
  base.characters.vlad.energy=15;
  base.characters.alina.energy=12;
  files.save(base);
  const server=await startServer({port:0,dataDir:dir,taskTimeScale:.05});
  const sockets:WebSocket[]=[];
  try{
    const v=await connect(server.port,'vlad',files.access.vlad);
    const a=await connect(server.port,'alina',files.access.alina);
    sockets.push(v,a);
    const bad=next(v,p=>p.type==='error');
    v.send(JSON.stringify({type:'sleep_start',mode:'full',furnitureId:999}));
    assert.match((await bad as Extract<ServerPacket,{type:'error'}>).reason,/кровать/i);
    const changedV=next(v,p=>p.type==='snapshot'&&p.state.characters.vlad.pose==='sleep');
    const changedA=next(a,p=>p.type==='snapshot'&&p.state.characters.vlad.pose==='sleep');
    v.send(JSON.stringify({type:'sleep_start',mode:'full',furnitureId:1}));
    const [firstV,firstA]=await Promise.all([changedV,changedA]);
    assert.deepEqual(firstV,firstA);
    assert.equal(firstA.type,'snapshot');
    assert.equal(firstA.state.characters.vlad.sleepingOn,1);
    const secondV=next(v,p=>p.type==='snapshot'&&p.state.characters.alina.pose==='sleep');
    const secondA=next(a,p=>p.type==='snapshot'&&p.state.characters.alina.pose==='sleep');
    a.send(JSON.stringify({type:'sleep_start',mode:'half',furnitureId:1}));
    const [bothV,bothA]=await Promise.all([secondV,secondA]);
    assert.deepEqual(bothV,bothA);
    assert.equal(bothV.type,'snapshot');
    assert.equal(bothV.state.characters.alina.sleepingOn,1);
    assert.equal(bothV.state.characters.vlad.sleepingOn,1);
    assert.equal(files.load().furnishing.placed.length,1);
    assert.equal(files.load().money,65000);
    const denied=next(a,p=>p.type==='error');
    a.send(JSON.stringify({type:'furniture_store',id:1}));
    assert.match((await denied as Extract<ServerPacket,{type:'error'}>).reason,/сон|спя|кроват/i);
    const wakingA=next(v,p=>p.type==='time_status'&&!p.status.sleepers.alina);
    a.send(JSON.stringify({type:'sleep_stop'}));
    await wakingA;
    const wakingV=next(a,p=>p.type==='time_status'&&!p.status.sleepers.vlad);
    v.send(JSON.stringify({type:'sleep_stop'}));
    await wakingV;
    const restored=files.load();
    assert.equal(restored.characters.vlad.sleepingOn,undefined);
    assert.equal(restored.characters.alina.sleepingOn,undefined);
    assert.equal(restored.characters.vlad.pose,'idle');
    assert.equal(restored.furnishing.placed[0].id,1);
    assert.deepEqual(restored.furnishing.soldFixtures,['bed']);
    assert.equal(openServerFiles(dir).load().furnishing.placed[0].id,1);
  }finally{
    for(const socket of sockets)socket.terminate();
    await server.close();
    rmSync(dir,{recursive:true,force:true});
  }
});
test('single replacement bed refuses a second sleeper, while leaving first person asleep',async()=>{
  const dir=mkdtempSync(join(tmpdir(),'sim-life-single-sleep-'));
  const files=openServerFiles(dir);
  const state=files.load();
  state.furnishing.soldFixtures=['bed'];
  state.furnishing.placed=[{id:1,sku:'bed-solo',finish:'ivory',x:-7,z:-5.9,rotation:0}];
  state.furnishing.nextId=2;
  state.characters.vlad.energy=4;state.characters.alina.energy=4;
  files.save(state);
  const server=await startServer({port:0,dataDir:dir,taskTimeScale:.05});
  const sockets:WebSocket[]=[];
  try{
    const v=await connect(server.port,'vlad',files.access.vlad);
    const a=await connect(server.port,'alina',files.access.alina);
    sockets.push(v,a);
    const first=next(v,p=>p.type==='snapshot'&&p.state.characters.vlad.pose==='sleep');
    v.send(JSON.stringify({type:'sleep_start',mode:'full',furnitureId:1}));
    assert.equal((await first).type,'snapshot');
    const refusal=next(a,p=>p.type==='error');
    a.send(JSON.stringify({type:'sleep_start',mode:'half',furnitureId:1}));
    assert.match((await refusal as Extract<ServerPacket,{type:'error'}>).reason,/занята/);
    assert.equal(files.load().characters.vlad.pose,'sleep');
    assert.notEqual(files.load().characters.alina.pose,'sleep');
  }finally{
    for(const socket of sockets)socket.terminate();
    await server.close();
    rmSync(dir,{recursive:true,force:true});
  }
});

test('server restart resumes a bought-bed sleep with its original half-energy goal',async()=>{
  const dir=mkdtempSync(join(tmpdir(),'sim-life-restart-sleep-'));
  const files=openServerFiles(dir);
  const state=files.load();
  state.furnishing.soldFixtures=['bed'];
  state.furnishing.placed=[{id:1,sku:'bed-platform',finish:'walnut',x:-6.97,z:-5.88,rotation:0}];
  state.furnishing.nextId=2;
  state.characters.vlad.pose='sleep';
  state.characters.vlad.sleepingOn=1;
  state.characters.vlad.sleepMode='half';
  state.characters.vlad.energy=19;
  state.characters.vlad.x=-6.97;
  state.characters.vlad.z=-3.96;
  files.save(state);
  const server=await startServer({port:0,dataDir:dir,taskTimeScale:.05});
  let socket:WebSocket|null=null;
  try{
    socket=new WebSocket('ws://127.0.0.1:'+server.port+'/sync');
    await once(socket,'open');
    const resumed=next(socket,p=>p.type==='time_status');
    const ready=next(socket,p=>p.type==='ready');
    socket.send(JSON.stringify({type:'auth',role:'vlad',code:files.access.vlad}));
    assert.equal((await ready).type,'ready');
    const status=await resumed;
    assert.equal(status.type,'time_status');
    assert.equal(status.status.sleepers.vlad,'half');
    const current=files.load();
    assert.equal(current.furnishing.placed[0].id,1);
    assert.equal(current.characters.vlad.sleepingOn,1);
    assert.equal(current.characters.vlad.sleepMode,'half');
    const wake=next(socket,p=>p.type==='time_status'&&!p.status.sleepers.vlad);
    socket.send(JSON.stringify({type:'sleep_stop'}));
    await wake;
    assert.equal(files.load().characters.vlad.sleepingOn,undefined);
    assert.equal(files.load().characters.vlad.sleepMode,undefined);
  }finally{
    socket?.terminate();
    await server.close();
    rmSync(dir,{recursive:true,force:true});
  }
});
