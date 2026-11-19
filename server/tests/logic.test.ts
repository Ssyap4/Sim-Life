import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applyAction } from '../logic';
import { applyFoodAction } from '../food';
import { initialState } from '../../src/shared/protocol';

test('Vlad earns a realistic daily side-shift payment, while original snapshot stays unchanged', () => {
  const original = initialState();
  const result = applyAction(original, 'vlad', 'vladOrder');
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.state.money, 5500);
  assert.equal(result.state.characters.vlad.skill, 0);
  assert.equal(result.state.characters.vlad.energy, 58);
  assert.equal(result.state.revision, 1);
  assert.equal(original.money, 2500);
});

test('One character cannot execute the other character career action', () => {
  const result = applyAction(initialState(), 'alina', 'vladOrder');
  assert.equal(result.ok, false);
});

test('Alina can take a non-career side shift once per game day', () => {
  const start = initialState();
  const paid = applyAction(start, 'alina', 'alinaConsult');
  assert.equal(paid.ok, true);
  if (!paid.ok) return;
  assert.equal(paid.state.money, 5700);
  assert.equal(paid.state.shiftDays.alina, 1);
  assert.equal(paid.state.ledger[0].amount, 3200);
  assert.equal(applyAction(paid.state, 'alina', 'alinaConsult').ok, false);
  const tomorrow = structuredClone(paid.state);
  tomorrow.clock.day++;
  const again = applyAction(tomorrow, 'alina', 'alinaConsult');
  assert.equal(again.ok, true);
});

test('Cooking creates two shareable portions from real ingredients', () => {
  const start = initialState();
  assert.equal(applyFoodAction(start, 'vlad', { type: 'cook', recipe: 'omelette' }).ok, false);
  const milk = applyFoodAction(start, 'alina', { type: 'buy', item: 'milk' });
  assert.equal(milk.ok, true);
  if (!milk.ok) return;
  const cooked = applyFoodAction(milk.state, 'vlad', { type: 'cook', recipe: 'omelette' });
  assert.equal(cooked.ok, true);
  if (!cooked.ok) return;
  assert.equal(cooked.state.pantry.eggs, 2);
  assert.equal(cooked.state.pantry.milk, 0);
  assert.equal(cooked.state.meals.omelette, 2);
  const eaten = applyFoodAction(cooked.state, 'alina', { type: 'eat', recipe: 'omelette' });
  assert.equal(eaten.ok, true);
  if (!eaten.ok) return;
  assert.equal(eaten.state.meals.omelette, 1);
  assert.equal(start.meals.omelette, 0);
});

test('Shared funds cannot be overspent by a store purchase', () => {
  const start = initialState();
  start.money = 45;
  const failed = applyFoodAction(start, 'vlad', { type: 'buy', item: 'eggs' });
  assert.equal(failed.ok, false);
  assert.equal(start.money, 45);
  const ok = applyFoodAction(start, 'alina', { type: 'buy', item: 'bread' });
  assert.equal(ok.ok, true);
  if (!ok.ok) return;
  assert.equal(ok.state.money, 0);
  assert.equal(ok.state.pantry.bread, 11);
});

test('Stats are capped and unknown commands rejected', () => {
  const start = initialState();
  start.characters.alina.energy = 100;
  const result = applyAction(start, 'alina', 'bedSleep');
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.state.characters.alina.energy, 100);
  assert.equal(applyAction(start, 'vlad', '__proto__').ok, false);
  assert.equal(applyAction(start, 'vlad', 'not-real').ok, false);
});

test('New items share an authoritative revision and actor location', () => {
  const start = initialState();
  const result = applyAction(start, 'alina', 'tableRest');
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.state.revision, 1);
  assert.deepEqual(
    [result.state.characters.alina.x, result.state.characters.alina.z, result.state.characters.alina.pose],
    [-0.8, 0.04, 'sit'],
  );
});
