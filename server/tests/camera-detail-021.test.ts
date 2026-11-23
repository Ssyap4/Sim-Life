import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { steadyPanSpeed, TOUCH_CAMERA_DAMPING } from '../../src/game/CameraPan';
import { detailLimit } from '../../src/game/DistrictDetail';

test('same touch drag moves the camera equally at near, medium and far zoom',()=>{
  const amount=[10,18,24,36,60,96,132].map(distance=>distance*steadyPanSpeed(distance));
  assert.ok(Math.max(...amount)-Math.min(...amount)<.01);
  assert.ok(TOUCH_CAMERA_DAMPING>.08&&TOUCH_CAMERA_DAMPING<.20);
});
test('lod keeps detailed buildings, gardens and plants through medium camera ranges',()=>{
  for(const kind of ['building','cottage','trees','flowers','distantFlowers','grass'] as const){
    const near=detailLimit(kind,true,false),far=detailLimit(kind,false,false);
    assert.ok(near<far,'hysteresis must avoid flicker');
    assert.ok(detailLimit(kind,false,true)<far,'low quality must save work');
  }
  assert.ok(detailLimit('building',false,false)>=75);
  assert.ok(detailLimit('flowers',false,false)>=42);
  assert.ok(detailLimit('trees',false,false)>=52);
});
test('HUD keeps needs accessible while replacing its decorative heart icon',()=>{
  const markup=readFileSync(new URL('../../src/main.ts',import.meta.url),'utf8');
  const theme=readFileSync(new URL('../../src/district-minimal-021.css',import.meta.url),'utf8');
  assert.match(markup,/id="needs-toggle"/);
  assert.match(markup,/class="need-glyph"/);
  assert.doesNotMatch(markup,/class="heart">♥/);
  assert.match(theme,/\.need-glyph/);
});
