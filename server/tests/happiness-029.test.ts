import {test} from 'node:test';
import assert from 'node:assert/strict';
import {initialState} from '../../src/shared/protocol';
import {REWARD_IDS,REWARDS,activeReward,protectNeeds,validHappiness} from '../../src/shared/happiness';
import {gameMinutes} from '../../src/shared/life';
import {rewardCommand,wishAtStart,fulfillWish} from '../happiness';
import {advanceLife} from '../life';
import {evaluateTask} from '../tasks';
import {beginShift,settleCompletedShifts} from '../jobs';
import {JOBS} from '../../src/shared/jobs';
import {wishesFor} from '../../src/shared/wishes';
test('four rewards, personal wallet, stock and no duplicate activation',()=>{
 let s=initialState();s.happiness.vlad.points=10000;
 assert.deepEqual(REWARD_IDS.map(id=>REWARDS[id].price),[600,825,1200,2250]);
 for(const id of REWARD_IDS){
  const buy=rewardCommand(s,'vlad','happiness_buy',id);assert.ok(buy.ok);s=buy.state;
  assert.equal(s.happiness.vlad.stock[id],1);
  const use=rewardCommand(s,'vlad','happiness_activate',id);assert.ok(use.ok);s=use.state;
  assert.equal(s.characters.vlad[id],100);
  assert.equal(activeReward(s,'vlad',id),gameMinutes(s.clock)+1440);
  assert.equal(rewardCommand(s,'vlad','happiness_activate',id).ok,false);
  assert.equal(rewardCommand(s,'alina','happiness_buy',id).ok,false);
 }
 assert.equal(s.happiness.vlad.points,5125);
 assert.equal(s.happiness.alina.points,0);assert.equal(validHappiness(s.happiness),true);
 assert.equal(rewardCommand(s,'vlad','happiness_buy','__proto__').ok,false);
});
test('exact 24 game hours across midnight, mixed online roles and decay after expiry',()=>{
 let s=initialState();s.happiness.vlad.points=2250;
 const b=rewardCommand(s,'vlad','happiness_buy','energy');assert.ok(b.ok);
 const a=rewardCommand(b.state,'vlad','happiness_activate','energy');assert.ok(a.ok);s=a.state;
 const partner=s.characters.alina.energy;
 s=advanceLife(s,1439,['vlad','alina']);
 assert.equal(s.characters.vlad.energy,100);assert.ok(s.characters.alina.energy<partner);
 s=advanceLife(s,1,['vlad']);assert.equal(s.characters.vlad.energy,100);assert.equal(activeReward(s,'vlad','energy'),0);
 s=advanceLife(s,60,['vlad']);assert.equal(s.characters.vlad.energy,98.8);
});
test('clock step crossing end protects only the active portion',()=>{
 let s=initialState();s.happiness.vlad.until.hunger=gameMinutes(s.clock)+30;protectNeeds(s);
 s=advanceLife(s,60,['vlad']);assert.equal(s.characters.vlad.hunger,99.1);
});
test('action completion earns one wish, daily cooldown, independent balance',()=>{
 const s=initialState();s.characters.vlad.bladder=20;s.characters.vlad.mood=50;
 const command={type:'act',actionId:'toiletUse'} as const;
 const wish=wishAtStart(s,'vlad',command);assert.equal(wish?.id,'need-bladder');
 assert.equal(s.happiness.vlad.points,0);
 assert.equal(fulfillWish(s,'vlad',wish,s),'');
 const result=evaluateTask(s,'vlad',command);assert.ok(result.ok);
 const previousMood=result.state.characters.vlad.mood;
 assert.match(fulfillWish(result.state,'vlad',wish,s),/5/);
 assert.equal(result.state.happiness.vlad.points,5);
 assert.equal(result.state.characters.vlad.mood,Math.min(100,previousMood+2));
 assert.equal(fulfillWish(result.state,'vlad',wish,s),'');
 assert.equal(result.state.happiness.alina.points,0);
 result.state.characters.vlad.bladder=20;
 assert.ok(wishesFor(result.state,'vlad').every(w=>w.id!=='need-bladder'));
});
test('saved stock remains, protected needs survive action and shift settlement',()=>{
 let s=initialState();s.happiness.vlad.points=2250;
 const b=rewardCommand(s,'vlad','happiness_buy','energy');assert.ok(b.ok);
 const stored=JSON.parse(JSON.stringify(b.state));
 const a=rewardCommand(stored,'vlad','happiness_activate','energy');assert.ok(a.ok);s=a.state;
 const job=beginShift(s,'vlad',Object.keys(JOBS)[0]);assert.ok(job.ok);
 const shift=job.state.activeShifts.vlad!;
 s=advanceLife(job.state,shift.endsAt-gameMinutes(job.state.clock),['vlad']);
 const settled=settleCompletedShifts(s).state;
 assert.equal(settled.characters.vlad.energy,100);
});
