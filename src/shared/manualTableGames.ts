import type {CharacterId,GameState} from './protocol';
import {gameMinutes} from './life';
export const TABLE_STEP=50,TABLE_LIMIT=300000,DART_ROUNDS=5;
const roles=['vlad','alina'] as const,other=(r:CharacterId):CharacterId=>r==='vlad'?'alina':'vlad';
const clamp=(v:number,a:number,b:number)=>Math.max(a,Math.min(b,v));
export type TableResult={at:number;vlad:number;alina:number};
type Base={id:number;tick:number;sequence:number;turn:CharacterId;score:Record<CharacterId,number>;finished:boolean;last:string;readyAt:number};
export type DartsMatch=Base&{game:'darts';item:string;throws:Record<CharacterId,number[]>;hits:{role:CharacterId;x:number;y:number;points:number}[]};
export type JengaMatch=Base&{game:'jenga';rows:number[];strain:number;lastBlock?:{row:number;slot:number};collapsed?:CharacterId};
export type TableMatch=DartsMatch|JengaMatch;
export type TableCommand={type:'table_throw';id:number;sequence:number;x:number;y:number}|{type:'table_pull';id:number;sequence:number;row:number;slot:number;force:number};
const base=(id:number,turn:CharacterId):Base=>({id,tick:0,sequence:0,turn,score:{vlad:0,alina:0},finished:false,last:'Начинаем!',readyAt:0});
export const newDarts=(id:number,turn:CharacterId,item:string):DartsMatch=>({...base(id,turn),game:'darts',item,throws:{vlad:[],alina:[]},hits:[]});
export const newJenga=(id:number,turn:CharacterId):JengaMatch=>({...base(id,turn),game:'jenga',rows:Array(12).fill(7),strain:0});
export const DART_SECTORS=[20,1,18,4,13,6,10,15,2,17,3,19,7,16,8,11,14,9,12,5];
export function dartPoints(x:number,y:number){const r=Math.hypot(x,y);if(r>1)return 0;if(r<=.037)return 50;if(r<=.093)return 25;
 const a=(Math.atan2(x,-y)+Math.PI*2)%(Math.PI*2),sector=DART_SECTORS[Math.floor((a+Math.PI/20)/(Math.PI/10))%20];
 return sector*(r>=.91?2:r>=.53&&r<=.62?3:1);
}
export function dartWobble(tick:number,sequence:number){return {x:.15*Math.sin(tick*.29+sequence*.81),y:.15*Math.sin(tick*.21+sequence*1.3+.7)};}
export function jengaMeter(tick:number,sequence:number){return .5+.5*Math.sin(tick*.22+sequence*.9);}
const bits=(mask:number)=>Number(!!(mask&1))+Number(!!(mask&2))+Number(!!(mask&4));
export function jengaRisk(m:JengaMatch,row:number,slot:number){
 if(!Number.isInteger(row)||!Number.isInteger(slot)||row<0||row>=m.rows.length-1||slot<0||slot>2||!(m.rows[row]&(1<<slot))||bits(m.rows[row])<=1)return undefined;
 // Only remove below the highest complete layer (and never the layer being built).
 const top=m.rows[m.rows.length-1]===7?m.rows.length-1:m.rows.length-2;if(row>=top)return undefined;
 const remaining=m.rows[row]&~(1<<slot),above=m.rows.length-row-1;
 const eccentric=remaining===1||remaining===4?.27:remaining===2?.13:remaining===5?.01:.08;
 return clamp(.08+above*.013+eccentric+m.strain*.28+(bits(remaining)===1?.12:0),.09,.92);
}
export function tableAction(m:TableMatch,role:CharacterId,c:Record<string,unknown>){
 if(m.finished||m.turn!==role||m.tick<m.readyAt||c.id!==m.id||c.sequence!==m.sequence)return false;
 if(m.game==='darts'){
  if(c.type!=='table_throw'||typeof c.x!=='number'||typeof c.y!=='number'||!Number.isFinite(c.x)||!Number.isFinite(c.y)||Math.abs(c.x)>1||Math.abs(c.y)>1)return false;
  const w=dartWobble(m.tick,m.sequence),x=c.x+w.x,y=c.y+w.y,points=dartPoints(x,y);m.throws[role].push(points);m.score[role]+=points;m.hits.push({role,x,y,points});m.last='Бросок: '+points+' очк.';m.sequence++;m.readyAt=m.tick+10;
  if(m.throws.vlad.length===DART_ROUNDS*3&&m.throws.alina.length===DART_ROUNDS*3){m.finished=true;return true;}
  if(m.throws[role].length%3===0)m.turn=other(role);return true;
 }
 if(c.type!=='table_pull'||typeof c.row!=='number'||typeof c.slot!=='number'||typeof c.force!=='number'||!Number.isFinite(c.force)||c.force<0||c.force>1)return false;
 const risk=jengaRisk(m,c.row,c.slot);if(risk===undefined)return false;
 const timing=jengaMeter(m.tick,m.sequence),ideal=.37+risk*.22,error=Math.abs(c.force-ideal)*1.25+Math.abs(timing-.5)*.8;
 m.lastBlock={row:c.row,slot:c.slot};m.sequence++;m.readyAt=m.tick+14;
 const stress=risk*.65+error*.8+m.strain*.23;
 if(stress>.93){m.collapsed=role;m.finished=true;m.score[other(role)]=1;m.last='Башня упала!';return true;}
 m.rows[c.row]&=~(1<<c.slot);
 if(m.rows[m.rows.length-1]===7)m.rows.push(1);else{const last=m.rows.length-1;m.rows[last]|=m.rows[last]===1?2:4;}
 m.strain=clamp(m.strain*.87+risk*.095+error*.12,.02,1);m.last='Брусок на вершине';m.turn=other(role);
 if(m.sequence>=30||!m.rows.some((mask,row)=>bits(mask)>1&&row<m.rows.length-2)){m.finished=true;m.score={vlad:1,alina:1};m.last='Башня устояла · ничья';}
 return true;
}
export function recordTable(s:GameState,m:TableMatch){const h=m.game==='darts'?(s.dartsHistory??=[]):(s.jengaHistory??=[]);h.unshift({at:gameMinutes(s.clock),vlad:m.score.vlad,alina:m.score.alina});if(h.length>60)h.length=60;}
export function validTableHistory(v:unknown,game:'darts'|'jenga'):v is TableResult[]{return Array.isArray(v)&&v.length<=60&&v.every(r=>!!r&&Number.isSafeInteger(r.at)&&r.at>=0&&roles.every(k=>Number.isSafeInteger(r[k])&&r[k]>=0&&r[k]<=(game==='darts'?900:1))&&(game==='darts'||r.vlad+r.alina>=1));}
