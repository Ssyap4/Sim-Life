/** Contextual, actionable Sims-style wishes (no fake XP, spending or server state). */
import { RECIPES, ingredientList, isGrillRecipe, type RecipeId, type TakeoutId } from './food';
import { COOKING_RECIPES, COOKING_ORDER } from './cookingProgression';
import { skillRank } from './education';
import { gameMinutes, NEED_INFO, type VitalNeed } from './life';
import { canFurniturePerform, type FurnitureUseAction, type FurnitureUseCommand } from './furnitureUse';
import { isSleepBed } from './bedSleep';
import type { CharacterId, GameState, ActionId } from './protocol';
import type { PetId } from './pets';

export type WishCommand =
  | {type:'act';actionId:ActionId}
  | {type:'sleep_start';mode:'half'|'full'}
  | {type:'fridge'}
  | {type:'cook'|'eat';recipe:RecipeId}
  | {type:'eat_takeout';item:TakeoutId}
  | {type:'pet_action';pet:PetId;action:'pet'}
  | FurnitureUseCommand;

export interface Wish {
  id:string;
  need?:VitalNeed;
  icon:string;
  title:string;
  detail:string;
  cta:string;
  command?:WishCommand;
  urgency:'calm'|'wish'|'urgent';
}

const needs:VitalNeed[]=['bladder','hunger','hygiene','energy','social','fun','comfort'];
const emoji:Record<VitalNeed,string>={
  bladder:'🚽',hunger:'🍲',hygiene:'🚿',energy:'😴',social:'💬',fun:'🎮',comfort:'🛋️',
};
const titles:Record<VitalNeed,string>={
  bladder:'Сходить в туалет',hunger:'Вкусно поесть',hygiene:'Освежиться',
  energy:'Отдохнуть',social:'Пообщаться',fun:'Развлечься',comfort:'Немного уюта',
};
function furniture(state:GameState,fixture:'sofa'|'table'|'desk',action:ActionId & FurnitureUseAction):WishCommand|undefined {
  if(!state.furnishing.soldFixtures?.includes(fixture))return {type:'act',actionId:action};
  for(const item of state.furnishing.placed){
    if(canFurniturePerform(item,action))return {type:'furniture_use',furnitureId:item.id,action};
  }
}
function foodWish(state:GameState,role:CharacterId):{command?:WishCommand;cta:string;detail:string}{
  const now=gameMinutes(state.clock);
  const available=state.readyFood.find(b=>b.storage==='table'&&b.portions>0&&b.expiresAt>now);
  if(available){
    const command:WishCommand=available.kind==='meal'
      ? {type:'eat',recipe:available.item as RecipeId}
      : {type:'eat_takeout',item:available.item as TakeoutId};
    return {command,cta:'Поесть',detail:'На столе уже есть свежая порция.'};
  }
  const inFridge=state.readyFood.some(b=>b.storage==='fridge'&&b.portions>0&&b.expiresAt>now);
  if(inFridge)return {command:{type:'fridge'},cta:'Открыть холодильник',
    detail:'Еда в холодильнике. Сначала достань порцию на стол.'};
  const current=skillRank(state.education.characters[role].xp.cooking).level;
  const recipe=COOKING_ORDER.find(id=>!isGrillRecipe(id)&&COOKING_RECIPES[id].minLevel<=current&&
    ingredientList(id).every(([ingredient,count])=>state.pantry[ingredient]>=count));
  if(recipe)return {command:{type:'cook',recipe},cta:'Приготовить',
    detail:'Есть ингредиенты для '+RECIPES[recipe].name.toLowerCase()+'.'};
  return {cta:'Нет продуктов',detail:'Для еды пока не хватает продуктов. Пополни запасы в телефоне.'};
}
export function wishesFor(state:GameState,role:CharacterId):Wish[]{
  const person=state.characters[role];
  const sorted=[...needs].sort((a,b)=>person[a]-person[b]);
  const wishes:Wish[]=[];
  const make=(need:VitalNeed):Wish=>{
    const value=Math.round(person[need]);
    let command:WishCommand|undefined;
    let cta='Выполнить';
    let detail=NEED_INFO[need].label+' · '+value+'%';
    switch(need){
      case 'bladder': command={type:'act',actionId:'toiletUse'};cta='В туалет';break;
      case 'hygiene': command={type:'act',actionId:'bathShower'};cta='Принять душ';break;
      case 'hunger':{const food=foodWish(state,role);command=food.command;cta=food.cta;detail=food.detail+' Голод: '+value+'%';break;}
      case 'energy':{
        const bed=!state.furnishing.soldFixtures?.includes('bed')||state.furnishing.placed.some(isSleepBed);
        if(bed){command={type:'sleep_start',mode:value<=40?'full':'half'};cta=value<=40?'Лечь спать':'Вздремнуть';}
        else{command=furniture(state,'sofa','sofaRest');cta=command?'Отдохнуть':'Нет кровати';}
        detail=command?'Энергия: '+value+'%. Сон и отдых помогут восстановиться.':'Для сна нужна установленная кровать.';
        break;
      }
      case 'social': command=furniture(state,'sofa','sofaCall')??furniture(state,'table','tableTalk');
        cta=command?'Пообщаться':'Нет места';detail=command?'Общение: '+value+'%. Хочется услышать близких.':'Нужен доступный диван или стол.';
        break;
      case 'fun':{
        command=(role==='vlad'?furniture(state,'desk','deskGames'):furniture(state,'sofa','sofaMusic'))
          ??furniture(state,'sofa','sofaMusic')??{type:'act',actionId:'kitchenTea'};
        const action=command.type==='furniture_use'?command.action:
          command.type==='act'?command.actionId:'';
        cta=action==='sofaMusic'?'Послушать музыку':action==='kitchenTea'?'Выпить чаю':'Поиграть';
        detail='Досуг: '+value+'%. Выбранное занятие действительно восполняет досуг.';
        break;
      }
      case 'comfort':command=furniture(state,'sofa','sofaRest')??{type:'act',actionId:'kitchenTidy'};
        cta='Навести уют';detail='Комфорт: '+value+'%. Устроиться поудобнее или привести дом в порядок.';
        break;
    }
    return {id:'need-'+need,need,icon:emoji[need],title:titles[need],detail,cta,command,
      urgency:value<=35?'urgent':value<=70?'wish':'calm'};
  };
  // Offer 1–2 real needs; avoid presenting five identical "do chores" demands
  // to a comfortable player. A harmless pleasant impulse fills the last slot.
  const pressing=sorted.filter(need=>person[need]<=76).slice(0,2);
  for(const need of pressing)wishes.push(make(need));
  const pet:PetId=role==='vlad'?'verdell':'simba';
  if(wishes.some(w=>w.command?.type==='pet_action')){
    wishes.push({id:'cozy-home',icon:'🧽',title:'Навести порядок',
      detail:'Небольшое домашнее дело сделает обстановку приятнее.',
      cta:'Прибраться',command:{type:'act',actionId:'kitchenTidy'},urgency:'calm'});
  }else{
    wishes.push({id:'companion-'+pet,icon:'🐾',title:pet==='verdell'?'Проведать Верделла':'Проведать Симбу',
      detail:'Даже в спокойный день приятно уделить питомцу немного внимания.',
      cta:'Погладить',command:{type:'pet_action',pet,action:'pet'},urgency:'calm'});
  }
  if(wishes.length<3){
    const additional=sorted.find(need=>!wishes.some(w=>w.need===need));
    if(additional)wishes.push(make(additional));
  }
  return wishes.slice(0,3);
}
