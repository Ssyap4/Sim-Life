import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Actor } from '../../src/game/Actor';
import { mealGesture, mealServingScale } from '../../src/game/MealGesture';
import { HOME_FLOOR, homeSeat } from '../../src/shared/home';
import { placeObstacles } from '../../src/shared/locations';
import { findRoute, pointIsClear } from '../../src/game/navigation';
import { initialState } from '../../src/shared/protocol';
import { addReadyFood } from '../../src/shared/readyFood';
import { applyFoodAction, applyTakeoutMeal } from '../food';

test('Meal gestures include pickup, chewing and calm pauses without syncing two actors', () => {
  const vlad = mealGesture(.85, 'vlad');
  const alina = mealGesture(.85, 'alina');
  assert.ok(vlad.lift > 0 && vlad.lift <= 1);
  assert.ok(alina.lift > 0 && alina.lift <= 1);
  assert.notEqual(vlad.lift, alina.lift, 'two residents have distinct mealtime rhythm');
  assert.ok(mealGesture(1.55, 'vlad').chew > 0);
  assert.equal(mealGesture(8.1, 'vlad').lift, 0, 'one in four cycles is a rest');
  for (const role of ['vlad', 'alina'] as const) {
    for (let sec = 0; sec < 12; sec += .13) {
      const state = mealGesture(sec, role);
      for (const value of Object.values(state)) assert.ok(Number.isFinite(value));
      assert.ok(state.lift >= 0 && state.lift <= 1);
    }
  }
  assert.equal(mealServingScale(0), 1);
  assert.ok(mealServingScale(5) < 1);
  assert.equal(mealServingScale(20), .28);
  assert.equal(mealServingScale(-5), 1);
});

test('Both dining approaches are safely separated and routes exist from the entrance', () => {
  const a = homeSeat('table', 'vlad');
  const b = homeSeat('table', 'alina');
  const obstacles = placeObstacles('home');
  assert.ok(Math.hypot(a.approach.x - b.approach.x, a.approach.z - b.approach.z) > 1.5);
  for (const seat of [a, b]) {
    assert.ok(pointIsClear(seat.approach, obstacles, HOME_FLOOR), 'approach is not in furniture');
    assert.ok(findRoute({ x: 0.4, z: 3.2 }, seat.approach, obstacles, HOME_FLOOR));
  }
  assert.ok(a.position.x > b.position.x, 'residents sit on opposing sides');
});

test('Each server-authoritative cooked meal places the right resident at their own table seat', () => {
  const state = initialState();
  state.characters.vlad.hunger = 12;
  state.characters.alina.hunger = 14;
  state.meals.omelette = 2;
  addReadyFood(state, 'meal', 'omelette', 2, 'fridge');
  const first = applyFoodAction(state, 'vlad', { type: 'eat', recipe: 'omelette' });
  assert.ok(first.ok);
  const second = applyFoodAction(first.state, 'alina', { type: 'eat', recipe: 'omelette' });
  assert.ok(second.ok);
  assert.equal(second.state.meals.omelette, 0);
  for (const role of ['vlad', 'alina'] as const) {
    const p: { x: number; z: number; pose: string; hunger: number } = second.state.characters[role];
    assert.deepEqual({ x: p.x, z: p.z }, homeSeat('table', role).approach);
    assert.equal(p.pose, 'sit');
    assert.ok(p.hunger > 14);
  }
  assert.notDeepEqual(second.state.characters.vlad.x, second.state.characters.alina.x);
});

test('Ready food uses individual meal seats and animators relinquish control on cancel', () => {
  const state = initialState();
  state.takeout.pizzaCheese = 2;
  addReadyFood(state, 'takeout', 'pizzaCheese', 2, 'fridge');
  const first = applyTakeoutMeal(state, 'alina', 'pizzaCheese');
  assert.ok(first.ok);
  assert.deepEqual(
    { x: first.state.characters.alina.x, z: first.state.characters.alina.z },
    homeSeat('table', 'alina').approach,
  );
  const actor = new Actor('vlad', [0, 0]);
  actor.setPose('sit');
  actor.playActivity('eat');
  for (let t = 0; t < 90; t++) actor.update(1 / 60);
  assert.ok((actor.eatingElapsed() ?? 0) > 1);
  actor.finishActivity();
  actor.update(1 / 60);
  assert.equal(actor.eatingElapsed(), null);
});
