import { moveReadyFoodToTable } from '../../src/shared/readyFood';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { GROCERIES, RECIPES, TAKEOUT, ingredientList, recipePortionCost } from '../../src/shared/food';
import { GROCERY_DETAILS } from '../../src/shared/storageSpace';
import { MARKET_PRODUCTS } from '../../src/shared/market';
import { initialState } from '../../src/shared/protocol';
import { checkout } from '../market';
import { applyTakeoutMeal } from '../food';
import { beginShift, settleCompletedShifts } from '../jobs';
import { openServerFiles } from '../storage';

test('Moscow-region benchmark prices make takeaway more expensive than home cooking', () => {
  assert.equal(GROCERIES.milk.price, 95);
  assert.equal(GROCERIES.bread.price, 45);
  assert.equal(GROCERIES.mince.price, 320);
  assert.equal(GROCERIES.beef.price, 790);
  assert.equal(GROCERIES.eggs.price, 190);
  assert.ok(TAKEOUT.pizzaBig.price >= 2500);
  assert.ok(TAKEOUT.rollsSet.price >= 2000);
  assert.ok(recipePortionCost('homemadePizza') < TAKEOUT.pizzaCheese.price / TAKEOUT.pizzaCheese.quantity);
  assert.ok(MARKET_PRODUCTS.length >= 30);
  assert.ok(Object.keys(RECIPES).length >= 12);
});

test('An atomic mixed basket purchases groceries, takeaway and pet supplies with one charge', () => {
  const original=initialState();
  const lines=[
    {id:'grocery:milk',quantity:1},{id:'grocery:bread',quantity:1},
    {id:'takeout:pizzaCheese',quantity:1},{id:'pet:verdell',quantity:1},
  ];
  const result=checkout(original,'vlad',lines);
  assert.equal(result.ok,true);
  if (!result.ok) return;
  assert.equal(result.state.money, 10000-95-45-850-650);
  assert.equal(result.state.pantry.milk,1);
  assert.equal(result.state.pantry.bread,11);
  assert.equal(result.state.takeout.pizzaCheese,2);
  assert.equal(result.state.petFood.verdell,12);
  assert.equal(result.state.ledger.length,3);
  assert.deepEqual(result.state.ledger.map(e=>[e.category,e.amount]),[['groceries',140],['takeout',850],['pets',650]]);
  assert.equal(result.state.ledger.reduce((n,e)=>n+e.amount,0),1640);
  assert.ok(result.state.ledger.every(e=>e.actor==='vlad'));
  assert.deepEqual(result.state.savings.spent,{groceries:140,takeout:850,pets:650});
  assert.equal(result.state.revision,1);
  assert.equal(original.money,10000);
  assert.equal(original.takeout.pizzaCheese,0);
});

test('Bad cart contents, overspend and capacity violations never mutate game state', () => {
  const source=initialState();
  source.money=2500; // Force a low-budget scenario for the overspend check.
  const bad=[
    [{id:'takeout:rollsPremium',quantity:1}], // costs 2990
    [{id:'grocery:milk',quantity:0}],
    [{id:'grocery:milk',quantity:-1}],
    [{id:'grocery:milk',quantity:1.5}],
    [{id:'grocery:milk',quantity:1},{id:'grocery:milk',quantity:1}],
    [{id:'grocery:__proto__',quantity:1}],
    [{id:'pet:simba',quantity:10}],
    [{id:'grocery:milk',quantity:11}],
    [{id:'grocery:bread',quantity:10},{id:'grocery:bread',quantity:1}],
  ];
  for (const lines of bad) assert.equal(checkout(source,'alina',lines).ok,false);
  source.pantry.bread=98;
  assert.equal(checkout(source,'vlad',[{id:'grocery:bread',quantity:1}]).ok,false);
  assert.equal(source.money,2500);
  assert.equal(source.ledger.length,0);
  assert.equal(source.revision,0);
});

test('Takeaway is shared, eaten at the table, and consumed only once per portion', () => {
  const bought=checkout(initialState(),'alina',[{id:'takeout:pizzaCheese',quantity:1}]);
  assert.equal(bought.ok,true);
  if(!bought.ok)return;
  assert.equal(moveReadyFoodToTable(bought.state,'takeout','pizzaCheese'),true);
  assert.equal(moveReadyFoodToTable(bought.state,'takeout','pizzaCheese'),true);
  const first=applyTakeoutMeal(bought.state,'vlad','pizzaCheese');
  assert.equal(first.ok,true);
  if(!first.ok)return;
  assert.equal(first.state.takeout.pizzaCheese,1);
  assert.equal(first.state.characters.vlad.pose,'sit');
  const second=applyTakeoutMeal(first.state,'alina','pizzaCheese');
  assert.equal(second.ok,true);
  if(!second.ok)return;
  assert.equal(second.state.takeout.pizzaCheese,0);
  assert.equal(applyTakeoutMeal(second.state,'alina','pizzaCheese').ok,false);
  assert.equal(bought.state.takeout.pizzaCheese,2);
});

test('Server clock pays a side shift only after a full workday',()=>{
 const start=beginShift(initialState(),'vlad','taxi');
 assert.equal(start.ok,true);
 if(!start.ok)return;
 const due=start.state.activeShifts.vlad!;
 const snap=structuredClone(start.state);
 snap.clock.day=Math.floor(due.endsAt/1440)+1;
 snap.clock.minute=due.endsAt%1440;
 const settled=settleCompletedShifts(snap);
 assert.equal(settled.completed.length,1);
 assert.ok(settled.completed[0].payment>=3700&&settled.completed[0].payment<=6700);
 assert.equal(settled.state.money,10000+settled.completed[0].payment);
 assert.equal(settled.state.ledger.length,1);
 assert.equal(settleCompletedShifts(settled.state).completed.length,0);
});

test('Older saves gain pantry items, takeout, ledger and shift data without resetting savings', () => {
  const dir=mkdtempSync(join(tmpdir(),'sim-life-market-migrate-'));
  try {
    const files=openServerFiles(dir);
    const old=files.load();
    old.money=13245;
    old.characters.alina.skill=47;
    old.pantry.eggs=7;
    const legacy={...old,pantry:{eggs:7,bread:2},
      takeout:undefined,ledger:undefined,shiftDays:undefined,activeShifts:undefined};
    writeFileSync(join(dir,'household.json'),JSON.stringify(legacy));
    const state=files.load();
    assert.equal(state.money,13245);
    assert.equal(state.characters.alina.skill,47);
    assert.equal(state.pantry.eggs,7);
    assert.equal(state.pantry.pasta,0);
    assert.equal(state.takeout.rollsSet,0);
    assert.deepEqual(state.ledger,[]);
    assert.deepEqual(state.shiftDays,{vlad:0,alina:0});
    assert.deepEqual(state.activeShifts,{});
    files.save(state);
    assert.equal(files.load().money,13245);
  } finally {rmSync(dir,{recursive:true,force:true});}
});


test('restaurant ingredients are real grocery products in market and delivery catalogue',()=>{
  const advanced=['lasagna','mushroomRisotto','beefStroganoff','salmonLemon',
    'creamyChicken','shrimpLinguine','duckOrange','pepperMedallions','pannaCotta',
    'cremeBrulee','lambRosemary','beefWellington','seaBassRisotto','chocolateFondant'] as const;
  const state=initialState();
  for (const id of advanced){
    for (const [ingredient] of ingredientList(id)){
      assert.ok(GROCERIES[ingredient],id+': '+ingredient);
      assert.ok(GROCERY_DETAILS[ingredient],id+' storage: '+ingredient);
      assert.ok(MARKET_PRODUCTS.some(p=>p.id==='grocery:'+ingredient),id+' market: '+ingredient);
      assert.equal(typeof state.pantry[ingredient],'number',id+' saved: '+ingredient);
    }
  }
  assert.equal(MARKET_PRODUCTS.find(p=>p.id==='grocery:salmon')?.category,'fish');
  assert.equal(MARKET_PRODUCTS.find(p=>p.id==='grocery:arborio')?.category,'pantry');
  const cart=checkout(state,'vlad',[{id:'grocery:mushroom',quantity:1}]);
  assert.equal(cart.ok,true);
  if(cart.ok)assert.equal(cart.state.pantry.mushroom,GROCERIES.mushroom.quantity);
});
