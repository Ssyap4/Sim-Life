import { CAMP_RECIPES, isCampRecipe } from './park';
import { RECIPES, TAKEOUT } from './food';
import { gameMinutes } from './life';
import type { CharacterId, GameState } from './protocol';
import type { ReadyFoodKind } from './readyFood';

export const PICNIC_BASKET_PRICE = 900;
export const PICNIC_CAPACITY = 4;
export interface PackedPortion { kind: ReadyFoodKind|'campfire'; item: string; expiresAt: number }
export interface PicnicBasket { portions: Record<CharacterId, PackedPortion[]> }
export function validPicnicBasket(value: unknown): value is PicnicBasket {
  if (!value || typeof value !== 'object') return false;
  const p=(value as PicnicBasket).portions;
  return !!p && ['vlad','alina'].every(role=>Array.isArray(p[role as CharacterId]) &&
    p[role as CharacterId].every(b=>!!b && typeof b.item==='string' &&
      (b.kind==='meal'&&Object.hasOwn(RECIPES,b.item)||b.kind==='takeout'&&Object.hasOwn(TAKEOUT,b.item)||b.kind==='campfire'&&isCampRecipe(b.item)) &&
      Number.isSafeInteger(b.expiresAt)&&b.expiresAt>=0)) &&
    p.vlad.length+p.alina.length<=PICNIC_CAPACITY;
}
export function picnicPortions(state:Pick<GameState,'world'|'clock'>,role:CharacterId):PackedPortion[]{
  return (state.world.picnic?.portions[role]??[]).filter(p=>p.expiresAt>gameMinutes(state.clock));
}
export const picnicName=(p:PackedPortion)=>p.kind==='campfire'&&isCampRecipe(p.item)?CAMP_RECIPES[p.item].name:p.kind==='meal'?RECIPES[p.item as keyof typeof RECIPES].name:TAKEOUT[p.item as keyof typeof TAKEOUT].name;
export function cleanPicnic(state:Pick<GameState,'world'|'clock'>):void{
  if(!state.world.picnic)return;
  for(const role of ['vlad','alina'] as const)state.world.picnic.portions[role]=picnicPortions(state,role);
}
