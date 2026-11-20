import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pointIsClear } from '../../src/game/navigation';
import { HOME_FLOOR, HOME_DOORS, EAST_WALL } from '../../src/shared/home';
import { INITIAL_DAILY_NEEDS } from '../../src/shared/life';
import { placeObstacles } from '../../src/shared/locations';
import { points } from '../../src/shared/protocol';
import { openServerFiles } from '../storage';

test('Older household saves gain pantry and meal slots without losing progress', () => {
  const dir = mkdtempSync(join(tmpdir(), 'sim-life-migration-'));
  try {
    const files = openServerFiles(dir);
    const old = files.load();
    old.money = 6742;
    old.characters.vlad.skill = 37;
    const legacy = { ...old, pantry: { eggs: 7, bread: 4 }, meals: undefined };
    writeFileSync(join(dir, 'household.json'), JSON.stringify(legacy));
    const loaded = files.load();
    assert.equal(loaded.money, 6742);
    assert.equal(loaded.characters.vlad.skill, 37);
    assert.equal(loaded.pantry.eggs, 7);
    assert.equal(loaded.pantry.bread, 4);
    assert.equal(loaded.pantry.chicken, 0);
    assert.equal(loaded.meals.omelette, 0);
    files.save(loaded);
    assert.equal(files.load().money, 6742);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('Access codes survive restart; each character has its own secret', () => {
  const dir = mkdtempSync(join(tmpdir(), 'sim-life-codes-'));
  try {
    const first = openServerFiles(dir);
    const second = openServerFiles(dir);
    assert.equal(first.access.vlad, second.access.vlad);
    assert.equal(first.access.alina, second.access.alina);
    assert.notEqual(first.access.vlad, first.access.alina);
    assert.ok(first.access.vlad.length >= 12);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('Server preserves a backup and refuses to silently overwrite corrupted progress', () => {
  const dir = mkdtempSync(join(tmpdir(), 'sim-life-saves-'));
  try {
    const files = openServerFiles(dir);
    const original = files.load();
    original.money = 2400;
    original.revision = 1;
    files.save(original);
    const updated = structuredClone(original);
    updated.money = 2300;
    updated.revision = 2;
    files.save(updated);

    assert.equal(files.load().money, 2300);
    const backup = JSON.parse(readFileSync(join(dir, 'household.backup.json'), 'utf8')) as typeof original;
    assert.equal(backup.money, 2400);

    const invalid = structuredClone(updated);
    invalid.money = -99;
    assert.throws(() => files.save(invalid), /invalid/);
    assert.equal(files.load().money, 2300);

    writeFileSync(join(dir, 'household.json'), '{broken json');
    assert.throws(() => files.load());
    assert.equal(backup.revision, 1);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('Old positions in new walls recover nearby and moved sleepers use the new bedroom', () => {
  const dir = mkdtempSync(join(tmpdir(), 'sim-life-house-layout-'));
  try {
    const files = openServerFiles(dir);
    const legacy = files.load();
    legacy.world.tableBags = 4;
    legacy.money = 7411;
    legacy.clock = { day: 5, minute: 768 };
    legacy.meals.omelette = 4;
    Object.assign(legacy.characters.vlad, { x: EAST_WALL, z: .1 });
    Object.assign(legacy.characters.alina, { x: -4.30, z: -1.40, pose: 'sleep' });
    delete (legacy.characters.vlad as Partial<typeof legacy.characters.vlad>).bladder;
    files.save(legacy);
    const state = files.load();
    assert.equal(state.characters.vlad.bladder, INITIAL_DAILY_NEEDS.bladder);
    assert.ok(pointIsClear(state.characters.vlad, placeObstacles('home'), HOME_FLOOR));
    assert.ok(Math.abs(state.characters.vlad.x - EAST_WALL) < .6);
    assert.deepEqual({ x: state.characters.alina.x, z: state.characters.alina.z }, points.bed);
    assert.deepEqual([state.money, state.world.tableBags, state.meals.omelette], [7411, 4, 4]);
    assert.deepEqual(state.clock, legacy.clock);

    const { x, z } = HOME_DOORS.office;
    Object.assign(state.characters.alina, { x, z, pose: 'idle', bladder: 37 });
    files.save(state);
    const restarted = files.load();
    assert.equal(restarted.characters.alina.x, EAST_WALL);
    assert.equal(restarted.characters.alina.bladder, 37);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
