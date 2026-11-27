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