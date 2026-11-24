import {gameMinutes} from './life';
import type {CharacterId,Needs,TimedCommand,GameState} from './protocol';
export type EmotionId='happy'|'inspired'|'calm'|'tired'|'hungry'|'uncomfortable'|'lonely'|'bored'|'sad'|'tense';
export const PERSONALITIES={
 vlad:{pet:'simba',traits:['Любознательный','Технический склад ума','Любит игры'],favorite:['games','study','pet']},
 alina:{pet:'verdell',traits:['Творческая','Общительная','Любит уют'],favorite:['music','social','pet','home']}
} as const;
const info:Record<EmotionId,{label:string;emoji:string;reason:string}>={
 happy:{label:'Счастливое',emoji:'😊',reason:'Хорошее настроение и основные потребности в порядке.'},
 inspired:{label:'Вдохновлённое',emoji:'✨',reason:'Есть силы и настроение для любимых занятий.'},
 calm:{label:'Спокойное',emoji:'😌',reason:'Сейчас ничего особенно не беспокоит.'},
 tired:{label:'Усталость',emoji:'😴',reason:'Мало энергии — нужен отдых.'},
 hungry:{label:'Голод',emoji:'🍲',reason:'Хочется нормально поесть.'},
 uncomfortable:{label:'Дискомфорт',emoji:'😣',reason:'Бытовые потребности мешают расслабиться.'},
 lonely:{label:'Одиночество',emoji:'💬',reason:'Не хватает общения и внимания.'},
 bored:{label:'Скука',emoji:'🥱',reason:'Давно не было интересного занятия.'},
 sad:{label:'Грусть',emoji:'😔',reason:'Общее настроение заметно снизилось.'},
 tense:{label:'Напряжение',emoji:'😟',reason:'Несколько потребностей требуют внимания.'}
};
export type Emotion={id:EmotionId;label:string;emoji:string;reason:string};
export function emotionFor(n:Needs,events:readonly EmotionalEvent[]=[]):Emotion{
 const physical=[{id:'uncomfortable' as const,value:Math.min(n.bladder,n.hygiene,n.comfort)},{id:'hungry' as const,value:n.hunger},{id:'tired' as const,value:n.energy}].sort((a,b)=>a.value-b.value);
 let id:EmotionId='calm';
 if(physical[0].value<=25)id=physical[0].id;
 else if([n.hunger,n.energy,n.bladder,n.hygiene,n.comfort,n.social,n.fun].filter(v=>v<=40).length>=3)id='tense';
 else if(n.energy<=40)id='tired';
 else if(n.hunger<=40)id='hungry';
 else if(physical[0].value<=40)id='uncomfortable';
 else if(n.social<=40)id='lonely';
 else if(n.fun<=40)id='bored';
 else if(events.length){const event=events[0];return {id:event.emotion,...info[event.emotion],reason:EVENTS[event.kind].label};}
 else if(n.mood<=35)id='sad';
 else if(n.mood>=85&&n.energy>=65&&n.fun>=65)id='happy';
 else if(n.mood>=70&&n.energy>=65&&n.fun>=50)id='inspired';
 return {id,...info[id]};
}
export const EVENTS={
 mealGood:{label:'Вкусная еда',emotion:'happy',minutes:120},
 mealBad:{label:'Неудачное блюдо',emotion:'sad',minutes:90},
 cookGood:{label:'Удачная готовка',emotion:'inspired',minutes:90},
 cookBad:{label:'Готовка не удалась',emotion:'sad',minutes:60},
 pet:{label:'Приятное время с питомцем',emotion:'happy',minutes:120},
 favoritePet:{label:'Время с любимым питомцем',emotion:'happy',minutes:150},
 familyCare:{label:'Поддержка близкого человека',emotion:'calm',minutes:100},
 familyCoffee:{label:'Кофе вдвоём на свежем воздухе',emotion:'calm',minutes:100},
 together:{label:'Приятное время вдвоём',emotion:'happy',minutes:150},
 movie:{label:'Приятный просмотр',emotion:'calm',minutes:90},
 study:{label:'Успешное занятие',emotion:'inspired',minutes:120},
 promotion:{label:'Повышение на работе',emotion:'inspired',minutes:240},
 shift:{label:'Рабочий день завершён',emotion:'inspired',minutes:120},
 music:{label:'Музыкальный отдых',emotion:'calm',minutes:75},
 quietMorning:{label:'Приятное начало дня',emotion:'calm',minutes:90},
 creativeSpark:{label:'Пришла интересная идея',emotion:'inspired',minutes:120},
 cozyEvening:{label:'Спокойный вечер дома',emotion:'calm',minutes:90},
 teaMoment:{label:'Чайный перерыв',emotion:'calm',minutes:75},
 readingMoment:{label:'Интересная книга',emotion:'inspired',minutes:90},
 tidyMoment:{label:'Дома стало уютнее',emotion:'happy',minutes:90},
 friendlyCall:{label:'Приятное общение',emotion:'happy',minutes:90}
} as const;
export type EventKind=keyof typeof EVENTS;
export type EmotionalEvent={kind:EventKind;emotion:EmotionId;until:number};
export type EmotionalHistory=Record<CharacterId,EmotionalEvent[]>;
export function activeEmotions(s:GameState,role:CharacterId):EmotionalEvent[]{return (s.emotionalEvents?.[role]??[]).filter(e=>e.until>gameMinutes(s.clock));}
export function residentEmotion(s:GameState,role:CharacterId):Emotion{return emotionFor(s.characters[role],activeEmotions(s,role));}
export function recordEmotion(s:GameState,role:CharacterId,kind:EventKind):void{
 const spec=EVENTS[kind];s.emotionalEvents??={vlad:[],alina:[]};
 s.emotionalEvents[role]=[{kind,emotion:spec.emotion,until:gameMinutes(s.clock)+spec.minutes},...activeEmotions(s,role).filter(e=>e.kind!==kind)].slice(0,4);
}
export function validEmotionalHistory(value:unknown):boolean{
 if(!value||typeof value!=='object')return false;
 const v=value as EmotionalHistory;
 return (['vlad','alina'] as const).every(role=>Array.isArray(v[role])&&v[role].length<=4&&v[role].every(e=>e&&Object.hasOwn(EVENTS,e.kind)&&EVENTS[e.kind].emotion===e.emotion&&Number.isSafeInteger(e.until)&&e.until>=0));
}
export function recordCompletedActivity(s:GameState,role:CharacterId,c:TimedCommand):void{
 if(c.type==='pet_action'&&['pet','play','brush'].includes(c.action))recordEmotion(s,role,c.pet===PERSONALITIES[role].pet?'favoritePet':'pet');
 else if(c.type==='together')recordEmotion(s,role,c.action==='yardCoffee'?'familyCoffee':['nearTalk:listen','nearTalk:compliment'].includes(c.action)?'familyCare':'together');
 else if(c.type==='study')recordEmotion(s,role,'study');
 else if(c.type==='read_book')recordEmotion(s,role,'readingMoment');
 else if(['movie','youtube','free_tv','computer_video'].includes(c.type))recordEmotion(s,role,'movie');
 else if(c.type==='act'||c.type==='furniture_use'){
  const a=c.type==='act'?c.actionId:c.action;
  if(a==='kitchenTea')recordEmotion(s,role,'teaMoment');
  else if(a==='sofaRead')recordEmotion(s,role,'readingMoment');
  else if(a==='kitchenTidy'||a==='kitchenDishes')recordEmotion(s,role,'tidyMoment');
  else if(a==='sofaCall'||a==='tableTalk')recordEmotion(s,role,'friendlyCall');
  else if(a==='sofaMusic')recordEmotion(s,role,'music');
  else if(['movie','youtube','free_tv'].includes(a))recordEmotion(s,role,'movie');
  else if(['vladStudy','alinaStudy'].includes(a))recordEmotion(s,role,'study');
 }
}
type Preference='games'|'study'|'pet'|'music'|'social'|'rest'|'reading'|'home'|'video'|'other';
export function leisureKind(c:TimedCommand):Preference{
 if(c.type==='play_game')return 'games';
 if(c.type==='computer_video'||c.type==='free_tv')return 'video';
 if(c.type==='read_book')return 'reading';
 if(c.type==='pet_action')return 'pet';
 if(c.type==='act'||c.type==='furniture_use'){
  const a=c.type==='act'?c.actionId:c.action;
  if(a==='deskGames')return 'games';
  if(a==='sofaMusic')return 'music';
  if(a==='sofaCall'||a==='tableTalk')return 'social';
  if(['vladStudy','alinaStudy','deskJournal','vladOrder','alinaConsult'].includes(a))return 'study';
  if(['sofaRest','bathSoak','kitchenTea'].includes(a))return 'rest';
  if(a==='tablePlan'||a==='kitchenTidy'||a==='kitchenDishes')return 'home';
 }
 return 'other';
}
export function emotionPreference(role:CharacterId,e:EmotionId,kind:Preference):number{
 const favorite:readonly string[]=PERSONALITIES[role].favorite;
 let score=favorite.includes(kind)?1:0;
 if((e==='tired'||e==='tense'||e==='uncomfortable')&&['rest','music','reading'].includes(kind))score+=4;
 if(e==='lonely'&&['social','pet'].includes(kind))score+=4;
 if(e==='bored'&&['games','music','video','pet'].includes(kind))score+=3;
 if(e==='sad'&&['pet','music','rest'].includes(kind))score+=3;
 if(e==='inspired'&&kind==='study')score+=3;
 return score;
}
export function rankLeisure<T extends TimedCommand>(actions:readonly T[],role:CharacterId,n:Needs,turn:number,emotion?:EmotionId):T[]{
 const e=emotion??emotionFor(n).id;
 // A regular unweighted turn prevents preferences monopolizing free time.
 if(turn%3===2)return [...actions];
 const score=(c:T)=>emotionPreference(role,e,leisureKind(c))+(c.type==='pet_action'&&c.pet===PERSONALITIES[role].pet?1:0);
 return [...actions].sort((a,b)=>score(b)-score(a));
}
export function wishEmotionPriority(id:string,role:CharacterId,e:EmotionId):number{
 if(id.startsWith('goal-'))return 10;
 if(id.startsWith('companion-'))return emotionPreference(role,e,'pet');
 if(id==='together-time'||id==='quiet-call')return emotionPreference(role,e,'social');
 if(id.includes('music'))return emotionPreference(role,e,'music');
 if(id.startsWith('learn-'))return emotionPreference(role,e,'study');
 if(id==='game-break')return emotionPreference(role,e,'games');
 if(id==='tea-break'||id==='rest-break')return emotionPreference(role,e,'rest');
 if(id==='cozy-home')return emotionPreference(role,e,'home');
 if(id.startsWith('cook-')&&e==='inspired')return 2;
 if(id==='reading')return emotionPreference(role,e,'reading');
 return 0;
}
