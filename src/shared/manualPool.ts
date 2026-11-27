import type {CharacterId,GameState} from './protocol';
import {gameMinutes} from './life';
export const POOL_STEP=.025,POOL_RADIUS=.034,POOL_LIMIT=300;
export const POOL_POCKETS=[{x:-.5,y:-1},{x:.5,y:-1},{x:-.5,y:0},{x:.5,y:0},{x:-.5,y:1},{x:.5,y:1}];
export type PoolBall={id:number;x:number;y:number;vx:number;vy:number;out:boolean};
export type PoolMatch={id:number;tick:number;sequence:number;turn:CharacterId;balls:PoolBall[];score:Record<CharacterId,number>;moving:boolean;finished:boolean;shotTicks:number;potted:number;scratch:boolean;last:string};
export type PoolCommand={type:'pool_shot';id:number;sequence:number;angle:number;power:number};
export type PoolResult={at:number;vlad:number;alina:number};
const roles=['vlad','alina'] as const;
const other=(r:CharacterId):CharacterId=>r==='vlad'?'alina':'vlad';
const ball=(id:number,x:number,y:number):PoolBall=>({id,x,y,vx:0,vy:0,out:false});
export function newPool(id:number,first:CharacterId):PoolMatch{
 const balls=[ball(0,0,.65)];let n=1;
 for(const [row,count] of [1,2,3,2,1].entries())for(let j=0;j<count;j++)balls.push(ball(n++,(j-(count-1)/2)*.071,-.22-row*.063));
 return {id,tick:0,sequence:0,turn:first,balls,score:{vlad:0,alina:0},moving:false,finished:false,shotTicks:0,potted:0,scratch:false,last:'Разбей пирамиду'};
}
export function poolShot(m:PoolMatch,role:CharacterId,c:Record<string,unknown>){
 if(m.finished||m.moving||m.turn!==role||c.id!==m.id||c.sequence!==m.sequence||typeof c.angle!=='number'||typeof c.power!=='number'||!Number.isFinite(c.angle)||!Number.isFinite(c.power)||Math.abs(c.angle)>Math.PI||c.power<.08||c.power>1)return false;
 const cue=m.balls[0];if(cue.out)return false;
 const speed=.45+c.power*2.7;cue.vx=Math.sin(c.angle)*speed;cue.vy=-Math.cos(c.angle)*speed;
 m.sequence++;m.moving=true;m.shotTicks=0;m.potted=0;m.scratch=false;m.last='Шары в движении';return true;
}
function respot(m:PoolMatch){
 const cue=m.balls[0];for(const y of [.65,.45,.82,.22,0,-.8])for(const x of [0,-.22,.22,-.38,.38]){
 if(m.balls.slice(1).every(b=>b.out||Math.hypot(b.x-x,b.y-y)>POOL_RADIUS*2+.008)){Object.assign(cue,{x,y,vx:0,vy:0,out:false});return;}
 }
}
export function stepPool(m:PoolMatch){
 if(m.finished)return;m.tick++;
 if(!m.moving)return;m.shotTicks++;
 const live=m.balls.filter(b=>!b.out),r=POOL_RADIUS;
 for(let sub=0;sub<5;sub++){
  for(const b of live){if(b.out)continue;b.x+=b.vx*POOL_STEP/5;b.y+=b.vy*POOL_STEP/5;
   if(POOL_POCKETS.some(p=>Math.hypot(b.x-p.x,b.y-p.y)<.085)){b.out=true;b.vx=b.vy=0;if(b.id===0)m.scratch=true;else m.potted++;continue;}
   if(Math.abs(b.x)>.5-r){b.x=Math.sign(b.x)*(.5-r);b.vx=-Math.sign(b.x)*Math.abs(b.vx)*.84;}
   if(Math.abs(b.y)>1-r){b.y=Math.sign(b.y)*(1-r);b.vy=-Math.sign(b.y)*Math.abs(b.vy)*.84;}
  }
  for(let i=0;i<live.length;i++)for(let j=i+1;j<live.length;j++){const a=live[i],b=live[j];if(a.out||b.out)continue;const dx=b.x-a.x,dy=b.y-a.y,d=Math.hypot(dx,dy);if(d>=2*r)continue;
   const nx=d>1e-8?dx/d:1,ny=d>1e-8?dy/d:0,gap=(2*r-d)/2+.0001;a.x-=nx*gap;a.y-=ny*gap;b.x+=nx*gap;b.y+=ny*gap;
   const rel=(a.vx-b.vx)*nx+(a.vy-b.vy)*ny;if(rel>0){const impulse=.97*rel;a.vx-=impulse*nx;a.vy-=impulse*ny;b.vx+=impulse*nx;b.vy+=impulse*ny;}
  }
 }
 for(const b of live){b.vx*=.976;b.vy*=.976;if(Math.hypot(b.vx,b.vy)<.027)b.vx=b.vy=0;}
 if(m.balls.every(b=>b.out||(!b.vx&&!b.vy))||m.shotTicks>=360){
  for(const b of m.balls)b.vx=b.vy=0;
  // All potted object balls count for the shooter; a scratch forfeits the next shot.
  m.score[m.turn]+=m.potted;
  m.last=m.scratch?'Биток в лузе · переход хода':m.potted?'Забито: '+m.potted+' · ещё удар':'Промах · переход хода';
  if(m.scratch)respot(m);
  if(!m.potted||m.scratch)m.turn=other(m.turn);
  m.moving=false;
  if(m.score.vlad+m.score.alina===9){m.finished=true;m.last='Все шары забиты';}
 }
}
export function recordPool(s:GameState,m:PoolMatch){const h=s.poolHistory??=[];h.unshift({at:gameMinutes(s.clock),vlad:m.score.vlad,alina:m.score.alina});if(h.length>60)h.length=60;}
export function validPoolHistory(v:unknown):v is PoolResult[]{return Array.isArray(v)&&v.length<=60&&v.every(r=>!!r&&Number.isSafeInteger(r.at)&&r.at>=0&&roles.every(k=>Number.isSafeInteger(r[k])&&r[k]>=0&&r[k]<=9)&&r.vlad+r.alina===9);}
