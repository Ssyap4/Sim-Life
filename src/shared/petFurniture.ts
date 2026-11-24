import { STARTER_CAT_SCRATCHER } from './furniture';
import type { FurnishingState, PlacedFurniture } from './furniture';
import type { PetId } from './pets';

/** Stable, verified identity. Sale, storage or movement invalidates a current activity. */
export interface PetEquipmentRef {
  id:number; sku:string; x:number; z:number; rotation:number;
}
export const PET_BED_SKUS:Readonly<Record<PetId,string>>={
  verdell:'pet-bed-verdell',
  simba:'pet-bed-simba',
};
export const CAT_SCRATCHER_SKU='pet-scratcher-simba';

export function petBeds(furnishing:Pick<FurnishingState,'placed'>,id:PetId):PlacedFurniture[] {
  return furnishing.placed.filter(item=>item.sku===PET_BED_SKUS[id]);
}
export function petScratchers(furnishing:Pick<FurnishingState,'placed'>):PlacedFurniture[] {
  return furnishing.placed.filter(item=>item.sku===CAT_SCRATCHER_SKU||item.sku===STARTER_CAT_SCRATCHER||item.sku==='pet-house-tower');
}
export function petScratchPoint(item:{sku:string;x:number;z:number;rotation:number}):{x:number;z:number}{
  if(item.sku!=='pet-house-tower')return {x:item.x,z:item.z};
  const yaw=item.rotation*Math.PI/2;
  return {x:item.x+.48*Math.cos(yaw)+.06*Math.sin(yaw),z:item.z-.48*Math.sin(yaw)+.06*Math.cos(yaw)};
}
export function petEquipmentRef(item:PlacedFurniture):PetEquipmentRef {
  return {id:item.id,sku:item.sku,x:item.x,z:item.z,rotation:item.rotation};
}
export function currentPetEquipment(furnishing:Pick<FurnishingState,'placed'>,ref:PetEquipmentRef):PlacedFurniture|null {
  if(!ref||!Number.isSafeInteger(ref.id)||!Number.isFinite(ref.x)||
    !Number.isFinite(ref.z)||![0,1,2,3].includes(ref.rotation))return null;
  return furnishing.placed.find(item=>item.id===ref.id&&item.sku===ref.sku&&
    item.rotation===ref.rotation&&Math.hypot(item.x-ref.x,item.z-ref.z)<.025)??null;
}
