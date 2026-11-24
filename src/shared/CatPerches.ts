import { FURNITURE_BY_ID, type FurnishingState, type FurnitureProduct } from './furniture';
import { HOME_PLACEMENTS } from './home';
import type { FloorPoint } from '../game/navigation';
import type { CatRestPoseId } from './CatRestPoses';

/** Shared, save-safe contact: a FLOOR approach and a separate real cushion top.
 * Every future purchasable item with a supported shape uses the same rules.
 * No random boxes, desks, bowls, lamps or occupied tabletop surfaces. */
export interface CatPerch {
  key: string;
  approach: FloorPoint;
  surface: { x:number; y:number; z:number };
  yaw: number;
  kind: 'curl'|'watch';
  entry?:'inside'|'jump';
  /** Furniture-owned socket: support, heading and eligible authored poses.
   * Optional only so pre-existing preview routines can still be read. */
  catAnchor?: {x:number;y:number;z:number;yaw:number;poses:CatRestPoseId[]};
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
  const surface={x:x+seat.x,y:seatHeight(item,starter)+.085,z:z+seat.z};
  const yaw=Math.atan2(heading.x,heading.z);
  const poses:CatRestPoseId[]=item.shape==='bed'||item.shape==='daybed'
    ? ['bed_curl']
    : item.shape==='sofa'||item.shape==='corner'
      ? ['sofa_loaf','sofa_side_rest']
      : ['chair_compact'];
  return {
    key, approach:{x:x+foot.x,z:z+foot.z},
    surface,yaw,
    kind:item.shape==='bed'||item.shape==='daybed'||item.shape==='sofa'||
      item.shape==='corner'||item.shape==='ottoman'?'curl':'watch',
    catAnchor:{...surface,yaw,poses},
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
    if(!info)continue;
    if(info.id.startsWith('pet-house-')){
      const tower=info.id==='pet-house-tower',soft=info.id==='pet-house-soft';
      const center=tower?-.37:0;
      const heading=rotate(0,1,placed.rotation),yaw=Math.atan2(heading.x,heading.z);
      const floor=rotate(center,info.depth/2+.62,placed.rotation);
      const cushion=rotate(center,-.015,placed.rotation);
      for(const entry of ['inside','jump'] as const){
        const surface={x:placed.x+cushion.x,z:placed.z+cushion.z,
          y:entry==='inside'?.15+.085:tower?1.34+.085:info.height-(soft?.14:.065)+.052+.085};
        const poses:CatRestPoseId[]=entry==='inside'?
          [tower?'house_tower':soft?'house_soft':'house_cabin']:
          [tower?'sofa_loaf':soft?'sofa_side_rest':'chair_compact'];
        list.push({key:'placed:'+placed.id+':'+entry,
          approach:{x:placed.x+floor.x,z:placed.z+floor.z},surface,yaw,kind:'curl',entry,
          catAnchor:{...surface,yaw,poses}});
      }
      continue;
    }
    if(!catPerchable(info))continue;
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
