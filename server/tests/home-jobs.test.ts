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
