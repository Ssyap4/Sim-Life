import type {CharacterId,GameState} from './protocol';
import type {PlaceId} from './locations';

export interface CarRide { from:PlaceId; to:PlaceId; startedAt:number; endsAt:number }
export function rideDuration(from:PlaceId,to:PlaceId):number {
  const away=to==='home'?from:to;
  return away==='lake'||away==='resort'?10000:['fitness','clinic','spa','venue','barber','work-clinic','industrial'].includes(away)?8000:6000;
}
export function recordCarRide(before:GameState,after:GameState,roles:CharacterId[],now=Date.now()):void{
  const rides={...after.world.carRides};
  for(const role of roles){
    const from=before.world.places[role],to=after.world.places[role];
    if(from!==to)rides[role]={from,to,startedAt:now,endsAt:now+rideDuration(from,to)};
  }
  after.world.carRides=rides;
}
export function isCarReturn(before:GameState,after:GameState,role:CharacterId):boolean{
  return after.world.places[role]==='home'&&before.world.places[role]!=='home'&&
    (before.world.carDriver===role||['fitness','clinic','spa','venue','lake','resort'].includes(before.world.places[role]));
}
export function activeCarRide(state:GameState,role:CharacterId,now=Date.now()):CarRide|undefined{
  const ride=state.world.carRides?.[role];
  if(!ride||ride.to!==state.world.places[role]||!Number.isFinite(ride.startedAt)||!Number.isFinite(ride.endsAt)||
    ride.endsAt-ride.startedAt!==rideDuration(ride.from,ride.to)||now<ride.startedAt-1000||now>=ride.endsAt)return;
  return ride;
}
export const rideProgress=(ride:CarRide,now=Date.now())=>Math.max(0,Math.min(1,(now-ride.startedAt)/(ride.endsAt-ride.startedAt)));
