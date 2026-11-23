import type { ActionId, CharacterId, GameState } from './protocol';

/** Cheap, deterministic household preferences. This is NOT an executor:
 * existing server validation, real furniture and route/resource checks still
 * decide whether an action may run. No purchases, careers or invented objects. */
export function homeHabitSuggestions(state:GameState,role:CharacterId,turn:number):ActionId[]{
  const hour=Math.floor(state.clock.minute/60);
  const morning=hour>=5&&hour<11, evening=hour>=18||hour<5;
  const tired=state.characters[role].energy<55;
  const phase=morning?'morning':evening?'evening':'day';
  const bank:Record<CharacterId,Record<typeof phase,readonly ActionId[]>>={
    vlad:{
      morning:['bathTeeth','kitchenWash','tablePlan','deskJournal','sofaRest'],
      day:['deskJournal','tablePlan','kitchenTidy','bathWash','sofaRest'],
      evening:['tablePlan','sofaRest','deskJournal','kitchenTidy','bathTeeth'],
    },
    alina:{
      morning:['bathTeeth','bathWash','tablePlan','kitchenTidy','sofaMusic'],
      day:['tablePlan','kitchenTidy','bathWash','sofaMusic','bathTeeth'],
      evening:['sofaMusic','tablePlan','bathWash','sofaRest','kitchenTidy'],
    },
  };
  const options=bank[role][phase];
  // Morning routines start at the bathroom; later routine turns vary. Lower
  // energy puts a genuine resting action first, never creates energy for free.
  const offset=Math.max(0,Math.trunc(Number.isFinite(turn)?turn:0))%options.length;
  const rotated=options.map((_,i)=>options[(i+offset)%options.length]);
  if(tired){
    const soothing=role==='alina'?'sofaMusic':'sofaRest';
    return [soothing,...rotated.filter(id=>id!==soothing)];
  }
  return rotated;
}
