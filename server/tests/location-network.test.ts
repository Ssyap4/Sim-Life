import assert from 'node:assert/strict';
import { once } from 'node:events';
import test from 'node:test';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import WebSocket from 'ws';
import { startServer, type RunningServer } from '../server';
import { openServerFiles } from '../storage';
import { GROCERIES } from '../../src/shared/food';
import { initialState, type ServerPacket } from '../../src/shared/protocol';

async function connection(port: number) {
  const socket = new WebSocket('ws://127.0.0.1:' + port + '/sync');
  const inbox: ServerPacket[] = [];
  socket.on('message', raw => inbox.push(JSON.parse(raw.toString())));
  await once(socket, 'open');
  return {
    socket,
    send(packet: object) { socket.send(JSON.stringify(packet)); },
    async next<K extends ServerPacket['type']>(type: K,
      match: (packet: Extract<ServerPacket, { type: K }>) => boolean = () => true): Promise<Extract<ServerPacket, { type: K }>> {
      for (let i = 0; i < 200; i++) {
        const at = inbox.findIndex(packet => packet.type === type && match(packet as Extract<ServerPacket, { type: K }>));
        if (at >= 0) return inbox.splice(at, 1)[0] as Extract<ServerPacket, { type: K }>;
        await new Promise(resolve => setTimeout(resolve, 10));
      }
      assert.fail('No ' + type + '; received: ' + inbox.map(packet => packet.type).join(', '));
    },
    async close() {
      if (socket.readyState === WebSocket.CLOSED) return;
      const closed = once(socket, 'close');
      socket.close();
      await closed;
    },
  };
}

test('Two live clients can shop and cook in different places, reconnect at the saved location, and socialize only together', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'sim-life-world-network-'));
  let server: RunningServer | null = null;
  try {
    // This integration scenario cooks an omelette. Since 0.19 it requires
    // cooking level 2, so give Alina that skill without changing the shop flow.
    const seed = initialState();
    seed.education.characters.alina.xp.cooking = 200;
    openServerFiles(dir).save(seed);
    server = await startServer({ port: 0, dataDir: dir, taskTimeScale: 0.01 });
    const keys = JSON.parse(readFileSync(join(dir, 'access.json'), 'utf8'));
    const vlad = await connection(server.port);
    const alina = await connection(server.port);
    vlad.send({ type: 'auth', role: 'vlad', code: keys.vlad, remember: true });
    alina.send({ type: 'auth', role: 'alina', code: keys.alina });
    await alina.next('ready');
    await vlad.next('ready');
    const { token } = await vlad.next('device_token');
    assert.ok(!readFileSync(join(dir, 'trusted-devices.json'), 'utf8').includes(token));
    vlad.send({ type: 'approach', place: 'home', station: 'fridge' });
    await alina.next('world_path', p => p.role === 'vlad' && p.station === 'fridge');
    vlad.send({ type: 'close_storage' });
    await alina.next('storage_event', p => p.role === 'vlad' && !p.station);
    vlad.send({ type: 'travel', place: 'market' });
    await alina.next('snapshot', p => p.state.world.places.vlad === 'market' && p.state.world.places.alina === 'home');
    vlad.send({ type: 'social_offer', kind: 'hug' });
    await vlad.next('error', p => p.reason.includes('локации'));
    vlad.send({ type: 'approach', place: 'market', station: 'checkout' });
    await vlad.next('world_path', p => p.station === 'checkout' && p.path.length > 0);
    const pay = { type: 'store_pay', sequence: 0, lines: [{ id: 'grocery:milk', quantity: 1 }] };
    vlad.send(pay);
    vlad.send(pay);
    const shared = await alina.next('snapshot', p => p.state.pantry.milk === GROCERIES.milk.quantity);
    assert.equal(shared.state.money, 10000 - GROCERIES.milk.price);
    await vlad.next('error', p => p.reason.includes('уже обработана'));
    alina.send({ type: 'cook', recipe: 'omelette' });
    await vlad.next('task_started', p => p.role === 'alina' && p.command.type === 'cook');
    await vlad.close();
    await alina.next('task_ended', p => p.role === 'alina' && p.outcome === 'completed');
    await alina.close();
    await server.close();
    server = await startServer({ port: 0, dataDir: dir, taskTimeScale: 0.01 });
    const wrongRole = await connection(server.port);
    wrongRole.send({ type: 'resume', role: 'alina', token });
    await wrongRole.next('error');
    await wrongRole.close();
    const resumed = await connection(server.port);
    resumed.send({ type: 'resume', role: 'vlad', token });
    const ready = await resumed.next('ready');
    assert.equal(ready.state.world.places.vlad, 'market');
    assert.ok(ready.state.meals.omelette > 0);
    resumed.send({ type: 'forget_device' });
    await once(resumed.socket, 'close');
    const forgotten = await connection(server.port);
    forgotten.send({ type: 'resume', role: 'vlad', token });
    await forgotten.next('error', p => p.reason.includes('истекло'));
    await forgotten.close();
  } finally {
    await server?.close();
    rmSync(dir, { recursive: true, force: true });
  }
});

test('Two supermarket checkouts cannot both spend the last rubles', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'sim-life-world-checkout-'));
  let server: RunningServer | null = null;
  try {
    const start = initialState();
    start.money = GROCERIES.milk.price;
    openServerFiles(dir).save(start);
    const running = await startServer({ port: 0, dataDir: dir });
    server = running;
    const keys = JSON.parse(readFileSync(join(dir, 'access.json'), 'utf8'));
    const shoppers = await Promise.all((['vlad', 'alina'] as const).map(async role => {
      const shopper = await connection(running.port);
      shopper.send({ type: 'auth', role, code: keys[role] });
      await shopper.next('ready');
      shopper.send({ type: 'travel', place: 'market' });
      await shopper.next('snapshot', packet => packet.state.world.places[role] === 'market');
      shopper.send({ type: 'approach', place: 'market', station: 'checkout' });
      await shopper.next('world_path', packet => packet.role === role && packet.station === 'checkout');
      return shopper;
    }));
    for (const shopper of shoppers)
      shopper.send({ type: 'store_pay', sequence: 0, lines: [{ id: 'grocery:milk', quantity: 1 }] });
    const states = await Promise.all(shoppers.map(shopper => shopper.next('snapshot', packet => packet.state.money === 0)));
    assert.deepEqual(states[0].state, states[1].state);
    const { pantry, world } = states[0].state;
    assert.equal(pantry.milk, GROCERIES.milk.quantity);
    assert.equal(world.bags.vlad + world.bags.alina, 1);
    const loser = world.bags.vlad ? shoppers[1] : shoppers[0];
    await loser.next('error', packet => packet.reason.includes('Недостаточно денег'));
    await Promise.all(shoppers.map(shopper => shopper.close()));
  } finally {
    await server?.close();
    rmSync(dir, { recursive: true, force: true });
  }
});

test('Groceries vanish on reaching home and both clients share stock without a dining table', async()=>{
  const dir=mkdtempSync(join(tmpdir(),'sim-life-auto-grocery-network-'));
  let server:RunningServer|null=null;
  try{
    const initial=initialState();
    initial.furnishing.soldFixtures=['table'];
    initial.money=10000;
    const beforeMilk=initial.pantry.milk,beforeBread=initial.pantry.bread;
    openServerFiles(dir).save(initial);
    server=await startServer({port:0,dataDir:dir,taskTimeScale:.02});
    const keys=JSON.parse(readFileSync(join(dir,'access.json'),'utf8'));
    const vlad=await connection(server.port);
    const alina=await connection(server.port);
    vlad.send({type:'auth',role:'vlad',code:keys.vlad});
    alina.send({type:'auth',role:'alina',code:keys.alina});
    await vlad.next('ready');await alina.next('ready');
    vlad.send({type:'travel',place:'market'});
    await alina.next('snapshot',p=>p.state.world.places.vlad==='market');
    vlad.send({type:'approach',place:'market',station:'checkout'});
    await vlad.next('world_path',p=>p.station==='checkout');
    vlad.send({type:'store_pay',sequence:0,
      lines:[{id:'grocery:milk',quantity:1},{id:'grocery:bread',quantity:1}]});
    const paid=await alina.next('snapshot',p=>p.state.world.bags.vlad===1);
    const price=GROCERIES.milk.price+GROCERIES.bread.price;
    assert.equal(paid.state.money,10000-price);
    assert.equal(paid.state.pantry.milk,beforeMilk+GROCERIES.milk.quantity);
    assert.equal(paid.state.pantry.bread,beforeBread+GROCERIES.bread.quantity);
    assert.equal(paid.state.world.tableBags,0);
    vlad.send({type:'travel',place:'home'});
    await alina.next('snapshot',p=>p.state.world.places.vlad==='home'&&p.state.world.bags.vlad===1);
    vlad.send({type:'approach',place:'home',station:'home-doorstep'});
    const arrived=await alina.next('snapshot',p=>p.state.world.places.vlad==='home'&&p.state.world.bags.vlad===0);
    assert.equal(arrived.state.world.tableBags,0);
    assert.equal(arrived.state.money,paid.state.money,'no charge on return');
    assert.deepEqual(arrived.state.pantry,paid.state.pantry,'no duplicate stock on return');
    assert.equal(arrived.state.furnishing.soldFixtures?.includes('table'),true);
    vlad.send({type:'approach',place:'home',station:'shopping-table'});
    await vlad.next('error',p=>p.reason.includes('объект'));
    await vlad.close();await alina.close();
    await server.close();server=null;
    const persisted=openServerFiles(dir).load();
    assert.equal(persisted.world.tableBags,0);
    assert.deepEqual(persisted.world.bags,{vlad:0,alina:0});
    assert.equal(persisted.money,10000-price);
    assert.equal(persisted.pantry.milk,beforeMilk+GROCERIES.milk.quantity);
  }finally{await server?.close();rmSync(dir,{recursive:true,force:true});}
});
