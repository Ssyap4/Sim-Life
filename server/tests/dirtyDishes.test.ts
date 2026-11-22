import assert from 'node:assert/strict';
import { test } from 'node:test';
import { once } from 'node:events';
import WebSocket, { type RawData } from 'ws';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Vector3 } from 'three';
import { Actor } from '../../src/game/Actor';
import { dirtyDishStops, dishCount } from '../../src/shared/dirtyDishes';
import { HOME_FLOOR, KITCHEN_WORK, homeSeat } from '../../src/shared/home';
import { placeObstacles } from '../../src/shared/locations';
import { findRoute } from '../../src/game/navigation';
import { initialState, type CharacterId, type ServerPacket } from '../../src/shared/protocol';
import { addReadyFood } from '../../src/shared/readyFood';
import { applyFoodAction, applyTakeoutMeal } from '../food';
import { applyAction } from '../logic';
import { openServerFiles } from '../storage';
import { startServer } from '../server';
import { planTask } from '../tasks';

test('A finished indoor meal leaves exactly one dirty dish; failed food cannot create plates', () => {
  const state = initialState();
  state.meals.omelette = 2;
  addReadyFood(state, 'meal', 'omelette', 2, 'table');
  assert.deepEqual(state.dirtyDishes, { table: 0, yardTable: 0 });
  const first = applyFoodAction(state, 'vlad', { type: 'eat', recipe: 'omelette' });
  assert.ok(first.ok);
  assert.equal(first.state.dirtyDishes.table, 1);
  assert.equal(state.dirtyDishes.table, 0, 'evaluation never mutates original state');
  const second = applyFoodAction(first.state, 'alina', { type: 'eat', recipe: 'omelette' });
  assert.ok(second.ok);
  assert.equal(second.state.dirtyDishes.table, 2);
  const third = applyFoodAction(second.state, 'vlad', { type: 'eat', recipe: 'omelette' });
  assert.equal(third.ok, false);
  assert.equal(second.state.dirtyDishes.table, 2);
});

test('Takeaway and grill leave dishes at their correct dining tables', () => {
  const state = initialState();
  state.takeout.pizzaCheese = 1;
  addReadyFood(state, 'takeout', 'pizzaCheese', 1, 'table');
  const takeaway = applyTakeoutMeal(state, 'alina', 'pizzaCheese');
  assert.ok(takeaway.ok);
  assert.deepEqual(takeaway.state.dirtyDishes, { table: 1, yardTable: 0 });
  takeaway.state.meals.grillChicken = 1;
  addReadyFood(takeaway.state, 'meal', 'grillChicken', 1, 'table');
  const grill = applyFoodAction(takeaway.state, 'vlad', { type: 'eat', recipe: 'grillChicken' });
  assert.ok(grill.ok);
  assert.deepEqual(grill.state.dirtyDishes, { table: 1, yardTable: 1 });
});

test('Washing once clears all shared dishes; repeating it gives no free rewards', () => {
  const state = initialState();
  state.dirtyDishes = { table: 3, yardTable: 2 };
  const foodBefore = structuredClone(state.meals);
  const money = state.money;
  const clean = applyAction(state, 'alina', 'kitchenDishes');
  assert.ok(clean.ok);
  assert.deepEqual(clean.state.dirtyDishes, { table: 0, yardTable: 0 });
  assert.equal(dishCount(clean.state.dirtyDishes), 0);
  assert.deepEqual(clean.state.meals, foodBefore);
  assert.equal(clean.state.money, money);
  assert.deepEqual(state.dirtyDishes, { table: 3, yardTable: 2 }, 'source state unchanged');
  const repeated = applyAction(clean.state, 'vlad', 'kitchenDishes');
  assert.equal(repeated.ok, false, 'other resident cannot duplicate clean rewards');
  const plan = planTask({ type: 'act', actionId: 'kitchenDishes' });
  assert.equal(plan?.resource, 'kitchen');
  assert.ok((plan?.durationMs ?? 0) >= 10_000);
});

test('Dirty-dish routes visit occupied tables, then safely reach the kitchen sink', () => {
  const dishes = { table: 1, yardTable: 2 };
  const obstacles = placeObstacles('home');
  for (const role of ['vlad', 'alina'] as const) {
    const stops = dirtyDishStops(dishes, role);
    assert.deepEqual(stops[0], homeSeat('table', role).approach);
    assert.deepEqual(stops[1], homeSeat('yardTable', role).approach);
    let origin = { x: .48, z: 3.9 };
    for (const target of [...stops, KITCHEN_WORK.dishes.position]) {
      assert.ok(findRoute(origin, target, obstacles, HOME_FLOOR),
        'route exists to '+target.x+','+target.z+' for '+role);
      origin = target;
    }
  }
});

test('Actor can hold one lightweight plate while walking and releases it on cancel', () => {
  const actor = new Actor('vlad', [0, 0]);
  assert.equal(actor.hasDirtyPlate(), false);
  actor.carryDirtyPlate();
  actor.walkPath([new Vector3(1, 0, 0)], () => {});
  actor.update(1 / 60);
  assert.equal(actor.hasDirtyPlate(), true);
  actor.playDomesticActivity('dishes', new Vector3(.2, 1.09, -.4));
  actor.update(1 / 60);
  assert.equal(actor.hasDirtyPlate(), true);
  actor.clearProps();
  actor.setPose('idle');
  assert.equal(actor.hasDirtyPlate(), false);
});

test('Legacy household upgrades the dish field exactly once without resetting money or meals', () => {
  const dir = mkdtempSync(join(tmpdir(), 'simlife-dishes-'));
  try {
    const files = openServerFiles(dir);
    const old = initialState() as Omit<ReturnType<typeof initialState>, 'dirtyDishes'> &
      { dirtyDishes?: { table: number; yardTable: number } };
    delete old.dirtyDishes;
    old.money = 12450;
    old.meals.omelette = 2;
    writeFileSync(join(dir, 'household.json'), JSON.stringify(old));
    const upgraded = files.load();
    assert.deepEqual(upgraded.dirtyDishes, { table: 0, yardTable: 0 });
    assert.equal(upgraded.money, 12450);
    assert.equal(upgraded.meals.omelette, 2);
    const savedOnce = readFileSync(join(dir, 'household.json'), 'utf8');
    assert.deepEqual(files.load().dirtyDishes, { table: 0, yardTable: 0 });
    assert.equal(readFileSync(join(dir, 'household.json'), 'utf8'), savedOnce);
    upgraded.dirtyDishes.table = 4;
    files.save(upgraded);
    assert.equal(files.load().dirtyDishes.table, 4);
    const invalid = structuredClone(upgraded);
    invalid.dirtyDishes.table = -1;
    assert.throws(() => files.save(invalid), /invalid household/);
    assert.equal(files.load().dirtyDishes.table, 4);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

function packetWhen(ws: WebSocket, check: (packet: ServerPacket) => boolean): Promise<ServerPacket> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      ws.off('message', received);
      reject(new Error('Timed out waiting for shared dishes event'));
    }, 6000);
    function received(raw: RawData) {
      const packet = JSON.parse(raw.toString()) as ServerPacket;
      if (!check(packet)) return;
      ws.off('message', received);
      clearTimeout(timer);
      resolve(packet);
    }
    ws.on('message', received);
  });
}

async function joinHousehold(port: number, role: CharacterId, code: string): Promise<WebSocket> {
  const socket = new WebSocket('ws://127.0.0.1:' + port + '/sync');
  await once(socket, 'open');
  const result = packetWhen(socket, p => p.type === 'ready' || p.type === 'error');
  socket.send(JSON.stringify({ type: 'auth', role, code }));
  assert.equal((await result).type, 'ready');
  return socket;
}

test('Two online residents share one washing job, one reward and persistent clean tables', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'simlife-dishes-online-'));
  const files = openServerFiles(dir);
  const initial = initialState();
  initial.dirtyDishes = { table: 2, yardTable: 1 };
  files.save(initial);
  const server = await startServer({ port: 0, dataDir: dir, taskTimeScale: .065 });
  const sockets: WebSocket[] = [];
  try {
    const vlad = await joinHousehold(server.port, 'vlad', files.access.vlad);
    const alina = await joinHousehold(server.port, 'alina', files.access.alina);
    sockets.push(vlad, alina);
    const started = packetWhen(vlad, p => p.type === 'task_started' &&
      p.command.type === 'act' && p.command.actionId === 'kitchenDishes');
    vlad.send(JSON.stringify({ type: 'act', actionId: 'kitchenDishes' }));
    assert.equal((await started).type, 'task_started');
    const denied = packetWhen(alina, p => p.type === 'error' && p.reason.includes('занято'));
    alina.send(JSON.stringify({ type: 'act', actionId: 'kitchenDishes' }));
    assert.equal((await denied).type, 'error');

    const finishedV = packetWhen(vlad, p => p.type === 'snapshot' && dishCount(p.state.dirtyDishes) === 0);
    const finishedA = packetWhen(alina, p => p.type === 'snapshot' && dishCount(p.state.dirtyDishes) === 0);
    const [v, a] = await Promise.all([finishedV, finishedA]);
    assert.deepEqual(v, a);
    assert.equal(v.type, 'snapshot');
    assert.deepEqual(files.load().dirtyDishes, { table: 0, yardTable: 0 });

    const empty = packetWhen(alina, p => p.type === 'error' && p.reason.includes('Грязной посуды'));
    alina.send(JSON.stringify({ type: 'act', actionId: 'kitchenDishes' }));
    assert.equal((await empty).type, 'error');
    assert.deepEqual(files.load().dirtyDishes, { table: 0, yardTable: 0 });
  } finally {
    sockets.forEach(socket => socket.terminate());
    await server.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
