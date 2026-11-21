import { COUNTER, DINING_TOP, HOME_PLACEMENTS } from './home';
import { FURNITURE_BY_ID, type Rotation } from './furniture';
import type { GameState, CharacterId } from './protocol';
import type { Point } from './locations';
import { homeSeat, KITCHEN_WORK } from './home';
import { diningLocation } from './furnitureUse';

/** Used for plates and prepared food; supermarket groceries never use this. */
export type DiningSurface={
  kind:'starter'|'purchased'|'counter';
  x:number;z:number;height:number;width:number;depth:number;rotation:Rotation;
  furnitureId?:number;
};
export function diningSurface(state:Pick<GameState,'furnishing'>):DiningSurface{
  if(!state.furnishing.soldFixtures?.includes('table'))
    return {kind:'starter',...HOME_PLACEMENTS.table,height:DINING_TOP,width:1.72,depth:.93,rotation:0};
  const found=state.furnishing.placed
    .filter(item=>{const itemInfo=FURNITURE_BY_ID.get(item.sku);
      return itemInfo?.shape==='table'&&itemInfo.height>=.63;})
    .sort((a,b)=>a.id-b.id)[0];
  if(found){
    const itemInfo=FURNITURE_BY_ID.get(found.sku)!;
    return {kind:'purchased',x:found.x,z:found.z,
      height:itemInfo.height,width:itemInfo.width,depth:itemInfo.depth,
      rotation:found.rotation,furnitureId:found.id};
  }
  // Dishes and any meal prepared before furniture sale can still be cleaned
  // and collected at the fixed kitchen counter, never hover over an old table.
  return {kind:'counter',x:COUNTER.x+1.28,z:COUNTER.z+.12,
    height:1.09,width:.65,depth:.36,rotation:0};
}
export function tabletopPoint(top:DiningSurface,x:number,z:number){
  const yaw=top.rotation*Math.PI/2;
  return {x:top.x+x*Math.cos(yaw)+z*Math.sin(yaw),
    z:top.z-x*Math.sin(yaw)+z*Math.cos(yaw)};
}
/** Dirty dish pickup always follows the visible tabletop or kitchen sink. */
export function dishPickupPoint(state:GameState,role:CharacterId):Point{
  const surface=diningSurface(state);
  if(surface.kind==='starter')return homeSeat('table',role).approach;
  if(surface.kind==='counter')return KITCHEN_WORK.dishes.position;
  const target=diningLocation(state,role,surface.furnitureId);
  return target?.route.path.at(-1)??target?.route.from??KITCHEN_WORK.dishes.position;
}
