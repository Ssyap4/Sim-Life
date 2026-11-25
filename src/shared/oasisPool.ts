import type {CharacterId} from './protocol';
export const OASIS_POOL='oasis-pool';
export const POOL_SIZE={width:6.5,depth:4.7,height:1.55,waterWidth:6,waterDepth:3.5,waterY:.80,waterZ:-.30} as const;
export const floatX=(role:CharacterId)=>role==='vlad'?-1.14:1.14;
export const FLOAT_Z=-.30;
export const POOL_ENTRY_SECONDS=6.0;
export const POOL_MOUNT_SECONDS=1.5;
export function poolEntryFrame(t:number,role:CharacterId){
  const side=role==='vlad'?-1:1;
  const z=1.93+side*.20;
  const x=2.36+side*.25;
  const points=[{t:0,x:1.75+side*.35,y:0,z:2.73},{t:1.4,x:-.96,y:0,z:2.73},{t:2,x:-.96,y:0,z},{t:2.4,x:-.60,y:.235,z},{t:2.8,x:-.20,y:.435,z},{t:3.2,x:.20,y:.635,z},{t:3.6,x:.70,y:.8325,z},{t:4.7,x,y:.8325,z},{t:5.1,x,y:.95,z:1.50},{t:5.5,x,y:.71,z:1.21},{t:6,x,y:.46,z:.94}];
  const i=points.findIndex(p=>p.t>=t);if(i<=0)return i===0?points[0]:points[points.length-1];
  const a=points[i-1],b=points[i],u=Math.max(0,Math.min(1,(t-a.t)/(b.t-a.t)));
  return {x:a.x+(b.x-a.x)*u,y:a.y+(b.y-a.y)*u,z:a.z+(b.z-a.z)*u};
}
export const FLOAT_TOP=.95;
export const floatBob=(t:number,role:CharacterId)=>.025*Math.sin(t*1.35+(role==='vlad'?0:1.2));
// Relaxed curves inside the open water, not marked swimming lanes.
export function poolSwimFrame(t:number,role:CharacterId){
 const side=role==='vlad'?-1:1,phase=t*.32+(side>0?Math.PI:0);
 const cx=side*1.48+.38*Math.sin(phase),cz=-.30+.38*Math.cos(phase);
 const yaw=Math.atan2(-Math.cos(phase),Math.sin(phase));
 return {x:cx+.76*Math.sin(yaw),z:cz+.76*Math.cos(yaw),y:.76,yaw};
}
