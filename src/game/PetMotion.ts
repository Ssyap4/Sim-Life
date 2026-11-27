import {MathUtils} from 'three';
export function petStepPace(traveled:number,dt:number,speed:number,cap:number):number{
  if(!(traveled>.0001)||!(dt>0)||!(speed>0))return 0;
  return cap*Math.sqrt(MathUtils.clamp(traveled/(dt*speed),0,1));
}
export function petPaceBlend(previous:number,target:number,dt:number):number{
  return MathUtils.damp(previous,target,target<previous?16:11,Math.max(0,dt));
}
const shortAngle=(a:number,b:number,t:number)=>a+Math.atan2(Math.sin(b-a),Math.cos(b-a))*t;
/** Preserve the authored landing yaw, including on the very first frame of descent. */
export function perchBodyYaw(phase:number,forward:number,restYaw:number,descending:boolean):number{
  const runUp=forward+(descending?0:Math.PI);
  const approach=shortAngle(0,runUp,MathUtils.smootherstep(phase,0,.25));
  return shortAngle(approach,forward+restYaw,MathUtils.smootherstep(phase,.78,1));
}

/** Only animation changes: the authoritative speed and arrival stay intact.
 * Stationary turns step in place; forward motion banks into a corner. */
export function petTurnMotion(previous:number,from:number,to:number,dt:number):number{
 const angle=Math.atan2(Math.sin(to-from),Math.cos(to-from));
 const target=dt>0?MathUtils.clamp(angle/(dt*5),-1,1):0;
 return MathUtils.damp(previous,target,10,Math.max(0,dt));
}
/** Short REM-like bursts separated by long stretches of stillness. */
export function petDreamMotion(seconds:number,weight:number,offset=0):number{
 const t=((seconds+offset)%13+13)%13;
 if(t>=2.7||weight<=0)return 0;
 return MathUtils.smoothstep(t,0,.65)*(1-MathUtils.smoothstep(t,1.9,2.7))*
  Math.sin(t*16)*MathUtils.clamp(weight,0,1);
}
/** One distance-driven planted step. During stance the foot moves backward
 * exactly as far as the body advances, not at a sinusoidal ground speed.
 * The airborne return uses a cubic ease and zero lift at both endpoints. */
export function samplePetStride(distance:number,cycle:number,duty:number,offset:number,height:number,out:{z:number;y:number;swing:number}){
 const phase=MathUtils.euclideanModulo(distance/cycle+offset,1);
 const span=cycle*duty;
 if(phase<duty){
  out.z=span*.5-phase*cycle;out.y=0;out.swing=0;
 }else{
  const k=(phase-duty)/(1-duty);
  out.z=span*(MathUtils.smoothstep(k,0,1)-.5);
  out.y=height*Math.sin(Math.PI*k)**2;out.swing=k;
 }
 return out;
}
/** Two-bone leg IK in the sagittal plane, using the dog's real hinge lengths. */
export function dogLegAngles(y:number,z:number,length:number,front:boolean,out:{hip:number;knee:number}){
 const upper=length*.52,lower=length-upper;
 const r=MathUtils.clamp(Math.hypot(y,z),Math.abs(upper-lower)+.001,length-.001);
 const bend=Math.acos(MathUtils.clamp((r*r-upper*upper-lower*lower)/(2*upper*lower),-1,1))*(front?1:-1);
 out.hip=Math.atan2(-z,-y)-Math.atan2(lower*Math.sin(bend),upper+lower*Math.cos(bend));
 out.knee=bend;
 return out;
}