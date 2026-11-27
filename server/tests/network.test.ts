import { test } from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import WebSocket, { type RawData } from 'ws';
import { startServer } from '../server';
import type { CharacterId, ServerPacket } from '../../src/shared/protocol';

function waitFor(socket: WebSocket, match: (packet: ServerPacket) => boolean): Promise<ServerPacket> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      socket.off('message', onMessage);
      reject(new Error('Timed out waiting for server packet'));
    }, 3000);
    function onMessage(raw: RawData): void {
      let packet: ServerPacket;
      try { packet = JSON.parse(raw.toString()) as ServerPacket; }
      catch { return; }
      if (match(packet)) {
        clearTimeout(timeout);
        socket.off('message', onMessage);
        resolve(packet);
      }
    }
    socket.on('message', onMessage);
  });
}

async function connect(port: number): Promise<WebSocket> {
  const socket = new WebSocket('ws://127.0.0.1:' + port + '/sync');
  await once(socket, 'open');
  return socket;
}

async function login(socket: WebSocket, role: CharacterId, code: string): Promise<ServerPacket> {
  const response = waitFor(socket, (p) => p.type === 'ready' || p.type === 'error');
  socket.send(JSON.stringify({ type: 'auth', role, code }));
  return response;
}

test('Two phones get shared state, role ownership, persisted economy and private codes', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'sim-life-network-'));
  const running = await startServer({ port: 0, host: '127.0.0.1', dataDir: dir, taskTimeScale: 0.025 });
  let first: WebSocket | undefined;
  let second: WebSocket | undefined;
  let duplicate: WebSocket | undefined;
  try {
    const keys = JSON.parse(readFileSync(join(dir, 'access.json'), 'utf8')) as Record<CharacterId, string>;
    assert.ok(keys.vlad.length >= 12);
    assert.notEqual(keys.vlad, keys.alina);

    const health = await fetch('http://127.0.0.1:' + running.port + '/health');
    assert.equal(health.status, 200);
    const secret = await fetch('http://127.0.0.1:' + running.port + '/access.json');
    assert.equal(secret.status, 404);

    first = await connect(running.port);
    assert.equal((await login(first, 'vlad', keys.vlad)).type, 'ready');

    second = await connect(running.port);
    const readyAlina = await login(second, 'alina', keys.alina);
    assert.equal(readyAlina.type, 'ready');
    if (readyAlina.type === 'ready') assert.deepEqual(readyAlina.online.sort(), ['alina', 'vlad']);

    duplicate = await connect(running.port);
    const conflict = await login(duplicate, 'vlad', keys.vlad);
    assert.equal(conflict.type, 'error');
    if (conflict.type === 'error') assert.match(conflict.reason, /занят/);
    duplicate.close();

    const firstUpdate = waitFor(first, (p) => p.type === 'snapshot' && p.state.revision === 1);
    const secondUpdate = waitFor(second, (p) => p.type === 'snapshot' && p.state.revision === 1);
    first.send(JSON.stringify({ type: 'act', actionId: 'vladOrder' }));
    const [a, b] = await Promise.all([firstUpdate, secondUpdate]);
    assert.equal(a.type, 'snapshot');
    assert.equal(b.type, 'snapshot');
    if (a.type === 'snapshot' && b.type === 'snapshot') {
      assert.equal(a.state.money, 10000);
      assert.deepEqual(a.state, b.state);
    }

    const wrongRole = waitFor(second, (p) => p.type === 'error');
    second.send(JSON.stringify({ type: 'act', actionId: 'vladOrder' }));
    const rejected = await wrongRole;
    assert.equal(rejected.type, 'error');

    first.close();
    second.close();
    await running.close();

    const recovered = await startServer({ port: 0, host: '127.0.0.1', dataDir: dir });
    try {
      const restored = await connect(recovered.port);
      const read = await login(restored, 'vlad', keys.vlad);
      assert.equal(read.type, 'ready');
      if (read.type === 'ready') {
        assert.equal(read.state.money, 10000);
        assert.equal(read.state.revision, 1);
      }
      restored.close();
      await recovered.close();
    } catch (error) {
      await recovered.close();
      throw error;
    }
  } finally {
    if (running.httpServer.listening) await running.close();
    rmSync(dir, { recursive: true, force: true });
  }
});

test('Repeated reconnects preserve the other player and the latest shared household',async()=>{
  const dir=mkdtempSync(join(tmpdir(),'sim063-reconnect-'));
  const server=await startServer({port:0,host:'127.0.0.1',dataDir:dir,taskTimeScale:.025,
    lifeClock:{now:()=>0,tickMs:600000},autonomyTiming:{idleMs:99999999,careCooldownMs:99999999,leisureCooldownMs:99999999}});
  const sockets:WebSocket[]=[];
  try{
    const keys=JSON.parse(readFileSync(join(dir,'access.json'),'utf8')) as Record<CharacterId,string>;
    const joinRole=async(role:CharacterId)=>{
      const socket=await connect(server.port);sockets.push(socket);
      const ready=await login(socket,role,keys[role]);
      assert.equal(ready.type,'ready');if(ready.type!=='ready')throw Error('not ready');
      return {socket,ready};
    };
    let v=await joinRole('vlad');
    const a=await joinRole('alina');
    let revision=a.ready.state.revision;
    for(let i=0;i<3;i++){
      const left=waitFor(a.socket,p=>p.type==='online'&&p.online.length===1&&p.online[0]==='alina');
      v.socket.terminate();await left;
      if(i===0){
        const changed=waitFor(a.socket,p=>p.type==='snapshot'&&p.state.revision>revision);
        a.socket.send(JSON.stringify({type:'act',actionId:'alinaStudy'}));
        const snapshot=await changed;assert.equal(snapshot.type,'snapshot');
        if(snapshot.type==='snapshot')revision=snapshot.state.revision;
      }
      const together=waitFor(a.socket,p=>p.type==='online'&&p.online.includes('alina')&&p.online.includes('vlad'));
      v=await joinRole('vlad');await together;
      assert.equal(v.ready.state.revision,revision);
      assert.equal(v.ready.state.money,10000);
      assert.equal(a.socket.readyState,WebSocket.OPEN);
    }
  }finally{sockets.forEach(s=>s.terminate());await server.close();rmSync(dir,{recursive:true,force:true});}
});
