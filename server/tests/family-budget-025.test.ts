import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync,writeFileSync,readFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {initialState} from '../../src/shared/protocol';
import {applyBudgetCommand} from '../familyBudget';
import {addLedger} from '../../src/shared/economy';
import {initialFamilyBudget,isSavingsGoal,validFamilyBudget,budgetPeriod,
  restoreFamilyBudget} from '../../src/shared/familyBudget';
import {openServerFiles} from '../storage';

test('Savings deposits and withdrawals conserve household wealth without fake ledger expenses',()=>{
  const state=initialState();
  state.money=15000;
  const total=state.money+state.savings.balance;
  const put=applyBudgetCommand(state,'vlad',{type:'budget_deposit',amount:4200});
  assert.equal(put.ok,true);
  if(!put.ok)return;
  assert.equal(put.state.money,10800);
  assert.equal(put.state.savings.balance,4200);
  assert.equal(state.money,15000,'old state remains unchanged until commit');
  assert.equal(put.state.ledger.length,0,'moving money is NOT spending');
  assert.equal(put.state.money+put.state.savings.balance,total);
  assert.equal(put.state.savings.history.at(-1)?.actor,'vlad');
  const take=applyBudgetCommand(put.state,'alina',{type:'budget_withdraw',amount:1200});
  assert.equal(take.ok,true);
  if(!take.ok)return;
  assert.equal(take.state.money,12000);
  assert.equal(take.state.savings.balance,3000);
  assert.equal(take.state.money+take.state.savings.balance,total);
  assert.deepEqual(take.state.savings.history.map(r=>r.kind),['deposit','withdraw']);
  assert.equal(take.state.savings.history[1].actor,'alina');
  assert.ok(take.state.revision>state.revision);
  assert.equal(validFamilyBudget(take.state.savings),true);
});
test('Impossible bank transfers and malformed commands never change money',()=>{
  const state=initialState();
  for(const amount of [0,-1,0.3,500001,Number.NaN,Number.POSITIVE_INFINITY,1.5]){
    const cmd={type:'budget_deposit' as const,amount};
    const result=applyBudgetCommand(state,'vlad',cmd);
    assert.equal(result.ok,false,String(amount));
  }
  assert.equal(applyBudgetCommand(state,'vlad',{type:'budget_deposit',amount:12000}).ok,false);
  assert.equal(applyBudgetCommand(state,'alina',{type:'budget_withdraw',amount:100}).ok,false);
  assert.equal(state.money,10000);
  assert.equal(state.savings.balance,0);
  assert.equal(state.revision,0);
  assert.equal(state.savings.history.length,0);
});
test('Money saved for future Alina studio is not automatically spendable for bills and groceries',()=>{
  const state=initialState();
  const goal=applyBudgetCommand(state,'alina',{type:'budget_goal',goal:'alinaStudio',target:180000});
  assert.equal(goal.ok,true);
  if(!goal.ok)return;
  assert.equal(goal.state.savings.goal,'alinaStudio');
  assert.equal(goal.state.savings.target,180000);
  const move=applyBudgetCommand(goal.state,'alina',{type:'budget_deposit',amount:9500});
  assert.equal(move.ok,true);
  if(!move.ok)return;
  assert.equal(move.state.money,500);
  assert.equal(move.state.savings.balance,9500);
  assert.equal(move.state.billing.bills.length,0);
  assert.equal(move.state.ledger.length,0);
  assert.equal(validFamilyBudget(move.state.savings),true);
  assert.equal(isSavingsGoal('alinaStudio'),true);
  assert.equal(isSavingsGoal('__invalid__'),false);
});
test('Real purchases are tallied by period independent of 40-entry ledger size',()=>{
  const state=initialState();
  for(let i=0;i<55;i++)
    addLedger(state,'vlad','expense','groceries',100,'Овощи '+i);
  assert.equal(state.ledger.length,40);
  assert.equal(state.savings.spent.groceries,5500);
  addLedger(state,'alina','expense','takeout',700,'Доставка роллов');
  addLedger(state,'vlad','expense','pets',450,'Корм для Верделла');
  addLedger(state,'family','expense','services',1200,'Домашний интернет');
  assert.equal(state.savings.spent.takeout,700);
  assert.equal(state.savings.spent.pets,450);
  assert.equal(state.savings.spent.groceries,5500);
  state.clock.day=11;state.clock.minute=100;
  addLedger(state,'vlad','expense','groceries',400,'Молоко и хлеб');
  assert.equal(budgetPeriod(state.clock),1);
  assert.deepEqual(state.savings.spent,{groceries:400,takeout:0,pets:0});
  assert.equal(state.savings.period,1);
});
test('Changing category limit is advisory, not a reset or removal of real expenses',()=>{
  const state=initialState();
  addLedger(state,'alina','expense','takeout',6000,'Пицца и суши');
  const updated=applyBudgetCommand(state,'vlad',{
    type:'budget_limit',category:'takeout',amount:1500,
  });
  assert.equal(updated.ok,true);
  if(!updated.ok)return;
  assert.equal(updated.state.savings.spent.takeout,6000);
  assert.equal(updated.state.savings.limits.takeout,1500);
  assert.equal(updated.state.money,state.money);
  assert.equal(state.savings.limits.takeout,3500);
  assert.equal(applyBudgetCommand(updated.state,'vlad',{
    type:'budget_limit',category:'takeout',amount:1000001,
  }).ok,false);
});
test('Old household JSON migrates savings once without resetting real cash, pets or careers',()=>{
  const dir=mkdtempSync(join(tmpdir(),'simlife-budget-025-'));
  try{
    const files=openServerFiles(dir);
    const state=initialState();
    state.money=18370;
    state.pets.simba.happiness=47;
    addLedger(state,'vlad','expense','groceries',830,'Покупки до обновления');
    const legacy=structuredClone(state) as unknown as Record<string,unknown>;
    delete legacy.savings;
    writeFileSync(join(dir,'household.json'),JSON.stringify(legacy));
    const loaded=files.load();
    assert.equal(loaded.money,18370);
    assert.equal(loaded.pets.simba.happiness,47);
    assert.equal(loaded.savings.balance,0);
    assert.equal(loaded.savings.spent.groceries,830);
    files.save(loaded);
    assert.equal(files.load().savings.spent.groceries,830);
    assert.equal(files.load().money,18370);
    const stored=JSON.parse(readFileSync(join(dir,'household.json'),'utf8'));
    assert.equal(stored.savings.balance,0);
    assert.equal(validFamilyBudget(stored.savings),true);
  }finally{rmSync(dir,{recursive:true,force:true});}
});
test('Malformed savings fields never wipe a saved household',()=>{
  const dir=mkdtempSync(join(tmpdir(),'simlife-budget-validation-'));
  try{
    const files=openServerFiles(dir);
    const state=initialState();
    state.money=9876;
    files.save(state);
    const json=JSON.parse(readFileSync(join(dir,'household.json'),'utf8'));
    json.savings.balance=-50;
    writeFileSync(join(dir,'household.json'),JSON.stringify(json));
    assert.throws(()=>files.load(),/invalid/i);
    const after=JSON.parse(readFileSync(join(dir,'household.json'),'utf8'));
    assert.equal(after.money,9876);
  }finally{rmSync(dir,{recursive:true,force:true});}
});
test('Savings history rejects malformed or duplicated movements',()=>{
  const state=initialFamilyBudget({day:1,minute:480});
  assert.equal(validFamilyBudget(state),true);
  state.history.push({id:1,day:1,minute:480,actor:'vlad',kind:'deposit',amount:500,goal:'reserve'});
  assert.equal(validFamilyBudget(state),true);
  state.history.push({...state.history[0]});
  assert.equal(validFamilyBudget(state),false);
  assert.equal(restoreFamilyBudget(undefined,{day:1,minute:480},[]).balance,0);
});
