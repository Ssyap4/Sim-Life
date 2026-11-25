import type {GameState,CharacterId} from './protocol';
import {gameMinutes} from './life';
export const CARE = {
 brush:{label:'Расчесать волосы',group:'hair',points:5,mood:5,hours:12,seconds:15},
 style:{label:'Повседневная укладка',group:'hair',points:15,mood:10,hours:24,seconds:40},
 fancy:{label:'Праздничная укладка',group:'hair',points:20,mood:15,hours:24,seconds:50},
 light:{label:'Лёгкий макияж',group:'makeup',points:15,mood:10,hours:24,seconds:35},
 evening:{label:'Вечерний макияж',group:'makeup',points:25,mood:20,hours:24,seconds:50},
 skin:{label:'Уход за кожей',group:'skin',points:10,mood:10,hours:24,seconds:30},
 perfume:{label:'Нанести парфюм',group:'scent',points:10,mood:5,hours:12,seconds:8}
} as const;
export type CareId=keyof typeof CARE;
export type CareGroup=typeof CARE[CareId]['group'];
export type CareEffect={id:CareId;until:number;noticed:boolean};
export type VanityState=Partial<Record<CareGroup,CareEffect>>;
export const isCare=(x:unknown):x is CareId=>typeof x==='string'&&Object.hasOwn(CARE,x);
export const careEffects=(s:GameState)=>Object.values(s.vanity??{}).filter(e=>e.until>gameMinutes(s.clock));
export const careScore=(s:GameState)=>Math.min(100,40+careEffects(s).reduce((n,e)=>n+CARE[e.id].points,0));
export const careBonuses=(s:GameState,r:CharacterId)=>{const n=r==='alina'?careScore(s):40;return {mood:n>=95?.75:n>=80?.8:n>=60?.9:1,social:n>=95?1.25:n>=80?1.15:1};};
export function validVanity(v:unknown):v is VanityState {
 if(!v||typeof v!=='object'||Array.isArray(v))return false;
 return Object.entries(v as Record<string,unknown>).every(([k,value])=>{if(!value||typeof value!=='object')return false;const e=value as Partial<CareEffect>;return isCare(e.id)&&CARE[e.id].group===k&&typeof e.until==='number'&&Number.isSafeInteger(e.until)&&e.until>=0&&typeof e.noticed==='boolean';});
}
export function finishCare(s:GameState,id:CareId){
 const d=CARE[id],now=gameMinutes(s.clock),old=s.vanity?.[d.group];
 const fresh=!old||old.until<=now;
 const upgrade=!fresh&&CARE[old.id].points<d.points;
 if(!fresh&&CARE[old.id].points>d.points)return;
 // A refresh can extend an existing effect but cannot farm mood or reset a compliment.
 const next:CareEffect={id,until:now+d.hours*60,noticed:fresh||upgrade?false:old.noticed};
 (s.vanity??={})[d.group]=next;
 if(fresh||upgrade)s.characters.alina.mood=Math.min(100,s.characters.alina.mood+(fresh?d.mood:Math.max(0,d.mood-CARE[old.id].mood)));
}
export const CARE_TOPICS=[
 {id:'nearTalk:careMakeup',role:'alina',group:'makeup',title:'Спросить о макияже',line:'Как тебе мой макияж сегодня?',replies:['Очень красиво, тебе идёт!','Ты сегодня особенно красивая.','Мне нравится, как ты накрасилась.']},
 {id:'nearTalk:careHair',role:'alina',group:'hair',title:'Спросить об укладке',line:'Ну как тебе моя укладка?',replies:['Тебе очень идёт такая причёска!','Выглядишь шикарно.','Мне нравится твоя укладка.']},
 {id:'nearTalk:careScent',role:'alina',group:'scent',title:'Спросить об аромате',line:'Тебе нравится мой аромат?',replies:['Очень приятно пахнешь!','Мне нравится этот аромат.','Иди сюда, обниму тебя.']},
 {id:'nearTalk:careLook',role:'alina',group:'all',title:'Спросить о своём образе',line:'Как я сегодня выгляжу?',replies:['Потрясающе!','Ты сегодня особенно красивая.','Мне очень нравится твой образ.']},
 {id:'nearTalk:careCompliment',role:'vlad',group:'all',title:'Сделать комплимент образу',line:'Ты сегодня прекрасно выглядишь!',replies:['Спасибо, мне очень приятно!','Рада, что ты заметил.','Как приятно это слышать!']}
] as const;
export const careTopic=(id:string)=>CARE_TOPICS.find(t=>t.id===id);
export function careTopicAvailable(s:GameState,r:CharacterId,id:string){
 const t=careTopic(id);return !!t&&r===t.role&&careEffects(s).some(e=>!e.noticed&&(t.group==='all'||CARE[e.id].group===t.group)&&(t.group!=='hair'||e.id!=='brush'));
}
export function rewardCareTopic(s:GameState,r:CharacterId,id:string){
 if(!careTopicAvailable(s,r,id))return false;
 const t=careTopic(id)!;for(const e of careEffects(s))if(t.group==='all'||CARE[e.id].group===t.group)e.noticed=true;
 const c=s.characters.alina;c.mood=Math.min(100,c.mood+15);c.social=Math.min(100,c.social+20*careBonuses(s,'alina').social);
 return true;
}
