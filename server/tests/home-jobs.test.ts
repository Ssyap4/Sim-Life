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
      const job=JOBS[id];assert.deepEqual([job.payMin,job.payMax,job.hoursMin,job.hoursMax],[2000,3500,3,4]);
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
    assert.ok(job.hours===3||job.hours===4);
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

import {HOME_QUESTS,pendingHomeQuest,homeQuestContent,validHomeQuests,correctQuestChoice,validQuestChoice} from '../../src/shared/homeJobQuests';
import {answerHomeQuest,expireHomeQuests} from '../jobs';
test('Every job gets three or four distinct randomly scheduled quests with shuffled answers and valid storage',()=>{
 for(const role of ['vlad','alina'] as const)for(const id of homeJobsFor(role)){
  assert.equal(HOME_QUESTS[id].length,10);
  for(let i=0;i<12;i++){
   const started=beginShift(initialState(),role,id,'desktop',3);assert.ok(started.ok);
   const shift=started.state.activeShifts[role]!,runs=shift.quests!;
   assert.ok(validHomeQuests(shift as unknown as Record<string,unknown>));
   assert.equal(runs.length,shift.hours);assert.equal(new Set(runs.map(q=>q.index)).size,runs.length);
   const specs=runs.map(q=>homeQuestContent(shift,q)!);assert.ok(specs.some(q=>q.kind==="multi"));assert.ok(specs.some(q=>q.kind==="binary"||q.kind==="sequence"));assert.ok(specs.some(q=>!q.kind||q.kind==="single"));
   assert.ok(runs[0].at>shift.startedAt&&runs.at(-1)!.until<shift.endsAt);for(let j=1;j<runs.length;j++)assert.ok(runs[j].at>=runs[j-1].until);
   assert.equal(pendingHomeQuest(shift,shift.startedAt),undefined);
   assert.equal(pendingHomeQuest(shift,runs[0].at)?.nonce,runs[0].nonce);
   for(const [i,run] of runs.entries()){assert.deepEqual([...run.order].sort(),specs[i].options.map((_,i)=>i));assert.ok(validQuestChoice(specs[i],run,correctQuestChoice(specs[i],run)));}
  }
 }
});
test('Only current owner can answer the active quest; bonuses capped, replay cannot pay twice',()=>{
 const started=beginShift(initialState(),'vlad','gameFix','desktop');assert.ok(started.ok);
 const state=started.state,shift=state.activeShifts.vlad!,run=shift.quests![0];
 shift.targetPay=3420;
 const correct=correctQuestChoice(homeQuestContent(shift,run)!,run);
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
 const spec=homeQuestContent(shift,a)!;const correct=correctQuestChoice(spec,a);const wrong=spec.kind==="multi"?(correct===101?102:101):(correct+1)%a.order.length;
 const result=answerHomeQuest(state,'alina',a.nonce,wrong);assert.ok(result.ok);
 assert.equal(result.state.activeShifts.alina!.quests![0].result,'wrong');
 result.state.clock=clockAt(b.at);
 const skip=answerHomeQuest(result.state,'alina',b.nonce,-1);assert.ok(skip.ok);
 assert.equal(skip.state.activeShifts.alina!.quests![1].result,'skipped');
 assert.equal(shiftFullPay(skip.state.activeShifts.alina!),pay);
 state.clock=clockAt(shift.quests!.at(-1)!.until);expireHomeQuests(state);
 assert.equal(shift.quests!.every(q=>q.result==='skipped'),true);
 assert.equal(answerHomeQuest(state,'alina',b.nonce,0).ok,false);
 state.clock=clockAt(shift.endsAt);
 assert.equal(settleCompletedShifts(state).completed[0].payment,pay);
});

test('Multi-selection requires exact set, rejects empty or malformed choices, and preserves bonus once',()=>{
 const started=beginShift(initialState(),'alina','ozonCards','laptop');assert.ok(started.ok);
 const state=started.state,shift=state.activeShifts.alina!;
 const run=shift.quests!.find(q=>homeQuestContent(shift,q)?.kind==='multi')!;
 const spec=homeQuestContent(shift,run)!;shift.targetPay=2200;state.clock=clockAt(run.at);
 expireHomeQuests(state);
 const correct=correctQuestChoice(spec,run);
 for(const invalid of [0,100,116,NaN,101.2,'103'])assert.equal(answerHomeQuest(state,'alina',run.nonce,invalid).ok,false);
 const partial=answerHomeQuest(state,'alina',run.nonce,101);assert.ok(partial.ok);
 assert.equal(partial.state.activeShifts.alina!.quests!.find(q=>q.nonce===run.nonce)!.result,'wrong');
 const extra=answerHomeQuest(state,'alina',run.nonce,115);assert.ok(extra.ok);
 assert.equal(extra.state.activeShifts.alina!.targetPay,2200);
 const solved=answerHomeQuest(state,'alina',run.nonce,correct);assert.ok(solved.ok);
 assert.equal(solved.state.activeShifts.alina!.targetPay,2350);
 assert.equal(answerHomeQuest(solved.state,'alina',run.nonce,correct).ok,false);
});
test('Legacy two-hour home shift and original quiz indices remain readable',()=>{
 const started=beginShift(initialState(),'vlad','gameFix','desktop');assert.ok(started.ok);
 const shift=started.state.activeShifts.vlad!;shift.hours=2;shift.endsAt=shift.startedAt+120;
 shift.quests=shift.quests!.slice(0,2).map((q,i)=>({...q,index:i,order:[0,1,2],at:shift.startedAt+10+i*60,until:shift.startedAt+40+i*60}));
 assert.ok(validHomeQuests(shift as unknown as Record<string,unknown>));
 const malformed=structuredClone(shift);malformed.quests![0].order=[0,1,1];assert.equal(validHomeQuests(malformed as unknown as Record<string,unknown>),false);
});
