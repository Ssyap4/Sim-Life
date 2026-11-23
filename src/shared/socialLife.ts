import { dialogue } from './social/dialogue';
import { BOOKS, GENRES, HOME_SECONDS, type HomeSeat } from './homeLife';
import { RECIPES, TAKEOUT, ingredientList, isGrillRecipe, type RecipeId, type TakeoutId } from './food';
import { MATERIALS } from './educationCatalog';
import { skillRank } from './education';
import { recipeAvailability } from './recipeAvailability';
import { PETS, PET_IDS } from './pets';
import { gameMinutes } from './life';
import { serviceAvailable } from './services';
import { SPENDING_CATEGORIES, SPENDING_KEYS,budgetPeriod } from './familyBudget';
import type { CharacterId, GameState } from './protocol';
import type { Point } from './locations';

export const SOCIAL_GROUPS = {
  talk:['💬','Поговорить'], care:['💛','Поддержать'], home:['🏡','Сделать вместе'],
  romance:['♡','Нежность'], fun:['✦','Отдых'],
} as const;
export type SocialGroup = keyof typeof SOCIAL_GROUPS;
export type HomeEveningPhase = 'prepare' | 'dine' | 'unwind' | 'complete';
/** Shared, saved steps of a real two-player evening; no stages are credited on invite or cancellation. */
export interface HomeEvening {
  /** Unspecified kind is the original 0.26 cooked-dinner plan. */
  kind?: 'cook' | 'leftovers' | 'takeout';
  recipe?: RecipeId;
  takeoutItem?: TakeoutId;
  phase: HomeEveningPhase;
  startedAt: number;
  completedAt?: number;
  /** A grounded, non-punitive mood response to how the family felt when planning. */
  occasion?: 'comfort' | 'rest' | 'ordinary';
  attentionTo?: CharacterId;
}
export const eveningDishId = (evening:HomeEvening) =>
  evening.kind==='takeout' ? evening.takeoutItem : evening.recipe;
export const eveningMealName = (evening:HomeEvening) =>
  evening.kind==='takeout' ? TAKEOUT[evening.takeoutItem!]?.name??'готовая еда'
    : RECIPES[evening.recipe!]?.name??'домашнее блюдо';
export const eveningDinnerAction = (evening:HomeEvening) =>
  evening.kind==='takeout' ? 'takeout' as const : 'eat' as const;
export function eveningSelection(item:string) {
  const [prefix,id]=item.split(':');
  if(prefix==='takeout'&&Object.hasOwn(TAKEOUT,id))
    return {kind:'takeout' as const,takeoutItem:id as TakeoutId};
  if(prefix==='leftovers'&&Object.hasOwn(RECIPES,id))
    return {kind:'leftovers' as const,recipe:id as RecipeId};
  if(Object.hasOwn(RECIPES,item))
    return {kind:'cook' as const,recipe:item as RecipeId};
  return null;
}
export type PairMotion = 'talk'|'listen'|'explain'|'laugh'|'shoulder'|'hug'|'closeHug'|'kiss'|'cheek'|'hands'|'hair'|
  'slowDance'|'dance'|'highFive'|'cuddle'|'sitTalk'|'cook'|'prep'|'grill'|'eat'|'serve'|'wash'|'unpack'|'read'|'watch'|'pet'|'feed'|'stroll';
type Context = 'shift'|'promotion'|'achievement'|'memory'|'film'|'tired'|'lowBudget'|'hungryPet'|'readyFood'|'lowPantry'|'savings'|'overBudget'|'billDue'|'eveningUnwind';
export type ObjectActivity = 'cook'|'grill'|'eat'|'takeout'|'bring'|'serve'|'dishes'|'unpack'|'tv'|'film'|'youtube'|'lesson'|'read'|
  'petPlay'|'petFeed'|'petPet'|'petBrush'|'walk'|'parkRest'|'cafeMeal'|'sofa'|'table';
export type SocialActivity = {
  id:string; title:string; group:SocialGroup; lines:readonly string[]; replies:readonly string[]; motion:PairMotion;
  seconds:number; context?:Context; object?:ObjectActivity; resource?:string; independent?:boolean; memorable?:boolean;
};
const objects: readonly SocialActivity[] = [
  {id:'eveningPlan',title:'Устроить домашний вечер',group:'home',
    lines:['Давай устроим домашний вечер: можем приготовить вдвоём, доесть готовое или разделить доставку.',
      'Хочется провести время вместе. Выберем ужин из того, что уже есть дома?'],
    replies:['Да! Выберем ужин и спокойно отдохнём.','Давай проведём вечер по-своему.'],
    motion:'sitTalk',seconds:9,object:'table',resource:'evening-plan'},
  {id:'eveningHeartTalk',title:'Поговорить по душам после ужина',group:'care',
    lines:['Как ты сегодня? Давай посидим рядом, без спешки, и поделимся тем, что на душе.',
      'Мне важно знать, как прошёл твой день. Можно немного поговорить на диване?'],
    replies:['Расскажу, что меня сегодня порадовало и что тревожило.','Мне хочется просто послушать тебя.'],
    motion:'sitTalk',seconds:16,object:'sofa',context:'eveningUnwind',memorable:true},
  {id:'cook',title:'Приготовить вместе',group:'home',lines:['Поможешь подготовить продукты? Приготовим одну порцию рецепта на двоих.'],replies:['Я подготовлю ингредиенты.','Давай распределим работу у столешницы.'],motion:'cook',seconds:10,object:'cook',resource:'kitchen',memorable:true},
  {id:'grill',title:'Готовить на гриле вдвоём',group:'home',lines:['Поставим блюдо на гриль? Я буду у жаровни, а ты помоги у стола.'],replies:['Подготовлю посуду во дворе.','Скажи, когда нужна помощь с подачей.'],motion:'grill',seconds:13,object:'grill',resource:'grill',memorable:true},
  {id:'eat',title:'Позвать к столу',group:'home',lines:['На двоих хватит. Поедим вместе?'],replies:['Да, расскажу, как прошёл день.','Хочу попробовать и спокойно посидеть.'],motion:'eat',seconds:10,object:'eat',independent:true,memorable:true},
  {id:'takeout',title:'Разделить готовую еду',group:'home',lines:['Разогревать ничего не нужно. Достанем две готовые порции и сядем за стол?'],replies:['Да, давай накроем вместе.','Хорошо, выберу своё место.'],motion:'eat',seconds:9,object:'takeout',independent:true,memorable:true},
  {id:'bring',title:'Угостить готовой порцией',group:'care',lines:['Хочешь, принесу тебе порцию? Можешь сесть за стол и подождать.'],replies:['Да, спасибо. Сейчас это очень кстати.','С удовольствием попробую, пока ты рядом.'],motion:'serve',seconds:9,object:'bring',memorable:true},
  {id:'serve',title:'Подать еду на общий стол',group:'home',lines:['Есть готовая еда в холодильнике. Вынесем одну порцию к столу?'],replies:['Займу место у стола и помогу с подачей.','Давай освобожу место.'],motion:'serve',seconds:7,object:'serve',resource:'serving'},
  {id:'dishes',title:'Убрать посуду вдвоём',group:'home',lines:['Я у раковины, а ты соберёшь тарелки? Управимся вместе.'],replies:['Соберу тарелки с обоих столов.','Давай сложу посуду у раковины.'],motion:'wash',seconds:9,object:'dishes',resource:'kitchen',memorable:true},
  {id:'unpack',title:'Разобрать покупки вместе',group:'home',lines:['На столе остались пакеты. Разложим всё по местам?'],replies:['Разберу пакеты с этой стороны.','Давай сначала освободим стол.'],motion:'unpack',seconds:7,object:'unpack',resource:'shopping'},
  {id:'tv',title:'Посмотреть обычное ТВ',group:'fun',lines:['Включим обычный канал и посидим рядом?'],replies:['Да, только сделаем потише.','Давай, мне хочется обычного тихого вечера.'],motion:'watch',seconds:HOME_SECONDS.freeTv,object:'tv',resource:'tv',independent:true,memorable:true},
  {id:'film',title:'Посмотреть фильм вместе',group:'fun',lines:['Займём диван и посмотрим фильм?'],replies:['Да, я готов смотреть.','Хочу, потом обсудим, что понравилось.'],motion:'watch',seconds:HOME_SECONDS.movie,object:'film',resource:'tv',independent:true,memorable:true},
  {id:'youtube',title:'Посмотреть YouTube вместе',group:'fun',lines:['Есть время на один ролик? Устроимся рядом.'],replies:['Можно короткий ролик и немного тишины.','Давай посмотрим и обсудим.'],motion:'watch',seconds:HOME_SECONDS.youtube,object:'youtube',resource:'tv',independent:true,memorable:true},
  {id:'lesson',title:'Изучить передачу вместе',group:'home',lines:['Посмотрим урок вместе, а потом сравним, что запомнили?'],replies:['Да, попробую запомнить подход из примера.','После урока расскажу, что было новым.'],motion:'watch',seconds:20,object:'lesson',resource:'tv',memorable:true},
  {id:'read',title:'Почитать рядом',group:'home',lines:['Почитаем за одним столом? Можно потом обменяться впечатлениями.'],replies:['Я возьму книгу с полки.','Хорошо, нравится читать в компании.'],motion:'read',seconds:16,object:'read',memorable:true},
  {id:'petPlay',title:'Поиграть с питомцем вдвоём',group:'home',lines:['Давай вместе поиграем с питомцем. Будем по очереди привлекать внимание.'],replies:['Я подожду своей очереди.','Хорошо. Начинай, а я помогу.'],motion:'pet',seconds:12,object:'petPlay',memorable:true},
  {id:'petFeed',title:'Наполнить миску вместе',group:'care',lines:['Проверим миску и насыплем корм, если она пустая?'],replies:['Посмотрю, есть ли место в миске.','Я побуду рядом, пока ты насыплешь корм.'],motion:'feed',seconds:6,object:'petFeed',memorable:true},
  {id:'petPet',title:'Уделить питомцу внимание',group:'care',lines:['Подойдём тихо? Пусть питомец сам решит, сколько внимания ему нужно.'],replies:['Я буду рядом и поглажу после тебя.','Можно немного понаблюдать, а потом подойти.'],motion:'pet',seconds:8,object:'petPet'},
  {id:'petBrush',title:'Расчесать питомца вместе',group:'home',lines:['Подержишь внимание питомца, пока я возьму щётку?'],replies:['Да, побуду рядом с другой стороны.','Хорошо, поможем ему привыкнуть к щётке.'],motion:'pet',seconds:10,object:'petBrush',memorable:true},
  {id:'walk',title:'Прогуляться вместе',group:'fun',lines:['Пройдёмся вместе? Выберем такой темп, чтобы было удобно обоим.'],replies:['Давай пройдём по дорожке.','Хочу немного свежего воздуха.'],motion:'stroll',seconds:22,object:'walk',memorable:true},
  {id:'parkRest',title:'Отдохнуть на скамье',group:'fun',lines:['Передохнём в парке? На скамье есть место для двоих.'],replies:['С удовольствием.','Давай послушаем, что вокруг.'],motion:'sitTalk',seconds:14,object:'parkRest',memorable:true},
  {id:'cafeMeal',title:'Сесть вместе в кафе',group:'home',lines:['Давай сядем за один столик и поедим то, что заказали.'],replies:['Да, понесу свой заказ.','Давай сядем поближе к окну.'],motion:'eat',seconds:12,object:'cafeMeal',independent:true,memorable:true},
  {id:'sofaTalk',title:'Поговорить на диване',group:'care',lines:['Давай сядем на диван. Можно спокойно поговорить, если хочется.'],replies:['Расскажу, что у меня на уме.','Давай начнём с тишины.'],motion:'sitTalk',seconds:14,object:'sofa'},
  {id:'cuddle',title:'Прижаться на диване',group:'romance',lines:['Хочешь сесть рядом и немного прижаться друг к другу?'],replies:['Хочу. Побудем так немного.','Да, мне нравится, когда мы рядом.'],motion:'cuddle',seconds:15,object:'sofa',memorable:true},
  {id:'eveningTea',title:'Обсудить вечер за столом',group:'talk',lines:['Посидим за столом и выберем, как провести вечер?'],replies:['Давай сначала выберем время для отдыха.','Я бы начал с чего-нибудь совсем простого.'],motion:'sitTalk',seconds:12,object:'table'},
  {id:'moneyReview',title:'Спланировать бюджет вдвоём',group:'home',
    lines:['Давай сядем за стол и сверим семейные деньги, накопления и предстоящие расходы.'],
    replies:['Сначала посмотрим, что осталось на жизнь.','Проверим счета и нашу копилку.'],
    motion:'sitTalk',seconds:17,object:'table',memorable:true},
];
const patterns: Record<string,PairMotion> = {
  shift:'explain',story:'explain',decision:'explain',mood:'listen',setback:'listen',quiet:'listen',listen:'listen',help:'listen',
  shoulder:'shoulder',comfortHug:'hug',softHug:'hug',closeHug:'closeHug',kiss:'kiss',cheek:'cheek',hands:'hands',hair:'hair',
  slowDance:'slowDance',dance:'dance',highFive:'highFive',joke:'laugh',tease:'laugh',petComedy:'laugh',storyGame:'explain',
};
const contexts: Record<string,Context> = {shift:'shift',promotion:'promotion',achievement:'achievement',memory:'memory',
  filmTalk:'film',afterWork:'shift',tired:'tired',
  shortBudget:'lowBudget',moneyCare:'lowBudget',petHungerHelp:'hungryPet',
  readyDinner:'readyFood',foodFreshness:'readyFood',emptyShelves:'lowPantry',
  savingMilestone:'savings',overspending:'overBudget',billAlert:'billDue'};
const special = ['comfortHug','shoulder','softHug','closeHug','kiss','cheek','slowDance','promotion','afterWork','storyGame'];
const exchanges = (Object.keys(dialogue) as (keyof typeof dialogue)[]).flatMap(group=>dialogue[group].trim().split('\n').map((row):SocialActivity=>{
  const [id,title,a,b,...replies]=row.split('|');
  const motion=patterns[id]??'talk';
  return {id,title,group,lines:[a,b],replies,motion,seconds:motion==='slowDance'||motion==='dance'?13:
    motion==='hug'||motion==='closeHug'||motion==='kiss'||motion==='cheek'||motion==='highFive'?5:8,context:contexts[id],
    memorable:special.includes(id)};
}));
export const SOCIAL_ACTIVITIES = [...exchanges,...objects];
export const SOCIAL_BY_ID = new Map(SOCIAL_ACTIVITIES.map(a=>[a.id,a]));
export const SOCIAL_TTL_MS = 30_000;
export type SocialIntent = { type:'together'; action:string; item?:string; moment?:string };
export type SocialCommand =
  | {type:'social_propose';action:string;item?:string;moment?:string}
  | {type:'social_reply';inviteId:number;choice:number|null}
  | {type:'social_withdraw';inviteId:number}
  | {type:'social_finish';taskId:number};
export interface SocialOffer { id:number; from:CharacterId; action:string; title:string; text:string; replies:readonly string[]; expiresAt:number; remainingMs?:number }
export type SocialPhase = 'accepted'|'declined'|'expired'|'cancelled'|'interrupted';
export interface SocialMemory { at:number; action:string; title:string; description:string; group:SocialGroup }
export interface Relationship {
  memories:SocialMemory[]; recent: {action:string;at:number}[]; lastTogether?:number; evening?:HomeEvening;
}
export const initialRelationship=():Relationship=>({memories:[],recent:[]});
export interface PairPresentation {
  motion:PairMotion; place:GameState['world']['places'][CharacterId]; from:CharacterId; target?:Point;
  seat?:HomeSeat; station?:string; pet?:string; item?:string; stroll?:Point[];
  offsetMs?:number; carry?:'book'|'plate';
}

export function otherPerson(role:CharacterId):CharacterId { return role==='vlad'?'alina':'vlad'; }
const contacts=new Set<PairMotion>(['hug','closeHug','kiss','cheek','hands','hair','shoulder','slowDance','highFive']);
export const isContact=(motion:PairMotion)=>contacts.has(motion);

function recentCareer(state:GameState,role:CharacterId,titles:string[],minutes:number){
  const now=gameMinutes(state.clock);
  return Object.values(state.careers.residents[role].progress).flatMap(p=>p?.history??[])
    .filter(e=>now>=e.at&&now-e.at<=minutes&&titles.includes(e.title)).sort((a,b)=>b.at-a.at)[0];
}
function latestLesson(state:GameState,role:CharacterId){
  const now=gameMinutes(state.clock);
  return state.education.characters[role].events.slice().reverse().find(e=>e.milestone&&now>=e.at&&now-e.at<1440);
}
export function contextAvailable(a:SocialActivity,state:GameState,from:CharacterId):boolean {
  const partner=otherPerson(from);
  switch(a.context){
    case 'tired': return state.characters[partner].energy<58;
    case 'eveningUnwind':return state.relationship.evening?.phase==='unwind';
    case 'lowBudget': return state.money < 5500;
    case 'savings': return state.savings.balance>=500;
    case 'overBudget': return state.savings.period===budgetPeriod(state.clock)&&
      SPENDING_KEYS.some(id=>state.savings.spent[id]>state.savings.limits[id]);
    case 'billDue': return state.billing.bills.some(b=>b.paidAt===null);
    case 'hungryPet': return state.pets.verdell.satiety < 45 || state.pets.simba.satiety < 45;
    case 'readyFood': return state.readyFood.some(batch => batch.kind === 'meal' && batch.portions > 0);
    case 'lowPantry': return ['eggs','bread','milk','chicken','potato','rice'].filter(key=>
      state.pantry[key as keyof typeof state.pantry] > 0).length < 3;
    case 'shift': return !!recentCareer(state,a.id==='shift'?from:partner,['Смена завершена','Досрочный уход'],720);
    case 'promotion': return !!recentCareer(state,partner,['Повышение'],1440);
    case 'achievement': return !!latestLesson(state,from);
    case 'memory': return !!state.relationship.memories.length;
    case 'film': return state.relationship.memories.some(m=>['film','tv','youtube'].includes(m.action));
    default:return true;
  }
}
export function socialText(a:SocialActivity,state:GameState,from:CharacterId){
  const partner=otherPerson(from);
  if(a.id==='eveningPlan'&&state.characters[partner].mood<45)
    return 'Кажется, '+(partner==='alina'?'Алина':'Влад')+' сегодня не в духе. Может, посидим вместе за ужином и поддержим друг друга?';
  if(a.id==='eveningPlan'&&state.characters[partner].energy<40)
    return (partner==='alina'?'Алина устала.':'Влад устал.')+' Необязательно долго готовить: можно выбрать уже готовое блюдо и отдохнуть вдвоём.';
  const count=state.relationship.recent.filter(r=>r.action===a.id).length;
  return a.lines[count%a.lines.length].replace('{memory}',state.relationship.memories.at(-1)?.title??'')
    .replace('{lesson}',latestLesson(state,from)?.title??'')
    .replace('{balance}',Math.round(state.money).toLocaleString('ru-RU'))
    .replace('{pet}',state.pets.verdell.satiety <= state.pets.simba.satiety
      ? 'Верделл' : 'Симба')
    .replaceAll('{savings}',state.savings.balance.toLocaleString('ru-RU')+' ₽')
    .replaceAll('{goal}',state.savings.goal==='reserve'?'подушка безопасности':
      state.savings.goal==='home'?'обновление дома':
      state.savings.goal==='alinaStudio'?'студия Алины':
      state.savings.goal==='vladStudio'?'студия Влада':'совместный отдых')
    .replaceAll('{category}',SPENDING_CATEGORIES[
      SPENDING_KEYS.find(id=>state.savings.spent[id]>state.savings.limits[id])??'takeout'].label.toLowerCase())
    .replaceAll('{spent}',(state.savings.spent[
      SPENDING_KEYS.find(id=>state.savings.spent[id]>state.savings.limits[id])??'takeout']).toLocaleString('ru-RU'))
    .replaceAll('{debt}',state.billing.bills.filter(b=>b.paidAt===null)
      .reduce((total,b)=>total+b.amount,0).toLocaleString('ru-RU')+' ₽');
}

type Item = {id:string;label:string};
const freshPortions=(state:GameState,kind:'meal'|'takeout',item:string,storage:'table'|'fridge')=>
  state.readyFood.reduce((total,batch)=>total+
    (batch.kind===kind&&batch.item===item&&batch.storage===storage&&batch.expiresAt>gameMinutes(state.clock)
      ? batch.portions:0),0);
const pairItems = new Set<ObjectActivity>(['cook','grill','eat','takeout','bring','serve','film','lesson','read','petPlay','petFeed','petPet','petBrush']);
export const needsItem=(a:SocialActivity)=>a.id==='eveningPlan'||!!a.object&&pairItems.has(a.object);
export function activityItems(a:SocialActivity,state:GameState,from:CharacterId):Item[] {
  const recipeIds=Object.keys(RECIPES) as RecipeId[];
  if(a.id==='eveningPlan') {
    const cooked=recipeIds.filter(id=>!isGrillRecipe(id)&&
      [from,otherPerson(from)].every(role=>recipeAvailability(state,role,id).available))
      .map(id=>({id,label:'🍳 Приготовим · '+RECIPES[id].name}));
    // Fresh food on the table is an actual shared stock, not imaginary servings.
    const ready=recipeIds.filter(id=>state.meals[id]>=2&&freshPortions(state,'meal',id,'table')>=2)
      .map(id=>({id:'leftovers:'+id,label:'🥘 Уже готово · '+RECIPES[id].name}));
    const delivery=(Object.keys(TAKEOUT) as TakeoutId[]).filter(id=>state.takeout[id]>=2&&
      freshPortions(state,'takeout',id,'table')>=2)
      .map(id=>({id:'takeout:'+id,label:'🍕 Доставка на столе · '+TAKEOUT[id].name}));
    return [...ready,...delivery,...cooked];
  }
  switch(a.object){
    case 'cook':case 'grill': return recipeIds.filter(id=>isGrillRecipe(id)===(a.object==='grill')&&ingredientList(id).every(([id,n])=>state.pantry[id]>=n)).map(id=>({id,label:RECIPES[id].name}));
    case 'eat':case 'bring':case 'serve': {
      const count=a.object==='eat'?2:1;
      return recipeIds.filter(id=>state.meals[id]>=count&&
        freshPortions(state,'meal',id,a.object==='serve'?'fridge':'table')>=count)
        .map(id=>({id,label:RECIPES[id].name}));
    }
    case 'takeout':return Object.entries(TAKEOUT).filter(([id])=>
      state.takeout[id as keyof typeof TAKEOUT]>=2&&freshPortions(state,'takeout',id,'table')>=2)
      .map(([id,item])=>({id,label:item.name}));
    case 'film':return Object.entries(GENRES).map(([id,label])=>({id,label}));
    case 'lesson':return MATERIALS.filter(m=>m.channel==='tv'&&(!m.price||state.education.licenses.includes(m.id))&&
      [from,otherPerson(from)].every(role=>skillRank(state.education.characters[role].xp[m.skill]).level>=m.min))
      .map(m=>({id:m.id,label:m.title}));
    case 'read':return Object.entries(BOOKS).map(([id,b])=>({id,label:b[0]}));
    case 'petFeed':case 'petPlay':case 'petPet':case 'petBrush':return PET_IDS.filter(id=>!(id==='verdell'&&state.world.dogWalker)&&
      (a.object==='petFeed'?state.petFood[id]>0&&state.petBowls[id]===0:a.object!=='petPlay'||state.pets[id].satiety>=8))
      .map(id=>({id,label:PETS[id].name}));
    default:return [];
  }
}
export function socialRestriction(a:SocialActivity,state:GameState,from:CharacterId,individual=false):string|undefined {
  const to=otherPerson(from),place=state.world.places[from];
  if (!individual&&place!==state.world.places[to]) return 'Сначала встретьтесь в одной локации';
  if ((individual?[from]:[from,to]).some(role=>state.activeShifts[role]||state.careers.residents[role].shift||state.characters[role].pose==='sleep'))
    return 'Оба игрока должны быть свободны от работы и сна';
  if (!contextAvailable(a,state,from)) return 'Этот разговор пока не подходит к ситуации';
  const name=a.object;
  if (name==='walk'&&place!=='home'&&place!=='park') return 'Для прогулки нужен двор или парк';
  if (name==='parkRest'&&place!=='park') return 'Скамья находится в парке';
  if (name==='cafeMeal'&&place!=='cafe') return 'Столик находится в кафе';
  if (name&&name!=='walk'&&name!=='parkRest'&&name!=='cafeMeal'&&place!=='home') return 'Это занятие доступно дома';
  if (name==='cafeMeal'&&!individual&&![from,to].every(role=>state.world.cafe[role]?.pickedUp)) return 'Сначала заберите оба заказа';
  if (name==='dishes'&&!state.dirtyDishes.table&&!state.dirtyDishes.yardTable) return 'Грязная посуда пока не накопилась';
  if (name==='unpack') return 'Покупки теперь автоматически раскладываются при возвращении домой';
  const now=gameMinutes(state.clock);
  if ((name==='film'||name==='youtube')&&!serviceAvailable(state.billing,'internet',now)) return 'Для просмотра нужен оплаченный интернет';
  if (name==='film'&&!serviceAvailable(state.billing,'netflix',now)) return 'Нужна подписка Netflix';
  if (name==='youtube'&&!serviceAvailable(state.billing,'youtube',now)) return 'Нужна подписка YouTube Premium';
  if (needsItem(a)&&!(individual&&(name==='eat'||name==='takeout'))&&!activityItems(a,state,from).length) return 'Нет подходящих запасов, материалов или свободного питомца';
  if (isContact(a.motion)&&[from,to].some(role=>state.characters[role].energy<11||state.characters[role].bladder<8))
    return 'Сначала лучше заняться самочувствием';
}
