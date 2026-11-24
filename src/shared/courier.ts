import { HOUSE_ENTRY,HOME_YARD } from './home';
import { districtArrival,DISTRICT_WORLD_FLOOR,DISTRICT_WORLD_OBSTACLES,HOME_GATE_APPROACH } from './district';
import {planWalk,sampleWalk,type WalkRoute} from '../game/navigation';
import type {WorldState} from './locations';
export const COURIER_INDEX=7;
export const COURIER_NAME='Максим';
export const COURIER_WALK_MINUTES=4;
export const COURIER_TRIP_MINUTES=18;
export const COURIER_GATE={x:HOME_YARD.gate.x,z:HOME_YARD.gate.z-.25};
export const COURIER_PORCH={x:HOUSE_ENTRY.x,z:HOUSE_ENTRY.z+1.0};
export const COURIER_APPROACH={x:HOUSE_ENTRY.x+1.02,z:HOUSE_ENTRY.z+1.18};
export type CourierVisit={place:'home'|'district';x:number;z:number;yaw:number;walking:boolean;carrying:boolean;waiting:boolean};
let streetPath:WalkRoute|null|undefined;
function streetCourier(fraction:number,reverse:boolean):CourierVisit|null{
  if(streetPath===undefined)streetPath=planWalk(districtArrival('market','vlad'),HOME_GATE_APPROACH,DISTRICT_WORLD_OBSTACLES,DISTRICT_WORLD_FLOOR);
  if(!streetPath)return null;
  let length=0,previous=streetPath.from;
  for(const point of streetPath.path){length+=Math.hypot(point.x-previous.x,point.z-previous.z);previous=point;}
  const travelled=Math.max(0,Math.min(length,length*(reverse?1-fraction:fraction)));
  const sampled=sampleWalk(streetPath,travelled);
  const next=sampled.path[0]??sampled.from;
  const yaw=Math.hypot(next.x-sampled.from.x,next.z-sampled.from.z)>.001?Math.atan2(next.x-sampled.from.x,next.z-sampled.from.z)+(reverse?Math.PI:0):0;
  return {place:'district',...sampled.from,yaw,walking:true,carrying:!reverse,waiting:false};
}
export function courierVisit(world:WorldState,minute:number):CourierVisit|null{
  const due=world.deliveries.filter(order=>order.handedAt===undefined&&minute>=order.readyAt-COURIER_TRIP_MINUTES)
    .sort((a,b)=>a.readyAt-b.readyAt)[0];
  const departing=!due&&world.courierDepartAt!==undefined&&minute>=world.courierDepartAt&&minute<world.courierDepartAt+COURIER_TRIP_MINUTES;
  if(!due&&!departing)return null;
  const streetMinutes=COURIER_TRIP_MINUTES-COURIER_WALK_MINUTES;
  if(due&&minute<due.readyAt-COURIER_WALK_MINUTES)
    return streetCourier((minute-due.readyAt+COURIER_TRIP_MINUTES)/streetMinutes,false);
  if(departing&&minute>=world.courierDepartAt!+COURIER_WALK_MINUTES)
    return streetCourier((minute-world.courierDepartAt!-COURIER_WALK_MINUTES)/streetMinutes,true);
  const p=due?Math.max(0,Math.min(1,(minute-due.readyAt+COURIER_WALK_MINUTES)/COURIER_WALK_MINUTES)):
    1-Math.max(0,Math.min(1,(minute-world.courierDepartAt!)/COURIER_WALK_MINUTES));
  return {place:'home',x:COURIER_GATE.x+(COURIER_PORCH.x-COURIER_GATE.x)*p,
    z:COURIER_GATE.z+(COURIER_PORCH.z-COURIER_GATE.z)*p,yaw:departing?0:p===1?Math.PI/2:Math.PI,
    walking:departing||p<1,carrying:!!due,waiting:!!due&&p===1};
}
