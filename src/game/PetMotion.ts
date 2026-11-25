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
