import {BEAN_COFFEE,INSTANT_COFFEE,coffeeMachineTier,coffeeCupsToday} from './coffee';
import {RECIPES,TAKEOUT,isGrillRecipe,type RecipeId,type TakeoutId} from './food';
import {recipeAvailability} from './recipeAvailability';
import {gameMinutes} from './life';
import type {CharacterId,GameState,TimedCommand} from './protocol';

export const DAILY_KEYS=['morningTeeth','makeBed','morningHair','morningCoffee','breakfast','clearDishes','eveningWash','eveningTeeth'] as const;
export type DailyKey=typeof DAILY_KEYS[number];
export type DailyHistory=Partial<Record<CharacterId,{day:number;keys:DailyKey[]}>>;
export interface DailyChoice { key:DailyKey; command:TimedCommand }
export function validDailyHistory(value:unknown):value is DailyHistory{
 if(!value||typeof value!=='object'||Array.isArray(value))return false;
 return Object.entries(value).every(([role,row])=>{
  if(!['vlad','alina'].includes(role)||!row||typeof row!=='object')return false;
  const r=row as {day?:number;keys?:unknown[]};
  return Number.isSafeInteger(r.day)&&r.day!>=1&&Array.isArray(r.keys)&&r.keys.length<=DAILY_KEYS.length&&
   new Set(r.keys).size===r.keys.length&&r.keys.every(k=>(DAILY_KEYS as readonly unknown[]).includes(k));
 });
}
export function dailyCompleted(s:GameState,role:CharacterId):ReadonlySet<DailyKey>{
 const row=s.dailyHistory?.[role];
 return new Set(row?.day===s.clock.day?row.keys:[]);
}
/** Record only actual completed actions, manual or automatic, in the same
 * transaction as needs/resources. Cancellation never marks a step done. */
export function recordDailyCompletion(s:GameState,role:CharacterId,c:TimedCommand){
 const h=s.clock.minute/60;
 const a=c.type==='act'?c.actionId:c.type==='furniture_use'?c.action:undefined;
 let key:DailyKey|undefined;
 if(h>=6&&h<11){
  if(a==='bathTeeth')key='morningTeeth';
  if(a==='bedMake')key='makeBed';
  if(c.type==='vanity_care'&&c.care==='brush')key='morningHair';
  if(c.type==='brew_coffee')key='morningCoffee';
  if(c.type==='eat'||c.type==='eat_takeout')key='breakfast';
 }
 if(h>=11&&h<21&&a==='kitchenDishes')key='clearDishes';
 if(h>=20){if(a==='bathWash')key='eveningWash';if(a==='bathTeeth')key='eveningTeeth';}
 if(!key)return;
 const keys=dailyCompleted(s,role);
 s.dailyHistory={...s.dailyHistory,[role]:{day:s.clock.day,keys:[...new Set([...keys,key])]}};
}
export function dailyRoutineChoices(s:GameState,role:CharacterId,used:ReadonlySet<string>):DailyChoice[]{
 const p=s.characters[role], hour=s.clock.minute/60,peer=role==='vlad'?'alina':'vlad';
 if(s.autonomy[role]!=='full'||s.world.places[role]!=='home'||p.pose==='sleep'||
    Math.min(p.hunger,p.energy,p.hygiene,p.bladder)<=50)return [];
 const choices:DailyChoice[]=[];
 const add=(key:DailyKey,command:TimedCommand)=>{if(!used.has(key))choices.push({key,command});};
 if(hour>=6&&hour<11){
  add('morningTeeth',{type:'act',actionId:'bathTeeth'});
  if(!s.furnishing.soldFixtures?.includes('bed')&&role==='alina'&&s.characters[peer].pose!=='sleep')add('makeBed',{type:'act',actionId:'bedMake'});
  if(role==='alina'&&(!s.vanity?.hair||s.vanity.hair.until<=gameMinutes(s.clock)))add('morningHair',{type:'vanity_care',care:'brush'});
  if(p.energy<85&&coffeeCupsToday(s,role)===0){
   const tier=coffeeMachineTier(s,role),beans=BEAN_COFFEE.find(b=>s.pantry[b]>0),instant=INSTANT_COFFEE.find(b=>s.pantry[b]>0);
   if(tier&&beans)add('morningCoffee',{type:'brew_coffee',blend:beans,drink:'Американо'});
   else if(instant)add('morningCoffee',{type:'brew_coffee',blend:instant});
  }
  if(p.hunger<=75&&!used.has('breakfast')){
   const fresh=s.readyFood.filter(b=>b.portions>0&&b.expiresAt>gameMinutes(s.clock));
   for(const b of fresh.filter(b=>b.storage==='table')){
    if(b.kind==='meal'&&Object.hasOwn(RECIPES,b.item)&&!isGrillRecipe(b.item as RecipeId))add('breakfast',{type:'eat',recipe:b.item as RecipeId});
    if(b.kind==='takeout'&&Object.hasOwn(TAKEOUT,b.item))add('breakfast',{type:'eat_takeout',item:b.item as TakeoutId});
   }
   if(fresh.some(b=>b.storage==='fridge'))add('breakfast',{type:'act',actionId:'kitchenServe'});
   // Cook only if nothing ready is present. Both residents still reserve
   // the actual kitchen; preparing food itself does not mark breakfast eaten.
   if(!fresh.length)for(const recipe of ['omelette','toast','porridge','fruitSalad','sandwich'] as const)
    if(recipeAvailability(s,role,recipe).available)add('breakfast',{type:'cook',recipe});
  }
 }
 if(hour>=11&&hour<21&&s.dirtyDishes.table+s.dirtyDishes.yardTable>0)
  add('clearDishes',{type:'act',actionId:'kitchenDishes'});
 if(hour>=20&&hour<24){
  if(p.hygiene<85)add('eveningWash',{type:'act',actionId:'bathWash'});
  add('eveningTeeth',{type:'act',actionId:'bathTeeth'});
 }
 return choices;
}
/** Independent activity; never takes over the peer's task or resource. */
export function companionChoices(s:GameState,role:CharacterId,partner:TimedCommand):TimedCommand[]{
 if(s.autonomy[role]!=='full'||s.world.places[role]!=='home'||
   s.world.places[role==='vlad'?'alina':'vlad']!=='home'||
   Math.min(s.characters[role].hunger,s.characters[role].energy,s.characters[role].hygiene,s.characters[role].bladder)<=50)return [];
 if(partner.type==='console_play'||partner.type==='free_tv'||partner.type==='movie'||partner.type==='youtube')
  return s.furnishing.soldFixtures?.includes('sofa')?[]:[{type:'act',actionId:'sofaScroll'},{type:'act',actionId:'sofaRest'}];
 if(partner.type==='cook'&&!isGrillRecipe(partner.recipe)||partner.type==='eat'||partner.type==='eat_takeout'||partner.type==='act'&&['kitchenDishes','kitchenServe','kitchenTea'].includes(partner.actionId))
  return s.furnishing.soldFixtures?.includes('table')?[]:[{type:'act',actionId:'tablePlan'},{type:'act',actionId:'tableRest'}];
 const computer=partner.type==='play_game'||partner.type==='computer_video'?partner.device:
   partner.type==='act'&&['deskGames','deskJournal','vladStudy','alinaStudy','vladOrder','alinaConsult'].includes(partner.actionId)?partner.computer??'desktop':undefined;
 if(partner.type==='read_book'&&partner.seat==='officeChair'&&!s.furnishing.soldFixtures?.includes('bookcase')&&!s.furnishing.soldFixtures?.includes('sofa'))return [{type:'read_book',book:'prince'},{type:'act',actionId:'sofaRest'}];
 if(computer==='desktop'&&!s.furnishing.soldFixtures?.includes('officeChair')&&!s.furnishing.soldFixtures?.includes('bookcase'))
  return [{type:'read_book',book:'prince',seat:'officeChair'},{type:'act',actionId:'officeChairSit'}];
 return [];
}
