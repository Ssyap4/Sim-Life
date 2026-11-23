import { canFurniturePerform, type FurnitureUseAction } from './furnitureUse';
import { ACTIONS, type ActionId, type CharacterId, type GameState, type TimedCommand } from './protocol';

/** Quiet, *real* household work. Suggestions are never executed directly:
 * the server still checks routes, available furniture, needs and reservations. */
const BANK: Record<CharacterId, Record<'morning'|'day'|'evening', readonly ActionId[]>> = {
  vlad: {
    morning: ['bathTeeth','bedStretch','kitchenTea','deskJournal','tablePlan','kitchenWash'],
    day: ['deskJournal','tablePlan','kitchenTidy','kitchenTea','deskGames','bathWash'],
    evening: ['tablePlan','sofaRest','deskJournal','kitchenDishes','sofaCall','bathTeeth'],
  },
  alina: {
    morning: ['bathTeeth','bathWash','kitchenTea','bedMake','tablePlan','sofaMusic'],
    day: ['tablePlan','kitchenTidy','sofaMusic','kitchenTea','bathWash','sofaCall'],
    evening: ['sofaMusic','tablePlan','kitchenTea','sofaCall','sofaRest','bathWash'],
  },
};

const furnitureHabits: Partial<Record<ActionId, FurnitureUseAction>> = {
  deskJournal:'deskJournal', deskGames:'deskGames', tablePlan:'tablePlan',
  sofaRest:'sofaRest', sofaMusic:'sofaMusic', sofaCall:'sofaCall',
};

/** Deterministic preferences with a short memory; no 5-second ping-pong
 * between tasks. Does not modify state or magically create any furniture. */
export function homeHabitSuggestions(
  state: GameState, role: CharacterId, turn: number, recent: readonly ActionId[] = [],
): ActionId[] {
  const hour=Math.floor(state.clock.minute/60);
  const phase=hour>=5&&hour<11?'morning':hour>=18||hour<5?'evening':'day';
  const options=BANK[role][phase];
  const offset=Math.max(0,Math.trunc(Number.isFinite(turn)?turn:0))%options.length;
  const rotated=options.map((_,i)=>options[(i+offset)%options.length]);
  const resident=state.characters[role];
  const rest:ActionId=resident.energy<45?'sofaRest':
    role==='alina'&&resident.energy<55?'sofaMusic':'sofaRest';
  const soothing=resident.energy<55?[rest,...rotated.filter(id=>id!==rest)]:rotated;
  // Prefer genuinely different actions; still allow repetition when nothing
  // else is reachable so a small or remodeled home doesn't freeze.
  return [...soothing.filter(id=>!recent.includes(id)),
    ...soothing.filter(id=>recent.includes(id))];
}

export interface HomeHabitCommand { habit:ActionId; command:TimedCommand }

/** The starter fixture may have been sold. Resolve suggestions to installed
 * furniture of the right shape instead of attempting a ghost starter station.
 * This only yields candidates; authoritative server checks every route. */
export function homeHabitCommands(
  state:GameState,role:CharacterId,turn:number,recent:readonly ActionId[]=[],
):HomeHabitCommand[] {
  const results:HomeHabitCommand[]=[];
  for(const habit of homeHabitSuggestions(state,role,turn,recent)){
    if(habit==='kitchenDishes'&&state.dirtyDishes.table+state.dirtyDishes.yardTable===0)continue;
    const replacement=furnitureHabits[habit];
    if(!replacement){
      if((habit==='bedMake'||habit==='bedStretch')&&
        state.furnishing.soldFixtures?.includes('bed'))continue;
      results.push({habit,command:{type:'act',actionId:habit}});
      continue;
    }
    // Every key in furnitureHabits refers to one of these sold fixtures.
    const fixture=ACTIONS[habit].item as 'sofa'|'desk'|'table';
    if(!state.furnishing.soldFixtures?.includes(fixture))
      results.push({habit,command:{type:'act',actionId:habit}});
    for(const item of state.furnishing.placed)
      if(canFurniturePerform(item,replacement))
        results.push({habit,command:{type:'furniture_use',furnitureId:item.id,action:replacement}});
  }
  return results;
}
