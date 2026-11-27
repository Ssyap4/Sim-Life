import {validCollections} from '../src/shared/personalCollections';
import {validDailyHistory} from '../src/shared/dailyRoutine';
import {validFamilyLife,initialFamilyLife} from '../src/shared/familyLife';
import {validWeekendState,initialWeekends} from "../src/shared/weekends";
import {validBarberBooking} from '../src/shared/barber';
import {validGifts} from '../src/shared/gifts';
import {validVanity} from '../src/shared/vanity';
import {validFurniturePreferences,validEvent} from '../src/shared/petPreferences';
import {validFeeder,feedingStation} from '../src/shared/petFeeders';
import {validTraining,validTrainingAttempt} from '../src/shared/dogTraining';
import { homeToysFor,homeToyApproach } from '../src/shared/pets';
import {validToyExtras,toyOwned} from '../src/shared/petToys';
import { DISTRICT_FLOOR, HOME_WORLD_FLOOR, DISTRICT_SITES, districtArrival, inHomeGrounds, restoreDistrictPosition } from '../src/shared/district';
import { initialRelationship } from '../src/shared/socialLife';
import { INITIAL_AUTONOMY, validAutonomy } from '../src/shared/autonomy';
import { validRelationship } from './society';
import { initialServices } from '../src/shared/services';
import { validBilling } from './services';
import { validWorld } from './locations';
import { floorFor, clockMinutes, initialWorld, placeObstacles, spawn, type PlaceId } from '../src/shared/locations';
import { HOME_FLOOR } from '../src/shared/home';
import { nearestClearPoint, pointIsClear, segmentIsClear } from '../src/game/navigation';
import { petNavigationGeometry } from '../src/game/PetNavigation';
import { randomBytes } from 'node:crypto';
import { copyFileSync, existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { initialState, points, type CharacterId, type CharacterState, type GameState } from '../src/shared/protocol';
import { EMPTY_MEALS, EMPTY_PANTRY, EMPTY_TAKEOUT } from '../src/shared/food';
import { newCoffeeDaily, COFFEE_CUPS_PER_DAY } from '../src/shared/coffee';
import { isReadyFoodBatch, reconcileReadyFood } from '../src/shared/readyFood';
import { EMPTY_DIRTY_DISHES, validDirtyDishes } from '../src/shared/dirtyDishes';
import { LEDGER_LIMIT } from '../src/shared/economy';
import { validFamilyBudget, restoreFamilyBudget } from '../src/shared/familyBudget';
import { validHomeQuests } from "../src/shared/homeJobQuests";
import { JOBS, isJobId, isHomeJob, HOME_JOBS, validShiftPay } from '../src/shared/jobs';
import { validPetFoodExtras } from "../src/shared/petShop";
import { INITIAL_PETS, INITIAL_PET_FOOD, INITIAL_PET_BOWLS, PET_IDS, PET_ROAM, PET_ROUTINES,
  PET_BOWL_CAPACITY, PET_FOOD_MAX_REFILLS, petDestination, type PetId, type PetState } from '../src/shared/pets';
import { INITIAL_CLOCK, INITIAL_DAILY_NEEDS } from '../src/shared/life';
import { currentCatPerch } from '../src/shared/CatPerches';
import {currentPetEquipment,petBeds,isPetBed,isPetScratcher} from '../src/shared/petFurniture';
import { BOOKS } from '../src/shared/homeLife';
import { migrateEducation, validEducation } from './education';
import { recoverCareers, validCareers } from './careers';
import { initialCareers } from '../src/shared/careers';
import { initialComputerLibrary, validComputerLibrary } from '../src/shared/computerGames';
import { emptyFurnishing, isValidFurnishing, type FurnishingState } from '../src/shared/furniture';

export interface ServerFiles {
  dataDir: string;
  access: Record<CharacterId, string>;
  load(): GameState;
  save(state: GameState): void;
}

import { initialHappiness, validHappiness, protectNeeds } from '../src/shared/happiness';

import {validEmotionalHistory} from '../src/shared/emotions';
import {validHealth} from '../src/shared/health';
import {initialDust,validDust} from '../src/shared/homeDust';
import {migrateSpeakerMounts} from '../src/shared/speakerPlacement';
import {validSpeakers} from '../src/shared/speaker';
import {validVacuum} from '../src/shared/vacuum';
import {validConsoleLibrary} from '../src/shared/consoleCatalog';
const isValidState = (value: unknown): value is GameState => {
  if (!value || typeof value !== 'object') return false;
  const state = value as Partial<GameState>;
  if (state.version !== 2 || !Number.isSafeInteger(state.revision) ||
      !Number.isSafeInteger(state.money) || state.money! < 0 ||
      !state.pantry || !state.characters) return false;
  if(state.weekends!==undefined&&!validWeekendState(state.weekends))return false;
  if(state.familyLife!==undefined&&!validFamilyLife(state.familyLife))return false;
  if(state.speakers!==undefined&&!validSpeakers(state.speakers))return false;
  if(state.vacuum!==undefined&&!validVacuum(state.vacuum))return false;
  if(state.vanity!==undefined&&!validVanity(state.vanity))return false;
  if(state.barberBooking!==undefined&&!validBarberBooking(state.barberBooking))return false;
  if(state.gifts!==undefined&&!validGifts(state.gifts))return false;
  if(state.vladCare!==undefined&&!validVanity(state.vladCare,'vlad'))return false;
  if(state.health!==undefined&&!validHealth(state.health))return false;
  if(state.consoleLibrary!==undefined&&!validConsoleLibrary(state.consoleLibrary))return false;
  if(state.homeDust!==undefined&&!validDust(state.homeDust))return false;
  if(state.kitchenWindowOpen!==undefined&&typeof state.kitchenWindowOpen!=='boolean')return false;
  if(state.kitchenCurtainsClosed!==undefined&&typeof state.kitchenCurtainsClosed!=='boolean')return false;
  if (state.emotionalEvents !== undefined && !validEmotionalHistory(state.emotionalEvents)) return false;
  if (state.happiness !== undefined && !validHappiness(state.happiness)) return false;
  if (state.billing !== undefined && !validBilling(state.billing)) return false;
  if (state.savings !== undefined && !validFamilyBudget(state.savings)) return false;
  if (state.relationship !== undefined && !validRelationship(state.relationship)) return false;
  if (state.personalCollections !== undefined && !validCollections(state.personalCollections)) return false;
  if (state.dailyHistory !== undefined && !validDailyHistory(state.dailyHistory)) return false;
  if (state.autonomy !== undefined && !validAutonomy(state.autonomy)) return false;
  if (state.education !== undefined && !validEducation(state.education)) return false;
  if (state.careers !== undefined && !validCareers(state.careers)) return false;
  if (state.computerLibrary !== undefined && !validComputerLibrary(state.computerLibrary)) return false;
  if (state.furnishing !== undefined && !isValidFurnishing(state.furnishing)) return false;
  if (state.world !== undefined && !validWorld(state.world)) return false;
  const readBooks = state.readBooks;
  if (readBooks !== undefined && (!readBooks || !(['vlad', 'alina'] as const).every(role => {
    const books = readBooks[role];
    return Array.isArray(books) && books.length <= Object.keys(BOOKS).length &&
      new Set(books).size === books.length && books.every(id => typeof id === 'string' && Object.hasOwn(BOOKS, id));
  }))) return false;
  // A clock was added to existing version-2 households; never reset old saves.
  if (state.clock !== undefined && (!Number.isSafeInteger(state.clock.day) || state.clock.day < 1 ||
      !Number.isSafeInteger(state.clock.minute) || state.clock.minute < 0 ||
      state.clock.minute >= 1440)) return false;
  if (state.coffeeDaily !== undefined && (!state.coffeeDaily ||
    !(['vlad', 'alina'] as const).every(role => {
      const record = state.coffeeDaily?.[role];
      return record && Number.isSafeInteger(record.day) && record.day >= 0 &&
        Number.isSafeInteger(record.cups) && record.cups >= 0 && record.cups <= COFFEE_CUPS_PER_DAY;
    }))) return false;
  if (state.readyFood !== undefined && (!Array.isArray(state.readyFood) || state.readyFood.length > 180 ||
    !state.readyFood.every(isReadyFoodBatch))) return false;
  // Legacy version-2 saves have no dish counter; a missing value migrates to zero.
  if (state.dirtyDishes !== undefined && !validDirtyDishes(state.dirtyDishes)) return false;
  const pantry = state.pantry as Record<string, unknown>;
  const meals = state.meals as Record<string, unknown> | undefined;
  if (!Number.isSafeInteger(pantry.eggs) || Number(pantry.eggs) < 0 ||
      !Number.isSafeInteger(pantry.bread) || Number(pantry.bread) < 0) return false;
  // Older version-2 saves only had eggs and bread; missing catalogue keys are
  // handled by load() without ever discarding their money, skills or progress.
  if (!Object.keys(EMPTY_PANTRY).every((key) => pantry[key] === undefined ||
    Number.isSafeInteger(pantry[key]) && Number(pantry[key]) >= 0 && Number(pantry[key]) <= 99)) return false;
  if (meals !== undefined && (!meals || !Object.keys(EMPTY_MEALS).every((key) =>
    meals[key] === undefined || Number.isSafeInteger(meals[key]) &&
      Number(meals[key]) >= 0 && Number(meals[key]) <= 30))) return false;
  const takeout = state.takeout as Record<string, unknown> | undefined;
  if (takeout !== undefined && (!takeout || !Object.keys(EMPTY_TAKEOUT).every(key =>
    takeout[key] === undefined || Number.isSafeInteger(takeout[key]) &&
      Number(takeout[key]) >= 0 && Number(takeout[key]) <= 40))) return false;
  const shifts = state.shiftDays as Record<string, number> | undefined;
  if (shifts !== undefined && (!shifts ||
      !(['vlad','alina'] as const).every(role =>
        Number.isSafeInteger(shifts[role]) && shifts[role] >= 0))) return false;
  if (state.ledger !== undefined && (!Array.isArray(state.ledger) ||
      state.ledger.length > LEDGER_LIMIT ||
      !state.ledger.every(row => row && Number.isSafeInteger(row.id) && row.id > 0 &&
        Number.isSafeInteger(row.day) && row.day >= 1 &&
        Number.isSafeInteger(row.minute) && row.minute >= 0 && row.minute < 1440 &&
        Number.isSafeInteger(row.amount) && row.amount >= 0 &&
        (row.actor === 'vlad' || row.actor === 'alina' || row.actor === 'family') &&
        (row.kind === 'income' || row.kind === 'expense') &&
        ['groceries','takeout','pets','work','services','education','furniture','clothing','electronics','gifts'].includes(row.category) &&
        typeof row.label === 'string' && row.label.length <= 140))) return false;
  const activeShifts=state.activeShifts as Record<string, unknown> | undefined;
  if (activeShifts !== undefined && (!activeShifts || Array.isArray(activeShifts) ||
    Object.keys(activeShifts).some(role => role !== 'vlad' && role !== 'alina') ||
    !Object.entries(activeShifts).every(([role,raw]) => {
      if (!raw || typeof raw !== 'object') return false;
      const shift=raw as Record<string, unknown>;
      if (!isJobId(shift.job)) return false;
      if(isHomeJob(shift.job)){
        if(HOME_JOBS[shift.job].owner!==role||!["desktop","laptop"].includes(String(shift.homeDevice))||role==="vlad"&&shift.homeDevice!=="desktop")return false;
        if(shift.homeSpeed!==undefined&&(typeof shift.homeSpeed!=="number"||!(shift.homeDevice==="desktop"?[0,10,18,25]:[0,8,15,22]).includes(shift.homeSpeed)))return false;
      }else if(shift.homeDevice!==undefined||shift.homeSpeed!==undefined)return false;
      if(shift.coffeeServed!==undefined&&(!isHomeJob(shift.job)||typeof shift.coffeeServed!=='boolean'))return false;
      if(!validHomeQuests(shift))return false;
      const hours=shift.hours;
      return Number.isSafeInteger(hours) &&
        Number(hours) >= (isHomeJob(shift.job)?2:JOBS[shift.job].hoursMin) &&
        Number(hours) <= (shift.job==='ozon'||shift.job==='wildberries'?16:JOBS[shift.job].hoursMax) &&
        Number.isSafeInteger(shift.startedAt) && Number(shift.startedAt) >= 0 &&
        Number.isSafeInteger(shift.endsAt) &&
        Number(shift.endsAt) === Number(shift.startedAt) + Math.round(Number(hours)*60*(100-Number(shift.homeSpeed??0))/100) &&
        (shift.targetPay === undefined ||
          validShiftPay(shift.job,shift.targetPay));
    }))) return false;
  // Pet fields were introduced after version 2 shipped; old saves may omit them.
  const petData = state.pets as Record<string, PetState> | undefined;
  const petFood = state.petFood as Record<string, number> | undefined;
  const petBowls = state.petBowls as Record<string, number> | undefined;
  const point = (p: { x: number; z: number } | undefined, place: PlaceId = 'home', legacyHome=false) => {
    const { minX, maxX, minZ, maxZ } = String(place)==='street' ? DISTRICT_FLOOR : legacyHome&&place==='home'?HOME_WORLD_FLOOR:floorFor(place);
    return p && Number.isFinite(p.x) && Number.isFinite(p.z) &&
      p.x >= minX - .38 && p.x <= maxX + .38 && p.z >= minZ - .38 && p.z <= (place === 'home' ? maxZ : Math.max(maxZ, 5));
  };
  if (petData !== undefined && (!petData || !PET_IDS.every((id) => {
    const pet = petData[id];
    const validMeter = (n: number) => Number.isFinite(n) && n >= 0 && n <= 100;
    const routine = pet?.routine;
    return pet && validFurniturePreferences(pet,id) && (pet.lastEventAt===undefined||Number.isSafeInteger(pet.lastEventAt)&&pet.lastEventAt>=0) && validFeeder(pet,id) && (id==='verdell'?(pet.cleanliness===undefined||validMeter(pet.cleanliness)):pet.cleanliness===undefined) && validTraining(pet,id) && validToyExtras(pet,id) && validPetFoodExtras(pet,id,petFood?.[id]??0,petBowls?.[id]??0) && [pet.satiety, pet.happiness, pet.bond].every(validMeter) &&
      (pet.energy === undefined || validMeter(pet.energy)) && (pet.bladder === undefined || validMeter(pet.bladder)) &&
      (pet.position === undefined || point(pet.position)) && (pet.parkPosition === undefined || point(pet.parkPosition, 'park')||point(pet.parkPosition,'district')||point(pet.parkPosition,'lake')) &&
      (pet.treats===undefined||Number.isSafeInteger(pet.treats.day)&&pet.treats.day>=1&&Number.isSafeInteger(pet.treats.used)&&pet.treats.used>=0&&pet.treats.used<=3) &&
      (pet.favoriteBedId===undefined||Number.isSafeInteger(pet.favoriteBedId)&&pet.favoriteBedId>0) &&
      (routine === undefined || routine && PET_ROUTINES.includes(routine.kind) &&
        Number.isSafeInteger(routine.startedAt) && routine.startedAt >= 0 && Number.isSafeInteger(routine.until) &&
        routine.until > routine.startedAt && Number.isSafeInteger(routine.target) && routine.target >= 0 && routine.target < PET_ROAM.length &&
        routine.route && point(routine.route.from) && Array.isArray(routine.route.path) && routine.route.path.length <= 60 &&
        routine.route.path.every(p => point(p)) &&
        ((routine.kind!=='come'&&routine.kind!=='fetch'&&routine.kind!=='scratch') ||
          routine.target===0 && point(routine.goal) &&
          (routine.kind!=='fetch'||point(routine.fetchPoint) &&
            Number.isFinite(routine.fetchPickupDistance) &&
            Number(routine.fetchPickupDistance)>=0 && Number(routine.fetchPickupDistance)<=40)) &&
        (routine.equipment===undefined||routine.equipment&&
          Number.isSafeInteger(routine.equipment.id)&&routine.equipment.id>0&&
          Number.isFinite(routine.equipment.x)&&Number.isFinite(routine.equipment.z)&&
          [0,1,2,3].includes(routine.equipment.rotation)&&
          (routine.kind==='scratch'&&id==='simba'&&isPetScratcher(routine.equipment.sku)||
          routine.kind==='sleep'&&isPetBed(routine.equipment.sku,id)||routine.kind==='bedTogether'&&id==='verdell'&&routine.equipment.sku==='pet-bed-stairs')&&
          routine.target===0&&point(routine.goal)) &&
        (routine.training===undefined?routine.kind!=='train':id==='verdell'&&validTrainingAttempt(routine.training)&&routine.target===0&&point(routine.goal)&&(routine.kind==='train'||routine.kind==='fetch'&&routine.training.command==='fetch'&&routine.training.success)) &&
        (routine.kind==='event'?validEvent(routine.event,id)&&routine.target<2&&point(routine.goal):routine.event===undefined) &&
        (routine.kind==='bedTogether'?id==='verdell'&&!!routine.equipment&&!!routine.dogBed&&typeof routine.dogBed.joined==='boolean'&&(routine.dogBed.bed==='starter'||Number.isSafeInteger(routine.dogBed.bed)&&routine.dogBed.bed>0)&&point(routine.goal):routine.dogBed===undefined) &&
        (routine.kind!=='bath'||id==='verdell'&&routine.target===0&&point(routine.goal)) &&
        (routine.kind!=='beg'||routine.target<2&&point(routine.goal)) &&
        (routine.kind!=='scratch'||routine.equipment!==undefined) &&
        (routine.kind!=='toy'||(()=>{const toy=homeToysFor(id)[routine.target];return !!toy&&(!('id' in toy)||toyOwned(pet,toy.id))&&point(routine.goal)&&Math.hypot(routine.goal!.x-homeToyApproach(id,routine.target).x,routine.goal!.z-homeToyApproach(id,routine.target).z)<.03;})()) &&
        (routine.kind!=='perch' || id==='simba' && routine.target===0 &&
          routine.perch && typeof routine.perch.key==='string' &&
          point(routine.perch.approach) && point(routine.perch.surface) &&
          Number.isFinite(routine.perch.surface.y) && routine.perch.surface.y>=.20 &&
          routine.perch.surface.y<=1.5 && Number.isFinite(routine.perch.yaw)));

  }))) return false;
  if (petFood !== undefined && (!petFood || !PET_IDS.every((id) =>
    Number.isSafeInteger(petFood[id]) && petFood[id] >= 0 && petFood[id] <= PET_FOOD_MAX_REFILLS))) return false;
  if (petBowls !== undefined && (!petBowls || !PET_IDS.every(id =>
    Number.isSafeInteger(petBowls[id]) && petBowls[id] >= 0 && petBowls[id] <= PET_BOWL_CAPACITY))) return false;
  return (['vlad', 'alina'] as const).every((role) => {
    const p = state.characters?.[role];
    if (!p) return false;
    return (['hunger', 'energy', 'mood', 'skill'] as const).every((key) =>
      typeof p[key] === 'number' && Number.isFinite(p[key]) && p[key] >= 0 && p[key] <= 100,
    ) && (['hygiene', 'social', 'fun', 'comfort', 'bladder'] as const).every((key) =>
      p[key] === undefined || typeof p[key] === 'number' && Number.isFinite(p[key]) &&
        p[key] >= 0 && p[key] <= 100,
    ) && point(p, state.world?.places[role] ?? 'home',state.world?.districtLayout!==4) &&
      ['idle', 'sit', 'sleep', 'work'].includes(p.pose);
  });
};

const homeObstacles = placeObstacles('home');
const safePetHome = petNavigationGeometry(homeObstacles, HOME_FLOOR);

const previousSeats = [
  { item: 'bed', pose: 'sleep', x: -4.30, z: -1.40 },
  { item: 'desk', pose: 'work', x: 4.58, z: 3.26 },
  { item: 'sofa', pose: 'sit', x: -3.48, z: .66 },
  { item: 'table', pose: 'sit', x: 3.02, z: -.26 },
] as const;

const legacyHomeGrounds=(p:{x:number;z:number})=>p.x>=-9.18&&p.x<=15.34&&p.z>=-7.28&&p.z<=12.06;
function restoreResident(saved: CharacterState, role: CharacterId, place: PlaceId,
  furnishing: FurnishingState, districtLayout: 1 | 2 | 3 | 4 | undefined): CharacterState {
  const resident = { ...INITIAL_DAILY_NEEDS, ...saved };
  if (String(place)==='street' && (districtLayout===undefined || districtLayout===1)) {
    Object.assign(resident,restoreDistrictPosition(resident,role,districtLayout),{pose:'idle'});
    return resident;
  }
  if(place==='home'&&(districtLayout===2||districtLayout===3)&&!legacyHomeGrounds(resident)){
    const target=districtLayout===2?DISTRICT_SITES.map(site=>districtArrival(site.place,role))
      .sort((a,b)=>Math.hypot(a.x-resident.x,a.z-resident.z)-Math.hypot(b.x-resident.x,b.z-resident.z))[0]:resident;
    const point=nearestClearPoint(target,placeObstacles('district'),floorFor('district'))??spawn('district',role);
    return {...resident,...point,pose:'idle'};
  }
  if (place === 'market'||place==='district') {
    // Preserve saved positions except where a newly added solid occupies them.
    const point = nearestClearPoint(resident, placeObstacles(place), floorFor(place)) ?? spawn(place, role);
    return { ...resident, x: point.x, z: point.z };
  }
  if (place !== 'home') return resident;
  const movedSeat = previousSeats.find(seat =>
    resident.pose === seat.pose && Math.hypot(resident.x - seat.x, resident.z - seat.z) < .12);
  const nearEntrance = districtLayout===2 && !inHomeGrounds(resident)
    ? DISTRICT_SITES.map(site=>districtArrival(site.place,role))
      .sort((a,b)=>Math.hypot(a.x-resident.x,a.z-resident.z)-Math.hypot(b.x-resident.x,b.z-resident.z))[0]
    : spawn('home',role);
  const point = movedSeat ? points[movedSeat.item]
    : nearestClearPoint(resident, placeObstacles('home', furnishing),
      (districtLayout===undefined || districtLayout===1) && inHomeGrounds(resident) ? HOME_FLOOR : floorFor('home')) ?? nearEntrance;
  return { ...resident, x: point.x, z: point.z };
}

function restorePet(id: PetId, saved: PetState | undefined,
  safeHome = safePetHome, furnishing?: import('../src/shared/furniture').FurnishingState): PetState {
  const pet = { ...INITIAL_PETS[id], ...saved };
  // Old positions or animation routes may now graze an enlarged pet collider,
  // or refer to a bowl/bench/roaming stop removed from the current layout.
  // Repair only the spatial data; never reset affection, hunger or food stock.
  pet.position = nearestClearPoint(pet.position, safeHome.obstacles, safeHome.floor)
    ?? INITIAL_PETS[id].position;
  if(pet.favoriteBedId!==undefined&& (!furnishing||
    !petBeds(furnishing,id).some(item=>item.id===pet.favoriteBedId)))
    delete pet.favoriteBedId;
  if(pet.furnitureYield&&(!furnishing||!currentCatPerch(furnishing,pet.furnitureYield.perch)||
    !Number.isFinite(pet.furnitureYield.clearAt)||!Number.isFinite(pet.furnitureYield.cooldownUntil)))delete pet.furnitureYield;
  if(pet.routine?.kind==='bath'||pet.routine?.kind==='bedTogether')delete pet.routine;
  const route = pet.routine?.route;
  if (route && pet.routine) {
    const invalidPerch=pet.routine.kind==='perch' &&
      (id!=='simba'||!pet.routine.perch||!furnishing||!currentCatPerch(furnishing,pet.routine.perch));
    const invalidEquipment=pet.routine.equipment &&
      (!furnishing||!currentPetEquipment(furnishing,pet.routine.equipment));
    const expected = pet.routine.kind==='eat'&&furnishing?feedingStation(furnishing,id).goal:petDestination(id, pet.routine);
    const last = route.path.at(-1) ?? route.from;
    if (invalidPerch || invalidEquipment || Math.hypot(last.x - expected.x, last.z - expected.z) > .08 ||
      !pointIsClear(route.from, safeHome.obstacles, safeHome.floor) ||
      !route.path.every((point, index) =>
        segmentIsClear(route.path[index - 1] ?? route.from, point, safeHome.obstacles, safeHome.floor))) {
      delete pet.routine;
    }
  }
  return pet;
}

export function openServerFiles(dataDir: string): ServerFiles {
  mkdirSync(dataDir, { recursive: true });
  const accessPath = join(dataDir, 'access.json');
  let access: Record<CharacterId, string>;
  if (existsSync(accessPath)) {
    const saved: unknown = JSON.parse(readFileSync(accessPath, 'utf8'));
    if (!saved || typeof saved !== 'object') throw new Error('Invalid access.json');
    const record = saved as Record<string, unknown>;
    if (typeof record.vlad !== 'string' || record.vlad.length < 12 ||
        typeof record.alina !== 'string' || record.alina.length < 12) {
      throw new Error('Invalid access.json credentials');
    }
    access = { vlad: record.vlad, alina: record.alina };
  } else {
    access = {
      vlad: randomBytes(10).toString('hex').toUpperCase(),
      alina: randomBytes(10).toString('hex').toUpperCase(),
    };
    writeFileSync(accessPath, JSON.stringify(access, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
  }
  const statePath = join(dataDir, 'household.json');

  return {
    dataDir, access,
    load(): GameState {
      if (!existsSync(statePath)) return initialState();
      const data: unknown = JSON.parse(readFileSync(statePath, 'utf8'));
      if (!isValidState(data)) throw new Error('Saved household is invalid. Refusing to discard player progress.');
      const savedFurnishing = {...(data.furnishing ?? emptyFurnishing()),
        soldFixtures:data.furnishing?.soldFixtures ?? []};
      const migratedSpeakers=migrateSpeakerMounts(savedFurnishing);
      const restoredPetGeometry = petNavigationGeometry(
        placeObstacles('home', savedFurnishing), HOME_FLOOR);
      const districtLayout = data.world?.districtLayout;
      const migratedDistrict = districtLayout!==4;
      const bagAtHouse = (role:CharacterId) => data.world?.places[role]==='home' &&
        ((districtLayout===undefined || districtLayout===1) || (districtLayout===4?inHomeGrounds(data.characters[role]):legacyHomeGrounds(data.characters[role])));
      const household: GameState = {
        ...data,
        homeDust: data.homeDust ?? initialDust(),
        happiness: data.happiness ?? {vlad:initialHappiness(),alina:initialHappiness()},
        billing: data.billing ?? initialServices(clockMinutes(data.clock ?? INITIAL_CLOCK)),
        world: data.world ? {
          ...data.world, districtLayout: 4,
          deliveries:data.world.deliveries.map(d=>districtLayout!==4&&d.readyAt<=clockMinutes(data.clock??INITIAL_CLOCK)?{...d,handedAt:d.readyAt}:d),
          places: {
            vlad: String(data.world.places.vlad)==='street'||(districtLayout===2||districtLayout===3)&&data.world.places.vlad==='home'&&!legacyHomeGrounds(data.characters.vlad)?'district':data.world.places.vlad,
            alina: String(data.world.places.alina)==='street'||(districtLayout===2||districtLayout===3)&&data.world.places.alina==='home'&&!legacyHomeGrounds(data.characters.alina)?'district':data.world.places.alina,
          },
          // Old staged bags had already been credited to pantry / ready food.
          // Remove them without ever granting the same purchase twice.
          tableBags: 0,
          bags: {
            vlad: bagAtHouse('vlad') ? 0 : data.world.bags.vlad,
            alina: bagAtHouse('alina') ? 0 : data.world.bags.alina,
          },
        } : initialWorld(),
        clock: { ...INITIAL_CLOCK, ...data.clock },
        characters: {
          vlad: restoreResident(data.characters.vlad, 'vlad', data.world?.places.vlad ?? 'home',savedFurnishing,districtLayout),
          alina: restoreResident(data.characters.alina, 'alina', data.world?.places.alina ?? 'home',savedFurnishing,districtLayout),
        },
        pantry: { ...EMPTY_PANTRY, ...data.pantry },
        meals: { ...EMPTY_MEALS, ...data.meals },
        takeout: { ...EMPTY_TAKEOUT, ...data.takeout },
        readyFood: data.readyFood ?? [],
        dirtyDishes: data.dirtyDishes ?? { ...EMPTY_DIRTY_DISHES },
        ledger: [...(data.ledger ?? [])],
        weekends: data.weekends??initialWeekends(),
        familyLife:data.familyLife??initialFamilyLife(),
        savings: restoreFamilyBudget(data.savings, { ...INITIAL_CLOCK,...data.clock }, data.ledger ?? []),
        shiftDays: Object.assign({ vlad: 0, alina: 0 }, data.shiftDays),
        activeShifts: { ...data.activeShifts },
        readBooks: data.readBooks ?? { vlad: [], alina: [] },
        education: data.education ?? migrateEducation({ readBooks: data.readBooks ?? { vlad: [], alina: [] } }),
        careers: data.careers ?? initialCareers(),
        computerLibrary: data.computerLibrary ?? initialComputerLibrary(),
        furnishing: savedFurnishing,
        relationship: data.relationship ?? initialRelationship(),
        autonomy: data.autonomy ?? { ...INITIAL_AUTONOMY },
        personalCollections: data.personalCollections ?? {},
        dailyHistory: data.dailyHistory ?? {},
        coffeeDaily: data.coffeeDaily ?? newCoffeeDaily(),
        pets: {
          verdell: restorePet('verdell', data.pets?.verdell, restoredPetGeometry, data.furnishing),
          simba: restorePet('simba', data.pets?.simba, restoredPetGeometry, data.furnishing),
        },
        petFood: { ...INITIAL_PET_FOOD, ...data.petFood },
        petBowls: { ...INITIAL_PET_BOWLS, ...data.petBowls },
      };
      // The first load of a legacy save permanently records expiration dates.
      // Merely reopening the file must never reset the countdown.
      if(migratedSpeakers&&household.speakers)for(const id of Object.keys(household.speakers))if(!savedFurnishing.placed.some(p=>p.id===Number(id)))delete household.speakers[Number(id)];
      const migratedFood = reconcileReadyFood(household);
      const recoveredCareer = recoverCareers(household);
      const migratedBags = !!data.world && ((data.world.tableBags ?? 0) > 0 ||
        (bagAtHouse('vlad') && data.world.bags.vlad > 0) ||
        (bagAtHouse('alina') && data.world.bags.alina > 0));
      if(migratedBags){
        const backup=join(dataDir,'household.pre-auto-groceries.json');
        if(!existsSync(backup))copyFileSync(statePath,backup);
      }
      if(migratedDistrict){
        const backup=join(dataDir,districtLayout===3?'household.pre-separated-district.json':districtLayout===2?'household.pre-street-redesign.json':'household.pre-unified-district.json');
        if(!existsSync(backup))copyFileSync(statePath,backup);
      }
      if(data.furnishing?.soldFixtures===undefined){
        const backup=join(dataDir,'household.pre-static-sale.json');
        if(!existsSync(backup))copyFileSync(statePath,backup);
      }
      if (data.furnishing === undefined) {
        const backup = join(dataDir, 'household.pre-furnishing.json');
        if (!existsSync(backup)) copyFileSync(statePath, backup);
      }
      if (data.billing === undefined) {
        // Keep the original household even after later rotating backups.
        const backup = join(dataDir, 'household.pre-billing.json');
        if (!existsSync(backup)) copyFileSync(statePath, backup);
      }
      // Legacy supplies become refill units without losing already-owned food.
      // Empty bowls are introduced once, and the migration never repeats.
      if (data.billing === undefined || data.relationship === undefined || data.readyFood === undefined || data.petBowls === undefined ||
          data.furnishing === undefined || data.furnishing.soldFixtures===undefined ||
          data.dirtyDishes === undefined || data.computerLibrary === undefined ||
          migratedSpeakers || migratedFood || recoveredCareer || migratedBags || migratedDistrict)
        this.save(household);
      return household;
    },
    save(state: GameState): void {
      protectNeeds(state);
      if (!isValidState(state)) throw new Error('Refusing to save invalid household');
      const temporary = join(dataDir, 'household.tmp');
      writeFileSync(temporary, JSON.stringify(state, null, 2) + '\n');
      if (existsSync(statePath)) copyFileSync(statePath, join(dataDir, 'household.backup.json'));
      renameSync(temporary, statePath);
    },
  };
}
