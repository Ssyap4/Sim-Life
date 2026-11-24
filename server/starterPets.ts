import { STARTER_CAT_HOUSE,STARTER_CAT_SCRATCHER,type PlacedFurniture } from '../src/shared/furniture';
import { checkFurniturePlacement } from '../src/shared/furnishingPlacement';
import { catPerchCandidates } from '../src/shared/CatPerches';
import { HOME_FLOOR } from '../src/shared/home';
import { placeObstacles } from '../src/shared/locations';
import { petNavigationGeometry,planPetRoute } from '../src/game/PetNavigation';
import type { GameState } from '../src/shared/protocol';
/** One free set per household, never replaces purchased furniture or respawns sold items. */
export function grantStarterPetFurniture(state:GameState):boolean{
  const f=state.furnishing;
  if(f.starterPetsGranted||f.nextId+2>1000000)return false;
  const house={id:f.nextId,sku:STARTER_CAT_HOUSE,finish:'sage' as const};
  const scratch={id:f.nextId+1,sku:STARTER_CAT_SCRATCHER,finish:'oak' as const};
  // Keep the starter set beside each other. Never force a placement in an occupied room.
  const spots=[[3.85,1.9,-1.3,0],[-7.7,-.45,1.3,0],[10.4,3.8,1.3,2]] as const;
  let placed=false;
  for(const [x,z,dx,rotation] of spots){
    const h:PlacedFurniture={...house,x,z,rotation},p:PlacedFurniture={...scratch,x:x+dx,z,rotation};
    if(!checkFurniturePlacement(state,h).valid||!checkFurniturePlacement(state,p,[...f.placed,h]).valid)continue;
    const layout={...f,placed:[...f.placed,h,p]};
    const perch=catPerchCandidates(layout).find(v=>v.key==='placed:'+h.id+':jump');
    const geometry=petNavigationGeometry(placeObstacles('home',layout),HOME_FLOOR);
    const route=perch&&planPetRoute(state.pets.simba.position,perch.approach,geometry);
    const end=route&&(route.path.at(-1)??route.from);
    if(!perch||!end||Math.hypot(end.x-perch.approach.x,end.z-perch.approach.z)>.04)continue;
    f.placed.push(h,p);placed=true;break;
  }
  if(!placed)f.stored.push(house,scratch);
  f.nextId+=2;
  f.starterPetsGranted=true;
  state.revision++;
  return true;
}
