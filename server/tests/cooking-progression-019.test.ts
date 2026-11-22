import {test} from 'node:test';
import assert from 'node:assert/strict';
import {initialState} from '../../src/shared/protocol';
import {levelXP, maximumXP, skillRank} from '../../src/shared/education';
import {RECIPES, ingredientList, isGrillRecipe, type RecipeId} from '../../src/shared/food';
import {COOKING_ORDER, COOKING_RECIPES, cookingEnergy, cookingExperience} from '../../src/shared/cookingProgression';
import {recipeAvailability} from '../../src/shared/recipeAvailability';
import {applyFoodAction} from '../food';
import {awardCooking} from '../education';

test('every kitchen/grill recipe has an ordered, reachable cooking tier', () => {
  assert.deepEqual([...COOKING_ORDER].sort(), (Object.keys(RECIPES) as RecipeId[]).sort());
  assert.equal(COOKING_ORDER[0], 'toast');
  assert.equal(COOKING_RECIPES.toast.minLevel, 0);
  assert.equal(COOKING_RECIPES.grillSteak.minLevel, 18);
  for (const id of COOKING_ORDER) {
    const recipe = COOKING_RECIPES[id];
    assert.ok(recipe.minLevel >= 0 && recipe.minLevel <= 20);
    assert.ok(recipe.baseXP >= 20);
    assert.ok(ingredientList(id).length > (isGrillRecipe(id) ? 2 : 0));
  }
  for (let i = 1; i < COOKING_ORDER.length; i++)
    assert.ok(COOKING_RECIPES[COOKING_ORDER[i]].minLevel >= COOKING_RECIPES[COOKING_ORDER[i-1]].minLevel);
});

test('server locks higher recipes by personal skill before spending ingredients or fuel', () => {
  const initial = initialState();
  const id: RecipeId = 'grillSteak';
  for (const [ingredient, amount] of ingredientList(id)) initial.pantry[ingredient] = amount;
  const before = structuredClone(initial);
  const locked = recipeAvailability(initial, 'vlad', id);
  assert.equal(locked.available, false);
  if (!locked.available) assert.match(locked.reason, /уровня 18/);
  const refused = applyFoodAction(initial,'vlad',{type:'cook',recipe:id});
  assert.equal(refused.ok,false);
  assert.deepEqual(initial.pantry, before.pantry);
  assert.deepEqual(initial.readyFood, before.readyFood);
  initial.education.characters.vlad.xp.cooking = levelXP(18);
  const available = recipeAvailability(initial,'vlad',id);
  assert.equal(available.available,true);
  const cooked = applyFoodAction(initial,'vlad',{type:'cook',recipe:id});
  assert.ok(cooked.ok, !cooked.ok ? cooked.reason : '');
  if (cooked.ok) {
    assert.equal(cooked.state.pantry.charcoal,0);
    assert.equal(cooked.state.pantry.lighterFluid,0);
    assert.equal(cooked.state.readyFood.at(-1)?.storage,'table');
  }
});

test('successful cooking grants personal XP; repetition and overqualification reduce it', () => {
  const state=initialState();
  const profile=state.education.characters.vlad;
  const first=cookingExperience(profile,'vlad','toast');
  assert.ok(first>=25);
  const earned=awardCooking(state,'vlad','toast');
  assert.equal(earned,first);
  assert.equal(profile.studied['life:recipe:toast'].completions,1);
  const second=cookingExperience(profile,'vlad','toast');
  assert.ok(second<first);
  for(let i=0;i<19;i++)awardCooking(state,'vlad','toast');
  assert.ok(cookingExperience(profile,'vlad','toast')<=second);
  profile.xp.cooking=levelXP(16);
  assert.ok(cookingExperience(profile,'vlad','toast')<cookingExperience(profile,'vlad','beefStew'));
  const other=state.education.characters.alina;
  assert.equal(other.xp.cooking,0,'cooking experience is personal');
  const helping=cookingExperience(other,'alina','toast',true);
  assert.ok(helping<cookingExperience(other,'alina','toast'));
  assert.equal(cookingEnergy(0,'grillSteak'),8);
  assert.ok(cookingEnergy(20,'grillSteak')<8);
  profile.xp.cooking=maximumXP;
  assert.equal(skillRank(profile.xp.cooking).level,20);
  assert.equal(awardCooking(state,'vlad','toast'),0);
});

test('basic cooking works at level 0 but intermediate kitchen recipes require training',()=>{
  const state=initialState();
  state.pantry.bread=4;
  state.pantry.cheese=2;
  const result=applyFoodAction(state,'alina',{type:'cook',recipe:'toast'});
  assert.ok(result.ok,!result.ok?result.reason:'');
  if(result.ok)assert.equal(result.state.readyFood[0].storage,'table');
  assert.equal(recipeAvailability(state,'alina','pastaBolognese').available,false);
  state.education.characters.alina.xp.cooking=levelXP(12);
  assert.notEqual(cookingExperience(state.education.characters.alina,'alina','pastaBolognese'),0);
});
