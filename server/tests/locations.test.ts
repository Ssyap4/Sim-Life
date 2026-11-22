import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtempSync, rmSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { applyWorld, localActivity } from '../locations';
import { advanceLife } from '../life';
import { openServerFiles } from '../storage';
import { beginShift } from '../jobs';
import { buildFurniture } from '../../src/game/InteriorArt';
import { createLocation } from '../../src/game/LocationScene';
import { findRoute, pointIsClear, segmentIsClear } from '../../src/game/navigation';
import { Box3, LineSegments, Mesh, Sprite } from 'three';
import { initialState, type GameState, type CharacterId } from '../../src/shared/protocol';
import { CAFE_MENU, DELIVERY_FEE, STATIONS, approachFor, floorFor, meeting, placeObstacles, spawn, type PlaceId } from '../../src/shared/locations';
import { CASHIER_SPOT } from '../../src/shared/locationLayout';
import { DISTRICT_BEDS, DISTRICT_FOUNTAIN, DISTRICT_TREES, districtArrival } from '../../src/shared/district';
import { doorwayArrival } from '../../src/shared/locations';
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

test('Both spawns and every physical station are reachable in every scene', () => {
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

test('The unified district routes both residents around its landmarks and through every doorway', () => {
  const stage = createLocation('street');
  const jets = stage.root.getObjectByName('Fountain streams');
  assert.ok(jets instanceof LineSegments);
  stage.animate?.(2);
  assert.ok(jets.rotation.y > 0);
  let disposed = false;
  jets.geometry.addEventListener('dispose', () => { disposed = true; });
  stage.dispose();
  assert.ok(disposed);

  const floor = floorFor('street');
  const obstacles = placeObstacles('street');
  let state = initialState();
  for (const role of ['vlad', 'alina'] as const) {
    state = travel(state, role, 'street');
    const start = spawn('street', role);
    assert.deepEqual({ x: state.characters[role].x, z: state.characters[role].z }, start);
    for (const { x, z } of [DISTRICT_FOUNTAIN, ...DISTRICT_BEDS, ...DISTRICT_TREES.map(([x,z])=>({x,z}))]) {
      assert.equal(applyWorld(state, role, { type: 'walk', place: 'street', x, z }).ok, false);
    }
    const target = { x: -11.00, z: -6.15 };
    assert.equal(segmentIsClear(start, target, obstacles, floor), false);
    const walk = applyWorld(state, role, { type: 'walk', place: 'street', ...target });
    assert.ok(walk.ok && walk.path && walk.path.length > 1);
    assert.ok(walk.path.every((end, index, path) => segmentIsClear(path[index - 1] ?? start, end, obstacles, floor)));
    state = walk.state;
    for (const station of STATIONS.street) {
      if (station.action.kind !== 'door') continue;
      const destination = station.action.destination;
      state = send(at(state, role, station.id), role, { type: 'travel', place: destination, via: station.id });
      assert.equal(state.world.places[role], destination);
      assert.deepEqual({ x: state.characters[role].x, z: state.characters[role].z }, doorwayArrival(destination,'street',role));
      const exit = STATIONS[destination].find(item => item.action.kind === 'door' && item.action.destination === 'street');
      assert.ok(exit);
      state = send(at(state, role, exit.id), role, { type: 'travel', place: 'street', via: exit.id });
      assert.deepEqual({x:state.characters[role].x,z:state.characters[role].z},districtArrival(destination,role));
    }
  }
});

test('The decoration stays behind checkout and leaves the shopper approach open', () => {
  const market = createLocation('market');
  const cashier = market.root.getObjectByName('Cashier');
  assert.ok(cashier);
  assert.ok(cashier.getObjectByName('Кассир') instanceof Sprite);
  assert.ok(![...market.stations.values()].some(station => station === cashier));
  const checkout = market.stations.get('checkout');
  const cashierBody = cashier.children.find(child => child instanceof Mesh);
  assert.ok(checkout && cashierBody);
  assert.ok(new Box3().setFromObject(cashierBody).max.z < new Box3().setFromObject(checkout).min.z);
  market.dispose();
});

test('A 0.6 save relocates only residents standing on the new fountain or cashier', () => {
  const dir = mkdtempSync(join(tmpdir(), 'sim-life-plaza-migration-'));
  try {
    const files = openServerFiles(dir);
    let legacy = travel(travel(initialState(), 'vlad', 'street'), 'alina', 'market');
    legacy = send(at(legacy, 'alina', 'checkout'), 'alina', {
      type: 'store_pay', sequence: 0, lines: [{ id: 'grocery:milk', quantity: 1 }],
    });
    legacy.characters.vlad = { ...legacy.characters.vlad, x: DISTRICT_FOUNTAIN.x, z: DISTRICT_FOUNTAIN.z };
    legacy.characters.alina = { ...legacy.characters.alina, x: CASHIER_SPOT.x, z: CASHIER_SPOT.z };
    files.save(legacy);
    const restored = files.load();
    for (const role of ['vlad', 'alina'] as const) {
      const place = legacy.world.places[role];
      const { x, z } = restored.characters[role];
      assert.ok(pointIsClear({ x, z }, placeObstacles(place), floorFor(place)));
      legacy.characters[role].x = x;
      legacy.characters[role].z = z;
    }
    assert.deepEqual(restored, legacy);
    const edge = { x: -.25, z: 5.22 };
    const expanded = send(restored, 'vlad', { type: 'walk', place: 'street', ...edge });
    files.save(expanded);
    assert.deepEqual(files.load(), expanded);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('A 0.20 household on the old plaza keeps its progress and wakes at the corresponding district entrance',()=>{
  const dir=mkdtempSync(join(tmpdir(),'sim-life-district-migration-'));
  try {
    const old=travel(initialState(),'vlad','street');
    delete old.world.districtLayout;
    Object.assign(old.characters.vlad,{x:.11,z:-3.25,skill:47});
    old.money=7357;
    old.pantry.milk=8;
    const files=openServerFiles(dir);
    files.save(old);
    const restored=files.load();
    assert.equal(restored.world.districtLayout,1);
    assert.equal(restored.world.places.vlad,'street');
    assert.deepEqual({x:restored.characters.vlad.x,z:restored.characters.vlad.z},districtArrival('market','vlad'));
    assert.equal(restored.characters.vlad.skill,47);
    assert.equal(restored.money,7357);
    assert.deepEqual(restored.pantry,old.pantry);
    assert.deepEqual(restored.furnishing,old.furnishing);
    assert.deepEqual(files.load(),restored);
  } finally {rmSync(dir,{recursive:true,force:true});}
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

test('Paid store goods auto-store at home with no packets, table, duplicate grant or extra charge', () => {
  const cart = { type: 'store_pay', sequence: 0, lines: [
    { id: 'grocery:milk', quantity: 1 },{id:'grocery:bread',quantity:1},
  ]};
  let state=initialState();
  state.furnishing.soldFixtures=['table'];
  state.money=2500;
  assert.equal(applyWorld(state,'vlad',cart).ok,false);
  state=travel(state,'vlad','market');
  assert.equal(applyWorld(state,'vlad',cart).ok,false);
  state=at(state,'vlad','checkout');
  const before=state.money;
  state=send(state,'vlad',cart);
  assert.equal(state.money,before-GROCERIES.milk.price-GROCERIES.bread.price);
  assert.equal(state.pantry.milk,initialState().pantry.milk+GROCERIES.milk.quantity);
  assert.equal(state.pantry.bread,initialState().pantry.bread+GROCERIES.bread.quantity);
  assert.equal(state.world.bags.vlad,1,'one grocery bag carried from the checkout');
  assert.equal(state.world.tableBags,0,'no groceries staged on dining table');
  assert.equal(applyWorld(state,'vlad',cart).ok,false,'cannot pay same basket twice');
  const groceries=structuredClone(state.pantry),cash=state.money;
  state=travel(state,'vlad','home');
  assert.equal(state.world.bags.vlad,0);
  assert.equal(state.world.tableBags,0);
  assert.deepEqual(state.pantry,groceries,'the fridge/cupboard stock was already paid for');
  assert.equal(state.money,cash,'returning home never charges again');
  assert.equal(applyWorld(state,'alina',{type:'approach',place:'home',
    station:'shopping-table'}).ok,false,'the removed unpack waypoint is not interactable');
  assert.equal(localActivity(state,'alina','unpack','shopping-table').ok,false);
});

test('Several store visits accumulate shared food but never leave table packets', () => {
  let state=initialState();
  state.furnishing.soldFixtures=['table'];
  for(let n=0;n<2;n++){
    state=at(travel(state,'vlad','market'),'vlad','checkout');
    state=send(state,'vlad',{type:'store_pay',sequence:n,
      lines:[{id:'grocery:bread',quantity:1}]});
    assert.equal(state.world.bags.vlad,1);
    state=travel(state,'vlad','street');
    assert.equal(state.world.bags.vlad,1,'carry bag outside until reaching home');
    state=travel(state,'vlad','home');
    assert.equal(state.world.bags.vlad,0);
    assert.equal(state.world.tableBags,0);
    assert.equal(state.pantry.bread,initialState().pantry.bread+GROCERIES.bread.quantity*(n+1));
  }
  assert.equal(localActivity(state,'alina','unpack','shopping-table').ok,false);
});

test('Older saves discard staged bag models but keep stock, away carriers and one-time backup', () => {
  const dir=mkdtempSync(join(tmpdir(),'sim-life-bag-migration-'));
  try{
    const files=openServerFiles(dir);
    const legacy=initialState();
    legacy.world.tableBags=3;
    legacy.world.bags={vlad:2,alina:1};
    legacy.world.places.alina='market';
    legacy.pantry.milk=5;
    legacy.money=5124;
    writeFileSync(join(dir,'household.json'),JSON.stringify(legacy));
    const migrated=files.load();
    assert.deepEqual(migrated.world.bags,{vlad:0,alina:1});
    assert.equal(migrated.world.tableBags,0);
    assert.equal(migrated.pantry.milk,5);
    assert.equal(migrated.money,5124);
    const backup=join(dir,'household.pre-auto-groceries.json');
    assert.ok(existsSync(backup),'a pre-migration backup must exist');
    assert.equal(JSON.parse(readFileSync(backup,'utf-8')).world.tableBags,3);
    const second=files.load();
    assert.equal(second.world.tableBags,0,'migration idempotent');
    const back=travel(second,'alina','home');
    assert.deepEqual(back.world.bags,{vlad:0,alina:0});
    assert.equal(back.world.tableBags,0);
    assert.equal(back.pantry.milk,5);
    assert.equal(back.money,5124);
  }finally{rmSync(dir,{recursive:true,force:true});}
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
    progressed.meals.omelette = 18;
    progressed.pantry.eggs = 60;
    openServerFiles(dir).save(progressed);
    let state = openServerFiles(dir).load();
    assert.equal(state.world.deliveries[0].id, order.id);
    state = at(state, 'alina', 'parcel');
    assert.equal(applyWorld(state, 'alina', take).ok, false);
    assert.equal(state.world.deliveries.length, 1);
    state.meals.omelette = 14;
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
  assert.equal(s.money, 10000 - CAFE_MENU.cappuccino.price * 2);
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
