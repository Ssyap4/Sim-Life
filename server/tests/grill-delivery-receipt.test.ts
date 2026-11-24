import assert from 'node:assert/strict';
import { test } from 'node:test';
import { GRILL_RECIPES, RECIPES, ingredientList, isGrillRecipe } from '../../src/shared/food';
import { basketPrice, MARKET_BY_ID } from '../../src/shared/market';
import { recipeAvailability } from '../../src/shared/recipeAvailability';
import { DELIVERY_FEE, approachFor, stationById } from '../../src/shared/locations';
import { clockAt } from '../../src/shared/life';
import { initialState } from '../../src/shared/protocol';
import { levelXP } from '../../src/shared/education';
import { applyFoodAction } from '../food';
import { applyWorld } from '../locations';
import { checkout } from '../market';

/** Ingredient/fuel tests start with a cook who already knows every grilled recipe. */
function skilledState() {
  const state=initialState();
  state.education.characters.vlad.xp.cooking=levelXP(18);
  state.education.characters.alina.xp.cooking=levelXP(18);
  return state;
}

test('Every grill recipe requires both ignition supplies, but ordinary kitchen recipes do not', () => {
  assert.equal(isGrillRecipe('grillChicken'), true);
  assert.deepEqual(ingredientList('grillChicken'), [
    ['chicken',2],['onion',1],['charcoal',1],['lighterFluid',1],
  ]);
  for (const recipe of GRILL_RECIPES) {
    assert.deepEqual(ingredientList(recipe).slice(-2),[
      ['charcoal',1],['lighterFluid',1],
    ],recipe);
    const state=skilledState();
    for(const [item,count] of ingredientList(recipe))state.pantry[item]=count;
    state.pantry.charcoal=0;
    const noCoal=recipeAvailability(state,'vlad',recipe);
    assert.equal(noCoal.available,false,recipe);
    if(!noCoal.available)assert.match(noCoal.reason,/уголь/i,recipe);
    state.pantry.charcoal=1;
    state.pantry.lighterFluid=0;
    const noFluid=recipeAvailability(state,'vlad',recipe);
    assert.equal(noFluid.available,false,recipe);
    if(!noFluid.available)assert.match(noFluid.reason,/розжига/i,recipe);
    state.pantry.lighterFluid=1;
    assert.equal(recipeAvailability(state,'vlad',recipe).available,true,recipe);
  }
  assert.equal(ingredientList('omelette').some(([id])=>id==='charcoal'||id==='lighterFluid'),false);
});

test('Chicken skewers use chicken, onion and one portion of each fuel, but never oil', () => {
  const state=skilledState();
  Object.assign(state.pantry,{chicken:2,onion:1,oil:0,charcoal:2,lighterFluid:2});
  const cooked=applyFoodAction(state,'vlad',{type:'cook',recipe:'grillChicken'});
  assert.ok(cooked.ok,!cooked.ok?cooked.reason:'');
  if(!cooked.ok)return;
  assert.equal(cooked.state.pantry.chicken,0);
  assert.equal(cooked.state.pantry.onion,0);
  assert.equal(cooked.state.pantry.oil,0);
  assert.equal(cooked.state.pantry.charcoal,1);
  assert.equal(cooked.state.pantry.lighterFluid,1);
  assert.equal(cooked.state.meals.grillChicken,RECIPES.grillChicken.servings);
  assert.equal(cooked.state.readyFood.find(b=>b.item==='grillChicken')?.portions,3);
  assert.equal(state.pantry.charcoal,2,'Never mutate the original state');
});

test('Missing fuel blocks cooking without consuming any food or materials',()=>{
  const state=skilledState();
  Object.assign(state.pantry,{chicken:2,onion:1,charcoal:0,lighterFluid:1});
  let fail=applyFoodAction(state,'vlad',{type:'cook',recipe:'grillChicken'});
  assert.equal(fail.ok,false);
  if(!fail.ok)assert.match(fail.reason,/уголь/i);
  assert.equal(state.pantry.chicken,2);
  state.pantry.charcoal=1;
  state.pantry.lighterFluid=0;
  fail=applyFoodAction(state,'vlad',{type:'cook',recipe:'grillChicken'});
  assert.equal(fail.ok,false);
  if(!fail.ok)assert.match(fail.reason,/розжига/i);
  assert.equal(state.pantry.charcoal,1);
  assert.equal(state.pantry.chicken,2);
  assert.equal(state.meals.grillChicken,0);
});

test('Supermarket stocks both grill supplies immediately with only the shelf price',()=>{
  assert.ok(MARKET_BY_ID.has('grocery:charcoal'));
  assert.ok(MARKET_BY_ID.has('grocery:lighterFluid'));
  assert.equal(MARKET_BY_ID.get('grocery:charcoal')?.category,'grill');
  assert.equal(MARKET_BY_ID.get('grocery:lighterFluid')?.category,'grill');
  const state=initialState();
  const lines=[{id:'grocery:charcoal',quantity:1},{id:'grocery:lighterFluid',quantity:1}];
  const result=checkout(state,'alina',lines);
  assert.ok(result.ok,!result.ok?result.reason:'');
  if(!result.ok)return;
  assert.equal(result.state.money,state.money-600);
  assert.equal(result.state.pantry.charcoal,5);
  assert.equal(result.state.pantry.lighterFluid,10);
});

test('Delivery adds fuel to the order, itemizes 149 RUB once, and then cooks skewers',()=>{
  const state=skilledState();
  const lines=['chicken','onion','charcoal','lighterFluid'].map(id=>({id:'grocery:'+id,quantity:1}));
  const goods=basketPrice(lines);
  assert.equal(goods,1110);
  assert.equal(DELIVERY_FEE,149);
  const ordered=applyWorld(state,'alina',{type:'delivery_order',sequence:0,lines});
  assert.ok(ordered.ok,!ordered.ok?ordered.reason:'');
  if(!ordered.ok)return;
  const total=goods+DELIVERY_FEE;
  assert.equal(ordered.state.money,state.money-total);
  assert.equal(ordered.state.world.deliveries[0]?.cost,total);
  assert.equal(ordered.state.ledger.at(-1)?.amount,total);
  assert.match(ordered.state.ledger.at(-1)?.label??'',/товары 1110 ₽ \+ доставка 149 ₽/);
  assert.match(ordered.message,/товары 1110 ₽ \+ доставка 149 ₽ = 1259 ₽/);
  const parcel=ordered.state.world.deliveries[0];
  const ready=structuredClone(ordered.state);
  ready.clock=clockAt(parcel.readyAt+1);
  Object.assign(ready.characters.vlad,approachFor(stationById('home','courier-handoff')!,'vlad'));
  const handed=applyWorld(ready,'vlad',{type:'delivery_handoff',id:parcel.id});assert.ok(handed.ok);
  Object.assign(handed.state.characters.vlad,approachFor(stationById('home','parcel')!,'vlad'));
  const claimed=applyWorld(handed.state,'vlad',{type:'delivery_claim',id:parcel.id});
  assert.ok(claimed.ok,!claimed.ok?claimed.reason:'');
  if(!claimed.ok)return;
  assert.equal(claimed.state.money,ordered.state.money,'Do not charge delivery twice');
  assert.equal(claimed.state.pantry.chicken,5);
  assert.equal(claimed.state.pantry.onion,8);
  assert.equal(claimed.state.pantry.charcoal,5);
  assert.equal(claimed.state.pantry.lighterFluid,10);
  const cooked=applyFoodAction(claimed.state,'alina',{type:'cook',recipe:'grillChicken'});
  assert.ok(cooked.ok,!cooked.ok?cooked.reason:'');
  if(!cooked.ok)return;
  assert.equal(cooked.state.pantry.chicken,3);
  assert.equal(cooked.state.pantry.onion,7);
  assert.equal(cooked.state.pantry.charcoal,4);
  assert.equal(cooked.state.pantry.lighterFluid,9);
  assert.equal(cooked.state.meals.grillChicken,3);
});

test('Missing chicken or onion still prevents cooking after purchasing fuel',()=>{
  const state=skilledState();
  Object.assign(state.pantry,{chicken:2,onion:0,charcoal:1,lighterFluid:1});
  const result=applyFoodAction(state,'vlad',{type:'cook',recipe:'grillChicken'});
  assert.equal(result.ok,false);
  if(!result.ok)assert.match(result.reason,/Лук/);
  assert.equal(state.pantry.chicken,2);
  assert.equal(state.pantry.charcoal,1);
});
