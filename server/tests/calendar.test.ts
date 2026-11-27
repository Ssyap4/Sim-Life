import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GameClockDisplay } from '../../src/core/gameClock';
import { clockAt, clockLabel, gameDate, gameMinutes, displayDate, calendarSlot } from '../../src/shared/life';

test('The compressed calendar advances through three-day months, nine-day seasons and 36-day years', () => {
  const label = (day: number) => clockLabel({ day, minute: 0 });
  assert.equal(label(1), '1 марта, год 1 · 00:00');
  assert.equal(label(9), '21 мая, год 1 · 00:00');
  assert.equal(label(10), '1 июня, год 1 · 00:00');
  assert.deepEqual([1, 10, 19, 28].map(day => gameDate(day).season), ['Весна', 'Лето', 'Осень', 'Зима']);
  assert.equal(label(30), '21 декабря, год 1 · 00:00');
  assert.equal(label(31), '1 января, год 2 · 00:00');
  assert.equal(label(36), '21 февраля, год 2 · 00:00');
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

test('display calendar covers every actual date without altering the simulated day',()=>{
  let prior:Date|undefined;
  for(let day=1;day<=180;day++){
    const slot=gameDate(day),seen=new Set<number>();
    for(let minute=0;minute<1440;minute++){
      const d=displayDate({day,minute});seen.add(d.day);
      assert.equal(calendarSlot(d.day),slot.day);
      assert.equal(d.month,slot.month);assert.equal(d.year,slot.year);
      const now=new Date(Date.UTC(2000+d.year,d.month-1,d.day));
      if(prior)assert.ok(now.getTime()===prior.getTime()||now.getTime()-prior.getTime()===86400000);
      prior=now;
    }
    const last=slot.day===3?new Date(Date.UTC(2000+slot.year,slot.month,0)).getUTCDate():slot.day*10;
    assert.equal(seen.size,last-(slot.day-1)*10);
  }
  assert.equal(displayDate({day:30,minute:1439}).day,31);
  assert.equal(displayDate({day:31,minute:864}).day,7);
  assert.equal(displayDate({day:33,minute:576}).day,25);
  assert.equal(displayDate({day:34,minute:432}).day,4);
});
test('Server pause samples freeze the display immediately, including a small network correction',()=>{
 const display=new GameClockDisplay();
 display.reset(100,0);display.sync({minutes:100,multiplier:3},0);
 display.sync({minutes:102.5,multiplier:0},2000);
 assert.equal(display.read(2000),102.5);
 assert.equal(display.read(30000),102.5);
 display.sync({minutes:102.5,multiplier:1},30000);
 assert.equal(display.read(32000),103.5);
});