import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Vector3 } from 'three';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { openServerFiles } from '../storage';
import { HOME_DECOR, HOME_FLOOR } from '../../src/shared/home';
import { HOME_SEATS } from '../../src/shared/homeLife';
import { placeObstacles } from '../../src/shared/locations';
import { PETS, PET_IDS, PET_ROAM, petDestination, petHungerLevel,
  PET_AUTO_EAT_BELOW } from '../../src/shared/pets';
import { initialState } from '../../src/shared/protocol';
import { runPetRoutines } from '../pets';
import { planPetRoute, petNavigationGeometry, petTemporaryDetour } from '../../src/game/PetNavigation';
import { petGap, PET_PET_CLEARANCE, separatePetBodies } from '../../src/game/PetTraffic';
import { PetActor } from '../../src/game/PetActor';
import { pointIsClear, segmentIsClear } from '../../src/game/navigation';

const nav = petNavigationGeometry(placeObstacles('home'), HOME_FLOOR);
test('Wide feeding spots and every roaming destination have pet-body clearance', () => {
  assert.ok(petGap(PETS.verdell.bowl, PETS.simba.bowl) >= 1.65);
  const foodStops = PET_IDS.map(id => petDestination(id, { kind: 'eat', target: 0 }));
  assert.ok(petGap(foodStops[0], foodStops[1]) >= 1.65);
  for (const p of [...PET_ROAM, ...foodStops,
    ...PET_IDS.map(id=>PETS[id].home),
    ...PET_IDS.map(id=>PETS[id].toilet)]) {
    assert.ok(pointIsClear(p, nav.obstacles, nav.floor), 'unsafe pet stop ' + JSON.stringify(p));
  }
  for (const id of PET_IDS) {
    const starting = PETS[id].home;
    for (const destination of [...PET_ROAM, ...foodStops]) {
      const route = planPetRoute(starting, destination, nav);
      assert.ok(route, id + ' route missing to ' + JSON.stringify(destination));
      assert.ok(petGap(route!.path.at(-1)!, destination) < 0.02, 'must arrive at exact stop');
      let last = route!.from;
      for (const waypoint of route!.path) {
        assert.ok(segmentIsClear(last, waypoint, nav.obstacles, nav.floor),
          id + ' must not skim furniture, even along shortcuts');
        last = waypoint;
      }
    }
  }
});

test('At exactly 40 percent, both animals begin their own meal; warning colors stay independent', () => {
  const s = initialState();
  s.pets.verdell.satiety = 40;
  s.pets.simba.satiety = 40;
  s.pets.verdell.energy = s.pets.simba.energy = 95;
  s.pets.verdell.bladder = s.pets.simba.bladder = 95;
  s.petBowls.verdell = s.petBowls.simba = 3;
  assert.equal(PET_AUTO_EAT_BELOW, 40);
  assert.equal(petHungerLevel(40), 'normal');
  assert.equal(petHungerLevel(19), 'critical');
  const before = structuredClone(s.petFood);
  runPetRoutines(s, 0, 480, new Set(), () => .3);
  assert.equal(s.pets.verdell.routine?.kind, 'eat');
  assert.equal(s.pets.simba.routine?.kind, 'eat');
  assert.equal(s.petBowls.verdell, 3);
  assert.equal(s.petBowls.simba, 3);
  for (const id of PET_IDS) {
    assert.deepEqual(s.pets[id].routine?.route.path.at(-1), petDestination(id, { kind: 'eat', target: 0 }));
  }
  runPetRoutines(s, 10, 490, new Set(), () => .3);
  assert.equal(s.petBowls.verdell, 2);
  assert.equal(s.petBowls.simba, 2);
  assert.deepEqual(s.petFood, before);
  assert.ok(s.pets.verdell.satiety >= 75 && s.pets.simba.satiety >= 75);
});

test('Removed yard bench does not remain as a hidden obstacle or seat', () => {
  assert.equal(HOME_SEATS.includes('yardBench' as typeof HOME_SEATS[number]), false);
  assert.ok(HOME_DECOR.every(rect => !(
    rect.minX < -3.24 && rect.maxX > -3.24 && rect.minZ < 10.24 && rect.maxZ > 10.24
  )), 'old lawn bench footprint must be gone');
  assert.ok(pointIsClear({ x: -3.24, z: 10.24 }, nav.obstacles, nav.floor));
});

test('A temporary obstacle can be routed around without teleporting a pet', () => {
  const area = { minX:-3, maxX:3, minZ:-3, maxZ:3 };
  const local = petNavigationGeometry([],area);
  const start = { x:-2.2, z:0 }, end = { x:2.2, z:0 };
  const reroute = petTemporaryDetour(start, end, [{ x:0,z:0 }], local);
  assert.ok(reroute);
  assert.ok(petGap(reroute!.from,start) < 0.001);
  assert.ok(reroute!.path.length >= 2, 'a blocked direct line needs a detour');
  let from = reroute!.from;
  for (const waypoint of reroute!.path) {
    const blocked = [{ minX:-.5, maxX:.5, minZ:-.5,maxZ:.5 }];
    assert.ok(segmentIsClear(from,waypoint,blocked,local.floor));
    from = waypoint;
  }
});

test('Both pets can reach separate bowls together and visibly eat, without shivering', () => {
  const dog = new PetActor('verdell'), cat = new PetActor('simba');
  const foodDog = petDestination('verdell', { kind: 'eat',target:0 });
  const foodCat = petDestination('simba', { kind: 'eat',target:0 });
  const dogRoute = planPetRoute(PETS.verdell.home, foodDog, nav)!;
  const catRoute = planPetRoute(PETS.simba.home, foodCat, nav)!;
  dog.followRoute(dogRoute.path.map(p=>new Vector3(p.x,0,p.z)),'eat',Math.PI);
  cat.followRoute(catRoute.path.map(p=>new Vector3(p.x,0,p.z)),'eat',Math.PI);
  let closest = Infinity;
  for (let frame=0;frame<1800;frame++) {
    dog.update(1/60,0,0,{...nav,blockers:[cat.root.position]});
    cat.update(1/60,0,0,{...nav,blockers:[dog.root.position]});
    const [d,c]=separatePetBodies(dog.root.position,cat.root.position,nav.obstacles,nav.floor);
    dog.root.position.set(d.x,0,d.z);
    cat.root.position.set(c.x,0,c.z);
    closest=Math.min(closest,petGap(dog.root.position,cat.root.position));
  }
  assert.ok(petGap(dog.root.position,foodDog) < .045,'dog reaches own food');
  assert.ok(petGap(cat.root.position,foodCat) < .045,'cat reaches own food');
  assert.ok(closest>=PET_PET_CLEARANCE-.015,'never overlap during feeding trip');
  const dogHead=(dog as unknown as {head: {rotation:{x:number}}}).head;
  const catHead=(cat as unknown as {head: {rotation:{x:number}}}).head;
  assert.ok(dogHead.rotation.x > .3,'dog actually chewing');
  assert.ok(catHead.rotation.x > .25,'cat actually chewing');
});

test('Old saved feeding destination is retired without erasing food or affection', () => {
  const dir = mkdtempSync(join(tmpdir(), 'sim-life-old-bowl-layout-'));
  try {
    const s = initialState();
    s.money = 44444;
    s.pets.verdell.bond = 89;
    s.petFood.verdell = 5;
    s.petBowls.verdell = 2;
    s.pets.verdell.routine = {
      kind: 'eat', target: 0, startedAt: 900, until: 910,
      route: { from: { ...PETS.verdell.home },
        path: [{ x: -.91, z: -2.12 }] },
    };
    writeFileSync(join(dir, 'household.json'), JSON.stringify(s));
    const loaded = openServerFiles(dir).load();
    assert.equal(loaded.pets.verdell.routine, undefined,
      'outdated meal route must not animate at a bowl that moved');
    assert.equal(loaded.pets.verdell.bond, 89);
    assert.equal(loaded.petFood.verdell, 5);
    assert.equal(loaded.petBowls.verdell, 2);
    assert.equal(loaded.money, 44444);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
