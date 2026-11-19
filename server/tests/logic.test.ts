import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applyAction } from '../logic';
import { initialState } from '../../src/shared/protocol';

test('Vlad receives a small order payment, while original snapshot stays unchanged', () => {
  const original = initialState();
  const result = applyAction(original, 'vlad', 'vladOrder');
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.state.money, 2620);
  assert.equal(result.state.characters.vlad.skill, 6);
  assert.equal(result.state.characters.vlad.energy, 71);
  assert.equal(result.state.revision, 1);
  assert.equal(original.money, 2500);
});

test('One character cannot execute the other character career action', () => {
  const result = applyAction(initialState(), 'alina', 'vladOrder');
  assert.equal(result.ok, false);
});

test('Alina learns reconstruction before client consultation is unlocked', () => {
  const start = initialState();
  assert.equal(applyAction(start, 'alina', 'alinaConsult').ok, false);
  const one = applyAction(start, 'alina', 'alinaStudy');
  assert.equal(one.ok, true);
  if (!one.ok) return;
  const two = applyAction(one.state, 'alina', 'alinaStudy');
  assert.equal(two.ok, true);
  if (!two.ok) return;
  const consult = applyAction(two.state, 'alina', 'alinaConsult');
  assert.equal(consult.ok, true);
  if (!consult.ok) return;
  assert.equal(consult.state.money, 2580);
  assert.equal(consult.state.characters.alina.skill, 27);
});

test('Food cannot be created from nowhere or go below zero', () => {
  const start = initialState();
  const a = applyAction(start, 'vlad', 'omelette');
  assert.equal(a.ok, true);
  if (!a.ok) return;
  const b = applyAction(a.state, 'alina', 'omelette');
  assert.equal(b.ok, true);
  if (!b.ok) return;
  assert.equal(b.state.pantry.eggs, 0);
  const failed = applyAction(b.state, 'vlad', 'omelette');
  assert.equal(failed.ok, false);
  assert.equal(b.state.pantry.eggs, 0);
});

test('Shared funds cannot be overspent by a store purchase', () => {
  const start = initialState();
  start.money = 20;
  const failed = applyAction(start, 'vlad', 'buyEggs');
  assert.equal(failed.ok, false);
  assert.equal(start.money, 20);
  const ok = applyAction(start, 'alina', 'buyBread');
  assert.equal(ok.ok, true);
  if (!ok.ok) return;
  assert.equal(ok.state.money, 0);
  assert.equal(ok.state.pantry.bread, 4);
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
