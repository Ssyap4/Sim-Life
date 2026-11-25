import { LEISURE, isLeisureAction } from './leisure';
import {floatX,FLOAT_Z,FLOAT_TOP,poolSwimFrame} from './oasisPool';
import { FURNITURE_BY_ID, workstationLayout,isNotebookDesk,diningSeatTop, type FurnitureShape, type PlacedFurniture } from './furniture';
import { HOME_WORLD_FLOOR } from './district';
import { HOME_FLOOR } from './home';
import { placeObstacles,stationById,HOME_LAPTOP } from './locations';
import type { CharacterId, GameState } from './protocol';
import { planWalk, pointIsClear, type WalkRoute } from '../game/navigation';

/** Only meaningful activities for the purchased item's actual 3D shape. */
export const FURNITURE_ACTIONS = {
  boardGame:LEISURE.boardGame.label,chessGame:LEISURE.chessGame.label,dartsGame:LEISURE.dartsGame.label,
  pingPong:LEISURE.pingPong.label,billiards:LEISURE.billiards.label,hammockRest:LEISURE.hammockRest.label,swingRest:LEISURE.swingRest.label,terraceRest:LEISURE.terraceRest.label,poolFloat:LEISURE.poolFloat.label,poolSwim:LEISURE.poolSwim.label,
  sofaRest:'Отдохнуть',
  sofaMusic:'Послушать музыку',
  sofaCall:'Позвонить с дивана',
  sofaScroll:'Полистать ленту',
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
  if(shape==='leisure')return isLeisureAction(action)&&LEISURE[action].sku===item.sku;
  if(isLeisureAction(action))return false;
  if(action==='officeChairSit')return seats.has(shape);
  if(['sofaRest','sofaMusic','sofaCall','sofaScroll','free_tv','youtube','movie'].includes(action))
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
  if(isLeisureAction(action)){
    const spec=LEISURE[action];
    if(action==='poolFloat'||action==='poolSwim'){
      const obstacles=placeObstacles('home',state.furnishing);
      const approaches=[[1.75+side*.35,info.depth/2+.38],[1.75+side*.35,info.depth/2+.65]];
      for(const [x,z] of approaches){const p=rotate(item,x,z);if(!pointIsClear(p,obstacles,HOME_FLOOR))continue;const route=planWalk(from,p,obstacles,HOME_FLOOR);if(!route)continue;
        const swim=poolSwimFrame(0,role);const center=action==='poolFloat'?rotate(item,floatX(role),FLOAT_Z+.88):rotate(item,swim.x,swim.z);
        return {item,action,route,pose:{...center,y:action==='poolFloat'?FLOAT_TOP+.12:swim.y,yaw:item.rotation*Math.PI/2+(action==='poolFloat'?0:swim.yaw)}};
      }return null;
    }
    const board=action==='boardGame'||action==='chessGame';
    const terrace=action==='terraceRest';const swing=action==='swingRest'||terrace;const hammock=action==='hammockRest';
    const target=board||action==='pingPong'?[0,side*(info.depth/2+.64)]:
      action==='billiards'?[side*(info.width/2+.65),0]:action==='dartsGame'?[side*.42,info.depth/2+1.35]:
      [swing?side*.47:0,info.depth/2+.58];
    const obstacles=placeObstacles('home',state.furnishing);
    const alternatives=board?[target,[-info.width/2-.49,side*.64],[info.width/2+.49,side*.64]]:
      hammock?[target,[0,-info.depth/2-.47],[-info.width/2-.48,0],[info.width/2+.48,0]]:
      swing?[target,[side*.47,info.depth/2+.37]]:
      action==='dartsGame'?[target,[side*.42,info.depth/2+1.0],[side*.30,info.depth/2+.78]]:
      action==='pingPong'?[target,[0,side*(info.depth/2+.38)],[side*.30,side*(info.depth/2+.40)]]:
      [target,[side*(info.width/2+.38),-.35],[side*(info.width/2+.38),.35]];
    let route:WalkRoute|null=null;
    for(const [x,z] of alternatives){
      const approach=rotate(item,x,z);
      if(!pointIsClear(approach,obstacles,HOME_WORLD_FLOOR))continue;
      route=planWalk(from,approach,obstacles,HOME_WORLD_FLOOR);
      if(route)break;
    }
    if(!route)return null;
    const center=rotate(item,board?0:swing?side*.47:0,board?side*.65:terrace?-.27:0);
    const yaw=item.rotation*Math.PI/2+(board&&side>0?Math.PI:0);
    const pose={...center,y:spec.seated?(role==='vlad'?-.26:-.21)+(hammock?.015:0)+(terrace?.005:0):0,yaw};
    return {item,action,route,pose};
  }
  const actorSeats=softSeats.has(shape);
  const isBareSeat=seats.has(shape);
  const seatTop=diningSeatTop(item.sku)??(shape==='chair'?info.height*.48:shape==='stool'?info.height*.88:
    shape==='bench'?info.height*.54:shape==='ottoman'?info.height*.56:
    shape==='armchair'?info.height*.52:info.height*.50);
  const isTable=['tableRest','tableTalk','tablePlan'].includes(action);
  const isSofa=['sofaRest','sofaMusic','sofaCall','sofaScroll','free_tv','youtube','movie'].includes(action)||
    (action==='read_book'&&(shape==='sofa'||shape==='corner'));
  const isDesk=shape==='desk';
  const isShelf=shape==='shelves';
  const localX=isTable?-side*(info.width/2+.36):isSofa?side*info.width*.20:0;
  const localZ=isTable?0:isSofa?0:isDesk?(workstationLayout(item.sku)?.seat??info.depth/2+.28):isShelf?info.depth/2+.56:0;
  const posePoint=rotate(item,localX,localZ);
  const pose={
    ...posePoint,
    y:isTable?(role==='vlad'?-.26:-.21):isDesk?(role==='vlad'?-.24:-.19):
      isSofa?.04:actorSeats?seatTop-(role==='vlad'?.905:.852):0,
    // An independent chair faces its open front (+Z); the old +PI made
    // residents sit backwards through the backrest.
    yaw:item.rotation*Math.PI/2+(isTable?(role==='vlad'?-Math.PI/2:Math.PI/2):isBareSeat?0:Math.PI),
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
    if(!pointIsClear(target,obstacles,HOME_WORLD_FLOOR))continue;
    const route=planWalk(from,target,obstacles,HOME_WORLD_FLOOR);
    if(!route)continue;
    let len=0,prev=route.from;
    for(const point of route.path){len+=Math.hypot(point.x-prev.x,point.z-prev.z);prev=point;}
    if(len<shortest){shortest=len;selected=route;}
  }
  return selected?{item,action,route:selected,pose}:null;
}

/** A purchased notebook desk hosts the one shared laptop; legacy homes keep the starter station. */
export const laptopDesk=(state:GameState)=>state.furnishing.placed.find(item=>isNotebookDesk(item.sku));
export const laptopWorkplace=(state:GameState,role:CharacterId)=>{const desk=laptopDesk(state);return desk?furnitureUseLocation(state,role,desk.id,'deskJournal'):null;};
export function laptopApproach(state:GameState,role:CharacterId){const loc=laptopWorkplace(state,role);return loc?(loc.route.path.at(-1)??loc.route.from):stationById('home',HOME_LAPTOP)!.approach;}
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
      Math.hypot(table.x-item.x,table.z-item.z)<=Math.max(1.35,info.width/2+1.1)&&
      (diningSeatTop(item.sku)===undefined||FURNITURE_BY_ID.get(item.sku)!.shape==='stool'||
        ((table.x-item.x)*Math.sin(item.rotation*Math.PI/2)+(table.z-item.z)*Math.cos(item.rotation*Math.PI/2))>Math.hypot(table.x-item.x,table.z-item.z)*.5));
    // Two characters must not independently pick the first chair and sit
    // inside each other. Reserve opposite sides deterministically by role.
    // With only one chair keep it usable by either player when dining alone.
    const yaw=table.rotation*Math.PI/2;
    const c=Math.cos(yaw),s=Math.sin(yaw);
    available.sort((a,b)=>{
      const ax=(a.x-table.x)*c-(a.z-table.z)*s;
      const bx=(b.x-table.x)*c-(b.z-table.z)*s;
      return ax-bx||a.id-b.id;
    });
    const preferred=available.length>1&&role==='alina'?[...available].reverse():available;
    for(const chair of preferred){
      const seat=furnitureUseLocation(state,role,chair.id,'officeChairSit');
      if(seat)return {...use,route:seat.route,pose:seat.pose,seated:true,chairId:chair.id};
    }
    // No matching chair is physically installed, so the resident must
    // stand beside the table instead of sitting on an invisible chair.
    return {...use,seated:false};
  }
  return null;
}
