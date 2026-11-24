import type {CharacterId,Needs,TimedCommand} from './protocol';
export type EmotionId='happy'|'inspired'|'calm'|'tired'|'hungry'|'uncomfortable'|'lonely'|'bored'|'sad'|'tense';
export const PERSONALITIES={
 vlad:{traits:['Любознательный','Технический склад ума','Любит игры'],favorite:['games','study','pet']},
 alina:{traits:['Творческая','Общительная','Любит уют'],favorite:['music','social','pet']}
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
export function emotionFor(n:Needs):Emotion{
 const physical=[{id:'uncomfortable' as const,value:Math.min(n.bladder,n.hygiene,n.comfort)},{id:'hungry' as const,value:n.hunger},{id:'tired' as const,value:n.energy}].sort((a,b)=>a.value-b.value);
 let id:EmotionId='calm';
 if(physical[0].value<=25)id=physical[0].id;
 else if([n.hunger,n.energy,n.bladder,n.hygiene,n.comfort,n.social,n.fun].filter(v=>v<=40).length>=3)id='tense';
 else if(n.energy<=40)id='tired';
 else if(n.hunger<=40)id='hungry';
 else if(physical[0].value<=40)id='uncomfortable';
 else if(n.social<=40)id='lonely';
 else if(n.fun<=40)id='bored';
 else if(n.mood<=35)id='sad';
 else if(n.mood>=85&&n.energy>=65&&n.fun>=65)id='happy';
 else if(n.mood>=70&&n.energy>=65&&n.fun>=50)id='inspired';
 return {id,...info[id]};
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
export function rankLeisure<T extends TimedCommand>(actions:readonly T[],role:CharacterId,n:Needs,turn:number):T[]{
 const e=emotionFor(n).id;
 // A regular unweighted turn prevents preferences monopolizing free time.
 if(turn%3===2)return [...actions];
 return [...actions].sort((a,b)=>emotionPreference(role,e,leisureKind(b))-emotionPreference(role,e,leisureKind(a)));
}
export function wishEmotionPriority(id:string,role:CharacterId,e:EmotionId):number{
 if(id.startsWith('goal-'))return 10;
 if(id.startsWith('companion-'))return emotionPreference(role,e,'pet');
 if(id==='together-time'||id==='quiet-call')return emotionPreference(role,e,'social');
 if(id.includes('music'))return emotionPreference(role,e,'music');
 if(id.startsWith('learn-'))return emotionPreference(role,e,'study');
 if(id==='game-break')return emotionPreference(role,e,'games');
 if(id==='tea-break')return emotionPreference(role,e,'rest');
 if(id==='reading')return emotionPreference(role,e,'reading');
 return 0;
}
