import { HOUSE_ENTRY,HOME_YARD } from './home';
import type {WorldState} from './locations';
export const COURIER_INDEX=7; // Максим — existing neighbor, never an extra NPC.
export const COURIER_NAME='Максим';
export const COURIER_WALK_MINUTES=4;
export const COURIER_GATE={x:HOME_YARD.gate.x,z:HOME_YARD.gate.z-.25};
export const COURIER_PORCH={x:HOUSE_ENTRY.x,z:HOUSE_ENTRY.z+1.0};
export type CourierVisit={x:number;z:number;yaw:number;walking:boolean;carrying:boolean;waiting:boolean};
export function courierVisit(world:WorldState,minute:number):CourierVisit|null{
  const due=world.deliveries.filter(order=>order.handedAt===undefined&&minute>=order.readyAt-COURIER_WALK_MINUTES)
    .sort((a,b)=>a.readyAt-b.readyAt)[0];
  const departing=!due&&world.courierDepartAt!==undefined&&minute>=world.courierDepartAt&&minute<world.courierDepartAt+COURIER_WALK_MINUTES;
  if(!due&&!departing)return null;
  const p=due?Math.max(0,Math.min(1,(minute-due.readyAt+COURIER_WALK_MINUTES)/COURIER_WALK_MINUTES)):
    1-Math.max(0,Math.min(1,(minute-world.courierDepartAt!)/COURIER_WALK_MINUTES));
  return {x:COURIER_GATE.x+(COURIER_PORCH.x-COURIER_GATE.x)*p,
    z:COURIER_GATE.z+(COURIER_PORCH.z-COURIER_GATE.z)*p,yaw:departing?0:Math.PI,
    walking:departing||p<1,carrying:!!due,waiting:!!due&&p===1};
}
