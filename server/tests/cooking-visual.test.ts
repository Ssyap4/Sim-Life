import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { RECIPES, TAKEOUT, GRILL_RECIPES, type RecipeId } from '../../src/shared/food';
import { kitchenMove, grillMove, helperChop, servingOffset, mealUtensil } from '../../src/game/CookingChoreography';
import { selectIndoorDish } from '../../src/game/MealArt';

test('All kitchen recipes move through preparation, meaningful cooking, and plating phases',()=>{
  for(const recipe of Object.keys(RECIPES) as RecipeId[]){
    if(GRILL_RECIPES.includes(recipe))continue;
    assert.notEqual(kitchenMove(recipe,.5),'plate',recipe);
    assert.ok(['whisk','chop','knead'].includes(kitchenMove(recipe,.5)),recipe);
    assert.ok(['stir','flip','knead'].includes(kitchenMove(recipe,5)),recipe);
    assert.equal(kitchenMove(recipe,10.5),'plate',recipe);
  }
  assert.equal(kitchenMove('omelette',1),'whisk');
  assert.equal(kitchenMove('pancakes',5),'flip');
  assert.equal(kitchenMove('homemadePizza',1),'knead');
  assert.equal(kitchenMove('pastaBolognese',6),'stir');
});

test('Each grilling category uses distinct turning, tossing, flipping or assembly gestures',()=>{
  assert.equal(grillMove('grillChicken',6),'turn');
  assert.equal(grillMove('grillSteak',6),'flip');
  assert.equal(grillMove('grillVegetables',6),'toss');
  assert.equal(grillMove('grillBurgers',10),'assemble');
  for(const recipe of GRILL_RECIPES)assert.equal(grillMove(recipe,13),'plate');
  assert.equal(helperChop(.5),true);
  assert.equal(helperChop(4),false);
});

test('Food appears as reusable 3D shapes, changes with dish, and clears old serving',()=>{
  const root=new THREE.Group();
  const ids=[...Object.keys(RECIPES),...Object.keys(TAKEOUT)] as Array<RecipeId|keyof typeof TAKEOUT>;
  for(const id of ids){
    selectIndoorDish(root,id);
    assert.equal(root.children.length,1,id);
    assert.ok(root.children[0].children.length>0,id);
  }
  selectIndoorDish(root,'omelette');
  const before=root.children[0];
  selectIndoorDish(root,'homemadePizza');
  assert.notEqual(root.children[0],before,'previous food is not left on the new plate');
  selectIndoorDish(root,'grillChicken');
  assert.equal(root.children.length,1);
});

test('Different foods use hands, forks or spoons, not one utensil for everything',()=>{
  assert.equal(mealUtensil('chickenSoup'),'spoon');
  assert.equal(mealUtensil('porridge'),'spoon');
  assert.equal(mealUtensil('grillChicken'),'fork');
  assert.equal(mealUtensil('chickenRice'),'fork');
  assert.equal(mealUtensil('homemadePizza'),'hands');
  assert.equal(mealUtensil('burgerCombo'),'hands');
});

test('Personal servings are bounded by real resized tabletops, not centered in space',()=>{
  for(const [w,d] of [[1.72,.93],[.95,.85],[2.45,.72]]){
    for(const [x,z] of [[3,0],[-3,-5],[.8,.6],[0,0]]){
      const point=servingOffset(w,d,x,z);
      assert.ok(Math.abs(point.x)<=w/2-.08+1e-9);
      assert.ok(Math.abs(point.z)<=d/2-.08+1e-9);
      assert.equal(Number.isFinite(point.x),true);
      assert.equal(Number.isFinite(point.z),true);
    }
  }
});
