import { FURNITURE_BY_ID, type FurnishingState, type FurnitureProduct } from './furniture';
import { HOME_PLACEMENTS } from './home';
import type { FloorPoint } from '../game/navigation';

/** Shared, save-safe contact: a FLOOR approach and a separate real cushion top.
 * Every future purchasable item with a supported shape uses the same rules.
 * No random boxes, desks, bowls, lamps or occupied tabletop surfaces. */
export interface CatPerch {
  key: string;
  approach: FloorPoint;
  surface: { x:number; y:number; z:number };
  yaw: number;
  kind: 'curl'|'watch';
}
type PerchFurniture = Pick<FurnitureProduct,'id'|'shape'|'width'|'depth'|'height'>;
const CAT_SEATS = new Set(['sofa','corner','armchair','ottoman','bench','bed','daybed']);

/** Opt-in through the product's actual shape, not a hard-coded SKU list.
 * New SKUs of these shapes automatically acquire safe resting positions. */
export function catPerchable(item:PerchFurniture):boolean {
  return CAT_SEATS.has(item.shape) &&
    item.width >= (item.shape==='armchair' ? .80 : item.shape==='ottoman' ? .78 : .95) &&
    item.depth >= (item.shape==='bench' ? .70 : item.shape==='ottoman' ? .78 : .72);
}
function seatHeight(item:PerchFurniture,starter:'sofa'|'bed'|null):number {
  if(starter==='sofa')return .84; // actual cushion in InteriorArt
  if(starter==='bed')return .90; // actual quilt in InteriorArt
  switch(item.shape){
    case 'bed':case 'daybed':return item.id==='bed-platform' ? .45 :
      item.id==='bed-storage' ? .61 : item.id==='bed-canopy' ? .61 : .59;
    case 'sofa':case 'corner':return item.id==='sofa-futon'?.49 : item.height*.59;
    case 'armchair':return item.height*.64;
    case 'ottoman':return item.height*.89;
    case 'bench':return item.height*.88;
    default:return item.height*.55;
  }
}
function rotate(x:number,z:number,rotation:number):FloorPoint {
  const a=rotation*Math.PI/2;
  return {x:x*Math.cos(a)+z*Math.sin(a),z:-x*Math.sin(a)+z*Math.cos(a)};
}
function make(key:string,item:PerchFurniture,x:number,z:number,rotation:number,
  starter:'sofa'|'bed'|null):CatPerch {
  // Purchased upholstery has its back at -Z. The actual built-in living
  // sofa from InteriorArt faces the other direction; the built-in bed
  // has its foot at +Z. A safe landing is always on the *front* cushion.
  const sign=starter==='sofa'?-1:1;
  // Rest deep INSIDE the cushion, not right on its front lip. Simba's
  // nose/tail would otherwise dangle beyond a compact sofa after landing.
  const localZ=item.shape==='bed'||item.shape==='daybed'
    ? sign*Math.min(.52,item.depth*.24)
    : item.shape==='sofa'||item.shape==='corner'||item.shape==='armchair'
      ? -sign*Math.min(.10,item.depth*.09) : 0;
  const foot=rotate(0,sign*(item.depth/2+.67),rotation);
  const seat=rotate(0,localZ,rotation);
  // Face the ROOM/front edge, never the backrest or wall.
  const heading=rotate(0,sign,rotation);
  return {
    key, approach:{x:x+foot.x,z:z+foot.z},
    surface:{x:x+seat.x,y:seatHeight(item,starter)+.085,z:z+seat.z},
    yaw:Math.atan2(heading.x,heading.z),
    kind:item.shape==='bed'||item.shape==='daybed'||item.shape==='sofa'||
      item.shape==='corner'||item.shape==='ottoman'?'curl':'watch',
  };
}
/** Stable ID survives reload; recomputed positions invalidate moved/sold items. */
export function catPerchCandidates(furnishing:Pick<FurnishingState,'placed'|'soldFixtures'>):CatPerch[] {
  const list:CatPerch[]=[];
  for(const fixture of ['sofa','bed'] as const){
    if(furnishing.soldFixtures?.includes(fixture))continue;
    const info=FURNITURE_BY_ID.get(fixture==='sofa'?'sofa-nord':'bed-aurora');
    if(!info)continue;
    const home=HOME_PLACEMENTS[fixture];
    list.push(make('starter:'+fixture,info,home.x,home.z,0,fixture));
  }
  for(const placed of furnishing.placed){
    const info=FURNITURE_BY_ID.get(placed.sku);
    if(!info||!catPerchable(info))continue;
    list.push(make('placed:'+placed.id,info,placed.x,placed.z,placed.rotation,null));
  }
  return list;
}
export function currentCatPerch(
  furnishing:Pick<FurnishingState,'placed'|'soldFixtures'>,saved:CatPerch,
):CatPerch|null {
  if(!saved||typeof saved.key!=='string'||!saved.approach||!saved.surface)return null;
  const live=catPerchCandidates(furnishing).find(p=>p.key===saved.key);
  return live && Math.hypot(live.approach.x-saved.approach.x,
    live.approach.z-saved.approach.z)<.025 &&
    Math.hypot(live.surface.x-saved.surface.x,
      live.surface.y-saved.surface.y,live.surface.z-saved.surface.z)<.025 &&
    Math.abs(live.yaw-saved.yaw)<.015 ?live:null;
}
