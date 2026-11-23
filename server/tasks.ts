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
import type { LocalActivity } from '../src/shared/locations';
import { ACTIONS, type ActionId, type CharacterId, type GameState, type TimedCommand } from '../src/shared/protocol';
import { RECIPES, TAKEOUT, isGrillRecipe, type RecipeId, type TakeoutId } from '../src/shared/food';
import { PETS, PET_ACTION_NAMES, type PetId, type PetAction } from '../src/shared/pets';
import { BOOKS, GENRES, HOME_SECONDS, READING_REWARD, type BookId, type Entertainment, type Genre, type NeedEffects } from '../src/shared/homeLife';
import { BATH_ACTIONS } from '../src/shared/home';
import { INSTANT_COFFEE, type InstantCoffeeId } from '../src/shared/coffee';
import { GROCERIES } from '../src/shared/food';
import { brewInstantCoffee } from './coffee';
import { applyAction } from './logic';
import { applyFoodAction, applyTakeoutMeal } from './food';
import { applyPetAction } from './pets';

export type CareAction = Exclude<PetAction, 'buyFood'>;
export interface TaskPlan {
  command: TimedCommand;
  label: string;
  durationMs: number;
  resource: string | null;
}
export type EvaluatedTask = { ok: true; state: GameState; message: string } | { ok: false; reason: string };

export const ACTION_SECONDS: Record<ActionId, number> = {
  sofaRest: 9, sofaMovie: 13, sofaRead: 10, sofaMusic: 9, sofaCall: 8,
  officeChairSit: 12,
  bedSleep: 16, bedNap: 10, bedMake: 7, bedStretch: 8,
  vladOrder: 38, vladStudy: 11, deskGames: 12, deskJournal: 9,
  alinaStudy: 11, alinaConsult: 38,
  kitchenWash: 7, kitchenTidy: 12, kitchenTea: 8, kitchenDishes: 10, kitchenLeftovers: 12,
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
    const secs=Object.hasOwn(ACTION_SECONDS,action)?ACTION_SECONDS[action as ActionId]:
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
      durationMs: action === 'dine' ? 7200 : 5800, resource: null };
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
        : action.item === 'desk' ? computerResource(computer ?? 'desktop') : action.item === 'kitchen' || action.item === 'officeChair' ||
          own(BATH_ACTIONS, id) ? action.item : null,
    };
  }
  if (command.type === 'brew_coffee') {
    if (typeof command.blend !== 'string' || !INSTANT_COFFEE.some(id => id === command.blend)) return null;
    const blend = command.blend as InstantCoffeeId;
    return { command: { type: 'brew_coffee', blend }, label: '☕ Завариваем ' + GROCERIES[blend].name,
      durationMs: 12_000, resource: 'kitchen' };
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
      durationMs: command.type === 'cook' ? grill ? 15_000 : 12_000 : 7_000,
      resource: command.type === 'cook' ? grill ? 'grill' : 'kitchen' : null,
    };
  }
  if (command.type === 'eat_takeout') {
    const item=command.item;
    if (typeof item !== 'string' || !own(TAKEOUT,item)) return null;
    return {command:{type:'eat_takeout',item:item as TakeoutId,
      ...(typeof command.furnitureId==='number'?{furnitureId:command.furnitureId}:{})},
      label:'🍽️ Едим: '+TAKEOUT[item as TakeoutId].name, durationMs:7_000,resource:null};
  }
  if (command.type === 'pet_action') {
    if (typeof command.pet !== 'string' || !own(PETS, command.pet) ||
        typeof command.action !== 'string' ||
        !['feed', 'play', 'pet', 'brush'].includes(command.action)) return null;
    const pet = command.pet as PetId;
    const action = command.action as CareAction;
    return {
      command: { type: 'pet_action', pet, action },
      label: PET_ACTION_NAMES[action] + ': ' + PETS[pet].name,
      durationMs: action === 'play' ? 9_000 : 5_000,
      resource: 'pet:' + pet,
    };
  }
  return null;
}

export function entertainmentReward(command: Entertainment, together = false): NeedEffects {
  if (command.type === 'read_book') return READING_REWARD;
  if (command.type === 'free_tv') return { fun: 5 };
  if (command.type === 'youtube') return { fun: 20, comfort: 10 };
  return together ? { fun: 100, social: 100, comfort: 15 } : { fun: 100, comfort: 15 };
}

export function evaluateTask(state: GameState, role: CharacterId, command: TimedCommand, together = false): EvaluatedTask {
  if (command.type === 'together') return { ok: false, reason: 'Требуется согласованное приглашение' };
  if (command.type === 'study') return { ok: false, reason: 'Для обучения нужна учебная сессия' };
  if(command.type==='furniture_use'){
    const selected=furnitureSource(state,command.furnitureId,command.action);
    if(!selected.ok)return selected;
    if(state.world.places[role]!=='home')return {ok:false,reason:'Мебель находится дома'};
    const position=furnitureUseLocation(state,role,command.furnitureId,command.action);
    if(!position)return {ok:false,reason:'Не получается безопасно подойти к мебели'};
    const {action}=command;
    if(action==='read_book'&&state.furnishing.soldFixtures?.includes('bookcase')&&
      !state.furnishing.placed.some(item=>FURNITURE_BY_ID.get(item.sku)?.shape==='shelves'))
      return {ok:false,reason:'Для чтения сначала установи книжный стеллаж'};
    if(['youtube','movie','free_tv'].includes(action)){
      const denial=action==='free_tv'?undefined:mediaAccessError(state.billing,
        action==='youtube'?'youtube':'netflix',clockMinutes(state.clock));
      if(denial)return {ok:false,reason:denial};
    }
    if(action==='sofaCall' && !serviceAvailable(state.billing,'mobile',clockMinutes(state.clock)))
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
        const reward=action==='tidy'?{comfort:6,mood:3}:entertainmentReward(
          action==='read_book'?{type:'read_book',book:command.book!}:
          action==='movie'?{type:'movie',genre:command.genre!}:
          action==='youtube'?{type:'youtube'}:{type:'free_tv'});
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
    const destination=position.route.path.at(-1)??position.route.from;
    Object.assign(result.state.characters[role],destination,{
      pose:['sofaRest','sofaMusic','sofaCall','officeChairSit','tableRest','tableTalk','tablePlan',
        'youtube','movie','free_tv'].includes(action)||
        (action==='read_book'&&FURNITURE_BY_ID.get(selected.item.sku)?.shape!=='shelves')?'sit':'idle'});
    return result;
  }
  if (command.type === 'play_game'||command.type==='computer_video'){
    const purchased=command.device==='desktop'&&
      (command.furnitureId!==undefined||state.furnishing.soldFixtures?.includes('desk'));
    const deskId=command.furnitureId??state.furnishing.placed.find(item=>
      FURNITURE_BY_ID.get(item.sku)?.shape==='desk')?.id;
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
    for (const [key, amount] of Object.entries(entertainmentReward(command, together))) {
      const need = key as keyof NeedEffects;
      needs[need] = Math.min(100, needs[need] + amount);
    }
    if (command.type === 'read_book' && !next.readBooks[role].includes(command.book)) next.readBooks[role].push(command.book);
    next.revision++;
    return { ok: true, state: next, message: planTask(command)!.label + ' · завершено' };
  }
  if (command.type === 'act') return applyAction(state, role, command.actionId);
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
  if (command.type === 'brew_coffee') return brewInstantCoffee(state, role, command.blend);
  return applyFoodAction(state, role, { type: command.type, recipe: command.recipe });
}
