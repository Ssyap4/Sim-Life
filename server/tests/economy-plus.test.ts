import { moveReadyFoodToTable } from '../../src/shared/readyFood';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JOBS, JOB_IDS } from '../../src/shared/jobs';
import { initialState } from '../../src/shared/protocol';
import { EMPTY_PANTRY, EMPTY_MEALS, EMPTY_TAKEOUT } from '../../src/shared/food';
import { storageUsage, FRIDGE_CAPACITY, CUPBOARD_CAPACITY } from '../../src/shared/storageSpace';
import { beginShift, settleCompletedShifts, leaveShiftEarly } from '../jobs';
import { checkout } from '../market';
import { applyFoodAction } from '../food';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { openServerFiles } from '../storage';

test('Exactly six varied jobs have the requested pay and work-hour ranges',()=>{
  assert.equal(JOB_IDS.length,6);
  const expected={taxi:[3700,6700,10,12],courier:[3200,6000,8,10],
    ozon:[5000,6800,14,16],wildberries:[5000,6800,14,16],petsitter:[2300,3300,6,7],driver:[3200,4500,7,8]};
  for(const [id,ranges] of Object.entries(expected)){
    const spec=JOBS[id as keyof typeof JOBS];
    assert.deepEqual([spec.payMin,spec.payMax,spec.hoursMin,spec.hoursMax],ranges);
    assert.equal(spec.stages.length,4);
    assert.ok(spec.description.length>60);
  }
  assert.match(JOBS.ozon.name,/Ozon/);
  assert.match(JOBS.wildberries.name,/Wildberries/);
});

test('Each shift persists until the scheduled game time and pays once within its random range',()=>{
 for(const id of JOB_IDS){
   const start=beginShift(initialState(),'vlad',id);
   assert.equal(start.ok,true);if(!start.ok)continue;
   const job=JOBS[id],assignment=start.state.activeShifts.vlad!;
   assert.ok(assignment.hours>=job.hoursMin&&assignment.hours<=job.hoursMax);
   assert.equal(assignment.endsAt-assignment.startedAt,assignment.hours*60);
   assert.equal(start.state.money,10000);
   assert.equal(beginShift(start.state,'vlad',id).ok,false);
   const before=structuredClone(start.state);
   const early=assignment.endsAt-1;
   before.clock.day=Math.floor(early/1440)+1;before.clock.minute=early%1440;
   assert.equal(settleCompletedShifts(before).completed.length,0);
   const full=structuredClone(before),done=assignment.endsAt;
   full.clock.day=Math.floor(done/1440)+1;full.clock.minute=done%1440;
   const settled=settleCompletedShifts(full);
   assert.equal(settled.completed.length,1);
   const rub=settled.completed[0].payment;
   assert.ok(Number.isInteger(rub)&&rub>=job.payMin&&rub<=job.payMax);
   assert.equal(settled.state.money,10000+rub);
   assert.equal(settled.state.activeShifts.vlad,undefined);
   assert.equal(settled.state.ledger.length,1);
   assert.equal(settleCompletedShifts(settled.state).completed.length,0);
   assert.equal(beginShift(settled.state,'vlad',id).ok,false);
 }
});

test('Immediate early leave pays zero; exhaustion and invalid IDs are rejected',()=>{
 const base=initialState();
 assert.equal(beginShift(base,'alina','__proto__').ok,false);
 const tired=structuredClone(base);tired.characters.alina.energy=0;
 assert.equal(beginShift(tired,'alina','taxi').ok,false);
 const start=beginShift(base,'alina','taxi');
 assert.equal(start.ok,true);if(!start.ok)return;
 const canceled=leaveShiftEarly(start.state,'alina');
 assert.equal(canceled.ok,true);if(!canceled.ok)return;
 assert.equal(canceled.state.money,10000);
 assert.deepEqual(canceled.state.activeShifts,{});
 assert.equal(canceled.state.ledger.length,0);
 assert.equal(leaveShiftEarly(canceled.state,'alina').ok,false);
});

test('Refrigerator holds 36 food cells; serving and eating a portion frees room for groceries',()=>{
 const state=initialState();
 state.pantry={...EMPTY_PANTRY};state.meals={...EMPTY_MEALS};state.takeout={...EMPTY_TAKEOUT};
 state.money=30000;state.meals.omelette=FRIDGE_CAPACITY/2;
 assert.equal(storageUsage(state).fridge,FRIDGE_CAPACITY);
 assert.equal(checkout(state,'vlad',[{id:'grocery:milk',quantity:1}]).ok,false);
 assert.equal(applyFoodAction(state,'vlad',{type:'buy',item:'milk'}).ok,false);
 assert.equal(state.money,30000);
 assert.equal(moveReadyFoodToTable(state,'meal','omelette'),true,
   'one portion must first be moved out of the fridge onto the table');
 const ate=applyFoodAction(state,'alina',{type:'eat',recipe:'omelette'});
 assert.equal(ate.ok,true);if(!ate.ok)return;
 const bought=checkout(ate.state,'vlad',[{id:'grocery:milk',quantity:1}]);
 assert.equal(bought.ok,true);if(!bought.ok)return;
 assert.equal(storageUsage(bought.state).fridge,FRIDGE_CAPACITY-1);
 const eggs=structuredClone(ate.state);eggs.meals.omelette=0;eggs.readyFood=[];eggs.pantry.eggs=10;
 assert.equal(storageUsage(eggs).fridge,1);
 assert.ok(CUPBOARD_CAPACITY>=40);
});

test('Older saves retain cash and skill and acquire valid work slots on migration',()=>{
 const dir=mkdtempSync(join(tmpdir(),'sim-life-job-compat-'));
 try{
  const files=openServerFiles(dir),old=files.load();
  old.money=42420;old.characters.alina.skill=68;
  writeFileSync(join(dir,'household.json'),JSON.stringify({...old,activeShifts:undefined}));
  const current=files.load();
  assert.deepEqual(current.activeShifts,{});
  assert.equal(current.money,42420);
  assert.equal(current.characters.alina.skill,68);
  const start=beginShift(current,'alina','ozon');
  assert.equal(start.ok,true);if(!start.ok)return;
  files.save(start.state);
  assert.equal(files.load().activeShifts.alina?.job,'ozon');
 }finally{rmSync(dir,{recursive:true,force:true});}
});
