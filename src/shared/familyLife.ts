import type {CharacterId,GameState,TimedCommand} from './protocol';
import {gameDate,gameMinutes} from './life';
import {addLedger} from './economy';
import {giftCount,pendingGifts,GIFT_LIMIT} from './gifts';

export const OCCASIONS={
 newYear:{title:'Новый год',month:1,day:1},
 valentines:{title:'День влюблённых',month:2,day:14},
 spring:{title:'8 Марта',month:3,day:8},
 vladBirthday:{title:'День рождения Влада'},
 alinaBirthday:{title:'День рождения Алины'},
 anniversary:{title:'Годовщина отношений'},
} as const;
export type Occasion=keyof typeof OCCASIONS;
export type PersonalOccasion='vladBirthday'|'alinaBirthday'|'anniversary';
export const PERSONAL_OCCASIONS=['vladBirthday','alinaBirthday','anniversary'] as const;
export const HOBBIES={
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
 invitation:{title:'Свободный вечер',description:'Сегодня хочется устроить небольшой семейный вечер без обязательств. Можно записать идею в календарь и выбрать совместное занятие.',accept:'Запомнить идею',decline:'Не сегодня'},
 parcel:{title:'Приятная находка',description:'В кармане старой куртки нашлись 200 ₽. Можно положить их в общий бюджет или оставить на мелкие расходы вне игры.',accept:'Добавить 200 ₽',decline:'Оставить'},
} as const;
export type LifeEvent=keyof typeof LIFE_EVENTS;
type EventOffer={id:LifeEvent;day:number;status:'open'|'accepted'|'declined'};
export interface FamilyLifeState{
 dates:Partial<Record<PersonalOccasion,{month:number;day:number}>>;
 celebrated:Partial<Record<Occasion,number>>;
 hobbies:Record<CharacterId,Partial<Record<Hobby,HobbyProgress>>>;
 event?:EventOffer;
}
export const initialFamilyLife=():FamilyLifeState=>({dates:{},celebrated:{},hobbies:{vlad:{},alina:{}}});
export const familyLife=(s:GameState)=>s.familyLife??initialFamilyLife();
const mutable=(s:GameState)=>s.familyLife??=initialFamilyLife();
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
 return v.event===undefined||object(v.event)&&member(v.event.id,LIFE_EVENTS)&&int(v.event.day,1,10000000)&&['open','accepted','declined'].includes(String(v.event.status));
}
export function occasionsAhead(s:GameState,horizon=370){
 const out:{id:Occasion;day:number;month:number;date:number;inDays:number;celebrated:boolean}[]=[];
 const f=familyLife(s);
 for(const id of Object.keys(OCCASIONS) as Occasion[]){
   const spec=OCCASIONS[id],date='month' in spec?spec:f.dates[id as PersonalOccasion];if(!date)continue;
   for(let delta=0;delta<=horizon;delta++){
     const d=gameDate(s.clock.day+delta);
     if(d.month===date.month&&d.day===date.day){out.push({id,day:s.clock.day+delta,month:d.month,date:d.day,inDays:delta,celebrated:f.celebrated[id]!==undefined&&gameDate(f.celebrated[id]!).year===d.year});break;}
   }
 }
 return out.sort((a,b)=>a.inDays-b.inDays||a.id.localeCompare(b.id));
}
const memories=(s:GameState,action:string,title:string,description:string)=>{
 s.relationship.memories.push({at:gameMinutes(s.clock),action,title,description,group:'fun'});
 s.relationship.memories=s.relationship.memories.slice(-40);
};
const celebrationActions=new Set(['giftFlowers','giftSweets','cafeMeal','eat','takeout','film','cuddle','slowDance','yardCoffee','breakfastCare','breakfastBed','picnic','lakeTalk:trip','grill']);
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
export function hobbyFor(command:TimedCommand):{id:Hobby;item:string}|undefined{
 if(command.type==='read_book')return {id:'reading',item:command.book};
 if(command.type==='cook')return {id:'cooking',item:command.recipe};
 if(command.type==='local_activity'){
  if(['lakeFishFloat','lakeFishSpin','lakeFishFeeder'].includes(command.action))return {id:'fishing',item:command.action};
  if(['fitnessTrain','exercise'].includes(command.action))return {id:'sport',item:command.station};
 }
 if(command.type==='together'&&['parkBadminton','parkTennis','badminton','tableTennis','tennis'].includes(command.action))return {id:'sport',item:command.action};
 return undefined;
}
/** At most one credited session per hobby per game day, no automatic farming. */
export function creditHobby(s:GameState,role:CharacterId,command:TimedCommand):string{
 const h=hobbyFor(command);if(!h)return '';
 const progress=mutable(s).hobbies[role],p=progress[h.id]??{sessions:0,unique:[],lastDay:0};
 if(!p.unique.includes(h.item)&&p.unique.length<40)p.unique.push(h.item);
 if(p.lastDay===s.clock.day){progress[h.id]=p;return '';}
 p.sessions=Math.min(1000000,p.sessions+1);p.lastDay=s.clock.day;progress[h.id]=p;
 const level=HOBBY_LEVELS.findIndex(n=>n===p.sessions);
 if(level>=0){s.characters[role].mood=Math.min(100,s.characters[role].mood+8);return ' · Хобби: '+HOBBIES[h.id].milestones[level];}
 return '';
}
export function offerLifeEvent(s:GameState,previousMinute:number,eligible:readonly CharacterId[]):boolean{
 if(!eligible.length||s.clock.day<3)return false;
 const day=s.clock.day,at=(day-1)*1440+600,now=gameMinutes(s.clock);
 // One shared opportunity every 3 or 4 days, never retroactive after reconnect.
 if(day%7!==3&&day%7!==6||previousMinute>=at||now<at||now-at>30||s.familyLife?.event?.day===day)return false;
 const ids=Object.keys(LIFE_EVENTS) as LifeEvent[];
 const index=(Math.floor(day/7)*2+(day%7===6?1:0))%ids.length;
 mutable(s).event={id:ids[index],day,status:'open'};
 return true;
}
export function currentLifeEvent(s:GameState){const e=s.familyLife?.event;return e&&e.day===s.clock.day?e:undefined;}
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
 }else memories(s,'lifeEvent:invitation','Идея для вечера','Решили выделить время друг для друга.');
 e.status='accepted';return ok(LIFE_EVENTS[e.id].title+' · принято');
}
