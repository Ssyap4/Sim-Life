import { districtPoint, inHomeGrounds } from '../src/shared/district';
import { NEIGHBORS, neighborPose } from '../src/shared/neighbors';
import { serviceAvailable, SERVICE_MESSAGES } from '../src/shared/services';
import {
  CAFE_MENU, CAFE_MINUTES, DELIVERY_FEE, DELIVERY_MINUTES, PLACES, WORLD_FLOOR, floorFor,
  approachFor, clockMinutes, isCafeItem, isPlace, placeObstacles, spawn, stationById, doorwayArrival,
  type LocalActivity, type Point, type Station, type WorldState,
} from '../src/shared/locations';
import type { CharacterId, GameState } from '../src/shared/protocol';
import { addLedger } from '../src/shared/economy';
import { findRoute, nearestClearPoint, pointIsClear } from '../src/game/navigation';
import { isCareerPlace } from '../src/shared/careers';
import { unoccupiedDestination } from '../src/game/residentCollision';
import { checkout, grantCart, quoteCart } from './market';
import { pausePetRoutine } from './pets';
import { RECIPES, TAKEOUT } from '../src/shared/food';
import { MINUTES_PER_DAY } from '../src/shared/life';
import { discardReadyFood, moveReadyFoodToFridge, moveReadyFoodToTable, readyFoodName } from '../src/shared/readyFood';
import { storageCanFit } from '../src/shared/storageSpace';
import { marketProduct } from '../src/shared/market';

type Result = { ok: false; reason: string } |
  { ok: true; state: GameState; message: string; path?: Point[]; station?: string };
const fail = (reason: string): Result => ({ ok: false, reason });
const done = (state: GameState, message: string): Result => {
  state.revision++;
  return { ok: true, state, message };
};
const ROLES = ['vlad', 'alina'] as const;

export function validWorld(value: unknown): value is WorldState {
  if (!value || typeof value !== 'object') return false;
  const w = value as Partial<WorldState>;
  const count = (n: unknown) => typeof n === 'number' && Number.isSafeInteger(n) && n >= 0;
  return (w.districtLayout === undefined || w.districtLayout === 1 || w.districtLayout === 2) && !!w.places && !!w.sequence && !!w.bags && ROLES.every(role =>
    (isPlace(w.places![role]) || w.districtLayout!==2 && String(w.places![role])==='street') && count(w.sequence![role]) && count(w.bags![role])) &&
    // tableBags was added after existing 0.4 saves were created.
    (w.tableBags === undefined || count(w.tableBags)) &&
    (w.dogWalker === null || w.dogWalker === 'vlad' || w.dogWalker === 'alina') &&
    Array.isArray(w.deliveries) && w.deliveries.length <= 12 &&
    new Set(w.deliveries.map(d => d?.id)).size === w.deliveries.length &&
    w.deliveries.every(d => d && typeof d.id === 'string' && /^D-(vlad|alina)-\d+$/.test(d.id) &&
      ROLES.includes(d.role) && count(d.cost) && count(d.readyAt) && quoteCart(d.lines).ok) &&
    !!w.cafe && !Array.isArray(w.cafe) && typeof w.cafe === 'object' &&
    Object.entries(w.cafe).every(([role, order]) => ROLES.includes(role as CharacterId) && order &&
      isCafeItem(order.item) && count(order.readyAt) && typeof order.pickedUp === 'boolean');
}

function at(source: GameState, role: CharacterId, station: Station | undefined): boolean {
  if (!station) return false;
  const { x, z } = approachFor(station, role);
  // The shared checkout has a wide counter; two people need to stand next to
  // each other instead of occupying exactly the same interaction tile.
  const reach = station.id === 'checkout' ? 0.94 : 0.64;
  return Math.hypot(x - source.characters[role].x, z - source.characters[role].z) < reach;
}

export function setDogParkPosition(state: GameState): void {
  const walker = state.world.dogWalker;
  const dog = state.pets.verdell;
  if (!walker) { delete dog.parkPosition; return; }
  const { x, z } = state.characters[walker];
  dog.parkPosition = nearestClearPoint({ x: x - .55, z: z + .24 }, placeObstacles('park'), WORLD_FLOOR) ?? { x, z };
}

export const worldMessages = new Set([
  'travel', 'walk', 'approach', 'store_pay', 'delivery_order', 'delivery_claim',
  'ready_food_move', 'ready_food_serve', 'ready_food_discard', 'cafe_order', 'cafe_pickup', 'dog_leash',
]);

export function applyWorld(source: GameState, role: CharacterId, command: Record<string, unknown>, neighborOnline = false): Result {
  if (source.activeShifts[role]) return fail('Сначала закончи смену');
  const career = source.careers.residents[role].shift;
  if (career && (command.type !== 'walk' || career.task && career.task.phase !== 'new')) return fail('Сейчас выполняется рабочее поручение');
  const place = source.world.places[role];
  const neighbor = role === 'vlad' ? 'alina' : 'vlad';
  const neighborAt = (location: typeof place) => neighborOnline && source.world.places[neighbor] === location &&
    !source.activeShifts[neighbor] ? source.characters[neighbor] : undefined;

  if (command.type === 'travel') {
    if (isCareerPlace(command.place)) return fail('Рабочая локация открывается только на смене');
    if (!isPlace(command.place) || command.place === place) return fail('Выбери другое доступное место');
    if (command.via !== undefined) {
      const door = stationById(place, command.via);
      if (door?.action.kind !== 'door' || door.action.destination !== command.place || !at(source, role, door))
        return fail('Сначала подойди к выходу');
    }
    if (command.dog === true && (place !== 'home' || command.place !== 'park' || source.world.dogWalker))
      return fail('Верделла можно взять из дома, если он свободен');
    const next = structuredClone(source);
    next.world.places[role] = command.place;
    if (command.dog === true) {
      pausePetRoutine(next, 'verdell', clockMinutes(next.clock));
      next.world.dogWalker = role;
    }
    const spawnPoint = command.via !== undefined || command.place === 'home'
      ? doorwayArrival(command.place,place,role) : spawn(command.place, role);
    const other = neighborAt(command.place);
    const arrival = other
      ? unoccupiedDestination(spawnPoint, other, placeObstacles(command.place,source.furnishing), floorFor(command.place))
      : spawnPoint;
    if (!arrival) return fail('Вход занят вторым игроком');
    Object.assign(next.characters[role], arrival, { pose: 'idle' });
    if (next.world.dogWalker === role && command.place !== 'park') next.world.dogWalker = null;
    if (command.dog === true || source.world.dogWalker === role) setDogParkPosition(next);
    return done(next, PLACES[command.place].name);
  }

  if (command.type === 'walk' || command.type === 'approach') {
    if (command.place !== place) return fail('Ты уже в другой локации');
    const station = command.type === 'approach' ? stationById(place, command.station) : undefined;
    if (command.type === 'approach' && !station) return fail('Здесь нет такого объекта');
    if (!station && (typeof command.x !== 'number' || typeof command.z !== 'number' ||
      !Number.isFinite(command.x) || !Number.isFinite(command.z))) return fail('Сюда нельзя пройти');
    const requested = station ? approachFor(station, role)
      : { x: Math.round(Number(command.x) * 100) / 100, z: Math.round(Number(command.z) * 100) / 100 };
    const obstacles = placeObstacles(place,source.furnishing);
    const floor = floorFor(place);
    const other = neighborAt(place);
    const body = other && Math.hypot(other.x-requested.x,other.z-requested.z)<1.05 ? other
      : place === 'home' && !inHomeGrounds(requested) ? NEIGHBORS.map((_,index)=>neighborPose(index,clockMinutes(source.clock)))
        .filter(person=>person.visible && person.opacity>.35).map(districtPoint)
        .find(person=>Math.hypot(person.x-requested.x,person.z-requested.z)<.82)
        : undefined;
    const target = body && !station && pointIsClear(requested, obstacles, floor)
      ? unoccupiedDestination(requested, body, obstacles, floor)
      : other && station ? unoccupiedDestination(requested,other,obstacles,floor) : requested;
    const origin = nearestClearPoint(source.characters[role], obstacles, floor);
    const path = origin && target && pointIsClear(target, obstacles, floor)
      ? findRoute(origin, target, obstacles, floor) : null;
    if (!path || !target) return fail('Сюда нельзя пройти');
    const next = structuredClone(source);
    Object.assign(next.characters[role], target, { pose: 'idle' });
    if(place==='home'&&inHomeGrounds(target)){
      // Checkout has already credited the purchases. Reaching home only puts the carrier away.
      next.world.bags[role]=0;
      next.world.tableBags=0;
    }
    if (career) delete next.careers.residents[role].shift!.station;
    if (next.world.dogWalker === role) setDogParkPosition(next);
    next.revision++;
    return { ok: true, state: next, message: '', path, station: station?.id };
  }

  if (command.type === 'store_pay' || command.type === 'delivery_order' || command.type === 'cafe_order') {
    if (command.sequence !== source.world.sequence[role]) return fail('Эта операция уже обработана. Проверь заказ');
    if (command.type === 'store_pay') {
      if (place !== 'market' || !at(source, role, stationById('market', 'checkout')))
        return fail('Оплата доступна у кассы супермаркета');
      const result = checkout(source, role, command.lines);
      if (!result.ok) return result;
      result.state.world.sequence[role]++;
      result.state.world.bags[role]++;
      return result;
    }

    const next = structuredClone(source);
    const now = clockMinutes(source.clock);
    if (command.type === 'delivery_order') {
      if (!serviceAvailable(source.billing, 'mobile', now)) return fail(SERVICE_MESSAGES.mobile);
      if (source.world.deliveries.length >= 12) return fail('Сначала забери заказы у двери');
      const quote = quoteCart(command.lines);
      if (!quote.ok) return quote;
      const cost = quote.cost + DELIVERY_FEE;
      if (source.money < cost) return fail('Недостаточно денег с учётом доставки');
      // The buyer can decide at the door whether takeaway goes in the fridge
      // or on the table. Neither storage choice may bypass the shared limits.
      const fitsFridge = grantCart(source, quote.lines, 'fridge');
      const fitsTable = grantCart(source, quote.lines, 'table');
      if (!fitsFridge.ok && !fitsTable.ok) return fail(fitsFridge.reason + '; ' + fitsTable.reason);
      const id = 'D-' + role + '-' + next.world.sequence[role]++;
      next.money -= cost;
      next.world.deliveries.push({ id, role, lines: quote.lines, cost, readyAt: now + DELIVERY_MINUTES });
      addLedger(next, role, 'expense', 'groceries', cost,
        'Доставка ' + id + ' · ' + quote.units + ' уп. · товары ' + quote.cost + ' ₽ + доставка ' + DELIVERY_FEE + ' ₽');
      return done(next, 'Заказ оплачен: товары ' + quote.cost + ' ₽ + доставка ' + DELIVERY_FEE +
        ' ₽ = ' + cost + ' ₽. Курьер будет через ' + DELIVERY_MINUTES + ' игровых мин.');
    }
    if (place !== 'cafe' || !at(source, role, stationById('cafe', 'terminal'))) return fail('Подойди к терминалу кафе');
    if (!isCafeItem(command.item)) return fail('Такого блюда нет в меню');
    if (source.world.cafe[role]) return fail('Сначала забери и закончи предыдущий заказ');
    const item = CAFE_MENU[command.item];
    if (source.money < item.price) return fail('Недостаточно денег');
    next.money -= item.price;
    next.world.sequence[role]++;
    next.world.cafe[role] = { item: command.item, readyAt: now + CAFE_MINUTES, pickedUp: false };
    addLedger(next, role, 'expense', 'takeout', item.price, 'Кафе · ' + item.name);
    return done(next, 'Заказ оплачен. Забери его на стойке выдачи');
  }

  if (command.type === 'delivery_claim') {
    if (place !== 'home' || !at(source, role, stationById('home', 'parcel'))) return fail('Подойди к двери дома');
    const order = source.world.deliveries.find(d => d.id === command.id);
    if (!order || order.readyAt > clockMinutes(source.clock)) return fail('Заказ ещё не доступен или уже получен');
    const storage = command.storage ?? 'fridge';
    if (storage !== 'fridge' && storage !== 'table') return fail('Выбери, куда положить готовую еду');
    // Takeaway left at the doorstep for >= 2 game days is spoiled before
    // collection. Even choosing the fridge cannot revive it.
    const now = clockMinutes(source.clock);
    let spoiled = 0;
    const freshLines = order.lines.filter(line => {
      const item = marketProduct(line.id);
      if (item?.kind !== 'takeout' || now < order.readyAt + 2 * MINUTES_PER_DAY) return true;
      spoiled += item.quantity * line.quantity;
      return false;
    });
    const grant = grantCart(source, freshLines, storage, order.readyAt);
    if (!grant.ok) return fail(grant.reason + '. Оплаченный заказ подождёт у двери');
    grant.state.world.deliveries = grant.state.world.deliveries.filter(d => d.id !== order.id);
    grant.state.world.tableBags = 0; // Goods were placed in fridge/cupboard by grantCart.
    return done(grant.state, 'Заказ получен. Продукты убраны в холодильник и кухонные шкафчики' +
      (freshLines.some(line => marketProduct(line.id)?.kind === 'takeout')
        ? storage === 'fridge' ? ', готовая еда убрана в холодильник' : ', готовая еда оставлена на столе' : '') +
      (spoiled ? '. Испортившихся порций выброшено: ' + spoiled : ''));
  }

  if (command.type === 'ready_food_move' || command.type === 'ready_food_serve' ||
      command.type === 'ready_food_discard') {
    if(place!=='home')return fail('Это действие доступно только дома');
    // "Store" is clicked on the plate at the table. "Serve" and
    // discarding refrigerated food require using the actual fridge.
    if((command.type==='ready_food_serve'||command.type==='ready_food_discard'&&command.storage==='fridge')&&
      !at(source,role,stationById('home','fridge')))
      return fail('Сначала подойди к холодильнику');
    const kind = command.kind;
    const item = command.item;
    if ((kind !== 'meal' && kind !== 'takeout') || typeof item !== 'string' ||
      !(kind === 'meal' ? Object.hasOwn(RECIPES, item) : Object.hasOwn(TAKEOUT, item)))
      return fail('Нет такого готового блюда');
    const next = structuredClone(source);
    if (command.type === 'ready_food_move') {
      if (!moveReadyFoodToFridge(next, kind, item)) return fail('На столе больше нет свежих порций этого блюда');
      const fit = storageCanFit(source, next);
      if (!fit.ok) return fail(fit.reason);
      return done(next, '🧊 Убрана 1 порция в холодильник: ' + readyFoodName(kind, item));
    }
    if(command.type==='ready_food_serve') {
      if(!moveReadyFoodToTable(next,kind,item))return fail('В холодильнике нет свежих порций');
      const fit=storageCanFit(source,next);
      if(!fit.ok)return fail(fit.reason);
      return done(next,'🍽️ На стол подана 1 порция: '+readyFoodName(kind,item));
    }
    const storage = command.storage;
    if (storage !== 'fridge' && storage !== 'table') return fail('Неизвестное место хранения');
    if (!discardReadyFood(next, kind, item, storage)) return fail('Свежих порций уже нет');
    return done(next, 'Выброшена 1 порция: ' + readyFoodName(kind, item));
  }

  if (command.type === 'cafe_pickup') {
    if (place !== 'cafe' || !at(source, role, stationById('cafe', 'pickup'))) return fail('Подойди к выдаче');
    const order = source.world.cafe[role];
    if (!order || order.pickedUp || order.readyAt > clockMinutes(source.clock)) return fail('Нет готового заказа для выдачи');
    const next = structuredClone(source);
    next.world.cafe[role]!.pickedUp = true;
    return done(next, 'Заказ получен. Выбери свободное место за столиком');
  }

  if (command.type === 'dog_leash') {
    if (place !== 'park' || !at(source, role, stationById('park', 'park-dog'))) return fail('Подойди к площадке в парке');
    if (source.world.dogWalker && source.world.dogWalker !== role) return fail('Верделл уже гуляет со вторым игроком');
    const next = structuredClone(source);
    next.world.dogWalker = source.world.dogWalker ? null : role;
    if (next.world.dogWalker) pausePetRoutine(next, 'verdell', clockMinutes(next.clock));
    setDogParkPosition(next);
    return done(next, next.world.dogWalker ? 'Верделл пришёл на прогулку' : 'Верделл вернулся домой');
  }

  return fail('Неизвестное действие');
}

export const localLabels: Record<LocalActivity, string> = {
  rest: 'Отдохнуть на скамье', exercise: 'Зарядка на свежем воздухе', dine: 'Посидеть за столиком',
  dog: 'Поиграть с Верделлом', unpack: 'Разобрать покупки',
};

export function localActivity(source: GameState, role: CharacterId, action: LocalActivity, id: string): Result {
  const place = source.world.places[role];
  const station = stationById(place, id);
  if (station?.action.kind !== action || !at(source, role, station)) return fail('Сначала подойди к подходящему объекту');
  if (action === 'dog' && !source.world.dogWalker) return fail('Сначала возьми Верделла на прогулку');
  if (action === 'unpack' && !source.world.tableBags) return fail('Нет покупок для распаковки');
  const next = structuredClone(source);
  const resident = next.characters[role];
  const bump = (key: 'mood' | 'comfort' | 'fun' | 'hunger' | 'energy', count: number) => {
    resident[key] = Math.max(0, Math.min(100, resident[key] + count));
  };
  resident.pose = action === 'rest' || action === 'dine' ? 'sit' : 'idle';
  if (action === 'dine') {
    const order = next.world.cafe[role];
    if (order?.pickedUp) {
      const meal = CAFE_MENU[order.item];
      bump('hunger', meal.hunger); bump('energy', meal.energy); bump('mood', meal.mood);
      delete next.world.cafe[role];
    } else { bump('comfort', 8); bump('mood', 3); }
  } else if (action === 'rest') {
    bump('comfort', 14); bump('energy', 5);
  } else if (action === 'exercise') {
    bump('fun', 13); bump('mood', 6); bump('energy', -4);
  } else if (action === 'dog') {
    const dog = next.pets.verdell;
    dog.happiness = Math.min(100, dog.happiness + 7);
    dog.bond = Math.min(100, dog.bond + 4);
    bump('mood', 4);
  } else {
    next.world.tableBags = 0;
    bump('comfort', 3);
  }
  return done(next, localLabels[action] + ' · готово');
}
