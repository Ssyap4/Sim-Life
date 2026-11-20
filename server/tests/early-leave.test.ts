import { test } from 'node:test';
import assert from 'node:assert/strict';
import { initialState } from '../../src/shared/protocol';
import { shiftFullPay, shiftWage } from '../../src/shared/jobs';
import { beginShift, leaveShiftEarly, settleCompletedShifts } from '../jobs';
import { openServerFiles } from '../storage';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

function seededOzon() {
  const started=beginShift(initialState(),'vlad','ozon');
  assert.equal(started.ok,true);
  if(!started.ok)throw new Error('Expected job start');
  const state=started.state;
  const shift=state.activeShifts.vlad!;
  shift.hours=15;
  shift.endsAt=shift.startedAt+900;
  shift.targetPay=3875;
  return state;
}
test('Fair partial wages: 4h/5h/6h of 15h at Ozon pay 1033/1292/1550 rubles',()=>{
  for(const [hours,expected] of [[4,1033],[5,1292],[6,1550],[10,2583],[15,3875]]){
    const base=seededOzon();
    const shift=base.activeShifts.vlad!;
    const t=shift.startedAt+hours*60;
    base.clock.day=Math.floor(t/1440)+1;
    base.clock.minute=t%1440;
    assert.equal(shiftWage(shift,base.clock),expected);
    const res=hours===15 ? settleCompletedShifts(base) : null;
    const early=hours===15 ? null : leaveShiftEarly(base,'vlad');
    if(res){
      assert.equal(res.completed.length,1);
      assert.equal(res.completed[0].payment,expected);
      assert.equal(res.state.money,10000+expected);
    }
    if(early){
      assert.equal(early.ok,true);
      if(!early.ok)continue;
      assert.equal(early.state.money,10000+expected);
      assert.equal(early.state.ledger.length,1);
      assert.match(early.state.ledger[0].label,/досрочный уход/);
      assert.equal(early.state.activeShifts.vlad,undefined);
      assert.equal(early.state.shiftDays.vlad,early.state.clock.day);
      assert.equal(leaveShiftEarly(early.state,'vlad').ok,false);
      assert.equal(beginShift(early.state,'vlad','ozon').ok,false);
      // Working less than half the full shift should produce less than half the energy penalty.
      if(hours===4)assert.ok(early.state.characters.vlad.energy>65);
    }
  }
});
test('The full random salary is fixed once on the server and survives saves',()=>{
  const started=beginShift(initialState(),'alina','taxi');
  assert.equal(started.ok,true);
  if(!started.ok)return;
  const assignment=started.state.activeShifts.alina!;
  assert.ok(shiftFullPay(assignment)>=2500&&shiftFullPay(assignment)<=4500);
  const dir=mkdtempSync(join(tmpdir(),'sim-life-early-save-'));
  try{
    const files=openServerFiles(dir);
    files.save(started.state);
    const restored=files.load();
    assert.deepEqual(restored.activeShifts.alina,assignment);
    assert.equal(shiftFullPay(restored.activeShifts.alina!),shiftFullPay(assignment));
  } finally{rmSync(dir,{recursive:true,force:true});}
});
test('An older active shift without rolled salary still gets a stable pro-rated payout',()=>{
  const base=seededOzon();
  const shift=base.activeShifts.vlad!;
  delete shift.targetPay;
  const one=shiftFullPay(shift);
  const two=shiftFullPay(structuredClone(shift));
  assert.equal(one,two);
  assert.ok(one>=2500&&one<=5250);
  const worked=shift.startedAt+5*60;
  base.clock.day=Math.floor(worked/1440)+1;
  base.clock.minute=worked%1440;
  const result=leaveShiftEarly(base,'vlad');
  assert.equal(result.ok,true);
  if(!result.ok)return;
  assert.equal(result.state.money,10000+Math.round(one/3));
});
test('Leaving immediately pays zero but uses the day, while tomorrow offers work again',()=>{
  const base=beginShift(initialState(),'vlad','courier');
  assert.equal(base.ok,true);
  if(!base.ok)return;
  const result=leaveShiftEarly(base.state,'vlad');
  assert.equal(result.ok,true);
  if(!result.ok)return;
  assert.equal(result.state.money,10000);
  assert.equal(result.state.ledger.length,0);
  assert.equal(beginShift(result.state,'vlad','courier').ok,false);
  const tomorrow=structuredClone(result.state);
  tomorrow.clock.day++;
  assert.equal(beginShift(tomorrow,'vlad','courier').ok,true);
});
