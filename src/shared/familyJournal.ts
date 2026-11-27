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
