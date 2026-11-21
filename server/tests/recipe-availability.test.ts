import { test } from 'node:test';
import assert from 'node:assert/strict';
import { initialState } from '../../src/shared/protocol';
import { recipeAvailability } from '../../src/shared/recipeAvailability';
import { applyFoodAction } from '../food';
import { diningLocation } from '../../src/shared/furnitureUse';

test('Grill menu accepts bought chicken and onion with no oil',()=>{
  const state=initialState();
  state.pantry.chicken=5;
  state.pantry.onion=8;
  state.pantry.oil=0;
  assert.equal(recipeAvailability(state,'vlad','grillChicken').available,true);
  const cooked=applyFoodAction(state,'vlad',{type:'cook',recipe:'grillChicken'});
  assert.ok(cooked.ok,!cooked.ok?cooked.reason:'');
});

test('Missing ingredient, low energy and full refrigerator have specific reasons',()=>{
  const state=initialState();
  state.pantry.chicken=2;
  state.pantry.onion=1;
  state.pantry.oil=0;
  state.pantry.chicken=0;
  const missing=recipeAvailability(state,'vlad','grillChicken');
  assert.equal(missing.available,false);
  if(!missing.available)assert.match(missing.reason,/Курица/);
  state.pantry.chicken=2;
  state.characters.vlad.energy=0;
  const tired=recipeAvailability(state,'vlad','grillChicken');
  assert.equal(tired.available,false);
  if(!tired.available)assert.match(tired.reason,/энергии/);
  state.characters.vlad.energy=100;
  state.meals.omelette=16;
  const full=recipeAvailability(state,'vlad','grillChicken');
  assert.equal(full.available,false);
  if(!full.available)assert.match(full.reason,/холодильнике/);
  const refused=applyFoodAction(state,'vlad',{type:'cook',recipe:'grillChicken'});
  assert.equal(refused.ok,false);
  if(!refused.ok)assert.equal(refused.reason,full.available?'':full.reason);
  assert.equal(state.pantry.chicken,2,'failed cooking cannot spend ingredients');
});

test('Two chairs beside one rotated replacement table are assigned to separate residents',()=>{
  const state=initialState();
  state.furnishing.soldFixtures=['table'];
  state.furnishing.placed=[
    {id:1,sku:'table-family',finish:'sage',x:2.39,z:-2.22,rotation:0},
    {id:2,sku:'chair-dining',finish:'sage',x:1.03,z:-2.22,rotation:0},
    {id:3,sku:'chair-dining',finish:'sage',x:3.75,z:-2.22,rotation:0},
  ];
  const v=diningLocation(state,'vlad',1);
  const a=diningLocation(state,'alina',1);
  assert.ok(v&&a,'both characters must find valid access to the bought table');
  if(v&&a){
    assert.equal(v.seated,true);
    assert.equal(a.seated,true);
    assert.ok('chairId' in v && 'chairId' in a);
    if('chairId' in v && 'chairId' in a)
      assert.notEqual(v.chairId,a.chairId,'one chair per person');
  }
});
