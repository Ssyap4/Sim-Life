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
test('furniture commands never wake a sleeper; partner can buy without disrupting sleep; both see one atomic budget',async()=>{
  const dir=mkdtempSync(join(tmpdir(),'sim-life-furniture-network-'));
  const files=openServerFiles(dir);
  const initial=files.load();
  initial.money=6000;
  initial.characters.vlad.energy=10;
  files.save(initial);
  const server=await startServer({port:0,dataDir:dir,taskTimeScale:.05});
  const sockets:WebSocket[]=[];
  try{
    const v=await enter(server.port,'vlad',files.access.vlad);
    const a=await enter(server.port,'alina',files.access.alina);
    sockets.push(v,a);
    const started=next(a,p=>p.type==='time_status'&&p.status.sleepers.vlad==='full');
    v.send(JSON.stringify({type:'sleep_start',mode:'full'}));
    await started;
    const deny=next(v,p=>p.type==='error');
    v.send(JSON.stringify({
      type:'furniture_order',sku:'plant-mini',finish:'sage',shipping:'express',quantity:1,
    }));
    const denied=await deny;
    assert.equal(denied.type,'error');
    assert.match(denied.reason,/сон|заняти/);
    assert.equal(files.load().characters.vlad.pose,'sleep');
    assert.equal(files.load().money,6000);

    const forVlad=next(v,p=>p.type==='snapshot'&&p.state.furnishing.orders.length===1);
    const forAlina=next(a,p=>p.type==='snapshot'&&p.state.furnishing.orders.length===1);
    a.send(JSON.stringify({
      type:'furniture_order',sku:'plant-mini',finish:'sage',shipping:'express',quantity:1,
    }));
    const [left,right]=await Promise.all([forVlad,forAlina]);
    assert.deepEqual(left,right);
    assert.equal(left.type,'snapshot');
    assert.equal(left.state.money,3810);
    assert.equal(left.state.characters.vlad.pose,'sleep');
    const spatial=next(a,p=>p.type==='error');
    a.send(JSON.stringify({type:'furniture_place',id:1,x:13.5,z:-5.5,rotation:0}));
    const spatialDenial=await spatial;
    assert.equal(spatialDenial.type,'error');
    assert.match(spatialDenial.reason,/прогулк|действи|сон/);
    assert.equal(files.load().furnishing.placed.length,0);
    assert.equal(files.load().characters.vlad.pose,'sleep');
    const waking=next(a,p=>p.type==='time_status'&&!p.status.sleepers.vlad);
    v.send(JSON.stringify({type:'sleep_stop'}));
    await waking;
    assert.notEqual(files.load().characters.vlad.pose,'sleep');
    const orderedAgain=next(a,p=>p.type==='snapshot'&&p.state.furnishing.orders.length===2);
    v.send(JSON.stringify({
      type:'furniture_order',sku:'plant-mini',finish:'ivory',shipping:'express',quantity:1,
    }));
    const second=await orderedAgain;
    assert.equal(second.type,'snapshot');
    assert.equal(second.state.money,1620);
    const overspend=next(v,p=>p.type==='error');
    v.send(JSON.stringify({
      type:'furniture_order',sku:'plant-mini',finish:'sage',shipping:'express',quantity:1,
    }));
    assert.match((await overspend as Extract<ServerPacket,{type:'error'}>).reason,/Недостаточно/);
    assert.equal(files.load().money,1620);
    assert.equal(files.load().furnishing.orders.length,2);
  }finally{
    for(const ws of sockets)ws.terminate();
    await server.close();
    rmSync(dir,{recursive:true,force:true});
  }
});
