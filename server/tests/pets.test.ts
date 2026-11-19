import { test } from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import WebSocket, { type RawData } from 'ws';
import { initialState, type CharacterId, type ServerPacket } from '../../src/shared/protocol';
import { applyPetAction } from '../pets';
import { openServerFiles } from '../storage';
import { startServer } from '../server';

test('Two pets have separate care supplies; buying, feeding and bonding keep money and stats valid', () => {
  const original = initialState();
  original.petFood.verdell = 0;
  original.pets.verdell.satiety = 45;
  const empty = applyPetAction(original, 'vlad', 'verdell', 'feed');
  assert.equal(empty.ok, false);
  assert.equal(original.money, 2500);

  const purchase = applyPetAction(original, 'vlad', 'verdell', 'buyFood');
  assert.equal(purchase.ok, true);
  if (!purchase.ok) return;
  assert.equal(purchase.state.money, 2455);
  assert.equal(purchase.state.petFood.verdell, 3);
  assert.equal(purchase.state.petFood.simba, 2);
  const feeding = applyPetAction(purchase.state, 'alina', 'verdell', 'feed');
  assert.equal(feeding.ok, true);
  if (!feeding.ok) return;
  assert.equal(feeding.state.petFood.verdell, 2);
  assert.equal(feeding.state.pets.verdell.satiety, 72);
  assert.equal(feeding.state.pets.simba.satiety, original.pets.simba.satiety);

  const play = applyPetAction(feeding.state, 'vlad', 'verdell', 'play');
  assert.equal(play.ok, true);
  if (!play.ok) return;
  assert.ok(play.state.pets.verdell.bond > original.pets.verdell.bond);
  assert.equal(play.state.characters.vlad.energy, 77);
  assert.equal(play.state.revision, 3);

  assert.equal(applyPetAction(original, 'vlad', '__proto__', 'feed').ok, false);
  assert.equal(applyPetAction(original, 'vlad', 'simba', '__proto__').ok, false);
  const broke = structuredClone(original);
  broke.money = 0;
  assert.equal(applyPetAction(broke, 'vlad', 'simba', 'buyFood').ok, false);
  assert.equal(original.petFood.verdell, 0);
});

test('Loading an earlier family save adds both pets without resetting money, skills or food', () => {
  const dir = mkdtempSync(join(tmpdir(), 'sim-life-pet-migration-'));
  try {
    const files = openServerFiles(dir);
    const old = initialState();
    old.money = 7280;
    old.characters.alina.skill = 64;
    old.pantry.eggs = 9;
    old.revision = 31;
    const legacy = { ...old, pets: undefined, petFood: undefined };
    writeFileSync(join(dir, 'household.json'), JSON.stringify(legacy));
    const loaded = files.load();
    assert.equal(loaded.money, 7280);
    assert.equal(loaded.revision, 31);
    assert.equal(loaded.pantry.eggs, 9);
    assert.equal(loaded.characters.alina.skill, 64);
    assert.equal(loaded.pets.verdell.satiety, 72);
    assert.equal(loaded.pets.simba.happiness, 76);
    assert.equal(loaded.petFood.verdell, 2);
    files.save(loaded);
    assert.equal(files.load().pets.simba.bond, loaded.pets.simba.bond);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

function next(socket: WebSocket, when: (p: ServerPacket) => boolean): Promise<ServerPacket> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => { socket.off('message', receive); reject(new Error('Pet event timeout')); }, 3000);
    function receive(raw: RawData): void {
      const event = JSON.parse(raw.toString()) as ServerPacket;
      if (!when(event)) return;
      clearTimeout(timeout);
      socket.off('message', receive);
      resolve(event);
    }
    socket.on('message', receive);
  });
}
async function connect(port: number, role: CharacterId, code: string): Promise<WebSocket> {
  const ws = new WebSocket('ws://127.0.0.1:' + port + '/sync');
  await once(ws, 'open');
  const login = next(ws, (p) => p.type === 'ready' || p.type === 'error');
  ws.send(JSON.stringify({ type: 'auth', role, code }));
  assert.equal((await login).type, 'ready');
  return ws;
}
test('Care actions from Vlad and Alina synchronize as a single shared pet family', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'sim-life-pet-network-'));
  const server = await startServer({ port: 0, dataDir: dir });
  const sockets: WebSocket[] = [];
  try {
    const codes = JSON.parse(readFileSync(join(dir, 'access.json'), 'utf8')) as Record<CharacterId, string>;
    const v = await connect(server.port, 'vlad', codes.vlad);
    const a = await connect(server.port, 'alina', codes.alina);
    sockets.push(v, a);
    const vFinal = next(v, (p) => p.type === 'snapshot' && p.state.revision === 2);
    const aFinal = next(a, (p) => p.type === 'snapshot' && p.state.revision === 2);
    v.send(JSON.stringify({ type: 'pet_action', pet: 'verdell', action: 'buyFood' }));
    a.send(JSON.stringify({ type: 'pet_action', pet: 'simba', action: 'pet' }));
    const [vs, as] = await Promise.all([vFinal, aFinal]);
    assert.deepEqual(vs, as);
    assert.equal(vs.type, 'snapshot');
    if (vs.type === 'snapshot') {
      assert.equal(vs.state.money, 2455);
      assert.equal(vs.state.petFood.verdell, 5);
      assert.equal(vs.state.pets.simba.bond, 38);
      assert.equal(vs.state.characters.alina.mood, 84);
    }
    const rejected = next(v, (p) => p.type === 'error');
    v.send(JSON.stringify({ type: 'pet_action', pet: 'verdell', action: 'buyFood' }));
    assert.equal((await rejected).type, 'error');
    const saved = JSON.parse(readFileSync(join(dir, 'household.json'), 'utf8')) as { revision: number };
    assert.equal(saved.revision, 2);
  } finally {
    sockets.forEach((ws) => ws.terminate());
    await server.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
