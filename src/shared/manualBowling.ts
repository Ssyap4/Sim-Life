import type {CharacterId,GameState} from './protocol';
import {gameMinutes} from './life';
export const BOWLING_FRAMES=5;
export type BowlingFrame=number[];
export type BowlingMatch={id:number;turn:CharacterId;frames:Record<CharacterId,BowlingFrame[]>;pins:number;sequence:number;finished:boolean;last?:{role:CharacterId;aim:number;power:number;hit:number}};
export type BowlingResult={at:number;vlad:number;alina:number};
export type BowlingCommand={type:'bowling_roll';id:number;sequence:number;aim:number;power:number};
const other=(r:CharacterId):CharacterId=>r==='vlad'?'alina':'vlad';
export const newBowling=(id:number,first:CharacterId):BowlingMatch=>({id,turn:first,frames:{vlad:[[]],alina:[[]]},pins:10,sequence:0,finished:false});
const final=(frames:BowlingFrame[])=>frames.length===BOWLING_FRAMES;
function frameComplete(f:BowlingFrame,last:boolean){if(!last)return f[0]===10||f.length===2;return f.length>=3||f.length===2&&f[0]+f[1]<10;}
export function bowlingScore(frames:BowlingFrame[]):number{
 let total=0;for(let i=0;i<frames.length;i++){const f=frames[i];if(i===BOWLING_FRAMES-1){total+=f.reduce((a,b)=>a+b,0);continue;}
 const future=frames.slice(i+1).flat();if(f[0]===10){if(future.length>=2)total+=10+future[0]+future[1];}
 else if(f.length===2){if(f[0]+f[1]===10){if(future.length)total+=10+future[0];}else total+=f[0]+f[1];}}
 return total;
}
export function shotPins(pins:number,aim:number,power:number,sequence:number){
 // A reproducible arcade approximation: pocket alternates slightly, both direction and strength matter.
 const pocket=sequence%2===0?.12:-.12;
 const accuracy=Math.max(0,1-Math.abs(aim-pocket)*1.45),strength=Math.max(0,1-Math.abs(power-.78)*2.1);
 return Math.max(0,Math.min(pins,Math.round(pins*accuracy*strength)));
}
export function rollBowling(source:BowlingMatch,role:CharacterId,c:Record<string,unknown>):BowlingMatch|null{
 if(source.finished||source.turn!==role||c.id!==source.id||c.sequence!==source.sequence||typeof c.aim!=='number'||typeof c.power!=='number'||!Number.isFinite(c.aim)||!Number.isFinite(c.power)||Math.abs(c.aim)>1||c.power<0||c.power>1)return null;
 const s=structuredClone(source),f=s.frames[role].at(-1)!,last=final(s.frames[role]),hit=shotPins(s.pins,c.aim,c.power,s.sequence);
 f.push(hit);s.sequence++;s.last={role,aim:c.aim,power:c.power,hit};s.pins-=hit;
 if(!frameComplete(f,last)){if(last&&s.pins===0)s.pins=10;return s;}
 const partner=other(role),opp=s.frames[partner],opponentDone=final(opp)&&frameComplete(opp.at(-1)!,true);
 if(!last)s.frames[role].push([]);
 if(last&&opponentDone){s.finished=true;return s;}
 s.turn=partner;s.pins=10;return s;
}
export const bowlingResults=(s:GameState)=>s.bowlingHistory??[];
export function recordBowling(s:GameState,match:BowlingMatch){const history=s.bowlingHistory??=[];history.unshift({at:gameMinutes(s.clock),vlad:bowlingScore(match.frames.vlad),alina:bowlingScore(match.frames.alina)});if(history.length>60)history.length=60;}
export function validBowlingHistory(v:unknown):v is BowlingResult[]{return Array.isArray(v)&&v.length<=60&&v.every(r=>!!r&&Number.isSafeInteger(r.at)&&r.at>=0&&['vlad','alina'].every(k=>Number.isSafeInteger(r[k])&&r[k]>=0&&r[k]<=150));}
