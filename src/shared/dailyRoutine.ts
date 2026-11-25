import {BEAN_COFFEE,INSTANT_COFFEE,coffeeMachineTier,coffeeCupsToday} from './coffee';
import type {CharacterId,GameState,TimedCommand} from './protocol';

export interface DailyChoice { key:string; command:TimedCommand }
/** Optional preventive habits; vital care and manual commands stay above these.
 * Keys are local to the current game day, not new household needs. */
export function dailyRoutineChoices(s:GameState,role:CharacterId,used:ReadonlySet<string>):DailyChoice[]{
 const p=s.characters[role], hour=s.clock.minute/60;
 if(s.autonomy[role]!=='full'||s.world.places[role]!=='home'||p.pose==='sleep'||
    Math.min(p.hunger,p.energy,p.hygiene,p.bladder)<=50)return [];
 const choices:DailyChoice[]=[];
 const add=(key:string,command:TimedCommand)=>{if(!used.has(key))choices.push({key,command});};
 if(hour>=6&&hour<11){
  add('morningTeeth',{type:'act',actionId:'bathTeeth'});
  if(!s.furnishing.soldFixtures?.includes('bed')&&role==='alina')add('makeBed',{type:'act',actionId:'bedMake'});
  if(role==='alina'&&(!s.vanity?.hair||s.vanity.hair.until<=(s.clock.day-1)*1440+s.clock.minute))add('morningHair',{type:'vanity_care',care:'brush'});
  if(p.energy<85&&coffeeCupsToday(s,role)===0){
   const tier=coffeeMachineTier(s,role),beans=BEAN_COFFEE.find(b=>s.pantry[b]>0),instant=INSTANT_COFFEE.find(b=>s.pantry[b]>0);
   if(tier&&beans)add('morningCoffee',{type:'brew_coffee',blend:beans,drink:'Американо'});
   else if(instant)add('morningCoffee',{type:'brew_coffee',blend:instant});
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
/** An independent activity on the resident's own seat. No invitation, TV
 * reservation, interaction reward or change to the partner's task. */
export function companionChoices(s:GameState,role:CharacterId,partner:TimedCommand):TimedCommand[]{
 if(s.autonomy[role]!=='full'||s.world.places[role]!=='home'||
   s.world.places[role==='vlad'?'alina':'vlad']!=='home'||
   Math.min(s.characters[role].hunger,s.characters[role].energy,s.characters[role].hygiene,s.characters[role].bladder)<=50||
   s.furnishing.soldFixtures?.includes('sofa'))return [];
 if(partner.type==='console_play'||partner.type==='free_tv'||partner.type==='movie'||partner.type==='youtube')
  return [{type:'act',actionId:'sofaScroll'},{type:'act',actionId:'sofaRest'}];
 return [];
}
