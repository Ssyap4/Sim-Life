import { BATH_FIXTURES,HOME_FLOOR,HOME_WALK_SPEED } from './home';
import { placeObstacles } from './locations';
import { findRoute,pointIsClear, type WalkRoute } from '../game/navigation';
import { petNavigationGeometry,planPetRoute } from '../game/PetNavigation';
import { PET_SPEED } from './pets';
import type { GameState,CharacterId } from './protocol';
export const DOG_BATH_SECONDS=24;
export const DOG_BATH_OWNER=BATH_FIXTURES.bathtub.approach;
export const DOG_BATH_APPROACH={x:7.21,z:2.8};
export const DOG_BATH_SURFACE={x:8.19,y:.425,z:3.52};
export const dogCleanliness=(state:GameState)=>state.pets.verdell.cleanliness??100;
const length=(r:WalkRoute)=>r.path.reduce((n,p,i)=>{const a=r.path[i-1]??r.from;return n+Math.hypot(p.x-a.x,p.z-a.z);},0);
export function dogBathPlan(state:GameState,role:CharacterId){
 if(state.world.places[role]!=='home'||state.world.dogWalker)return null;
 const obstacles=placeObstacles('home',state.furnishing),geometry=petNavigationGeometry(obstacles,HOME_FLOOR);
 const owner=state.characters[role],dog=state.pets.verdell.position;
 const ownerPath=findRoute(owner,DOG_BATH_OWNER,obstacles,HOME_FLOOR);
 if(!ownerPath||!pointIsClear(DOG_BATH_APPROACH,geometry.obstacles,geometry.floor))return null;
 const route=planPetRoute(dog,DOG_BATH_APPROACH,geometry);
 if(!route||route.path.length>60)return null;
 const end=route.path.at(-1)??route.from;
 if(Math.hypot(end.x-DOG_BATH_APPROACH.x,end.z-DOG_BATH_APPROACH.z)>.035)return null;
 const travelMs=Math.ceil(Math.max(length({from:owner,path:ownerPath})/HOME_WALK_SPEED,length(route)/PET_SPEED.verdell)*1000);
 return {route,travelMs,owner:DOG_BATH_OWNER,goal:DOG_BATH_APPROACH};
}
