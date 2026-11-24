/** Contextual, actionable Sims-style wishes (no fake XP, spending or server state). */
import { emotionFor,wishEmotionPriority } from './emotions';
import { RECIPES, ingredientList, isGrillRecipe, type RecipeId, type TakeoutId } from './food';
import { COOKING_RECIPES, COOKING_ORDER } from './cookingProgression';
import { SOCIAL_BY_ID, socialRestriction } from './socialLife';
import { SKILLS, skillRank } from './education';
import { gameMinutes, NEED_INFO, type VitalNeed } from './life';
import { canFurniturePerform, type FurnitureUseAction, type FurnitureUseCommand } from './furnitureUse';
import { isSleepBed } from './bedSleep';
import type { CharacterId, GameState, ActionId } from './protocol';
import { wishAvailable } from './happiness';
import type { PetId } from './pets';

export type WishCommand =
  | {type:'act';actionId:ActionId}
  | {type:'sleep_start';mode:'half'|'full'}
  | {type:'fridge'}
  | {type:'together';action:'sofaTalk'}
  | {type:'local_activity';action:'dog';station:'park-dog'}
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
        if(bed){command={type:'sleep_start',mode:value<=25?'half':'full'};cta=value<=25?'Вздремнуть':'Лечь спать';}
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
      urgency:value<=25?'urgent':'wish'};
  };
  // Needs are genuine only at the same threshold as need autonomy.
  // Pleasant plans below never masquerade as a physiological need.
  const pressing=sorted.filter(need=>person[need]<=50&&wishAvailable(state,role,'need-'+need)).slice(0,2);
  for(const need of pressing)wishes.push(make(need));
  if(state.world.places[role]==='park'&&state.world.dogWalker===role&&wishAvailable(state,role,'dog-walk'))wishes.push({id:'dog-walk',icon:'🐕',title:'Поиграть с Верделлом в парке',detail:'Проведи время с собакой на площадке.',cta:'К площадке',command:{type:'local_activity',action:'dog',station:'park-dog'},urgency:'calm'});
  const pet:PetId=role==='vlad'?'verdell':'simba';
  const plans:Wish[]=[];
  const add=(id:string,icon:string,title:string,detail:string,cta:string,command:WishCommand|undefined)=>{
    if(command&&wishAvailable(state,role,id))plans.push({id,icon,title,detail,cta,command,urgency:'calm'});
  };
  if(!(pet==='verdell'&&state.world.dogWalker))add('companion-'+pet,'🐾',pet==='verdell'?'Побыть с Верделлом':'Приласкать Симбу',
    'Хочется уделить любимому питомцу немного внимания.','Погладить',{type:'pet_action',pet,action:'pet'});
  if(state.world.places[role]==='home'&&!socialRestriction(SOCIAL_BY_ID.get('sofaTalk')!,state,role))add('together-time','♡','Провести время вместе','Спокойно поговорить вдвоём на диване.','Предложить',{type:'together',action:'sofaTalk'});
  const personalSkill=role==='vlad'?'technology':'practical';
  const rank=skillRank(state.education.characters[role].xp[personalSkill]);
  if(rank.next>0&&rank.next-rank.current<=15&&!state.furnishing.soldFixtures?.includes('desk'))add('goal-'+personalSkill+'-'+(rank.level+1),'🏆','Новый уровень: '+SKILLS[personalSkill][1],'Достигнуть '+(rank.level+1)+' уровня навыка.','Практиковаться',{type:'act',actionId:role==='vlad'?'vladStudy':'alinaStudy'});
  if(role==='vlad'){
    add('learn-dev','💻','Освоить что-то новое','Интересно попробовать новый приём в разработке.','Учиться',!state.furnishing.soldFixtures?.includes('desk')?{type:'act',actionId:'vladStudy'}:undefined);
    add('game-break','🎮','Вечер за игрой','Хочется отвлечься от дел и поиграть.','Поиграть',furniture(state,'desk','deskGames'));
    add('favorite-music','🎵','Включить любимую музыку','Немного музыки для хорошего настроения.','Послушать',furniture(state,'sofa','sofaMusic'));
  }else{
    add('learn-hair','📚','Изучить новую технику ухода','Хочется разобраться в восстановлении волос.','Учиться',!state.furnishing.soldFixtures?.includes('desk')?{type:'act',actionId:'alinaStudy'}:undefined);
    add('music-evening','🎵','Музыка для настроения','Хочется устроить небольшой музыкальный перерыв.','Послушать',furniture(state,'sofa','sofaMusic'));
    add('quiet-call','💬','Позвонить близким','Приятно узнать, как прошёл день у близких.','Позвонить',furniture(state,'sofa','sofaCall'));
  }
  add('reading','📖','Почитать для себя','Хочется немного времени с интересной книгой.','Почитать',!state.furnishing.soldFixtures?.includes('sofa')?{type:'act',actionId:'sofaRead'}:undefined);
  if(state.characters[role].energy>=35) {
    add('tea-break','🍵','Уютное чаепитие','Хочется спокойно посидеть с чашкой чая.','Заварить чай',state.pantry.tea>0?{type:'act',actionId:'kitchenTea'}:undefined);
    if(state.dirtyDishes.table+state.dirtyDishes.yardTable>0)
      add('cozy-home','🧽','Освободить стол','После еды хочется вернуть дому уют.','Помыть посуду',{type:'act',actionId:'kitchenDishes'});
  }
  const recipe=COOKING_ORDER.find(id=>!isGrillRecipe(id)&&COOKING_RECIPES[id].minLevel<=skillRank(state.education.characters[role].xp.cooking).level&&ingredientList(id).every(([ingredient,count])=>state.pantry[ingredient]>=count));
  if(recipe)add('cook-'+recipe,'🍳','Приготовить '+RECIPES[recipe].name.toLowerCase(),'Хочется приготовить домашнее блюдо.','Приготовить',{type:'cook',recipe});
  const cycle=Math.floor(gameMinutes(state.clock)/180)+(role==='alina'?1:0);
  const emotion=emotionFor(person).id;
  const ordered=plans.map((_,i)=>plans[(cycle+i)%plans.length]).sort((a,b)=>cycle%3===2?Number(b.id.startsWith('goal-'))-Number(a.id.startsWith('goal-')):wishEmotionPriority(b.id,role,emotion)-wishEmotionPriority(a.id,role,emotion));
  for(const plan of ordered){
    if(wishes.length>=3)break;
    if(!wishes.some(w=>JSON.stringify(w.command)===JSON.stringify(plan.command)))wishes.push(plan);
  }
  return wishes.slice(0,3);
}
