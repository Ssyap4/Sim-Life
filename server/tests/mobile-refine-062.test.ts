import assert from 'node:assert/strict';
import test from 'node:test';
import {PhoneRefreshGate,PHONE_SCROLL_QUIET_MS} from '../../src/phoneRefreshGate';
test('phone refresh waits for every active touch and inertial scrolling to finish',()=>{
 const g=new PhoneRefreshGate();assert.equal(g.wait(0),0);g.down(1);g.down(2);
 assert.equal(g.wait(10),Infinity);g.up(1);assert.equal(g.wait(20),Infinity);
 g.scroll(30);g.up(2);assert.equal(g.wait(30),PHONE_SCROLL_QUIET_MS);
 g.scroll(100);assert.equal(g.wait(120),PHONE_SCROLL_QUIET_MS-20);
 assert.equal(g.wait(100+PHONE_SCROLL_QUIET_MS),0);
});
test('phone cancellation, window blur and opening another app release refresh gating',()=>{
 const g=new PhoneRefreshGate();g.down(1);g.scroll(100);g.reset();assert.equal(g.wait(101),0);
 g.up(1);assert.equal(g.wait(101),0);
});
