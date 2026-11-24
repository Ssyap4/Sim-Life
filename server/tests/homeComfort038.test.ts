import test from 'node:test';
import assert from 'node:assert/strict';
import {initialState,points} from '../../src/shared/protocol';
import {PETS} from '../../src/shared/pets';
import {feedingStation} from '../../src/shared/petFeeders';
import {checkFurniturePlacement} from '../../src/shared/furnishingPlacement';
import {applyAction} from '../logic';
import {planTask} from '../tasks';
import {homeHabitCommands} from '../../src/shared/personalityHabits';
import {SOCIAL_BY_ID,contextAvailable} from '../../src/shared/socialLife';
import {gameMinutes} from '../../src/shared/life';
import {findRoute,pointIsClear} from '../../src/game/navigation';
import {HOME_FLOOR} from '../../src/shared/home';
import {placeObstacles} from '../../src/shared/locations';

test('new feeding zone permits a replacement in the starter bowl position',()=>{
 const s=initialState();
 for(const [i,pet] of (['verdell','simba'] as const).entries()){
   const item={id:i+1,sku:'pet-feed-'+pet+'-ceramic',finish:'sage' as const,...PETS[pet].bowl,rotation:0 as const};
   const check=checkFurniturePlacement(s,item);assert.ok(check.valid,JSON.stringify(check));
   s.furnishing.placed.push(item);
   assert.equal(feedingStation(s.furnishing,pet).item?.id,item.id);
 }
 assert.ok(pointIsClear(points.kitchenWindow,placeObstacles('home',s.furnishing),HOME_FLOOR));
});
test('curtains are a real shared state, reserved action with no free reward or cost',()=>{
 const s=initialState();
 assert.equal(planTask({type:'act',actionId:'curtainsClose'})?.resource,'kitchenWindow');
 const closed=applyAction(s,'vlad','curtainsClose');assert.ok(closed.ok);
 assert.equal(closed.state.kitchenCurtainsClosed,true);assert.equal(closed.state.money,s.money);
 assert.equal(applyAction(closed.state,'alina','curtainsClose').ok,false);
 const opened=applyAction(closed.state,'alina','curtainsOpen');assert.ok(opened.ok);
 assert.equal(opened.state.kitchenCurtainsClosed,false);
 for(const r of ['vlad','alina'] as const)assert.ok(findRoute(s.characters[r],points.kitchenWindow,placeObstacles('home'),HOME_FLOOR));
 s.autonomy.vlad='full';s.clock.minute=1260;
 assert.ok(homeHabitCommands(s,'vlad',0).some(x=>x.habit==='curtainsClose'));
 s.autonomy.vlad='needs';assert.ok(!homeHabitCommands(s,'vlad',0).some(x=>x.habit==='curtainsClose'));
});
test('greetings only appear at appropriate times and cannot be repeated immediately',()=>{
 const s=initialState(),morning=SOCIAL_BY_ID.get('nearTalk:goodMorning')!,night=SOCIAL_BY_ID.get('nearTalk:goodNight')!;
 s.clock.minute=420;assert.ok(contextAvailable(morning,s,'vlad'));assert.ok(!contextAvailable(night,s,'vlad'));
 s.relationship.recent.push({action:morning.id,at:gameMinutes(s.clock)});assert.ok(!contextAvailable(morning,s,'alina'));
 s.clock.minute=1320;assert.ok(contextAvailable(night,s,'alina'));assert.ok(!contextAvailable(morning,s,'alina'));
});