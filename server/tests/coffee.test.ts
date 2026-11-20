import assert from 'node:assert/strict';
import { test } from 'node:test';
import { once } from 'node:events';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import WebSocket, { type RawData } from 'ws';
import { COFFEE_CUPS_PER_DAY, COFFEE_DRINKS, COFFEE_MACHINE_TIERS, coffeeCupsToday } from '../../src/shared/coffee';
import { GROCERIES } from '../../src/shared/food';
import { MARKET_PRODUCTS } from '../../src/shared/market';
import { initialState, type CharacterId, type ServerPacket } from '../../src/shared/protocol';
import { brewInstantCoffee } from '../coffee';
import { applyFoodAction } from '../food';
import { planTask } from '../tasks';
import { openServerFiles } from '../storage';
import { startServer } from '../server';

test('Two instant coffees, three beans, and future machine tiers have consistent catalogue rules', () => {
  assert.deepEqual([GROCERIES.coffeeNescafeGold.price, GROCERIES.coffeeNescafeGold.quantity], [480, 15]);
  assert.deepEqual([GROCERIES.coffeeEgoiste.price, GROCERIES.coffeeEgoiste.quantity], [860, 25]);
  assert.deepEqual(['beansJardin', 'beansLavazza', 'beansBushido'].map(id =>
    GROCERIES[id as 'beansJardin' | 'beansLavazza' | 'beansBushido'].price), [2200, 2450, 2700]);
  const shelf = MARKET_PRODUCTS.filter(product => product.category === 'pantry' && (
    product.stockKey.startsWith('coffee') || product.stockKey.startsWith('beans')));
  assert.equal(shelf.length, 5, 'legacy coffee is hidden from new shelves');
  assert.equal(applyFoodAction(initialState(), 'vlad', {type:'buy',item:'coffee'}).ok, false);
  assert.deepEqual(Object.values(COFFEE_MACHINE_TIERS).map(tier => tier.energy), [15, 20, 25]);
  assert.equal(COFFEE_DRINKS.length, 7);
});

test('One shared pack is spent only at completion; the coffee cap is per character per game day', () => {
  const seed = initialState();
  seed.characters.vlad.energy = 50;
  seed.characters.alina.energy = 60;
  seed.pantry.coffeeNescafeGold = 3;
  seed.pantry.coffeeEgoiste = 2;
  seed.pantry.beansJardin = 30;
  assert.equal(planTask({type:'brew_coffee',blend:'coffeeNescafeGold'})?.durationMs, 12000);
  assert.equal(planTask({type:'brew_coffee',blend:'beansJardin'}), null);
  assert.equal(brewInstantCoffee(seed, 'vlad', 'coffeeNescafeGold').ok, true);
  assert.equal(seed.pantry.coffeeNescafeGold, 3, 'planning does not spend resources');
  let current = seed;
  for (let i=0;i<COFFEE_CUPS_PER_DAY;i++) {
    const brewed = brewInstantCoffee(current, 'vlad', 'coffeeNescafeGold');
    assert.ok(brewed.ok);
    current = brewed.state;
  }
  assert.equal(current.characters.vlad.energy, 80);
  assert.equal(current.pantry.coffeeNescafeGold, 0);
  assert.equal(coffeeCupsToday(current, 'vlad'), 3);
  const before = JSON.stringify(current);
  const denied = brewInstantCoffee(current, 'vlad', 'coffeeEgoiste');
  assert.ok(!denied.ok && /3 чашек/.test(denied.reason));
  assert.equal(JSON.stringify(current), before);
  const partner = brewInstantCoffee(current, 'alina', 'coffeeEgoiste');
  assert.ok(partner.ok);
  assert.equal(partner.state.characters.alina.energy, 70);
  assert.equal(partner.state.pantry.coffeeEgoiste, 1);
  assert.equal(coffeeCupsToday(partner.state, 'alina'), 1);
  assert.equal(coffeeCupsToday(partner.state, 'vlad'), 3);
  assert.equal(brewInstantCoffee(current, 'vlad', 'beansJardin').ok, false);
  assert.equal(partner.state.pantry.beansJardin, 30);
  partner.state.clock.day += 1;
  assert.equal(coffeeCupsToday(partner.state, 'vlad'), 0);
  const tomorrow = brewInstantCoffee(partner.state, 'vlad', 'coffeeEgoiste');
  assert.ok(tomorrow.ok);
  assert.equal(tomorrow.state.coffeeDaily.vlad.day, partner.state.clock.day);
  assert.equal(tomorrow.state.coffeeDaily.vlad.cups, 1);
});

test('Old household keeps progress and receives default coffee limits; new cup counts survive restart', () => {
  const dir = mkdtempSync(join(tmpdir(), 'sim-life-coffee-save-'));
  try {
    const files = openServerFiles(dir);
    const legacy = initialState();
    legacy.money = 6821;
    legacy.pantry.coffee = 9;
    delete (legacy as unknown as Record<string, unknown>).coffeeDaily;
    files.save(legacy);
    const restored = files.load();
    assert.equal(restored.money, 6821);
    assert.equal(restored.pantry.coffee, 9);
    assert.equal(coffeeCupsToday(restored, 'vlad'), 0);
    const first = brewInstantCoffee(restored, 'vlad', 'coffee');
    assert.ok(first.ok);
    files.save(first.state);
    const reload = files.load();
    assert.equal(reload.coffeeDaily.vlad.cups, 1);
    assert.equal(reload.pantry.coffee, 8);
  } finally { rmSync(dir, {recursive:true,force:true}); }
});

function waitFor(ws: WebSocket, accepts: (packet: ServerPacket) => boolean): Promise<ServerPacket> {
  return new Promise((resolve,reject) => {
    const timer = setTimeout(() => { ws.off('message',receive); reject(new Error('No coffee packet')); },4500);
    function receive(raw: RawData) {
      const packet = JSON.parse(raw.toString()) as ServerPacket;
      if (!accepts(packet)) return;
      clearTimeout(timer); ws.off('message',receive); resolve(packet);
    }
    ws.on('message', receive);
  });
}
async function enter(port: number, role: CharacterId, code: string): Promise<WebSocket> {
  const socket = new WebSocket('ws://127.0.0.1:'+port+'/sync');
  await once(socket,'open');
  const ready = waitFor(socket,packet => packet.type === 'ready' || packet.type === 'error');
  socket.send(JSON.stringify({type:'auth',role,code}));
  assert.equal((await ready).type,'ready');
  return socket;
}

test('Both players see the same coffee action; one brewer and one pantry prevent double consumption', async () => {
  const dir = mkdtempSync(join(tmpdir(),'sim-life-coffee-wire-'));
  const files = openServerFiles(dir);
  const seed = initialState();
  seed.pantry.coffeeEgoiste = 2;
  seed.characters.vlad.energy = 40;
  files.save(seed);
  const server = await startServer({port:0,dataDir:dir,taskTimeScale:.02});
  let vlad: WebSocket | undefined;
  let alina: WebSocket | undefined;
  try {
    vlad = await enter(server.port,'vlad',files.access.vlad);
    alina = await enter(server.port,'alina',files.access.alina);
    const startedVlad = waitFor(vlad,p => p.type==='task_started' && p.role==='vlad');
    const startedAlina = waitFor(alina,p => p.type==='task_started' && p.role==='vlad');
    vlad.send(JSON.stringify({type:'brew_coffee',blend:'coffeeEgoiste'}));
    const [a,b] = await Promise.all([startedVlad,startedAlina]);
    assert.deepEqual(a,b,'both clients get the same named activity and progress');
    const busy = waitFor(alina,p=>p.type==='error');
    alina.send(JSON.stringify({type:'brew_coffee',blend:'coffeeEgoiste'}));
    const rejection = await busy;
    assert.ok(rejection.type==='error' && /занято/.test(rejection.reason));
    const completed = await waitFor(alina,p=>p.type==='task_ended' && p.role==='vlad' && p.outcome==='completed');
    assert.equal(completed.type,'task_ended');
    const loaded = files.load();
    assert.equal(loaded.pantry.coffeeEgoiste,1);
    assert.equal(loaded.coffeeDaily.vlad.cups,1);
    assert.equal(loaded.characters.vlad.energy,50);
    assert.equal(loaded.coffeeDaily.alina.cups,0);
  } finally {
    vlad?.terminate(); alina?.terminate();
    await server.close();
    rmSync(dir,{recursive:true,force:true});
  }
});
