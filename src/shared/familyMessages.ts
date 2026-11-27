import type {CharacterId,GameState} from './protocol';
import {gameMinutes} from './life';
export const MESSAGE_LIMIT=400, HISTORY_LIMIT=160;
export type FamilyMessage={id:number;from:CharacterId;at:number;text:string};
export type FamilyMessages={nextId:number;items:FamilyMessage[];read:Record<CharacterId,number>};
export type MessageCommand={type:'family_message_send';text:string}|{type:'family_message_read';through:number};
export function emptyMessages():FamilyMessages{return {nextId:1,items:[],read:{vlad:0,alina:0}};}
export function normalizeMessage(text:unknown):string|null{
 if(typeof text!=='string')return null;
 const value=text.replace(/\r\n?/g,'\n').trim();
 return value.length>0&&value.length<=MESSAGE_LIMIT&&!/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(value)?value:null;
}
export function validFamilyMessages(value:unknown):value is FamilyMessages{
 if(!value||typeof value!=='object'||Array.isArray(value))return false;
 const m=value as FamilyMessages;
 if(!Number.isSafeInteger(m.nextId)||m.nextId<1||!Array.isArray(m.items)||m.items.length>HISTORY_LIMIT||!m.read)return false;
 if(!(['vlad','alina'] as const).every(r=>Number.isSafeInteger(m.read[r])&&m.read[r]>=0&&m.read[r]<m.nextId))return false;
 let previous=0;
 return m.items.every(x=>{if(!x||!Number.isSafeInteger(x.id)||x.id<=previous||x.id>=m.nextId||!['vlad','alina'].includes(x.from)||!Number.isSafeInteger(x.at)||x.at<0||normalizeMessage(x.text)!==x.text)return false;previous=x.id;return true;});
}
export function messagesFor(s:Pick<GameState,'familyMessages'>){return s.familyMessages??emptyMessages();}
export function unreadMessages(s:Pick<GameState,'familyMessages'>,role:CharacterId){const m=messagesFor(s);return m.items.filter(x=>x.from!==role&&x.id>m.read[role]);}
export function applyFamilyMessage(source:GameState,role:CharacterId,command:Record<string,unknown>){
 const current=messagesFor(source);
 if(command.type==='family_message_send'){
  const text=normalizeMessage(command.text);if(text===null)return {ok:false as const,reason:'Сообщение должно содержать от 1 до 400 символов'};
  if(current.nextId>=Number.MAX_SAFE_INTEGER)return {ok:false as const,reason:'История переписки заполнена'};
  const state=structuredClone(source),m=state.familyMessages??=emptyMessages();
  m.items.push({id:m.nextId++,from:role,at:gameMinutes(state.clock),text});
  if(m.items.length>HISTORY_LIMIT)m.items.splice(0,m.items.length-HISTORY_LIMIT);
  state.revision++;return {ok:true as const,state};
 }
 if(command.type!=='family_message_read'||typeof command.through!=='number'||!Number.isSafeInteger(command.through)||command.through<0||command.through>=current.nextId)return {ok:false as const,reason:'Некорректная отметка прочтения'};
 if(command.through<=current.read[role])return {ok:true as const,state:source};
 const state=structuredClone(source),m=state.familyMessages??=emptyMessages();m.read[role]=command.through;state.revision++;
 return {ok:true as const,state};
}
