import {FURNITURE_BY_ID} from './furniture';
/** Grade reflects support and cushioning, not price. 1–5; zero means not seating/sleep furniture. */
const premium=new Set(['sofa-arc','sofa-chester','sofa-modular','chair-cloud','chair-wing','bed-canopy','bed-storage','bed-platform']);
const basic=new Set(['sofa-micro','bench-mori','bed-solo','daybed-iron','chair-dining','stool-basic','pouf-joy']);
const good=new Set(['sofa-nord','bed-aurora','bed-rattan','chair-nest','chair-padded','sofa-futon']);
export function furnitureComfort(sku:string):number{
  const info=FURNITURE_BY_ID.get(sku);
  if(!info||!['sofa','corner','armchair','ottoman','bench','chair','stool','bed','daybed'].includes(info.shape))return 0;
  return premium.has(sku)?5:good.has(sku)?4:basic.has(sku)?2:3;
}
export function sleepRecoveryMultiplier(sku:string):number{
  return .8+furnitureComfort(sku)*.075;
}
export function seatingComfortBonus(sku:string):number{
  const grade=furnitureComfort(sku);return grade? (grade-3)*3:0;
}
