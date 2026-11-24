import { currentCatPerch, type CatPerch } from './CatPerches';
import { gameMinutes } from './life';
import { homeSeat } from './home';
import type { GameState, CharacterId } from './protocol';
import type { HomePresentation } from './homeLife';

export const CAT_BLOCKED = 'Симба устроился на мебели и мешает занять место.';
export const CAT_DESCENDING = 'Симба уже спускается. Подожди, пока место освободится.';
export function catOccupiedPerch(state:GameState):CatPerch|null {
  const pet=state.pets.simba;
  const candidate=pet.routine?.kind==='perch'?pet.routine.perch:undefined;
  return candidate?currentCatPerch(state.furnishing,candidate):null;
}
export function catBlockingPerch(state:GameState):CatPerch|null {
  const active=catOccupiedPerch(state);
  if(active)return active;
  const yielded=state.pets.simba.furnitureYield;
  const now=gameMinutes(state.clock);
  return yielded&&now<yielded.clearAt?currentCatPerch(state.furnishing,yielded.perch):null;
}
export function catSeatOverlap(perch:CatPerch,key:string,pose?:{x:number;z:number}):boolean {
  return perch.key===key&&(!pose||Math.hypot(pose.x-perch.surface.x,pose.z-perch.surface.z)<.88);
}
export function catSeatError(state:GameState,key:string,pose?:{x:number;z:number}):string|undefined {
  const perch=catBlockingPerch(state);
  return perch&&catSeatOverlap(perch,key,pose)?catOccupiedPerch(state)?CAT_BLOCKED:CAT_DESCENDING:undefined;
}
export function catBedOverlap(perch:CatPerch,key:string,pose:{x:number;z:number;yaw:number}):boolean {
  // Reclining body extends toward the head; compare lateral sleeping lanes.
  return perch.key===key&&Math.abs((pose.x-perch.surface.x)*Math.cos(pose.yaw)-
    (pose.z-perch.surface.z)*Math.sin(pose.yaw))<.82;
}
export function catBedError(state:GameState,key:string,pose:{x:number;z:number;yaw:number}):string|undefined {
  const perch=catBlockingPerch(state);
  return perch&&catBedOverlap(perch,key,pose)?catOccupiedPerch(state)?CAT_BLOCKED:CAT_DESCENDING:undefined;
}
export function catHomeSeatOverlap(perch:CatPerch,role:CharacterId,home:HomePresentation):boolean {
  if(home.furnitureId!==undefined&&home.furnitureSeat)
    return catSeatOverlap(perch,'placed:'+home.furnitureId,home.furniturePose);
  return home.station==='sofa'&&catSeatOverlap(perch,'starter:sofa',homeSeat('sofa',role).position);
}
export function catHomeSeatError(state:GameState,role:CharacterId,home:HomePresentation):string|undefined {
  const perch=catBlockingPerch(state);
  return perch&&catHomeSeatOverlap(perch,role,home)?catOccupiedPerch(state)?CAT_BLOCKED:CAT_DESCENDING:undefined;
}
