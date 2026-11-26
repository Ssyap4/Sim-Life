import type {CharacterId,GameState,TimedCommand} from './protocol';
import {gameDate,gameMinutes,calendarSlot,GAME_DAYS_PER_YEAR} from './life';
import {addLedger} from './economy';
import {weatherAt} from './weather';
import {giftCount,pendingGifts,GIFT_LIMIT} from './gifts';

export const OCCASIONS={
 newYear:{title:'Новый год',month:12,day:31,slot:3},
 christmas:{title:'Рождество',month:1,day:7,slot:1},
 valentines:{title:'День влюблённых',month:2,day:14,slot:2},
 spring:{title:'8 Марта',month:3,day:8,slot:1},
 easter:{title:'Пасха',month:4,day:15,slot:2},
 vladBirthday:{title:'День рождения Влада'},
 alinaBirthday:{title:'День рождения Алины'},
 anniversary:{title:'Годовщина отношений'},
} as const;
export type Occasion=keyof typeof OCCASIONS;
export type PersonalOccasion='vladBirthday'|'alinaBirthday'|'anniversary';
export const PERSONAL_OCCASIONS=['vladBirthday','alinaBirthday','anniversary'] as const;
export const HOBBY_RESULTS={paintLandscape:{title:'Тихое озеро',icon:'🏞️'},paintStillLife:{title:'Яблоки и ваза',icon:'🍎'},buildCottage:{title:'Уютный домик',icon:'🏡'},buildCar:{title:'Миниатюрный автомобиль',icon:'🚙'}} as const;
export const HOBBIES={
 painting:{name:'Рисование',icon:'🎨',hint:'Купите мольберт в разделе мебели «Досуг» и создавайте картины.',milestones:['Любитель живописи','Уверенный художник','Мастер кисти']},
 modeling:{name:'Моделирование',icon:'🧩',hint:'Купите стол для миниатюр и собирайте модели.',milestones:['Начинающий мастер','Мастер деталей','Мастер миниатюр']},
 reading:{name:'Чтение',icon:'📚',hint:'Завершайте чтение разных книг.',milestones:['Любитель книг','Книжный знаток','Библиофил']},
 cooking:{name:'Кулинария',icon:'🍳',hint:'Готовьте разные домашние блюда.',milestones:['Домашний кулинар','Гурман','Мастер кухни']},
 fishing:{name:'Рыбалка',icon:'🎣',hint:'Завершайте попытки рыбалки на Лесном озере.',milestones:['Начинающий рыбак','Опытный рыбак','Любитель озера']},
 sport:{name:'Активный отдых',icon:'🏸',hint:'Тренировки, бадминтон и настольный теннис.',milestones:['Любитель движения','Активный человек','Спортивный энтузиаст']},
} as const;
export type Hobby=keyof typeof HOBBIES;
export const HOBBY_LEVELS=[3,8,15] as const;
type HobbyProgress={sessions:number;unique:string[];lastDay:number};
export const LIFE_EVENTS={
 refund:{title:'Возврат переплаты',description:'Магазин обнаружил небольшую переплату по старому чеку. Можно получить возврат или отказаться.',accept:'Получить 350 ₽',decline:'Отказаться'},
 flowers:{title:'Цветочный сюрприз',description:'В магазине осталось несколько свежих букетов по сниженной цене. Можно взять букет для дома за 250 ₽.',accept:'Взять букет · 250 ₽',decline:'Пропустить'},
 invitation:{title:'Свободный вечер',description:'Давно не было спокойного вечера вдвоём. Выберите совместный фильм, разговор на диване или объятия.',accept:'Устроить вечер',decline:'Не сегодня'},
 rainyEvening:{title:'Непогода за окном',description:'На улице непогода. Самое время устроить домашний вечер вдвоём: фильм, разговор на диване или объятия.',accept:'Устроить уютный вечер',decline:'Другие планы'},
 dogAttention:{title:'Верделл соскучился',description:'Верделлу не хватает внимания. Поиграйте с ним или погладьте его дома.',accept:'Провести время с Верделлом',decline:'Не сейчас'},
 catAttention:{title:'Симба ищет компанию',description:'Симбе не хватает внимания. Поиграйте с ним или погладьте его дома.',accept:'Провести время с Симбой',decline:'Не сейчас'},
 budgetDinner:{title:'Домашний ужин вместо доставки',description:'Семейный бюджет требует внимания. Приготовьте любое домашнее блюдо из продуктов, которые уже есть или будут куплены.',accept:'Приготовить дома',decline:'Пропустить'},
 workBonus:{title:'Благодарность за работу',description:'После недавней оплаченной смены или заказа поступила небольшая дополнительная премия.',accept:'Получить премию · 450 ₽',decline:'Отказаться'},
 creativeDay:{title:'Творческое вдохновение',description:'Сегодня хочется закончить ещё одну картину или миниатюру. Выполните занятие на мольберте или столе для моделирования.',accept:'Заняться творчеством',decline:'В другой раз'},
 parcel:{title:'Приятная находка',description:'В кармане старой куртки нашлись 200 ₽. Можно положить их в общий бюджет или оставить на мелкие расходы вне игры.',accept:'Добавить 200 ₽',decline:'Оставить'},
} as const;
export type LifeEvent=keyof typeof LIFE_EVENTS;
type EventOffer={id:LifeEvent;day:number;status:'open'|'accepted'|'declined'|'completed'};
const goalEvents=new Set<LifeEvent>(['invitation','rainyEvening','dogAttention','catAttention','budgetDinner','creativeDay']);
export const isGoalEvent=(id:LifeEvent)=>goalEvents.has(id);
export function eventStatus(e:EventOffer,day:number){return e.day<day&&(e.status==='open'||e.status==='accepted'&&isGoalEvent(e.id))?'Истекло':e.status==='open'?'Новое':e.status==='completed'?'Выполнено':e.status==='declined'?'Пропущено':isGoalEvent(e.id)?'В процессе':'Принято';}
export interface FamilyLifeState{
 dates:Partial<Record<PersonalOccasion,{month:number;day:number}>>;
 celebrated:Partial<Record<Occasion,number>>;
 hobbies:Record<CharacterId,Partial<Record<Hobby,HobbyProgress>>>;
 event?:EventOffer;
 eventHistory?:EventOffer[];
}
const defaultDates=()=>({vladBirthday:{month:1,day:25},alinaBirthday:{month:2,day:4}});
export const initialFamilyLife=():FamilyLifeState=>({dates:defaultDates(),celebrated:{},hobbies:{vlad:{},alina:{}}});
export const familyLife=(s:GameState):FamilyLifeState=>s.familyLife?{...s.familyLife,dates:{...defaultDates(),...s.familyLife.dates}}:initialFamilyLife();
const mutable=(s:GameState)=>{s.familyLife=familyLife(s);return s.familyLife;};
const int=(x:unknown,min:number,max:number)=>Number.isSafeInteger(x)&&Number(x)>=min&&Number(x)<=max;
const object=(x:unknown):x is Record<string,unknown>=>!!x&&typeof x==='object'&&!Array.isArray(x);
const member=(x:unknown,keys:object)=>typeof x==='string'&&Object.hasOwn(keys,x);
export function validPersonalDate(month:unknown,day:unknown):boolean{
 return int(month,1,12)&&int(day,1,new Date(Date.UTC(2001,Number(month),0)).getUTCDate());
}
export function validFamilyLife(v:unknown):v is FamilyLifeState{
 if(!object(v)||!object(v.dates)||!object(v.celebrated)||!object(v.hobbies))return false;
 if(!Object.entries(v.dates).every(([k,d])=>PERSONAL_OCCASIONS.includes(k as PersonalOccasion)&&object(d)&&validPersonalDate(d.month,d.day)))return false;
 if(!Object.entries(v.celebrated).every(([k,d])=>member(k,OCCASIONS)&&int(d,1,10000000)))return false;
 if(Object.keys(v.hobbies).length!==2||!['vlad','alina'].every(role=>{const h=v.hobbies as Record<string,unknown>;return object(h[role])&&Object.entries(h[role]).every(([k,p])=>member(k,HOBBIES)&&object(p)&&int(p.sessions,1,1000000)&&int(p.lastDay,1,10000000)&&Array.isArray(p.unique)&&p.unique.length<=40&&p.unique.every(x=>typeof x==='string'&&x.length<=80)&&new Set(p.unique).size===p.unique.length);}))return false;
 const validEvent=(e:unknown)=>object(e)&&member(e.id,LIFE_EVENTS)&&int(e.day,1,10000000)&&['open','accepted','declined','completed'].includes(String(e.status));
 return (v.event===undefined||validEvent(v.event))&&(v.eventHistory===undefined||Array.isArray(v.eventHistory)&&v.eventHistory.length<=12&&v.eventHistory.every(validEvent));
}
export function occasionsAhead(s:GameState,horizon=GAME_DAYS_PER_YEAR-1){
 const out:{id:Occasion;day:number;month:number;date:number;slot:number;inDays:number;celebrated:boolean}[]=[];
 const f=familyLife(s);
 for(const id of Object.keys(OCCASIONS) as Occasion[]){
   const spec=OCCASIONS[id],date='month' in spec?spec:f.dates[id as PersonalOccasion];if(!date)continue;
   for(let delta=0;delta<=horizon;delta++){
     const d=gameDate(s.clock.day+delta);
     const slot='slot' in spec?spec.slot:calendarSlot(date.day);
     if(d.month===date.month&&d.day===slot){out.push({id,day:s.clock.day+delta,month:d.month,date:date.day,slot,inDays:delta,celebrated:f.celebrated[id]!==undefined&&gameDate(f.celebrated[id]!).year===d.year});break;}
   }
 }
 return out.sort((a,b)=>a.inDays-b.inDays||a.id.localeCompare(b.id));
}
const memories=(s:GameState,action:string,title:string,description:string)=>{
 s.relationship.memories.push({at:gameMinutes(s.clock),action,title,description,group:'fun'});
 s.relationship.memories=s.relationship.memories.slice(-40);
};
const celebrationActions=new Set(['holidayWish','giftFlowers','giftSweets','cafeMeal','eat','takeout','film','cuddle','slowDance','yardCoffee','breakfastCare','breakfastBed','picnic','lakeTalk:trip','grill']);
/** Called only after a real voluntary shared activity completes. */
export function creditCelebration(s:GameState,action:string):string[]{
 if(!celebrationActions.has(action))return [];
 const today=occasionsAhead(s,0).filter(o=>!o.celebrated);
 for(const o of today){
   mutable(s).celebrated[o.id]=s.clock.day;
   memories(s,'holiday:'+o.id,OCCASIONS[o.id].title,'Отметили праздник совместным занятием.');
   for(const role of ['vlad','alina'] as const)s.characters[role].mood=Math.min(100,s.characters[role].mood+8);
 }
 return today.map(o=>OCCASIONS[o.id].title);
}
export function hobbyFor(command:TimedCommand,s?:GameState):{id:Hobby;item:string}|undefined{
 if(command.type==='read_book')return {id:'reading',item:command.book};
 if(command.type==='furniture_use'){
  if(command.action==='paintLandscape'||command.action==='paintStillLife')return {id:'painting',item:command.action};
  if(command.action==='buildCottage'||command.action==='buildCar')return {id:'modeling',item:command.action};
  if(command.action==='read_book'&&command.book)return {id:'reading',item:command.book};
  if(command.action==='pingPong'||command.action==='poolSwim')return {id:'sport',item:command.action};
 }
 if(command.type==='cook')return {id:'cooking',item:command.recipe};
 if(command.type==='local_activity'){
  if(['lakeFishFloat','lakeFishSpin','lakeFishFeeder'].includes(command.action))return {id:'fishing',item:command.action};
  if(['fitnessTrain','exercise'].includes(command.action))return {id:'sport',item:command.station};
 }
 if(command.type==='together'){
  if(command.action==='read'&&command.item)return {id:'reading',item:command.item};
  if(command.action==='parkBadminton'||command.action==='poolSwimTogether')return {id:'sport',item:command.action};
  if(command.action==='leisureTogether'&&s?.furnishing.placed.some(p=>String(p.id)===command.item&&p.sku==='leisure-tennis'))return {id:'sport',item:'pingPong'};
 }
 return undefined;
}
/** At most one credited session per hobby per game day, no automatic farming. */
export function creditHobby(s:GameState,role:CharacterId,command:TimedCommand):string{
 const h=hobbyFor(command,s);if(!h)return '';
 const progress=mutable(s).hobbies[role],p=progress[h.id]??{sessions:0,unique:[],lastDay:0};
 const newResult=!p.unique.includes(h.item)&&p.unique.length<40;
 if(newResult)p.unique.push(h.item);
 const result=newResult&&Object.hasOwn(HOBBY_RESULTS,h.item)?' · В коллекции: '+HOBBY_RESULTS[h.item as keyof typeof HOBBY_RESULTS].title:'';
 if(p.lastDay===s.clock.day){progress[h.id]=p;return result;}
 p.sessions=Math.min(1000000,p.sessions+1);p.lastDay=s.clock.day;progress[h.id]=p;
 const level=HOBBY_LEVELS.findIndex(n=>n===p.sessions);
 if(level>=0){s.characters[role].mood=Math.min(100,s.characters[role].mood+8);return result+' · Хобби: '+HOBBIES[h.id].milestones[level];}
 return result;
}
export function contextualEvents(s:GameState,eligible:readonly CharacterId[]):LifeEvent[]{
 const now=gameMinutes(s.clock),w=weatherAt(s.clock),out:LifeEvent[]=[];
 const atHome=eligible.some(r=>s.world.places[r]==='home');
 const together=eligible.length===2&&eligible.every(r=>s.world.places[r]==='home');
 if(together&&['rain','storm','snow'].includes(w.kind))out.push('rainyEvening');
 if(together&&now-(s.relationship.lastTogether??0)>1440)out.push('invitation');
 if(atHome&&s.pets.verdell.happiness<60&&!s.world.dogWalker)out.push('dogAttention');
 if(atHome&&s.pets.simba.happiness<60)out.push('catAttention');
 if(atHome&&(s.money<5000||s.savings.spent.takeout>=s.savings.limits.takeout&&s.savings.limits.takeout>0))out.push('budgetDinner');
 if(s.ledger.some(e=>e.kind==='income'&&e.category==='work'&&e.amount>=2000&&e.day>=s.clock.day-2&&e.day<=s.clock.day&&e.actor!=='family'&&eligible.includes(e.actor)&&e.label!==LIFE_EVENTS.workBonus.title))out.push('workBonus');
 if(atHome&&s.furnishing.placed.some(p=>p.sku==='hobby-easel'||p.sku==='hobby-workbench'))out.push('creativeDay');
 return out;
}
export function offerLifeEvent(s:GameState,previousMinute:number,eligible:readonly CharacterId[],random=Math.random):boolean{
 if(!eligible.length||s.clock.day<3)return false;
 const day=s.clock.day,at=(day-1)*1440+600,now=gameMinutes(s.clock);
 // One shared opportunity every 3 or 4 days, never retroactive after reconnect.
 if(day%7!==3&&day%7!==6||previousMinute>=at||now<at||now-at>30||s.familyLife?.event?.day===day)return false;
 const f=mutable(s),recent=[...(f.eventHistory??[]),...(f.event?[f.event]:[])];
 const allowed=(id:LifeEvent)=>!recent.some(e=>e.id===id&&day-e.day< (id==='workBonus'?10:7));
 const context=contextualEvents(s,eligible).filter(allowed);
 const fallback:LifeEvent[]=['parcel'];
 if(s.money>=250&&giftCount(s,'giftFlowers')+pendingGifts(s,'giftFlowers')<GIFT_LIMIT)fallback.push('flowers');
 if(s.ledger.some(e=>e.kind==='expense'&&e.category==='groceries'&&e.day>=day-2&&e.day<=day&&e.amount>=350))fallback.push('refund');
 const candidates=context.length?context:fallback.filter(allowed);
 if(!candidates.length)return false;
 const index=Math.max(0,Math.min(candidates.length-1,Math.floor(random()*candidates.length)));
 if(f.event)f.eventHistory=recent.slice(-12);
 f.event={id:candidates[index],day,status:'open'};
 return true;
}
export function currentLifeEvent(s:GameState){const e=s.familyLife?.event;return e&&e.day===s.clock.day?e:undefined;}
/** Real voluntary completions only. Acceptance alone never grants goal rewards. */
export function creditLifeEvent(s:GameState,role:CharacterId,command:TimedCommand,shared=false):string{
 const e=currentLifeEvent(s);if(!e||e.status!=='accepted'||!isGoalEvent(e.id))return '';
 const joint=shared&&command.type==='together'&&['film','sofaTalk','cuddle','sofaHug','musicTogether','slowDance'].includes(command.action)&&s.world.places.vlad==='home'&&s.world.places.alina==='home';
 const pet=command.type==='pet_action'&&['play','pet','brush'].includes(command.action);
 const done=e.id==='invitation'||e.id==='rainyEvening'?joint:e.id==='dogAttention'?pet&&command.pet==='verdell':e.id==='catAttention'?pet&&command.pet==='simba':e.id==='budgetDinner'?command.type==='cook':e.id==='creativeDay'?command.type==='furniture_use'&&Object.hasOwn(HOBBY_RESULTS,command.action):false;
 if(!done)return '';
 e.status='completed';
 const people=joint?(['vlad','alina'] as const):[role];
 for(const r of people)s.characters[r].mood=Math.min(100,s.characters[r].mood+8);
 if(joint)memories(s,'lifeEvent:'+e.id,LIFE_EVENTS[e.id].title,'Устроили уютный вечер вдвоём.');
 return ' · Событие выполнено: '+LIFE_EVENTS[e.id].title;
}
export type FamilyLifeCommand={type:'family_date';id:PersonalOccasion;month:number;day:number}|{type:'family_event';day:number;id:LifeEvent;accept:boolean};
type Result={ok:true;state:GameState;message:string}|{ok:false;reason:string};
export function applyFamilyLife(source:GameState,role:CharacterId,cmd:Record<string,unknown>):Result{
 const fail=(reason:string):Result=>({ok:false,reason});
 const s=structuredClone(source),f=mutable(s);
 const ok=(message:string):Result=>{s.revision++;return {ok:true,state:s,message};};
 if(cmd.type==='family_date'){
  if(!PERSONAL_OCCASIONS.includes(cmd.id as PersonalOccasion)||!validPersonalDate(cmd.month,cmd.day))return fail('Укажи существующую дату.');
  f.dates[cmd.id as PersonalOccasion]={month:Number(cmd.month),day:Number(cmd.day)};
  return ok('Семейная дата сохранена.');
 }
 if(cmd.type!=='family_event'||typeof cmd.accept!=='boolean')return fail('Неизвестное событие.');
 const e=currentLifeEvent(s);
 if(!e||e.status!=='open'||e.day!==cmd.day||e.id!==cmd.id)return fail('Событие уже завершено или устарело.');
 if(!cmd.accept){e.status='declined';return ok('Событие пропущено без штрафа.');}
 if(e.id==='flowers'){
  if(s.money<250)return fail('Недостаточно денег.');
  if(giftCount(s,'giftFlowers')+pendingGifts(s,'giftFlowers')>=GIFT_LIMIT)return fail('Слишком много букетов с учётом доставки.');
  s.money-=250;addLedger(s,role,'expense','gifts',250,'Букет по акции');s.gifts??={};s.gifts.giftFlowers=(s.gifts.giftFlowers??0)+1;
 }else if(e.id==='refund'||e.id==='parcel'){
  const n=e.id==='refund'?350:200;s.money+=n;addLedger(s,'family','income','services',n,LIFE_EVENTS[e.id].title);
 }else if(e.id==='workBonus'){
  s.money+=450;addLedger(s,'family','income','work',450,LIFE_EVENTS.workBonus.title);
 }
 e.status='accepted';return ok(LIFE_EVENTS[e.id].title+(isGoalEvent(e.id)?' · осталось выполнить занятие':' · принято'));
}
