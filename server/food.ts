import {recordRecipe} from '../src/shared/personalCollections';
import {freshFish,isCatchRecipe} from '../src/shared/lake';
import {foodIllness} from '../src/shared/health';
import {recordEmotion} from '../src/shared/emotions';
import { cookingQuality, foodQualityEffect, qualityLabel } from '../src/shared/foodQuality';
import { recipeAvailability } from '../src/shared/recipeAvailability';
import { GROCERIES, RECIPES, TAKEOUT,isHomeDrink, ingredientList, isGrillRecipe, type IngredientId, type RecipeId, type TakeoutId } from '../src/shared/food';
import { homeSeat } from '../src/shared/home';
import { addDirtyDish } from '../src/shared/dirtyDishes';
import { addLedger } from '../src/shared/economy';
import { storageCanFit } from '../src/shared/storageSpace';
import { addReadyFood, consumeReadyFood, consumeReadyPortion, expireReadyFood, reconcileReadyFood } from '../src/shared/readyFood';
import { names, points, type CharacterId, type GameState } from '../src/shared/protocol';

export type FoodCommand =
  | { type: 'buy'; item: string }
  | { type: 'cook'; recipe: string }
  | { type: 'eat'; recipe: string };
export type FoodResult = { ok: true; state: GameState; message: string } | { ok: false; reason: string };

const owns = <T extends object>(record: T, key: string): key is Extract<keyof T, string> =>
  Object.prototype.hasOwnProperty.call(record, key);

export function applyFoodAction(source: GameState, role: CharacterId, command: FoodCommand, random:()=>number=Math.random,freshlyCooked=false): FoodResult {
  const state = structuredClone(source);
  reconcileReadyFood(state);
  expireReadyFood(state);
  const actor = state.characters[role];
  let message: string;
  if (command.type === 'buy') {
    if (!owns(GROCERIES, command.item)) return { ok: false, reason: 'Нет такого продукта' };
    // Keep old unbranded coffee usable, but only the named brands are sold now.
    if (command.item === 'coffee') return { ok: false, reason: 'Этот сорт снят с продажи — выбери Nescafé Gold или Egoiste' };
    const id: IngredientId = command.item;
    const product = GROCERIES[id];
    if (state.money < product.price) return { ok: false, reason: 'Недостаточно денег на покупку' };
    if (state.pantry[id] + product.quantity > 99) return { ok: false, reason: 'Запас этого продукта заполнен' };
    state.money -= product.price;
    state.pantry[id] += product.quantity;
    const space=storageCanFit(source,state);
    if(!space.ok)return {ok:false,reason:space.reason};
    addLedger(state, role, 'expense', 'groceries', product.price, product.name);
    message = names[role] + ': доставлено ' + product.name + ' за ' + product.price + ' ₽';
  } else if (command.type === 'cook') {
    if (!owns(RECIPES, command.recipe)) return { ok: false, reason: 'Неизвестный рецепт' };
    const id: RecipeId = command.recipe;
    const recipe = RECIPES[id];
    const availability=recipeAvailability(state,role,id);
    if(!availability.available)return {ok:false,reason:availability.reason};
    const {effort}=availability;
    if(isCatchRecipe(id))state.world.fishing!.fish=freshFish(state).slice(1);
    for (const [item, amount] of ingredientList(id)) state.pantry[item] -= amount;
    state.meals[id] += recipe.servings;
    const quality=isHomeDrink(id)?(random()<.15?'perfect':'good'):cookingQuality(state,role,random);
    addReadyFood(state,'meal',id,recipe.servings,'table',undefined,quality);
    const space=storageCanFit(source,state);
    if(!space.ok)return {ok:false,reason:space.reason};
    recordRecipe(state,role,id,quality);
    recordEmotion(state,role,quality==='bad'||quality==='average'?'cookBad':'cookGood');
    actor.energy = Math.max(0, actor.energy - effort);
    actor.mood = Math.min(100, actor.mood + 2);
    actor.comfort = Math.min(100, actor.comfort + 3);
    Object.assign(actor, isGrillRecipe(id) ? { ...points.grill, pose: 'idle' } : { ...points.kitchen, pose: 'work' });
    message = names[role] + ': приготовлено ' + recipe.name + ', ' + recipe.servings + ' порции · на столе · качество: '+qualityLabel(quality);
  } else {
    if (!owns(RECIPES, command.recipe)) return { ok: false, reason: 'Неизвестное блюдо' };
    const id: RecipeId = command.recipe;
    const meal = RECIPES[id];
    if (state.meals[id] < 1) return { ok: false, reason: 'Готовых порций нет — сначала приготовь' };
    const portion=consumeReadyPortion(state,'meal',id,'table',freshlyCooked);
    if (!portion) return { ok: false, reason: 'Это блюдо уже испортилось' };
    actor.hunger = Math.min(100, actor.hunger + meal.hunger);
    const effect=foodQualityEffect(portion.quality,meal.mood);
    if(!isHomeDrink(id))foodIllness(state,role,portion.quality,random);
    recordEmotion(state,role,effect.fun<0?'mealBad':'mealGood');
    actor.mood = Math.max(0,Math.min(100,actor.mood+effect.mood));
    actor.fun = Math.max(0,Math.min(100,actor.fun+effect.fun));
    actor.comfort = Math.min(100, actor.comfort + 4);
    addDirtyDish(state.dirtyDishes, isGrillRecipe(id) ? 'yardTable' : 'table');
    Object.assign(actor, { ...homeSeat(isGrillRecipe(id) ? 'yardTable' : 'table', role).approach,
      pose: 'sit' as const });
    message = names[role] + ': ' + (role==='vlad'?'поел':'поела') + ' ' + meal.name+' · '+qualityLabel(portion.quality)+(effect.fun<0?' · настроение и досуг '+effect.fun:'');
  }
  state.revision += 1;
  return { ok: true, state, message };
}

/** Ready-made food stays in the shared fridge until someone eats it at the table. */
export function applyTakeoutMeal(source: GameState, role: CharacterId, item: string): FoodResult {
  if (!Object.prototype.hasOwnProperty.call(TAKEOUT, item)) return {ok:false,reason:'Неизвестное готовое блюдо'};
  const id=item as TakeoutId;
  const state=structuredClone(source);
  reconcileReadyFood(state);
  expireReadyFood(state);
  if (!state.takeout[id] || !consumeReadyFood(state,'takeout',id,'table'))
    return {ok:false,reason:'Готовой еды нет или срок её годности истёк'};
  const meal=TAKEOUT[id];
  const actor=state.characters[role];
  recordEmotion(state,role,'mealGood');
  actor.hunger=Math.min(100,actor.hunger+meal.hunger);
  actor.mood=Math.min(100,actor.mood+meal.mood);
  actor.comfort=Math.min(100,actor.comfort+4);
  addDirtyDish(state.dirtyDishes, 'table');
  Object.assign(actor,{...homeSeat('table',role).approach,pose:'sit' as const});
  state.revision++;
  return {ok:true,state,message:names[role]+': '+(role==='vlad'?'поел':'поела')+' '+meal.name};
}


/** Delivery meal consumed on the sofa, without teleporting the resident to the dining table. */
export function applyTvFood(source:GameState,role:CharacterId,item:TakeoutId):FoodResult{
  if(!owns(TAKEOUT,item)||source.world.places[role]!=='home')return {ok:false,reason:'Еда недоступна'};
  const state=structuredClone(source);
  if(!consumeReadyFood(state,'takeout',item))return {ok:false,reason:'Свежей порции больше нет'};
  const meal=TAKEOUT[item],actor=state.characters[role];
  actor.hunger=Math.min(100,actor.hunger+meal.hunger);
  actor.mood=Math.min(100,actor.mood+meal.mood);
  actor.comfort=Math.min(100,actor.comfort+4);
  recordEmotion(state,role,'mealGood');
  state.revision++;
  return {ok:true,state,message:meal.name+' · порция съедена'};
}