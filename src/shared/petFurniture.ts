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
export const isPetBed=(sku:string,id:PetId)=>sku===PET_BED_SKUS[id]||(id==='verdell'?sku.startsWith('pet-bed-dog-'):sku.startsWith('pet-bed-cat-'));
export const isPetTower=(sku:string)=>sku==='pet-house-tower'||sku==='pet-house-sky';
export const isPetScratcher=(sku:string)=>sku===CAT_SCRATCHER_SKU||sku===STARTER_CAT_SCRATCHER||sku==='pet-scratcher-starter'||sku==='pet-scratcher-palm'||sku==='pet-scratcher-duet'||isPetTower(sku);

export function petBeds(furnishing:Pick<FurnishingState,'placed'>,id:PetId):PlacedFurniture[] {
  return furnishing.placed.filter(item=>isPetBed(item.sku,id));
}
export function petScratchers(furnishing:Pick<FurnishingState,'placed'>):PlacedFurniture[] {
  return furnishing.placed.filter(item=>isPetScratcher(item.sku));
}
export function petScratchPoint(item:{sku:string;x:number;z:number;rotation:number}):{x:number;z:number}{
  if(item.sku==='pet-scratcher-duet'){const a=item.rotation*Math.PI/2;return {x:item.x+.18*Math.cos(a),z:item.z-.18*Math.sin(a)};}
  if(!isPetTower(item.sku))return {x:item.x,z:item.z};
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
