import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ACTIONS, initialState, points } from '../../src/shared/protocol';
import { dayPhase, clockLabel, INITIAL_DAILY_NEEDS } from '../../src/shared/life';
import { advanceLife } from '../life';
import { applyAction } from '../logic';
import { completeTogether, pairScenes } from '../society';
import { openServerFiles } from '../storage';

test('Clock passes midnight and only online residents lose needs', () => {
  const start = initialState();
  start.clock = { day: 6, minute: 1435 };
  const next = advanceLife(start, 10, ['vlad']);
  assert.deepEqual(next.clock, { day: 7, minute: 5 });
  assert.equal(next.revision, start.revision + 1);
  assert.ok(next.characters.vlad.hunger < start.characters.vlad.hunger);
  assert.ok(next.characters.vlad.hygiene < start.characters.vlad.hygiene);
  assert.deepEqual(next.characters.alina, start.characters.alina);
  assert.deepEqual(start.clock, { day: 6, minute: 1435 });
});

test('Bladder drain follows elapsed game minutes and pauses for the offline resident', () => {
  const start = initialState();
  start.characters.vlad.bladder = 10;
  for (const speed of [1, 1.5, 2, 3]) {
    const next = advanceLife(start, 20 * speed, ['vlad']);
    assert.equal(next.characters.vlad.bladder, Math.round((10 - 6.5 * speed / 3) * 100) / 100);
    assert.equal(next.characters.alina.bladder, INITIAL_DAILY_NEEDS.bladder);
  }
  const empty = advanceLife(start, 120, ['vlad']);
  assert.equal(empty.characters.vlad.bladder, 0);
  assert.equal(empty.characters.vlad.mood, start.characters.vlad.mood);
});

test('All bathroom actions complete at their shared approach and restore the intended needs', () => {
  const start = initialState();
  Object.assign(start.characters.vlad, { bladder: 8, hygiene: 12, comfort: 28, mood: 36 });
  const effects = [
    { action: 'toiletUse', bladder: 100, hygiene: 12, comfort: 28 },
    { action: 'bathWash', bladder: 8, hygiene: 35, comfort: 28 },
    { action: 'bathShower', bladder: 8, hygiene: 92, comfort: 28 },
    { action: 'bathTeeth', bladder: 8, hygiene: 32, comfort: 28 },
    { action: 'bathFoam', bladder: 8, hygiene: 100, comfort: 63 },
    { action: 'bathSoak', bladder: 8, hygiene: 100, comfort: 52 },
  ] as const;
  for (const { action, bladder, hygiene, comfort } of effects) {
    const result = applyAction(start, 'vlad', action);
    assert.ok(result.ok);
    const resident = result.state.characters.vlad;
    assert.deepEqual({ x: resident.x, z: resident.z }, points[ACTIONS[action].item]);
    assert.deepEqual([resident.bladder, resident.hygiene, resident.comfort], [bladder, hygiene, comfort]);
    assert.deepEqual(result.state.characters.alina, start.characters.alina);
  }
});

test('Calendar uses predictable phases without separate shadow meshes', () => {
  assert.equal(clockLabel({ day: 2, minute: 60 }), '11 марта, год 1 · 01:00');
  assert.equal(dayPhase({ day: 1, minute: 0 }), 'night');
  assert.equal(dayPhase({ day: 1, minute: 400 }), 'morning');
  assert.equal(dayPhase({ day: 1, minute: 900 }), 'day');
  assert.equal(dayPhase({ day: 1, minute: 1200 }), 'evening');
  assert.throws(() => advanceLife(initialState(), -1, ['vlad']), /Invalid/);
});

test('Every daily-life activity has a meaningful benefit while retaining the old actor model', () => {
  const cases = [
    ['kitchenWash', 'hygiene'], ['sofaRead', 'fun'], ['sofaCall', 'social'],
    ['bedMake', 'comfort'], ['deskGames', 'fun'], ['tableTalk', 'social'],
    ['tvMusic', 'fun'], ['kitchenTidy', 'comfort'],
  ] as const;
  for (const [action, stat] of cases) {
    const start = initialState();
    start.characters.vlad[stat] = 20;
    const result = applyAction(start, 'vlad', action);
    assert.equal(result.ok, true, action);
    if (result.ok) {
      assert.ok(result.state.characters.vlad[stat] > 20, action);
      assert.equal(result.state.revision, 1);
    }
  }
});

test('Hug restores both people social comfort and mood', () => {
  const start = initialState();
  const command = { type:'together',action:'softHug' } as const;
  const paths=pairScenes(start,'vlad',command);
  assert.ok(paths);
  const result=completeTogether(start,'vlad',command,['vlad','alina'],0,paths);
  if(!result.ok)assert.fail(result.reason);
  const hugged=result.state;
  for (const id of ['vlad', 'alina'] as const) {
    assert.ok(hugged.characters[id].social > start.characters[id].social);
    assert.ok(hugged.characters[id].comfort > start.characters[id].comfort);
  }
  assert.equal(start.revision, 0);
});

test('Pre-Living-World saves preserve money, skills, pantry, pets and gain clock/needs', () => {
  const dir = mkdtempSync(join(tmpdir(), 'sim-life-daily-migrate-'));
  try {
    const files = openServerFiles(dir);
    const save = files.load();
    save.money = 7447;
    save.characters.vlad.skill = 63;
    save.pantry.bread = 8;
    save.pets.simba.bond = 55;
    const legacy = { ...save, clock: undefined, readBooks: undefined, characters: {
      vlad: { ...save.characters.vlad }, alina: { ...save.characters.alina },
    } };
    for (const character of Object.values(legacy.characters)) {
      const editable = character as Record<string, unknown>;
      for (const need of ['hygiene', 'social', 'fun', 'comfort', 'bladder']) delete editable[need];
    }
    writeFileSync(join(dir, 'household.json'), JSON.stringify(legacy));
    const loaded = files.load();
    assert.equal(loaded.money, 7447);
    assert.equal(loaded.characters.vlad.skill, 63);
    assert.equal(loaded.pantry.bread, 8);
    assert.equal(loaded.pets.simba.bond, 55);
    assert.deepEqual(loaded.clock, { day: 1, minute: 480 });
    assert.deepEqual(loaded.readBooks, { vlad: [], alina: [] });
    assert.equal(loaded.characters.vlad.hygiene, 82);
    assert.equal(loaded.characters.vlad.bladder, INITIAL_DAILY_NEEDS.bladder);
    files.save(loaded);
    assert.equal(files.load().money, 7447);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
