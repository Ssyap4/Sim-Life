import { HOUSE,HOUSE_WING,WEST_WALL,EAST_WALL,BEDROOM_END,WC_START,OFFICE_END } from './home';
export const DUST_MAX=5760; // four game days, stored as exact game minutes
export const DUST_ROOMS=[
 {id:'bedroom',label:'Спальня',minX:HOUSE.minX,maxX:WEST_WALL,minZ:HOUSE.minZ,maxZ:BEDROOM_END},
 {id:'spare',label:'Свободная комната',minX:HOUSE.minX,maxX:WEST_WALL,minZ:BEDROOM_END,maxZ:WC_START},
 {id:'toilet',label:'Туалет',minX:HOUSE.minX,maxX:WEST_WALL,minZ:WC_START,maxZ:HOUSE.maxZ},
 {id:'kitchen',label:'Кухня',minX:WEST_WALL,maxX:EAST_WALL,minZ:HOUSE.minZ,maxZ:-.85},
 {id:'living',label:'Гостиная',minX:WEST_WALL,maxX:EAST_WALL,minZ:-.85,maxZ:HOUSE.maxZ},
 {id:'office',label:'Кабинет',minX:EAST_WALL,maxX:HOUSE.maxX,minZ:HOUSE.minZ,maxZ:OFFICE_END},
 {id:'bathroom',label:'Ванная',minX:EAST_WALL,maxX:HOUSE.maxX,minZ:OFFICE_END,maxZ:HOUSE.maxZ},
 {id:'wingNorth',label:'Восточная комната 1',minX:HOUSE_WING.minX,maxX:HOUSE_WING.maxX,minZ:HOUSE_WING.minZ,maxZ:HOUSE_WING.crossWalls[0]},
 {id:'wingMiddle',label:'Восточная комната 2',minX:HOUSE_WING.minX,maxX:HOUSE_WING.maxX,minZ:HOUSE_WING.crossWalls[0],maxZ:HOUSE_WING.crossWalls[1]},
 {id:'wingSouth',label:'Восточная комната 3',minX:HOUSE_WING.minX,maxX:HOUSE_WING.maxX,minZ:HOUSE_WING.crossWalls[1],maxZ:HOUSE_WING.maxZ},
] as const;
export type DustRoomId=typeof DUST_ROOMS[number]['id'];
export type HomeDust=Record<DustRoomId,number>;
export const initialDust=():HomeDust=>Object.fromEntries(DUST_ROOMS.map(r=>[r.id,0])) as HomeDust;
export const isDustRoom=(id:unknown):id is DustRoomId=>DUST_ROOMS.some(r=>r.id===id);
export function validDust(value:unknown):value is HomeDust{
 if(!value||typeof value!=='object')return false;
 const v=value as HomeDust;
 return DUST_ROOMS.every(r=>Number.isSafeInteger(v[r.id])&&v[r.id]>=0&&v[r.id]<=DUST_MAX);
}
export function roomAt(p:{x:number;z:number}){
 return DUST_ROOMS.find(r=>p.x>=r.minX&&p.x<r.maxX&&p.z>=r.minZ&&p.z<r.maxZ);
}
export const dustPercent=(dust:number)=>Math.round(dust/DUST_MAX*100);
export const cleanliness=(dust:number)=>100-dustPercent(dust);
export function dustStage(dust:number){
 return dust<1440?{label:'Чисто',mood:0,comfort:0}:dust<2880?{label:'Немного пыльно',mood:.6,comfort:.6}:dust<4320?{label:'Пыльно',mood:1.2,comfort:1.8}:{label:'Очень пыльно',mood:2.4,comfort:3};
}
export function advanceDust(dust:HomeDust,minutes:number):HomeDust{
 return Object.fromEntries(DUST_ROOMS.map(r=>[r.id,Math.min(DUST_MAX,dust[r.id]+minutes)])) as HomeDust;
}
export function dustLoss(start:number,minutes:number){
 let mood=0,comfort=0;
 for(let i=0;i<minutes;){
  const at=start+i,stage=dustStage(at);
  const next=[1440,2880,4320].find(t=>t>at)??Infinity;
  const n=Math.min(minutes-i,next-at);
  mood+=stage.mood*n/60;comfort+=stage.comfort*n/60;i+=n;
 }
 return {mood,comfort};
}