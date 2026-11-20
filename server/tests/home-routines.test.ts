import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { planLeisure, urgentHomeAction } from '../home';
import { applyWorld } from '../locations';
import { runPetRoutines } from '../pets';
import { openServerFiles } from '../storage';
import { HOUSE_ENTRY } from '../../src/shared/home';
import { floorFor, placeObstacles } from '../../src/shared/locations';
import { PETS, PET_IDS, PET_ROAM, petDestination } from '../../src/shared/pets';
import { initialState } from '../../src/shared/protocol';
import { findRoute, pointIsClear, sampleWalk } from '../../src/game/navigation';

test('The server plans leisure routes in shared coordinates without rewarding cosmetic activities', () => {
  const state = initialState();
  const before = structuredClone(state);
  for (const role of ['vlad', 'alina'] as const) {
    for (const activity of ['tv', 'computer', 'verdell', 'simba', 'chat'] as const) {
      const walk = planLeisure(state, role, activity);
      assert.ok(walk, role + ' / ' + activity);
      assert.deepEqual(sampleWalk(walk, 100).from, walk.path.at(-1));
    }
  }
  assert.equal(urgentHomeAction(state, 'vlad'), undefined);
  assert.deepEqual(state, before);
  state.characters.vlad.hygiene = 8.01;
  assert.equal(urgentHomeAction(state, 'vlad'), undefined);
  state.characters.vlad.hygiene = 8;
  assert.deepEqual(urgentHomeAction(state, 'vlad'), { type: 'act', actionId: 'bathShower' });
  state.characters.vlad.hunger = 4;
  state.meals.omelette = 1;
  assert.deepEqual(urgentHomeAction(state, 'vlad'), { type: 'eat', recipe: 'omelette' });
  assert.equal(state.meals.omelette, 1);
});

test('Both pets can reach their own bed, bowl and toilet from every roaming point', () => {
  const home = placeObstacles('home');
  for (const id of PET_IDS) for (const start of [PETS[id].home, ...PET_ROAM]) {
    const care = (['eat', 'sleep', 'toilet'] as const).map(kind => petDestination(id, { kind, target: 0 }));
    for (const target of [...care, ...PET_ROAM]) {
      assert.ok(findRoute(start, target, home, floorFor('home')), JSON.stringify({ id, start, target }));
    }
  }
});

test('Both pets walk out to the lawn on shared persistent routes', () => {
  const dir = mkdtempSync(join(tmpdir(), 'sim-life-yard-pets-'));
  try {
    const state = initialState();
    runPetRoutines(state, 1, 480, new Set(), () => .99);
    const files = openServerFiles(dir);
    files.save(state);
    const restored = files.load();
    for (const id of PET_IDS) {
      const routine = restored.pets[id].routine;
      assert.equal(routine?.kind, 'wander');
      assert.ok(routine && routine.route.from.z < HOUSE_ENTRY.z);
      const lawn = sampleWalk(routine.route, 100).from;
      assert.ok(lawn.z > HOUSE_ENTRY.z);
      assert.deepEqual(lawn, PET_ROAM.at(-1));
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('An old pet route through moved furniture is discarded while pet progress is kept', () => {
  const dir = mkdtempSync(join(tmpdir(), 'sim-life-old-pet-route-'));
  try {
    const state = initialState();
    const pet = state.pets.simba;
    pet.bond = 69;
    pet.position = { x: 3.1, z: -1.9 };
    pet.routine = { kind: 'wander', target: 1, startedAt: 480, until: 490,
      route: { from: pet.position, path: [{ x: 1.5, z: -1.9 }] } };
    const files = openServerFiles(dir);
    files.save(state);
    const restored = files.load();
    assert.equal(restored.pets.simba.routine, undefined);
    assert.equal(restored.pets.simba.bond, 69);
    assert.equal(restored.petFood.simba, state.petFood.simba);
    assert.ok(pointIsClear(restored.pets.simba.position, placeObstacles('home'), floorFor('home')));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('Pet routes, real food, sleep and toilet persist and the leash excludes the home routine', () => {
  const dir = mkdtempSync(join(tmpdir(), 'sim-life-home-pets-'));
  try {
    const state = initialState();
    state.pets.verdell.satiety = 19;
    state.petBowls.verdell = 3;
    state.pets.simba.bladder = 40;
    state.pets.simba.energy = 40;
    const firstMinute = 1920;
    runPetRoutines(state, 5, firstMinute, new Set(), () => 0);
    assert.equal(state.pets.verdell.routine?.kind, 'eat');
    assert.equal(state.pets.simba.routine?.kind, 'toilet');
    assert.equal(state.petFood.verdell, 2);
    const files = openServerFiles(dir);
    files.save(state);
    const reloaded = files.load();
    assert.deepEqual(reloaded.pets, state.pets);
    runPetRoutines(reloaded, 10, firstMinute + 10, new Set(), () => 0);
    assert.equal(reloaded.petFood.verdell, 2, 'automatic eating does not use pack refills');
    assert.equal(reloaded.petBowls.verdell, 2, 'one serving consumed from the bowl');
    assert.ok(reloaded.pets.verdell.satiety > 50);
    assert.ok(reloaded.pets.simba.bladder > 98);
    assert.equal(reloaded.pets.simba.routine?.kind, 'sleep');
    runPetRoutines(reloaded, 16, firstMinute + 26, new Set(), () => .5);
    assert.equal(reloaded.petFood.verdell, 2);
    assert.ok(reloaded.pets.simba.energy > 66);
    const park = applyWorld(reloaded, 'vlad', { type: 'travel', place: 'park', dog: true });
    assert.ok(park.ok);
    assert.equal(park.state.world.dogWalker, 'vlad');
    assert.equal(park.state.pets.verdell.routine, undefined);
    assert.ok(park.state.pets.verdell.parkPosition);
    runPetRoutines(park.state, 5, firstMinute + 31, new Set(), () => 0);
    assert.equal(park.state.pets.verdell.routine, undefined);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('Old saves gain the new meters without changing affection or the existing food stock', () => {
  const dir = mkdtempSync(join(tmpdir(), 'sim-life-home-migrate-'));
  try {
    const state = initialState();
    const pets = { verdell: { satiety: 35, happiness: 54, bond: 94 }, simba: { satiety: 83, happiness: 73, bond: 66 } };
    writeFileSync(join(dir, 'household.json'), JSON.stringify({ ...state, pets }));
    const restored = openServerFiles(dir).load();
    assert.equal(restored.pets.verdell.bond, 94);
    assert.equal(restored.pets.simba.satiety, 83);
    assert.deepEqual(restored.petFood, state.petFood);
    assert.equal(restored.pets.simba.bladder, state.pets.simba.bladder);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
