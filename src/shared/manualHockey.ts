import type {CharacterId,GameState} from './protocol';
import {gameMinutes} from './life';
export const HOCKEY_STEP=.025,HOCKEY_GOALS=7,HOCKEY_LIMIT=90;
export const HOCKEY_PAD=.082,HOCKEY_PUCK=.045,HOCKEY_PAD_SPEED=2.7,HOCKEY_PUCK_SPEED=3.1,HOCKEY_GOAL_HALF=.17;
export type HockeyPoint={x:number;y:number};
export type HockeyMatch={id:number;tick:number;score:Record<CharacterId,number>;pads:Record<CharacterId,HockeyPoint>;puck:HockeyPoint;velocity:HockeyPoint;serve:number;finished:boolean;lastGoal?:CharacterId;lastHit?:CharacterId;hitTick?:number;idleTicks:number};
export type HockeyCommand={type:'hockey_move';id:number;x:number;y:number;sequence:number};
export type HockeyResult={at:number;vlad:number;alina:number};
export type HockeyControls=Record<CharacterId,{target:HockeyPoint;sequence:number}>;
const roles=['vlad','alina'] as const;
const clamp=(v:number,a:number,b:number)=>Math.max(a,Math.min(b,v));
export const hockeyTarget=(role:CharacterId,p:HockeyPoint):HockeyPoint=>({x:clamp(p.x,-.4,.4),y:role==='vlad'?clamp(p.y,.12,.89):clamp(p.y,-.89,-.12)});
export function approachHockeyPad(p:HockeyPoint,target:HockeyPoint,seconds:number):HockeyPoint{
 const dx=target.x-p.x,dy=target.y-p.y,d=Math.hypot(dx,dy),f=d?Math.min(1,HOCKEY_PAD_SPEED*Math.max(0,seconds)/d):0;
 return {x:p.x+dx*f,y:p.y+dy*f};
}
export const hockeyControls=():HockeyControls=>({vlad:{target:{x:0,y:.73},sequence:-1},alina:{target:{x:0,y:-.73},sequence:-1}});
export const newHockey=(id:number):HockeyMatch=>({id,tick:0,score:{vlad:0,alina:0},pads:{vlad:{x:0,y:.73},alina:{x:0,y:-.73}},puck:{x:0,y:0},velocity:{x:id%2?.13:-.13,y:id%2?.7:-.7},serve:40,finished:false,idleTicks:0});
export function hockeyMove(m:HockeyMatch,controls:HockeyControls,role:CharacterId,c:Record<string,unknown>){
 if(m.finished||c.id!==m.id||typeof c.sequence!=='number'||!Number.isSafeInteger(c.sequence)||c.sequence<=controls[role].sequence||typeof c.x!=='number'||typeof c.y!=='number'||!Number.isFinite(c.x)||!Number.isFinite(c.y)||Math.abs(c.x)>.5||Math.abs(c.y)>1||(role==='vlad'?c.y<0:c.y>0))return false;
 controls[role]={sequence:c.sequence,target:hockeyTarget(role,{x:c.x,y:c.y})};return true;
}
function cap(v:HockeyPoint){const s=Math.hypot(v.x,v.y);if(s>HOCKEY_PUCK_SPEED){v.x*=HOCKEY_PUCK_SPEED/s;v.y*=HOCKEY_PUCK_SPEED/s;}}
export function stepHockey(m:HockeyMatch,controls:HockeyControls){
 if(m.finished)return;m.tick++;
 const dt=HOCKEY_STEP/6,r=HOCKEY_PAD+HOCKEY_PUCK;
 const serving=m.serve>0;if(serving)m.serve--;
 for(let i=0;i<6;i++){
  const velocities={} as Record<CharacterId,HockeyPoint>;
  for(const role of roles){const p=m.pads[role],n=approachHockeyPad(p,controls[role].target,dt);velocities[role]={x:(n.x-p.x)/dt,y:(n.y-p.y)/dt};m.pads[role]=n;}
  if(serving)continue;
  const p=m.puck,v=m.velocity;p.x+=v.x*dt;p.y+=v.y*dt;
  for(const role of roles){const pad=m.pads[role],dx=p.x-pad.x,dy=p.y-pad.y,d=Math.hypot(dx,dy);if(d>=r)continue;
   const nx=d>1e-8?dx/d:0,ny=d>1e-8?dy/d:role==='vlad'?-1:1,pv=velocities[role],relative=(v.x-pv.x)*nx+(v.y-pv.y)*ny;
   p.x=pad.x+nx*(r+.0001);p.y=pad.y+ny*(r+.0001);
   if(relative<0){v.x-=1.88*relative*nx;v.y-=1.88*relative*ny;if(relative<-.12){m.lastHit=role;m.hitTick=m.tick;}}
   cap(v);
  }
  if(Math.abs(p.x)>.5-HOCKEY_PUCK){p.x=clamp(p.x,-.455,.455);v.x=-Math.sign(p.x)*Math.abs(v.x)*.97;}
  if(Math.abs(p.y)>1-HOCKEY_PUCK){
   if(Math.abs(p.x)<=HOCKEY_GOAL_HALF-HOCKEY_PUCK&&v.y*Math.sign(p.y)>0){
    const scorer=p.y>0?'alina':'vlad';m.score[scorer]++;m.lastGoal=scorer;m.puck={x:0,y:0};
    // Serve toward the player who conceded, with a small deterministic diagonal.
    m.velocity={x:m.tick%2?.17:-.17,y:scorer==='vlad'?-.75:.75};m.serve=40;m.idleTicks=0;break;
   }
   p.y=clamp(p.y,-.955,.955);v.y=-Math.sign(p.y)*Math.abs(v.y)*.96;
  }
 }
 if(!serving&&!m.serve){
  m.velocity.x*=.997;m.velocity.y*=.997;
  if(Math.hypot(m.velocity.x,m.velocity.y)<.13)m.idleTicks++;else m.idleTicks=0;
  // Neutral restart instead of silently awarding a goal or accelerating toward a net.
  if(m.idleTicks>=80){m.puck={x:0,y:0};m.velocity={x:m.tick%2?.18:-.18,y:m.tick%4<2?.65:-.65};m.serve=28;m.idleTicks=0;}
 }
 if(m.score.vlad>=HOCKEY_GOALS||m.score.alina>=HOCKEY_GOALS||m.tick>=HOCKEY_LIMIT/HOCKEY_STEP)m.finished=true;
}
export function recordHockey(s:GameState,m:HockeyMatch){const h=s.hockeyHistory??=[];h.unshift({at:gameMinutes(s.clock),vlad:m.score.vlad,alina:m.score.alina});if(h.length>60)h.length=60;}
export function validHockeyHistory(v:unknown):v is HockeyResult[]{return Array.isArray(v)&&v.length<=60&&v.every(r=>!!r&&Number.isSafeInteger(r.at)&&r.at>=0&&roles.every(k=>Number.isSafeInteger(r[k])&&r[k]>=0&&r[k]<=HOCKEY_GOALS));}
