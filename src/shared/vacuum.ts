import {DUST_ROOMS,DUST_MAX,initialDust,isDustRoom,type DustRoomId} from './homeDust';
import {HOUSE,HOUSE_WING} from './home';
import {placeObstacles} from './locations';
import {planWalk,pointIsClear,segmentIsClear,type FloorPoint} from '../game/navigation';
import {VACUUM_MODELS,isVacuumSku} from './vacuumCatalog';
import type {GameState} from './protocol';
import type {PlacedFurniture} from './furniture';
export type VacuumCommand={type:'vacuum_control';action:'start'|'stop'|'return'|'auto';room?:DustRoomId;enabled?:boolean};
type Stop=FloorPoint&{room?:DustRoomId};
export type VacuumState={id:number;auto:boolean;lastDay:number;mode:'docked'|'cleaning'|'returning'|'stopped';position:FloorPoint;route:Stop[];skipped:DustRoomId[]};
export const vacuumItem=(state:GameState)=>state.furnishing.placed.find(p=>isVacuumSku(p.sku));
export const vacuumDock=(item:PlacedFurniture):FloorPoint=>({x:item.x+Math.sin(item.rotation*Math.PI/2)*.18,z:item.z+Math.cos(item.rotation*Math.PI/2)*.18});
const floor={minX:HOUSE.minX+.18,maxX:HOUSE_WING.maxX-.18,minZ:HOUSE.minZ+.18,maxZ:HOUSE.maxZ-.18};
function geometry(state:GameState,item:PlacedFurniture){
 return placeObstacles('home',{...state.furnishing,placed:state.furnishing.placed.filter(p=>p.id!==item.id)});
}
export function vacuumState(state:GameState,item:PlacedFurniture):VacuumState{
 return state.vacuum?.id===item.id?state.vacuum:{id:item.id,auto:false,lastDay:0,mode:'docked',position:vacuumDock(item),route:[],skipped:[]};
}
export function validVacuum(v:unknown):v is VacuumState{
 if(!v||typeof v!=='object')return false;
 const s=v as VacuumState,point=(p:FloorPoint)=>!!p&&Number.isFinite(p.x)&&Number.isFinite(p.z)&&p.x>=floor.minX-.3&&p.x<=floor.maxX+.3&&p.z>=floor.minZ-.3&&p.z<=floor.maxZ+.3;
 return Number.isSafeInteger(s.id)&&s.id>0&&typeof s.auto==='boolean'&&Number.isSafeInteger(s.lastDay)&&s.lastDay>=0&&['docked','cleaning','returning','stopped'].includes(s.mode)&&point(s.position)&&Array.isArray(s.route)&&s.route.length<=1500&&s.route.every(p=>point(p)&&(p.room===undefined||isDustRoom(p.room)))&&Array.isArray(s.skipped)&&s.skipped.every(isDustRoom);
}
function routeTo(state:GameState,item:PlacedFurniture,from:FloorPoint,to:FloorPoint){
 const obs=geometry(state,item);
 if(!pointIsClear(from,obs,floor)||!pointIsClear(to,obs,floor))return null;
 if(segmentIsClear(from,to,obs,floor))return {from,path:[to]};
 const r=planWalk(from,to,obs,floor),end=r?.path.at(-1)??r?.from;
 return r&&end&&Math.hypot(end.x-to.x,end.z-to.z)<.05?r:null;
}
export function planVacuum(state:GameState,item:PlacedFurniture,from:FloorPoint,rooms:readonly DustRoomId[]){
 const obs=geometry(state,item),stops:Stop[]=[],skipped:DustRoomId[]=[];
 let cursor=from;
 function append(goal:FloorPoint){
  const route=routeTo(state,item,cursor,goal);if(!route)return false;
  stops.push(...route.path);if(!route.path.length)stops.push(goal);
  cursor=goal;return true;
 }
 for(const id of rooms){
  const r=DUST_ROOMS.find(r=>r.id===id)!;
  // Several zig-zag passes, limited to reachable free floor. Never use dynamic bodies.
  const candidates:FloorPoint[]=[];
  for(let z=r.minZ+.7,row=0;z<r.maxZ-.35;z+=1.3,row++){
   const line:FloorPoint[]=[];
   for(let x=r.minX+.65;x<r.maxX-.35;x+=1.3){const p={x,z};if(pointIsClear(p,obs,floor))line.push(p);}
   candidates.push(...(row%2?line.reverse():line));
  }
  const before=stops.length;let reached=0;
  for(const p of candidates){if(append(p))reached++;}
  if(!reached){skipped.push(id);continue;}
  if(stops.length>before)stops[stops.length-1]={...stops[stops.length-1],room:id};
 }
 const home=vacuumDock(item);
 if(!append(home)||stops.length>1500)return null;
 return {route:stops,skipped};
}
export function controlVacuum(state:GameState,cmd:VacuumCommand):string|undefined{
 const item=vacuumItem(state);if(!item)return 'Сначала установи робот-пылесос дома';
 const v=vacuumState(state,item);state.vacuum=v;
 if(cmd.action==='auto'){if(typeof cmd.enabled!=='boolean')return 'Неверное расписание';v.auto=cmd.enabled;return;}
 if(cmd.action==='stop'){v.route=[];if(v.mode!=='docked')v.mode='stopped';return;}
 if(cmd.action==='start'&&v.mode==='cleaning')return 'Уборка уже идёт';
 const rooms=cmd.action==='return'?[]:cmd.room?[cmd.room]:DUST_ROOMS.map(r=>r.id);
 if(!rooms.every(isDustRoom))return 'Неизвестная комната';
 const plan=planVacuum(state,item,v.position,rooms);
 if(!plan||rooms.length&&plan.skipped.length===rooms.length)return 'Нет свободного маршрута уборки';
 v.route=plan.route;v.skipped=plan.skipped;v.mode=cmd.action==='return'?'returning':'cleaning';
 if(cmd.action==='start')v.lastDay=state.clock.day;
}
export function advanceVacuum(state:GameState,minutes:number){
 const item=vacuumItem(state);if(!item){delete state.vacuum;return;}
 const v=vacuumState(state,item);state.vacuum=v;
 if(v.mode==='docked')v.position=vacuumDock(item);
 if(v.auto&&v.mode==='docked'&&state.clock.minute>=600&&v.lastDay!==state.clock.day){
  v.lastDay=state.clock.day;controlVacuum(state,{type:'vacuum_control',action:'start'});
 }
 if(v.mode!=='cleaning'&&v.mode!=='returning')return;
 const obs=geometry(state,item),model=VACUUM_MODELS[item.sku as keyof typeof VACUUM_MODELS];
 let distance=minutes*model.speed;
 while(v.route.length){
  const next=v.route[0],span=Math.hypot(next.x-v.position.x,next.z-v.position.z);
  if(!segmentIsClear(v.position,next,obs,floor)){v.route=[];v.mode='stopped';return;}
  if(span>distance){const t=distance/span;v.position={x:v.position.x+(next.x-v.position.x)*t,z:v.position.z+(next.z-v.position.z)*t};return;}
  distance-=span;v.position={x:next.x,z:next.z};v.route.shift();
  if(next.room){const dust=state.homeDust??=initialDust();dust[next.room]=Math.min(dust[next.room],Math.round(DUST_MAX*(100-model.clean)/100));}
  if(!v.route.some(p=>p.room))v.mode='returning';
 }
 v.mode='docked';v.position=vacuumDock(item);
}