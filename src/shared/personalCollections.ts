import {RECIPES,type RecipeId} from './food';
import {FOOD_QUALITIES,isFoodQuality,type FoodQuality} from './foodQuality';
import {LAKE_FISH,validCatch,type FishCatch,type LakeFish} from './lake';
import {gameMinutes} from './life';
import type {CharacterId,GameState} from './protocol';

export type RecipeRecord={count:number;perfect:number;best:FoodQuality;last:FoodQuality;at:number};
export type FishRecord={count:number;bestGrams:number;at:number};
export type PersonalCollection={recipes:Partial<Record<RecipeId,RecipeRecord>>;fish:Partial<Record<LakeFish,FishRecord>>};
export type PersonalCollections=Partial<Record<CharacterId,PersonalCollection>>;
export const emptyCollection=():PersonalCollection=>({recipes:{},fish:{}});
const whole=(v:unknown,min:number,max:number)=>Number.isSafeInteger(v)&&Number(v)>=min&&Number(v)<=max;
const obj=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v);
const limit=1000000000;
export function validCollections(value:unknown):value is PersonalCollections{
 if(!obj(value))return false;
 return Object.entries(value).every(([role,c])=>{
  if(!['vlad','alina'].includes(role)||!obj(c)||!obj(c.recipes)||!obj(c.fish))return false;
  return Object.entries(c.recipes).every(([id,r])=>Object.hasOwn(RECIPES,id)&&obj(r)&&whole(r.count,1,limit)&&whole(r.perfect,0,Number(r.count))&&isFoodQuality(r.best)&&isFoodQuality(r.last)&&FOOD_QUALITIES.indexOf(r.best)>=FOOD_QUALITIES.indexOf(r.last)&&(r.best==='perfect')===(Number(r.perfect)>0)&&whole(r.at,0,Number.MAX_SAFE_INTEGER))&&
   Object.entries(c.fish).every(([id,r])=>Object.hasOwn(LAKE_FISH,id)&&obj(r)&&whole(r.count,1,limit)&&whole(r.at,0,Number.MAX_SAFE_INTEGER)&&validCatch({species:id,grams:r.bestGrams,expires:0}));
 });
}
export function collectionFor(s:GameState,role:CharacterId):PersonalCollection{return s.personalCollections?.[role]??emptyCollection();}
function writable(s:GameState,role:CharacterId){return (s.personalCollections??={})[role]??=emptyCollection();}
export function recordRecipe(s:GameState,role:CharacterId,id:RecipeId,quality:FoodQuality){
 const book=writable(s,role).recipes,old=book[id];
 book[id]={count:Math.min(limit,(old?.count??0)+1),perfect:Math.min(limit,(old?.perfect??0)+(quality==='perfect'?1:0)),best:old&&FOOD_QUALITIES.indexOf(old.best)>FOOD_QUALITIES.indexOf(quality)?old.best:quality,last:quality,at:gameMinutes(s.clock)};
}
export function recordCatch(s:GameState,role:CharacterId,fish:FishCatch){
 const records=writable(s,role).fish,old=records[fish.species];
 records[fish.species]={count:Math.min(limit,(old?.count??0)+1),bestGrams:Math.max(old?.bestGrams??0,fish.grams),at:gameMinutes(s.clock)};
}
export function collectionSummary(s:GameState,role:CharacterId){
 const c=collectionFor(s,role),recipes=Object.values(c.recipes),fish=Object.values(c.fish);
 return {recipes:recipes.length,recipeTotal:Object.keys(RECIPES).length,batches:recipes.reduce((n,r)=>n+r!.count,0),perfect:recipes.filter(r=>r!.best==='perfect').length,fish:fish.length,fishTotal:Object.keys(LAKE_FISH).length,catches:fish.reduce((n,r)=>n+r!.count,0),bestGrams:Math.max(s.world.fishing?.record[role]??0,...fish.map(r=>r!.bestGrams))};
}
