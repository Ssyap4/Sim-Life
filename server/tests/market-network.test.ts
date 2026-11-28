import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { once } from 'node:events';
import WebSocket, { type RawData } from 'ws';
import { startServer } from '../server';
import { openServerFiles } from '../storage';
import type { CharacterId, ServerPacket } from '../../src/shared/protocol';

function next(ws: WebSocket, predicate: (p:ServerPacket)=>boolean):Promise<ServerPacket> {
  return new Promise((resolve,reject)=>{
    const timer=setTimeout(()=>{ws.off('message',listener);reject(new Error('Store event timeout'));},3500);
    function listener(raw:RawData) {
      const p=JSON.parse(raw.toString()) as ServerPacket;
      if(!predicate(p))return;
      clearTimeout(timer);ws.off('message',listener);resolve(p);
    }
    ws.on('message',listener);
  });
}
async function connect(port:number,role:CharacterId,code:string):Promise<WebSocket> {
  const ws=new WebSocket('ws://127.0.0.1:'+port+'/sync');
  await once(ws,'open');
  const ready=next(ws,p=>p.type==='ready'||p.type==='error');
  ws.send(JSON.stringify({type:'auth',role,code}));
  assert.equal((await ready).type,'ready');
  return ws;
}
test('Two clients receive a shared shop checkout; failed second purchase cannot overspend or create stock',async()=>{
  const dir=mkdtempSync(join(tmpdir(),'sim-life-cart-'));
  const files=openServerFiles(dir);
  const sample=files.load();
  sample.money=2500; // Exercise double-spend prevention under a small budget.
  files.save(sample);
  const server=await startServer({port:0,dataDir:dir,taskTimeScale:0.03});
  const sockets:WebSocket[]=[];
  try {
    const keys=JSON.parse(readFileSync(join(dir,'access.json'),'utf8')) as Record<CharacterId,string>;
    const v=await connect(server.port,'vlad',keys.vlad);
    const a=await connect(server.port,'alina',keys.alina);
    sockets.push(v,a);
    const vSnapshot=next(v,p=>p.type==='snapshot'&&p.state.revision===1);
    const aSnapshot=next(a,p=>p.type==='snapshot'&&p.state.revision===1);
    const aEvent=next(a,p=>p.type==='store_event');
    v.send(JSON.stringify({type:'checkout',lines:[{id:'takeout:rollsSet',quantity:1}]}));
    const [vs,as,ev]=await Promise.all([vSnapshot,aSnapshot,aEvent]);
    assert.equal(ev.type,'store_event');
    assert.deepEqual(vs,as);
    assert.equal(vs.type,'snapshot');
    if(vs.type==='snapshot') {
      assert.equal(vs.state.money,300);
      assert.equal(vs.state.takeout.rollsSet,3);
      assert.equal(vs.state.ledger.length,1);
    }
    const denied=next(a,p=>p.type==='error');
    a.send(JSON.stringify({type:'checkout',lines:[{id:'takeout:rollsSet',quantity:1}]}));
    assert.equal((await denied).type,'error');
    const invalid=next(v,p=>p.type==='error');
    v.send(JSON.stringify({type:'checkout',lines:[{id:'grocery:__proto__',quantity:1}]}));
    assert.equal((await invalid).type,'error');
    assert.equal(JSON.parse(readFileSync(join(dir,'household.json'),'utf8')).revision,1);
    sockets.forEach(s=>s.terminate());
    await server.close();
    const restart=await startServer({port:0,dataDir:dir});
    try {
      const again=await connect(restart.port,'vlad',keys.vlad);
      // A read-only login confirms the charged balance and order survive process restart.
      again.terminate();
      assert.equal(JSON.parse(readFileSync(join(dir,'household.json'),'utf8')).takeout.rollsSet,3);
    } finally {await restart.close();}
  } finally {
    sockets.forEach(s=>s.terminate());
    if(server.httpServer.listening) await server.close();
    rmSync(dir,{recursive:true,force:true});
  }
});

test('Simultaneous delivery orders and retries spend the shared final balance once',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'sim-life-delivery-race-060-'));
 const files=openServerFiles(dir),state=files.load();
 state.money=2500;files.save(state);
 const server=await startServer({port:0,dataDir:dir,lifeClock:{now:()=>0,tickMs:600000}});
 const sockets:WebSocket[]=[];
 try{
  const v=await connect(server.port,'vlad',files.access.vlad);sockets.push(v);
  const a=await connect(server.port,'alina',files.access.alina);sockets.push(a);
  const sharedV=next(v,p=>p.type==='snapshot'&&p.state.world.deliveries.length===1);
  const sharedA=next(a,p=>p.type==='snapshot'&&p.state.world.deliveries.length===1);
  const command={type:'delivery_order',sequence:0,lines:[{id:'takeout:rollsSet',quantity:1}]};
  v.send(JSON.stringify(command));a.send(JSON.stringify(command));
  const [vs,as]=await Promise.all([sharedV,sharedA]);assert.deepEqual(vs,as);
  assert.ok(vs.type==='snapshot');const winner=vs.state.world.deliveries[0].role;
  assert.equal(vs.state.money,151);assert.equal(vs.state.ledger.length,1);
  const winnerSocket=winner==='vlad'?v:a;
  const rejected=next(winnerSocket,p=>p.type==='error'&&p.reason.includes('уже обработана'));
  winnerSocket.send(JSON.stringify(command));await rejected;
  const saved=files.load();assert.equal(saved.money,151);assert.equal(saved.world.deliveries.length,1);
  assert.equal(saved.ledger.length,1);assert.equal(saved.world.sequence[winner],1);
  assert.equal(saved.world.sequence[winner==='vlad'?'alina':'vlad'],0);
 }finally{sockets.forEach(s=>s.terminate());await server.close();rmSync(dir,{recursive:true,force:true});}
});
test('071 delivery rejections carry only their own sequence; unrelated errors and furniture purchases do not confirm a basket',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'sim071-delivery-ack-'));
 const files=openServerFiles(dir),state=files.load();state.money=100000;state.autonomy={vlad:'off',alina:'off'};files.save(state);
 const server=await startServer({port:0,dataDir:dir,lifeClock:{now:()=>0,tickMs:600000}});
 const sockets:WebSocket[]=[];
 try{
  const v=await connect(server.port,'vlad',files.access.vlad);sockets.push(v);
  const a=await connect(server.port,'alina',files.access.alina);sockets.push(a);
  const unrelated=next(v,p=>p.type==='error');
  v.send(JSON.stringify({type:'unknown'}));
  const otherError=await unrelated;assert.equal(otherError.type,'error');assert.equal(otherError.deliverySequence,undefined);
  const bad=next(v,p=>p.type==='error');
  v.send(JSON.stringify({type:'delivery_order',sequence:0,lines:[{id:'grocery:invalid',quantity:1}]}));
  const error=await bad;assert.equal(error.type,'error');assert.equal(error.deliverySequence,0);
  assert.equal(files.load().money,100000);
  const store=next(v,p=>p.type==='store_event');
  v.send(JSON.stringify({type:'furniture_order',sku:'stool-cube',finish:'sage',shipping:'express',quantity:1}));
  await store;
  assert.equal(files.load().world.sequence.vlad,0);
  const command={type:'delivery_order',sequence:0,lines:[{id:'grocery:bread',quantity:1}]};
  const vUpdate=next(v,p=>p.type==='snapshot'&&p.state.world.deliveries.some(d=>d.id==='D-vlad-0'));
  const aUpdate=next(a,p=>p.type==='snapshot'&&p.state.world.deliveries.some(d=>d.id==='D-vlad-0'));
  v.send(JSON.stringify(command));assert.deepEqual(await vUpdate,await aUpdate);
  const after=files.load(),retry=next(v,p=>p.type==='error');
  v.send(JSON.stringify(command));const rejected=await retry;
  assert.equal(rejected.type,'error');assert.equal(rejected.deliverySequence,0);
  assert.equal(files.load().money,after.money);
  assert.equal(files.load().world.deliveries.length,1);
 }finally{sockets.forEach(s=>s.terminate());await server.close();rmSync(dir,{recursive:true,force:true});}
});
