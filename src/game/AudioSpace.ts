import {HOUSE,HOUSE_WING,HOME_WALLS} from '../shared/home';
type Point={x:number;z:number};
type Rect={minX:number;maxX:number;minZ:number;maxZ:number};
export const insideHome=(p:Point)=>p.x>=HOUSE.minX&&p.x<=HOUSE_WING.maxX&&p.z>=HOUSE.minZ&&p.z<=HOUSE.maxZ;
const walls:readonly Rect[]=[...HOME_WALLS,{minX:HOUSE.minX-.09,maxX:HOUSE.minX+.09,minZ:HOUSE.minZ,maxZ:HOUSE.maxZ},{minX:HOUSE.minX,maxX:HOUSE.maxX,minZ:HOUSE.minZ-.09,maxZ:HOUSE.minZ+.09}];
function crosses(a:Point,b:Point,r:Rect){
 let lo=.015,hi=.985;for(const axis of ['x','z'] as const){const delta=b[axis]-a[axis],min=axis==='x'?r.minX:r.minZ,max=axis==='x'?r.maxX:r.maxZ;if(Math.abs(delta)<.00001){if(a[axis]<min||a[axis]>max)return false;continue;}const t1=(min-a[axis])/delta,t2=(max-a[axis])/delta;lo=Math.max(lo,Math.min(t1,t2));hi=Math.min(hi,Math.max(t1,t2));if(lo>hi)return false;}return hi>=lo;
}
export function audioWallCount(listener:Point,source:Point,place:string){
 if(place!=='home'||Math.hypot(listener.x-source.x,listener.z-source.z)<.25)return 0;
 return Math.min(3,walls.filter(r=>crosses(listener,source,r)).length);
}
export function audioSpatial(listener:Point,source:Point,place:string,right:Point={x:1,z:0},range=4){
 const dx=source.x-listener.x,dz=source.z-listener.z,d=Math.hypot(dx,dz),blocked=audioWallCount(listener,source,place);
 return {gain:1/(1+(d/Math.max(1,range))**2)*.52**blocked,cutoff:blocked?Math.max(650,3800*.49**(blocked-1)):15000,pan:Math.max(-.8,Math.min(.8,(dx*right.x+dz*right.z)/Math.max(4,d))),blocked};
}
export function conversationCueTimes(leads:boolean,time:number){
 const cycle=Math.floor(Math.max(0,time)/8);return [cycle*8+(leads?.42:3.72)];
}
