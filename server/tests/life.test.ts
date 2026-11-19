import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { initialState } from '../../src/shared/protocol';
import { dayPhase, clockLabel } from '../../src/shared/life';
import { advanceLife } from '../life';
import { applyAction } from '../logic';
import { applySocial } from '../social';
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

test('Calendar uses predictable phases without separate shadow meshes', () => {
  assert.equal(clockLabel({ day: 2, minute: 60 }), 'День 2 · 01:00');
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
  const hugged = applySocial(start, 'hug');
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
    const legacy = { ...save, clock: undefined, characters: {
      vlad: { ...save.characters.vlad }, alina: { ...save.characters.alina },
    } };
    for (const character of Object.values(legacy.characters)) {
      const editable = character as Record<string, unknown>;
      for (const need of ['hygiene', 'social', 'fun', 'comfort']) delete editable[need];
    }
    writeFileSync(join(dir, 'household.json'), JSON.stringify(legacy));
    const loaded = files.load();
    assert.equal(loaded.money, 7447);
    assert.equal(loaded.characters.vlad.skill, 63);
    assert.equal(loaded.pantry.bread, 8);
    assert.equal(loaded.pets.simba.bond, 55);
    assert.deepEqual(loaded.clock, { day: 1, minute: 480 });
    assert.equal(loaded.characters.vlad.hygiene, 82);
    files.save(loaded);
    assert.equal(files.load().money, 7447);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
