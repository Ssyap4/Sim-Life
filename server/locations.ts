import {renovationLampSpots} from '../src/shared/renovationPlacement';
import {FURNITURE_DELIVERY} from '../src/shared/furniture';
import {coveringById,roomById,compatible,renovationQuote,validRenovation,initialRenovation,installedRenovation} from '../src/shared/renovation';
import {DOG_AGILITY,isDogAgility,agilityReady,finishAgility,validAgilityVisit,type AgilitySupport} from '../src/shared/dogAgility';
import {recordCatch} from '../src/shared/personalCollections';
import {treatsRemaining as lakeTreatsRemaining,PET_TREAT_REWARD as lakeTreatReward} from '../src/shared/pets';
import {practiceXP} from './education';
import {LAKE_PASSES,LAKE_TENTS,LAKE_RODS,LAKE_BAIT,LAKE_REST,isLakeRestAction,LAKE_LEISURE,isLakeLeisureAction,lakeCanSwim,lakeNeedsFish,LAKE_CARE,isLakeCareAction,lakeCampFor,LAKE_FISH,FISH_ACTIONS,isLakeFishAction,validFishing,emptyFishing,freshFish,rollFish,fishLabel,LAKE_MEALS,LAKE_MEAL_ACTIONS,isLakeMealAction,lakePass,lakeTent,lakeRod,lakeVisit,lakeAccess,validLake,type LakePass} from '../src/shared/lake';
import {creditWeekendSpa} from '../src/shared/weekends';
import {SPA_PASSES,SPA_ACTIVITIES,SPA_MASSAGE_PRICE,isSpaAction,validSpa,spaDenial,finishSpa} from '../src/shared/spa';
import {BARBER_SERVICES,isBarberAction,barberSlots,barberDenial,finishBarber} from '../src/shared/barber';
import {VET_SERVICES,isVetAction,vetAvailable,completeVetService,isHealthPet,setVetBooking,takeVetMedicine,familyCare,CLINIC_SERVICES,isClinicAction,clinicAvailable,completeClinicService,medicinePrice,healthBookingSlots,setHealthBooking,takeGameMedicine} from '../src/shared/health';
import {FITNESS_PASSES,FITNESS_BAR,fitnessBarItem,fitnessCareRole,fitnessCareAction,fitnessExercise,emptyFitnessStats,fitnessAccess,fitnessProfile,fitnessBookingSlots,initialFitness,validFitness,SAUNA_PRICE,type FitnessPass} from '../src/shared/fitness';
import {skillRank} from '../src/shared/education';
import { PURCHASABLE_FURNITURE } from '../src/shared/furniture';
import { toyProduct,toyOwned } from '../src/shared/petToys';
import { petFoodProduct } from '../src/shared/petShop';
import { PET_FOOD_MAX_REFILLS } from '../src/shared/pets';
import {applyFavoriteMeal} from '../src/shared/foodTastes';
import { cookingQuality, foodQualityEffect, qualityLabel } from '../src/shared/foodQuality';
import { ELECTRONICS,initialElectronics,validElectronics,isElectronicsId,installedElectronics } from '../src/shared/electronics';
import { defaultWardrobe, isPreviewLook, outfitPrice, validWardrobe, PREVIEW_LOOKS, OUTFIT_CONTEXTS, type OutfitContext } from '../src/shared/previewWardrobe';
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
import { checkout, grantCart, quoteCart, recordCartExpense } from './market';
import { pausePetRoutine } from './pets';
import { CAMP_RECIPES, campIngredients, isCampRecipe, isParkDogAction } from '../src/shared/park';
import { PICNIC_BASKET_PRICE, PICNIC_CAPACITY, validPicnicBasket, cleanPicnic, picnicName } from '../src/shared/picnic';
import { consumeReadyFood, readyFoodShelfDays, tableShelfMinutes, reconcileReadyFood, expireReadyFood } from '../src/shared/readyFood';
import { RECIPES, TAKEOUT } from '../src/shared/food';
import { MINUTES_PER_DAY } from '../src/shared/life';
import { discardReadyFood, moveReadyFoodToFridge, moveReadyFoodToTable, readyFoodName } from '../src/shared/readyFood';
import { storageCanFit } from '../src/shared/storageSpace';
import {isGift,giftCount,pendingGifts,GIFT_LIMIT} from '../src/shared/gifts';
import { marketProduct } from '../src/shared/market';

import {RESORT_PASSES,RESORT_ACTIONS,RESORT_LABELS,RESORT_GRILL,RESORT_DRINKS,isResortGrill,resortAlcoholCount,isResortPass,isResortAction,validResort,resortAccess,resortMealKey,type ResortPass,type ResortMeal} from '../src/shared/resort';
import {weatherAt} from '../src/shared/weather';
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
    (w.carDriver===undefined||(ROLES.includes(w.carDriver)&&['market','cafe','park','clothing','electronics','petshop','buildshop','industrial','fitness','clinic','barber','spa','venue','lake','resort','work-clinic'].includes(w.places![w.carDriver]))) &&
    (w.vetVisit===undefined?!(w.carDriver&&w.places![w.carDriver]==='work-clinic'):!!w.vetVisit&&ROLES.includes(w.vetVisit.owner)&&isHealthPet(w.vetVisit.pet)&&w.carDriver===w.vetVisit.owner&&w.places![w.vetVisit.owner]==='work-clinic'&&!(w.vetVisit.pet==='verdell'&&w.dogWalker)) &&
    (w.fishing===undefined||validFishing(w.fishing)) &&
    (w.lake===undefined?ROLES.every(r=>w.places![r]!=='lake'):validLake(w.lake)&&ROLES.every(r=>!!w.lake?.[r]===(w.places![r]==='lake'))) &&
    (w.resort===undefined?ROLES.every(r=>w.places![r]!=='resort'):validResort(w.resort)&&ROLES.every(r=>w.resort!.guests.includes(r)===(w.places![r]==='resort'))) &&
    (w.spa===undefined?ROLES.every(r=>w.places![r]!=='spa'):validSpa(w.spa)&&ROLES.every(r=>!!w.spa?.[r]===(w.places![r]==='spa'))) &&
    (w.fitness===undefined||validFitness(w.fitness)) &&
    (w.renovation===undefined||validRenovation(w.renovation)) &&
    (w.electronics===undefined||validElectronics(w.electronics)) &&
    (w.wardrobe===undefined||validWardrobe(w.wardrobe)) &&
    (w.picnic===undefined||validPicnicBasket(w.picnic)) &&
    (w.campLitUntil===undefined||count(w.campLitUntil)) &&
    (w.parkDog===undefined||!!w.parkDog&&count(w.parkDog.minutes)&&count(w.parkDog.toilets)&&w.parkDog.toilets<=2&&(w.parkDog.agility===undefined||validAgilityVisit(w.parkDog.agility))&&(w.parkDog.toiletUntil===undefined||count(w.parkDog.toiletUntil))) &&
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
export function venueTogetherTrip(source:GameState,driver:CharacterId):Result{
 if(source.world.carDriver||ROLES.some(r=>source.world.places[r]!=='home'||source.activeShifts[r]||source.careers.residents[r].shift||source.world.dogWalker===r))return fail('Оба должны быть дома и свободны');
 const next=structuredClone(source);next.world.carDriver=driver;
 for(const r of ROLES){next.world.places[r]='venue';Object.assign(next.characters[r],doorwayArrival('venue','district',r),{pose:'idle'});}
 return done(next,'Приехали вместе в PLAY ARENA');
}
export function spaTogetherTrip(source:GameState,driver:CharacterId,pass:'pair'|'package'):Result{
 if(source.world.carDriver||ROLES.some(r=>source.world.places[r]!=='home'||source.activeShifts[r]||source.careers.residents[r].shift||source.world.dogWalker===r))return fail('Оба должны быть дома и свободны');
 const price=SPA_PASSES[pass].price;if(source.money<price)return fail('Недостаточно денег');
 const next=structuredClone(source);next.world.carDriver=driver;next.world.spa={};
 for(const r of ROLES){next.world.places[r]='spa';next.world.spa[r]={pass,used:[]};Object.assign(next.characters[r],doorwayArrival('spa','district',r),{pose:'idle'});}
 next.money-=price;addLedger(next,driver,'expense','services',price,SPA_PASSES[pass].name);return done(next,'Приехали вместе в SPA «Лагуна»');
}
export function lakeTogetherTrip(source:GameState,driver:CharacterId,pass:LakePass,dog=false):Result{
 if(!lakePass(pass)||source.world.carDriver||ROLES.some(r=>source.world.places[r]!=='home'||source.activeShifts[r]||source.careers.residents[r].shift||source.world.dogWalker===r))return fail('Оба должны быть дома и свободны');
 if(dog&&(source.world.dogWalker||source.world.vetVisit?.pet==='verdell'))return fail('Верделл сейчас занят');
 const price=LAKE_PASSES[pass].pair;if(source.money<price)return fail('Недостаточно денег');
 const next=structuredClone(source);next.world.carDriver=driver;next.world.lake={};
 for(const r of ROLES){next.world.places[r]='lake';next.world.lake[r]=lakeVisit(pass,clockMinutes(next.clock));Object.assign(next.characters[r],doorwayArrival('lake','district',r),{pose:'idle'});}
 if(dog){pausePetRoutine(next,'verdell',clockMinutes(next.clock));next.world.dogWalker=driver;next.world.parkDog={minutes:0,toilets:0};setDogParkPosition(next);}
 next.money-=price;addLedger(next,driver,'expense','services',price,'Лесное озеро · '+LAKE_PASSES[pass].name);return done(next,'Приехали в Лесное озеро');
}
export function resortTogetherTrip(source:GameState,driver:CharacterId,pass:ResortPass):Result{
 if(!isResortPass(pass)||source.world.carDriver||source.world.resort||ROLES.some(r=>source.world.places[r]!=='home'||source.activeShifts[r]||source.careers.residents[r].shift||source.world.dogWalker===r))return fail('Оба должны быть дома и свободны');
 const d=RESORT_PASSES[pass];if(source.money<d.price)return fail('Недостаточно денег');const next=structuredClone(source),now=clockMinutes(next.clock);next.world.carDriver=driver;next.world.resort={pass,from:now,until:now+d.minutes,guests:[...ROLES],eaten:{}};
 for(const r of ROLES){next.world.places[r]='resort';Object.assign(next.characters[r],doorwayArrival('resort','district',r),{pose:'idle'});}
 next.money-=d.price;addLedger(next,driver,'expense','services',d.price,'Лазурный берег · '+d.name);return done(next,'Добро пожаловать на Лазурный берег!');
}
function leaveResort(s:GameState,r:CharacterId){const v=s.world.resort;if(!v)return;v.guests=v.guests.filter(x=>x!==r);if(!v.guests.length)delete s.world.resort;}
export function clinicTogetherTrip(source:GameState,driver:CharacterId):Result{
 if(source.world.carDriver||ROLES.some(r=>source.world.places[r]!=='home'||source.activeShifts[r]||source.careers.residents[r].shift||source.world.dogWalker===r))return fail('Оба должны быть дома и свободны');
 const next=structuredClone(source);next.world.carDriver=driver;
 for(const r of ROLES){next.world.places[r]='clinic';Object.assign(next.characters[r],doorwayArrival('clinic','district',r),{pose:'idle'});}
 return done(next,'Приехали вместе в «Добрый доктор»');
}
import {CONSOLES,CONSOLE_GAMES,isConsoleSku,isConsoleGame,consoleOwned,consoleInstalled,consoleLibrary} from '../src/shared/consoleCatalog';
export const worldMessages = new Set(['barber_book','barber_cancel','console_buy','console_game_buy','vet_book','vet_cancel','vet_medicine','health_care','health_book','health_cancel','health_medicine','fitness_pass','fitness_book','fitness_cancel','speaker_buy','vacuum_buy','vacuum_control',
  'renovation_sample','renovation_install','renovation_light','renovation_lamp_order','pet_food_buy','pet_toy_buy','pet_furniture_buy','electronics_buy','clothing_buy','clothing_wear','clothing_auto','clothing_context','travel', 'car_travel', 'walk', 'approach', 'store_pay', 'delivery_order', 'delivery_handoff', 'delivery_claim',
  'resort_buy_meat','lake_buy_bait','lake_rent','lake_pitch','lake_fire','lake_catch','lake_dog_treat','camp_pack', 'picnic_buy', 'picnic_pack', 'picnic_unpack',
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

  if(command.type==='renovation_sample'){
    const p=coveringById(command.sku);if(!p||place!=='buildshop'||!at(source,role,stationById('buildshop',p.kind==='wall'?'build-walls':p.kind==='floor'?'build-floors':p.kind==='portable'?'build-portable':p.kind==='sanitary'?'build-sanitary':'build-light')))return fail('Подойди к стенду нужного покрытия');
    const next=structuredClone(source),r=next.world.renovation??=initialRenovation();
    if(r.samples.includes(p.id))return fail('Образец уже выбран');
    r.samples.push(p.id);return done(next,'Образец добавлен в домашнюю примерку');
  }
  if(command.type==='renovation_light'){
    const room=roomById(command.room),mode=command.mode;
    if(place!=='home'||!room||!source.world.renovation?.surfaces[room.id]?.ceiling||typeof mode!=='string'||!['auto','off','soft','warm'].includes(mode))return fail('Сначала установи светильник');
    const next=structuredClone(source);(next.world.renovation!.lights??={})[room.id]=mode as 'auto'|'off'|'soft'|'warm';return done(next,'Освещение комнаты изменено');
  }
  if(command.type==='renovation_lamp_order'){
    const p=coveringById(command.sku),room=roomById(command.room);
    if(place!=='home'||!p||p.kind!=='portable'||!room||!source.world.renovation?.samples.includes(p.id))return fail('Выбери лампу для примерки дома');
    if(command.sequence!==source.world.sequence[role])return fail('Операция уже обработана');
    if(!renovationLampSpots(source,room.id,p.id).some(s=>s.x===command.x&&s.z===command.z))return fail('Место примерки изменилось');
    const q=renovationQuote(room.id,p);if(source.money<q.total)return fail('Недостаточно денег');
    if(source.furnishing.nextId>=1000000)return fail('Не удалось выдать номер предмета');
    const next=structuredClone(source);next.money-=q.total;next.world.sequence[role]++;
    next.furnishing.orders.push({id:next.furnishing.nextId++,sku:p.id,finish:'oak',readyAt:clockMinutes(source.clock)+FURNITURE_DELIVERY.regular.minutes,shipping:'regular'});
    addLedger(next,role,'expense','furniture',q.total,p.name+' · доставка из ДомСтроя');return done(next,'Лампа заказана · доставка через 45 игровых минут');
  }
  if(command.type==='renovation_install'){
    const p=coveringById(command.sku),room=roomById(command.room),r=source.world.renovation;
    if(place!=='home'||!p||p.kind==='portable'||!room||!r?.samples.includes(p.id)||!compatible(room.id,p))return fail('Выбери подходящий образец дома');
    if(command.sequence!==source.world.sequence[role])return fail('Операция уже обработана');
    const previous=installedRenovation(r,room.id,p);
    if(previous!==command.expected||previous===p.id)return fail('Отделка уже изменена, проверь примерку');
    const q=renovationQuote(room.id,p);if(source.money<q.total)return fail('Недостаточно денег на материалы и монтаж');
    const next=structuredClone(source);if(p.fixture)(next.world.renovation!.fixtures??={})[p.fixture]=p.id;else (next.world.renovation!.surfaces[room.id]??={})[p.kind]=p.id;
    next.money-=q.total;next.world.sequence[role]++;addLedger(next,role,'expense','furniture',q.total,'Ремонт · '+room.name+' · '+p.name);
    return done(next,'Ремонт завершён: '+room.name);
  }
  if(command.type==='barber_book'||command.type==='barber_cancel'){if(role!=='vlad')return fail('Запись доступна Владу');const next=structuredClone(source);if(command.type==='barber_cancel')delete next.barberBooking;else{if(typeof command.at!=='number'||!barberSlots(clockMinutes(source.clock)).includes(command.at)||!isBarberAction(command.service))return fail('Выбери услугу и время');next.barberBooking={at:command.at,service:command.service};}return done(next,command.type==='barber_book'?'Запись в BRO сохранена':'Запись отменена');}
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
  if(command.type==='console_buy'){
    if(place!=='electronics'||!at(source,role,stationById('electronics','tech-cash')))return fail('Подойди к кассе магазина техники');
    if(!isConsoleSku(command.sku))return fail('Неизвестная консоль');
    const sku=command.sku,m=CONSOLES[sku],f=source.furnishing;
    if(consoleOwned(source,sku))return fail('Такая консоль уже есть');
    if(source.money<m.price)return fail('Недостаточно денег');
    if(f.nextId>=1000000||f.placed.length+f.stored.length+f.orders.length>=10000)return fail('Склад заполнен');
    const next=structuredClone(source);next.money-=m.price;next.furnishing.stored.push({id:next.furnishing.nextId++,sku,finish:'ivory'});
    addLedger(next,role,'expense','electronics',m.price,m.name);return done(next,'Куплено: '+m.name+' · размести из склада мебели');
  }
  if(command.type==='console_game_buy'){
    if(place!=='home'||!isConsoleGame(command.game))return fail('Выбери игру дома');
    const id=command.game,m=CONSOLE_GAMES[id];
    if(!consoleInstalled(source,m.console))return fail('Сначала установи нужную консоль');
    if(consoleLibrary(source).includes(id))return fail('Игра уже в библиотеке');
    if(source.money<m.price)return fail('Недостаточно денег');
    const next=structuredClone(source);next.money-=m.price;(next.consoleLibrary??=[]).push(id);
    addLedger(next,role,'expense','electronics',m.price,m.name);return done(next,'Игра добавлена: '+m.name);
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
  if(command.type==='clothing_auto'||command.type==='clothing_context'){
    if(place!=='home'||!['wardrobe-alina','wardrobe-vlad'].some(id=>at(source,role,stationById('home',id))))return fail('Подойди к шкафу дома');
    const next=structuredClone(source),p=(next.world.wardrobe??=defaultWardrobe())[role];
    if(command.type==='clothing_auto'){if(typeof command.enabled!=='boolean')return fail('Неверный режим');p.auto=command.enabled;}
    else{if(typeof command.context!=='string'||!(OUTFIT_CONTEXTS as readonly string[]).includes(command.context))return fail('Неизвестная ситуация');
      const context=command.context as OutfitContext;if(command.look!==null&&(typeof command.look!=='string'||!p.owned.includes(command.look)))return fail('Сначала купи комплект');
      if(command.look===null)delete p.contexts?.[context];else(p.contexts??={})[context]=command.look;
    }
    return done(next,'Настройки переодевания сохранены');
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
    personal.worn=look;personal.auto=false;
    return done(next,'Наряд изменён');
  }
  if(command.type==='lake_dog_treat'){
    const walker=source.world.dogWalker,station=stationById('lake',command.station);
    if(!walker||source.world.places[walker]!=='lake'||!lakeAccess(source,role)||station?.action.kind!=='lake'||station.action.facility!=='fire'||!at(source,role,station)||typeof command.fish!=='boolean')return fail('Верделл должен быть у костра');
    const camp=lakeCampFor(source,station.id);if(!camp)return fail('Сначала установите палатку');
    const owner=source.characters[walker];if(Math.hypot(owner.x-station.center.x,owner.z-station.center.z)>3)return fail('Позовите Верделла к костру');
    const next=structuredClone(source),pet=next.pets.verdell;if(lakeTreatsRemaining(pet,next.clock.day)<=0)return fail('Лимит лакомств на сегодня');
    if(command.fish){const c=lakeCampFor(next,station.id)!;if(!c.meals?.fish)return fail('Нужна приготовленная рыба');c.meals.fish--;}
    pet.treats={day:next.clock.day,used:(pet.treats?.day===next.clock.day?pet.treats.used:0)+1};
    pet.satiety=Math.min(100,pet.satiety+(command.fish?45:lakeTreatReward.satiety));pet.happiness=Math.min(100,pet.happiness+(command.fish?25:lakeTreatReward.happiness));pet.bond=Math.min(100,pet.bond+(command.fish?18:lakeTreatReward.bond));
    return done(next,command.fish?'Верделл получил рыбку без костей':'Верделл получил лакомство');
  }
  if(command.type==='lake_catch'){
    const pending=source.world.lake?.[role]?.catch;if(source.world.places[role]!=='lake'||!pending||typeof command.keep!=='boolean')return fail('Нет улова для выбора');
    const next=structuredClone(source),visit=next.world.lake![role]!,stock=next.world.fishing??=emptyFishing();stock.fish=freshFish(next);
    if(command.keep&&pending.expires<=clockMinutes(next.clock))return fail('Рыба уже не свежая — отпусти её');
    if(command.keep&&stock.fish.length>=12)return fail('Термосумка заполнена');
    delete visit.catch;const c=next.characters[role];if(command.keep)stock.fish.push(pending);else {c.mood=Math.min(100,c.mood+(LAKE_FISH[pending.species].tier===2?18:8));c.fun=Math.min(100,c.fun+6);practiceXP(next,role,'lake-release','attention','Рыбалка · отпустили улов',LAKE_FISH[pending.species].tier===2?9:4,12);}
    return done(next,(command.keep?'Забрали: ':'Отпустили: ')+fishLabel(pending));
  }
  if(command.type==='lake_buy_bait'){if(!lakeAccess(source,role)||!at(source,role,stationById('lake','lake-rental')))return fail('Подойди к прокату с действующим билетом');if(source.world.lake![role]!.bait)return fail('Прикормка уже куплена на эту поездку');if(source.money<LAKE_BAIT.price)return fail('Недостаточно денег');const next=structuredClone(source);next.world.lake![role]!.bait=true;next.money-=LAKE_BAIT.price;addLedger(next,role,'expense','services',LAKE_BAIT.price,'Рыбалка · прикормка');return done(next,'Прикормка: +8 п.п. к редкому улову до конца визита');}
  if(command.type==='lake_rent'||command.type==='lake_pitch'||command.type==='lake_fire'){
    if(!lakeAccess(source,role))return fail('Нужен действующий билет клуба');
    const next=structuredClone(source),visit=next.world.lake![role]!;
    if(command.type==='lake_fire'){
      const station=stationById('lake',command.station);
      if(station?.action.kind!=='lake'||station.action.facility!=='fire'||!at(source,role,station)||typeof command.lit!=='boolean')return fail('Подойди к костру');
      const pitch=station.id.replace('lake-fire-','lake-pitch-'),camp=Object.values(next.world.lake!).find(v=>v.pitch===pitch);
      if(!camp)return fail('Сначала установите палатку на этой площадке');
      camp.fire=command.lit;return done(next,command.lit?'Костёр разожжён':'Костёр потушен');
    }
    if(command.type==='lake_pitch'){
      const station=stationById('lake',command.station);
      if(station?.action.kind!=='lake'||station.action.facility!=='pitch'||!at(source,role,station)||!visit.tent)return fail('Возьми палатку и подойди к площадке');
      if(Object.values(next.world.lake!).some(v=>v!==visit&&v.pitch===station.id))return fail('Площадка занята');
      if(visit.pitch)return fail('Палатка уже установлена');
      visit.pitch=station.id;return done(next,'Площадка выбрана');
    }
    if(!at(source,role,stationById('lake','lake-rental')))return fail('Подойди к прокату');
    let price:number,label:string;
    if(command.category==='tent'&&lakeTent(command.item)){if(visit.tent||next.world.lake?.[neighbor]?.tent)return fail('Семья уже арендовала палатку');visit.tent=command.item;price=LAKE_TENTS[command.item].price;label=LAKE_TENTS[command.item].name;}
    else if(command.category==='rod'&&lakeRod(command.item)){if(visit.rod)return fail('Снасть уже арендована');visit.rod=command.item;price=LAKE_RODS[command.item].price;label=LAKE_RODS[command.item].name;}
    else return fail('Выбери оборудование');
    if(next.money<price)return fail('Недостаточно денег');
    next.money-=price;addLedger(next,role,'expense','services',price,'Прокат · '+label);return done(next,'Арендовано: '+label);
  }
  if(command.type==='resort_buy_meat'){
    const item=command.item;if(!isResortGrill(item)||!resortAccess(source,role)||!at(source,role,stationById('resort','resort-bar')))return fail('Подойди к бару комплекса и выбери набор для мангала');const d=RESORT_GRILL[item],v=source.world.resort!;if((v.raw?.[item]??0)>=3)return fail('На кухне уже есть три набора');if(source.money<d.price)return fail('Недостаточно денег');const next=structuredClone(source),stock=next.world.resort!.raw??={};stock[item]=(stock[item]??0)+1;next.money-=d.price;addLedger(next,role,'expense','groceries',d.price,'Лазурный берег · '+d.name);return done(next,'Набор доставлен в холодильник коттеджа · 2 порции');
  }
  if(command.type==='car_travel'){
    if(place!=='home'||!at(source,role,stationById('home','family-car')))return fail('Сначала подойди к машине');
    if(source.world.carDriver)return fail('Машина сейчас в поездке');
    if(command.place!=='market'&&command.place!=='cafe'&&command.place!=='park'&&command.place!=='clothing'&&command.place!=='electronics'&&command.place!=='petshop'&&command.place!=='buildshop'&&command.place!=='industrial'&&command.place!=='fitness'&&command.place!=='clinic'&&command.place!=='barber'&&command.place!=='spa'&&command.place!=='lake'&&command.place!=='work-clinic')return fail('Выбери доступное место');
    if(command.place==='barber'&&role!=='vlad')return fail('BRO доступен Владу');
    if(command.place==='work-clinic'&&(!isHealthPet(command.pet)||command.pet==='verdell'&&source.world.dogWalker))return fail('Выбери свободного питомца для поездки');
    if(command.place!=='work-clinic'&&command.pet!==undefined)return fail('Питомца можно взять только в ветеринарку');
    if(source.world.dogWalker===role)return fail('Сначала отпусти Верделла домой');
    const next=structuredClone(source);
    const destination=command.place;
    if(command.dog===true&&(destination!=='lake'||source.world.dogWalker||source.world.vetVisit?.pet==='verdell'))return fail('Верделл сейчас недоступен');
    if(destination==='lake'){if(!lakePass(command.pass))return fail('Выбери билет');const price=LAKE_PASSES[command.pass].single;if(next.money<price)return fail('Недостаточно денег');next.money-=price;addLedger(next,role,'expense','services',price,'Лесное озеро · '+LAKE_PASSES[command.pass].name);(next.world.lake??={})[role]=lakeVisit(command.pass,clockMinutes(next.clock));}
    if(destination==='spa'){const price=SPA_PASSES.single.price;if(next.money<price)return fail('Недостаточно денег');next.money-=price;addLedger(next,role,'expense','services',price,SPA_PASSES.single.name);(next.world.spa??={})[role]={pass:'single',used:[]};}
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
    if(destination==='lake'&&command.dog===true){pausePetRoutine(next,'verdell',clockMinutes(next.clock));next.world.dogWalker=role;next.world.parkDog={minutes:0,toilets:0};setDogParkPosition(next);}
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
      if((place==='spa'||place==='venue'||place==='lake'||place==='resort')&&next.world.places[neighbor]===place)next.world.carDriver=neighbor;
      if(next.world.vetVisit?.owner===role)delete next.world.vetVisit;
      if(place==='fitness'&&next.world.fitness)delete next.world.fitness[role].visit;
      if(place==='spa'&&next.world.spa)delete next.world.spa[role];if(place==='lake'&&next.world.lake){const leaving=next.world.lake[role],remaining=next.world.lake[neighbor];if(leaving?.tent&&remaining){remaining.tent=leaving.tent;remaining.pitch=leaving.pitch;remaining.fire=leaving.fire;remaining.meals=leaving.meals;}delete next.world.lake[role];if(next.world.dogWalker===role){next.world.dogWalker=remaining?neighbor:null;if(!remaining)delete next.world.parkDog;setDogParkPosition(next);}}
      if(place==='resort')leaveResort(next,role);
      next.world.places[role]='home';
      next.world.bags[role]=0;
      next.world.tableBags=0;
      Object.assign(next.characters[role],arrival,{pose:'idle'});
      return done(next,'Вернулись домой на машине');
    }
    if(place==='fitness'||place==='clinic'||place==='spa'||place==='venue'||place==='lake'||place==='resort'){
      const exit=stationById(place,command.via);if(command.place!=='district'||exit?.id!==place+'-exit'||!at(source,role,exit))return fail('Подойди к выходу');
      const next=structuredClone(source),parking=approachFor(stationById('home','family-car')!,role),other=neighborAt('home');
      const arrival=other?unoccupiedDestination(parking,other,placeObstacles('home',source.furnishing),floorFor('home')):parking;
      if(!arrival)return fail('Парковка занята');if(place==='fitness'&&next.world.fitness)delete next.world.fitness[role].visit;if(place==='spa'&&next.world.spa)delete next.world.spa[role];if(place==='lake'&&next.world.lake){const leaving=next.world.lake[role],remaining=next.world.lake[neighbor];if(leaving?.tent&&remaining){remaining.tent=leaving.tent;remaining.pitch=leaving.pitch;remaining.fire=leaving.fire;remaining.meals=leaving.meals;}delete next.world.lake[role];if(next.world.dogWalker===role){next.world.dogWalker=remaining?neighbor:null;if(!remaining)delete next.world.parkDog;setDogParkPosition(next);}}if(place==='resort')leaveResort(next,role);next.world.places[role]='home';Object.assign(next.characters[role],arrival,{pose:'idle'});return done(next,'Вернулись домой');
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
    if(command.place==='venue')return fail('В PLAY ARENA нужно поехать вдвоём на машине');
    if(command.place==='resort')return fail('Нужна совместная аренда коттеджа');
    if(command.place==='lake')return fail('В клуб нужен оплаченный билет и поездка на машине');
    if(command.place==='spa')return fail('До SPA можно доехать на машине');
    if(command.place==='barber')return fail('До BRO можно доехать на машине');
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
      for(const line of quote.lines){const product=marketProduct(line.id)!;if(product.kind==='gift'&&isGift(product.stockKey)&&giftCount(source,product.stockKey)+pendingGifts(source,product.stockKey)+line.quantity>GIFT_LIMIT)return fail('Слишком много подарков с учётом доставки');}
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
      recordCartExpense(next, role, quote.lines, {id,fee:DELIVERY_FEE});
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
      if(item?.kind!=='takeout')return true;
      // Preserve the original arrival timestamp, but never insert a portion
      // whose selected storage lifetime has already elapsed.
      const shelf=storage==='table'?tableShelfMinutes(item.stockKey):2*MINUTES_PER_DAY;
      if(now<order.readyAt+shelf)return true;
      spoiled += item.quantity * line.quantity;
      return false;
    });
    const grant = grantCart(source, freshLines, storage, order.readyAt);
    if (!grant.ok) return fail(grant.reason + '. Оплаченный заказ подождёт у двери');
    grant.state.world.deliveries = grant.state.world.deliveries.filter(d => d.id !== order.id);
    grant.state.world.tableBags = 0; // Goods were placed in fridge/cupboard by grantCart.
    if(freshLines.length&&freshLines.every(line=>marketProduct(line.id)?.kind==='gift'))return done(grant.state,'Подарки получены. Теперь их можно вручить через меню отношений.');
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
  ...RESORT_LABELS,
 spaLocker:SPA_ACTIVITIES.spaLocker.name,spaShower:SPA_ACTIVITIES.spaShower.name,spaPool:SPA_ACTIVITIES.spaPool.name,spaJacuzzi:SPA_ACTIVITIES.spaJacuzzi.name,spaSauna:SPA_ACTIVITIES.spaSauna.name,spaLounge:SPA_ACTIVITIES.spaLounge.name,spaMassage:SPA_ACTIVITIES.spaMassage.name,
  vetExam:VET_SERVICES.vetExam.name,vetTreatment:VET_SERVICES.vetTreatment.name,vetMedicine:VET_SERVICES.vetMedicine.name,
  barberFade:BARBER_SERVICES.barberFade.name,barberShave:BARBER_SERVICES.barberShave.name,barberStyle:BARBER_SERVICES.barberStyle.name,barberFace:BARBER_SERVICES.barberFace.name,barberFull:BARBER_SERVICES.barberFull.name,
  clinicExam:CLINIC_SERVICES.clinicExam.name,clinicDiagnosis:CLINIC_SERVICES.clinicDiagnosis.name,clinicProcedure:CLINIC_SERVICES.clinicProcedure.name,clinicFollowup:CLINIC_SERVICES.clinicFollowup.name,clinicMedicine:CLINIC_SERVICES.clinicMedicine.name,
  fitnessSauna:'Сауна',fitnessTrain:'Тренировка',fitnessLocker:'Отдохнуть в раздевалке',fitnessShower:'Принять душ',fitnessToilet:'Воспользоваться туалетом',
  fitnessWater:FITNESS_BAR.fitnessWater.name,fitnessIsotonic:FITNESS_BAR.fitnessIsotonic.name,fitnessShake:FITNESS_BAR.fitnessShake.name,fitnessSmoothie:FITNESS_BAR.fitnessSmoothie.name,fitnessSnack:FITNESS_BAR.fitnessSnack.name,fitnessMeal:FITNESS_BAR.fitnessMeal.name,
  lakeView:'Любоваться озером',lakeSwim:'Купание в озере',lakeDogFetch:'Палочка для Верделла',lakeDogRoll:'Игры с Верделлом',
  lakeCookPotato:'Картофель · готовим',lakeEatPotato:'Картофель · едим',lakeCookFoil:'Рыба в фольге · готовим',lakeEatFoil:'Рыба в фольге · едим',lakeCookSkewers:'Рыбный шашлык · готовим',lakeEatSkewers:'Рыбный шашлык · едим',
  lakeToilet:'Санузел',lakeWash:'Умывание',
  lakeNap:'Отдых в палатке',lakeSleep:'Сон в палатке',lakeFireRest:'Отдых у костра',
  lakeFishFloat:'Рыбалка · удочка',lakeFishSpin:'Рыбалка · спиннинг',lakeFishFeeder:'Рыбалка · фидер',
  lakeCookFish:'Рыба на решётке · готовим',lakeCookSoup:'Уха · готовим',lakeEatFish:'Рыба · едим',lakeEatSoup:'Уха · едим',
  lakeCookSausages:'Колбаски на костре · готовим',lakeCookMarshmallow:'Маршмеллоу · готовим',lakeEatSausages:'Колбаски · едим',lakeEatMarshmallow:'Маршмеллоу · едим',
  swing:'Покачаться на качелях', badminton:'Играть в бадминтон', dogFetch:'Бросить палочку',dogChase:'Играть в догонялки',dogRoll:'Поваляться на траве',dogToilet:'Верделл в туалет',campIgnite:'Разжечь костёр',campPotato:CAMP_RECIPES.campPotato.name,campBread:CAMP_RECIPES.campBread.name,campSkewers:CAMP_RECIPES.campSkewers.name,campMarshmallow:CAMP_RECIPES.campMarshmallow.name, picnic: 'Поесть на пикнике',
  rest: 'Отдохнуть на скамье', exercise: 'Зарядка на свежем воздухе', dine: 'Посидеть за столиком',
  dogHurdle:'Верделл · низкий барьер',dogTunnel:'Верделл · тоннель',dogSlalom:'Верделл · змейка',dogBalance:'Верделл · балансир',
  dog: 'Поиграть с Верделлом', unpack: 'Разобрать покупки',
};

export function localActivity(source: GameState, role: CharacterId, action: LocalActivity, id: string, support:AgilitySupport={}): Result {
  const place = source.world.places[role];
  const station = stationById(place, id);
  if(isResortAction(action)){
    const d=RESORT_ACTIONS[action];if(!resortAccess(source,role)||station?.action.kind!=='resort'||station.action.facility!==d.facility||!at(source,role,station))return fail('Нужна действующая аренда и подход к месту отдыха');
    const meal=d.meal as ResortMeal|undefined,key=meal?resortMealKey(source,role,meal):undefined;if(meal&&!key)return fail('Питание сейчас недоступно или уже получено');
    if(action==='resortLake'&&(weatherAt(source.clock).temp<20||source.characters[role].energy<20)||action==='resortPool'&&source.characters[role].energy<15)return fail('Для купания нужны тепло и силы');
    const visit=source.world.resort!;if(d.cook&&(!(visit.raw?.[d.cook])||(visit.cooked?.[d.cook]??0)>4))return fail('Нужен купленный набор и место для двух порций');if(d.eat&&!visit.cooked?.[d.eat])return fail('Сначала приготовьте шашлык');if(d.drink&&(source.money<RESORT_DRINKS[d.drink].price||RESORT_DRINKS[d.drink].alcohol&&resortAlcoholCount(source,role)>=3))return fail('Недостаточно денег или лимит алкогольных напитков на сегодня');
    const next=structuredClone(source),c=next.characters[role],v=next.world.resort!;c.pose='idle';if(d.cook){v.raw![d.cook]!--;const stock=v.cooked??={};stock[d.cook]=(stock[d.cook]??0)+2;c.mood=Math.min(100,c.mood+8);practiceXP(next,role,'resort-grill','cooking','Шашлык на курорте',8,12);}else if(d.eat){v.cooked![d.eat]!--;c.hunger=Math.min(100,c.hunger+RESORT_GRILL[d.eat].hunger);c.mood=Math.min(100,c.mood+25);c.comfort=Math.min(100,c.comfort+20);}else if(d.drink){const drink=RESORT_DRINKS[d.drink];next.money-=drink.price;if(drink.price)addLedger(next,role,'expense','services',drink.price,'Бар · '+drink.name);if(drink.alcohol){(v.bar??={})[role]={day:next.clock.day,alcohol:resortAlcoholCount(source,role)+1};c.energy=Math.max(0,c.energy-5);}else if(d.drink==='coffee')c.energy=Math.min(100,c.energy+12);c.mood=Math.min(100,c.mood+(drink.alcohol?18:12));c.comfort=Math.min(100,c.comfort+10);}else if(key){(next.world.resort!.eaten[role]??=[]).push(key);c.hunger=100;c.mood=Math.min(100,c.mood+30);c.comfort=Math.min(100,c.comfort+25);}else if(action==='resortSleep'){c.energy=Math.min(100,c.energy+75);}else if(action==='resortWash'){c.hygiene=Math.min(100,c.hygiene+12);}else{c.fun=Math.min(100,c.fun+25);c.mood=Math.min(100,c.mood+20);c.comfort=Math.min(100,c.comfort+30);if(action==='resortLake'||action==='resortPool')c.energy=Math.max(0,c.energy-10);}
    return done(next,d.name+' · готово');
  }
  if(isLakeLeisureAction(action)){
    if(!lakeAccess(source,role)||station?.action.kind!=='lake'||station.action.facility!==LAKE_LEISURE[action].facility||!at(source,role,station))return fail('Подойди к подходящей зоне клуба');
    const walker=source.world.dogWalker;
    if(action==='lakeSwim'&&(!lakeCanSwim(source)||source.characters[role].energy<20))return fail('Купание только в тёплую погоду и при достаточной энергии');
    const dog=action==='lakeDogFetch'||action==='lakeDogRoll';
    if(dog&&(!walker||source.world.places[walker]!=='lake'||Math.hypot(source.characters[walker].x-station.center.x,source.characters[walker].z-station.center.z)>4))return fail('Позови Верделла на лужайку');
    const next=structuredClone(source),c=next.characters[role];c.pose='idle';
    c.fun=Math.min(100,c.fun+(action==='lakeSwim'?35:dog?25:20));c.mood=Math.min(100,c.mood+15);
    if(action==='lakeSwim'){c.energy=Math.max(0,c.energy-12);practiceXP(next,role,'lake-swim','fitness','Плавание',8,12);}
    else if(action==='lakeView'){c.comfort=Math.min(100,c.comfort+15);}
    else if(dog){const p=next.pets.verdell;p.happiness=Math.min(100,p.happiness+25);p.bond=Math.min(100,p.bond+10);p.energy=Math.max(0,p.energy-6);}
    return done(next,LAKE_LEISURE[action].name+' · готово');
  }
  if(isLakeCareAction(action)){
    if(!lakeAccess(source,role)||station?.action.kind!=='lake'||station.action.facility!==LAKE_CARE[action].facility||!at(source,role,station))return fail('Подойди к санузлу или умывальнику');
    const next=structuredClone(source),c=next.characters[role];if(action==='lakeToilet')c.bladder=100;else c.hygiene=Math.min(100,c.hygiene+35);c.pose='idle';return done(next,LAKE_CARE[action].name+' · готово');
  }
  if(isLakeRestAction(action)){
    const visit=source.world.lake?.[role],camp=lakeCampFor(source,id),byFire=action==='lakeFireRest';
    if(!lakeAccess(source,role)||station?.action.kind!=='lake'||station.action.facility!==(byFire?'fire':'pitch')||!at(source,role,station)||!camp?.tent)return fail('Нужен билет и установленная палатка');
    if(action==='lakeSleep'&&(visit?.pass==='day'||camp.pass==='day'))return fail('Для сна нужен билет с ночёвкой');
    if(byFire&&!camp.fire)return fail('Сначала разожгите костёр');
    const next=structuredClone(source),c=next.characters[role],tent=LAKE_TENTS[camp.tent],d=LAKE_REST[action];
    c.energy=Math.min(100,c.energy+d.energy);c.comfort=Math.min(100,c.comfort+(byFire?18:tent.comfort));c.mood=Math.min(100,c.mood+(byFire?20:tent.mood));c.fun=Math.min(100,c.fun+(byFire?25:5));c.pose='idle';
    if(!byFire&&next.world.dogWalker&&next.world.places[next.world.dogWalker]==='lake'&&Math.hypot(next.characters[next.world.dogWalker].x-station.center.x,next.characters[next.world.dogWalker].z-station.center.z)<4)next.pets.verdell.energy=Math.min(100,next.pets.verdell.energy+(action==='lakeSleep'?45:15));
    return done(next,d.name+' · отдых завершён');
  }
  if(isLakeFishAction(action)){
    const visit=source.world.lake?.[role];if(!lakeAccess(source,role)||station?.action.kind!=='lake'||station.action.facility!=='fish'||!at(source,role,station)||visit?.rod!==FISH_ACTIONS[action]||visit.catch)return fail('Нужен билет, снасть и свободный выбор улова');
    const next=structuredClone(source),v=next.world.lake![role]!,stock=next.world.fishing??=emptyFishing(),c=next.characters[role];
    const fish=rollFish(v.rod!,clockMinutes(next.clock),Math.random,!!v.bait);c.fun=Math.min(100,c.fun+12);c.comfort=Math.min(100,c.comfort+5);
    if(!fish)return done(next,'Рыба сорвалась или не клюнула. Можно забросить снова');
    recordCatch(next,role,fish);
    v.catch=fish;stock.record[role]=Math.max(stock.record[role]??0,fish.grams);if(!stock.species.includes(fish.species))stock.species.push(fish.species);
    c.mood=Math.min(100,c.mood+10);return done(next,'Улов: '+fishLabel(fish)+' · забрать или отпустить');
  }
  if(isLakeMealAction(action)){
    if(place!=='lake'||!lakeAccess(source,role)||station?.action.kind!=='lake'||station.action.facility!=='fire'||!at(source,role,station))return fail('Нужен действующий билет и подход к костру');
    const next=structuredClone(source),camp=Object.values(next.world.lake!).find(v=>v.pitch===id.replace('lake-fire-','lake-pitch-'));
    if(!camp||camp.until<=clockMinutes(source.clock))return fail('Сначала установите палатку');
    const {meal,cook}=LAKE_MEAL_ACTIONS[action],d=LAKE_MEALS[meal],stock=camp.meals??={};
    if(cook){
      if(!camp.fire)return fail('Разожги костёр');
      if((stock[meal]??0)>2)return fail('Сначала съешьте готовые порции');
      if(next.money<d.price)return fail('Недостаточно денег на продукты');
      if(lakeNeedsFish(meal)){const fish=freshFish(next);if(!fish.length)return fail('Сначала поймайте и заберите рыбу');next.world.fishing!.fish=fish.slice(1);}
      next.money-=d.price;addLedger(next,role,'expense','takeout',d.price,'Кемпинг · '+d.name);
      stock[meal]=(stock[meal]??0)+2;next.characters[role].mood=Math.min(100,next.characters[role].mood+8);
      return done(next,d.name+' · 2 порции готовы');
    }
    if(!stock[meal])return fail('Сначала приготовьте блюдо');
    stock[meal]!--;const c=next.characters[role];c.hunger=Math.min(100,c.hunger+d.hunger);c.mood=Math.min(100,c.mood+d.mood);c.comfort=Math.min(100,c.comfort+8);c.fun=Math.min(100,c.fun+10);c.pose='idle';
    return done(next,d.name+' · съедено');
  }
  if(isSpaAction(action)){
 if(place!=='spa'||station?.action.kind!=='spa'||station.action.facility!==action||!at(source,role,station))return fail('Подойди к нужной зоне SPA');
 if((action==='spaLocker'||action==='spaShower')&&!id.endsWith('-'+role[0]))return fail('Выбери свою раздевалку или душ');
 const denial=spaDenial(source,role,action);if(denial)return fail(denial);const next=structuredClone(source);
 if(action==='spaMassage'&&next.world.spa![role]!.pass!=='package'&&!next.world.spa![role]!.progress?.[action]){next.money-=SPA_MASSAGE_PRICE;addLedger(next,role,'expense','services',SPA_MASSAGE_PRICE,'SPA · Массаж');}
 finishSpa(next,role,action);creditWeekendSpa(next);return done(next,SPA_ACTIVITIES[action].name+' · готово');
 }
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
  if(isBarberAction(action)){if(place!=='barber'||id!=='barber-chair'||!station||!at(source,role,station))return fail('Подойди к креслу барбера');const reason=barberDenial(source,role,action);if(reason)return fail(reason);const next=structuredClone(source),d=BARBER_SERVICES[action];next.money-=d.price;addLedger(next,role,'expense','services',d.price,'BRO · '+d.name);finishBarber(next,action);next.characters[role].pose='idle';return done(next,d.name+' · готово');}
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
  if(isDogAgility(action)){const walker=source.world.dogWalker;if(place!=='park'||!walker||!station||Math.hypot(source.characters[walker].x-station.center.x,source.characters[walker].z-station.center.z)>4.5)return fail('Позови Верделла на площадку');if(!agilityReady(source.pets.verdell))return fail('Верделлу нужен отдых, еда или туалет');}
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
      const bonus=applyFavoriteMeal(next,role,'cafe',order.item);
      delete next.world.cafe[role];
      if(bonus)return done(next,meal.name+' · любимое блюдо +'+bonus+' настроения');
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
    const bonus=applyFavoriteMeal(next,role,food.kind,food.item,food.quality);
    return done(next,'Пикник: '+picnicName(food)+(bonus?' · любимое блюдо +'+bonus+' настроения':''));
  } else if(action==='swing'){bump('comfort',24);bump('fun',24);bump('mood',15);bump('energy',5);
  } else if (action === 'badminton') {
    bump('fun', 25); bump('mood', 10); bump('comfort', 8); bump('energy', -3);
  } else if (action === 'exercise') {
    bump('fun', 13); bump('mood', 6); bump('energy', -4);
  } else if (isParkDogAction(action)) {
    const dog = next.pets.verdell;
    if(isDogAgility(action)){
      const visit=next.world.parkDog??={minutes:0,toilets:0};const stats=visit.agility??={attempts:0,independent:0};const independent=finishAgility(dog,stats,role,action,support);if(support.helper&&next.world.places[support.helper]==='park'){const c=next.characters[support.helper];c.fun=Math.min(100,c.fun+5);c.mood=Math.min(100,c.mood+3);}bump('fun',12);bump('mood',5);bump('energy',-2);return done(next,DOG_AGILITY[action].name+' · '+(independent?'Верделл справился сам!':'Прошёл с подсказкой хозяина')+' · тренировка команды'+(support.helper?' · вместе':''));
    }
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
