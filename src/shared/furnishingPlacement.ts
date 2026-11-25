import {isSurfaceDevice} from './consoleCatalog';
import {speakerMountAt,snapSpeaker} from './speakerPlacement';
import {isVacuumSku} from './vacuumCatalog';
import {feederModel,feedingAnchor,feedingStation,feedingOwnerPoint} from './petFeeders';
import { leisureAction } from './leisure';
import { furnitureUseLocation } from './furnitureUse';
import { FURNITURE_BY_ID, furnitureFootprint,
  type PlacedFurniture } from './furniture';
import { HOME_FLOOR, HOME_YARD, HOUSE, HOUSE_WING, HOME_DOORS, HOUSE_ENTRY,
  HOME_WALLS, HOME_FURNITURE, HOME_DECOR, HOME_STRUCTURE_OBSTACLES, KITCHEN_WORK, homeSeat } from './home';
import { STATIONS, placeObstacles, spawn } from './locations';
import { points, type GameState } from './protocol';
import { PETS, PET_IDS } from './pets';
import { findRoute, pointIsClear, segmentIsClear,
  type FloorPoint, type FloorRect } from '../game/navigation';
import { petNavigationGeometry } from '../game/PetNavigation';

export type PlacementCheck = {valid:true;reason:'Можно поставить'} |
  {valid:false;reason:string};
const yes:PlacementCheck={valid:true,reason:'Можно поставить'};
const deny=(reason:string):PlacementCheck=>({valid:false,reason});
const intersects=(a:FloorRect,b:FloorRect)=>
  a.minX<b.maxX&&a.maxX>b.minX&&a.minZ<b.maxZ&&a.maxZ>b.minZ;
const center:FloorPoint={x:0,z:1.4};
const walkObstacles=(state:GameState,placed:readonly PlacedFurniture[])=>placeObstacles('home',{...state.furnishing,placed:[...placed]});
// Separate actual physical geometry from navigation's actor-expanded walls.
const fixedPhysical=(state:GameState):FloorRect[]=>[
  ...HOME_WALLS,
  ...HOME_DECOR.filter((_,index)=>
    !((index===0&&state.furnishing.soldFixtures?.includes('nightstandLeft'))||
      (index===1&&state.furnishing.soldFixtures?.includes('nightstandRight')))),
  ...Object.entries(HOME_FURNITURE)
    .filter(([id])=>!state.furnishing.soldFixtures?.includes(id as import('./furniture').StaticFurnitureId))
    .map(([,bounds])=>bounds),
];
const reservedDoors:readonly FloorRect[]=[
  ...Object.values(HOME_DOORS).map(({x,z,width})=>({
    minX:x-.48,maxX:x+.48,minZ:z-width*.42,maxZ:z+width*.42,
  })),
  {minX:HOUSE_ENTRY.x-HOUSE_ENTRY.width*.41,maxX:HOUSE_ENTRY.x+HOUSE_ENTRY.width*.41,
    minZ:HOUSE_ENTRY.z-.63,maxZ:HOUSE_ENTRY.z+.63},
  {minX:HOUSE_WING.minX-.52,maxX:HOUSE_WING.minX+.52,
    minZ:HOUSE_WING.connector.z-.58,maxZ:HOUSE_WING.connector.z+.58},
  ...HOUSE_WING.crossWalls.map(z=>({
    minX:HOUSE_WING.crossDoor.x-HOUSE_WING.crossDoor.width*.40,
    maxX:HOUSE_WING.crossDoor.x+HOUSE_WING.crossDoor.width*.40,
    minZ:z-.54,maxZ:z+.54,
  })),
];
const requiredTargets:FloorPoint[]=[
  center,spawn('home','vlad'),spawn('home','alina'),
  ...Object.values(points),KITCHEN_WORK.tea.position,KITCHEN_WORK.coffee.position,
  ...STATIONS.home.map(station=>station.approach),
  ...(['vlad','alina'] as const).flatMap(role=>
    ['sofa','table','officeChair','yardTable'].map(id=>
      homeSeat(id as 'sofa'|'table'|'officeChair'|'yardTable',role).approach)),
  ...PET_IDS.flatMap(id=>[PETS[id].home,PETS[id].bowl,PETS[id].toilet]),
  // Stable room access targets only; random pet roaming destinations are
  // deliberately NOT permanent no-build zones.
  {x:12.5,z:-5.25},{x:12.5,z:-2.0},{x:12.5,z:2.4},
  {x:10.4,z:-2.24},{x:13.0,z:-3.6},{x:13.0,z:.88},
];
type ReachRoute={point:FloorPoint;route:FloorPoint[]};
const routeCache=new Map<string,readonly ReachRoute[]>();
function preservedRoutes(others:readonly PlacedFurniture[],state:GameState){
  const key=JSON.stringify([state.furnishing.soldFixtures??[],others]);
  const cached=routeCache.get(key);
  if(cached)return cached;
  const baseline=walkObstacles(state,[]);
  const obstacles=walkObstacles(state,others);
  const found:ReachRoute[]=[];
  for(const p of requiredTargets){
    if(!pointIsClear(p,baseline,HOME_FLOOR))continue;
    const route=findRoute(center,p,obstacles,HOME_FLOOR);
    if(route)found.push({point:p,route});
  }
  if(routeCache.size>5)routeCache.clear();
  routeCache.set(key,found);
  return found;
}
function crossesExistingRoute(from:FloorPoint,route:readonly FloorPoint[],candidate:FloorRect){
  let previous=from;
  for(const point of route){
    if(!segmentIsClear(previous,point,[candidate],HOME_FLOOR))return true;
    previous=point;
  }
  return false;
}
function insideWalls(box:FloorRect):boolean {
  // Only 2cm to the physical interior boundary; clearance belongs in
  // navigation, not the placement collision box.
  const inset=.022;
  return [HOUSE,HOUSE_WING].some(room=>box.minX>=room.minX+inset-1e-7&&
    box.maxX<=room.maxX-inset+1e-7&&box.minZ>=room.minZ+inset-1e-7&&
    box.maxZ<=room.maxZ-inset+1e-7);
}
function petCanApproach(from:FloorPoint,dest:FloorPoint,
  geometry:ReturnType<typeof petNavigationGeometry>):boolean {
  const offsets=[[0,.74],[-.74,0],[.74,0],[0,-.74]] as const;
  return offsets.some(([dx,dz])=>{
    const p={x:dest.x+dx,z:dest.z+dz};
    return pointIsClear(p,geometry.obstacles,geometry.floor)&&
      findRoute(from,p,geometry.obstacles,geometry.floor)!==null;
  });
}
/** Shared across client red/green preview and server's final authoritative
 * placement decision. No monetary or save effects. */
export function checkFurniturePlacement(state:GameState,candidate:PlacedFurniture,
    others:readonly PlacedFurniture[]=state.furnishing.placed.filter(it=>it.id!==candidate.id)):PlacementCheck{
  const product=FURNITURE_BY_ID.get(candidate.sku);
  if(!product)return deny('Предмет не найден в каталоге');
  if(!Number.isFinite(candidate.x)||!Number.isFinite(candidate.z)||
      ![0,1,2,3].includes(candidate.rotation))return deny('Некорректные координаты');
  if(isSurfaceDevice(candidate.sku)){const mount=speakerMountAt({...state.furnishing,placed:[...others]},candidate);return mount?yes:deny('Выбери свободную поверхность мебели');}
  if(others.some(p=>isSurfaceDevice(p.sku)&&!speakerMountAt({...state.furnishing,placed:[...others,candidate]},p)))return deny('Новое расположение мешает установленной технике');
  // A couple of centimetres of buffer avoid z-fighting without reserving
  // entire empty strips beside each wall.
  const physical=furnitureFootprint(candidate,.018);
  const outdoor=product.category==='leisure'&&physical.minZ>=HOUSE.maxZ+.55&&physical.maxZ<=HOME_FLOOR.maxZ-.25&&physical.minX>=HOME_FLOOR.minX+.25&&physical.maxX<=HOME_FLOOR.maxX-.25;
  if(candidate.sku==='oasis-terrace'||candidate.sku==='oasis-pool'){
    if(!outdoor)return deny('Этот предмет можно поставить только во дворе');
    const parking={minX:HOME_YARD.parking.x-1.42,maxX:HOME_YARD.parking.x+1.42,minZ:HOME_YARD.parking.z-2.99,maxZ:HOME_YARD.parking.z+2.99};
    const passage={minX:2,maxX:12.8,minZ:7.47,maxZ:9.03};
    const gateWalk={minX:HOUSE_ENTRY.x-.98,maxX:HOUSE_ENTRY.x+.98,minZ:HOUSE_ENTRY.z,maxZ:HOME_YARD.gate.z};
    if(intersects(physical,parking)||intersects(physical,passage)||intersects(physical,gateWalk))return deny('Оставь свободными парковку и дорожку');
  }
  if(outdoor&&HOME_STRUCTURE_OBSTACLES.some(o=>intersects(physical,o)))return deny('Нельзя перекрывать забор, клумбу или проход');
  if(!insideWalls(physical)&&!outdoor)return deny('Предмет выходит за стену или границу комнаты');
  if(reservedDoors.some(door=>intersects(physical,door)))
    return deny('Нельзя перекрывать дверь или проход между комнатами');
  if(fixedPhysical(state).some(obstacle=>intersects(physical,obstacle)))
    return deny('Здесь стена, встроенная мебель или сантехника');
  if(!product.walkable && others.some(other=>{
      if(isSurfaceDevice(other.sku))return false;
      const otherInfo=FURNITURE_BY_ID.get(other.sku);
      return (!otherInfo?.walkable||otherInfo?.category==='pets') &&
        intersects(physical,furnitureFootprint(other,.018));
    }))
    return deny('Место занято другой мебелью');
  // Ordinary rugs may be overlapped, but a PET BED must never be installed
  // underneath a sofa, cabinet, scratcher, or another pet bed.
  if(product.category==='pets'&&product.walkable&&others.some(other=>{
    if(isSurfaceDevice(other.sku))return false;
      const otherInfo=FURNITURE_BY_ID.get(other.sku);
    return (otherInfo?.category==='pets'||!otherInfo?.walkable)&&
      intersects(physical,furnitureFootprint(other,.018));
  }))return deny('Лежанке нужно свободное место на полу');
  // Rugs and low pet cushions do not create invisible navigation walls.
  if(product.walkable)return yes;
  // Residents and pets are transient: their current positions/actions never decide build validity.
  const changed=[...others,candidate];
  const obstacles=walkObstacles(state,changed);
  const dynamicBlocking=furnitureFootprint(candidate,.30);
  for(const device of changed.filter(i=>isVacuumSku(i.sku))){
    const angle=device.rotation*Math.PI/2, dock={x:device.x+Math.sin(angle)*.18,z:device.z+Math.cos(angle)*.18};
    const inside={minX:HOUSE.minX+.18,maxX:HOUSE_WING.maxX-.18,minZ:HOUSE.minZ+.18,maxZ:HOUSE.maxZ-.18};
    const robotObstacles=walkObstacles(state,changed.filter(i=>i.id!==device.id));
    if(!pointIsClear(dock,robotObstacles,inside)||!findRoute(dock,center,robotObstacles,inside))return deny('Оставь свободный выезд со станции пылесоса');
  }
  const newPetGeometry=()=>petNavigationGeometry(obstacles,HOME_FLOOR);
  for(const device of changed.filter(i=>feederModel(i.sku))){const model=feederModel(device.sku)!,anchor=feedingAnchor(device),g=newPetGeometry();if(!pointIsClear(anchor.goal,g.obstacles,g.floor)||!findRoute(PETS[model.pet].home,anchor.goal,g.obstacles,g.floor)||!pointIsClear(anchor.goal,obstacles,HOME_FLOOR))return deny('Оставь свободный подход к миске или кормушке');}
  for(const id of PET_IDS){const station=feedingStation({...state.furnishing,placed:changed},id);if(station.item&&!feedingOwnerPoint(station,center,obstacles,HOME_FLOOR))return deny('Оставь сбоку место для хозяина');}
  // Verify leisure from a stable reference point, not transient actor locations.
  // Standing sports need open play positions; seats need reachable access.
  const leisureItems=changed.filter(i=>leisureAction(i.sku));
  if(leisureItems.length){
    const preview={...state,furnishing:{...state.furnishing,placed:changed},characters:{
      vlad:{...state.characters.vlad,...center},alina:{...state.characters.alina,...center}}};
    for(const item of leisureItems){
      const action=leisureAction(item.sku)!;
      if(!(['vlad','alina'] as const).every(role=>!!furnitureUseLocation(preview,role,item.id,action)))
        return deny('Оставь свободное место для подхода и игры');
    }
  }
  // An existing route remains valid if the new object is nowhere along it.
  // A* is only needed for a route that actually crosses the new footprint.
  // This keeps the live preview responsive even with many targets.
  const replacementPet=feederModel(candidate.sku)?.pet;
  for(const {point,route} of preservedRoutes(others,state)){
    if(replacementPet&&point===PETS[replacementPet].bowl)continue;
    if(!crossesExistingRoute(center,route,dynamicBlocking))continue;
    if(!pointIsClear(point,obstacles,HOME_FLOOR)||
      findRoute(center,point,obstacles,HOME_FLOOR)===null)
      return deny('Так будет перекрыт путь к двери или важному действию');
  }
  // Pets are mostly on the old side of the house. Do not run a full pet
  // pathfinding simulation for furniture located far from all their paths.
  const oldPet=petNavigationGeometry(
    walkObstacles(state,others),HOME_FLOOR);
  const impacted: Array<{from:FloorPoint;dest:FloorPoint}>=[];
  for(const id of PET_IDS){
    const from=PETS[id].home;
    for(const dest of [PETS[id].bowl,PETS[id].home,PETS[id].toilet]){
      if(dest===PETS[id].bowl&&replacementPet===id)continue;
      const offsets=[[0,.74],[-.74,0],[.74,0],[0,-.74]] as const;
      for(const [dx,dz] of offsets){
        const target={x:dest.x+dx,z:dest.z+dz};
        if(!pointIsClear(target,oldPet.obstacles,oldPet.floor))continue;
        const baseRoute=findRoute(from,target,oldPet.obstacles,oldPet.floor);
        if(!baseRoute)continue;
        if(crossesExistingRoute(from,baseRoute,furnitureFootprint(candidate,.46)))
          impacted.push({from,dest});
        break;
      }
    }
  }
  if(impacted.length){
    const newPet=petNavigationGeometry(obstacles,HOME_FLOOR);
    for(const {from,dest} of impacted)
      if(!petCanApproach(from,dest,newPet))
        return deny('Мебель перекрывает путь питомца к миске или лежанке');
  }
  return yes;
}

/** A gentle wall/corner magnet within 22cm of the selected position, never
 * snapping through room walls. The final shared check still decides safety. */
export function suggestFurnitureSnap(item:PlacedFurniture,state?:GameState):PlacedFurniture {
  if(isSurfaceDevice(item.sku))return state?snapSpeaker(state.furnishing,item):item;
  const size=furnitureFootprint({...item,x:0,z:0});
  const halfX=size.maxX,halfZ=size.maxZ;
  const xWalls=[HOUSE.minX,HOUSE.maxX,HOUSE_WING.maxX,
    -4.35,4.95,HOUSE_WING.minX];
  const zWalls=[HOUSE.minZ,HOUSE.maxZ,...HOUSE_WING.crossWalls,-1.35,2,-1.1];
  const nearest=(value:number,walls:readonly number[],half:number)=>{
    // Account for the actual wall thickness and a tiny surface gap.
    const options=walls.flatMap(edge=>[edge-half-.135,edge+half+.135]);
    const found=options.reduce((best,option)=>
      Math.abs(value-option)<Math.abs(value-best)?option:best,options[0]);
    return Math.abs(value-found)<.24?Math.round(found*100)/100:value;
  };
  return {...item,x:nearest(item.x,xWalls,halfX),z:nearest(item.z,zWalls,halfZ)};
}
