import {VET_SERVICES,isVetAction,vetAvailable,completeVetService,isHealthPet,setVetBooking,takeVetMedicine,familyCare,CLINIC_SERVICES,isClinicAction,clinicAvailable,completeClinicService,medicinePrice,healthBookingSlots,setHealthBooking,takeGameMedicine} from '../src/shared/health';
import {FITNESS_PASSES,FITNESS_BAR,fitnessBarItem,fitnessCareRole,fitnessCareAction,fitnessExercise,emptyFitnessStats,fitnessAccess,fitnessProfile,fitnessBookingSlots,initialFitness,validFitness,SAUNA_PRICE,type FitnessPass} from '../src/shared/fitness';
import {skillRank} from '../src/shared/education';
import { PURCHASABLE_FURNITURE } from '../src/shared/furniture';
import { toyProduct,toyOwned } from '../src/shared/petToys';
import { petFoodProduct } from '../src/shared/petShop';
import { PET_FOOD_MAX_REFILLS } from '../src/shared/pets';
import { cookingQuality, foodQualityEffect, qualityLabel } from '../src/shared/foodQuality';
import { ELECTRONICS,initialElectronics,validElectronics,isElectronicsId,installedElectronics } from '../src/shared/electronics';
import { defaultWardrobe, isPreviewLook, outfitPrice, validWardrobe, PREVIEW_LOOKS } from '../src/shared/previewWardrobe';
import { courierVisit, COURIER_NAME, COURIER_INDEX } from '../src/shared/courier';
import { districtPoint, inHomeGrounds } from '../src/shared/district';
import { NEIGHBORS, neighborPose } from '../src/shared/neighbors';
import { serviceAvailable, SERVICE_MESSAGES } from '../src/shared/services';
import {
  CAFE_MENU, CAFE_MINUTES, DELIVERY_FEE, DELIVERY_MINUTES, PLACES, floorFor,
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
import { CAMP_RECIPES, campIngredients, isCampRecipe, isParkDogAction } from '../src/shared/park';
import { PICNIC_BASKET_PRICE, PICNIC_CAPACITY, validPicnicBasket, cleanPicnic, picnicName } from '../src/shared/picnic';
import { consumeReadyFood, readyFoodShelfDays, tableShelfMinutes, reconcileReadyFood, expireReadyFood } from '../src/shared/readyFood';
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
  return (w.districtLayout === undefined || w.districtLayout === 1 || w.districtLayout === 2 || w.districtLayout === 3 || w.districtLayout === 4) && !!w.places && !!w.sequence && !!w.bags && ROLES.every(role =>
    (isPlace(w.places![role]) || (w.districtLayout===undefined || w.districtLayout===1) && String(w.places![role])==='street') && count(w.sequence![role]) && count(w.bags![role])) &&
    // tableBags was added after existing 0.4 saves were created.
    (w.tableBags === undefined || count(w.tableBags)) &&
    (w.dogWalker === null || w.dogWalker === 'vlad' || w.dogWalker === 'alina') &&
    (w.courierDepartAt===undefined||count(w.courierDepartAt)) &&
    (w.carDriver===undefined||(ROLES.includes(w.carDriver)&&['market','cafe','park','clothing','electronics','petshop','industrial','fitness','clinic','work-clinic'].includes(w.places![w.carDriver]))) &&
    (w.vetVisit===undefined?!(w.carDriver&&w.places![w.carDriver]==='work-clinic'):!!w.vetVisit&&ROLES.includes(w.vetVisit.owner)&&isHealthPet(w.vetVisit.pet)&&w.carDriver===w.vetVisit.owner&&w.places![w.vetVisit.owner]==='work-clinic'&&!(w.vetVisit.pet==='verdell'&&w.dogWalker)) &&
    (w.fitness===undefined||validFitness(w.fitness)) &&
    (w.electronics===undefined||validElectronics(w.electronics)) &&
    (w.wardrobe===undefined||validWardrobe(w.wardrobe)) &&
    (w.picnic===undefined||validPicnicBasket(w.picnic)) &&
    (w.campLitUntil===undefined||count(w.campLitUntil)) &&
    (w.parkDog===undefined||!!w.parkDog&&count(w.parkDog.minutes)&&count(w.parkDog.toilets)&&w.parkDog.toilets<=2&&(w.parkDog.toiletUntil===undefined||count(w.parkDog.toiletUntil))) &&
    (w.campKit===undefined||!!w.campKit&&Object.entries(w.campKit).every(([role,k])=>ROLES.includes(role as CharacterId)&&!!k&&count(k.fuel)&&k.fuel<=3&&!!k.recipes&&Object.entries(k.recipes).every(([id,n])=>isCampRecipe(id)&&count(n)&&n<=3))) &&
    Array.isArray(w.deliveries) && w.deliveries.length <= 12 &&
    new Set(w.deliveries.map(d => d?.id)).size === w.deliveries.length &&
    w.deliveries.every(d => d && typeof d.id === 'string' && /^D-(vlad|alina)-\d+$/.test(d.id) &&
      ROLES.includes(d.role) && count(d.cost) && count(d.readyAt) && (d.handedAt===undefined||count(d.handedAt)&&d.handedAt>=d.readyAt) && quoteCart(d.lines).ok) &&
    !!w.cafe && !Array.isArray(w.cafe) && typeof w.cafe === 'object' &&
    Object.entries(w.cafe).every(([role, order]) => ROLES.includes(role as CharacterId) && order &&
      isCafeItem(order.item) && count(order.readyAt) && typeof order.pickedUp === 'boolean' && (order.table===undefined || (stationById('cafe',order.table)?.action.kind==='dine' && count(order.orderedAt) && order.orderedAt!<=order.readyAt)));
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
  dog.parkPosition = nearestClearPoint({ x: x - .55, z: z + .24 }, placeObstacles(state.world.places[walker]), floorFor(state.world.places[walker])) ?? { x, z };
}

import {SPEAKER_MODELS,isSpeakerSku} from '../src/shared/speakerCatalog';
import {VACUUM_MODELS,isVacuumSku} from '../src/shared/vacuumCatalog';
import {controlVacuum} from '../src/shared/vacuum';
export function fitnessTogetherTrip(source:GameState,driver:CharacterId):Result{
  if(source.world.carDriver||ROLES.some(r=>source.world.places[r]!=='home'||source.activeShifts[r]||source.careers.residents[r].shift||source.world.dogWalker===r))return fail('Для совместной поездки оба должны быть дома и свободны');
  const next=structuredClone(source);next.world.carDriver=driver;
  for(const r of ROLES){next.world.places[r]='fitness';Object.assign(next.characters[r],doorwayArrival('fitness','district',r),{pose:'idle'});const p=(next.world.fitness??=initialFitness())[r],now=clockMinutes(next.clock);if(p.ticket&&p.until<=now){delete p.ticket;p.visit=true;}if(p.booking!==undefined&&Math.abs(p.booking-now)<=60)delete p.booking;}
  return done(next,'Приехали вместе в PULSE Fitness');
}
export const worldMessages = new Set(['vet_book','vet_cancel','vet_medicine','health_care','health_book','health_cancel','health_medicine','fitness_pass','fitness_book','fitness_cancel','speaker_buy','vacuum_buy','vacuum_control',
  'pet_food_buy','pet_toy_buy','pet_furniture_buy','electronics_buy','clothing_buy','clothing_wear','travel', 'car_travel', 'walk', 'approach', 'store_pay', 'delivery_order', 'delivery_handoff', 'delivery_claim',
  'camp_pack', 'picnic_buy', 'picnic_pack', 'picnic_unpack',
  'ready_food_move', 'ready_food_serve', 'ready_food_discard', 'cafe_order', 'cafe_pickup', 'cafe_seat', 'dog_leash',
]);

export function applyWorld(source: GameState, role: CharacterId, command: Record<string, unknown>, neighborOnline = false): Result {
  if (source.activeShifts[role]) return fail('Сначала закончи смену');
  const career = source.careers.residents[role].shift;
  if (career && (command.type !== 'walk' || career.task && career.task.phase !== 'new')) return fail('Сейчас выполняется рабочее поручение');
  const place = source.world.places[role];
  const neighbor = role === 'vlad' ? 'alina' : 'vlad';
  const neighborAt = (location: typeof place) => neighborOnline && source.world.places[neighbor] === location &&
    !source.activeShifts[neighbor] ? source.characters[neighbor] : undefined;

  if(command.type==='vet_book'||command.type==='vet_cancel'||command.type==='vet_medicine'){
    if(!isHealthPet(command.pet))return fail('Выбери питомца');
    const pet=command.pet,next=structuredClone(source);
    if(command.type==='vet_book'){
      if(typeof command.at!=='number'||!healthBookingSlots(clockMinutes(source.clock)).includes(command.at))return fail('Выбери время приёма');
      setVetBooking(next,pet,command.at);
    }else if(command.type==='vet_cancel')setVetBooking(next,pet);
    else {
      if(place!=='home'||source.world.vetVisit?.pet===pet||pet==='verdell'&&source.world.dogWalker)return fail('Лечение питомца доступно дома');
      if(!takeVetMedicine(next,pet))return fail('Нет назначенного лекарства');
    }
    return done(next,command.type==='vet_book'?'Запись в ветеринарку сохранена':command.type==='vet_cancel'?'Запись отменена':'Лекарство дано питомцу');
  }
  if(command.type==='health_care'){
    if(command.care!=='tea'&&command.care!=='support')return fail('Неизвестная забота');
    if(place!=='home'||!neighborOnline||source.world.places[neighbor]!=='home'||source.activeShifts[neighbor]||source.careers.residents[neighbor].shift||Math.hypot(source.characters[role].x-source.characters[neighbor].x,source.characters[role].z-source.characters[neighbor].z)>2)return fail('Подойди к заболевшему партнёру дома');
    const next=structuredClone(source);
    if(!familyCare(next,role,command.care))return fail('Забота уже оказана недавно, нет чая или партнёр здоров');
    return done(next,command.care==='tea'?'Принесли чай заболевшему партнёру':'Поддержали заболевшего партнёра');
  }
  if(command.type==='health_book'||command.type==='health_cancel'){
    const next=structuredClone(source);
    if(command.type==='health_book'){
      if(typeof command.at!=='number'||!healthBookingSlots(clockMinutes(source.clock)).includes(command.at))return fail('Выбери доступное время приёма');
      setHealthBooking(next,role,command.at);
    }else setHealthBooking(next,role);
    return done(next,command.type==='health_book'?'Запись к терапевту сохранена':'Запись отменена');
  }
  if(command.type==='health_medicine'){
    if(place!=='home'&&place!=='clinic')return fail('Прими лекарство дома или в клинике');
    const next=structuredClone(source);
    if(!takeGameMedicine(next,role))return fail('Нет назначенного лекарства');
    return done(next,'Лекарство принято · восстановление ускорено');
  }
  if(command.type==='fitness_pass'){
    if(typeof command.pass!=='string'||!Object.hasOwn(FITNESS_PASSES,command.pass))return fail('Неизвестный абонемент');
    const pass=command.pass as FitnessPass,product=FITNESS_PASSES[pass],now=clockMinutes(source.clock);
    if(source.money<product.price)return fail('Недостаточно денег');
    if(pass==='single'&&(fitnessAccess(source,role)||fitnessProfile(source,role).ticket))return fail('Посещение уже оплачено');
    const next=structuredClone(source),profiles=next.world.fitness??=initialFitness();
    for(const owner of pass==='family'?ROLES:[role]){
      if(pass==='single'){if(place==='fitness')profiles[owner].visit=true;else profiles[owner].ticket=true;}
      else profiles[owner].until=Math.max(now,profiles[owner].until)+product.days*1440;
    }
    next.money-=product.price;addLedger(next,role,'expense','services',product.price,'PULSE · '+product.name);
    return done(next,product.name+' оплачен');
  }
  if(command.type==='fitness_book'||command.type==='fitness_cancel'){
    const next=structuredClone(source),profile=(next.world.fitness??=initialFitness())[role];
    if(command.type==='fitness_cancel'){delete profile.booking;return done(next,'Запись отменена');}
    if(typeof command.at!=='number'||!fitnessBookingSlots(clockMinutes(source.clock)).includes(command.at))return fail('Выбери доступное время');
    profile.booking=command.at;return done(next,'Запись в PULSE Fitness сохранена');
  }
  if(command.type==='pet_toy_buy'){
    if(place!=='petshop'||!at(source,role,stationById('petshop','pet-cash')))return fail('Подойди к кассе зоомагазина');
    const p=toyProduct(command.product);if(!p)return fail('Неизвестная игрушка');
    if(toyOwned(source.pets[p.pet],p.id))return fail('Такая игрушка уже есть');
    if(source.money<p.price)return fail('Недостаточно денег');
    const next=structuredClone(source);next.money-=p.price;(next.pets[p.pet].ownedToys??=[]).push(p.id);
    addLedger(next,role,'expense','pets',p.price,p.name);return done(next,'Куплено: '+p.name+' · игрушка появится дома');
  }
  if(command.type==='pet_furniture_buy'){
    if(place!=='petshop'||!at(source,role,stationById('petshop','pet-cash')))return fail('Подойди к кассе зоомагазина');
    const item=PURCHASABLE_FURNITURE.find(p=>p.category==='pets'&&p.id===command.sku);
    if(!item)return fail('Такого товара нет');
    if(source.money<item.price)return fail('Недостаточно денег');
    const f=source.furnishing;if(f.nextId>=1000000||f.placed.length+f.stored.length+f.orders.length>=10000)return fail('Инвентарь заполнен');
    const next=structuredClone(source);next.money-=item.price;next.furnishing.stored.push({id:next.furnishing.nextId++,sku:item.id,finish:'sage'});
    addLedger(next,role,'expense','pets',item.price,item.name);return done(next,'Куплено: '+item.name+' · можно установить дома');
  }
  if(command.type==='pet_food_buy'){
    if(place!=='petshop'||!at(source,role,stationById('petshop','pet-cash')))return fail('Подойди к кассе зоомагазина');
    const product=petFoodProduct(command.product);if(!product)return fail('Неизвестный корм');
    if(source.money<product.price)return fail('Недостаточно денег');
    if(source.petFood[product.pet]+product.refills>PET_FOOD_MAX_REFILLS)return fail('Запас корма заполнен');
    const next=structuredClone(source);next.money-=product.price;next.petFood[product.pet]+=product.refills;
    const queue=next.pets[product.pet].foodQueue??=[];for(let i=0;i<product.refills;i++)queue.push(product.id);
    addLedger(next,role,'expense','pets',product.price,product.name);return done(next,'Куплено: '+product.name);
  }
  if(command.type==='vacuum_control'){
    if(!['start','stop','return','auto'].includes(String(command.action)))return fail('Неизвестное действие');
    const next=structuredClone(source),error=controlVacuum(next,command as import('../src/shared/vacuum').VacuumCommand);
    return error?fail(error):done(next,'Настройки робота-пылесоса обновлены');
  }
  if(command.type==='speaker_buy'){
    if(place!=='electronics'||!at(source,role,stationById('electronics','tech-cash')))return fail('Подойди к кассе магазина техники');
    if(!isSpeakerSku(command.sku))return fail('Неизвестная колонка');
    const m=SPEAKER_MODELS[command.sku],f=source.furnishing;
    if([...f.placed,...f.stored,...f.orders].filter(p=>isSpeakerSku(p.sku)).length>=6)return fail('Доступно до шести колонок на семью');
    if(source.money<m.price)return fail('Недостаточно денег');
    if(f.nextId>=1000000||f.placed.length+f.stored.length+f.orders.length>=10000)return fail('Склад заполнен');
    const next=structuredClone(source);next.money-=m.price;next.furnishing.stored.push({id:next.furnishing.nextId++,sku:command.sku,finish:'ivory'});
    addLedger(next,role,'expense','electronics',m.price,m.name);return done(next,'Куплено: '+m.name+' — установи колонку дома');
  }
  if(command.type==='vacuum_buy'){
    if(place!=='electronics'||!at(source,role,stationById('electronics','tech-cash')))return fail('Подойди к кассе магазина техники');
    if(!isVacuumSku(command.sku))return fail('Неизвестная модель');
    const m=VACUUM_MODELS[command.sku],f=source.furnishing;
    if([...f.placed,...f.stored,...f.orders].some(p=>isVacuumSku(p.sku)))return fail('Сначала продай предыдущий робот-пылесос');
    if(source.money<m.price)return fail('Недостаточно денег');
    if(f.nextId>=1000000||f.placed.length+f.stored.length+f.orders.length>=10000)return fail('Склад заполнен');
    const next=structuredClone(source);next.money-=m.price;next.furnishing.stored.push({id:next.furnishing.nextId++,sku:command.sku,finish:'ivory'});
    addLedger(next,role,'expense','electronics',m.price,m.name);return done(next,'Куплено: '+m.name+' — установи станцию дома');
  }
  if(command.type==='electronics_buy'){
    if(place!=='electronics'||!at(source,role,stationById('electronics','tech-cash')))return fail('Подойди к кассе магазина техники');
    if(!isElectronicsId(command.model))return fail('Неизвестная модель');
    const id=command.model,model=ELECTRONICS[id];
    if(!model.price)return fail('Это штатная техника');
    if(installedElectronics(source,role,model.kind)===id)return fail('Эта модель уже установлена');
    if(source.money<model.price)return fail('Недостаточно денег');
    const next=structuredClone(source),devices=next.world.electronics??=initialElectronics();
    if(model.kind==='phone')devices.phones[role]=id;else devices[model.kind]=id;
    next.money-=model.price;addLedger(next,role,'expense','electronics',model.price,model.name);
    return done(next,'Куплено и установлено: '+model.name);
  }
  if(command.type==='clothing_buy'||command.type==='clothing_wear'){
    const look=command.look;
    if(typeof look!=='string'||!isPreviewLook(role,look))return fail('Такого комплекта нет');
    const next=structuredClone(source);
    const wardrobe=next.world.wardrobe??=defaultWardrobe();
    const personal=wardrobe[role];
    const label=PREVIEW_LOOKS[role].find(([id])=>id===look)![1];
    if(command.type==='clothing_buy'){
      if(place!=='clothing'||!at(source,role,stationById('clothing','clothes-cash')))return fail('Подойди к кассе');
      if(personal.owned.includes(look))return fail('Этот комплект уже есть');
      const price=outfitPrice(look);
      if(source.money<price)return fail('Недостаточно денег');
      next.money-=price;personal.owned.push(look);
      addLedger(next,role,'expense','clothing',price,label);
      return done(next,'Куплено: '+label);
    }
    if(place!=='home'||!['wardrobe-alina','wardrobe-vlad'].some(id=>at(source,role,stationById('home',id))))return fail('Подойди к шкафу дома');
    if(!personal.owned.includes(look))return fail('Сначала купи комплект');
    personal.worn=look;
    return done(next,'Наряд изменён');
  }
  if(command.type==='car_travel'){
    if(place!=='home'||!at(source,role,stationById('home','family-car')))return fail('Сначала подойди к машине');
    if(source.world.carDriver)return fail('Машина сейчас в поездке');
    if(command.place!=='market'&&command.place!=='cafe'&&command.place!=='park'&&command.place!=='clothing'&&command.place!=='electronics'&&command.place!=='petshop'&&command.place!=='industrial'&&command.place!=='fitness'&&command.place!=='clinic'&&command.place!=='work-clinic')return fail('Выбери доступное место');
    if(command.place==='work-clinic'&&(!isHealthPet(command.pet)||command.pet==='verdell'&&source.world.dogWalker))return fail('Выбери свободного питомца для поездки');
    if(command.place!=='work-clinic'&&command.pet!==undefined)return fail('Питомца можно взять только в ветеринарку');
    if(source.world.dogWalker===role)return fail('Сначала отпусти Верделла домой');
    const next=structuredClone(source);
    const destination=command.place;
    const spawnPoint=doorwayArrival(destination,'district',role);
    const other=neighborAt(destination);
    const arrival=other?unoccupiedDestination(spawnPoint,other,placeObstacles(destination,source.furnishing),floorFor(destination)):spawnPoint;
    if(!arrival)return fail('Вход занят вторым игроком');
    next.world.carDriver=role;
    next.world.places[role]=destination;
    if(destination==='work-clinic'&&isHealthPet(command.pet)){pausePetRoutine(next,command.pet,clockMinutes(next.clock));next.world.vetVisit={owner:role,pet:command.pet};}
    if(destination==='fitness'){
      const profile=(next.world.fitness??=initialFitness())[role],now=clockMinutes(next.clock);
      if(profile.ticket&&profile.until<=now){delete profile.ticket;profile.visit=true;}
      if(profile.booking!==undefined&&Math.abs(profile.booking-now)<=60)delete profile.booking;
    }
    Object.assign(next.characters[role],arrival,{pose:'idle'});
    return done(next,'Приехали: '+PLACES[destination].name);
  }
  if (command.type === 'travel') {
    if(source.world.carDriver===role){
      const exit=stationById(place,command.via);
      if(command.place!=='district'||exit?.action.kind!=='door'||exit.action.destination!=='district'||!at(source,role,exit))
        return fail('Выйди через дверь, чтобы вернуться к машине');
      const next=structuredClone(source);
      const parking=approachFor(stationById('home','family-car')!,role);
      const other=neighborAt('home');
      const arrival=other?unoccupiedDestination(parking,other,placeObstacles('home',source.furnishing),floorFor('home')):parking;
      if(!arrival)return fail('Парковка занята');
      delete next.world.carDriver;
      if(next.world.vetVisit?.owner===role)delete next.world.vetVisit;
      if(place==='fitness'&&next.world.fitness)delete next.world.fitness[role].visit;
      next.world.places[role]='home';
      next.world.bags[role]=0;
      next.world.tableBags=0;
      Object.assign(next.characters[role],arrival,{pose:'idle'});
      return done(next,'Вернулись домой на машине');
    }
    if(place==='fitness'){
      const exit=stationById('fitness',command.via);if(command.place!=='district'||exit?.id!=='fitness-exit'||!at(source,role,exit))return fail('Подойди к выходу из клуба');
      const next=structuredClone(source),parking=approachFor(stationById('home','family-car')!,role),other=neighborAt('home');
      const arrival=other?unoccupiedDestination(parking,other,placeObstacles('home',source.furnishing),floorFor('home')):parking;
      if(!arrival)return fail('Парковка занята');if(next.world.fitness)delete next.world.fitness[role].visit;next.world.places[role]='home';Object.assign(next.characters[role],arrival,{pose:'idle'});return done(next,'Вернулись домой');
    }
    if (isCareerPlace(command.place)) return fail('Рабочая локация открывается только на смене');
    if (!isPlace(command.place) || command.place === place) return fail('Выбери другое доступное место');
    if((place==='home'&&command.place==='district'||place==='district'&&command.place==='home')&&command.via===undefined)
      return fail('Сначала подойди к калитке');
    if(command.via!==undefined && ((place==='home'&&command.place!=='district')||(command.place==='home'&&place!=='district')))
      return fail('Путь домой проходит через калитку района');
    if (command.via !== undefined) {
      const door = stationById(place, command.via);
      if (door?.action.kind !== 'door' || door.action.destination !== command.place || !at(source, role, door))
        return fail('Сначала подойди к выходу');
    }
    if(command.dog===true&&source.world.vetVisit?.pet==='verdell')return fail('Верделл сейчас в ветеринарке');
    if (command.dog === true && (place !== 'home' || !['district','park'].includes(command.place) || source.world.dogWalker))
      return fail('Верделла можно взять из дома, если он свободен');
    const next = structuredClone(source);
    if(command.place==='clinic')return fail('До клиники можно доехать на машине');
    if(command.place==='fitness')return fail('До PULSE Fitness можно доехать на машине');
    next.world.places[role] = command.place;
    if (command.dog === true) {
      pausePetRoutine(next, 'verdell', clockMinutes(next.clock));
      next.world.dogWalker = role;
    }
    const spawnPoint = command.via !== undefined || (command.place === 'home'||command.place==='district')
      ? doorwayArrival(command.place,place,role) : spawn(command.place, role);
    const other = neighborAt(command.place);
    const arrival = other
      ? unoccupiedDestination(spawnPoint, other, placeObstacles(command.place,source.furnishing), floorFor(command.place))
      : spawnPoint;
    if (!arrival) return fail('Вход занят вторым игроком');
    Object.assign(next.characters[role], arrival, { pose: 'idle' });
    if(command.place==='park'&&next.world.dogWalker===role&&place!=='park')next.world.parkDog={minutes:0,toilets:0};
    if (next.world.dogWalker === role && command.place !== 'park' && command.place!=='district') next.world.dogWalker = null;
    if(command.place==='home'){next.world.bags[role]=0;next.world.tableBags=0;}
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
    const courier=courierVisit(source.world,clockMinutes(source.clock));
    const body = other && Math.hypot(other.x-requested.x,other.z-requested.z)<1.05 ? other
      : courier?.place===place&&Math.hypot(courier.x-requested.x,courier.z-requested.z)<.82?courier
      : place === 'district' ? NEIGHBORS.flatMap((_,index)=>index===COURIER_INDEX&&courier?[]:[neighborPose(index,clockMinutes(source.clock))])
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

  if(command.type==='cafe_seat'){
    const table=stationById('cafe',command.station);
    if(place!=='cafe'||table?.action.kind!=='dine'||!at(source,role,table))return fail('Сначала подойди к столику');
    const next=structuredClone(source);
    Object.assign(next.characters[role],approachFor(table,role),{pose:'sit'});
    return done(next,'Вы сели за столик');
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
    const table=stationById('cafe',command.table);
    if(place!=='cafe')return fail('Заказ доступен в кафе');
    if(command.table!==undefined){
      if(table?.action.kind!=='dine'||!at(source,role,table)||source.characters[role].pose!=='sit')return fail('Сначала сядь за выбранный столик');
    }else if(!at(source,role,stationById('cafe','terminal')))return fail('Подойди к терминалу кафе');
    if (!isCafeItem(command.item)) return fail('Такого блюда нет в меню');
    if(!table&&!['cappuccino','tea','brioche','pastry'].includes(command.item))return fail('Блюдо можно заказать только за столиком');
    if (source.world.cafe[role]) return fail('Сначала забери и закончи предыдущий заказ');
    const item = CAFE_MENU[command.item];
    if (source.money < item.price) return fail('Недостаточно денег');
    next.money -= item.price;
    next.world.sequence[role]++;
    next.world.cafe[role] = { item: command.item, readyAt: now + (table?item.minutes:CAFE_MINUTES), pickedUp: false, ...(table?{table:table.id,orderedAt:now}:{}) };
    addLedger(next, role, 'expense', 'takeout', item.price, 'Кафе · ' + item.name);
    return done(next, table?'Заказ оплачен. Блюдо подадут к столику':'Заказ оплачен. Забери его на стойке выдачи');
  }

  if(command.type==='delivery_handoff'){
    if(place!=='home'||!at(source,role,stationById('home','courier-handoff')))return fail('Подойди к Максиму у двери');
    const now=clockMinutes(source.clock);
    const order=source.world.deliveries.find(d=>d.id===command.id);
    const courier=courierVisit(source.world,now);
    if(!order||order.handedAt!==undefined||order.readyAt>now||!courier?.waiting)return fail('Курьер ещё в пути или заказ уже передан');
    const next=structuredClone(source);
    next.world.deliveries.find(d=>d.id===order.id)!.handedAt=now;
    next.world.courierDepartAt=now;
    return done(next,COURIER_NAME+': заказ передан. Пакеты у двери — можно разобрать.');
  }

  if (command.type === 'delivery_claim') {
    if (place !== 'home' || !at(source, role, stationById('home', 'parcel'))) return fail('Подойди к двери дома');
    const order = source.world.deliveries.find(d => d.id === command.id);
    if (!order || order.handedAt===undefined || order.readyAt > clockMinutes(source.clock)) return fail('Сначала забери заказ у курьера');
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

  if(command.type==='camp_pack'){
    if(place!=='home'||!at(source,role,stationById('home','fridge'))||!source.world.picnic)return fail('Нужна корзина и холодильник дома');
    const item=command.item;if(item!=='fuel'&&!isCampRecipe(item))return fail('Неизвестный набор');
    const next=structuredClone(source);next.world.campKit??={};const kit=next.world.campKit[role]??={fuel:0,recipes:{}};
    const count=item==='fuel'?kit.fuel:kit.recipes[item]??0;if(count>=3)return fail('Больше трёх одинаковых наборов не поместится');
    const ingredients=item==='fuel'?[['charcoal',1],['lighterFluid',1]] as const:campIngredients(item);
    if(ingredients.some(([id,n])=>next.pantry[id]<n))return fail('Не хватает продуктов или топлива');
    for(const [id,n] of ingredients)next.pantry[id]-=n;
    if(item==='fuel')kit.fuel++;else kit.recipes[item]=count+1;
    return done(next,'В корзину: '+(item==='fuel'?'уголь и розжиг':CAMP_RECIPES[item].name));
  }
  if(command.type==='picnic_buy'){
    if(place!=='market'||!at(source,role,stationById('market','checkout')))return fail('Купи корзину у кассы супермаркета');
    if(source.world.picnic)return fail('Семейная корзина уже куплена');
    if(source.money<PICNIC_BASKET_PRICE)return fail('Недостаточно денег');
    const next=structuredClone(source);
    next.money-=PICNIC_BASKET_PRICE;
    next.world.picnic={portions:{vlad:[],alina:[]}};
    addLedger(next,role,'expense','groceries',PICNIC_BASKET_PRICE,'Корзина для пикника');
    return done(next,'Корзина для пикника куплена');
  }
  if(command.type==='picnic_pack'||command.type==='picnic_unpack'){
    if(place!=='home'||!at(source,role,stationById('home','fridge')))return fail('Подойди к холодильнику');
    if(!source.world.picnic)return fail('Сначала купи корзину для пикника');
    const {kind,item}=command;
    if((kind!=='meal'&&kind!=='takeout')||typeof item!=='string'||!Object.hasOwn(kind==='meal'?RECIPES:TAKEOUT,item))return fail('Неизвестное блюдо');
    const next=structuredClone(source);cleanPicnic(next);reconcileReadyFood(next);expireReadyFood(next);
    const basket=next.world.picnic!;const portions=basket.portions[role];const now=clockMinutes(next.clock);
    if(command.type==='picnic_pack'){
      if(basket.portions.vlad.length+basket.portions.alina.length>=PICNIC_CAPACITY)return fail('Корзина заполнена');
      const batch=next.readyFood.filter(b=>b.storage==='fridge'&&b.kind===kind&&b.item===item&&b.expiresAt>now).sort((a,b)=>a.expiresAt-b.expiresAt)[0];
      if(!batch)return fail('Нет свежей порции в холодильнике');
      const remaining=Math.max(1,Math.floor((batch.expiresAt-now)*tableShelfMinutes(item)/(readyFoodShelfDays(kind,item,'fridge')*MINUTES_PER_DAY)));
      const expiresAt=now+Math.min(batch.expiresAt-now,remaining,tableShelfMinutes(item));
      if(!consumeReadyFood(next,kind,item,'fridge'))return fail('Порция уже недоступна');
      portions.push({kind,item,expiresAt,...(batch.quality===undefined?{}:{quality:batch.quality})});
      return done(next,'В корзину: '+readyFoodName(kind,item));
    }
    const index=portions.findIndex(p=>p.kind===kind&&p.item===item);
    if(index<0)return fail('Нет такой порции в твоём отделении корзины');
    const portion=portions[index];
    if(kind==='meal')next.meals[item as keyof typeof RECIPES]++;else next.takeout[item as keyof typeof TAKEOUT]++;
    next.readyFood.push({...portion,kind,portions:1,storage:'fridge'});
    const fit=storageCanFit(source,next);if(!fit.ok)return fail(fit.reason);
    portions.splice(index,1);
    return done(next,'В холодильник: '+readyFoodName(kind,item));
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
    if (!order || order.table || order.pickedUp || order.readyAt > clockMinutes(source.clock)) return fail('Нет готового заказа для выдачи');
    const next = structuredClone(source);
    next.world.cafe[role]!.pickedUp = true;
    return done(next, 'Заказ получен. Выбери свободное место за столиком');
  }

  if (command.type === 'dog_leash') {
    if(source.world.vetVisit?.pet==='verdell')return fail('Верделл сейчас в ветеринарке');
    if (place !== 'park' || !at(source, role, stationById('park', 'park-dog'))) return fail('Подойди к площадке в парке');
    if (source.world.dogWalker && source.world.dogWalker !== role) return fail('Верделл уже гуляет со вторым игроком');
    const next = structuredClone(source);
    next.world.dogWalker = source.world.dogWalker ? null : role;
    if(next.world.dogWalker&&place==='park')next.world.parkDog={minutes:0,toilets:0};
    if (next.world.dogWalker) pausePetRoutine(next, 'verdell', clockMinutes(next.clock));
    setDogParkPosition(next);
    return done(next, next.world.dogWalker ? 'Верделл пришёл на прогулку' : 'Верделл вернулся домой');
  }

  return fail('Неизвестное действие');
}

export const localLabels: Record<LocalActivity, string> = {
  vetExam:VET_SERVICES.vetExam.name,vetTreatment:VET_SERVICES.vetTreatment.name,vetMedicine:VET_SERVICES.vetMedicine.name,
  clinicExam:CLINIC_SERVICES.clinicExam.name,clinicDiagnosis:CLINIC_SERVICES.clinicDiagnosis.name,clinicProcedure:CLINIC_SERVICES.clinicProcedure.name,clinicFollowup:CLINIC_SERVICES.clinicFollowup.name,clinicMedicine:CLINIC_SERVICES.clinicMedicine.name,
  fitnessSauna:'Сауна',fitnessTrain:'Тренировка',fitnessLocker:'Отдохнуть в раздевалке',fitnessShower:'Принять душ',fitnessToilet:'Воспользоваться туалетом',
  fitnessWater:FITNESS_BAR.fitnessWater.name,fitnessIsotonic:FITNESS_BAR.fitnessIsotonic.name,fitnessShake:FITNESS_BAR.fitnessShake.name,fitnessSmoothie:FITNESS_BAR.fitnessSmoothie.name,fitnessSnack:FITNESS_BAR.fitnessSnack.name,fitnessMeal:FITNESS_BAR.fitnessMeal.name,
  swing:'Покачаться на качелях', badminton:'Играть в бадминтон', dogFetch:'Бросить палочку',dogChase:'Играть в догонялки',dogRoll:'Поваляться на траве',dogToilet:'Верделл в туалет',campIgnite:'Разжечь костёр',campPotato:CAMP_RECIPES.campPotato.name,campBread:CAMP_RECIPES.campBread.name,campSkewers:CAMP_RECIPES.campSkewers.name,campMarshmallow:CAMP_RECIPES.campMarshmallow.name, picnic: 'Поесть на пикнике',
  rest: 'Отдохнуть на скамье', exercise: 'Зарядка на свежем воздухе', dine: 'Посидеть за столиком',
  dog: 'Поиграть с Верделлом', unpack: 'Разобрать покупки',
};

export function localActivity(source: GameState, role: CharacterId, action: LocalActivity, id: string): Result {
  const place = source.world.places[role];
  const station = stationById(place, id);
  if(isVetAction(action)){
    const visit=source.world.vetVisit,service=VET_SERVICES[action];
    if(place!=='work-clinic'||visit?.owner!==role||id!==service.station||!station||!at(source,role,station))return fail('Привези питомца и подойди к нужному месту');
    if(source.careers.residents[role].shift||!vetAvailable(source,visit.pet,action))return fail('Услуга сейчас недоступна');
    if(source.money<service.price)return fail('Недостаточно денег');
    const next=structuredClone(source);next.money-=service.price;
    addLedger(next,role,'expense','pets',service.price,'Лапа и хвост · '+service.name);
    completeVetService(next,visit.pet,action);next.characters[role].pose='idle';
    return done(next,service.name+' · выполнено');
  }
  if(isClinicAction(action)){
    const service=CLINIC_SERVICES[action];
    if(place!=='clinic'||id!==service.station||!station||!at(source,role,station))return fail('Подойди к нужному кабинету');
    if(!clinicAvailable(source,role,action))return fail('Эта услуга сейчас не нужна или уже выполнена');
    const price=action==='clinicMedicine'?medicinePrice(source,role):service.price;
    if(source.money<price)return fail('Недостаточно денег');
    const next=structuredClone(source);next.money-=price;
    addLedger(next,role,'expense','services',price,'Добрый доктор · '+service.name);
    completeClinicService(next,role,action);next.characters[role].pose='idle';
    return done(next,service.name+' · выполнено');
  }
  if (!station || (station.action.kind !== action && !(station.action.kind==='fitness'&&station.action.facility==='sauna'&&action==='fitnessSauna') && !(station.action.kind==='fitness'&&!!fitnessExercise(station.action.facility)&&action==='fitnessTrain') && !(station.action.kind==='fitness'&&(fitnessCareAction(station.action.facility)===action||station.action.facility==='bar'&&!!fitnessBarItem(action))) && !(station.action.kind==='dog'&&isParkDogAction(action)) && !(station.action.kind==='campfire'&&(action==='campIgnite'||isCampRecipe(action)))) || !at(source, role, station)) return fail('Сначала подойди к подходящему объекту');
  if (isParkDogAction(action) && (!source.world.dogWalker||source.world.places[source.world.dogWalker]!=='park')) return fail('Сначала возьми Верделла на прогулку');
  if (action === 'unpack' && !source.world.tableBags) return fail('Нет покупок для распаковки');
  const bar=fitnessBarItem(action),care=station.action.kind==='fitness'?fitnessCareAction(station.action.facility):undefined;
  if(bar||care===action){
    if(place!=='fitness'||!fitnessAccess(source,role))return fail('Сначала оплати посещение клуба');
    if(care===action&&station.action.kind==='fitness'&&fitnessCareRole(station.action.facility)!==role)return fail('Выбери свою раздевалку или санитарную зону');
    if(bar&&source.money<bar.price)return fail('Недостаточно денег');
    const next=structuredClone(source),c=next.characters[role];
    if(bar){next.money-=bar.price;addLedger(next,role,'expense','takeout',bar.price,'PULSE · '+bar.name);c.hunger=Math.min(100,c.hunger+bar.hunger);c.energy=Math.min(100,c.energy+bar.energy);c.mood=Math.min(100,c.mood+4);const p=(next.world.fitness??=initialFitness())[role];p.fatigue=Math.max(0,p.fatigue-bar.fatigue);}
    else if(action==='fitnessShower'){c.hygiene=100;c.comfort=Math.min(100,c.comfort+12);}
    else if(action==='fitnessToilet')c.bladder=100;
    else {c.comfort=Math.min(100,c.comfort+12);c.energy=Math.min(100,c.energy+3);}
    c.pose='idle';return done(next,localLabels[action]+' · готово');
  }
  if(action==='fitnessTrain'){
    if(place!=='fitness'||station.action.kind!=='fitness'||!fitnessAccess(source,role))return fail('Сначала оплати посещение клуба');
    const exercise=fitnessExercise(station.action.facility);if(!exercise)return fail('Выбери тренажёр');
    const profile=fitnessProfile(source,role),c=source.characters[role];
    if(skillRank(source.education.characters[role].xp.fitness).level<exercise.minLevel)return fail('Сначала развей навык фитнеса до '+exercise.minLevel);
    if(c.energy<25||c.hunger<25)return fail('Сначала отдохни и поешь');
    if(profile.fatigue+exercise.fatigue>85)return fail('Мышцам нужен отдых');
    const next=structuredClone(source),p=(next.world.fitness??=initialFitness())[role],resident=next.characters[role];
    const stats=p.stats??=emptyFitnessStats();
    if(p.trainingDay!==source.clock.day){p.trainingDay=source.clock.day;p.dailyGain=0;}
    const gain=Math.max(0,Math.min(2.5,8-(p.dailyGain??0),100-stats[exercise.axis]));
    stats[exercise.axis]+=gain;p.dailyGain=(p.dailyGain??0)+gain;
    stats.recovery=Math.min(100,stats.recovery+gain*.7);
    p.fatigue=Math.min(100,p.fatigue+exercise.fatigue);p.lastTrainingDay=source.clock.day;p.workouts=(p.workouts??0)+1;
    (p.history??=[]).unshift({day:source.clock.day,facility:station.action.facility});p.history=p.history.slice(0,8);
    const clamp=(v:number)=>Math.max(0,Math.min(100,v));
    resident.energy=clamp(resident.energy-(exercise.fatigue*.8+2));
    resident.hunger=clamp(resident.hunger-(exercise.fatigue*.45+2));
    resident.hygiene=clamp(resident.hygiene-(exercise.fatigue*.85+2));
    resident.fun=clamp(resident.fun+8);resident.mood=clamp(resident.mood+10);
    return done(next,exercise.name+' · завершено');
  }
  if(action==='fitnessSauna'){
    if(place!=='fitness'||!fitnessAccess(source,role))return fail('Сначала оплати посещение клуба');
    if(source.money<SAUNA_PRICE)return fail('Недостаточно денег');
    if(fitnessProfile(source,role).saunaDay===source.clock.day)return fail('Сегодня ты уже посещал сауну');
    if(source.characters[role].energy<20||source.characters[role].hunger<20)return fail('Сначала отдохни и поешь');
    const next=structuredClone(source),profile=(next.world.fitness??=initialFitness())[role];
    profile.saunaDay=source.clock.day;profile.fatigue=Math.max(0,profile.fatigue-35);
    next.money-=SAUNA_PRICE;addLedger(next,role,'expense','services',SAUNA_PRICE,'PULSE · Сауна');
    const c=next.characters[role];c.comfort=Math.min(100,c.comfort+30);c.mood=Math.min(100,c.mood+15);
    return done(next,'Сауна · восстановление и комфорт');
  }
  const next = structuredClone(source);
  const resident = next.characters[role];
  const bump = (key: 'mood' | 'comfort' | 'fun' | 'hunger' | 'energy', count: number) => {
    resident[key] = Math.max(0, Math.min(100, resident[key] + count));
  };
  resident.pose = action === 'rest' || action === 'dine' || action === 'swing' || action === 'picnic' ? 'sit' : 'idle';
  if (action === 'dine') {
    const order = next.world.cafe[role];
    if(order?.table && (order.table!==id || order.readyAt>clockMinutes(source.clock) || source.characters[role].pose!=='sit'))
      return fail('Сядь за свой столик и дождись приготовления');
    if (order?.pickedUp || order?.table) {
      const meal = CAFE_MENU[order.item];
      bump('hunger', meal.hunger); bump('energy', meal.energy); bump('mood', meal.mood); bump('comfort',meal.comfort);
      delete next.world.cafe[role];
    } else { bump('comfort', 8); bump('mood', 3); }
  } else if (action === 'rest') {
    bump('comfort', 14); bump('energy', 5);
  } else if(action==='campIgnite'||isCampRecipe(action)){
    const now=clockMinutes(next.clock),kit=next.world.campKit?.[role];
    if(!kit)return fail('Собери продукты и топливо дома');
    if(action==='campIgnite'){
      if((next.world.campLitUntil??0)>now)return fail('Костёр уже горит');
      if(kit.fuel<1)return fail('Нет угля и розжига в корзине');kit.fuel--;next.world.campLitUntil=now+120;
      return done(next,'Костёр разожжён');
    }
    if((next.world.campLitUntil??0)<=now)return fail('Сначала разожги костёр');
    if(!kit.recipes[action])return fail('Нет подготовленных ингредиентов');
    cleanPicnic(next);const basket=next.world.picnic;if(!basket||basket.portions.vlad.length+basket.portions.alina.length+2>PICNIC_CAPACITY)return fail('Нужно два свободных места в корзине');
    kit.recipes[action]!--;const quality=cookingQuality(next,role);const partner=role==='vlad'?'alina':'vlad';for(const owner of [role,partner] as const)basket.portions[owner].push({kind:'campfire',item:action,expiresAt:now+480,quality});
    bump('fun',10);bump('mood',10);return done(next,CAMP_RECIPES[action].name+' · 2 порции в корзине · '+qualityLabel(quality));
  } else if(action==='picnic'){
    cleanPicnic(next);const food=next.world.picnic?.portions[role].shift();
    if(!food)return fail('В твоём отделении корзины нет свежих порций');
    const meal=food.kind==='campfire'&&isCampRecipe(food.item)?CAMP_RECIPES[food.item]:food.kind==='meal'?RECIPES[food.item as keyof typeof RECIPES]:TAKEOUT[food.item as keyof typeof TAKEOUT];
    const effect=foodQualityEffect(food.quality,meal.mood+8,18);
    bump('hunger',meal.hunger);bump('mood',effect.mood);bump('fun',effect.fun);bump('comfort',8);
    return done(next,'Пикник: '+picnicName(food));
  } else if(action==='swing'){bump('comfort',24);bump('fun',24);bump('mood',15);bump('energy',5);
  } else if (action === 'badminton') {
    bump('fun', 25); bump('mood', 10); bump('comfort', 8); bump('energy', -3);
  } else if (action === 'exercise') {
    bump('fun', 13); bump('mood', 6); bump('energy', -4);
  } else if (isParkDogAction(action)) {
    const dog = next.pets.verdell;
    if(action==='dogToilet'){
      const visit=next.world.parkDog??={minutes:0,toilets:0};if(visit.toilets>=2)return fail('Верделл уже справил нужду дважды');
      dog.bladder=100;visit.toilets++;visit.toiletUntil=clockMinutes(next.clock)+3;
      return done(next,'Верделл справил нужду');
    }
    dog.happiness = Math.min(100, dog.happiness + (action==='dog'?7:15));
    dog.bond = Math.min(100, dog.bond + 4);
    if(action==='dogChase'||action==='dogFetch'){dog.energy=Math.max(0,dog.energy-5);bump('fun',15);}
    bump('mood', 4);
  } else {
    next.world.tableBags = 0;
    bump('comfort', 3);
  }
  return done(next, localLabels[action] + ' · готово');
}
