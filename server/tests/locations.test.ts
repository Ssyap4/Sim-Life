import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { applyWorld, localActivity } from '../locations';
import { advanceLife } from '../life';
import { openServerFiles } from '../storage';
import { beginShift } from '../jobs';
import { buildFurniture } from '../../src/game/InteriorArt';
import { createLocation } from '../../src/game/LocationScene';
import { findRoute, segmentIsClear } from '../../src/game/navigation';
import { Box3 } from 'three';
import { initialState, type GameState, type CharacterId } from '../../src/shared/protocol';
import { CAFE_MENU, DELIVERY_FEE, STATIONS, approachFor, floorFor, meeting, placeObstacles, spawn, type PlaceId } from '../../src/shared/locations';
import { GROCERIES } from '../../src/shared/food';

const send = (state: GameState, role: CharacterId, command: Record<string, unknown>) => {
  const result = applyWorld(state, role, command);
  if (!result.ok) assert.fail(result.reason);
  return result.state;
};
const at = (state: GameState, role: CharacterId, station: string) =>
  send(state, role, { type: 'approach', place: state.world.places[role], station });
const travel = (state: GameState, role: CharacterId, place: PlaceId, dog = false) =>
  send(state, role, { type: 'travel', place, dog });

test('Both spawns and every physical station are reachable in all five scenes', () => {
  for (const [place, stations] of Object.entries(STATIONS) as [PlaceId, typeof STATIONS.home][]) {
    const obstacles = placeObstacles(place);
    if (place === 'home') {
      buildFurniture((id, group) => {
        if (id === 'shower') return;
        group.updateMatrixWorld(true);
        const b = new Box3().setFromObject(group);
        obstacles.push({ minX: b.min.x - .27, maxX: b.max.x + .27, minZ: b.min.z - .27, maxZ: b.max.z + .27 });
      });
    } else {
      const scene = createLocation(place);
      assert.equal(scene.stations.size, stations.length);
      let disposed = 0;
      scene.root.traverse(object => {
        if ('geometry' in object) (object.geometry as import('three').BufferGeometry).addEventListener('dispose', () => disposed++);
      });
      scene.dispose();
      assert.equal(scene.root.children.length, 0);
      assert.ok(disposed > 0);
    }
    for (const role of ['vlad', 'alina'] as const) {
      const ends = [...stations.map(station => approachFor(station, role)), meeting(place, role)];
      for (const start of [spawn(place, role), ...ends]) for (const end of ends)
        assert.ok(findRoute(start, end, obstacles, floorFor(place)), JSON.stringify({ place, start, end }));
    }
  }
});

test('Both residents can save in the yard and walk back through the house threshold', () => {
  const dir = mkdtempSync(join(tmpdir(), 'sim-life-yard-'));
  try {
    const files = openServerFiles(dir);
    const floor = floorFor('home');
    const obstacles = placeObstacles('home');
    let state = initialState();
    for (const [role, point] of [['vlad', { x: -3, z: 9.3 }], ['alina', { x: 3.9, z: 8.6 }]] as const) {
      const inside = state.characters[role];
      assert.equal(segmentIsClear({ x: point.x, z: 4.4 }, point, obstacles, floor), false);
      const result = applyWorld(state, role, { type: 'walk', place: 'home', ...point });
      assert.ok(result.ok && result.path);
      assert.deepEqual(result.path.at(-1), point);
      assert.ok(result.path.every((end, index, path) => segmentIsClear(path[index - 1] ?? inside, end, obstacles, floor)));
      state = result.state;
    }
    files.save(state);
    state = files.load();
    assert.equal(state.characters.vlad.z, 9.3);
    assert.equal(state.characters.alina.z, 8.6);
    assert.deepEqual(state.world.places, { vlad: 'home', alina: 'home' });
    for (const role of ['vlad', 'alina'] as const) {
      assert.ok(applyWorld(state, role, { type: 'approach', place: 'home', station: 'fridge' }).ok);
      assert.equal(applyWorld(state, role, { type: 'walk', place: 'home', x: 0, z: 13 }).ok, false);
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('A paid store basket changes the shared pantry once and unpacking never grants a second copy', () => {
  const cart = { type: 'store_pay', sequence: 0, lines: [{ id: 'grocery:milk', quantity: 1 }] };
  let state = initialState();
  assert.equal(applyWorld(state, 'vlad', cart).ok, false);
  state = travel(state, 'vlad', 'market');
  assert.equal(state.world.places.alina, 'home');
  assert.equal(applyWorld(state, 'vlad', cart).ok, false);
  state = at(state, 'vlad', 'checkout');
  const before = state.money;
  state = send(state, 'vlad', cart);
  assert.equal(state.money, before - GROCERIES.milk.price);
  assert.equal(state.pantry.milk, GROCERIES.milk.quantity);
  assert.equal(applyWorld(state, 'vlad', cart).ok, false);
  assert.equal(applyWorld(state, 'vlad', { ...cart, sequence: 1, lines: [{ id: 'grocery:beef', quantity: 10 }] }).ok, false);
  state = travel(state, 'vlad', 'home');
  assert.equal(state.world.bags.vlad, 0, 'carried bag is put down on entering home');
  assert.equal(state.world.tableBags, 1);
  assert.equal(localActivity(state, 'vlad', 'unpack', 'parcel').ok, false, 'unpacking is at the table, not the door');
  state = at(state, 'alina', 'shopping-table');
  const unpacked = localActivity(state, 'alina', 'unpack', 'shopping-table');
  assert.ok(unpacked.ok, 'either resident can unpack shared shopping');
  assert.equal(unpacked.state.world.tableBags, 0);
  assert.deepEqual(unpacked.state.pantry, state.pantry);
  assert.equal(localActivity(unpacked.state, 'alina', 'unpack', 'shopping-table').ok, false);
});

test('Several trips leave shared shopping on the table until either resident unpacks', () => {
  let state = initialState();
  for (let n = 0; n < 2; n++) {
    state = at(travel(state, 'vlad', 'market'), 'vlad', 'checkout');
    state = send(state, 'vlad', { type: 'store_pay', sequence: n,
      lines: [{ id: 'grocery:bread', quantity: 1 }] });
    assert.equal(state.world.bags.vlad, 1);
    state = travel(state, 'vlad', 'street');
    assert.equal(state.world.bags.vlad, 1, 'bag remains carried outside home');
    state = travel(state, 'vlad', 'home');
    assert.equal(state.world.bags.vlad, 0);
    assert.equal(state.world.tableBags, n + 1);
  }
  const bread = state.pantry.bread;
  const money = state.money;
  state = at(state, 'alina', 'shopping-table');
  const unpacked = localActivity(state, 'alina', 'unpack', 'shopping-table');
  assert.ok(unpacked.ok);
  assert.equal(unpacked.state.world.tableBags, 0);
  assert.equal(unpacked.state.money, money);
  assert.equal(unpacked.state.pantry.bread, bread);
});

test('Earlier saves move stuck home bags to the table once, without losing stock', () => {
  const dir = mkdtempSync(join(tmpdir(), 'sim-life-bag-migration-'));
  try {
    const files = openServerFiles(dir);
    const legacy = initialState();
    legacy.world.bags = { vlad: 2, alina: 1 };
    legacy.world.places.alina = 'market';
    legacy.pantry.milk = 5;
    delete (legacy.world as Partial<typeof legacy.world>).tableBags;
    writeFileSync(join(dir, 'household.json'), JSON.stringify(legacy));
    const migrated = files.load();
    assert.equal(migrated.world.bags.vlad, 0);
    assert.equal(migrated.world.bags.alina, 1);
    assert.equal(migrated.world.tableBags, 2);
    assert.equal(migrated.pantry.milk, 5);
    files.save(migrated);
    const reloaded = files.load();
    assert.equal(reloaded.world.tableBags, 2, 'migration is idempotent');
    const back = travel(reloaded, 'alina', 'home');
    assert.equal(back.world.tableBags, 3);
    assert.equal(back.world.bags.alina, 0);
    assert.equal(back.pantry.milk, 5);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('A paid delivery survives restart and a full fridge, then can be collected once', () => {
  const dir = mkdtempSync(join(tmpdir(), 'sim-life-delivery-'));
  try {
    const start = initialState();
    const queued = send(start, 'vlad', { type: 'delivery_order', sequence: 0, lines: [{ id: 'grocery:milk', quantity: 1 }] });
    assert.equal(queued.money, start.money - GROCERIES.milk.price - DELIVERY_FEE);
    assert.equal(queued.pantry.milk, 0);
    const [order] = queued.world.deliveries;
    const take = { type: 'delivery_claim', id: order.id };
    assert.equal(applyWorld(at(queued, 'alina', 'parcel'), 'alina', take).ok, false);
    const progressed = advanceLife(queued, 24, ['alina']);
    progressed.meals.omelette = 30;
    progressed.pantry.eggs = 60;
    openServerFiles(dir).save(progressed);
    let state = openServerFiles(dir).load();
    assert.equal(state.world.deliveries[0].id, order.id);
    state = at(state, 'alina', 'parcel');
    assert.equal(applyWorld(state, 'alina', take).ok, false);
    assert.equal(state.world.deliveries.length, 1);
    state.meals.omelette = 28;
    state = send(state, 'alina', take);
    assert.equal(state.pantry.milk, GROCERIES.milk.quantity);
    assert.equal(state.money, queued.money);
    assert.equal(applyWorld(state, 'alina', take).ok, false);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('Two cafe orders, a shared table and one leash retain independent state', () => {
  let s = initialState();
  for (const role of ['vlad', 'alina'] as const) {
    s = at(travel(s, role, 'cafe'), role, 'terminal');
    s = send(s, role, { type: 'cafe_order', item: 'cappuccino', sequence: 0 });
  }
  assert.equal(s.money, 2500 - CAFE_MENU.cappuccino.price * 2);
  s = advanceLife(s, 3, ['vlad', 'alina']);
  for (const role of ['vlad', 'alina'] as const) {
    s = send(at(s, role, 'pickup'), role, { type: 'cafe_pickup' });
    s = at(s, role, 'cafe-left');
    const meal = localActivity(s, role, 'dine', 'cafe-left');
    assert.ok(meal.ok);
    assert.ok(meal.state.characters[role].hunger > s.characters[role].hunger);
    s = meal.state;
    assert.equal(s.world.cafe[role], undefined);
  }
  s = travel(travel(s, 'vlad', 'home'), 'vlad', 'park', true);
  assert.equal(s.world.dogWalker, 'vlad');
  s = at(travel(s, 'alina', 'park'), 'alina', 'park-dog');
  assert.equal(applyWorld(s, 'alina', { type: 'dog_leash' }).ok, false);
  const play = localActivity(s, 'alina', 'dog', 'park-dog');
  assert.ok(play.ok);
  assert.ok(play.state.pets.verdell.bond > s.pets.verdell.bond);
  s = travel(play.state, 'vlad', 'home');
  assert.equal(s.world.dogWalker, null);
  const shift = beginShift(s, 'vlad', 'taxi');
  assert.ok(shift.ok);
  assert.equal(applyWorld(shift.state, 'vlad', { type: 'travel', place: 'park' }).ok, false);
});

test('Old saves acquire home locations without changing economy, jobs or pets', () => {
  const dir = mkdtempSync(join(tmpdir(), 'sim-life-migrate-location-'));
  try {
    const start = initialState();
    start.money = 4321;
    start.pantry.milk = 7;
    start.pets.verdell.bond = 73;
    start.characters.alina.skill = 48;
    const shift = beginShift(start, 'vlad', 'taxi');
    assert.ok(shift.ok);
    const { world: _removed, ...old } = shift.state;
    writeFileSync(join(dir, 'household.json'), JSON.stringify(old));
    const recovered = openServerFiles(dir).load();
    const { world, ...payload } = recovered;
    assert.deepEqual(payload, old);
    assert.deepEqual(world.places, { vlad: 'home', alina: 'home' });
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
