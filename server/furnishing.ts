import { FURNITURE_BY_ID, FURNITURE_DELIVERY, FURNITURE_FINISHES,
  furnitureFootprint, furnishingObstacles, type PlacedFurniture,
  type FurnishingCommand, type Rotation } from '../src/shared/furniture';
import { addLedger } from '../src/shared/economy';
import { HOME_FLOOR, HOUSE, HOUSE_WING, HOME_DOORS, HOUSE_ENTRY, KITCHEN_WORK, homeSeat } from '../src/shared/home';
import { STATIONS, placeObstacles, spawn } from '../src/shared/locations';
import { points, type GameState, type CharacterId } from '../src/shared/protocol';
import { PETS, PET_ROAM, PET_IDS } from '../src/shared/pets';
import { findRoute, pointIsClear, segmentIsClear, type FloorPoint, type FloorRect } from '../src/game/navigation';
import { petNavigationGeometry } from '../src/game/PetNavigation';

export type FurnishingResult =
  | { ok:true; state:GameState; message:string }
  | { ok:false; reason:string };

const fail=(reason:string):FurnishingResult=>({ok:false,reason});
const radius=(bounds:FloorRect,point:FloorPoint,extra=0) =>
  point.x>=bounds.minX-extra&&point.x<=bounds.maxX+extra&&
  point.z>=bounds.minZ-extra&&point.z<=bounds.maxZ+extra;
const intersects=(a:FloorRect,b:FloorRect) =>
  a.minX<=b.maxX&&a.maxX>=b.minX&&a.minZ<=b.maxZ&&a.maxZ>=b.minZ;
const root:FloorPoint={x:0,z:1.4};
const protectedPortals:readonly FloorRect[]=[
  ...Object.values(HOME_DOORS).map(({x,z,width})=>({
    minX:x-.66,maxX:x+.66,minZ:z-width*.44,maxZ:z+width*.44,
  })),
  {minX:HOUSE_ENTRY.x-HOUSE_ENTRY.width*.44,
   maxX:HOUSE_ENTRY.x+HOUSE_ENTRY.width*.44,
   minZ:HOUSE_ENTRY.z-.8,maxZ:HOUSE_ENTRY.z+.8},
  {minX:HOUSE_WING.minX-.72,maxX:HOUSE_WING.minX+.72,
   minZ:HOUSE_WING.connector.z-.70,maxZ:HOUSE_WING.connector.z+.70},
  ...HOUSE_WING.crossWalls.map(z=>({
    minX:HOUSE_WING.crossDoor.x-HOUSE_WING.crossDoor.width*.43,
    maxX:HOUSE_WING.crossDoor.x+HOUSE_WING.crossDoor.width*.43,
    minZ:z-.65,maxZ:z+.65,
  })),
];
const staticObstacles=placeObstacles('home');
const essentialPoints:FloorPoint[]=[
  root, spawn('home','vlad'), spawn('home','alina'),
  ...Object.values(points), KITCHEN_WORK.tea.position, KITCHEN_WORK.coffee.position,
  ...STATIONS.home.map(station=>station.approach),
  ...(['vlad','alina'] as const).flatMap(role=>
    ['sofa','table','officeChair','yardTable'].map(id=>
      homeSeat(id as 'sofa'|'table'|'officeChair'|'yardTable',role).approach)),
  ...PET_IDS.flatMap(id=>[PETS[id].home,PETS[id].bowl,PETS[id].toilet]),
  ...PET_ROAM,
  // The three new rooms and their passage must remain connected.
  {x:12.5,z:-5.25},{x:12.5,z:-2.0},{x:12.5,z:2.4},
  {x:10.4,z:-2.24},{x:13.0,z:-3.6},{x:13.0,z:.88},
];
// Baseline routes are intentionally immutable; all original active actions
// must remain reachable after a new item, not merely the nearby doors.
const mandatory=essentialPoints.filter((point,i) =>
  i===0||pointIsClear(point,staticObstacles,HOME_FLOOR)&&
    findRoute(root,point,staticObstacles,HOME_FLOOR)!==null);

function insideBuilding(rect:FloorRect):boolean {
  const inset=.10;
  const old=rect.minX>=HOUSE.minX+inset&&rect.maxX<=HOUSE.maxX-inset&&
    rect.minZ>=HOUSE.minZ+inset&&rect.maxZ<=HOUSE.maxZ-inset;
  const wing=rect.minX>=HOUSE_WING.minX+inset&&rect.maxX<=HOUSE_WING.maxX-inset&&
    rect.minZ>=HOUSE_WING.minZ+inset&&rect.maxZ<=HOUSE_WING.maxZ-inset;
  return old||wing;
}
function validPlacement(state:GameState,placed:PlacedFurniture,
  others:readonly PlacedFurniture[]):string|null {
  const item=FURNITURE_BY_ID.get(placed.sku);
  if(!item)return 'Товар не найден';
  if(!Number.isFinite(placed.x)||!Number.isFinite(placed.z)|| ![0,1,2,3].includes(placed.rotation))
    return 'Неверные координаты или угол поворота';
  if(!Number.isInteger(placed.x*100)||!Number.isInteger(placed.z*100))
    return 'Координаты мебели должны быть округлены до сантиметров';
  const clearance=.18;
  const expanded=furnitureFootprint(placed,clearance);
  if(!insideBuilding(expanded))return 'Мебель должна целиком находиться внутри дома';
  if(protectedPortals.some(portal=>intersects(expanded,portal)))
    return 'В дверном проёме нужно оставить свободный проход';
  if(staticObstacles.some(obstacle=>intersects(expanded,obstacle)))
    return 'Предмет пересекает стену, существующую мебель или обязательный проход';
  if(others.some(other=> {
    if(item.walkable||FURNITURE_BY_ID.get(other.sku)?.walkable)return false;
    return intersects(expanded,furnitureFootprint(other,.20));
  }))return 'Здесь уже стоит другая мебель';
  if((['vlad','alina'] as const).some(role=>state.world.places[role]==='home'&&
      radius(expanded,state.characters[role],.25)))
    return 'Нельзя ставить мебель на персонажа';
  if(PET_IDS.some(id=>radius(expanded,state.pets[id].position,.30)))
    return 'Подожди, пока питомец отойдёт';
  if(PET_IDS.some(id=> {
    const route=state.pets[id].routine?.route;
    if(!route)return false;
    const crossings=[route.from,...route.path];
    return crossings.some((point,i)=>radius(expanded,point,.18)||
      (i>0&&!segmentIsClear(crossings[i-1],point,[furnitureFootprint(placed,.32)],HOME_FLOOR)));
  }))return 'Сейчас здесь проходит маршрут питомца';

  if(item.walkable)return null; // Rugs remain passable, never block routes.
  const all=[...others,placed];
  const obstacles=[...staticObstacles,...furnishingObstacles({placed:all})];
  const safePets=petNavigationGeometry(obstacles,HOME_FLOOR);
  // Check every known essential destination from the SAME central connection
  // point. This prevents splitting a room, trapping either actor or blocking
  // the way to existing interactions.
  for(const point of mandatory) {
    if(!pointIsClear(point,obstacles,HOME_FLOOR)||
      findRoute(root,point,obstacles,HOME_FLOOR)===null)
      return 'Так перекрывается путь к важному месту или в соседнюю комнату';
  }
  for(const id of PET_IDS) {
    const pet=state.pets[id];
    const destinations=[PETS[id].bowl,PETS[id].home,PETS[id].toilet];
    for(const point of destinations) {
      // Pets choose nearby approach points through the existing pet planner.
      // If even the pet margin cannot reach a formerly reachable target,
      // placement must fail.
      const old=petNavigationGeometry(staticObstacles,HOME_FLOOR);
      const approach=(from:FloorPoint,dest:FloorPoint,geo:typeof old) => {
        const offsets=[[0,.74],[-.74,0],[.74,0],[0,-.74]] as const;
        return offsets.some(([dx,dz])=> {
          const p={x:dest.x+dx,z:dest.z+dz};
          return pointIsClear(p,geo.obstacles,geo.floor)&&
            findRoute(from,p,geo.obstacles,geo.floor)!==null;
        });
      };
      if(approach(pet.position,point,old)&&!approach(pet.position,point,safePets))
        return 'Мебель перекроет безопасный маршрут питомца';
    }
  }
  return null;
}

export function applyFurnishing(source:GameState,role:CharacterId,
  command:FurnishingCommand,now:number):FurnishingResult {
  if(source.world.places[role]!=='home')return fail('Обустройство доступно, когда персонаж дома');
  if(source.activeShifts[role]||source.careers.residents[role].shift)
    return fail('Сначала закончи рабочую смену');
  const next=structuredClone(source);
  const home=next.furnishing;
  if(command.type==='furniture_order') {
    if(!FURNITURE_BY_ID.has(command.sku)||!Object.hasOwn(FURNITURE_FINISHES,command.finish)||
       !Object.hasOwn(FURNITURE_DELIVERY,command.shipping)||!Number.isSafeInteger(command.quantity)||
       command.quantity<1||command.quantity>5)return fail('Неверный товар или параметры заказа');
    if(home.nextId+command.quantity>1000000)
      return fail('Не удалось выдать уникальный номер предмета');
    const info=FURNITURE_BY_ID.get(command.sku)!;
    const shipping=FURNITURE_DELIVERY[command.shipping];
    const cost=info.price*command.quantity+shipping.fee;
    if(next.money<cost)return fail('Недостаточно денег в семейном бюджете');
    next.money-=cost;
    for(let i=0;i<command.quantity;i++)home.orders.push({
      id:home.nextId++,sku:command.sku,finish:command.finish,
      readyAt:Math.floor(now)+shipping.minutes,shipping:command.shipping,
    });
    addLedger(next,role,'expense','furniture',cost,info.name+' ×'+command.quantity+' · доставка');
    next.revision++;
    return {ok:true,state:next,message:'Заказ оформлен: '+info.name+' ×'+command.quantity+
      '. Доставка через '+shipping.minutes+' игровых минут'};
  }
  if(!Number.isSafeInteger(command.id)||command.id<1)return fail('Неверный номер предмета');
  const order=home.orders.find(item=>item.id===command.id);
  const stored=home.stored.find(item=>item.id===command.id);
  const placed=home.placed.find(item=>item.id===command.id);
  if(command.type==='furniture_unbox') {
    if(!order)return fail('Этой посылки нет');
    if(order.readyAt>now)return fail('Посылка ещё в пути');
    home.orders=home.orders.filter(item=>item.id!==order.id);
    home.stored.push({id:order.id,sku:order.sku,finish:order.finish});
    next.revision++;
    return {ok:true,state:next,message:'📦 '+FURNITURE_BY_ID.get(order.sku)!.name+' распакован и добавлен на склад'};
  }
  if(command.type==='furniture_place'||command.type==='furniture_move') {
    const current=command.type==='furniture_place'?stored:placed;
    if(!current)return fail('Предмет не найден в '+(command.type==='furniture_place'?'инвентаре':'доме'));
    if(!Number.isFinite(command.x)||!Number.isFinite(command.z)||
       !Number.isInteger(command.rotation)||![0,1,2,3].includes(command.rotation))
      return fail('Неверное положение предмета');
    const destination={...current,
      x:Math.round(command.x*100)/100,z:Math.round(command.z*100)/100,
      rotation:command.rotation as Rotation};
    const others=home.placed.filter(item=>item.id!==current.id);
    const error=validPlacement(next,destination,others);
    if(error)return fail(error);
    if(stored)home.stored=home.stored.filter(item=>item.id!==stored.id);
    home.placed=[...others,destination];
    next.revision++;
    return {ok:true,state:next,message:'✅ '+FURNITURE_BY_ID.get(current.sku)!.name+' размещён в доме'};
  }
  if(command.type==='furniture_store') {
    if(!placed)return fail('Этот предмет ещё не установлен');
    home.placed=home.placed.filter(item=>item.id!==placed.id);
    home.stored.push({id:placed.id,sku:placed.sku,finish:placed.finish});
    next.revision++;
    return {ok:true,state:next,message:'📦 '+FURNITURE_BY_ID.get(placed.sku)!.name+' убран на склад'};
  }
  if(command.type==='furniture_sell') {
    if(!placed&&!stored)return fail('Этого предмета нет в собственности');
    const item=placed??stored!;
    const info=FURNITURE_BY_ID.get(item.sku)!;
    const proceeds=Math.floor(info.price*.55);
    home.stored=home.stored.filter(entry=>entry.id!==command.id);
    home.placed=home.placed.filter(entry=>entry.id!==command.id);
    next.money+=proceeds;
    addLedger(next,role,'income','furniture',proceeds,'Продан '+info.name);
    next.revision++;
    return {ok:true,state:next,message:'Продано: '+info.name+' · +'+proceeds.toLocaleString('ru-RU')+' ₽'};
  }
  return fail('Неизвестная команда');
}
