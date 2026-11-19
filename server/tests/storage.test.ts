import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { openServerFiles } from '../storage';

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
