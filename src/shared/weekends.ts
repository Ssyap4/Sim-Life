import {FAMILY_MEMORY_LIMIT} from './familyJournal';
import type {CharacterId,GameState} from './protocol';
import {VENUE_GAMES} from './venue';
import {SPA_PASSES} from './spa';
import {CAFE_MENU} from './locations';
import {gameMinutes} from './life';
export const WEEKEND_ACTIVITIES={
 breakfast:{title:'Завтрак вдвоём',icon:'🥐',place:'home',hint:'Общий стол или завтрак с заботой. Нужна еда на двоих.',min:0,max:0},
 pool:{title:'Домашний бассейн',icon:'🏊',place:'home',hint:'Нужен установленный бассейн. Поплавайте или отдохните вместе.',min:0,max:0},
 grill:{title:'Мангал',icon:'🍢',place:'home',hint:'Подготовьте продукты и уголь, приготовьте вместе.',min:0,max:0},
 hookah:{title:'Отдых с кальяном',icon:'🌿',place:'home',hint:'Совместный отдых в домашней лаунж-зоне.',min:0,max:0},
 ufc:{title:'UFC 6 дома',icon:'🎮',place:'home',hint:'Нужны установленная PS5 и купленная UFC 6.',min:0,max:0},
 spa:{title:'SPA вдвоём',icon:'🫧',place:'spa',hint:'Парный вход или пакет с массажем. Выберите процедуру каждый.',min:SPA_PASSES.pair.price,max:SPA_PASSES.package.price},
 cafe:{title:'Обед в кафе',icon:'🍽️',place:'cafe',hint:'Закажите блюда и сядьте за общий стол.',min:2*CAFE_MENU.brioche.price,max:2*CAFE_MENU.bbqRibs.price},
 evening:{title:'Вечер вдвоём',icon:'❤️',place:'home',hint:'Объятия, фильм, разговор на диване или совместная музыка.',min:0,max:0},
 bowling:{title:'Боулинг',icon:'🎳',place:'venue',hint:'PLAY ARENA · одна совместная партия.',min:VENUE_GAMES.venueBowling.price,max:VENUE_GAMES.venueBowling.price},
 billiards:{title:'Бильярд',icon:'🎱',place:'venue',hint:'PLAY ARENA · одна совместная партия.',min:VENUE_GAMES.venueBilliards.price,max:VENUE_GAMES.venueBilliards.price},
 hockey:{title:'Аэрохоккей',icon:'🏒',place:'venue',hint:'PLAY ARENA · одна совместная партия.',min:VENUE_GAMES.venueHockey.price,max:VENUE_GAMES.venueHockey.price},
 dog:{title:'Прогулка с Верделлом',icon:'🐾',place:'park',hint:'Возьмите Верделла и прогуляйтесь вместе в парке.',min:0,max:0},
 picnic:{title:'Пикник в парке',icon:'🧺',place:'park',hint:'Положите свежую еду для обоих в корзину.',min:0,max:0},
 tea:{title:'Чай вдвоём',icon:'☕',place:'home',hint:'Две порции чая, общий стол.',min:0,max:0},
 dinner:{title:'Ужин за общим столом',icon:'🍽️',place:'home',hint:'Две свежие порции домашней еды или доставки. Сначала приготовьте или закажите.',min:0,max:0},
 film:{title:'Вечер кино',icon:'🎬',place:'home',hint:'Совместный фильм, оплаченный интернет и Netflix.',min:0,max:0},
 dance:{title:'Медленный танец',icon:'♡',place:'home',hint:'Потанцуйте вдвоём дома.',min:0,max:0},
 pets:{title:'Поиграть с питомцем',icon:'🐾',place:'home',hint:'Выберите Верделла или Симбу и поиграйте вдвоём.',min:0,max:0},
 bench:{title:'Отдых в парке',icon:'🌳',place:'park',hint:'Посидите вдвоём на скамейке.',min:0,max:0},
 badminton:{title:'Бадминтон',icon:'🏸',place:'park',hint:'Сыграйте совместную партию.',min:0,max:0},
 cafeTalk:{title:'Разговор в кафе',icon:'💬',place:'cafe',hint:'Сядьте за один столик и помечтайте вместе. Заказы оплачиваются отдельно.',min:0,max:0},
 campfire:{title:'Разговор у костра',icon:'🔥',place:'lake',hint:'Нужен доступ к озеру и общий горящий костёр. Вход и топливо отдельно.',min:0,max:0},
 coffee:{title:'Кофе во дворе',icon:'☕',place:'home',hint:'Две порции кофе, свободный дневной лимит.',min:0,max:0},
} as const;
export type WeekendActivity=keyof typeof WEEKEND_ACTIVITIES;
export const WEEKEND_PRESETS={
 home:{title:'Домашний уют',icon:'🏡',items:['breakfast','pool','grill','hookah','ufc']},
 romance:{title:'Романтический день',icon:'❤️',items:['spa','cafe','evening']},
 active:{title:'Активный отдых',icon:'🎳',items:['bowling','billiards','hockey']},
 walk:{title:'Семейная прогулка',icon:'🌳',items:['dog','picnic','coffee']},
 quiet:{title:'Тихий день дома',icon:'☕',items:['tea','pets','dinner','evening']},
 date:{title:'Вечер для двоих',icon:'♡',items:['dinner','dance','film']},
 green:{title:'День на свежем воздухе',icon:'🌳',items:['bench','badminton','picnic']},
 lakeDay:{title:'Время на природе',icon:'🔥',items:['campfire','coffee','evening']},
 custom:{title:'Свой сценарий',icon:'📅',items:[]},
} as const satisfies Record<string,{title:string;icon:string;items:readonly WeekendActivity[]}>;
export type WeekendPreset=keyof typeof WEEKEND_PRESETS;
export type WeekendPlan={version:number;author:CharacterId;preset:WeekendPreset;items:WeekendActivity[];done:WeekendActivity[];approved:CharacterId[];finishVotes:CharacterId[];createdAt:number};
export type WeekendState={version:number;plan?:WeekendPlan};
export type WeekendCommand=
 | {type:'weekend_propose';version:number;preset:WeekendPreset;items:WeekendActivity[]}
 | {type:'weekend_accept'|'weekend_cancel'|'weekend_finish';version:number};
export const initialWeekends=():WeekendState=>({version:0});
export const isWeekendActivity=(v:unknown):v is WeekendActivity=>typeof v==='string'&&Object.hasOwn(WEEKEND_ACTIVITIES,v);
export const isWeekendPreset=(v:unknown):v is WeekendPreset=>typeof v==='string'&&Object.hasOwn(WEEKEND_PRESETS,v);
const whole=(v:unknown):v is number=>Number.isSafeInteger(v)&&Number(v)>=0;
const distinct=(v:unknown,check:(x:unknown)=>boolean,max:number)=>Array.isArray(v)&&v.length<=max&&v.every(check)&&new Set(v).size===v.length;
const role=(v:unknown)=>v==='vlad'||v==='alina';
export function validWeekendState(v:unknown):v is WeekendState{
 if(!v||typeof v!=='object'||Array.isArray(v))return false;
 const s=v as WeekendState,p=s.plan;
 return whole(s.version)&&(p===undefined||!!p&&p.version===s.version&&role(p.author)&&isWeekendPreset(p.preset)&&
 distinct(p.items,isWeekendActivity,6)&&p.items.length>0&&distinct(p.done,isWeekendActivity,6)&&p.done.every(x=>p.items.includes(x))&&
 distinct(p.approved,role,2)&&p.approved.includes(p.author)&&distinct(p.finishVotes,role,2)&&
 (p.finishVotes.length===0||p.approved.length===2&&p.done.length>0)&&whole(p.createdAt));
}
export function weekendEstimate(items:readonly WeekendActivity[]){
 return items.reduce((a,id)=>({min:a.min+WEEKEND_ACTIVITIES[id].min,max:a.max+WEEKEND_ACTIVITIES[id].max}),{min:0,max:0});
}
/** Only authoritative successful activity handlers call this. No client completion flag. */
export function creditWeekend(s:GameState,id:WeekendActivity){
 const p=s.weekends?.plan;
 if(!p||p.approved.length!==2||!p.items.includes(id)||p.done.includes(id))return;
 p.done.push(id);p.finishVotes=[];
}
export function creditWeekendTogether(s:GameState,action:string,item?:string){
 const map:Record<string,WeekendActivity>={breakfastCare:'breakfast',breakfastBed:'breakfast',grill:'grill',yardHookah:'hookah',poolSwimTogether:'pool',cafeMeal:'cafe',cuddle:'evening',sofaTalk:'evening',film:'evening',musicTogether:'evening',venueBowling:'bowling',venueBilliards:'billiards',venueHockey:'hockey',picnic:'picnic',yardCoffee:'coffee'};
 const extra:Partial<Record<string,WeekendActivity>>={teaTogether:'tea',yardTea:'tea',eat:'dinner',takeout:'dinner',film:'film',slowDance:'dance',petPlay:'pets',parkRest:'bench',parkBadminton:'badminton',cafeDreams:'cafeTalk','lakeTalk:gratitude':'campfire'};
 const exact=extra[action];
 const p=s.weekends?.plan;
 if(exact&&p?.items.includes(exact)&&WEEKEND_ACTIVITIES[exact].place===s.world.places.vlad&&s.world.places.vlad===s.world.places.alina){creditWeekend(s,exact);return;}
 const id=action==='eat'&&item&&['omelette','toast','porridge','sandwich','pancakes','fruitSalad'].includes(item)?'breakfast':action==='consoleTogether'&&item==='ufc6'?'ufc':action==='walk'&&s.world.places.vlad==='park'&&s.world.places.alina==='park'&&s.world.dogWalker?'dog':map[action];
 if(id&&s.world.places.vlad===WEEKEND_ACTIVITIES[id].place&&s.world.places.alina===WEEKEND_ACTIVITIES[id].place)creditWeekend(s,id);
}
export function creditWeekendSpa(s:GameState){
 if(s.world.places.vlad==='spa'&&s.world.places.alina==='spa'&&(['vlad','alina'] as const).every(r=>s.world.spa?.[r]?.used.some(a=>a!=='spaLocker'&&a!=='spaShower')))creditWeekend(s,'spa');
}
type Result={ok:true;state:GameState;message:string}|{ok:false;reason:string};
export function applyWeekend(source:GameState,actor:CharacterId,cmd:Record<string,unknown>):Result{
 const old=source.weekends??initialWeekends(),fail=(reason:string):Result=>({ok:false,reason});
 if(old.version>=Number.MAX_SAFE_INTEGER||cmd.version!==old.version)return fail('План изменился. Открой актуальную программу.');
 const s=structuredClone(source),w=s.weekends??=initialWeekends(),p=w.plan;
 const ok=(message:string):Result=>{s.revision++;return {ok:true,state:s,message};};
 if(cmd.type==='weekend_propose'){
  if(!isWeekendPreset(cmd.preset)||!distinct(cmd.items,isWeekendActivity,6)||!(cmd.items as unknown[]).length)return fail('Выбери от одного до шести занятий без повторов.');
  const items=cmd.items as WeekendActivity[];
  w.version++;
  w.plan={version:w.version,author:actor,preset:cmd.preset,items:[...items],done:p?.done.filter(id=>items.includes(id))??[],approved:[actor],finishVotes:[],createdAt:p?.createdAt??gameMinutes(s.clock)};
  return ok('Новый семейный план предложен. Нужен ответ второго игрока.');
 }
 if(!p)return fail('Нет активного плана.');
 if(cmd.type==='weekend_accept'){
  if(p.approved.includes(actor))return fail('Ты уже подтвердил этот план.');
  p.approved.push(actor);return ok('Семейный план согласован!');
 }
 if(cmd.type==='weekend_cancel'){delete w.plan;w.version++;return ok('План отменён без штрафов.');}
 if(cmd.type==='weekend_finish'){
  if(p.approved.length!==2||!p.done.length)return fail('Сначала согласуйте план и проведите хотя бы одно занятие вместе.');
  if(p.finishVotes.includes(actor))return fail('Ожидаем подтверждение второго игрока.');
  p.finishVotes.push(actor);
  if(p.finishVotes.length===2){
   s.relationship.memories.push({action:'familyWeekend:'+p.preset,group:'fun',at:gameMinutes(s.clock),title:WEEKEND_PRESETS[p.preset].title,description:'Провели время вместе: '+p.done.map(id=>WEEKEND_ACTIVITIES[id].title).join(', ')+'.'});
   s.relationship.memories=s.relationship.memories.slice(-FAMILY_MEMORY_LIMIT);delete w.plan;w.version++;
   return ok('Семейный день сохранён в воспоминаниях.');
  }
  return ok('Предложено завершить день. Нужен ответ второго игрока.');
 }
 return fail('Неизвестная команда плана.');
}
