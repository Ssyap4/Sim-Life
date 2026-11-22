import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { once } from 'node:events';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import WebSocket from 'ws';
import { initialState, points, type CharacterId, type ServerPacket } from '../../src/shared/protocol';
import { timeMultiplier, sleepTarget, type SleepMode } from '../../src/shared/timeControl';
import { recoverSleep } from '../timeControl';
import { advanceLife } from '../life';
import { openServerFiles } from '../storage';
import { startServer } from '../server';

test('Shared speed requires the agreement of every online player', () => {
  const jobs = { vlad: { job: 'ozon' } };
  const sleep = new Map<CharacterId, SleepMode>();
  const votes = new Set<CharacterId>();
  assert.equal(timeMultiplier([], jobs, sleep, votes), 1);
  assert.equal(timeMultiplier(['vlad'], jobs, sleep, votes), 1);
  votes.add('vlad');
  assert.equal(timeMultiplier(['vlad'], jobs, sleep, votes), 1.5);
  assert.equal(timeMultiplier(['vlad', 'alina'], jobs, sleep, votes), 1);
  votes.add('alina');
  assert.equal(timeMultiplier(['vlad', 'alina'], jobs, sleep, votes), 1.5);
  assert.equal(timeMultiplier(['vlad'], {}, sleep, votes), 1);
  sleep.set('vlad', 'half');
  assert.equal(timeMultiplier(['vlad'], {}, sleep, votes), 3);
  assert.equal(timeMultiplier(['vlad', 'alina'], {}, sleep, votes), 1);
  sleep.set('alina', 'half');
  assert.equal(timeMultiplier(['vlad', 'alina'], {}, sleep, votes), 3);
  sleep.set('alina', 'full');
  assert.equal(timeMultiplier(['vlad', 'alina'], {}, sleep, votes), 2);
  assert.equal(sleepTarget('half'), 50);
  assert.equal(sleepTarget('full'), 100);
});

test('Sleep recovery runs with real game minutes and stops at exact half/full target', () => {
  let state = initialState();
  state.characters.vlad.energy = 10;
  state.characters.alina.energy = 40;
  state.characters.vlad.pose = 'sleep';
  state.characters.alina.pose = 'sleep';
  const sessions = new Map<CharacterId, SleepMode>([['vlad', 'full'], ['alina', 'half']]);
  state = advanceLife(state, 60, ['vlad', 'alina']);
  assert.deepEqual(recoverSleep(state, 60, sessions), ['alina']);
  assert.ok(state.characters.vlad.energy > 20);
  assert.equal(state.characters.alina.energy, 50);
  assert.equal(state.characters.alina.pose, 'idle');
  assert.equal(state.characters.vlad.pose, 'sleep');
  sessions.delete('alina');
  state = advanceLife(state, 1440, ['vlad']);
  assert.deepEqual(recoverSleep(state, 1440, sessions), ['vlad']);
  assert.equal(state.characters.vlad.energy, 100);
  assert.equal(state.characters.vlad.pose, 'idle');
});

type Connection = {
  send(message: object): void;
  next<K extends ServerPacket['type']>(type: K,
    predicate?: (packet: Extract<ServerPacket, { type: K }>) => boolean): Promise<Extract<ServerPacket, { type: K }>>;
  close(): Promise<void>;
};
async function connection(port: number): Promise<Connection> {
  const ws = new WebSocket('ws://127.0.0.1:' + port + '/sync');
  const inbox: ServerPacket[] = [];
  ws.on('message', data => inbox.push(JSON.parse(data.toString())));
  await once(ws, 'open');
  return {
    send(message) { ws.send(JSON.stringify(message)); },
    async next(type, predicate = () => true) {
      for (let i = 0; i < 300; i++) {
        const found = inbox.findIndex(p => p.type === type &&
          predicate(p as Extract<ServerPacket, { type: typeof type }>));
        if (found !== -1) return inbox.splice(found, 1)[0] as Extract<ServerPacket, { type: typeof type }>;
        await new Promise(resolve => setTimeout(resolve, 10));
      }
      throw new Error('Timed out waiting for ' + type + '; saw ' + inbox.map(p => p.type).join(','));
    },
    async close() {
      if (ws.readyState === WebSocket.CLOSED) return;
      const closed = once(ws, 'close');
      ws.close();
      await closed;
    },
  };
}

test('Live two-player sleep and shift votes never speed up a non-consenting awake player', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'sim-life-speed-'));
  const files = openServerFiles(dir);
  const initial = initialState();
  initial.characters.vlad.energy = 62;
  initial.characters.alina.energy = 22;
  files.save(initial);
  const server = await startServer({ port: 0, dataDir: dir });
  const sockets: Connection[] = [];
  try {
    const a = await connection(server.port); sockets.push(a);
    const b = await connection(server.port); sockets.push(b);
    a.send({ type: 'auth', role: 'vlad', code: files.access.vlad });
    b.send({ type: 'auth', role: 'alina', code: files.access.alina });
    await a.next('ready'); await b.next('ready');
    a.send({ type: 'sleep_start', mode: 'full' });
    await b.next('time_status', p => Boolean(p.status.sleepers.vlad) && p.status.multiplier === 1);
    b.send({ type: 'sleep_start', mode: 'half' });
    await a.next('time_status', p => p.status.multiplier === 2 &&
      p.status.sleepers.vlad === 'full' && p.status.sleepers.alina === 'half');
    const sleeping = await a.next('snapshot', p =>
      p.state.characters.vlad.pose === 'sleep' && p.state.characters.alina.pose === 'sleep');
    for (const resident of Object.values(sleeping.state.characters))
      assert.deepEqual({ x: resident.x, z: resident.z }, points.bed);
    b.send({ type: 'sleep_stop' });
    await a.next('time_status', p => p.status.multiplier === 1 && !p.status.sleepers.alina);
    a.send({ type: 'sleep_stop' });
    await a.next('time_status', p => !p.status.sleepers.vlad);
    a.send({ type: 'job_start', job: 'ozon' });
    await b.next('job_event', p => p.outcome === 'started');
    a.send({ type: 'shift_speed', enabled: true });
    await b.next('time_status', p => p.status.shiftVotes.includes('vlad') && p.status.multiplier === 1);
    b.send({ type: 'shift_speed', enabled: true });
    await a.next('time_status', p => p.status.multiplier === 1.5);
    b.send({ type: 'shift_speed', enabled: false });
    await a.next('time_status', p => p.status.multiplier === 1 && !p.status.shiftVotes.includes('alina'));
    a.send({ type: 'job_leave_early' });
    await b.next('job_event', p => p.outcome === 'left_early');
    assert.equal(files.load().activeShifts.vlad, undefined);
    assert.equal(files.load().money, 10000);
  } finally {
    for (const socket of sockets) await socket.close();
    await server.close();
    rmSync(dir, { recursive: true, force: true });
  }
});

test('Purchased replacement bed keeps x2/x3 sleep acceleration for two online residents',async()=>{
  const dir=mkdtempSync(join(tmpdir(),'sim-life-purchased-speed-'));
  const files=openServerFiles(dir);
  const state=initialState();
  state.furnishing.soldFixtures=['bed'];
  state.furnishing.placed=[{id:1,sku:'bed-aurora',finish:'sage',x:-6.97,z:-5.88,rotation:0}];
  state.furnishing.nextId=2;
  state.characters.vlad.energy=18;
  state.characters.alina.energy=18;
  files.save(state);
  const server=await startServer({port:0,dataDir:dir});
  const sockets:Connection[]=[];
  try{
    const a=await connection(server.port);sockets.push(a);
    const b=await connection(server.port);sockets.push(b);
    a.send({type:'auth',role:'vlad',code:files.access.vlad});
    b.send({type:'auth',role:'alina',code:files.access.alina});
    await a.next('ready');await b.next('ready');
    a.send({type:'sleep_start',mode:'full',furnitureId:1});
    await a.next('time_status',p=>p.status.sleepers.vlad==='full'&&p.status.multiplier===1);
    b.send({type:'sleep_start',mode:'half',furnitureId:1});
    await a.next('time_status',p=>p.status.multiplier===2&&
      p.status.sleepers.vlad==='full'&&p.status.sleepers.alina==='half');
    const mixed=await a.next('snapshot',p=>p.state.characters.vlad.pose==='sleep'&&
      p.state.characters.alina.pose==='sleep');
    assert.equal(mixed.state.characters.vlad.sleepingOn,1);
    assert.equal(mixed.state.characters.alina.sleepingOn,1);
    a.send({type:'sleep_stop'});
    await b.next('time_status',p=>p.status.multiplier===1&&!p.status.sleepers.vlad);
    a.send({type:'sleep_start',mode:'half',furnitureId:1});
    await b.next('time_status',p=>p.status.multiplier===3&&
      p.status.sleepers.vlad==='half'&&p.status.sleepers.alina==='half');
  }finally{
    for(const socket of sockets)await socket.close();
    await server.close();
    rmSync(dir,{recursive:true,force:true});
  }
});
