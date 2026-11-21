import { test } from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { mkdtempSync, readFileSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import WebSocket, { type RawData } from 'ws';
import { points, type CharacterId, type ServerPacket } from '../../src/shared/protocol';
import { openServerFiles } from '../storage';
import { startServer } from '../server';

function waitFor(ws: WebSocket, accepts: (p: ServerPacket) => boolean): Promise<ServerPacket> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => { ws.off('message', receive); reject(new Error('Timed task packet never arrived')); }, 3200);
    function receive(raw: RawData): void {
      const message = JSON.parse(raw.toString()) as ServerPacket;
      if (!accepts(message)) return;
      clearTimeout(timer);
      ws.off('message', receive);
      resolve(message);
    }
    ws.on('message', receive);
  });
}
async function enter(port: number, role: CharacterId, code: string): Promise<WebSocket> {
  const ws = new WebSocket('ws://127.0.0.1:' + port + '/sync');
  await once(ws, 'open');
  const ready = waitFor(ws, (p) => p.type === 'ready' || p.type === 'error');
  ws.send(JSON.stringify({ type: 'auth', role, code }));
  assert.equal((await ready).type, 'ready');
  return ws;
}
async function setup(scale = 0.035) {
  const dir = mkdtempSync(join(tmpdir(), 'sim-life-timed-'));
  const server = await startServer({ port: 0, dataDir: dir, taskTimeScale: scale });
  const keys = JSON.parse(readFileSync(join(dir, 'access.json'), 'utf8')) as Record<CharacterId, string>;
  const vlad = await enter(server.port, 'vlad', keys.vlad);
  const alina = await enter(server.port, 'alina', keys.alina);
  return { server, dir, keys, vlad, alina };
}
function send(ws: WebSocket, message: object) { ws.send(JSON.stringify(message)); }
async function clean(ctx: Awaited<ReturnType<typeof setup>>) {
  ctx.vlad.terminate();
  ctx.alina.terminate();
  await ctx.server.close();
  rmSync(ctx.dir, { recursive: true, force: true });
}

test('The desk is exclusive, cancellation grants no reward, and another player can work afterward', async () => {
  const ctx = await setup();
  try {
    const startV = waitFor(ctx.vlad, p => p.type === 'task_started' && p.role === 'vlad');
    const startA = waitFor(ctx.alina, p => p.type === 'task_started' && p.role === 'vlad');
    send(ctx.vlad, { type: 'act', actionId: 'vladOrder' });
    const [v, a] = await Promise.all([startV, startA]);
    assert.deepEqual(v, a);
    assert.equal(v.type, 'task_started');
    if (v.type !== 'task_started') return;
    assert.ok(v.durationMs > 100);
    assert.equal(existsSync(join(ctx.dir, 'household.json')), false, 'Starting never awards money');

    const busyV = waitFor(ctx.vlad, p => p.type === 'error');
    send(ctx.vlad, { type: 'act', actionId: 'vladStudy' });
    assert.match((await busyV as Extract<ServerPacket,{type:'error'}>).reason, /занят/);

    const busyA = waitFor(ctx.alina, p => p.type === 'error');
    send(ctx.alina, { type: 'act', actionId: 'alinaStudy' });
    assert.match((await busyA as Extract<ServerPacket,{type:'error'}>).reason, /место.*занято/);

    const ended = waitFor(ctx.alina, p => p.type === 'task_ended' && p.taskId === v.taskId);
    send(ctx.vlad, { type: 'cancel_task', taskId: v.taskId });
    const canceled = await ended;
    assert.equal(canceled.type, 'task_ended');
    if (canceled.type === 'task_ended') assert.equal(canceled.outcome, 'cancelled');
    assert.equal(existsSync(join(ctx.dir, 'household.json')), false);

    const startAlina = waitFor(ctx.vlad, p => p.type === 'task_started' && p.role === 'alina');
    const finished = waitFor(ctx.vlad, p => p.type === 'task_ended' && p.role === 'alina' && p.outcome === 'completed');
    const snapV = waitFor(ctx.vlad, p => p.type === 'snapshot' && p.state.revision === 1);
    const snapA = waitFor(ctx.alina, p => p.type === 'snapshot' && p.state.revision === 1);
    send(ctx.alina, { type: 'act', actionId: 'alinaStudy' });
    await startAlina;
    await finished;
    const [sv, sa] = await Promise.all([snapV, snapA]);
    assert.deepEqual(sv, sa);
    if (sv.type === 'snapshot') {
      assert.equal(sv.state.money, 10000);
      assert.equal(sv.state.characters.alina.skill, 11);
      assert.equal(sv.state.revision, 1);
    }
  } finally { await clean(ctx); }
});

test('The reward comes after timed work, survives restart and cannot be duplicated', async () => {
  const ctx = await setup();
  try {
    const started = waitFor(ctx.vlad, p => p.type === 'task_started');
    const completed = waitFor(ctx.alina, p => p.type === 'task_ended' && p.outcome === 'completed');
    const snap = waitFor(ctx.vlad, p => p.type === 'snapshot' && p.state.revision === 1);
    send(ctx.vlad, { type: 'act', actionId: 'vladOrder' });
    const initial = await started;
    assert.equal(initial.type, 'task_started');
    assert.equal(existsSync(join(ctx.dir, 'household.json')), false);
    await completed;
    const done = await snap;
    if (done.type === 'snapshot') {
      assert.equal(done.state.money, 10000);
      assert.equal(done.state.characters.vlad.skill, 5);
      assert.equal(done.state.ledger.length, 0);
    }
    const saved = JSON.parse(readFileSync(join(ctx.dir, 'household.json'), 'utf8')) as { money: number; revision: number };
    assert.deepEqual([saved.money, saved.revision], [10000, 1]);
    ctx.vlad.terminate();
    ctx.alina.terminate();
    await ctx.server.close();
    const restored = await startServer({ port: 0, dataDir: ctx.dir, taskTimeScale: 0.035 });
    try {
      const after = await enter(restored.port, 'vlad', ctx.keys.vlad);
      after.close();
      const persisted = JSON.parse(readFileSync(join(ctx.dir, 'household.json'), 'utf8')) as { money: number; revision: number };
      assert.deepEqual([persisted.money, persisted.revision], [10000, 1]);
    } finally { await restored.close(); }
  } finally {
    if (ctx.server.httpServer.listening) await clean(ctx);
    else rmSync(ctx.dir, { recursive: true, force: true });
  }
});

test('Kitchen tasks lock the stove while the other player can care for a pet', async () => {
  const ctx = await setup(0.035);
  try {
    const milkBought = waitFor(ctx.vlad, p => p.type === 'snapshot' && p.state.revision === 1);
    send(ctx.alina, { type: 'buy', item: 'milk' });
    await milkBought;

    const kitchenStart = waitFor(ctx.vlad, p => p.type === 'task_started' && p.command.type === 'cook');
    send(ctx.vlad, { type: 'cook', recipe: 'omelette' });
    await kitchenStart;
    const blocked = waitFor(ctx.alina, p => p.type === 'error');
    send(ctx.alina, { type: 'cook', recipe: 'salad' });
    assert.equal((await blocked).type, 'error');

    const petStart = waitFor(ctx.vlad, p => p.type === 'task_started' && p.command.type === 'pet_action');
    const finalV = waitFor(ctx.vlad, p => p.type === 'snapshot' && p.state.revision === 3);
    const finalA = waitFor(ctx.alina, p => p.type === 'snapshot' && p.state.revision === 3);
    send(ctx.alina, { type: 'pet_action', pet: 'simba', action: 'pet' });
    await petStart;
    const [v, a] = await Promise.all([finalV, finalA]);
    assert.deepEqual(v, a);
    if (v.type === 'snapshot') {
      assert.equal(v.state.money, 9905);
      assert.equal(v.state.pantry.eggs, 2);
      assert.equal(v.state.pantry.milk, 0);
      assert.equal(v.state.meals.omelette, 2);
      assert.equal(v.state.pets.simba.bond, 38);
    }
  } finally { await clean(ctx); }
});

test('Disconnect cancels an unfinished activity and never grants its reward', async () => {
  const ctx = await setup(0.035);
  try {
    const began = waitFor(ctx.alina, p => p.type === 'task_started' && p.role === 'vlad');
    send(ctx.vlad, { type: 'act', actionId: 'vladOrder' });
    await began;
    const ended = waitFor(ctx.alina, p => p.type === 'task_ended' && p.role === 'vlad');
    ctx.vlad.terminate();
    const result = await ended;
    if (result.type === 'task_ended') assert.equal(result.outcome, 'cancelled');
    await new Promise(resolve => setTimeout(resolve, 600));
    assert.equal(existsSync(join(ctx.dir, 'household.json')), false);
  } finally { await clean(ctx); }
});

test('Bathroom fixtures are independently exclusive and physiology is published once on completion', async () => {
  const ctx = await setup();
  try {
    const started = waitFor(ctx.vlad, p => p.type === 'task_started' && p.role === 'vlad');
    send(ctx.vlad, { type: 'act', actionId: 'toiletUse' });
    const first = await started;
    assert.ok(first.type === 'task_started');
    const rejected = waitFor(ctx.alina, p => p.type === 'error');
    send(ctx.alina, { type: 'act', actionId: 'toiletUse' });
    const rejection = await rejected;
    assert.ok(rejection.type === 'error');
    assert.match(rejection.reason, /место.*занято/);
    assert.equal(existsSync(join(ctx.dir, 'household.json')), false);

    const accepted = waitFor(ctx.vlad, p => p.type === 'task_started' && p.role === 'alina');
    const vladDone = waitFor(ctx.vlad, p => p.type === 'task_ended' && p.taskId === first.taskId);
    const wash = waitFor(ctx.alina, p => p.type === 'task_started' && p.role === 'vlad' && p.home?.station === 'wcBasin');
    const alinaDone = waitFor(ctx.alina, p => p.type === 'task_ended' && p.role === 'alina');
    const completed = (p: ServerPacket) => p.type === 'snapshot' &&
      p.state.characters.vlad.hygiene === 94 && p.state.characters.alina.hygiene === 100;
    const a = waitFor(ctx.vlad, completed);
    const b = waitFor(ctx.alina, completed);
    send(ctx.alina, { type: 'act', actionId: 'bathShower' });
    await accepted;
    for (const finish of await Promise.all([vladDone, alinaDone]))
      assert.ok(finish.type === 'task_ended' && finish.outcome === 'completed');

    const [vSnapshot, aSnapshot, handWash] = await Promise.all([a, b, wash]);
    assert.ok(handWash.type === 'task_started' && handWash.home && handWash.automatic === true);
    assert.deepEqual(handWash.home.route.from, points.toilet);
    assert.deepEqual(handWash.home.route.path.at(-1), points.wcBasin);
    assert.deepEqual(vSnapshot, aSnapshot);
    assert.ok(vSnapshot.type === 'snapshot');
    const { vlad, alina } = vSnapshot.state.characters;
    assert.deepEqual([vlad.bladder, vlad.x, vlad.z], [100, points.wcBasin.x, points.wcBasin.z]);
    assert.deepEqual([alina.hygiene, alina.x, alina.z], [100, points.shower.x, points.shower.z]);
    assert.equal(openServerFiles(ctx.dir).load().characters.vlad.bladder, 100);
  } finally { await clean(ctx); }
});

test('The grill is exclusive and produces shared portions served at the yard table', async () => {
  const ctx = await setup(.025);
  try {
    const cook = { type: 'cook', recipe: 'grillChicken' };
    const missing = waitFor(ctx.vlad, p => p.type === 'error');
    send(ctx.vlad, cook);
    const rejected = await missing;
    assert.ok(rejected.type === 'error' && /Не хватает/.test(rejected.reason));

    const supplies = waitFor(ctx.vlad, p => p.type === 'snapshot' && p.state.pantry.chicken > 0);
    // Chicken kebab requires chicken, onion, charcoal and lighter fluid; not sunflower oil.
    send(ctx.vlad, { type: 'checkout', lines: ['chicken', 'onion', 'charcoal', 'lighterFluid']
      .map(item => ({ id: 'grocery:' + item, quantity: 1 })) });
    await supplies;
    const start = waitFor(ctx.vlad, p => p.type === 'task_started' && p.role === 'vlad');
    const done = waitFor(ctx.vlad, p => p.type === 'task_ended' && p.role === 'vlad' && p.outcome === 'completed');
    const stocked = waitFor(ctx.alina, p => p.type === 'snapshot' && p.state.meals.grillChicken === 3);
    const before = openServerFiles(ctx.dir).load();
    send(ctx.vlad, cook);
    const task = await start;
    assert.ok(task.type === 'task_started' && task.home?.station === 'grill');
    const busy = waitFor(ctx.alina, p => p.type === 'error');
    send(ctx.alina, cook);
    const occupied = await busy;
    assert.ok(occupied.type === 'error' && /занято/.test(occupied.reason));
    const [, ready] = await Promise.all([done, stocked]);
    assert.ok(ready.type === 'snapshot');
    assert.equal(ready.state.pantry.chicken, before.pantry.chicken - 2);
    assert.equal(ready.state.pantry.oil, before.pantry.oil);
    assert.equal(ready.state.pantry.charcoal, before.pantry.charcoal - 1);
    assert.equal(ready.state.pantry.lighterFluid, before.pantry.lighterFluid - 1);
    assert.equal(ready.state.money, before.money);

    const eating = waitFor(ctx.vlad, p => p.type === 'task_started' && p.role === 'alina');
    const ate = waitFor(ctx.vlad, p => p.type === 'snapshot' && p.state.meals.grillChicken === 2);
    send(ctx.alina, { type: 'eat', recipe: 'grillChicken' });
    const meal = await eating;
    assert.ok(meal.type === 'task_started' && meal.home?.station === 'yardTable');
    const after = await ate;
    assert.ok(after.type === 'snapshot');
    assert.ok(after.state.characters.alina.hunger > before.characters.alina.hunger);
    assert.equal(openServerFiles(ctx.dir).load().meals.grillChicken, 2);
  } finally { await clean(ctx); }
});

test('A jointly accepted movie starts one synchronized timer and commits both capped rewards', async () => {
  const ctx=await setup(.006);
  try {
    const subscribed=waitFor(ctx.alina,p=>p.type==='snapshot'&&p.state.billing.services.netflix.enabled);
    send(ctx.vlad,{type:'service_connect',service:'netflix'});
    await subscribed;
    const offer=waitFor(ctx.alina,p=>p.type==='movie_offer');
    send(ctx.vlad,{type:'movie_invite',genre:'comedy'});
    const invited=await offer;
    assert.ok(invited.type==='movie_offer');
    assert.equal(invited.from,'vlad');
    assert.equal(openServerFiles(ctx.dir).load().revision,1);
    const forged=waitFor(ctx.vlad,p=>p.type==='error');
    send(ctx.vlad,{type:'movie_reply',inviteId:invited.inviteId,accept:true});
    assert.equal((await forged).type,'error');

    const starts=['vlad','alina'].map(role=>waitFor(ctx.vlad,p=>p.type==='task_started'&&p.role===role));
    const active=['vlad','alina'].map(role=>waitFor(ctx.alina,p=>p.type==='task_active'&&p.role===role));
    const ends=['vlad','alina'].map(role=>waitFor(ctx.vlad,p=>p.type==='task_ended'&&p.role===role));
    const snap=waitFor(ctx.alina,p=>p.type==='snapshot'&&p.state.revision===3);
    send(ctx.alina,{type:'movie_reply',inviteId:invited.inviteId,accept:true});
    const seats=[];
    for(const started of await Promise.all(starts)) {
      assert.ok(started.type==='task_started');
      assert.equal(started.durationMs,720);
      assert.deepEqual(started.effects,{fun:100,social:100,comfort:15});
      assert.equal(started.home?.program,'comedy');
      assert.equal(started.home?.station,'sofa');
      seats.push(started.home.route.path.at(-1));
    }
    assert.notDeepEqual(seats[0],seats[1]);
    for(const playing of await Promise.all(active)) {
      assert.ok(playing.type==='task_active');
      assert.equal(playing.elapsedMs,0);
    }
    assert.equal(openServerFiles(ctx.dir).load().revision,1,'Approach and playback do not award needs');
    const state=await snap;
    assert.ok(state.type==='snapshot');
    for(const ended of await Promise.all(ends)) {
      assert.ok(ended.type==='task_ended');
      assert.equal(ended.outcome,'completed');
      const role=ended.role;
      assert.deepEqual(ended.effects,{social:25,fun:28,comfort:15});
      const s: import('../../src/shared/protocol').Needs = state.state.characters[role];
      assert.deepEqual([s.fun,s.social,s.comfort],[100,100,95]);
    }
    const duplicate=waitFor(ctx.alina,p=>p.type==='error');
    send(ctx.alina,{type:'movie_reply',inviteId:invited.inviteId,accept:true});
    await duplicate;
    assert.equal(openServerFiles(ctx.dir).load().revision,3);
  } finally {await clean(ctx);}
});

test('A declined invitation starts no action; disconnect cancels both accepted viewers', async () => {
  const ctx=await setup(.012);
  try {
    const subscribed=waitFor(ctx.alina,p=>p.type==='snapshot'&&p.state.billing.services.netflix.enabled);
    send(ctx.vlad,{type:'service_connect',service:'netflix'});
    await subscribed;
    const offer=async()=>{
      const pending=waitFor(ctx.alina,p=>p.type==='movie_offer');
      send(ctx.vlad,{type:'movie_invite',genre:'horror'});
      const p=await pending;
      assert.ok(p.type==='movie_offer');
      return p.inviteId;
    };
    const id=await offer();
    const declined=waitFor(ctx.vlad,p=>p.type==='movie_offer_closed');
    send(ctx.alina,{type:'movie_reply',inviteId:id,accept:false});
    assert.match((await declined as Extract<ServerPacket,{type:'movie_offer_closed'}>).message,/отклонено/);
    assert.equal(openServerFiles(ctx.dir).load().revision,1);
    const accepted=await offer();
    const running=waitFor(ctx.vlad,p=>p.type==='task_active'&&p.role==='alina');
    send(ctx.alina,{type:'movie_reply',inviteId:accepted,accept:true});
    await running;
    const endings=['vlad','alina'].map(role=>waitFor(ctx.vlad,p=>p.type==='task_ended'&&p.role===role));
    ctx.alina.terminate();
    for(const ended of await Promise.all(endings)) {
      assert.ok(ended.type==='task_ended');
      assert.equal(ended.outcome,'cancelled');
      assert.equal(ended.effects,undefined);
    }
    const offline=waitFor(ctx.vlad,p=>p.type==='error');
    send(ctx.vlad,{type:'movie_invite',genre:'action'});
    assert.match((await offline as Extract<ServerPacket,{type:'error'}>).reason,/не в сети/);
    const saved=openServerFiles(ctx.dir).load();
    assert.equal(saved.characters.vlad.fun,72);
    assert.equal(saved.characters.alina.social,75);
  } finally {await clean(ctx);}
});

test('Every book reaches the shelf and a physical seat before completion', async () => {
  const {BOOKS}=await import('../../src/shared/homeLife');
  const {LIBRARY_APPROACH}=await import('../../src/shared/home');
  const ctx=await setup(.003);
  try {
    for(const [book,record] of Object.entries(BOOKS)) {
      const started=waitFor(ctx.vlad,p=>p.type==='task_started');
      const playing=waitFor(ctx.vlad,p=>p.type==='task_active');
      const ended=waitFor(ctx.vlad,p=>p.type==='task_ended'&&p.outcome==='completed');
      send(ctx.vlad,{type:'read_book',book});
      const task=await started;
      assert.ok(task.type==='task_started'&&task.home&&task.home.pickup);
      assert.equal(task.durationMs,record[3]*3);
      assert.deepEqual(task.effects,{fun:60,comfort:10});
      assert.deepEqual(task.home.route.path[task.home.pickup-1],LIBRARY_APPROACH);
      assert.ok(['sofa','table','yardTable'].includes(task.home.station));
      await playing;
      await ended;
    }
    const state=openServerFiles(ctx.dir).load();
    assert.equal(state.characters.vlad.fun,100);
    assert.equal(state.characters.vlad.comfort,100);
    assert.deepEqual(state.readBooks, { vlad: Object.keys(BOOKS), alina: [] });
    assert.equal(state.characters.vlad.skill,0);
    assert.equal(state.money,10000);
    assert.equal(state.pantry.eggs,4);
  } finally {await clean(ctx);}
});

test('Reading in the chair is exclusive, and only completion marks a book for its reader', async () => {
  const ctx = await setup(.02);
  try {
    const start = waitFor(ctx.vlad, p => p.type === 'task_started' && p.role === 'vlad');
    const read = { type: 'read_book', book: 'prince', seat: 'officeChair' };
    send(ctx.vlad, read);
    const task = await start;
    assert.ok(task.type === 'task_started' && task.home?.station === 'officeChair');
    const denied = waitFor(ctx.alina, p => p.type === 'error');
    send(ctx.alina, { type: 'act', actionId: 'officeChairSit' });
    const error = await denied;
    assert.ok(error.type === 'error' && /занято/.test(error.reason));
    const canceled = waitFor(ctx.vlad, p => p.type === 'task_ended' && p.outcome === 'cancelled');
    send(ctx.vlad, { type: 'cancel_task', taskId: task.taskId });
    await canceled;
    assert.deepEqual(openServerFiles(ctx.dir).load().readBooks, { vlad: [], alina: [] });

    const sitting = waitFor(ctx.vlad, p => p.type === 'task_started' && p.role === 'alina');
    const stood = waitFor(ctx.alina, p => p.type === 'task_ended' && p.outcome === 'completed');
    send(ctx.alina, { type: 'act', actionId: 'officeChairSit' });
    const seat = await sitting;
    assert.ok(seat.type === 'task_started' && seat.home?.station === 'officeChair');
    await stood;

    for (let n = 0; n < 2; n++) {
      const synced = waitFor(ctx.alina, p => p.type === 'snapshot' && p.state.readBooks.vlad.includes('prince'));
      const done = waitFor(ctx.vlad, p => p.type === 'task_ended' && p.outcome === 'completed');
      send(ctx.vlad, read);
      await Promise.all([synced, done]);
    }
    const restored = openServerFiles(ctx.dir).load();
    assert.deepEqual(restored.readBooks, { vlad: ['prince'], alina: [] });
    assert.equal(restored.characters.vlad.skill, 0);
    assert.equal(restored.characters.vlad.pose, 'idle');
  } finally { await clean(ctx); }
});
