import type {CharacterId} from './protocol';
export const OASIS_POOL='oasis-pool';
export const POOL_SIZE={width:6.5,depth:4.7,height:1.55,waterWidth:6,waterDepth:3.5,waterY:.80,waterZ:-.30} as const;
export const floatX=(role:CharacterId)=>role==='vlad'?-1.14:1.14;
export const FLOAT_Z=-.30;
export const FLOAT_TOP=.95;
export const floatBob=(t:number,role:CharacterId)=>.025*Math.sin(t*1.35+(role==='vlad'?0:1.2));
// Relaxed curves inside the open water, not marked swimming lanes.
export function poolSwimFrame(t:number,role:CharacterId){
 const side=role==='vlad'?-1:1,phase=t*.32+(side>0?Math.PI:0);
 const cx=side*1.48+.38*Math.sin(phase),cz=-.30+.38*Math.cos(phase);
 const yaw=Math.atan2(-Math.cos(phase),Math.sin(phase));
 return {x:cx+.76*Math.sin(yaw),z:cz+.76*Math.cos(yaw),y:.76,yaw};
}
