import {RECIPES,TAKEOUT,type RecipeId,type TakeoutId} from './food';
import {FAMILY_MEMORY_LIMIT} from './familyJournal';
/** Grounded, optional two-person stories: no random popup, daily reward farming or
 * invented food. Existing server-authoritative tasks supply every physical action.
 * A moment is offered only if the current household can actually perform it. */
import { activityItems, otherPerson, SOCIAL_BY_ID, socialRestriction } from './socialLife';
import { gameMinutes } from './life';
import { PETS, PET_IDS } from './pets';
import type { CharacterId, GameState } from './protocol';
import type { SocialIntent } from './socialLife';

export type FamilyMomentId =
  'afterShift'|'roughDay'|'petNeedsUs'|'shareDinner'|'goodNews'|'dishesTogether'|'simpleEvening'|'morningTea'|'quietTogether'|'petAttention'|'freshAir'|'parkBreak'|'parkGame'|'cafeDate'|'campfireTalk'|'celebrateToday';
export type FamilyMoment = {
  id:FamilyMomentId; emoji:string; title:string; description:string;
  action:string; item?:string; bonus:string;
};
export const FAMILY_MOMENT_PREFIX='familyMoment:';
export const FAMILY_MOMENT_DAY=1440;
const momentDay=(at:number)=>Math.floor(at/FAMILY_MOMENT_DAY);
const momentDone=(state:GameState,id:FamilyMomentId,day:number)=>state.relationship.memories.some(m=>
  m.action===FAMILY_MOMENT_PREFIX+id&&momentDay(m.at)===day);
const personName=(id:CharacterId)=>id==='vlad'?'Влад':'Алина';
const petName=(id:'verdell'|'simba')=>PETS[id].name;
const shiftFinished=(state:GameState,role:CharacterId,now:number)=>
  Object.values(state.careers.residents[role].progress).some(p=>
    p?.history?.some(e=>['Смена завершена','Досрочный уход'].includes(e.title)&&
      e.at<=now&&now-e.at<=420));
const lessonMilestone=(state:GameState,role:CharacterId,now:number)=>
  state.education.characters[role].events.some(e=>
    e.milestone&&e.at<=now&&now-e.at<=720);

/** Deterministic order, day-based limit, only real resources/needs/routes.
 * Reading the phone never changes a save or awards a benefit. */
export function familyMoments(state:GameState,from:CharacterId):FamilyMoment[]{
  const to=otherPerson(from),now=gameMinutes(state.clock),day=momentDay(now);
  // Prefer the ordinary multi-person menu during an unfinished dinner story.
  const evening=state.relationship.evening;
  const place=state.world.places[from];
  if(place==='home'&&evening&&evening.phase!=='complete')return [];
  if(place!==state.world.places[to])return [];
  const already=state.relationship.memories.filter(m=>
    m.action.startsWith(FAMILY_MOMENT_PREFIX)&&momentDay(m.at)===day).length;
  if(already>=2)return [];
  const options:FamilyMoment[]=[];
  const add=(moment:FamilyMoment)=>{
    if(momentDone(state,moment.id,day))return;
    const a=SOCIAL_BY_ID.get(moment.action);
    if(!a||socialRestriction(a,state,from))return;
    if(moment.item!==undefined&&!activityItems(a,state,from).some(item=>item.id===moment.item))return;
    options.push(moment);
  };
  if(place==='home'){
  const tired=state.characters[to];
  if(tired.mood<=38||tired.energy<=38)add({
    id:'roughDay',emoji:'💛',title:'Сегодня нужен отдых',
    description:personName(to)+(to==='vlad'?' явно устал.':' явно устала.')+' Можно вместе присесть на диван и спокойно поговорить — без спешки и расходов.',
    action:'sofaTalk',bonus:'Забота и небольшой отдых для уставшего партнёра',
  });
  const hungry=PET_IDS.filter(id=>state.pets[id].satiety<45&&state.petBowls[id]===0&&
    state.petFood[id]>0&&!(id==='verdell'&&state.world.dogWalker))
    .sort((a,b)=>state.pets[a].satiety-state.pets[b].satiety)[0];
  if(hungry)add({
    id:'petNeedsUs',emoji:'🐾',title:'Кто-то ждёт ужина',
    description:petName(hungry)+' проголодался. Подойдите к настоящей миске вместе и насыпьте корм из семейных запасов.',
    action:'petFeed',item:hungry,bonus:'Питомец получает настоящий корм, а семья — тёплый момент',
  });
  if(shiftFinished(state,to,now))add({
    id:'afterShift',emoji:'🏠',title:'Встреча после работы',
    description:personName(to)+(to==='vlad'?' недавно вернулся':' недавно вернулась')+' со смены. Давай проведём немного времени на диване и поговорим о прошедшем дне.',
    action:'sofaTalk',bonus:'Немного сил и общения после работы',
  });
  const food=activityItems(SOCIAL_BY_ID.get('eat')!,state,from)[0];
  const delivery=activityItems(SOCIAL_BY_ID.get('takeout')!,state,from)[0];
  if((food||delivery)&&[from,to].some(id=>state.characters[id].hunger<72))add({
    id:'shareDinner',emoji:'🍽️',title:'Пора за общий стол',
    description:'На столе уже есть две свежие порции. Можно поужинать вместе — без повторной готовки.',
    action:food?'eat':'takeout',item:(food??delivery).id,bonus:'Настоящие порции, сытость и уют за общим столом',
  });
  if(lessonMilestone(state,to,now)||Object.values(state.careers.residents[to].progress)
    .some(p=>p?.history?.some(e=>e.title==='Повышение'&&e.at<=now&&now-e.at<=720)))add({
    id:'goodNews',emoji:'✨',title:'Есть что отпраздновать',
    description:personName(to)+(to==='vlad'?' добился':' добилась')+' нового результата в работе или учёбе. Дай пять и порадуйся вместе!',
    action:'highFive',bonus:'Общий радостный момент',
  });
  if(state.dirtyDishes.table+state.dirtyDishes.yardTable>0)add({
    id:'dishesTogether',emoji:'🧽',title:'После ужина — вдвоём',
    description:'На столе осталась грязная посуда. Один соберёт тарелки, другой подойдёт к настоящей раковине.',
    action:'dishes',bonus:'Чистая кухня и больше домашнего уюта',
  });
  if(state.money<5500&&state.clock.minute>=17*60)add({
    id:'simpleEvening',emoji:'📺',title:'Хороший вечер без расходов',
    description:'Сейчас разумнее поберечь деньги. Включите обычный бесплатный канал и посидите рядом на диване.',
    action:'tv',bonus:'Отдых вдвоём, без покупок и подписок',
  });
  const pair=[from,to];
  if(state.clock.minute>=6*60&&state.clock.minute<11*60&&state.pantry.tea>=2)add({
    id:'morningTea',emoji:'☕',title:'Утро без спешки',description:'Две кружки чая и немного времени друг для друга перед началом дня.',action:'teaTogether',bonus:'Уютное утро вместе',
  });
  const lonely=PET_IDS.filter(id=>state.pets[id].happiness<45).find(id=>activityItems(SOCIAL_BY_ID.get('petPet')!,state,from).some(x=>x.id===id));
  if(lonely)add({id:'petAttention',emoji:'🐾',title:'Время для питомца',description:petName(lonely)+' хочет внимания. Побудьте рядом с питомцем вдвоём.',action:'petPet',item:lonely,bonus:'Совместная забота'});
  if(pair.some(id=>state.characters[id].social<50))add({id:'quietTogether',emoji:'💛',title:'Время друг для друга',description:'Сегодня хочется немного общения. Обнимитесь и спокойно посидите рядом.',action:'sofaHug',bonus:'Маленький момент близости'});
  if(state.clock.minute>=10*60&&state.clock.minute<20*60&&pair.some(id=>state.characters[id].fun<50))add({id:'freshAir',emoji:'🌿',title:'Перерыв во дворе',description:'Сделайте паузу в домашних делах и немного прогуляйтесь вместе на свежем воздухе.',action:'walk',bonus:'Прогулка без расходов'});
  add({id:'celebrateToday',emoji:'🎉',title:'Праздник вдвоём',description:'Сегодня особенный день. Поздравьте друг друга и сохраните этот момент.',action:'holidayWish',bonus:'Семейный праздник'});
  }else if(place==='park'){
    add({id:'parkBreak',emoji:'🌳',title:'Наш день в парке',description:'Остановитесь ненадолго и отдохните вместе на скамейке.',action:'parkRest',bonus:'Прогулка в семейном дневнике'});
    add({id:'parkGame',emoji:'🏸',title:'Дружеское соревнование',description:'Сыграйте в бадминтон вдвоём. Главное — время вместе.',action:'parkBadminton',bonus:'Совместная игра'});
  }else if(place==='cafe'){
    add({id:'cafeDate',emoji:'☕',title:'Свидание в кафе',description:'За общим столиком можно помечтать о будущем и обсудить планы.',action:'cafeDreams',bonus:'Воспоминание о свидании'});
  }else if(place==='lake'){
    add({id:'campfireTalk',emoji:'🔥',title:'Вечер у костра',description:'Пока горит общий костёр, поблагодарите друг друга за поездку.',action:'lakeTalk:gratitude',bonus:'Тёплое воспоминание о природе'});
  }
  return options.slice(0,Math.max(0,2-already));
}

/** One strict source of truth for client card, proposal, consent and completion. */
export function momentDenial(state:GameState,from:CharacterId,command:SocialIntent):string|undefined{
  if(command.moment===undefined)return;
  const match=familyMoments(state,from).find(m=>m.id===command.moment);
  if(!match||match.action!==command.action||match.item!==command.item)
    return 'Этот семейный момент сейчас недоступен. Проверьте свежие предложения.';
}

/** Store the completed moment, not a copy of the proposed invitation. */
export function completedMomentText(moment:FamilyMoment):string{
 const pet=moment.item==='verdell'||moment.item==='simba'?PETS[moment.item].name:'питомец';
 const meal=moment.action==='takeout'?TAKEOUT[moment.item as TakeoutId]?.name:RECIPES[moment.item as RecipeId]?.name;
 const text:Record<FamilyMomentId,string>={
  afterShift:'После работы нашли время для спокойного разговора на диване.',
  roughDay:'Побыли рядом в непростой день, поговорили и поддержали друг друга.',
  petNeedsUs:'Вместе позаботились о кормлении: '+pet+'.',
  shareDinner:'Поужинали вдвоём'+(meal?' — '+meal:'')+'.',
  goodNews:'Разделили радость от хороших новостей и поздравили друг друга.',
  dishesTogether:'После еды вместе убрали посуду и навели порядок.',
  simpleEvening:'Провели тихий вечер за обычным телевизором, без лишних покупок.',
  morningTea:'Заварили две кружки чая и спокойно посидели вместе.',
  quietTogether:'Обнялись на диване и уделили время друг другу.',
  petAttention:'Вместе уделили внимание питомцу: '+pet+'.',
  freshAir:'Сделали перерыв в домашних делах и прогулялись вдвоём.',
  parkBreak:'Отдохнули рядом на парковой скамейке.',
  parkGame:'Сыграли в бадминтон вдвоём.',
  cafeDate:'За одним столиком в кафе поговорили о мечтах и будущем.',
  campfireTalk:'Поговорили у общего горящего костра и поблагодарили друг друга за поездку.',
  celebrateToday:'Поздравили друг друга с семейным праздником.'
 };
 return text[moment.id];
}
export function momentReward(state:GameState,from:CharacterId,moment:FamilyMoment):string {
  // The server captured this fully validated moment BEFORE the real task. By now
  // the food may be eaten and the bowl full, so never re-evaluate its old trigger.
  const now=gameMinutes(state.clock),to=otherPerson(from);
  state.relationship.memories.push({
    action:FAMILY_MOMENT_PREFIX+moment.id,group:SOCIAL_BY_ID.get(moment.action)?.group??'care',at:now,
    title:moment.title,description:completedMomentText(moment),
  });
  state.relationship.memories=state.relationship.memories.slice(-FAMILY_MEMORY_LIMIT);
  // Keep small contextual gains only when the moment is completed by both;
  // the physical chore, food and pet rewards come from the existing task.
  const p=state.characters[to],q=state.characters[from];
  if(moment.id==='roughDay'||moment.id==='afterShift'){
    p.comfort=Math.min(100,p.comfort+4);
    p.energy=Math.min(100,p.energy+3);
  }else if(moment.id==='goodNews'){
    p.mood=Math.min(100,p.mood+3);q.mood=Math.min(100,q.mood+3);
  }else if(moment.id==='dishesTogether'){
    p.comfort=Math.min(100,p.comfort+2);q.comfort=Math.min(100,q.comfort+2);
  }
  return ' · 💛 '+moment.title+' — семейное воспоминание сохранено';
}
