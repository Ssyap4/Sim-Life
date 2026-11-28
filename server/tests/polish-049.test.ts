import assert from 'node:assert/strict';
import test from 'node:test';
import { frameTiming,advanceActiveVisualClock } from '../../src/game/FrameTiming';
import { CanvasGestureGate, type PointerContact } from '../../src/game/CanvasGestureGate';
import { chooseGraphicsQuality } from '../../src/game/GraphicsCompatibility';

test('background and suspended frames neither advance visuals nor degrade quality', () => {
  for (const [ms, hidden] of [[16, true], [5000, false], [Infinity, false], [-1, false]] as const)
    assert.deepEqual(frameTiming(ms, false, hidden), {dt:0, qualitySample:null});
  assert.deepEqual(frameTiming(16, false, false), {dt:.016, qualitySample:16});
  assert.deepEqual(frameTiming(400, false, false), {dt:.2, qualitySample:150});
  assert.deepEqual(frameTiming(16, true, false), {dt:0, qualitySample:null});
});
test('adaptive graphics do not oscillate around the previous thresholds', () => {
  const profile = {safe:false, full:false};
  assert.equal(chooseGraphicsQuality(18.5,profile,'high'),'high');
  assert.equal(chooseGraphicsQuality(23,profile,'low'),'low');
  assert.equal(chooseGraphicsQuality(19,profile,'low'),'standard');
  assert.equal(chooseGraphicsQuality(25,profile,'high'),'low');
  assert.equal(chooseGraphicsQuality(17,profile,'standard'),'high');
  assert.equal(chooseGraphicsQuality(30,{...profile,full:true},'low'),'high');
  assert.equal(chooseGraphicsQuality(12,{...profile,safe:true},'high'),'low');
});
test('interrupted multi-touch cannot block the next intentional tap', () => {
  const gate = new CanvasGestureGate();
  const p:PointerContact={id:1,x:50,y:50,type:'touch',primary:true,button:0,time:100};
  gate.down(p);gate.down({...p,id:2,primary:false,x:100});
  gate.reset();
  assert.equal(gate.touchCount,0);
  assert.equal(gate.up({...p,time:130}),false);
  gate.down({...p,id:3,time:150});
  assert.equal(gate.up({...p,id:3,time:170}),true);
  gate.reset();
  gate.down({...p,id:4,time:200});
  assert.equal(gate.up({...p,id:4,time:220}),true);
});


test('active gift choreography catches up after slow frames without advancing during pause',()=>{
 const clock={elapsed:2,last:1000};
 assert.equal(frameTiming(3500,false,false).dt,0);
 assert.equal(advanceActiveVisualClock(clock,4500,false),5.5);
 assert.equal(advanceActiveVisualClock(clock,9500,false),10.5);
 assert.equal(advanceActiveVisualClock(clock,19500,true),10.5);
 assert.equal(advanceActiveVisualClock(clock,20500,false),11.5);
 assert.equal(advanceActiveVisualClock(clock,20000,false),11.5);
 assert.equal(advanceActiveVisualClock(clock,Infinity,false),11.5);
});
