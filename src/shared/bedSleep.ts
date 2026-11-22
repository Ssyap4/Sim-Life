import { FURNITURE_BY_ID, type PlacedFurniture } from './furniture';
import { HOME_PLACEMENTS } from './home';
import { placeObstacles } from './locations';
import { findRoute, nearestClearPoint, pointIsClear } from '../game/navigation';
import { HOME_WORLD_FLOOR } from './district';
import type { CharacterId, GameState } from './protocol';

export type SleepBedId = 'starter' | number;
export type BedPose = { x:number; y:number; z:number; yaw:number };
export type BedDestination = {
  id:SleepBedId;
  approach:{x:number;z:number};
  pose:BedPose;
  capacity:1|2;
};

export function isSleepBed(item:Pick<PlacedFurniture,'sku'>):boolean {
  const shape=FURNITURE_BY_ID.get(item.sku)?.shape;
  return shape==='bed'||shape==='daybed';
}

export function bedCapacity(item:Pick<PlacedFurniture,'sku'>):1|2 {
  const info=FURNITURE_BY_ID.get(item.sku);
  return info?.shape==='bed'&&info.width>=1.55?2:1;
}

function rotated(item:PlacedFurniture,localX:number,localZ:number){
  const yaw=item.rotation*Math.PI/2;
  return {
    x:item.x+localX*Math.cos(yaw)+localZ*Math.sin(yaw),
    z:item.z-localX*Math.sin(yaw)+localZ*Math.cos(yaw),
  };
}

/** Same mattress anchors are used for snapshot recovery and live animations. */
export function bedPose(state:GameState,role:CharacterId,id:SleepBedId):BedPose|null {
  if(id==='starter'){
    if(state.furnishing.soldFixtures?.includes('bed'))return null;
    return {
      x:HOME_PLACEMENTS.bed.x+(role==='vlad' ? -.55:.55),
      y:1.055,z:HOME_PLACEMENTS.bed.z+1.01,yaw:0,
    };
  }
  const item=state.furnishing.placed.find(entry=>entry.id===id);
  if(!item||!isSleepBed(item))return null;
  const info=FURNITURE_BY_ID.get(item.sku)!;
  const day=info.shape==='daybed';
  const capacity=bedCapacity(item);
  // The root is near the foot; the existing rig reclines toward the head.
  const x=day?info.width*.39:capacity===2?(role==='vlad'?-1:1)*info.width*.215:0;
  const z=day?0:info.depth*.39;
  const center=rotated(item,x,z);
  const mattress=item.sku==='bed-canopy'?.48:item.sku==='bed-platform'?.30:
    day?.40:.42;
  return {...center,y:mattress+.09+.047/2+.11,yaw:item.rotation*Math.PI/2+(day?Math.PI/2:0)};
}

/** Returns a walkable approach for a specific installed model and orientation. */
function approachForBed(state:GameState,role:CharacterId,item:PlacedFurniture):
  {x:number;z:number}|null{
  const info=FURNITURE_BY_ID.get(item.sku)!;
  const day=info.shape==='daybed';
  const lane=bedCapacity(item)===2?(role==='vlad'?-1:1)*info.width*.215:0;
  const front=day?info.width/2+.60:info.depth/2+.62;
  const candidates=day?[
    [front,0], [front,.28], [front,-.28],
    [0,info.depth/2+.60],[0,-info.depth/2-.60],
    [-front,0],
  ]:[
    [lane,front],[0,front],
    [info.width/2+.60,0],[-info.width/2-.60,0],
    [lane,-front],
  ];
  const blocked=placeObstacles('home',state.furnishing);
  const actor=state.characters[role];
  const start=nearestClearPoint(actor,blocked,HOME_WORLD_FLOOR);
  if(!start)return null;
  let result:{x:number;z:number}|null=null;
  let cost=Infinity;
  for(const [x,z] of candidates){
    const point=rotated(item,x,z);
    if(!pointIsClear(point,blocked,HOME_WORLD_FLOOR))continue;
    const route=findRoute(start,point,blocked,HOME_WORLD_FLOOR);
    if(!route)continue;
    let distance=0;
    let previous=start;
    for(const step of route){distance+=Math.hypot(step.x-previous.x,step.z-previous.z);previous=step;}
    if(distance<cost){cost=distance;result=point;}
  }
  return result;
}

export function selectSleepBed(state:GameState,role:CharacterId,requestedId?:number):
  {ok:true; bed:BedDestination}|{ok:false;reason:string}{
  if(requestedId!==undefined&&(!Number.isSafeInteger(requestedId)||requestedId<1))
    return {ok:false,reason:'Неправильная кровать'};
  const available:SleepBedId[]=requestedId!==undefined?[requestedId]:
    [
      ...(state.furnishing.soldFixtures?.includes('bed')?[]:['starter' as const]),
      ...state.furnishing.placed.filter(isSleepBed).map(item=>item.id),
    ];
  if(available.length===0)return {ok:false,reason:'В доме нет установленной кровати. Купи и поставь новую.'};
  const other=role==='vlad'?'alina':'vlad';
  let occupied=false;
  let inaccessible=false;
  for(const id of available){
    const item=id==='starter'?null:state.furnishing.placed.find(entry=>entry.id===id);
    if(id!=='starter'&&(!item||!isSleepBed(item)))continue;
    const capacity=item?bedCapacity(item):2;
    if(state.characters[other].pose==='sleep' &&
      (state.characters[other].sleepingOn??'starter')===id&&capacity===1){
      occupied=true;continue;
    }
    const pose=bedPose(state,role,id);
    if(!pose)continue;
    const approach=id==='starter'?{
      x:HOME_PLACEMENTS.bed.x,z:HOME_PLACEMENTS.bed.z+1.95,
    }:approachForBed(state,role,item!);
    if(!approach){inaccessible=true;continue;}
    return {ok:true,bed:{id,approach,pose,capacity}};
  }
  return {ok:false,reason:occupied
    ?'Эта односпальная кровать уже занята. Выбери другую кровать.'
    :inaccessible?'К кровати нет безопасного прохода. Переставь её.'
    :'Выбранная кровать не установлена в доме'};
}
