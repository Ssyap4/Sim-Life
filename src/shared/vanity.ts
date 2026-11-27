import type {GameState,CharacterId} from './protocol';
import {gameMinutes} from './life';
export const CARE = {
 bathHairWash:{label:'Мытьё волос с шампунем',group:'hairCondition',points:10,mood:7,hours:18,seconds:45},
 bathHairMask:{label:'Мытьё и питательная маска для волос',group:'hairCondition',points:20,mood:12,hours:24,seconds:90},
 bathHairRitual:{label:'Глубокое восстановление волос',group:'hairCondition',points:28,mood:18,hours:36,seconds:180},
 hairDry:{label:'Сушка феном',group:'hair',points:10,mood:6,hours:12,seconds:40},
 hairStraight:{label:'Выпрямление волос утюжком',group:'hair',points:20,mood:13,hours:24,seconds:60},
 hairCurl:{label:'Укладка локонами',group:'hair',points:25,mood:16,hours:24,seconds:80},
 brush:{label:'Расчесать волосы',group:'hair',points:5,mood:5,hours:12,seconds:15},
 style:{label:'Повседневная укладка',group:'hair',points:15,mood:10,hours:24,seconds:40},
 fancy:{label:'Праздничная укладка',group:'hair',points:20,mood:15,hours:24,seconds:50},
 light:{label:'Лёгкий макияж',group:'makeup',points:15,mood:10,hours:24,seconds:35},
 evening:{label:'Вечерний макияж',group:'makeup',points:25,mood:20,hours:24,seconds:50},
 skin:{label:'Уход за кожей',group:'skin',points:10,mood:10,hours:24,seconds:30},
 hydrate:{label:'Увлажняющий крем',group:'skin',points:15,mood:12,hours:24,seconds:36},
 serum:{label:'Сыворотка и крем для лица',group:'skin',points:20,mood:15,hours:24,seconds:48},
 faceMask:{label:'Питательная маска для лица',group:'skin',points:25,mood:18,hours:24,seconds:65},
 lipCare:{label:'Бальзам и уход за губами',group:'lips',points:5,mood:4,hours:12,seconds:18},
 handCream:{label:'Увлажняющий крем для рук',group:'hands',points:5,mood:4,hours:12,seconds:22},
 bathLavender:{label:'Ванна с лавандовой бомбочкой',group:'body',points:15,mood:12,hours:18,seconds:95},
 bathRose:{label:'Ванна с розовой бомбочкой',group:'body',points:15,mood:12,hours:18,seconds:95},
 bathMilk:{label:'Молочная ванна и увлажнение',group:'body',points:20,mood:15,hours:24,seconds:110},
 bathShave:{label:'Ванна и комплексное бритьё',group:'body',points:22,mood:16,hours:24,seconds:125},
 bathRitual:{label:'Комплексный SPA-уход в ванной',group:'body',points:28,mood:20,hours:24,seconds:165},
 perfume:{label:'Нанести парфюм',group:'scent',points:10,mood:5,hours:12,seconds:8},
 vladShave:{label:'Побриться',group:'skin',points:20,mood:10,hours:24,seconds:30},
 vladStyle:{label:'Уложить волосы',group:'hair',points:20,mood:10,hours:24,seconds:25},
 vladPerfume:{label:'Нанести мужской парфюм',group:'scent',points:20,mood:5,hours:12,seconds:8},
 vladProFade:{label:'Коррекция Fade',group:'hair',points:30,mood:18,hours:72,seconds:50},
 vladProShave:{label:'Королевское бритьё',group:'skin',points:25,mood:15,hours:48,seconds:40},
 vladProStyle:{label:'Профессиональная укладка',group:'hair',points:25,mood:15,hours:48,seconds:35},
 vladProFace:{label:'Уход за лицом',group:'face',points:20,mood:12,hours:48,seconds:40}
} as const;
export type CareId=keyof typeof CARE;
export type CareGroup=typeof CARE[CareId]['group'];
export type CareEffect={id:CareId;until:number;noticed:boolean;appearance?:'style'|'fancy'|'hairStraight'|'hairCurl'};
const explicitStyle=(id:unknown):id is NonNullable<CareEffect['appearance']>=>['style','fancy','hairStraight','hairCurl'].includes(id as string);
export type VanityState=Partial<Record<CareGroup,CareEffect>>;
export const isCare=(x:unknown):x is CareId=>typeof x==='string'&&Object.hasOwn(CARE,x);
export const careRole=(id:CareId):CharacterId=>id.startsWith('vlad')?'vlad':'alina';
export const careEffects=(s:GameState,r:CharacterId='alina')=>Object.values((r==='vlad'?s.vladCare:s.vanity)??{}).filter(e=>e.until>gameMinutes(s.clock));
export const careScore=(s:GameState,r:CharacterId='alina')=>Math.min(100,40+careEffects(s,r).reduce((n,e)=>n+CARE[e.id].points,0));
export const careBonuses=(s:GameState,r:CharacterId)=>{const n=careScore(s,r);return {mood:n>=95?.75:n>=80?.8:n>=60?.9:1,social:n>=95?1.25:n>=80?1.15:1};};
export function validVanity(v:unknown,r:CharacterId='alina'):v is VanityState {
 if(!v||typeof v!=='object'||Array.isArray(v))return false;
 return Object.entries(v as Record<string,unknown>).every(([k,value])=>{if(!value||typeof value!=='object')return false;const e=value as Partial<CareEffect>;return isCare(e.id)&&careRole(e.id)===r&&CARE[e.id].group===k&&typeof e.until==='number'&&Number.isSafeInteger(e.until)&&e.until>=0&&typeof e.noticed==='boolean'&&(e.appearance===undefined||(r==='alina'&&k==='hair'&&explicitStyle(e.appearance)));});
}
export const homeCare=(id:CareId)=>!id.startsWith('vladPro');
export const bathCare=(id:CareId)=>id.startsWith('bath');
export const careStation=(id:CareId)=>bathCare(id)?'bathtub':careRole(id)==='vlad'?'basin':'vanity';
export function finishCare(s:GameState,id:CareId,hours:number=CARE[id].hours){
 const r=careRole(id),effects=r==='vlad'?(s.vladCare??={}):(s.vanity??={});
 const d=CARE[id],now=gameMinutes(s.clock),old=effects[d.group];
 const fresh=!old||old.until<=now;
 const upgrade=!fresh&&CARE[old.id].points<d.points;
 if(!fresh&&CARE[old.id].points>d.points){if(r==='alina'&&explicitStyle(id))old.appearance=id;return;}
 // A refresh can extend an existing effect but cannot farm mood or reset a compliment.
 const next:CareEffect={id,until:Math.max(!fresh?old.until:0,now+hours*60),noticed:fresh||upgrade?false:old.noticed,...(r==='alina'&&explicitStyle(id)?{appearance:id}:{})};
 effects[d.group]=next;
 if(fresh||upgrade)s.characters[r].mood=Math.min(100,s.characters[r].mood+(fresh?d.mood:Math.max(0,d.mood-CARE[old.id].mood)));
}
export const CARE_TOPICS=[
 {id:'nearTalk:vladCareLook',role:'vlad',group:'all',title:'Спросить о своём образе',line:'Как тебе мой сегодняшний образ?',replies:['Очень нравится!','Тебе идёт.','Выглядишь отлично!']},
 {id:'nearTalk:vladCareCompliment',role:'alina',group:'all',title:'Сделать комплимент Владу',line:'Ты сегодня очень хорошо выглядишь!',replies:['Спасибо, приятно слышать.','Рад, что заметила.','Спасибо, любимая!']},
 {id:'nearTalk:careMakeup',role:'alina',group:'makeup',title:'Спросить о макияже',line:'Как тебе мой макияж сегодня?',replies:['Очень красиво, тебе идёт!','Ты сегодня особенно красивая.','Мне нравится, как ты накрасилась.']},
 {id:'nearTalk:careHair',role:'alina',group:'hair',title:'Спросить об укладке',line:'Ну как тебе моя укладка?',replies:['Тебе очень идёт такая причёска!','Выглядишь шикарно.','Мне нравится твоя укладка.']},
 {id:'nearTalk:careScent',role:'alina',group:'scent',title:'Спросить об аромате',line:'Тебе нравится мой аромат?',replies:['Очень приятно пахнешь!','Мне нравится этот аромат.','Иди сюда, обниму тебя.']},
 {id:'nearTalk:careLook',role:'alina',group:'all',title:'Спросить о своём образе',line:'Как я сегодня выгляжу?',replies:['Потрясающе!','Ты сегодня особенно красивая.','Мне очень нравится твой образ.']},
 {id:'nearTalk:careCompliment',role:'vlad',group:'all',title:'Сделать комплимент образу',line:'Ты сегодня прекрасно выглядишь!',replies:['Спасибо, мне очень приятно!','Рада, что ты заметил.','Как приятно это слышать!']}
] as const;
export const careTopic=(id:string)=>CARE_TOPICS.find(t=>t.id===id);
export function careTopicAvailable(s:GameState,r:CharacterId,id:string){
 const t=careTopic(id);return !!t&&r===t.role&&careEffects(s,id.startsWith('nearTalk:vlad')?'vlad':'alina').some(e=>!e.noticed&&(t.group==='all'||CARE[e.id].group===t.group)&&(t.group!=='hair'||e.id!=='brush'));
}
export function rewardCareTopic(s:GameState,r:CharacterId,id:string){
 if(!careTopicAvailable(s,r,id))return false;
 const t=careTopic(id)!,subject=id.startsWith('nearTalk:vlad')?'vlad':'alina';for(const e of careEffects(s,subject))if(t.group==='all'||CARE[e.id].group===t.group)e.noticed=true;
 const c=s.characters[subject];c.mood=Math.min(100,c.mood+15);c.social=Math.min(100,c.social+20*careBonuses(s,subject).social);
 return true;
}
