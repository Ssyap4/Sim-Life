import assert from 'node:assert/strict';
import { test } from 'node:test';
import { FrameMeter } from '../../src/game/PerformanceProbe';

test('frame meter reports approximately 60 fps from real render timestamps', () => {
  const meter = new FrameMeter();
  let result = null;
  for (let i = 0; i <= 160; i++) result = meter.record(i * 1000 / 60, 212, 107742) ?? result;
  assert.ok(result);
  assert.ok(Math.abs(result.fps - 60) < 0.2);
  assert.ok(Math.abs(result.p95Ms - 16.7) < 0.2);
  assert.equal(result.drawCalls, 212);
  assert.equal(result.triangles, 107742);
});

test('frame meter exposes slow frame durations instead of hiding occasional jank', () => {
  const meter = new FrameMeter();
  meter.record(0, 1, 1);
  let now = 0;
  let result = null;
  for (let i = 0; i < 120; i++) {
    now += i % 10 === 0 ? 70 : 16;
    result = meter.record(now, 1, 1) ?? result;
  }
  assert.ok(result);
  assert.ok(result.p95Ms >= 70);
  assert.ok(result.fps < 60);
});

test('background tab pause resets sample rather than inventing low FPS', () => {
  const meter = new FrameMeter();
  meter.record(0, 0, 0);
  assert.equal(meter.record(3000, 0, 0), null);
  let latest = null;
  for (let i = 1; i < 130; i++) latest = meter.record(3000 + i * 16, 20, 200) ?? latest;
  assert.ok(latest);
  assert.ok(latest.fps > 60);
  meter.reset();
  assert.equal(meter.record(10000, 0, 0), null);
});
