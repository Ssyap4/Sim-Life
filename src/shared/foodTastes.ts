import {CAFE_MENU} from './locations';
import {CAMP_RECIPES} from './park';
import {INSTANT_COFFEE,COFFEE_DRINKS} from './coffee';
import {RECIPES,TAKEOUT} from './food';
import {gameMinutes} from './life';
import type {CharacterId,GameState} from './protocol';
import type {FoodQuality} from './foodQuality';

export type TasteKind='meal'|'takeout'|'cafe'|'coffee'|'campfire';
export const coffeeTasteItem=(blend:string,drink?:unknown)=>typeof drink==='string'?drink:blend;
export const favoriteBonusReady=(s:GameState,role:CharacterId)=>s.foodTastes?.[role]?.lastBonusAt===undefined||gameMinutes(s.clock)-s.foodTastes[role]!.lastBonusAt!>=180;
export type TasteProfile={favorites:string[];lastBonusAt?:number};
export type FoodTastes=Partial<Record<CharacterId,TasteProfile>>;
export const tasteKey=(kind:TasteKind,item:string)=>kind+':'+item;
export function validTasteItem(kind:unknown,item:unknown):kind is TasteKind{
 return typeof item==='string'&&(kind==='meal'?Object.hasOwn(RECIPES,item):kind==='takeout'?Object.hasOwn(TAKEOUT,item):kind==='cafe'?Object.hasOwn(CAFE_MENU,item):kind==='campfire'?Object.hasOwn(CAMP_RECIPES,item):kind==='coffee'&&([...INSTANT_COFFEE,...COFFEE_DRINKS] as readonly string[]).includes(item));
}
export function validFoodTastes(value:unknown):value is FoodTastes{
 if(!value||typeof value!=='object'||Array.isArray(value))return false;
 return Object.entries(value).every(([role,p])=>['vlad','alina'].includes(role)&&p&&typeof p==='object'&&!Array.isArray(p)&&Array.isArray(p.favorites)&&new Set(p.favorites).size===p.favorites.length&&p.favorites.every((k:unknown)=>typeof k==='string'&&validTasteItem(k.split(':')[0],k.split(':')[1])&&k.split(':').length===2)&&(p.lastBonusAt===undefined||Number.isSafeInteger(p.lastBonusAt)&&p.lastBonusAt>=0));
}
export function favoriteFood(s:GameState,role:CharacterId,kind:TasteKind,item:string):boolean{
 return s.foodTastes?.[role]?.favorites.includes(tasteKey(kind,item))??false;
}
export function changeFoodFavorite(source:GameState,role:CharacterId,kind:unknown,item:unknown,enabled:unknown){
 if(!validTasteItem(kind,item)||typeof enabled!=='boolean')return {ok:false as const,reason:'Неизвестное блюдо или отметка'};
 const id=String(item),key=tasteKey(kind,id);
 if(favoriteFood(source,role,kind,id)===enabled)return {ok:true as const,state:source};
 const s=structuredClone(source),p=(s.foodTastes??={})[role]??={favorites:[]};
 p.favorites=enabled?[...p.favorites,key]:p.favorites.filter(k=>k!==key);
 s.revision++;return {ok:true as const,state:s};
}
/** A genuine fresh serving, not a cooking/selection event. Shared cooldown survives unfavoriting. */
export function applyFavoriteMeal(s:GameState,role:CharacterId,kind:TasteKind,item:string,quality:FoodQuality|undefined='good'):number{
 if(!favoriteFood(s,role,kind,item)||quality==='bad'||quality==='average')return 0;
 const p=s.foodTastes![role]!,now=gameMinutes(s.clock);
 if(p.lastBonusAt!==undefined&&now-p.lastBonusAt<180)return 0;
 const actor=s.characters[role],before=actor.mood;
 actor.mood=Math.min(100,before+6);
 p.lastBonusAt=now;
 return actor.mood-before;
}
export function favoritePriority(s:GameState,role:CharacterId,kind:TasteKind,a:string,b:string){
 return Number(favoriteFood(s,role,kind,b))-Number(favoriteFood(s,role,kind,a));
}
