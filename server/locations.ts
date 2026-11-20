import { serviceAvailable, SERVICE_MESSAGES } from '../src/shared/services';
import {
  CAFE_MENU, CAFE_MINUTES, DELIVERY_FEE, DELIVERY_MINUTES, PLACES, WORLD_FLOOR, floorFor,
  approachFor, clockMinutes, isCafeItem, isPlace, placeObstacles, spawn, stationById,
  type LocalActivity, type Point, type Station, type WorldState,
} from '../src/shared/locations';
import type { CharacterId, GameState } from '../src/shared/protocol';
import { addLedger } from '../src/shared/economy';
import { findRoute, nearestClearPoint, pointIsClear } from '../src/game/navigation';
import { checkout, grantCart, quoteCart } from './market';
import { pausePetRoutine } from './pets';

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
  return !!w.places && !!w.sequence && !!w.bags && ROLES.every(role =>
    isPlace(w.places![role]) && count(w.sequence![role]) && count(w.bags![role])) &&
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
  return Math.hypot(x - source.characters[role].x, z - source.characters[role].z) < 0.64;
}

export function setDogParkPosition(state: GameState): void {
  const walker = state.world.dogWalker;
  const dog = state.pets.verdell;
  if (!walker) { delete dog.parkPosition; return; }
  const { x, z } = state.characters[walker];
  dog.parkPosition = nearestClearPoint({ x: x - .55, z: z + .24 }, placeObstacles('park'), WORLD_FLOOR) ?? { x, z };
}

export const worldMessages = new Set([
  'travel', 'walk', 'approach', 'store_pay', 'delivery_order', 'delivery_claim', 'cafe_order', 'cafe_pickup', 'dog_leash',
]);

export function applyWorld(source: GameState, role: CharacterId, command: Record<string, unknown>): Result {
  if (source.activeShifts[role]) return fail('Сначала закончи смену');
  const place = source.world.places[role];

  if (command.type === 'travel') {
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
    if (command.place === 'home' && next.world.bags[role] > 0) {
      next.world.tableBags += next.world.bags[role];
      next.world.bags[role] = 0;
    }
    if (command.dog === true) {
      pausePetRoutine(next, 'verdell', clockMinutes(next.clock));
      next.world.dogWalker = role;
    }
    Object.assign(next.characters[role], spawn(command.place, role), { pose: 'idle' });
    if (next.world.dogWalker === role && command.place !== 'park') next.world.dogWalker = null;
    if (command.dog === true || source.world.dogWalker === role) setDogParkPosition(next);
    return done(next, command.place === 'home' && source.world.bags[role] > 0
      ? 'Дом · Покупки оставлены на обеденном столе' : PLACES[command.place].name);
  }

  if (command.type === 'walk' || command.type === 'approach') {
    if (command.place !== place) return fail('Ты уже в другой локации');
    const station = command.type === 'approach' ? stationById(place, command.station) : undefined;
    if (command.type === 'approach' && !station) return fail('Здесь нет такого объекта');
    if (!station && (typeof command.x !== 'number' || typeof command.z !== 'number' ||
      !Number.isFinite(command.x) || !Number.isFinite(command.z))) return fail('Сюда нельзя пройти');
    const target = station ? approachFor(station, role)
      : { x: Math.round(Number(command.x) * 100) / 100, z: Math.round(Number(command.z) * 100) / 100 };
    const obstacles = placeObstacles(place);
    const floor = floorFor(place);
    const origin = nearestClearPoint(source.characters[role], obstacles, floor);
    const path = origin && pointIsClear(target, obstacles, floor)
      ? findRoute(origin, target, obstacles, floor) : null;
    if (!path) return fail('Сюда нельзя пройти');
    const next = structuredClone(source);
    Object.assign(next.characters[role], target, { pose: 'idle' });
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
      const fits = grantCart(source, quote.lines);
      if (!fits.ok) return fits;
      const id = 'D-' + role + '-' + next.world.sequence[role]++;
      next.money -= cost;
      next.world.deliveries.push({ id, role, lines: quote.lines, cost, readyAt: now + DELIVERY_MINUTES });
      addLedger(next, role, 'expense', 'groceries', cost, 'Доставка ' + id + ' · ' + quote.units + ' уп.');
      return done(next, 'Заказ оплачен. Доставка к дому через ' + DELIVERY_MINUTES + ' игровых мин.');
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
    const grant = grantCart(source, order.lines);
    if (!grant.ok) return fail(grant.reason + '. Оплаченный заказ подождёт у двери');
    grant.state.world.deliveries = grant.state.world.deliveries.filter(d => d.id !== order.id);
    grant.state.world.tableBags++;
    return done(grant.state, 'Заказ получен. Пакет на обеденном столе, товары уже в общих запасах');
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
