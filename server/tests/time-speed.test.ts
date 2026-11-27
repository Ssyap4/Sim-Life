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
      throw new Error('Timed out waiting for ' + type + '; saw ' + inbox.map(p => p.type==='snapshot'?p.type+':'+gameMinutes(p.state.clock):p.type==='clock_sync'?p.type+':'+JSON.stringify(p.sample):p.type==='time_status'?p.type+':'+JSON.stringify(p.status):p.type).join(','));
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

import {clockAt,gameMinutes} from '../../src/shared/life';
import {shiftWage} from '../../src/shared/jobs';
import {addReadyFood} from '../../src/shared/readyFood';
import {coffeeCupsToday} from '../../src/shared/coffee';
import {applyServiceCommand} from '../services';
import {applyWorld} from '../locations';
import {DELIVERY_MINUTES} from '../../src/shared/locations';
import {treatsRemaining} from '../../src/shared/pets';

test('Sleep recovery has the same energy and comfort at every clock batch size',()=>{
 const seed=initialState();
 Object.assign(seed.characters.vlad,{energy:20,comfort:30,pose:'sleep',sleepingOn:1});
 seed.furnishing.placed=[{id:1,sku:'bed-aurora',finish:'sage',x:-6.97,z:-5.88,rotation:0}];
 const sleepers=new Map<CharacterId,SleepMode>([['vlad','full']]);
 const run=(step:number)=>{
  let state=structuredClone(seed);
  for(let minute=0;minute<60;minute+=step){state=advanceLife(state,step,['vlad']);recoverSleep(state,step,sleepers);}
  return state.characters.vlad;
 };
 const expected=run(60);
 for(const step of [1,2,3,5,10]){
  const actual=run(step);
  assert.ok(Math.abs(actual.energy-expected.energy)<.0001,'energy '+step);
  assert.ok(Math.abs(actual.comfort-expected.comfort)<.0001,'comfort '+step);
 }
});

test('Clock settles elapsed minutes before a second login, pause, disconnect and early shift payout',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'sim-life-clock-boundaries-060-'));
 const files=openServerFiles(dir);
 let now=0;
 const server=await startServer({port:0,dataDir:dir,lifeClock:{now:()=>now,tickMs:600000}});
 const sockets:Connection[]=[];
 try{
  const a=await connection(server.port);sockets.push(a);
  a.send({type:'auth',role:'vlad',code:files.access.vlad});await a.next('ready');
  now+=20000;
  const b=await connection(server.port);sockets.push(b);
  b.send({type:'auth',role:'alina',code:files.access.alina});const joined=await b.next('ready');
  assert.equal(gameMinutes(joined.state.clock),490);
  assert.equal(joined.state.characters.alina.hunger,initialState().characters.alina.hunger);
  now+=20000;
  a.send({type:'pause_toggle'});await b.next('time_status',p=>p.status.pauseRequestedBy==='vlad');await b.next('clock_sync',p=>p.sample.multiplier===1&&p.sample.minutes===500);
  b.send({type:'pause_reply',accept:true});await a.next('time_status',p=>p.status.paused===true);
  assert.equal(gameMinutes(files.load().clock),500);
  now+=120000;
  a.send({type:'pause_toggle'});await b.next('clock_sync',p=>p.sample.multiplier===1&&p.sample.minutes===500);
  assert.equal(gameMinutes(files.load().clock),500);
  now+=20000;await b.close();
  await a.next('snapshot',p=>gameMinutes(p.state.clock)===510);
  assert.equal(gameMinutes(files.load().clock),510);
  a.send({type:'job_start',job:'ozon'});await a.next('job_event',p=>p.outcome==='started');
  const assigned=files.load().activeShifts.vlad!;
  a.send({type:'shift_speed',enabled:true});await a.next('time_status',p=>p.status.multiplier===1.5);
  now+=20000;
  a.send({type:'job_leave_early'});await a.next('job_event',p=>p.outcome==='left_early');
  const paid=files.load();
  assert.equal(gameMinutes(paid.clock),525);
  assert.equal(paid.money,10000+shiftWage(assigned,paid.clock));
  assert.equal(paid.activeShifts.vlad,undefined);
  await a.close();for(let attempt=0;attempt<100;attempt++){const health=await (await fetch('http://127.0.0.1:'+server.port+'/health')).json() as {online:number};if(health.online===0)break;if(attempt===99)assert.fail('Disconnect not settled');await new Promise(r=>setTimeout(r,10));}now+=120000;
  const c=await connection(server.port);sockets.push(c);
  c.send({type:'auth',role:'vlad',code:files.access.vlad});const resumed=await c.next('ready');
  assert.equal(gameMinutes(resumed.state.clock),525);
 }finally{for(const socket of sockets)await socket.close();await server.close();rmSync(dir,{recursive:true,force:true});}
});

test('Midnight at x3 expires food and a reward, resets daily cups, and bills the family exactly once',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'sim-life-clock-midnight-060-'));
 const files=openServerFiles(dir);let seed=initialState();
 const connected=applyServiceCommand(seed,'vlad',{type:'service_connect',service:'netflix'});assert.ok(connected.ok);seed=connected.state;
 const boundary=1440;
 seed.clock=clockAt(boundary-DELIVERY_MINUTES);
 const order=applyWorld(seed,'vlad',{type:'delivery_order',sequence:0,lines:[{id:'grocery:bread',quantity:1}]});
 assert.ok(order.ok);seed=order.state;assert.equal(seed.world.deliveries[0].readyAt,boundary);
 seed.clock=clockAt(boundary-3);
 seed.billing.services.netflix.nextDue=boundary;seed.billing.services.netflix.paidUntil=boundary;
 seed.characters.vlad.energy=10;
 seed.meals.omelette=1;addReadyFood(seed,'meal','omelette',1,'fridge');seed.readyFood[0].expiresAt=boundary;
 seed.coffeeDaily.vlad={day:1,cups:3};seed.pets.verdell.treats={day:1,used:3};
 seed.happiness.vlad.until.hunger=boundary;seed.characters.vlad.hunger=100;
 files.save(seed);let now=0;
 const server=await startServer({port:0,dataDir:dir,lifeClock:{now:()=>now,tickMs:600000}});
 const sockets:Connection[]=[];
 try{
  const a=await connection(server.port);sockets.push(a);a.send({type:'auth',role:'vlad',code:files.access.vlad});await a.next('ready');
  a.send({type:'sleep_start',mode:'half'});await a.next('time_status',p=>p.status.multiplier===3);
  now+=2000;
  a.send({type:'pause_toggle'});await a.next('time_status',p=>p.status.paused===true);
  let state=files.load();assert.equal(gameMinutes(state.clock),boundary);
  await a.next('delivery_arrived');assert.equal(treatsRemaining(state.pets.verdell,state.clock.day),3);
  assert.equal(state.meals.omelette,0);assert.equal(coffeeCupsToday(state,'vlad'),0);
  assert.equal(state.money,seed.money-1500);assert.equal(state.billing.services.netflix.paidUntil,boundary+14400);
  assert.equal(state.billing.bills.filter(b=>b.service==='netflix').length,2);
  a.send({type:'pause_toggle'});await a.next('clock_sync',p=>p.sample.multiplier===3&&p.sample.minutes===boundary);
  now+=2000;a.send({type:'sleep_stop'});await a.next('clock_sync',p=>p.sample.multiplier===1&&p.sample.minutes===boundary+3);
  state=files.load();assert.equal(gameMinutes(state.clock),boundary+3);
  assert.ok(state.characters.vlad.hunger<100);
  assert.equal(state.money,seed.money-1500);
 }finally{for(const socket of sockets)await socket.close();await server.close();rmSync(dir,{recursive:true,force:true});}
});