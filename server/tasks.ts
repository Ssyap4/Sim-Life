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
import { clockMinutes } from '../src/shared/locations';
import { mediaAccessError, serviceAvailable, SERVICE_MESSAGES } from '../src/shared/services';
import { localActivity, localLabels } from './locations';
import { PICNIC_SECONDS, isCampRecipe, isParkDogAction } from '../src/shared/park';
import { LEISURE, isLeisureAction } from '../src/shared/leisure';
import type { LocalActivity } from '../src/shared/locations';
import { ACTIONS, type ActionId, type CharacterId, type GameState, type TimedCommand } from '../src/shared/protocol';
import { MEAL_EAT_SECONDS, RECIPES, TAKEOUT, isGrillRecipe, type RecipeId, type TakeoutId } from '../src/shared/food';
import { PETS, PET_ACTION_NAMES, type PetId, type PetAction } from '../src/shared/pets';
import { BOOKS, GENRES, HOME_SECONDS, READING_REWARD, type BookId, type Entertainment, type Genre, type NeedEffects } from '../src/shared/homeLife';
import {DOG_BATH_SECONDS} from '../src/shared/dogBath';
import { BATH_ACTIONS } from '../src/shared/home';
import { validCoffeeOrder, type CoffeeDrink } from '../src/shared/coffee';
import { GROCERIES } from '../src/shared/food';
import { brewCoffee } from './coffee';
import { applyAction } from './logic';
import { electronicsModel } from "../src/shared/electronics";
import { applyFoodAction, applyTakeoutMeal } from './food';
import { applyPetAction } from './pets';

import {DUST_ROOMS,isDustRoom,initialDust} from '../src/shared/homeDust';
import {dustRoute} from '../src/shared/dustRoute';
export type CareAction = Exclude<PetAction, 'buyFood' | 'call' | 'perch' | 'fetch' | 'mat' | 'scratch' | 'toy' | import('../src/shared/dogTraining').DogTrainingAction>;
export interface TaskPlan {
  command: TimedCommand;
  label: string;
  durationMs: number;
  resource: string | null;
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
  toiletUse: 5, bathShower: HOME_SECONDS.shower, bathSoak: 15, bathWash: 5,
  bathTeeth: HOME_SECONDS.teeth, bathFoam: HOME_SECONDS.foamBath, wcWash: 6,
  watchTv: 10, tvMusic: 10, tableRest: 7, tableTalk: 9, tablePlan: 8,
};

const own = (obj: object, key: string): boolean => Object.prototype.hasOwnProperty.call(obj, key);

/** A data-based schedule for existing activities. All real effects are applied at finish. */
export function planTask(command: Record<string, unknown>): TaskPlan | null {
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
  if (command.type === 'youtube') return { command: { type: 'youtube' }, label: '▶️ Смотрим YouTube',
    durationMs: HOME_SECONDS.youtube * 1000, resource: 'tv' };
  if (command.type === 'movie' && typeof command.genre === 'string' && own(GENRES, command.genre)) {
    const genre = command.genre as Genre;
    return { command: { type: 'movie', genre }, label: '🎬 Фильм · ' + GENRES[genre],
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
    return { command: { type: 'local_activity', station: command.station, action }, label: localLabels[action],
      durationMs: action==='picnic'?PICNIC_SECONDS*1000:action==='dine'?MEAL_EAT_SECONDS*1000:action==='badminton'?45000:isCampRecipe(action)?35000:action==='campIgnite'?8000:action==='swing'?24000:isParkDogAction(action)?16000:5800, resource: isParkDogAction(action)?'pet:verdell':action==='campIgnite'||isCampRecipe(action)?'park-fire':null };
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
    return {
      command: { type: command.type, recipe,
        ...(command.type==='eat'&&typeof command.furnitureId==='number'?
          {furnitureId:command.furnitureId}:{}) },
      label: (command.type === 'cook' ? '🍳 Готовим: ' : '🍽️ Едим: ') + RECIPES[recipe].name,
      durationMs: command.type === 'cook' ? grill ? 15_000 : 12_000 : MEAL_EAT_SECONDS*1000,
      resource: command.type === 'cook' ? grill ? 'grill' : 'kitchen' : null,
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
        !['feed', 'play', 'pet', 'brush','treat','bathe','loadFeeder'].includes(command.action)) return null;
    const pet = command.pet as PetId;
    const action = command.action as CareAction;
    if(action==='bathe'&&pet!=='verdell')return null;
    return {
      command: { type: 'pet_action', pet, action },
      label: PET_ACTION_NAMES[action] + ': ' + PETS[pet].name,
      durationMs: action==='bathe'?DOG_BATH_SECONDS*1000:action === 'play' ? 9_000 : action==='treat'?6_000:5_000,
      resource: action==='bathe'?'bathtub':'pet:' + pet,
    };
  }
  return null;
}

export function entertainmentReward(command: Entertainment, together = false, bonus=0, comfort=0): NeedEffects {
  if (command.type === 'read_book') return READING_REWARD;
  if (command.type === 'free_tv') return { fun: 5+bonus, ...(comfort?{comfort}:{}) };
  if (command.type === 'youtube') return { fun: 20+bonus, comfort: 10+comfort };
  return { fun: 100, ...(together?{social:100}:{}), comfort: 15+comfort };
}

export function evaluateTask(state: GameState, role: CharacterId, command: TimedCommand, together = false): EvaluatedTask {
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
  if (command.type === 'youtube' || command.type === 'movie' || command.type === 'read_book' || command.type === 'free_tv') {
    const next = structuredClone(state);
    const needs = next.characters[role];
    for (const [key, amount] of Object.entries(entertainmentReward(command, together,electronicsModel(state,role,"tv").bonus,electronicsModel(state,role,"tv").comfort))) {
      const need = key as keyof NeedEffects;
      needs[need] = Math.min(100, needs[need] + amount);
    }
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
  if (command.type === 'brew_coffee') return brewCoffee(state, role, command.blend,command.drink);
  return applyFoodAction(state, role, { type: command.type, recipe: command.recipe });
}
