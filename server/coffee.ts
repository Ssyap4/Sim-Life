import { COFFEE_CUPS_PER_DAY, INSTANT_COFFEE_ENERGY, coffeeCupsToday, type CoffeeBlend, coffeeMachineTier, validCoffeeOrder } from '../src/shared/coffee';
import { GROCERIES } from '../src/shared/food';
import { KITCHEN_WORK } from '../src/shared/home';
import { names, type CharacterId, type GameState } from '../src/shared/protocol';

export type CoffeeResult = { ok: true; state: GameState; message: string } |
  { ok: false; reason: string };

export function brewInstantCoffee(source:GameState,role:CharacterId,requested:string):CoffeeResult{
 return brewCoffee(source,role,requested);
}
export function brewCoffee(source: GameState, role: CharacterId, requested: string, drink?:unknown): CoffeeResult {
  if(!validCoffeeOrder(requested,drink))return {ok:false,reason:'Неизвестный кофе или напиток'};
  if (source.world.places[role] !== 'home') return { ok: false, reason: 'Кофе можно приготовить только дома' };
  const id = requested as CoffeeBlend;
  const tier=coffeeMachineTier(source,role);
  if(drink!==undefined&&!tier)return {ok:false,reason:'Сначала купи кофемашину'};
  const energy=drink===undefined?INSTANT_COFFEE_ENERGY:tier!.energy;
  if (coffeeCupsToday(source, role) >= COFFEE_CUPS_PER_DAY)
    return { ok: false, reason: 'Лимит кофе: не больше 3 чашек за игровые сутки' };
  if (source.pantry[id] < 1) return { ok: false, reason: 'Кофе закончился — купи упаковку в магазине' };
  const state = structuredClone(source);
  state.pantry[id]--;
  state.coffeeDaily[role] = { day: state.clock.day, cups: coffeeCupsToday(source, role) + 1 };
  state.characters[role].energy = Math.min(100, state.characters[role].energy + energy);
  Object.assign(state.characters[role], KITCHEN_WORK.coffee.position, { pose: 'idle' as const });
  state.revision++;
  return { ok: true, state, message: names[role] + ': выпил(а) ' + (drink===undefined?GROCERIES[id].name:String(drink)) +
    ' · бодрость +' + energy + '% · ' + state.coffeeDaily[role].cups + '/' + COFFEE_CUPS_PER_DAY + ' чашки за сутки' };
}
