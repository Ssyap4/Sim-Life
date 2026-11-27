import type {CharacterId,GameState} from './protocol';
import {gameMinutes} from './life';
export const HOCKEY_STEP=0.025,HOCKEY_GOALS=7,HOCKEY_LIMIT=90;
type Point={x:number;y:number};
export type HockeyMatch={id:number;tick:number;score:Record<CharacterId,number>;pads:Record<CharacterId,Point>;puck:Point;velocity:Point;serve:number;finished:boolean};
export type HockeyCommand={type:'hockey_move';id:number;x:number;y:number;sequence:number};
export type HockeyResult={at:number;vlad:number;alina:number};
export type HockeyControls=Record<CharacterId,{target:Point;sequence:number}>;
const roles=['vlad','alina'] as const;
const clamp=(v:number,a:number,b:number)=>Math.max(a,Math.min(b,v));
export const hockeyControls=():HockeyControls=>({vlad:{target:{x:0,y:.73},sequence:-1},alina:{target:{x:0,y:-.73},sequence:-1}});
export const newHockey=(id:number):HockeyMatch=>({id,tick:0,score:{vlad:0,alina:0},pads:{vlad:{x:0,y:.73},alina:{x:0,y:-.73}},puck:{x:0,y:0},velocity:{x:0,y:.65},serve:28,finished:false});
export function hockeyMove(m:HockeyMatch,controls:HockeyControls,role:CharacterId,c:Record<string,unknown>){
 if(m.finished||c.id!==m.id||typeof c.sequence!=='number'||!Number.isSafeInteger(c.sequence)||c.sequence<=controls[role].sequence||typeof c.x!=='number'||typeof c.y!=='number'||!Number.isFinite(c.x)||!Number.isFinite(c.y)||Math.abs(c.x)>.5||Math.abs(c.y)>1||(role==='vlad'?c.y<0:c.y>0))return false;
 controls[role]={sequence:c.sequence,target:{x:clamp(c.x,-.4,.4),y:role==='vlad'?clamp(c.y,.12,.89):clamp(c.y,-.89,-.12)}};return true;
}
export function stepHockey(m:HockeyMatch,controls:HockeyControls){
 if(m.finished)return;
 m.tick++;
 const velocities={} as Record<CharacterId,Point>;
 for(const role of roles){const p=m.pads[role],t=controls[role].target,dx=t.x-p.x,dy=t.y-p.y,d=Math.hypot(dx,dy),factor=d?Math.min(1,2.7*HOCKEY_STEP/d):0;velocities[role]={x:dx*factor/HOCKEY_STEP,y:dy*factor/HOCKEY_STEP};p.x+=dx*factor;p.y+=dy*factor;}
 if(m.serve>0)m.serve--;
 else {
  const p=m.puck,v=m.velocity;
  // Four microsteps avoid tunnelling at maximum puck speed.
  for(let i=0;i<4;i++){
   p.x+=v.x*HOCKEY_STEP/4;p.y+=v.y*HOCKEY_STEP/4;
   if(Math.abs(p.x)>.455){p.x=clamp(p.x,-.455,.455);v.x=-Math.sign(p.x)*Math.abs(v.x);}
   if(Math.abs(p.y)>.955){
    if(Math.abs(p.x)<.17){const scorer=p.y>0?'alina':'vlad';m.score[scorer]++;m.puck={x:0,y:0};m.velocity={x:0,y:scorer==='vlad'?.75:-.75};m.serve=28;break;}
    p.y=clamp(p.y,-.955,.955);v.y=-Math.sign(p.y)*Math.abs(v.y);
   }
   for(const role of roles){const pad=m.pads[role],dx=p.x-pad.x,dy=p.y-pad.y,d=Math.hypot(dx,dy);if(d>=.127)continue;
    const nx=d>1e-6?dx/d:0,ny=d>1e-6?dy/d:role==='vlad'?-1:1, pv=velocities[role],relative=(v.x-pv.x)*nx+(v.y-pv.y)*ny;
    p.x=pad.x+nx*.128;p.y=pad.y+ny*.128;
    if(relative<0){v.x-=1.85*relative*nx;v.y-=1.85*relative*ny;}
    const speed=Math.hypot(v.x,v.y);if(speed>3.1){v.x*=3.1/speed;v.y*=3.1/speed;}
   }
  }
  m.velocity.x*=.997;m.velocity.y*=.997;
  if(Math.hypot(m.velocity.x,m.velocity.y)<.12){m.velocity.y=m.puck.y>=0?.22:-.22;}
 }
 if(m.score.vlad>=HOCKEY_GOALS||m.score.alina>=HOCKEY_GOALS||m.tick>=HOCKEY_LIMIT/HOCKEY_STEP)m.finished=true;
}
export function recordHockey(s:GameState,m:HockeyMatch){const h=s.hockeyHistory??=[];h.unshift({at:gameMinutes(s.clock),vlad:m.score.vlad,alina:m.score.alina});if(h.length>60)h.length=60;}
export function validHockeyHistory(v:unknown):v is HockeyResult[]{return Array.isArray(v)&&v.length<=60&&v.every(r=>!!r&&Number.isSafeInteger(r.at)&&r.at>=0&&roles.every(k=>Number.isSafeInteger(r[k])&&r[k]>=0&&r[k]<=HOCKEY_GOALS));}
