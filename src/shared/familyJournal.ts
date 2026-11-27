import type {SocialMemory,SocialGroup} from './socialLife';
import {clockAt} from './life';
export const FAMILY_MEMORY_LIMIT=240;
export const JOURNAL_PAGE_SIZE=12;
export const JOURNAL_FILTERS=['all','story','talk','care','home','romance','fun'] as const;
export type JournalFilter=typeof JOURNAL_FILTERS[number];
export const isFamilyStory=(m:SocialMemory)=>/^(familyMoment:|familyWeekend:|lifeEvent:|holiday:)/.test(m.action)||m.action==='homeEvening';
export function journalEntries(memories:readonly SocialMemory[],filter:JournalFilter='all'){
 return memories.filter(m=>filter==='all'||(filter==='story'?isFamilyStory(m):m.group===filter as SocialGroup)).slice().sort((a,b)=>b.at-a.at);
}
export function journalSummary(memories:readonly SocialMemory[]){
 return {entries:memories.length,days:new Set(memories.map(m=>clockAt(m.at).day)).size,stories:memories.filter(isFamilyStory).length};
}

/** Read-only observations from the retained archive, never a reward or daily obligation. */
export const FAMILY_TRADITIONS=[
 {id:'table',title:'Наш общий стол',icon:'🍽️',actions:['eat','takeout','breakfastCare','breakfastBed','familyMoment:shareDinner']},
 {id:'tea',title:'Чай и кофе вдвоём',icon:'☕',actions:['teaTogether','yardTea','yardCoffee','familyMoment:morningTea']},
 {id:'cinema',title:'Домашнее кино',icon:'🎬',actions:['film','tv','youtube','familyMoment:simpleEvening']},
 {id:'nature',title:'Наши прогулки',icon:'🌳',actions:['walk','parkRest','parkBadminton','parkSwing','picnic','familyMoment:freshAir','familyMoment:parkBreak','familyMoment:parkGame','familyMoment:campfireTalk']},
 {id:'pets',title:'Забота о хвостатых',icon:'🐾',actions:['petPet','petPlay','petFeed','petBrush','familyMoment:petAttention','familyMoment:petNeedsUs']},
 {id:'romance',title:'Время для двоих',icon:'♡',actions:['homeEvening','slowDance','sofaHug','cuddle','familyMoment:quietTogether','familyMoment:cafeDate','cafeDreams']},
 {id:'weekends',title:'Семейные дни',icon:'📅',actions:[]}
] as const;
export function familyTraditions(memories:readonly SocialMemory[]){
 return FAMILY_TRADITIONS.map(t=>{
   const entries=memories.filter(m=>t.id==='weekends'?m.action.startsWith('familyWeekend:'):(t.actions as readonly string[]).includes(m.action));
   const days=new Set(entries.map(m=>clockAt(m.at).day)).size;
   const last=entries.reduce<number|undefined>((best,m)=>best===undefined||m.at>best?m.at:best,undefined);
   return {...t,days,last,established:days>=3};
 }).filter(t=>t.days>0).sort((a,b)=>b.days-a.days||(b.last??0)-(a.last??0));
}
export function familyHighlights(memories:readonly SocialMemory[]){
 const groups=[
  {id:'evening',title:'Первый домашний вечер',match:(m:SocialMemory)=>m.action==='homeEvening'},
  {id:'weekend',title:'Первый семейный день',match:(m:SocialMemory)=>m.action.startsWith('familyWeekend:')},
  {id:'holiday',title:'Первый общий праздник',match:(m:SocialMemory)=>m.action.startsWith('holiday:')},
  {id:'nature',title:'Первый отдых на природе',match:(m:SocialMemory)=>['familyMoment:parkBreak','familyMoment:campfireTalk','parkRest','picnic','lakeTalk:gratitude'].includes(m.action)},
  {id:'date',title:'Первое свидание в кафе',match:(m:SocialMemory)=>['cafeMeal','cafeDreams','familyMoment:cafeDate'].includes(m.action)}
 ];
 return groups.flatMap(g=>{
  const first=memories.filter(g.match).reduce<SocialMemory|undefined>((best,m)=>!best||m.at<best.at?m:best,undefined);
  return first?[{id:g.id,title:g.title,memory:first}]:[];
 }).sort((a,b)=>a.memory.at-b.memory.at);
}
