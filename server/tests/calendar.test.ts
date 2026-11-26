import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GameClockDisplay } from '../../src/core/gameClock';
import { clockAt, clockLabel, gameDate, gameMinutes } from '../../src/shared/life';

test('The compressed calendar advances through three-day months, nine-day seasons and 36-day years', () => {
  const label = (day: number) => clockLabel({ day, minute: 0 });
  assert.equal(label(1), '1 марта, год 1 · 00:00');
  assert.equal(label(9), '3 мая, год 1 · 00:00');
  assert.equal(label(10), '1 июня, год 1 · 00:00');
  assert.deepEqual([1, 10, 19, 28].map(day => gameDate(day).season), ['Весна', 'Лето', 'Осень', 'Зима']);
  assert.equal(label(30), '3 декабря, год 1 · 00:00');
  assert.equal(label(31), '1 января, год 2 · 00:00');
  assert.equal(label(36), '3 февраля, год 2 · 00:00');
  assert.equal(label(37), '1 марта, год 2 · 00:00');
  assert.deepEqual(clockAt(gameMinutes({ day: 92, minute: 1439 }) + 1), { day: 93, minute: 0 });
});

test('The display advances between server samples, reconciles delay and applies speed changes', () => {
  const display = new GameClockDisplay();
  const midnight = gameMinutes({ day: 93, minute: 0 });
  display.reset(midnight - 1, 0);
  display.sync({ minutes: midnight - 1, multiplier: 1 }, 0);
  assert.deepEqual(clockAt(display.read(2000)), { day: 93, minute: 0 });
  // Network jitter and a simultaneous speed change should not move the display backward.
  display.sync({ minutes: midnight - .10, multiplier: 3 }, 2000);
  assert.equal(display.read(2000), midnight);
  assert.ok(display.read(2500) > midnight);
  assert.equal(display.read(4000), midnight + 2.9);
  // Stale connections only extrapolate briefly, then freeze.
  assert.equal(display.read(8100), display.read(15000));
  display.pause(5000);
  assert.equal(display.read(5500), display.read(15000));
  display.sync({ minutes: midnight + 8, multiplier: 1 }, 15001);
  assert.equal(display.read(15001), midnight + 8);
});
