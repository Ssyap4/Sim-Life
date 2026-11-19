import { localActivity, localLabels } from './locations';
import type { LocalActivity } from '../src/shared/locations';
import { ACTIONS, type ActionId, type CharacterId, type GameState, type TimedCommand } from '../src/shared/protocol';
import { RECIPES, TAKEOUT, type RecipeId, type TakeoutId } from '../src/shared/food';
import { PETS, PET_ACTION_NAMES, type PetId, type PetAction } from '../src/shared/pets';
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
  bedSleep: 16, bedNap: 10, bedMake: 7, bedStretch: 8,
  vladOrder: 38, vladStudy: 11, deskGames: 12, deskJournal: 9,
  alinaStudy: 11, alinaConsult: 38,
  kitchenWash: 7, kitchenTidy: 12, kitchenTea: 8,
  watchTv: 10, tvMusic: 10, tableRest: 7, tableTalk: 9, tablePlan: 8,
};

const own = (obj: object, key: string): boolean => Object.prototype.hasOwnProperty.call(obj, key);

/** A data-based schedule for existing activities. All real effects are applied at finish. */
export function planTask(command: Record<string, unknown>): TaskPlan | null {
  if (command.type === 'local_activity') {
    if (typeof command.station !== 'string' || typeof command.action !== 'string' || !own(localLabels, command.action)) return null;
    const action = command.action as LocalActivity;
    return { command: { type: 'local_activity', station: command.station, action }, label: localLabels[action],
      durationMs: action === 'dine' ? 7200 : 5800, resource: null };
  }
  if (command.type === 'act') {
    const id = command.actionId;
    if (typeof id !== 'string' || !own(ACTIONS, id)) return null;
    const actionId = id as ActionId;
    const action = ACTIONS[actionId];
    return {
      command: { type: 'act', actionId }, label: action.label,
      durationMs: ACTION_SECONDS[actionId] * 1000,
      resource: action.item === 'desk' || action.item === 'kitchen' ? action.item : null,
    };
  }
  if (command.type === 'cook' || command.type === 'eat') {
    const id = command.recipe;
    if (typeof id !== 'string' || !own(RECIPES, id)) return null;
    const recipe = id as RecipeId;
    return {
      command: { type: command.type, recipe },
      label: (command.type === 'cook' ? '🍳 Готовим: ' : '🍽️ Едим: ') + RECIPES[recipe].name,
      durationMs: command.type === 'cook' ? 12_000 : 7_000,
      resource: command.type === 'cook' ? 'kitchen' : null,
    };
  }
  if (command.type === 'eat_takeout') {
    const item=command.item;
    if (typeof item !== 'string' || !own(TAKEOUT,item)) return null;
    return {command:{type:'eat_takeout',item:item as TakeoutId},
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

export function evaluateTask(state: GameState, role: CharacterId, command: TimedCommand): EvaluatedTask {
  if (command.type === 'local_activity') return localActivity(state, role, command.action, command.station);
  if (state.world.places[role] !== 'home') return { ok: false, reason: 'Это действие доступно дома' };
  if (command.type === 'pet_action' && command.pet === 'verdell' && state.world.dogWalker)
    return { ok: false, reason: 'Верделл сейчас в парке' };
  if (command.type === 'act') return applyAction(state, role, command.actionId);
  if (command.type === 'pet_action') return applyPetAction(state, role, command.pet, command.action);
  if (command.type === 'eat_takeout') return applyTakeoutMeal(state, role, command.item);
  return applyFoodAction(state, role, { type: command.type, recipe: command.recipe });
}
