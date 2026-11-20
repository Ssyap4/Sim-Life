import assert from 'node:assert/strict';
import { test } from 'node:test';
import { initialState } from '../../src/shared/protocol';
import { petHungerLevel } from '../../src/shared/pets';
import { applyPetAction, runPetRoutines } from '../pets';
import { PetActor } from '../../src/game/PetActor';

test('Warning thresholds are exact: only below 20% is critical, below 35% is warning', () => {
  for (const [hunger, level] of [
    [100,'normal'], [35,'normal'], [34.99,'warning'],
    [20,'warning'], [19.99,'critical'], [11,'critical'], [0,'critical'],
  ] as const) assert.equal(petHungerLevel(hunger),level,String(hunger));
});

test('Both animals have independent alerts; an empty bowl leaves the warning visible', () => {
  const state=initialState();
  state.pets.verdell.satiety=11;
  state.pets.simba.satiety=26;
  state.petBowls.verdell=0;
  state.petBowls.simba=0;
  const untouched=structuredClone(state);
  assert.equal(petHungerLevel(state.pets.verdell.satiety),'critical');
  assert.equal(petHungerLevel(state.pets.simba.satiety),'warning');
  runPetRoutines(state,1,480,new Set(),()=>0.1);
  assert.equal(petHungerLevel(state.pets.verdell.satiety),'critical');
  assert.notEqual(state.pets.verdell.routine?.kind,'eat','no phantom food in empty bowl');
  assert.deepEqual(state.petBowls,untouched.petBowls);
  assert.equal(state.petFood.verdell,untouched.petFood.verdell);
});

test('Refilling the bowl is not an instant cure; warning clears only after the animal actually eats',()=>{
  const state=initialState();
  state.pets.verdell.satiety=11;
  state.petBowls.verdell=0;
  const filled=applyPetAction(state,'vlad','verdell','feed');
  assert.ok(filled.ok);
  const updated=filled.state;
  assert.equal(updated.petBowls.verdell,3);
  assert.equal(petHungerLevel(updated.pets.verdell.satiety),'critical');
  const remaining=updated.petFood.verdell;
  runPetRoutines(updated,1,480,new Set(),()=>0);
  assert.equal(updated.pets.verdell.routine?.kind,'eat');
  assert.equal(petHungerLevel(updated.pets.verdell.satiety),'critical');
  runPetRoutines(updated,10,490,new Set(),()=>0);
  assert.equal(updated.petBowls.verdell,2);
  assert.equal(updated.petFood.verdell,remaining);
  assert.equal(petHungerLevel(updated.pets.verdell.satiety),'normal');
  assert.ok(updated.pets.simba.satiety > 77 && updated.pets.simba.satiety < 78,
    'the second pet loses only its normal time-based hunger, without a feeding reward');
});

test('Visual pet actors safely operate in server-side tests without DOM or extra health stats',()=>{
  assert.equal(typeof document,'undefined');
  const actor=new PetActor('verdell');
  actor.setHungerLevel('critical');
  actor.update(1/60);
  actor.setHungerLevel('warning');
  actor.update(1/60);
  actor.setHungerLevel('normal');
  actor.update(1/60);
  assert.equal(actor.root.visible,true);
  assert.equal(Object.hasOwn(initialState().pets.verdell,'health'),false);
});
