import assert from 'node:assert/strict';
import test from 'node:test';
import { CanvasGestureGate, MOBILE_TAP_SLOP, REPEAT_TAP_MS } from '../../src/game/CanvasGestureGate';

type Spec = { id?: number; x?: number; y?: number; time?: number; type?: 'touch'|'pen'|'mouse'; primary?: boolean; button?: number };
const event = (s:Spec={}) => ({
  id:s.id??1, x:s.x??100,y:s.y??100,time:s.time??100,
  type:s.type??'touch', primary:s.primary??true,button:s.button??0,
});
const touch = (gate:CanvasGestureGate, x=100,y=100,time=100) => {
  gate.down(event({x,y,time}));
  return gate.up(event({x,y,time:time+30}));
};
test('a touch is recognized immediately, without a deferred synthetic click', () => {
  const gate=new CanvasGestureGate();
  assert.equal(touch(gate),true);
  assert.equal(gate.touchCount,0);
});
test('tiny finger tremor is absorbed before camera pan, and still triggers a tap',()=>{
  const gate=new CanvasGestureGate();
  gate.down(event());
  const {holdTap}=gate.move(event({x:100+MOBILE_TAP_SLOP-1}));
  assert.equal(holdTap,true);
  assert.equal(gate.up(event({x:100+MOBILE_TAP_SLOP-1,time:130})),true);
});
test('deliberate drag moves camera but never selects a floor or furniture',()=>{
  const gate=new CanvasGestureGate();
  gate.down(event());
  assert.equal(gate.move(event({x:100+MOBILE_TAP_SLOP+10})).holdTap,false);
  assert.equal(gate.up(event({x:150,time:190})),false);
});
test('two fingers and release order can never produce a phantom selection',()=>{
  const gate=new CanvasGestureGate();
  gate.down(event());
  gate.down(event({id:2,x:160,primary:false}));
  assert.equal(gate.touchCount,2);
  assert.equal(gate.up(event({id:2,x:160,primary:false,time:120})),false);
  assert.equal(gate.up(event({time:130})),false);
  assert.equal(gate.touchCount,0);
  assert.equal(touch(gate,200,200,170),true);
});
test('two-finger twist is detected in place while one-finger tapping is disabled',()=>{
  const gate=new CanvasGestureGate();
  gate.down(event());
  gate.down(event({id:2,x:160,primary:false}));
  const motion=gate.move(event({id:2,x:160,y:120,primary:false}));
  assert.ok(Math.abs(motion.twistRadians)>0.01);
  assert.equal(motion.holdTap,false);
  gate.cancel(2); gate.cancel(1);
  assert.equal(gate.touchCount,0);
});
test('quick second tap at identical scene spot is ignored, different objects remain tappable',()=>{
  const gate=new CanvasGestureGate();
  assert.equal(touch(gate,90,100,0),true);
  assert.equal(touch(gate,91,99,140),false);
  assert.equal(touch(gate,200,200,210),true);
  assert.equal(touch(gate,200,200,210+REPEAT_TAP_MS+50),true);
});
test('long touch is not an accidental selection after a native press-and-hold',()=>{
  const gate=new CanvasGestureGate();
  gate.down(event({time:100}));
  assert.equal(gate.up(event({time:850})),false);
  assert.equal(touch(gate,200,200,900),true);
});

test('pointercancel and lost capture reset pending taps',()=>{
  const gate=new CanvasGestureGate();
  gate.down(event());gate.cancel(1);
  assert.equal(gate.up(event({time:130})),false);
  assert.equal(touch(gate,200,200,500),true);
});
test('mouse and pen retain their own click semantics and ignore right button',()=>{
  const gate=new CanvasGestureGate();
  const mouse=(time:number)=>{gate.down(event({type:'mouse',time}));return gate.up(event({type:'mouse',time:time+20}));};
  assert.equal(mouse(100),true);
  assert.equal(mouse(110),true);
  gate.down(event({type:'mouse',button:2,time:150}));
  assert.equal(gate.up(event({type:'mouse',button:2,time:170})),false);
  gate.down(event({type:'pen',time:220}));
  assert.equal(gate.up(event({type:'pen',time:240})),true);
});
test('held touch is not a tap once actual movement exceeds the correct CSS-pixel threshold',()=>{
  const gate=new CanvasGestureGate();
  gate.down(event());
  gate.move(event({x:100+MOBILE_TAP_SLOP}));
  gate.move(event());
  assert.equal(gate.up(event({time:190})),false);
});
