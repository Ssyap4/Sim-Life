import { canFurniturePerform, type FurnitureUseAction } from './furnitureUse';
import { ACTIONS, type ActionId, type CharacterId, type GameState, type TimedCommand } from './protocol';

/** Quiet, *real* household work. Suggestions are never executed directly:
 * the server still checks routes, available furniture, needs and reservations. */
const BANK: Record<CharacterId, Record<'morning'|'day'|'evening'|'night', readonly ActionId[]>> = {
  vlad: {
    morning: ['bathTeeth','bedStretch','kitchenTea','deskJournal','tablePlan','kitchenWash'],
    day: ['deskJournal','tablePlan','kitchenTidy','kitchenTea','deskGames','bathWash'],
    evening: ['tablePlan','sofaRest','deskJournal','kitchenDishes','sofaCall','bathTeeth'],
    night: ['sofaRest','deskJournal','bathTeeth','kitchenTea','bathWash'],
  },
  alina: {
    morning: ['bathTeeth','bathWash','kitchenTea','bedMake','tablePlan','sofaMusic'],
    day: ['tablePlan','kitchenTidy','sofaMusic','kitchenTea','bathWash','sofaCall'],
    evening: ['sofaMusic','tablePlan','kitchenTea','sofaCall','sofaRest','bathWash'],
    night: ['sofaMusic','sofaRest','bathWash','kitchenTea','bathTeeth'],
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
  const hour=((Math.floor(state.clock.minute/60)%24)+24)%24;
  const phase=hour>=23||hour<5?'night':hour<11?'morning':
    hour<18?'day':'evening';
  const options=BANK[role][phase];
  const offset=Math.max(0,Math.trunc(Number.isFinite(turn)?turn:0))%options.length;
  const rotated=options.map((_,i)=>options[(i+offset)%options.length]);
  const resident=state.characters[role];
  const personal:ActionId[]=[];
  // Mild real-world needs shape a preference; critical needs still have
  // a separate higher-priority, authoritative planner in server/server.ts.
  if(resident.energy<55)
    personal.push(role==='vlad'||resident.energy<45?'sofaRest':'sofaMusic');
  else if(resident.mood<45)
    personal.push(role==='vlad'?'deskJournal':'sofaMusic');
  if(resident.social<46 && phase!=='night') personal.push('sofaCall');
  if(resident.fun<48 && resident.energy>=55 && phase!=='night')
    personal.push(role==='vlad'?'deskGames':'sofaMusic');
  if(resident.hygiene<58) personal.push(role==='vlad'?'bathTeeth':'bathWash');
  if(state.dirtyDishes.table+state.dirtyDishes.yardTable>0)
    personal.push('kitchenDishes');
  const candidates=[...new Set([...personal,...rotated])];
  // Recent tasks rank lower, but small/remodeled homes never lose options.
  return [...candidates.filter(id=>!recent.includes(id)),
    ...candidates.filter(id=>recent.includes(id))];
}

export interface HomeHabitCommand { habit:ActionId; command:TimedCommand }

/** The starter fixture may have been sold. Resolve suggestions to installed
 * furniture of the right shape instead of attempting a ghost starter station.
 * This only yields candidates; authoritative server checks every route. */
export function homeHabitCommands(
  state:GameState,role:CharacterId,turn:number,recent:readonly ActionId[]=[],
):HomeHabitCommand[] {
  const results:HomeHabitCommand[]=[];
  if(state.autonomy[role]==='full'){
    const hour=state.clock.minute/60;
    const curtain=hour>=6&&hour<10&&state.kitchenCurtainsClosed?'curtainsOpen':hour>=20&&!state.kitchenCurtainsClosed?'curtainsClose':undefined;
    if(curtain&&!recent.includes(curtain))results.push({habit:curtain,command:{type:'act',actionId:curtain}});
  }
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
