import type {CharacterId,GameState} from './protocol';
import {mediaTitle,validSelection,nextEpisode,type MediaSelection} from './mediaCatalog';
import {gameMinutes} from './life';
export type Viewing=MediaSelection&{at:number;together:boolean};
export type MediaBookmark=MediaSelection&{seconds:number};
export type MediaLibrary={unfinished?:Record<CharacterId,MediaBookmark[]>;favorites:Record<CharacterId,string[]>;watchLater:Record<CharacterId,string[]>;together:string[];history:Record<CharacterId,Viewing[]>};
export type MediaCommand={type:'media_mark';list:'favorites'|'watchLater'|'together';id:string;enabled:boolean};
export const emptyLibrary=():MediaLibrary=>({unfinished:{vlad:[],alina:[]},favorites:{vlad:[],alina:[]},watchLater:{vlad:[],alina:[]},together:[],history:{vlad:[],alina:[]}});
export const libraryFor=(s:Pick<GameState,'mediaLibrary'>)=>s.mediaLibrary??emptyLibrary();
const roles=['vlad','alina'] as const;
const validList=(a:unknown):a is string[]=>Array.isArray(a)&&a.length<=80&&new Set(a).size===a.length&&a.every(id=>!!mediaTitle(id));
export function validLibrary(v:unknown):v is MediaLibrary{
 if(!v||typeof v!=='object'||Array.isArray(v))return false;
 const l=v as MediaLibrary;
 return (l.unfinished===undefined||!!l.unfinished&&roles.every(r=>Array.isArray(l.unfinished?.[r])&&l.unfinished[r].length<=60&&l.unfinished[r].every(b=>validSelection(b)&&Number.isInteger(b.seconds)&&b.seconds>=1&&b.seconds<120)&&new Set(l.unfinished[r].map(mediaKey)).size===l.unfinished[r].length))&&validList(l.together)&&roles.every(r=>validList(l.favorites?.[r])&&validList(l.watchLater?.[r])&&Array.isArray(l.history?.[r])&&l.history[r].length<=120&&l.history[r].every(h=>!!h&&validSelection(h)&&Number.isSafeInteger(h.at)&&h.at>=0&&typeof h.together==='boolean'));
}
export function markMedia(source:GameState,role:CharacterId,c:Record<string,unknown>){
 if(!mediaTitle(c.id)||typeof c.enabled!=='boolean'||(c.list!=='favorites'&&c.list!=='watchLater'&&c.list!=='together'))return {ok:false as const,reason:'Неизвестный фильм или список'};
 const state=structuredClone(source),lib=state.mediaLibrary??=emptyLibrary(),list=c.list==='together'?lib.together:lib[c.list][role],id=c.id as string;
 if(list.includes(id)===c.enabled)return {ok:true as const,state:source};
 if(c.enabled){if(list.length>=80)return {ok:false as const,reason:'Список заполнен'};list.push(id);}else list.splice(list.indexOf(id),1);
 state.revision++;return {ok:true as const,state};
}
export const mediaKey=(s:MediaSelection)=>s.id+':'+(s.season??0)+':'+(s.episode??0);
export function bookmarkFor(s:GameState,role:CharacterId,selection:MediaSelection){return libraryFor(s).unfinished?.[role].find(b=>mediaKey(b)===mediaKey(selection))?.seconds??0;}
export function saveBookmark(s:GameState,role:CharacterId,selection:MediaSelection,seconds:number){if(!validSelection(selection)||!Number.isFinite(seconds)||seconds<1)return;const lib=s.mediaLibrary??=emptyLibrary(),lists=lib.unfinished??={vlad:[],alina:[]},key=mediaKey(selection),value=Math.min(119,Math.floor(seconds)),old=lists[role].find(b=>mediaKey(b)===key);if(old&&old.seconds>=value)return;lists[role]=[{id:selection.id,...(selection.season?{season:selection.season,episode:selection.episode}:{}),seconds:value},...lists[role].filter(b=>mediaKey(b)!==key)].slice(0,60);}
export function recordViewing(state:GameState,role:CharacterId,selection:MediaSelection,together:boolean){
 if(!validSelection(selection))return;
 const l=state.mediaLibrary??=emptyLibrary(),h=l.history[role];if(l.unfinished)l.unfinished[role]=l.unfinished[role].filter(b=>mediaKey(b)!==mediaKey(selection));
 h.unshift({id:selection.id,...(selection.season?{season:selection.season,episode:selection.episode}:{}),at:gameMinutes(state.clock),together});
 if(h.length>120)h.length=120;
 const index=l.watchLater[role].indexOf(selection.id);if(index>=0&&!nextEpisode(selection))l.watchLater[role].splice(index,1);
}
export function continueSeries(s:GameState,role:CharacterId,id:string){const t=mediaTitle(id);if(!t?.seasons)return;const last=libraryFor(s).history[role].find(x=>x.id===id);return last?nextEpisode(last):{id,season:1,episode:1};}
