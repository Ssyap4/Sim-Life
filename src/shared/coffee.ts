import type { CharacterId, GameState } from './protocol';
import { installedElectronics } from './electronics';
import type { IngredientId } from './food';

export const COFFEE_CUPS_PER_DAY = 3;
export const INSTANT_COFFEE_ENERGY = 10;
// The old unbranded coffee SKU stays usable for families with earlier saves.
export const INSTANT_COFFEE = ['coffeeNescafeGold', 'coffeeEgoiste', 'coffee'] as const satisfies readonly IngredientId[];
export type InstantCoffeeId = (typeof INSTANT_COFFEE)[number];

export const BEAN_COFFEE = ['beansJardin', 'beansLavazza', 'beansBushido'] as const satisfies readonly IngredientId[];
export type BeanCoffeeId = (typeof BEAN_COFFEE)[number];

// Every beverage is available on every purchased machine;
// the appliance tier determines the energy restored, not the recipe name.
export const COFFEE_DRINKS = ['Американо', 'Латте', 'Эспрессо', 'Капучино',
  'Флэт-уайт', 'Доппио', 'Двойной эспрессо'] as const;
export const COFFEE_MACHINE_TIERS = {
  basic: { name: 'Начальная кофеварка', energy: 15, suggestions: ['Американо', 'Латте'] },
  capsule: { name: 'Капсульная кофемашина', energy: 20, suggestions: ['Эспрессо', 'Капучино', 'Латте'] },
  premium: { name: 'Дорогая кофемашина', energy: 25, suggestions: ['Флэт-уайт', 'Доппио', 'Двойной эспрессо'] },
} as const;

export type CoffeeDrink=(typeof COFFEE_DRINKS)[number];
export type CoffeeBlend=InstantCoffeeId|BeanCoffeeId;
export function coffeeMachineTier(state:Pick<GameState,'world'>,role:CharacterId){
 const id=installedElectronics(state,role,'coffee');
 return id==='coffeeBasic'?COFFEE_MACHINE_TIERS.basic:id==='coffeeCapsule'?COFFEE_MACHINE_TIERS.capsule:id==='coffeePremium'?COFFEE_MACHINE_TIERS.premium:null;
}
export function validCoffeeOrder(blend:unknown,drink:unknown):blend is CoffeeBlend{
 return typeof blend==='string'&&(INSTANT_COFFEE.some(id=>id===blend)?drink===undefined:BEAN_COFFEE.some(id=>id===blend)&&COFFEE_DRINKS.some(d=>d===drink));
}
export type CoffeeDaily = Record<CharacterId, { day: number; cups: number }>;
export function newCoffeeDaily(): CoffeeDaily {
  return { vlad: { day: 0, cups: 0 }, alina: { day: 0, cups: 0 } };
}
export function coffeeCupsToday(state: Pick<GameState, 'coffeeDaily' | 'clock'>, role: CharacterId): number {
  const used = state.coffeeDaily[role];
  return used?.day === state.clock.day ? used.cups : 0;
}
