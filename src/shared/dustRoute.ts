import { DUST_ROOMS,roomAt,type DustRoomId } from './homeDust';
import { HOME_FLOOR } from './home';
import { placeObstacles } from './locations';
import { planWalk,pointIsClear } from '../game/navigation';
import type { GameState,CharacterId } from './protocol';
export function dustRoute(state:GameState,role:CharacterId,id:DustRoomId){
 if(state.world.places[role]!=='home')return null;
 const r=DUST_ROOMS.find(r=>r.id===id);if(!r)return null;
 const obstacles=placeObstacles('home',state.furnishing),from=state.characters[role];
 const candidates=[];
 for(let x=r.minX+.65;x<r.maxX-.4;x+=.9)for(let z=r.minZ+.65;z<r.maxZ-.4;z+=.9){
  const p={x,z};if(pointIsClear(p,obstacles,HOME_FLOOR))candidates.push(p);
 }
 candidates.sort((a,b)=>Math.hypot(a.x-from.x,a.z-from.z)-Math.hypot(b.x-from.x,b.z-from.z));
 for(const p of candidates){const route=planWalk(from,p,obstacles,HOME_FLOOR),end=route?.path.at(-1)??route?.from;
  if(route&&end&&roomAt(end)?.id===id&&Math.hypot(end.x-p.x,end.z-p.z)<.05)return route;}
 return null;
}