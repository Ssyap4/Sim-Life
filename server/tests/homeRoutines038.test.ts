import test from 'node:test';
import assert from 'node:assert/strict';
import {initialState,points} from '../../src/shared/protocol';
import {applyAction} from '../logic';
import {planTask} from '../tasks';
import {placeObstacles} from '../../src/shared/locations';
import {HOME_FLOOR} from '../../src/shared/home';
import {findRoute} from '../../src/game/navigation';
import {SOCIAL_BY_ID,contextAvailable} from '../../src/shared/socialLife';
test('ventilation changes shared state, has a real route and cannot be repeated for rewards',()=>{
 const s=initialState();
 const open=applyAction(s,'vlad','windowOpen');assert.ok(open.ok);assert.equal(open.state.kitchenWindowOpen,true);
 assert.equal(open.state.money,s.money);assert.deepEqual(open.state.pantry,s.pantry);
 assert.equal(applyAction(open.state,'alina','windowOpen').ok,false);
 const close=applyAction(open.state,'alina','windowClose');assert.ok(close.ok);assert.equal(close.state.kitchenWindowOpen,false);
 assert.equal(planTask({type:'act',actionId:'windowOpen'})?.resource,'kitchenWindow');
 for(const r of ['vlad','alina'] as const)assert.ok(findRoute(s.characters[r],points.kitchenWindow,placeObstacles('home'),HOME_FLOOR));
});
test('after-work greeting is not offered without an actual recent shift',()=>{
 const s=initialState(),a=SOCIAL_BY_ID.get('nearTalk:welcomeHome')!;
 assert.ok(a);assert.equal(contextAvailable(a,s,'vlad'),false);
});