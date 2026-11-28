import {isSurfaceDevice} from '../src/shared/consoleCatalog';
import {speakerMountAt,supportOccupied} from '../src/shared/speakerPlacement';
import {feedingStation} from '../src/shared/petFeeders';
import { HOME_FLOOR } from '../src/shared/home';
import { placeObstacles } from '../src/shared/locations';
import { PET_IDS, PET_SPEED } from '../src/shared/pets';
import { GAME_MINUTES_PER_REAL_SECOND } from '../src/shared/life';
import { currentCatPerch } from '../src/shared/CatPerches';
import { currentPetEquipment } from '../src/shared/petFurniture';
import { petNavigationGeometry } from '../src/game/PetNavigation';
import { nearestClearPoint, pointIsClear, sampleWalk, segmentIsClear, type FloorRect, type WalkRoute } from '../src/game/navigation';
import { FURNITURE_BY_ID, PURCHASABLE_FURNITURE, FURNITURE_DELIVERY, FURNITURE_FINISHES,
  STATIC_FURNITURE, isStaticFurnitureId, furnitureFootprint, type PlacedFurniture,
  type FurnishingCommand, type Rotation } from '../src/shared/furniture';
import { checkFurniturePlacement } from '../src/shared/furnishingPlacement';
import { addLedger } from '../src/shared/economy';
import type { GameState, CharacterId } from '../src/shared/protocol';

export type FurnishingResult =
  | { ok:true; state:GameState; message:string }
  | { ok:false; reason:string };

const fail=(reason:string):FurnishingResult=>({ok:false,reason});
export function layoutBlock(item:PlacedFurniture|undefined,extra=.30):FloorRect|undefined{
  return item&&!isSurfaceDevice(item.sku)&&!FURNITURE_BY_ID.get(item.sku)?.walkable?furnitureFootprint(item,extra):undefined;
}
export function routeHitsLayout(route:WalkRoute,block:FloorRect|undefined):boolean{
  if(!block)return false;
  if(!pointIsClear(route.from,[block],HOME_FLOOR))return true;
  return route.path.some((point,i)=>!segmentIsClear(route.path[i-1]??route.from,point,[block],HOME_FLOOR));
}
/** No temporary body or route is a placement obstacle. Recover its physical
 * position after a valid spatial edit, without granting an interrupted reward. */
export function settleLayout(state:GameState,added:PlacedFurniture|undefined,now:number):boolean{
  let changed=false;
  const obstacles=placeObstacles('home',state.furnishing),block=layoutBlock(added);
  for(const role of ['vlad','alina'] as const){
    const person=state.characters[role];
    if(state.world.places[role]!=='home'||person.pose!=='idle'||!block||pointIsClear(person,[block],HOME_FLOOR))continue;
    const safe=nearestClearPoint(person,obstacles,HOME_FLOOR);
    if(safe){Object.assign(person,safe);changed=true;}
  }
  const geometry=petNavigationGeometry(obstacles,HOME_FLOOR),petBlock=layoutBlock(added,.44);
  for(const id of PET_IDS){
    const pet=state.pets[id],routine=pet.routine;
    const remaining=routine&&sampleWalk(routine.route,Math.max(0,now-routine.startedAt)*PET_SPEED[id]/GAME_MINUTES_PER_REAL_SECOND);
    const invalid=routine&&(routine.perch&&!currentCatPerch(state.furnishing,routine.perch)||
      routine.equipment&&!currentPetEquipment(state.furnishing,routine.equipment)||
      routine.manualToy&&!pointIsClear(routine.manualToy.point,geometry.obstacles,geometry.floor)||
      routine.kind==='eat'&&(()=>{const goal=feedingStation(state.furnishing,id).goal;const prev=routine.route.path.at(-1)??routine.route.from;return Math.hypot(goal.x-prev.x,goal.z-prev.z)>.035;})()||
      remaining&&routeHitsLayout(remaining,petBlock));
    const pos=remaining?.from??pet.position;
    if(invalid||petBlock&&!pointIsClear(pos,[petBlock],HOME_FLOOR)){
      const safe=nearestClearPoint(pos,geometry.obstacles,geometry.floor);
      if(safe)pet.position=safe;
      delete pet.routine;changed=true;
    }
    if(pet.furnitureYield&&!currentCatPerch(state.furnishing,pet.furnitureYield.perch)){
      delete pet.furnitureYield;changed=true;
    }
  }
  return changed;
}
function releaseBed(state:GameState,bed:number|'starter'){
  for(const role of ['vlad','alina'] as const){
    const person=state.characters[role];
    if(person.pose==='sleep'&&(person.sleepingOn??'starter')===bed){
      person.pose='idle';delete person.sleepingOn;delete person.sleepMode;delete person.sleepAutomatic;
    }
  }
}
export function applyFurnishing(source:GameState,role:CharacterId,
  command:FurnishingCommand,now:number):FurnishingResult {
  if(source.world.places[role]!=='home')return fail('Обустройство доступно, когда персонаж дома');
  if(source.vacuum&&source.vacuum.mode!=='docked'&&source.vacuum.mode!=='stopped'&&'id' in command&&command.id===source.vacuum.id)return fail('Сначала верни робот-пылесос на станцию');
  const next=structuredClone(source);
  if(next.speakers&&'id' in command&&['furniture_store','furniture_sell'].includes(command.type))delete next.speakers[command.id];
  if(next.vacuum&&'id' in command&&command.id===next.vacuum.id&&['furniture_move','furniture_store','furniture_sell'].includes(command.type))delete next.vacuum;
  const home=next.furnishing;
  if(command.type==='furniture_sell_static'&&supportOccupied(home,'static:'+command.fixture)||['furniture_move','furniture_store','furniture_sell'].includes(command.type)&&'id' in command&&supportOccupied(home,'item:'+command.id))return fail('Сначала сними технику с этой мебели');
  const dog=next.pets.verdell.routine;
  if(dog?.kind==='bedTogether'&&dog.dogBed&&(
    command.type==='furniture_sell_static'&&command.fixture==='bed'&&dog.dogBed.bed==='starter'||
    (command.type==='furniture_move'||command.type==='furniture_store'||command.type==='furniture_sell')&&(command.id===dog.dogBed.bed||command.id===dog.equipment?.id)
  ))return fail('Сначала позови Верделла с кровати');
  if(command.type==='furniture_order') {
    if(!PURCHASABLE_FURNITURE.some(item=>item.id===command.sku)||!Object.hasOwn(FURNITURE_FINISHES,command.finish)||
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
  if(command.type==='furniture_sell_static') {
    if(!isStaticFurnitureId(command.fixture))return fail('Этот предмет не продаётся');
    if(home.soldFixtures?.includes(command.fixture))return fail('Этот предмет уже продан');
    const info=STATIC_FURNITURE[command.fixture];
    const proceeds=Math.floor(FURNITURE_BY_ID.get(info.sku)!.price*.55);
    home.soldFixtures=[...(home.soldFixtures??[]),command.fixture];
    if(command.fixture==='bed')releaseBed(next,'starter');
    settleLayout(next,undefined,now);
    next.money+=proceeds;
    addLedger(next,role,'income','furniture',proceeds,'Продажа: '+info.label);
    next.revision++;
    return {ok:true,state:next,message:'Продано: '+info.label+' — +'+proceeds.toLocaleString('ru-RU')+' ₽'};
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
    const destination:PlacedFurniture={...current,
      x:Math.round(command.x*100)/100,z:Math.round(command.z*100)/100,
      rotation:command.rotation as Rotation};
    if(isSurfaceDevice(current.sku)){const surface=speakerMountAt(home,destination);if(!surface)return fail('Выбери свободную поверхность мебели');destination.mount=surface.mount;}
    if(!isSurfaceDevice(current.sku)&&next.vacuum&&next.vacuum.id!==current.id&&next.vacuum.mode!=='docked'&&!FURNITURE_BY_ID.get(current.sku)?.walkable&&!pointIsClear(next.vacuum.position,[furnitureFootprint(destination,.30)],HOME_FLOOR))return fail('На этом месте находится робот-пылесос');
    const others=home.placed.filter(item=>item.id!==current.id);
    const validation=checkFurniturePlacement(next,destination,others);
    if(!validation.valid)return fail(validation.reason);
    if(stored)home.stored=home.stored.filter(item=>item.id!==stored.id);
    home.placed=[...others,destination];
    if(placed)releaseBed(next,placed.id);
    settleLayout(next,destination,now);
    next.revision++;
    return {ok:true,state:next,message:'✅ '+FURNITURE_BY_ID.get(current.sku)!.name+' размещён в доме'};
  }
  if(command.type==='furniture_store') {
    if(!placed)return fail('Этот предмет ещё не установлен');
    home.placed=home.placed.filter(item=>item.id!==placed.id);
    home.stored.push({id:placed.id,sku:placed.sku,finish:placed.finish});
    releaseBed(next,placed.id);settleLayout(next,undefined,now);
    next.revision++;
    return {ok:true,state:next,message:'📦 '+FURNITURE_BY_ID.get(placed.sku)!.name+' убран на склад'};
  }
  if(command.type==='furniture_sell') {
    if(!placed&&!stored)return fail('Этого предмета нет в собственности');
    const item=placed??stored!;
    if(next.familyLife?.displayWorks)delete next.familyLife.displayWorks[String(item.id)];
    const info=FURNITURE_BY_ID.get(item.sku)!;
    const proceeds=Math.floor(info.price*.55);
    home.stored=home.stored.filter(entry=>entry.id!==command.id);
    home.placed=home.placed.filter(entry=>entry.id!==command.id);
    if(placed){releaseBed(next,placed.id);settleLayout(next,undefined,now);}
    next.money+=proceeds;
    addLedger(next,role,'income','furniture',proceeds,'Продан '+info.name);
    next.revision++;
    return {ok:true,state:next,message:'Продано: '+info.name+' · +'+proceeds.toLocaleString('ru-RU')+' ₽'};
  }
  return fail('Неизвестная команда');
}
