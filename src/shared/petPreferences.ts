import {FURNITURE_BY_ID,type FurnishingState} from './furniture';
import {isPetBed,isPetScratcher} from './petFurniture';
import type {PetId,PetState} from './pets';
import type {CatPerch} from './CatPerches';
export type FurniturePreference=0|1|2|3;
export const FURNITURE_REACTIONS=['Не нравится','Нормально','Уютно','Любимое место'] as const;
export const furniturePreference=(p:PetState,key:string)=>p.furniturePreferences?.[key]??2;
export function discoverFurniture(p:PetState,key:string,random=Math.random):FurniturePreference{
 const known=p.furniturePreferences?.[key];if(known!==undefined)return known;
 const r=random(),value=r<.15?0:r<.45?1:r<.8?2:3;
 (p.furniturePreferences??={})[key]=value;return value;
}
export function housePreferenceKey(f:FurnishingState,site:CatPerch){
 if(!site.entry)return undefined;
 const item=f.placed.find(i=>i.id===Number(site.key.split(':')[1]));
 return item?.sku.startsWith('pet-house-')?item.sku+':'+site.entry:undefined;
}
export function validFurniturePreferences(p:PetState,id:PetId){
 const prefs=p.furniturePreferences;if(prefs===undefined)return true;
 return !!prefs&&typeof prefs==='object'&&!Array.isArray(prefs)&&Object.entries(prefs).every(([key,v])=>{
  const [sku,entry,extra]=key.split(':');if(extra||!FURNITURE_BY_ID.has(sku)||![0,1,2,3].includes(v))return false;
  return entry===undefined?(isPetBed(sku,id)||id==='simba'&&isPetScratcher(sku)):id==='simba'&&sku.startsWith('pet-house-')&&['inside','jump'].includes(entry);
 });
}
export const PET_EVENTS=['welcome','sniff','groom','blink'] as const;
export type PetEvent=typeof PET_EVENTS[number];
export const EVENT_TEXT:Record<PetEvent,{title:string;message:string;advice:string}>={
 welcome:{title:'🐾 Рад встрече',message:'Верделл сам подошёл поздороваться и радуется хозяину.',advice:'Можно погладить Верделла'},
 sniff:{title:'🐕 Что-то учуял',message:'Верделл заинтересовался запахом и обнюхивает пол.',advice:'Пусть спокойно исследует дом'},
 groom:{title:'🐈 Наводит красоту',message:'Симба устроил себе короткий сеанс умывания.',advice:'Не нужно купать кота'},
 blink:{title:'🐈 Кошачье приветствие',message:'Симба подошёл к хозяину и медленно моргает.',advice:'Можно ответить лаской'},
};
export const validEvent=(event:unknown,id:PetId)=>id==='verdell'?event==='welcome'||event==='sniff':event==='groom'||event==='blink';
