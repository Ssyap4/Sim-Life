import type {CharacterId,GameState} from './protocol';
import {mediaTitle,validSelection,nextEpisode,type MediaSelection} from './mediaCatalog';
import {gameMinutes} from './life';
export type Viewing=MediaSelection&{at:number;together:boolean};
export type MediaLibrary={favorites:Record<CharacterId,string[]>;watchLater:Record<CharacterId,string[]>;together:string[];history:Record<CharacterId,Viewing[]>};
export type MediaCommand={type:'media_mark';list:'favorites'|'watchLater'|'together';id:string;enabled:boolean};
export const emptyLibrary=():MediaLibrary=>({favorites:{vlad:[],alina:[]},watchLater:{vlad:[],alina:[]},together:[],history:{vlad:[],alina:[]}});
export const libraryFor=(s:Pick<GameState,'mediaLibrary'>)=>s.mediaLibrary??emptyLibrary();
const roles=['vlad','alina'] as const;
const validList=(a:unknown):a is string[]=>Array.isArray(a)&&a.length<=80&&new Set(a).size===a.length&&a.every(id=>!!mediaTitle(id));
export function validLibrary(v:unknown):v is MediaLibrary{
 if(!v||typeof v!=='object'||Array.isArray(v))return false;
 const l=v as MediaLibrary;
 return validList(l.together)&&roles.every(r=>validList(l.favorites?.[r])&&validList(l.watchLater?.[r])&&Array.isArray(l.history?.[r])&&l.history[r].length<=120&&l.history[r].every(h=>!!h&&validSelection(h)&&Number.isSafeInteger(h.at)&&h.at>=0&&typeof h.together==='boolean'));
}
export function markMedia(source:GameState,role:CharacterId,c:Record<string,unknown>){
 if(!mediaTitle(c.id)||typeof c.enabled!=='boolean'||(c.list!=='favorites'&&c.list!=='watchLater'&&c.list!=='together'))return {ok:false as const,reason:'Неизвестный фильм или список'};
 const state=structuredClone(source),lib=state.mediaLibrary??=emptyLibrary(),list=c.list==='together'?lib.together:lib[c.list][role],id=c.id as string;
 if(list.includes(id)===c.enabled)return {ok:true as const,state:source};
 if(c.enabled){if(list.length>=80)return {ok:false as const,reason:'Список заполнен'};list.push(id);}else list.splice(list.indexOf(id),1);
 state.revision++;return {ok:true as const,state};
}
export function recordViewing(state:GameState,role:CharacterId,selection:MediaSelection,together:boolean){
 if(!validSelection(selection))return;
 const l=state.mediaLibrary??=emptyLibrary(),h=l.history[role];
 h.unshift({id:selection.id,...(selection.season?{season:selection.season,episode:selection.episode}:{}),at:gameMinutes(state.clock),together});
 if(h.length>120)h.length=120;
 const index=l.watchLater[role].indexOf(selection.id);if(index>=0&&!nextEpisode(selection))l.watchLater[role].splice(index,1);
}
export function continueSeries(s:GameState,role:CharacterId,id:string){const t=mediaTitle(id);if(!t?.seasons)return;const last=libraryFor(s).history[role].find(x=>x.id===id);return last?nextEpisode(last):{id,season:1,episode:1};}
