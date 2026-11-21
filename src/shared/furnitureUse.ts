import { FURNITURE_BY_ID, type FurnitureShape, type PlacedFurniture } from './furniture';
import { HOME_FLOOR } from './home';
import { placeObstacles } from './locations';
import type { CharacterId, GameState } from './protocol';
import { planWalk, pointIsClear, type WalkRoute } from '../game/navigation';

/** Only meaningful activities for the purchased item's actual 3D shape. */
export const FURNITURE_ACTIONS = {
  sofaRest:'Отдохнуть',
  sofaMusic:'Послушать музыку',
  sofaCall:'Позвонить с дивана',
  officeChairSit:'Посидеть',
  tableRest:'Посидеть за столом',
  tableTalk:'Поговорить за столом',
  tablePlan:'Спланировать день',
  deskJournal:'Записать мысли',
  deskGames:'Поиграть за компьютером',
  vladOrder:'Практика программирования',
  vladStudy:'Изучать разработку',
  alinaStudy:'Изучать реконструкцию волос',
  alinaConsult:'Практика общения с клиентами',
  free_tv:'Посмотреть телепередачу',
  youtube:'Смотреть YouTube',
  movie:'Посмотреть фильм',
  read_book:'Прочитать книгу',
  tidy:'Навести порядок',
} as const;
export type FurnitureUseAction=keyof typeof FURNITURE_ACTIONS;
export type FurnitureUseCommand={
  type:'furniture_use';furnitureId:number;action:FurnitureUseAction;
  book?:import('./homeLife').BookId;
  genre?:import('./homeLife').Genre;
};
export type FurnitureUseLocation={
  item:PlacedFurniture;action:FurnitureUseAction;route:WalkRoute;
  pose:{x:number;y:number;z:number;yaw:number};
};
const softSeats=new Set<FurnitureShape>(['sofa','corner','armchair','ottoman','bench','chair','stool']);
const seats=new Set<FurnitureShape>(['armchair','ottoman','bench','chair','stool']);
const storage=new Set<FurnitureShape>(['wardrobe','dresser','nightstand','sideboard','shelves']);

export function canFurniturePerform(item:PlacedFurniture,action:FurnitureUseAction):boolean{
  const info=FURNITURE_BY_ID.get(item.sku);
  if(!info)return false;
  const shape=info.shape;
  if(action==='officeChairSit')return seats.has(shape);
  if(['sofaRest','sofaMusic','sofaCall','free_tv','youtube','movie'].includes(action))
    return shape==='sofa'||shape==='corner';
  if(['tableRest','tableTalk','tablePlan'].includes(action))
    return shape==='table'&&info.height>=.63;
  if(['deskJournal','deskGames','vladOrder','vladStudy','alinaStudy','alinaConsult'].includes(action))
    return shape==='desk';
  if(action==='read_book')return shape==='shelves'||softSeats.has(shape);
  if(action==='tidy')return storage.has(shape);
  return false;
}
export function furnitureActionList(item:PlacedFurniture):FurnitureUseAction[]{
  const all=Object.keys(FURNITURE_ACTIONS) as FurnitureUseAction[];
  return all.filter(action=>canFurniturePerform(item,action));
}

/** The menu must not advertise commands the server would reject for this
 * resident or when the only bookcase has already been sold. The server remains
 * authoritative if a client sends an old/stale command. */
export function availableFurnitureActions(state:GameState,role:CharacterId,
  item:PlacedFurniture):FurnitureUseAction[]{
  const hasBookshelf=!state.furnishing.soldFixtures?.includes('bookcase')||
    state.furnishing.placed.some(placed=>FURNITURE_BY_ID.get(placed.sku)?.shape==='shelves');
  return furnitureActionList(item).filter(action=>
    !(role==='vlad'&&['alinaStudy','alinaConsult'].includes(action))&&
    !(role==='alina'&&['vladOrder','vladStudy'].includes(action))&&
    (action!=='read_book'||hasBookshelf));
}
export function furnitureSource(state:GameState,id:unknown,action:FurnitureUseAction):
  {ok:true;item:PlacedFurniture}|{ok:false;reason:string}{
  if(typeof id!=='number'||!Number.isSafeInteger(id)||id<1)
    return {ok:false,reason:'Неверный предмет мебели'};
  const item=state.furnishing.placed.find(row=>row.id===id);
  if(!item)return {ok:false,reason:'Мебель не установлена в доме'};
  if(!canFurniturePerform(item,action))
    return {ok:false,reason:'Этот предмет не поддерживает такое действие'};
  return {ok:true,item};
}
function rotate(item:PlacedFurniture,x:number,z:number){
  const a=item.rotation*Math.PI/2,c=Math.cos(a),s=Math.sin(a);
  return {x:item.x+x*c+z*s,z:item.z-x*s+z*c};
}
export function furnitureUseLocation(state:GameState,role:CharacterId,
  id:number,action:FurnitureUseAction):FurnitureUseLocation|null {
  const check=furnitureSource(state,id,action);
  if(!check.ok)return null;
  const item=check.item,info=FURNITURE_BY_ID.get(item.sku)!;
  const shape=info.shape,from=state.characters[role];
  const side=role==='vlad'?-1:1;
  const actorSeats=softSeats.has(shape);
  const isTable=['tableRest','tableTalk','tablePlan'].includes(action);
  const isSofa=['sofaRest','sofaMusic','sofaCall','free_tv','youtube','movie'].includes(action)||
    (action==='read_book'&&(shape==='sofa'||shape==='corner'));
  const isDesk=shape==='desk';
  const isShelf=shape==='shelves';
  const localX=isTable?-side*(info.width/2+.36):isSofa?side*info.width*.20:0;
  const localZ=isTable?0:isSofa?0:isDesk?info.depth/2+.28:isShelf?info.depth/2+.56:0;
  const posePoint=rotate(item,localX,localZ);
  const pose={
    ...posePoint,
    y:isTable?(role==='vlad'?-.26:-.21):isDesk?(role==='vlad'?-.24:-.19):
      isSofa?.04:actorSeats?-.20:0,
    yaw:item.rotation*Math.PI/2+(isTable?(role==='vlad'?-Math.PI/2:Math.PI/2):Math.PI),
  };
  const distance=isTable?info.width/2+.68:isSofa?info.depth/2+.63:
    isDesk?info.depth/2+.92:isShelf?info.depth/2+.62:info.depth/2+.55;
  const approaches=isTable?[
    [localX+(-side)*.32,0],[-localX-side*.32,0],
    [0,info.depth/2+.68],[0,-info.depth/2-.68],
  ]: [
    [isSofa?localX:0,distance],
    [0,distance],
    [info.width/2+.68,0],[-info.width/2-.68,0],
    [0,-distance],
  ];
  const obstacles=placeObstacles('home',state.furnishing);
  let selected:WalkRoute|null=null,shortest=Infinity;
  for(const [x,z] of approaches){
    const target=rotate(item,x,z);
    if(!pointIsClear(target,obstacles,HOME_FLOOR))continue;
    const route=planWalk(from,target,obstacles,HOME_FLOOR);
    if(!route)continue;
    let len=0,prev=route.from;
    for(const point of route.path){len+=Math.hypot(point.x-prev.x,point.z-prev.z);prev=point;}
    if(len<shortest){shortest=len;selected=route;}
  }
  return selected?{item,action,route:selected,pose}:null;
}

/** Eating always uses a real current table, never the sold starter's coordinates. */
export function diningLocation(state:GameState,role:CharacterId,requestedId?:number){
  const requested=requestedId!==undefined?
    state.furnishing.placed.filter(item=>item.id===requestedId):
    state.furnishing.soldFixtures?.includes('table')?
      state.furnishing.placed:[] ;
  for(const table of requested){
    if(!canFurniturePerform(table,'tableRest'))continue;
    const use=furnitureUseLocation(state,role,table.id,'tableRest');
    if(!use)continue;
    const info=FURNITURE_BY_ID.get(table.sku)!;
    const available=state.furnishing.placed.filter(item=>
      item.id!==table.id&&seats.has(FURNITURE_BY_ID.get(item.sku)!.shape)&&
      Math.hypot(table.x-item.x,table.z-item.z)<=Math.max(1.35,info.width/2+1.1));
    for(const chair of available){
      const seat=furnitureUseLocation(state,role,chair.id,'officeChairSit');
      if(seat)return {...use,route:seat.route,pose:seat.pose,seated:true,chairId:chair.id};
    }
    // No matching chair is physically installed, so the resident must
    // stand beside the table instead of sitting on an invisible chair.
    return {...use,seated:false};
  }
  return null;
}
