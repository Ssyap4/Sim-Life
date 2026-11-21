import { FURNITURE_BY_ID, furnitureFootprint, furnishingObstacles,
  type PlacedFurniture } from './furniture';
import { HOME_FLOOR, HOUSE, HOUSE_WING, HOME_DOORS, HOUSE_ENTRY,
  HOME_WALLS, HOME_FURNITURE, HOME_DECOR, KITCHEN_WORK, homeSeat } from './home';
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
const contains=(a:FloorRect,p:FloorPoint,extra=0)=>
  p.x>a.minX-extra&&p.x<a.maxX+extra&&p.z>a.minZ-extra&&p.z<a.maxZ+extra;
const center:FloorPoint={x:0,z:1.4};
const walkObstacles=placeObstacles('home');
// Separate actual physical geometry from navigation's actor-expanded walls.
const fixedPhysical:readonly FloorRect[]=[
  ...HOME_WALLS, ...HOME_DECOR, ...Object.values(HOME_FURNITURE),
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
let staticRoutes:readonly ReachRoute[]|null=null;
const mandatoryRoutes=()=>{
  if(!staticRoutes){
    const routes:ReachRoute[]=[];
    for(const p of requiredTargets){
      if(!pointIsClear(p,walkObstacles,HOME_FLOOR))continue;
      const route=findRoute(center,p,walkObstacles,HOME_FLOOR);
      if(route)routes.push({point:p,route});
    }
    staticRoutes=routes;
  }
  return staticRoutes;
};
const routeCache=new Map<string,readonly ReachRoute[]>();
function preservedRoutes(others:readonly PlacedFurniture[]){
  if(!others.length)return mandatoryRoutes();
  const key=JSON.stringify(others);
  const cached=routeCache.get(key);
  if(cached)return cached;
  const obstacles=[...walkObstacles,...furnishingObstacles({placed:[...others]})];
  const found=mandatoryRoutes().flatMap(({point})=>{
    const route=findRoute(center,point,obstacles,HOME_FLOOR);
    return route?[{point,route}]:[];
  });
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
  const footprint=furnitureFootprint(candidate);
  // A couple of centimetres of buffer avoid z-fighting without reserving
  // entire empty strips beside each wall.
  const physical=furnitureFootprint(candidate,.018);
  if(!insideWalls(physical))return deny('Предмет выходит за стену или границу комнаты');
  if(reservedDoors.some(door=>intersects(physical,door)))
    return deny('Нельзя перекрывать дверь или проход между комнатами');
  if(fixedPhysical.some(obstacle=>intersects(physical,obstacle)))
    return deny('Здесь стена, встроенная мебель или сантехника');
  if(!product.walkable && others.some(other=>
      !FURNITURE_BY_ID.get(other.sku)?.walkable&&
      intersects(physical,furnitureFootprint(other,.018))))
    return deny('Место занято другой мебелью');
  // Rugs are nonblocking and may overlay furniture and traffic.
  if(product.walkable)return yes;
  if((['vlad','alina'] as const).some(role=>
      state.world.places[role]==='home'&&contains(footprint,state.characters[role],.16)))
    return deny('Сейчас здесь стоит персонаж');
  if(PET_IDS.some(id=>contains(footprint,state.pets[id].position,.16)))
    return deny('Подожди, пока питомец отойдёт');
  if(PET_IDS.some(id=>{
    const route=state.pets[id].routine?.route;
    if(!route)return false;
    const path=[route.from,...route.path];
    const blocking=[furnitureFootprint(candidate,.24)];
    return path.some((p,i)=>contains(footprint,p,.24)||
      (i>0&&!segmentIsClear(path[i-1],p,blocking,HOME_FLOOR)));
  }))return deny('Здесь проходит текущий маршрут питомца');
  const changed=[...others,candidate];
  const obstacles=[...walkObstacles,...furnishingObstacles({placed:changed})];
  const dynamicBlocking=furnitureFootprint(candidate,.30);
  // An existing route remains valid if the new object is nowhere along it.
  // A* is only needed for a route that actually crosses the new footprint.
  // This keeps the live preview responsive even with many targets.
  for(const {point,route} of preservedRoutes(others)){
    if(!crossesExistingRoute(center,route,dynamicBlocking))continue;
    if(!pointIsClear(point,obstacles,HOME_FLOOR)||
      findRoute(center,point,obstacles,HOME_FLOOR)===null)
      return deny('Так будет перекрыт путь к двери или важному действию');
  }
  // Pets are mostly on the old side of the house. Do not run a full pet
  // pathfinding simulation for furniture located far from all their paths.
  const oldPet=petNavigationGeometry(
    [...walkObstacles,...furnishingObstacles({placed:[...others]})],HOME_FLOOR);
  const impacted: Array<{from:FloorPoint;dest:FloorPoint}>=[];
  for(const id of PET_IDS){
    const from=state.pets[id].position;
    for(const dest of [PETS[id].bowl,PETS[id].home,PETS[id].toilet]){
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
export function suggestFurnitureSnap(item:PlacedFurniture):PlacedFurniture {
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
