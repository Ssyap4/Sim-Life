import {isLakeMealAction,LAKE_MEAL_ACTIONS,LAKE_MEALS,isLakeRestAction,LAKE_REST,isLakeCareAction,LAKE_CARE,isLakeLeisureAction,LAKE_LEISURE,isLakeFishAction,FISH_ACTIONS,LAKE_RODS} from '../src/shared/lake';
import {CARE,isCare,finishCare,careRole,homeCare,bathCare,careStation} from '../src/shared/vanity';
import {laptopDesk,laptopWorkplace} from '../src/shared/furnitureUse';
import {isNotebookDesk,RETIRED_DINING} from '../src/shared/furniture';
import { seatingComfortBonus } from '../src/shared/furnitureComfort';
import { catBedError, catSeatError } from '../src/shared/catOccupancy';
import { bedPose } from '../src/shared/bedSleep';
import { MATERIAL_BY_ID } from '../src/shared/educationCatalog';
import { computerDevice, computerResource } from '../src/shared/computer';
import { GAME_BY_ID, VIDEO_CLIPS, isVideoClipId } from '../src/shared/computerGames';
import { completeComputerGame, completeComputerVideo } from './computers';
import { taskAccessError } from '../src/shared/serviceAccess';
import { FURNITURE_ACTIONS, furnitureSource, furnitureUseLocation, diningLocation, type FurnitureUseCommand } from '../src/shared/furnitureUse';
import { FURNITURE_BY_ID } from '../src/shared/furniture';
import {isSpaAction,SPA_ACTIVITIES} from '../src/shared/spa';
import {isBarberAction,BARBER_SERVICES} from '../src/shared/barber';
import {isVetAction,VET_SERVICES,isClinicAction,CLINIC_SERVICES} from '../src/shared/health';
import {fitnessExercise,fitnessBarItem} from '../src/shared/fitness';
import {stationById} from '../src/shared/locations';
import { clockMinutes } from '../src/shared/locations';
import { mediaAccessError, serviceAvailable, SERVICE_MESSAGES } from '../src/shared/services';
import { localActivity, localLabels } from './locations';
import { PICNIC_SECONDS, isCampRecipe, isParkDogAction } from '../src/shared/park';
import { LEISURE, isLeisureAction } from '../src/shared/leisure';
import type { LocalActivity } from '../src/shared/locations';
import { ACTIONS, type ActionId, type CharacterId, type GameState, type TimedCommand } from '../src/shared/protocol';
import { MEAL_EAT_SECONDS, RECIPES, TAKEOUT,isHomeDrink,isDrinkSeat,isMediaFood,mediaFoodInfo,type MediaFood, isGrillRecipe, type RecipeId, type TakeoutId } from '../src/shared/food';
import { PETS, PET_ACTION_NAMES, type PetId, type PetAction } from '../src/shared/pets';
import {validSelection,mediaLabel} from '../src/shared/mediaCatalog';
import {recordViewing} from '../src/shared/mediaLibrary';
import { BOOKS, GENRES, HOME_SECONDS, TV_FOOD_SECONDS, readingReward, viewingReward, type BookId, type Entertainment, type Genre, type NeedEffects } from '../src/shared/homeLife';
import {DOG_BATH_SECONDS} from '../src/shared/dogBath';
import { BATH_ACTIONS } from '../src/shared/home';
import { validCoffeeOrder, type CoffeeDrink } from '../src/shared/coffee';
import { GROCERIES } from '../src/shared/food';
import { brewCoffee,finishWorkCoffee,finishWorkDrink } from './coffee';
import { applyAction } from './logic';
import { electronicsModel } from "../src/shared/electronics";
import { applyFoodAction, applyTakeoutMeal } from './food';
import { cookingSeconds } from '../src/shared/cookingProgression';
import { applyPetAction } from './pets';

import {DUST_ROOMS,isDustRoom,initialDust} from '../src/shared/homeDust';
import {dustRoute} from '../src/shared/dustRoute';
export type CareAction = Exclude<PetAction, 'buyFood' | 'call' | 'perch' | 'fetch' | 'mat' | 'scratch' | 'toy' | import('../src/shared/dogTraining').DogTrainingAction>;
export interface TaskPlan {
  command: TimedCommand;
  label: string;
  durationMs: number;
  resource: string | null;
  fitnessProgram?:import('../src/shared/fitness').FitnessProgramId;
}
export type EvaluatedTask = { ok: true; state: GameState; message: string } | { ok: false; reason: string };

export const ACTION_SECONDS: Record<ActionId, number> = {
  curtainsOpen:5,curtainsClose:5,windowOpen:5,windowClose:5,
  sofaRest: 9, sofaMovie: 13, sofaRead: 10, sofaMusic: 9, sofaCall: 8, sofaScroll: 20,
  officeChairSit: 12,
  bedSleep: 16, bedNap: 10, bedMake: 7, bedStretch: 8,
  vladOrder: 38, vladStudy: 11, deskGames: 12, deskJournal: 9,
  alinaStudy: 11, alinaConsult: 38,
  kitchenWash: 7, kitchenTidy: 12, kitchenTea: 8, kitchenDishes: 10, kitchenLeftovers: 12, kitchenServe: 16,
  toiletUse: 5, bathShower: HOME_SECONDS.shower, bathSoak: 55, bathWash: 5,
  bathTeeth: HOME_SECONDS.teeth, bathFoam: HOME_SECONDS.foamBath, wcWash: 6,
  watchTv: 10, tvMusic: 10, yardHookahSolo:45, yardLounge:45, tableRest: 7, tableTalk: 9, tablePlan: 8,
};

const own = (obj: object, key: string): boolean => Object.prototype.hasOwnProperty.call(obj, key);

/** A data-based schedule for existing activities. All real effects are applied at finish. */
import {CONSOLE_GAMES,isConsoleGame} from '../src/shared/consoleCatalog';
export function planTask(command: Record<string, unknown>): TaskPlan | null {
  if(command.type==='vanity_care'&&isCare(command.care)&&homeCare(command.care)){const care=command.care;return {command:{type:'vanity_care',care},label:CARE[care].label,durationMs:CARE[care].seconds*1000,resource:careStation(care)};}
  if(command.type==='console_play'&&isConsoleGame(command.game)){const game=command.game,g=CONSOLE_GAMES[game];if(g.mode==='coop')return null;return {command:{type:'console_play',game},label:'🎮 '+g.name,durationMs:g.seconds*1000,resource:'tv'};}
  if(command.type==='furniture_use'){
    if(!Number.isSafeInteger(command.furnitureId)||typeof command.action!=='string'||
      !Object.hasOwn(FURNITURE_ACTIONS,command.action))return null;
    const action=command.action as FurnitureUseCommand['action'];
    if(action==='read_book' && (typeof command.book!=='string'||!Object.hasOwn(BOOKS,command.book)))return null;
    if(action==='movie' && (typeof command.genre!=='string'||!Object.hasOwn(GENRES,command.genre)))return null;
    const normalized:FurnitureUseCommand={type:'furniture_use',furnitureId:command.furnitureId as number,action,
      ...(action==='read_book'?{book:command.book as import('../src/shared/homeLife').BookId}:{}),
      ...(action==='movie'?{genre:command.genre as import('../src/shared/homeLife').Genre}:{})};
    const secs=isLeisureAction(action)?LEISURE[action].seconds:Object.hasOwn(ACTION_SECONDS,action)?ACTION_SECONDS[action as ActionId]:
      action==='movie'?HOME_SECONDS.movie:action==='youtube'?HOME_SECONDS.youtube:
      action==='free_tv'?HOME_SECONDS.freeTv:action==='read_book'?BOOKS[normalized.book!][3]:8;
    return {command:normalized,label:FURNITURE_ACTIONS[action],durationMs:secs*1000,
      resource:'furniture:'+normalized.furnitureId};
  }
  if (command.type==='play_game' && typeof command.game==='string' && computerDevice(command.device)) {
    const game=GAME_BY_ID.get(command.game);
    return game ? {command:{type:'play_game',game:game.id,device:command.device,
      ...(typeof command.furnitureId==='number'?{furnitureId:command.furnitureId}:{})},
      label:'🎮 '+game.title,durationMs:game.duration*1000,resource:computerResource(command.device)} : null;
  }
  if (command.type==='computer_video' && isVideoClipId(command.clip) && computerDevice(command.device)) {
    const clip=VIDEO_CLIPS[command.clip];
    return {command:{type:'computer_video',clip:command.clip,device:command.device,
      ...(typeof command.furnitureId==='number'?{furnitureId:command.furnitureId}:{})},
      label:'▶ '+clip.title,durationMs:clip.duration*1000,resource:computerResource(command.device)};
  }
  if (command.type === 'study' && typeof command.material === 'string') {
    const material = MATERIAL_BY_ID.get(command.material);
    if (!material) return null;
    if (command.computer !== undefined && (material.channel !== 'academy' || !computerDevice(command.computer))) return null;
    const computer = computerDevice(command.computer) ? command.computer : undefined;
    const resource = material.channel === 'academy' ? computerResource(computer ?? 'desktop') : material.channel === 'tv' ? 'tv' : null;
    return { command: { type: 'study', material: material.id, ...(computer ? { computer } : {}) },
      label: material.title, durationMs: material.minutes * 2000, resource };
  }
  if (command.type === 'free_tv') return { command: { type: 'free_tv' }, label: '📺 Обычные телеканалы',
    durationMs: HOME_SECONDS.freeTv * 1000, resource: 'tv' };
  if (command.type === 'youtube' || command.type === 'movie') {
    if(command.food!==undefined&&!isMediaFood(command.food))return null;
  }
  if (command.type === 'youtube') return { command: { type: 'youtube', ...(command.food?{food:command.food as MediaFood}:{}) }, label: command.food?'YouTube + '+mediaFoodInfo(command.food as MediaFood).name:'▶️ Смотрим YouTube',
    durationMs: (command.food?TV_FOOD_SECONDS:HOME_SECONDS.youtube) * 1000, resource: 'tv' };
  if (command.type === 'movie' && typeof command.genre === 'string' && own(GENRES, command.genre)) {
    const genre = command.genre as Genre;
    if(command.selection!==undefined&&!validSelection(command.selection,genre))return null;
    return { command: { type: 'movie', genre, ...(command.selection?{selection:command.selection as import('../src/shared/mediaCatalog').MediaSelection}:{}), ...(command.food?{food:command.food as MediaFood}:{}) }, label: '🎬 ' + (command.selection?mediaLabel(command.selection as import('../src/shared/mediaCatalog').MediaSelection):'Фильм · '+GENRES[genre])+(command.food?' + '+mediaFoodInfo(command.food as MediaFood).name:''),
      durationMs: HOME_SECONDS.movie * 1000, resource: 'tv' };
  }
  if (command.type === 'read_book' && typeof command.book === 'string' && own(BOOKS, command.book)) {
    if (command.seat !== undefined && command.seat !== 'officeChair') return null;
    const book = command.book as BookId;
    return { command: { type: 'read_book', book, ...(command.seat ? { seat: command.seat } : {}) },
      label: '📖 ' + BOOKS[book][0], durationMs: BOOKS[book][3] * 1000, resource: command.seat ?? null };
  }
  if (command.type === 'local_activity') {
    if (typeof command.station !== 'string' || typeof command.action !== 'string' || !own(localLabels, command.action)) return null;
    const action = command.action as LocalActivity;
    if(isLakeLeisureAction(action)){const station=stationById('lake',command.station);if(station?.action.kind!=='lake'||station.action.facility!==LAKE_LEISURE[action].facility)return null;return {command:{type:'local_activity',station:command.station,action},label:LAKE_LEISURE[action].name,durationMs:LAKE_LEISURE[action].seconds*1000,resource:action.startsWith('lakeDog')?'lake-dog':null};}
    if(isLakeCareAction(action)){const station=stationById('lake',command.station);if(station?.action.kind!=='lake'||station.action.facility!==LAKE_CARE[action].facility)return null;return {command:{type:'local_activity',station:command.station,action},label:LAKE_CARE[action].name,durationMs:LAKE_CARE[action].seconds*1000,resource:'lake-care:'+station.id};}
    if(isLakeRestAction(action)){const station=stationById('lake',command.station);if(station?.action.kind!=='lake'||station.action.facility!==(action==='lakeFireRest'?'fire':'pitch'))return null;return {command:{type:'local_activity',station:command.station,action},label:LAKE_REST[action].name,durationMs:LAKE_REST[action].seconds*1000,resource:null};}
    if(isLakeFishAction(action)){const station=stationById('lake',command.station);if(station?.action.kind!=='lake'||station.action.facility!=='fish')return null;return {command:{type:'local_activity',station:command.station,action},label:localLabels[action],durationMs:LAKE_RODS[FISH_ACTIONS[action]].seconds*1000,resource:'lake-fish:'+command.station};}
    if(isLakeMealAction(action)){const station=stationById('lake',command.station);if(station?.action.kind!=='lake'||station.action.facility!=='fire')return null;const p=LAKE_MEAL_ACTIONS[action];return {command:{type:'local_activity',station:command.station,action},label:localLabels[action],durationMs:(p.cook?LAKE_MEALS[p.meal].seconds:30)*1000,resource:p.cook?'lake-fire:'+command.station:'lake-eat:'+command.station};}
    if(isVetAction(action)){const s=VET_SERVICES[action];if(command.station!==s.station)return null;return {command:{type:'local_activity',station:command.station,action},label:s.name,durationMs:s.seconds*1000,resource:'vet:'+command.station};}
    if(isSpaAction(action)){const station=stationById('spa',command.station);if(station?.action.kind!=='spa'||station.action.facility!==action)return null;return {command:{type:'local_activity',station:command.station,action},label:SPA_ACTIVITIES[action].name,durationMs:SPA_ACTIVITIES[action].seconds*1000,resource:['spaPool','spaJacuzzi','spaSauna'].includes(action)?null:'spa:'+command.station};}
    if(isBarberAction(action)){if(command.station!=='barber-chair')return null;const d=BARBER_SERVICES[action];return {command:{type:'local_activity',station:command.station,action},label:d.name,durationMs:d.seconds*1000,resource:'barber-chair'};}
    if(isClinicAction(action)){const s=CLINIC_SERVICES[action];if(command.station!==s.station)return null;return {command:{type:'local_activity',station:command.station,action},label:s.name,durationMs:s.seconds*1000,resource:'clinic:'+command.station};}
    if(action==='fitnessTrain'){
      const station=stationById('fitness',command.station),exercise=station?.action.kind==='fitness'?fitnessExercise(station.action.facility):undefined;
      if(!exercise)return null;
      return {command:{type:'local_activity',station:command.station,action},label:exercise.name,durationMs:exercise.minutes*2000,resource:'fitness:'+command.station};
    }
    if(fitnessBarItem(action)||['fitnessLocker','fitnessShower','fitnessToilet'].includes(action))return {command:{type:'local_activity',station:command.station,action},label:localLabels[action],durationMs:action==='fitnessShower'?38000:action==='fitnessMeal'?32000:action==='fitnessToilet'?5000:12000,resource:fitnessBarItem(action)?null:'fitness:'+command.station};
    return { command: { type: 'local_activity', station: command.station, action }, label: localLabels[action],
      durationMs: action==='fitnessSauna'?40000:action==='picnic'?PICNIC_SECONDS*1000:action==='dine'?MEAL_EAT_SECONDS*1000:action==='badminton'?45000:isCampRecipe(action)?35000:action==='campIgnite'?8000:action==='swing'?24000:isParkDogAction(action)?16000:5800, resource: isParkDogAction(action)?'pet:verdell':action==='campIgnite'||isCampRecipe(action)?'park-fire':null };
  }
  if(command.type==='clean_room'){
    if(!isDustRoom(command.room))return null;
    return {command:{type:'clean_room',room:command.room},label:'Уборка: '+DUST_ROOMS.find(r=>r.id===command.room)!.label,durationMs:18000,resource:'dust:'+command.room};
  }
  if (command.type === 'act') {
    const id = command.actionId;
    if (typeof id !== 'string' || !own(ACTIONS, id)) return null;
    // Older clients can still submit the former sofa menu commands.
    if (id === 'watchTv' || id === 'tvMusic') return planTask({type:'free_tv'});
    if (id === 'sofaMovie') return planTask({type:'movie',genre:'comedy'});
    if (id === 'sofaRead') return planTask({type:'read_book',book:'prince'});
    const actionId = id as ActionId;
    const action = ACTIONS[actionId];
    if (command.computer !== undefined && (action.item !== 'desk' || !computerDevice(command.computer))) return null;
    const computer = computerDevice(command.computer) ? command.computer : undefined;
    return {
      command: { type: 'act', actionId, ...(computer ? { computer } : {}) }, label: action.label,
      durationMs: ACTION_SECONDS[actionId] * 1000,
      resource: action.item === 'toilet' || action.item === 'wcBasin' ? 'wc'
        : action.item === 'desk' ? computerResource(computer ?? 'desktop') : action.item === 'kitchen' || action.item === 'officeChair' || action.item==='kitchenWindow' ||
          own(BATH_ACTIONS, id) ? action.item : null,
    };
  }
  if(command.type==='serve_work_drink'&&Number.isSafeInteger(command.shiftStart)&&Number(command.shiftStart)>=0&&isHomeDrink(command.recipe))return {command:{type:'serve_work_drink',shiftStart:Number(command.shiftStart),recipe:command.recipe as RecipeId},label:'☕ Принести напиток работающему партнёру',durationMs:7000,resource:'workDrink'};
  if(command.type==='serve_work_coffee'&&Number.isSafeInteger(command.shiftStart)&&Number(command.shiftStart)>=0&&validCoffeeOrder(command.blend,command.drink))return {command:{type:'serve_work_coffee',shiftStart:Number(command.shiftStart),blend:command.blend,drink:command.drink as CoffeeDrink|undefined},label:'☕ Принести кофе работающему партнёру',durationMs:7000,resource:'kitchen'};
  if (command.type === 'brew_coffee') {
    if (!validCoffeeOrder(command.blend,command.drink)) return null;
    const blend = command.blend;
    return { command: { type: 'brew_coffee', blend,drink:command.drink as CoffeeDrink|undefined }, label: '☕ Готовим ' + (command.drink??GROCERIES[blend].name),
      durationMs: command.drink?18_000:12_000, resource: 'kitchen' };
  }
  if (command.type === 'cook' || command.type === 'eat') {
    const id = command.recipe;
    if (typeof id !== 'string' || !own(RECIPES, id)) return null;
    const recipe = id as RecipeId;
    const grill = isGrillRecipe(recipe);
    if(command.drinkSeat!==undefined&&(command.type!=='eat'||!isHomeDrink(recipe)||!isDrinkSeat(command.drinkSeat)||(command.furnitureId!==undefined&&(!Number.isSafeInteger(command.furnitureId)||command.drinkSeat==='yardTable'))))return null;
    const drinkSeat=command.type==='eat'&&isDrinkSeat(command.drinkSeat)?command.drinkSeat:undefined;
    return {
      command: { type: command.type, recipe,
        ...(command.type==='eat'&&typeof command.furnitureId==='number'?
          {furnitureId:command.furnitureId}:{}),...(drinkSeat?{drinkSeat}:{}) },
      label: (command.type === 'cook' ? '🍳 Готовим: ' : isHomeDrink(recipe)?'☕ Пьём: ':'🍽️ Едим: ') + RECIPES[recipe].name,
      durationMs: command.type === 'cook' ? cookingSeconds(recipe)*1000 : MEAL_EAT_SECONDS*1000,
      resource: command.type === 'cook' ? grill ? 'grill' : 'kitchen' : drinkSeat&&typeof command.furnitureId==='number'?'furniture:'+command.furnitureId:drinkSeat==='officeChair'?'officeChair':null,
    };
  }
  if (command.type === 'eat_takeout') {
    const item=command.item;
    if (typeof item !== 'string' || !own(TAKEOUT,item)) return null;
    return {command:{type:'eat_takeout',item:item as TakeoutId,
      ...(typeof command.furnitureId==='number'?{furnitureId:command.furnitureId}:{})},
      label:'🍽️ Едим: '+TAKEOUT[item as TakeoutId].name, durationMs:MEAL_EAT_SECONDS*1000,resource:null};
  }
  if (command.type === 'pet_action') {
    if (typeof command.pet !== 'string' || !own(PETS, command.pet) ||
        typeof command.action !== 'string' ||
        !['feed', 'play', 'pet', 'brush','treat','fishTreat','bathe','loadFeeder'].includes(command.action)) return null;
    const pet = command.pet as PetId;
    const action = command.action as CareAction;
    if(action==='fishTreat'&&pet!=='simba')return null;
    if(action==='bathe'&&pet!=='verdell')return null;
    return {
      command: { type: 'pet_action', pet, action },
      label: PET_ACTION_NAMES[action] + ': ' + PETS[pet].name,
      durationMs: action==='bathe'?DOG_BATH_SECONDS*1000:action === 'play' ? 9_000 : (action==='treat'||action==='fishTreat')?6_000:5_000,
      resource: action==='bathe'?'bathtub':'pet:' + pet,
    };
  }
  return null;
}

export function entertainmentReward(command: Entertainment, together = false, bonus=0, comfort=0): NeedEffects {
  if(command.type==='vanity_care')return {mood:CARE[command.care].mood};
  if(command.type==='console_play')return {fun:Math.min(100,65+bonus),mood:12,comfort:8+comfort,...(together?{social:35}:{})};
  if (command.type === 'read_book') return readingReward(command.book);
  return viewingReward(command,together,bonus,comfort);
}

export function evaluateTask(state: GameState, role: CharacterId, command: TimedCommand, together = false): EvaluatedTask {
  if(command.type==='vanity_care'){if(!isCare(command.care)||!homeCare(command.care)||careRole(command.care)!==role||state.world.places[role]!=='home')return {ok:false,reason:'Эта процедура недоступна персонажу или вне дома'};const next=structuredClone(state);finishCare(next,command.care);if(bathCare(command.care)){const c=next.characters[role];c.hygiene=command.care.startsWith('bathHair')?Math.min(100,c.hygiene+35):100;c.comfort=Math.min(100,c.comfort+(command.care.startsWith('bathHair')?15:command.care==='bathRitual'?45:35));}next.revision++;return {ok:true,state:next,message:CARE[command.care].label+' · готово'};}
  if(command.type==='act'&&['bedSleep','bedNap','bedMake','bedStretch'].includes(command.actionId)){
    const pose=bedPose(state,role,'starter');
    const reason=pose&&catBedError(state,'starter:bed',pose);
    if(reason)return {ok:false,reason};
  }
  if (command.type === 'together') return { ok: false, reason: 'Требуется согласованное приглашение' };
  if (command.type === 'study') return { ok: false, reason: 'Для обучения нужна учебная сессия' };
  if(command.type==='furniture_use'){
    const selected=furnitureSource(state,command.furnitureId,command.action);
    if(!selected.ok)return selected;
    if(state.world.places[role]!=='home')return {ok:false,reason:'Мебель находится дома'};
    const tableAction=['tableRest','tableTalk','tablePlan'].includes(command.action)&&!RETIRED_DINING.some(p=>p.id===selected.item.sku);
    const dining=tableAction?diningLocation(state,role,command.furnitureId):null;
    if(tableAction&&!dining?.seated)return {ok:false,reason:'Поставь рядом стул лицом к столу'};
    const position=dining??furnitureUseLocation(state,role,command.furnitureId,command.action);
    if(!position)return {ok:false,reason:'Не получается безопасно подойти к мебели'};
    const reason=catSeatError(state,'placed:'+command.furnitureId,position.pose);
    if(reason)return {ok:false,reason};
    const {action}=command;
    if(isNotebookDesk(selected.item.sku))return {ok:false,reason:'Открой ноутбук на этом столе'};
    if(action==='read_book'&&state.furnishing.soldFixtures?.includes('bookcase')&&
      !state.furnishing.placed.some(item=>FURNITURE_BY_ID.get(item.sku)?.shape==='shelves'))
      return {ok:false,reason:'Для чтения сначала установи книжный стеллаж'};
    if(['youtube','movie','free_tv'].includes(action)){
      const denial=action==='free_tv'?undefined:mediaAccessError(state.billing,
        action==='youtube'?'youtube':'netflix',clockMinutes(state.clock));
      if(denial)return {ok:false,reason:denial};
    }
    if((action==='sofaCall'||action==='sofaScroll') && !serviceAvailable(state.billing,'mobile',clockMinutes(state.clock)))
      return {ok:false,reason:SERVICE_MESSAGES.mobile};
    if(['deskGames','vladStudy','alinaStudy','vladOrder','alinaConsult'].includes(action)&&
      !serviceAvailable(state.billing,'internet',clockMinutes(state.clock)))
      return {ok:false,reason:SERVICE_MESSAGES.computer};
    if(['vladOrder','vladStudy'].includes(action)&&role!=='vlad'||
      ['alinaStudy','alinaConsult'].includes(action)&&role!=='alina')
      return {ok:false,reason:'Это действие доступно другому персонажу'};
    const result=Object.hasOwn(ACTIONS,action)
      ?applyAction(state,role,action)
      :(()=>{
        const next=structuredClone(state);
        const resident=next.characters[role];
        const reward=isLeisureAction(action)?{fun:LEISURE[action].fun,mood:LEISURE[action].mood,comfort:LEISURE[action].comfort,energy:LEISURE[action].energy}:action==='tidy'?{comfort:6,mood:3}:entertainmentReward(
          action==='read_book'?{type:'read_book',book:command.book!}:
          action==='movie'?{type:'movie',genre:command.genre!}:
          action==='youtube'?{type:'youtube'}:{type:'free_tv'},false,electronicsModel(state,role,'tv').bonus,electronicsModel(state,role,'tv').comfort);
        for(const [key,amount]of Object.entries(reward)){
          const field=key as keyof typeof reward & keyof typeof resident;
          const change=Number(amount);
          if(Number.isFinite(change))resident[field]=Math.min(100,Math.max(0,resident[field]+change));
        }
        if(action==='read_book'&&!next.readBooks[role].includes(command.book!))
          next.readBooks[role].push(command.book!);
        next.revision++;
        return {ok:true as const,state:next,message:FURNITURE_ACTIONS[action]+' — выполнено'};
      })();
    if(!result.ok)return result;
    if(['sofaRest','sofaMusic','sofaCall','sofaScroll','officeChairSit','tableRest','read_book','youtube','movie','free_tv'].includes(action)){
      const before=state.characters[role],after=result.state.characters[role];
      const bonus=seatingComfortBonus(selected.item.sku);
      if(after.comfort>before.comfort)after.comfort=Math.max(before.comfort,Math.min(100,after.comfort+bonus));
      if(bonus>0)after.mood=Math.min(100,after.mood+bonus/3);
    }
    const destination=position.route.path.at(-1)??position.route.from;
    Object.assign(result.state.characters[role],destination,{
      pose:(isLeisureAction(action)&&LEISURE[action].seated)||['sofaRest','sofaMusic','sofaCall','sofaScroll','officeChairSit','tableRest','tableTalk','tablePlan',
        'youtube','movie','free_tv'].includes(action)||
        (action==='read_book'&&FURNITURE_BY_ID.get(selected.item.sku)?.shape!=='shelves')?'sit':'idle'});
    return result;
  }
  if (command.type === 'play_game'||command.type==='computer_video'){
    const purchased=command.device==='desktop'&&
      (command.furnitureId!==undefined||state.furnishing.soldFixtures?.includes('desk'));
    const deskId=command.furnitureId??state.furnishing.placed.find(item=>
      FURNITURE_BY_ID.get(item.sku)?.shape==='desk'&&!isNotebookDesk(item.sku))?.id;
    if(purchased&&deskId!==undefined){const host=state.furnishing.placed.find(p=>FURNITURE_BY_ID.get(p.sku)?.shape==='desk'&&!isNotebookDesk(p.sku));if(host?.id!==deskId)return {ok:false,reason:'ПК установлен на другом столе'};}
    const location=purchased&&deskId!==undefined?
      furnitureUseLocation(state,role,deskId,'deskGames'):null;
    if(purchased&&!location)return {ok:false,reason:'Установи рабочий стол для стационарного компьютера'};
    const result=command.type==='play_game'?
      completeComputerGame(state,role,command.game,command.device):
      completeComputerVideo(state,role,command.clip,command.device);
    if(result.ok&&location){
      const destination=location.route.path.at(-1)??location.route.from;
      Object.assign(result.state.characters[role],destination,{pose:'work'});
    }
    return result;
  }
  const denial = taskAccessError(state, command);
  if (denial) return { ok: false, reason: denial };
  if (command.type === 'local_activity') return localActivity(state, role, command.action, command.station);
  if (state.world.places[role] !== 'home') return { ok: false, reason: 'Это действие доступно дома' };
  if (command.type === 'pet_action' && command.pet === 'verdell' && state.world.dogWalker)
    return { ok: false, reason: 'Верделл сейчас в парке' };
  if(command.type==='console_play'){
    if(CONSOLE_GAMES[command.game].mode==='coop'&&!together)return {ok:false,reason:'Эта игра требует двух игроков'};
    const next=structuredClone(state),needs=next.characters[role];for(const [key,amount] of Object.entries(entertainmentReward(command,together,electronicsModel(state,role,'tv').bonus,electronicsModel(state,role,'tv').comfort)))needs[key as keyof NeedEffects]=Math.min(100,needs[key as keyof NeedEffects]+amount);next.revision++;return {ok:true,state:next,message:CONSOLE_GAMES[command.game].name+' · сеанс завершён'};
  }
  if (command.type === 'youtube' || command.type === 'movie' || command.type === 'read_book' || command.type === 'free_tv') {
    const next = structuredClone(state);
    const needs = next.characters[role];
    for (const [key, amount] of Object.entries(entertainmentReward(command, together,electronicsModel(state,role,"tv").bonus,electronicsModel(state,role,"tv").comfort))) {
      const need = key as keyof NeedEffects;
      needs[need] = Math.min(100, needs[need] + amount);
    }
    if(command.type==='movie'&&command.selection)recordViewing(next,role,command.selection,together);
    if (command.type === 'read_book' && !next.readBooks[role].includes(command.book)) next.readBooks[role].push(command.book);
    next.revision++;
    return { ok: true, state: next, message: planTask(command)!.label + ' · завершено' };
  }
  if(command.type==='clean_room'){
    const dust=state.homeDust??initialDust();
    if(dust[command.room]<288)return {ok:false,reason:'В комнате и так чисто'};
    const route=dustRoute(state,role,command.room);
    if(!route)return {ok:false,reason:'Нет свободного прохода в комнату'};
    const next=structuredClone(state);next.homeDust={...dust,[command.room]:0};
    const resident=next.characters[role],point=route.path.at(-1)??route.from;
    Object.assign(resident,point,{pose:'idle'});
    resident.energy=Math.max(0,resident.energy-3);
    resident.comfort=Math.min(100,resident.comfort+4);
    resident.mood=Math.min(100,resident.mood+2);
    next.revision++;
    return {ok:true,state:next,message:'Комната убрана: '+DUST_ROOMS.find(r=>r.id===command.room)!.label};
  }
  if (command.type === 'act') {
    const loc=command.computer==='laptop'&&laptopDesk(state)?laptopWorkplace(state,role):null;
    if(command.computer==='laptop'&&laptopDesk(state)&&!loc)return {ok:false,reason:'Освободи подход к ноутбуку'};
    const result=applyAction(state,role,command.actionId,command.computer);
    if(result.ok&&loc)Object.assign(result.state.characters[role],loc.route.path.at(-1)??loc.route.from,{pose:'work'});
    return result;
  }
  if (command.type === 'pet_action') return applyPetAction(state, role, command.pet, command.action);
  if (command.type==='eat'||command.type==='eat_takeout'){
    if(command.type==='eat'&&command.drinkSeat){if(!isHomeDrink(command.recipe)||!isDrinkSeat(command.drinkSeat)||state.world.places[role]!=='home'||(command.furnitureId===undefined&&state.furnishing.soldFixtures?.includes(command.drinkSeat as 'sofa'|'officeChair')))return {ok:false,reason:'Место для напитка недоступно'};const seat=command.furnitureId===undefined?null:furnitureUseLocation(state,role,command.furnitureId,command.drinkSeat==='sofa'?'sofaRest':'officeChairSit');if(command.furnitureId!==undefined&&!seat)return {ok:false,reason:'Место для напитка недоступно'};const result=applyFoodAction(state,role,{type:'eat',recipe:command.recipe,drinkSeat:command.drinkSeat});if(result.ok&&seat)Object.assign(result.state.characters[role],seat.route.path.at(-1)??seat.route.from,{pose:'sit'});return result;}
    const purchased=command.furnitureId!==undefined||state.furnishing.soldFixtures?.includes('table');
    const location=purchased?diningLocation(state,role,command.furnitureId):null;
    if(purchased&&!location)return {ok:false,reason:'Поставь обеденный стол, к которому можно подойти'};
    const result=command.type==='eat_takeout'?
      applyTakeoutMeal(state,role,command.item):
      applyFoodAction(state,role,{type:'eat',recipe:command.recipe});
    if(result.ok&&location){
      const destination=location.route.path.at(-1)??location.route.from;
      Object.assign(result.state.characters[role],destination,{pose:location.seated?'sit':'idle'});
    }
    return result;
  }
  if(command.type==='serve_work_drink')return finishWorkDrink(state,role,command);
  if(command.type==='serve_work_coffee')return finishWorkCoffee(state,role,command);
  if (command.type === 'brew_coffee') return brewCoffee(state, role, command.blend,command.drink);
  return applyFoodAction(state, role, { type: command.type, recipe: command.recipe });
}
