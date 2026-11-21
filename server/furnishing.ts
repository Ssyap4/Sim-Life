import { FURNITURE_BY_ID, FURNITURE_DELIVERY, FURNITURE_FINISHES,
  type FurnishingCommand, type Rotation } from '../src/shared/furniture';
import { checkFurniturePlacement } from '../src/shared/furnishingPlacement';
import { addLedger } from '../src/shared/economy';
import type { GameState, CharacterId } from '../src/shared/protocol';

export type FurnishingResult =
  | { ok:true; state:GameState; message:string }
  | { ok:false; reason:string };

const fail=(reason:string):FurnishingResult=>({ok:false,reason});
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
    const validation=checkFurniturePlacement(next,destination,others);
    if(!validation.valid)return fail(validation.reason);
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
