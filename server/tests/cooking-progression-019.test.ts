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
  assert.equal(COOKING_RECIPES.grillSteak.minLevel, 6);
  assert.equal(COOKING_RECIPES.pancakes.minLevel,3);
  assert.equal(COOKING_RECIPES.buckwheatChicken.minLevel,2);
  assert.equal(COOKING_RECIPES.homemadePizza.minLevel,4);
  assert.equal(COOKING_RECIPES.beefWellington.minLevel,18);
  assert.equal(COOKING_RECIPES.chocolateFondant.minLevel,20);
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
  if (!locked.available) assert.match(locked.reason, /уровня 6/);
  const refused = applyFoodAction(initial,'vlad',{type:'cook',recipe:id});
  assert.equal(refused.ok,false);
  assert.deepEqual(initial.pantry, before.pantry);
  assert.deepEqual(initial.readyFood, before.readyFood);
  initial.education.characters.vlad.xp.cooking = levelXP(6);
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
  assert.equal(cookingEnergy(0,'grillSteak'),5);
  assert.ok(cookingEnergy(20,'grillSteak')<5);
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


test('restaurant dishes progressively unlock at levels 7 through 20 with real ingredient requirements', () => {
  const advanced = ['lasagna','mushroomRisotto','beefStroganoff','salmonLemon',
    'creamyChicken','shrimpLinguine','duckOrange','pepperMedallions','pannaCotta',
    'cremeBrulee','lambRosemary','beefWellington','seaBassRisotto','chocolateFondant'] as RecipeId[];
  for (const [i,id] of advanced.entries()) {
    const required=i+7;
    assert.equal(COOKING_RECIPES[id].minLevel,required,id);
    const state=initialState();
    for(const [key,qty] of ingredientList(id))state.pantry[key]=qty;
    if(required>0) {
      state.education.characters.alina.xp.cooking=levelXP(required-1);
      assert.equal(recipeAvailability(state,'alina',id).available,false,id+' locked');
    }
    state.education.characters.alina.xp.cooking=levelXP(required);
    assert.equal(recipeAvailability(state,'alina',id).available,true,id+' unlocked');
    const cooked=applyFoodAction(state,'alina',{type:'cook',recipe:id});
    assert.ok(cooked.ok,id+': '+(!cooked.ok?cooked.reason:''));
    if(cooked.ok) {
      assert.equal(cooked.state.meals[id],RECIPES[id].servings,id);
      assert.equal(cooked.state.readyFood.at(-1)?.item,id);
      for(const [key] of ingredientList(id))
        assert.equal(cooked.state.pantry[key],0,id+': '+key);
    }
  }
});

import {cookingSeconds} from '../../src/shared/cookingProgression';
import {planTask} from '../tasks';
import {socialDuration} from '../society';
import {SOCIAL_BY_ID} from '../../src/shared/socialLife';

test('Every recipe uses shared complexity-based timing for solo and paired cooking',()=>{
  for(const id of COOKING_ORDER){
    const solo=cookingSeconds(id);
    assert.ok(solo>=12&&solo<=42);
    assert.equal(planTask({type:'cook',recipe:id})?.durationMs,solo*1000);
    const pair=socialDuration(SOCIAL_BY_ID.get('cook')!,{type:'together',action:'cook',item:id});
    assert.equal(pair,Math.max(10,Math.ceil(solo*.8))*1000);
    assert.ok(pair<solo*1000);
    assert.equal(planTask({type:'eat',recipe:id})?.durationMs,32000);
  }
  assert.equal(cookingSeconds('omelette'),12);
  assert.equal(cookingSeconds('beefWellington'),42);
  assert.ok(cookingSeconds('chickenRice')>cookingSeconds('omelette'));
  assert.ok(cookingSeconds('grillSteak')>cookingSeconds('grillVegetables'));
});

test('Soaking is between a shower and a foam bath, not a cheap instant full recovery',()=>{
  assert.equal(planTask({type:'act',actionId:'bathShower'})?.durationMs,38000);
  assert.equal(planTask({type:'act',actionId:'bathSoak'})?.durationMs,55000);
  assert.equal(planTask({type:'act',actionId:'bathFoam'})?.durationMs,75000);
});