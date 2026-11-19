import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { once } from 'node:events';
import WebSocket, { type RawData } from 'ws';
import { startServer } from '../server';
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
