import { test } from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { mkdtempSync, readFileSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import WebSocket, { type RawData } from 'ws';
import type { CharacterId, ServerPacket } from '../../src/shared/protocol';
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
      assert.equal(sv.state.money, 2500);
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
      assert.equal(done.state.money, 2620);
      assert.equal(done.state.characters.vlad.skill, 6);
    }
    const saved = JSON.parse(readFileSync(join(ctx.dir, 'household.json'), 'utf8')) as { money: number; revision: number };
    assert.deepEqual([saved.money, saved.revision], [2620, 1]);
    ctx.vlad.terminate();
    ctx.alina.terminate();
    await ctx.server.close();
    const restored = await startServer({ port: 0, dataDir: ctx.dir, taskTimeScale: 0.035 });
    try {
      const after = await enter(restored.port, 'vlad', ctx.keys.vlad);
      after.close();
      const persisted = JSON.parse(readFileSync(join(ctx.dir, 'household.json'), 'utf8')) as { money: number; revision: number };
      assert.deepEqual([persisted.money, persisted.revision], [2620, 1]);
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
      assert.equal(v.state.money, 2455);
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
