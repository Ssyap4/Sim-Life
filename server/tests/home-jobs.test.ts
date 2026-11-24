import {test} from 'node:test';
import assert from 'node:assert/strict';
import { initialState } from '../../src/shared/protocol';
import { homeJobsFor,JOBS,HOME_JOBS,shiftFullPay,shiftWage } from '../../src/shared/jobs';
import { clockAt,gameMinutes } from '../../src/shared/life';
import {beginShift,leaveShiftEarly,settleCompletedShifts} from '../jobs';
test('Separate home order catalogs: six per character and individual motion profiles',()=>{
  const seen=new Set();
  for(const role of ['vlad','alina'] as const){
    const own=homeJobsFor(role);assert.equal(own.length,6);
    for(const id of own){
      const job=JOBS[id];assert.deepEqual([job.payMin,job.payMax,job.hoursMin,job.hoursMax],[2000,3500,2,3]);
      assert.equal(job.stages.length,4);assert.ok(job.description.length>60);
      assert.ok(!seen.has(HOME_JOBS[id].animation));seen.add(HOME_JOBS[id].animation);
      const other=role==='vlad'?'alina':'vlad';
      assert.equal(beginShift(initialState(),other,id,'desktop').ok,false);
      assert.equal(beginShift(initialState(),role,id).ok,false);
      assert.equal(beginShift(initialState(),role,id,'laptop').ok,role==='alina');
    }
  }
});
test('Home orders have fixed random server payout, no advance payment, and separate city work allowance',()=>{
  for(const role of ['vlad','alina'] as const)for(const id of homeJobsFor(role)){
    const base=initialState();
    const result=beginShift(base,role,id,'desktop',4);assert.ok(result.ok);
    const job=result.state.activeShifts[role]!;
    assert.equal(job.homeDevice,'desktop');
    assert.equal(job.startedAt,gameMinutes(base.clock)+4);
    assert.ok(job.hours===2||job.hours===3);
    assert.ok(shiftFullPay(job)>=2000&&shiftFullPay(job)<=3500);
    assert.equal(result.state.money,base.money);
    assert.equal(shiftWage(job,result.state.clock),0);
    assert.equal(beginShift(result.state,role,id,'desktop').ok,false);
    const due=structuredClone(result.state);due.clock=clockAt(job.endsAt);
    const final=settleCompletedShifts(due);
    assert.equal(final.completed.length,1);assert.equal(final.state.money,base.money+shiftFullPay(job));
    assert.equal(final.state.characters[role].pose,'idle');
    assert.equal(final.state.shiftDays[role],base.shiftDays[role]);
    assert.equal(settleCompletedShifts(final.state).completed.length,0);
    assert.ok(beginShift(final.state,role,id,'desktop').ok);
  }
});
test('Shared computer exclusion; two separate devices allowed; partial payment after arrival only',()=>{
  const a=beginShift(initialState(),'vlad','vibeSite','desktop',2);assert.ok(a.ok);
  assert.equal(beginShift(a.state,'alina','wbCards','desktop').ok,false);
  const b=beginShift(a.state,'alina','wbCards','laptop');assert.ok(b.ok);
  const shift=b.state.activeShifts.vlad!;
  b.state.clock=clockAt(shift.startedAt+60);
  const partial=leaveShiftEarly(b.state,'vlad');assert.ok(partial.ok);
  assert.equal(partial.state.money,b.state.money+shiftWage(shift,b.state.clock));
  assert.ok(partial.state.activeShifts.alina);
  assert.equal(partial.state.activeShifts.vlad,undefined);
});

import {HOME_QUESTS,pendingHomeQuest,homeQuestContent,validHomeQuests} from '../../src/shared/homeJobQuests';
import {answerHomeQuest,expireHomeQuests} from '../jobs';
test('Every job gets two distinct randomly scheduled quests with shuffled answers and valid storage',()=>{
 for(const role of ['vlad','alina'] as const)for(const id of homeJobsFor(role)){
  assert.equal(HOME_QUESTS[id].length,3);
  for(let i=0;i<12;i++){
   const started=beginShift(initialState(),role,id,'desktop',3);assert.ok(started.ok);
   const shift=started.state.activeShifts[role]!,runs=shift.quests!;
   assert.ok(validHomeQuests(shift as unknown as Record<string,unknown>));
   assert.equal(runs.length,2);assert.notEqual(runs[0].index,runs[1].index);
   assert.ok(runs[0].at>shift.startedAt&&runs[1].at>=runs[0].until&&runs[1].until<shift.endsAt);
   assert.equal(pendingHomeQuest(shift,shift.startedAt),undefined);
   assert.equal(pendingHomeQuest(shift,runs[0].at)?.nonce,runs[0].nonce);
   assert.deepEqual([...runs[0].order].sort(),[0,1,2]);
  }
 }
});
test('Only current owner can answer the active quest; bonuses capped, replay cannot pay twice',()=>{
 const started=beginShift(initialState(),'vlad','gameFix','desktop');assert.ok(started.ok);
 const state=started.state,shift=state.activeShifts.vlad!,run=shift.quests![0];
 shift.targetPay=3420;
 const correct=run.order.indexOf(homeQuestContent(shift,run)!.answer);
 assert.equal(answerHomeQuest(state,'vlad',run.nonce,correct).ok,false);
 state.clock=clockAt(run.at);
 assert.equal(answerHomeQuest(state,'alina',run.nonce,correct).ok,false);
 assert.equal(answerHomeQuest(state,'vlad','fake',correct).ok,false);
 assert.equal(answerHomeQuest(state,'vlad',run.nonce,99).ok,false);
 const result=answerHomeQuest(state,'vlad',run.nonce,correct);assert.ok(result.ok);
 assert.equal(result.state.money,state.money);
 const next=result.state.activeShifts.vlad!;
 assert.equal(next.targetPay,3500);assert.equal(next.quests![0].result,'correct');
 assert.equal(answerHomeQuest(result.state,'vlad',run.nonce,correct).ok,false);
 assert.equal(shift.targetPay,3420);
 result.state.clock=clockAt(next.endsAt);
 const done=settleCompletedShifts(result.state);
 assert.equal(done.completed[0].payment,3500);
 assert.equal(settleCompletedShifts(done.state).completed.length,0);
});
test('Wrong, skipped and expired miniquests never reduce the promised payout or block progress',()=>{
 const started=beginShift(initialState(),'alina','hairLesson','laptop');assert.ok(started.ok);
 const state=started.state,shift=state.activeShifts.alina!,[a,b]=shift.quests!;
 const pay=shiftFullPay(shift);state.clock=clockAt(a.at);
 const wrong=(a.order.indexOf(homeQuestContent(shift,a)!.answer)+1)%3;
 const result=answerHomeQuest(state,'alina',a.nonce,wrong);assert.ok(result.ok);
 assert.equal(result.state.activeShifts.alina!.quests![0].result,'wrong');
 result.state.clock=clockAt(b.at);
 const skip=answerHomeQuest(result.state,'alina',b.nonce,-1);assert.ok(skip.ok);
 assert.equal(skip.state.activeShifts.alina!.quests![1].result,'skipped');
 assert.equal(shiftFullPay(skip.state.activeShifts.alina!),pay);
 state.clock=clockAt(b.until);expireHomeQuests(state);
 assert.equal(shift.quests!.every(q=>q.result==='skipped'),true);
 assert.equal(answerHomeQuest(state,'alina',b.nonce,0).ok,false);
 state.clock=clockAt(shift.endsAt);
 assert.equal(settleCompletedShifts(state).completed[0].payment,pay);
});
