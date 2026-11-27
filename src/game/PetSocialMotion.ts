import {MathUtils} from 'three';
import type {PetId,PetAction} from '../shared/pets';
import type {PetIdleGesture} from './PetIdle';
import type {PetPerformance} from './PetPerformance';

/** Presentation only: never changes action cost, inventory or pet needs. */
export function petReactionSeconds(action:PetAction|null):number{
 return action==='play'?9:action==='treat'||action==='fishTreat'?6:action==='pet'||action==='brush'?5:2.75;
}
export function petReactionWeight(time:number,action:PetAction|null):number{
 if(!action||time<=0||time>=petReactionSeconds(action))return 0;
 return MathUtils.smoothstep(time,0,.42)*(1-MathUtils.smoothstep(time,petReactionSeconds(action)-.65,petReactionSeconds(action)));
}
export function petSocialGesture(id:PetId,kind:'beg'|'welcome',elapsed:number):PetIdleGesture{
 const slot=Math.max(0,Math.floor(elapsed/3.4))%3;
 return kind==='beg'
  ?id==='verdell'?(['beg','sitLook','beg'] as const)[slot]:(['pawWave','catInspect','pawWave'] as const)[slot]
  :id==='verdell'?(['happyHop','greet','sitLook'] as const)[slot]:(['nuzzle','slowBlink','catInspect'] as const)[slot];
}
/** Blend phased expression into the same local skeletal channels as idle poses. */
export function addPetReaction(p:PetPerformance,id:PetId,action:PetAction|null,t:number,w:number):void{
 if(w<=0||!action)return;
 const dog=id==='verdell';
 if(action==='pet'||action==='brush'){
  // Lean gently into contact. Do not move the root out of the owner's reach.
  const enjoy=w*(.65+.35*Math.sin(t*1.6)**2);
  p.headPitch-=.16*enjoy;p.headRoll+=(dog?.13:-.13)*enjoy;
  p.eye+=.38*enjoy;p.ear+=.09*enjoy;p.tail+=(dog?.27:.11)*Math.sin(t*6)*enjoy;
  p.roll+=(dog?.045:-.035)*enjoy;p.spine+=.04*enjoy;
  if(!dog&&action==='pet'){
   const k=MathUtils.smoothstep(t,1.3,2.1)*enjoy;
   for(const i of [0,2]){const beat=.5+.5*Math.sin(t*7+(i===2?Math.PI:0));p.pawY[i]+=.04*k*beat;p.pawZ[i]+=.035*k*beat;}
  }
 }else if(action==='treat'||action==='fishTreat'){
  // Look up expectantly, take the morsel, chew, then lick the lips.
  const expect=(1-MathUtils.smoothstep(t,.7,1.35))*w;
  const chew=MathUtils.smoothstep(t,1.0,1.6)*(1-MathUtils.smoothstep(t,3.8,4.55))*w;
  const lick=MathUtils.smoothstep(t,4.0,4.35)*(1-MathUtils.smoothstep(t,5.15,5.65))*w;
  p.headPitch-=.36*expect;p.headDrop-=.035*expect;
  p.jaw+=(dog?.035:.18)*chew*(.5+.5*Math.sin(t*13));
  p.headPitch+=.12*lick*Math.sin(t*9);p.jaw+=(dog?.018:.09)*lick;
  p.eye+=.24*chew;p.tail+=.20*expect*Math.sin(t*8);
 }else if(action==='play'){
  // Repeated short crouch/reach/recover phrases, not a constant bounce.
  const k=t%3.0;
  const ready=MathUtils.smoothstep(k,0,.45)*(1-MathUtils.smoothstep(k,.7,1.0))*w;
  const strike=MathUtils.smoothstep(k,.65,1.05)*(1-MathUtils.smoothstep(k,1.25,1.65))*w;
  const recover=MathUtils.smoothstep(k,1.65,2.0)*(1-MathUtils.smoothstep(k,2.5,2.95))*w;
  p.y-=.055*ready;p.pitch+=.11*ready;p.headPitch+=.24*ready;
  p.headYaw+=(dog?.15:.25)*Math.sin(t*5)*strike;
  p.headPitch-=.08*recover;p.tail+=.18*recover*Math.sin(t*9);
  const i=Math.floor(t/3)%2===0?0:2;
  p.pawY[i]+=.11*strike;p.pawZ[i]+=.13*strike;
  p.pawPitch[i]-=.60*strike;p.knee[i]+=.40*strike;
 }
}