import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { planLeisure, urgentHomeAction } from '../home';
import { applyWorld } from '../locations';
import { runPetRoutines } from '../pets';
import { openServerFiles } from '../storage';
import { placeObstacles } from '../../src/shared/locations';
import { PETS, PET_IDS, PET_ROAM, petDestination } from '../../src/shared/pets';
import { initialState } from '../../src/shared/protocol';
import { planWalk, sampleWalk } from '../../src/game/navigation';

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
  assert.deepEqual(urgentHomeAction(state, 'vlad'), { type: 'act', actionId: 'kitchenWash' });
  state.characters.vlad.hunger = 4;
  state.meals.omelette = 1;
  assert.deepEqual(urgentHomeAction(state, 'vlad'), { type: 'eat', recipe: 'omelette' });
  assert.equal(state.meals.omelette, 1);
});

test('Both pets can reach their own bed, bowl and toilet from every roaming point', () => {
  const home = placeObstacles('home');
  for (const id of PET_IDS) for (const start of [PETS[id].home, ...PET_ROAM]) {
    for (const kind of ['eat', 'sleep', 'toilet'] as const) {
      const target = petDestination(id, { kind, target: 0 });
      assert.ok(planWalk(start, target, home), JSON.stringify({ id, start, target }));
    }
  }
});

test('Pet routes, real food, sleep and toilet persist and the leash excludes the home routine', () => {
  const dir = mkdtempSync(join(tmpdir(), 'sim-life-home-pets-'));
  try {
    const state = initialState();
    state.pets.verdell.satiety = 50;
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
    assert.equal(reloaded.petFood.verdell, 1);
    assert.ok(reloaded.pets.verdell.satiety > 70);
    assert.ok(reloaded.pets.simba.bladder > 98);
    assert.equal(reloaded.pets.simba.routine?.kind, 'sleep');
    runPetRoutines(reloaded, 16, firstMinute + 26, new Set(), () => .5);
    assert.equal(reloaded.petFood.verdell, 1);
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
