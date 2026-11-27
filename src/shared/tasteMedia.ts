import {TAKEOUT,RECIPES,isMediaFood,mediaFoodKind,mediaFoodInfo,type MediaFood} from './food';
import {favoriteFood} from './foodTastes';
import {gameMinutes} from './life';
import type {CharacterId,GameState} from './protocol';
export type MediaTasteFilter='all'|'mine'|'partner'|'both';
export function mediaTasteOptions(s:GameState,role:CharacterId,filter:MediaTasteFilter='all'){
 const partner=role==='vlad'?'alina':'vlad',now=gameMinutes(s.clock);
 return [...Object.keys(TAKEOUT),...Object.keys(RECIPES)].filter(isMediaFood).map(food=>{
  const kind=mediaFoodKind(food),count=s.readyFood.filter(b=>b.kind===kind&&b.item===food&&(kind==='takeout'||b.storage==='table')&&b.expiresAt>now).reduce((n,b)=>n+b.portions,0);
  return {food:food as MediaFood,kind,count,meal:mediaFoodInfo(food),mine:favoriteFood(s,role,kind,food),partner:favoriteFood(s,partner,kind,food)};
 }).filter(o=>o.count>0&&(filter==='all'||filter==='mine'&&o.mine||filter==='partner'&&o.partner||filter==='both'&&o.mine&&o.partner)).sort((a,b)=>Number(b.mine&&b.partner)-Number(a.mine&&a.partner)||Number(b.mine)-Number(a.mine)||Number(b.partner)-Number(a.partner));
}
