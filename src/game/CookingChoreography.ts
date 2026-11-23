import type { RecipeId, TakeoutId } from '../shared/food';

export type KitchenMove = 'chop' | 'whisk' | 'knead' | 'stir' | 'flip' | 'plate';
export type GrillMove = 'turn' | 'flip' | 'toss' | 'assemble' | 'plate';

const WHISK = new Set<RecipeId>(['omelette', 'pancakes', 'porridge', 'cremeBrulee', 'pannaCotta', 'chocolateFondant']);
const KNEAD = new Set<RecipeId>(['homemadePizza', 'sandwich', 'toast', 'lasagna', 'beefWellington']);
const FLIP = new Set<RecipeId>(['omelette', 'pancakes', 'friedPotatoes', 'toast']);

/** Compact recipe-driven phases. Only the pose changes; the server still owns
 * ingredients, timing, and results. All transitions are deterministic. */
export function kitchenMove(recipe: RecipeId | undefined, seconds: number): KitchenMove {
  const elapsed = Math.max(0, seconds);
  if (elapsed >= 9.6) return 'plate';
  if (elapsed < 3.0) return recipe && WHISK.has(recipe) ? 'whisk'
    : recipe && KNEAD.has(recipe) ? 'knead' : 'chop';
  if (recipe && FLIP.has(recipe)) return 'flip';
  if (recipe && (KNEAD.has(recipe) || recipe === 'fruitSalad' || recipe === 'salad'))
    return 'knead';
  return 'stir';
}

export function grillMove(recipe: RecipeId | undefined, seconds: number): GrillMove {
  if (seconds >= 12.6) return 'plate';
  if (recipe === 'grillChicken') return 'turn';
  if (recipe === 'grillVegetables') return 'toss';
  if (recipe === 'grillBurgers') return seconds < 8 ? 'flip' : 'assemble';
  return 'flip';
}

/** The helper prepares ingredients rather than mirroring the lead cook. */
export function mealUtensil(dish: RecipeId | TakeoutId | undefined): 'hands'|'spoon'|'fork' {
  if(dish==='toast'||dish==='sandwich'||dish==='homemadePizza'||
    dish==='shawarma'||dish==='burgerCombo'||dish==='pizzaCheese'||
    dish==='pizzaPepperoni'||dish==='pizzaBig'||dish==='grillBurgers') return 'hands';
  if(dish==='porridge'||dish==='chickenSoup'||dish==='beefStew'||dish==='mushroomRisotto'||dish==='seaBassRisotto'||dish==='pannaCotta'||dish==='cremeBrulee'||dish==='chocolateFondant')return 'spoon';
  return 'fork';
}

export function helperChop(seconds: number): boolean {
  return Math.floor(Math.max(0, seconds) / 3.4) % 2 === 0;
}

/** Anchor a personal serving close to the resident, on the actual rectangular
 * top, even after a bought table is rotated or moved. */
export function servingOffset(width: number, depth: number, actorLocalX: number,
  actorLocalZ: number): {x: number; z: number} {
  const insetX = Math.max(0.08, Math.min(0.23, width * .23));
  const insetZ = Math.max(0.08, Math.min(0.23, depth * .23));
  const limitX = Math.max(0, width / 2 - insetX);
  const limitZ = Math.max(0, depth / 2 - insetZ);
  return {
    x: Math.max(-limitX, Math.min(limitX, actorLocalX * .64)),
    z: Math.max(-limitZ, Math.min(limitZ, actorLocalZ * .64)),
  };
}
