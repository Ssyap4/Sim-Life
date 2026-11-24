import {isSpeakerSku,isMusicGenre,isSpeakerTrack,SPEAKER_TRACKS,TRACK_MINUTES,trackInfo,type MusicGenre,type SpeakerTrackId} from './speakerCatalog';
import {gameMinutes,clockLabel} from './life';
import {weatherAt,WEATHER_INFO} from './weather';
import {controlVacuum} from './vacuum';
import type {CharacterId,GameState} from './protocol';
export type SpeakerAction='play'|'random'|'next'|'stop'|'volume'|'weather'|'time'|'alarm'|'cancelAlarm'|'joke'|'morning'|'night'|'vacuum';
export type SpeakerCommand={type:'speaker_control';id:number;action:SpeakerAction;genre?:MusicGenre;volume?:number;minute?:number};
export type SpeakerDevice={volume:number;track?:SpeakerTrackId;startedAt:number;shuffle:boolean;alarmAt?:number;reply?:{seq:number;at:number;text:string;to:CharacterId|'all'}};
export type SpeakerState=Record<number,SpeakerDevice>;
export const speakerItems=(state:GameState)=>state.furnishing.placed.filter(p=>isSpeakerSku(p.sku));
export const speakerDevice=(state:GameState,id:number):SpeakerDevice=>state.speakers?.[id]??{volume:60,startedAt:0,shuffle:false};
export function validSpeakers(raw:unknown):raw is SpeakerState{
 if(!raw||typeof raw!=='object'||Array.isArray(raw))return false;
 const entries=Object.entries(raw);if(entries.length>12)return false;
 const time=(x:unknown)=>typeof x==='number'&&Number.isSafeInteger(x)&&x>=0;
 return entries.every(([id,v])=>/^\d+$/.test(id)&&Number(id)>0&&v&&typeof v==='object'&&Number.isInteger(v.volume)&&v.volume>=0&&v.volume<=100&&time(v.startedAt)&&typeof v.shuffle==='boolean'&&(v.track===undefined||isSpeakerTrack(v.track))&&(v.alarmAt===undefined||time(v.alarmAt))&&(!v.reply||time(v.reply.seq)&&time(v.reply.at)&&typeof v.reply.text==='string'&&v.reply.text.length<=240&&['vlad','alina','all'].includes(v.reply.to)));
}
function reply(d:SpeakerDevice,at:number,text:string,to:CharacterId|'all'){d.reply={seq:(d.reply?.seq??0)+1,at,text,to};}
function choose(d:SpeakerDevice,genre?:MusicGenre,random=false){
 const pool=SPEAKER_TRACKS.filter(t=>(!genre||t.genre===genre)&&t.id!==d.track);
 return (random?pool[Math.floor(Math.random()*pool.length)]:pool[0])?.id??SPEAKER_TRACKS[0].id;
}
export function applySpeaker(state:GameState,role:CharacterId,cmd:SpeakerCommand):string|undefined{
 const item=speakerItems(state).find(p=>p.id===cmd.id);
 if(!item||!isSpeakerSku(item.sku))return 'Колонка не установлена дома';
 if(state.world.places[role]!=='home'||(state.activeShifts[role]&&!state.activeShifts[role]?.homeDevice))return 'Управление колонкой доступно дома';
 if(!['play','random','next','stop','volume','weather','time','alarm','cancelAlarm','joke','morning','night','vacuum'].includes(cmd.action))return 'Неизвестная команда';
 if(cmd.action==='next'&&!speakerDevice(state,item.id).track)return 'Сначала включи музыку';
 if(cmd.action==='play'&&!isMusicGenre(cmd.genre))return 'Выбери жанр';
 if(cmd.action==='volume'&&(!Number.isInteger(cmd.volume)||cmd.volume!<0||cmd.volume!>100))return 'Громкость от 0 до 100';
 if(cmd.action==='alarm'&&(!Number.isInteger(cmd.minute)||cmd.minute!<0||cmd.minute!>=1440))return 'Некорректное время';
 const now=gameMinutes(state.clock),d=structuredClone(speakerDevice(state,item.id));
 const say=(s:string)=>reply(d,now,s,role);
 switch(cmd.action){
  case 'play':d.track=choose(d,cmd.genre);d.shuffle=false;d.startedAt=now;say('Включаю '+trackInfo(d.track).title+'.');break;
  case 'random':d.track=choose(d,undefined,true);d.shuffle=true;d.startedAt=now;say('Включаю случайную музыку.');break;
  case 'next':d.track=choose(d,d.shuffle||!d.track?undefined:trackInfo(d.track).genre,d.shuffle);d.startedAt=now;break;
  case 'stop':delete d.track;say('Музыка остановлена.');break;
  case 'volume':d.volume=cmd.volume!;break;
  case 'weather':{const w=weatherAt(state.clock);say('Сейчас '+WEATHER_INFO[w.kind].name.toLowerCase()+', температура '+w.temp+' градусов.');break;}
  case 'time':say('Сейчас '+clockLabel(state.clock)+'.');break;
  case 'alarm':{const minute=cmd.minute!;d.alarmAt=now-state.clock.minute+minute+(minute<=state.clock.minute?1440:0);say('Будильник установлен на '+String(Math.floor(minute/60)).padStart(2,'0')+':'+String(minute%60).padStart(2,'0')+'.');break;}
  case 'cancelAlarm':delete d.alarmAt;say('Будильник отменён.');break;
  case 'joke':say(['Почему кот сидит на ноутбуке? Потому что там мышка.','Робот-пылесос попросил отпуск. Сказал, что устал от пыльной работы.','Программист пошёл за хлебом, но вернулся с обновлением.'][now%3]);break;
  case 'morning':say('Доброе утро! Пусть день будет уютным и удачным.');break;
  case 'night':say('Спокойной ночи! Сладких снов вам обоим.');break;
  case 'vacuum':{const err=controlVacuum(state,{type:'vacuum_control',action:'start'});if(err)say(err);else say('Хорошо, начинаю уборку дома.');break;}
 }
 (state.speakers??={})[item.id]=d;

}
export function advanceSpeakers(state:GameState){
 const now=gameMinutes(state.clock),items=speakerItems(state),all=state.speakers??={};
 for(const id of Object.keys(all))if(!items.some(i=>i.id===Number(id)))delete all[Number(id)];
 for(const item of items){
  const d=all[item.id];if(!d)continue;
  if(d.track&&now-d.startedAt>=TRACK_MINUTES){
   const steps=Math.floor((now-d.startedAt)/TRACK_MINUTES);
   if(d.shuffle)d.track=choose(d,undefined,true);else if(steps%2)d.track=choose(d,trackInfo(d.track).genre);
   d.startedAt+=steps*TRACK_MINUTES;
  }
  if(d.alarmAt!==undefined&&now>=d.alarmAt){delete d.alarmAt;reply(d,now,'Будильник! Пора вставать.', 'all');}
 }
}
