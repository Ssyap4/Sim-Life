import {freshFish,isCatchRecipe} from './lake';
import { skillRank } from './education';
import { COOKING_RECIPES, cookingEnergy } from './cookingProgression';
import { GROCERIES, RECIPES, ingredientList, type RecipeId } from './food';
import type { CharacterId, GameState } from './protocol';
import { storageCanFit } from './storageSpace';

export type RecipeAvailability =
  | {available:true; effort:number}
  | {available:false; effort:number; reason:string};

/** Exactly the same limits are presented on the grill and kitchen menus.
 * The server remains authoritative and repeats these checks on completion. */
export function recipeAvailability(state: GameState, role: CharacterId,
  id: RecipeId): RecipeAvailability {
  const recipe=RECIPES[id];
  const cooking=skillRank(state.education.characters[role].xp.cooking).level;
  const required=COOKING_RECIPES[id].minLevel;
  const effort=cookingEnergy(cooking,id);
  if (cooking < required) return {available:false,effort,
    reason:'🔒 Нужна кулинария уровня '+required+' (сейчас '+cooking+')'};
  if(isCatchRecipe(id)&&!freshFish(state).length)return {available:false,effort,reason:'Нужна свежая рыба из семейного улова'};
  const missing=ingredientList(id).filter(([item,amount])=>state.pantry[item]<amount);
  if(missing.length)return {available:false,effort,reason:'Не хватает: '+
    missing.map(([item,amount])=>GROCERIES[item].name.split(' · ')[0]+' ×'+
      (amount-state.pantry[item])).join(', ')};
  if(state.meals[id]+recipe.servings>30)
    return {available:false,effort,reason:'Слишком много порций этого блюда (максимум 30)'};
  if(state.characters[role].energy<effort)
    return {available:false,effort,reason:'Не хватает энергии для готовки (нужно '+effort+'%)'};
  // Freshly cooked portions go on the serving table, not straight into the
  // fridge. Model that actual table placement before reserving ingredients.
  const after={
    pantry:{...state.pantry},
    meals:{...state.meals},
    takeout:state.takeout,
    readyFood:[...state.readyFood,{kind:'meal' as const,item:id,
      portions:recipe.servings,storage:'table' as const,expiresAt:0}],
  };
  for(const [item,amount] of ingredientList(id))after.pantry[item]-=amount;
  after.meals[id]+=recipe.servings;
  const fit=storageCanFit(state,after);
  if(!fit.ok)return {available:false,effort,reason:fit.reason};
  return {available:true,effort};
}
