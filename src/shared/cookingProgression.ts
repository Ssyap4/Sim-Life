import { MAX_SKILL_LEVEL, skillRank, talent, type EducationProfile } from './education';
import type { CharacterId } from './protocol';
import type { RecipeId } from './food';

/** Cooking is gated by preparation technique, not by price, portions or ingredients. */
export const COOKING_RECIPES: Record<RecipeId, { minLevel: number; baseXP: number; tier: string }> = {
  toast: { minLevel: 0, baseXP: 25, tier: 'Основы' },
  fruitSalad: { minLevel: 0, baseXP: 27, tier: 'Основы' },
  sandwich: { minLevel: 1, baseXP: 29, tier: 'Основы' },
  porridge: { minLevel: 0, baseXP: 30, tier: 'Основы' },
  salad: { minLevel: 0, baseXP: 32, tier: 'Основы' },
  omelette: { minLevel: 0, baseXP: 34, tier: 'Основы' },
  pastaCheese: { minLevel: 2, baseXP: 36, tier: 'Домашнее' },
  friedPotatoes: { minLevel: 2, baseXP: 38, tier: 'Домашнее' },
  grillVegetables: { minLevel: 2, baseXP: 40, tier: 'Домашнее' },
  chickenSoup: { minLevel: 3, baseXP: 44, tier: 'Домашнее' },
  buckwheatChicken: { minLevel: 2, baseXP: 46, tier: 'Домашнее' },
  pancakes: { minLevel: 3, baseXP: 48, tier: 'Домашнее' },
  easterBerryPancakes:{minLevel:1,baseXP:52,tier:'Праздничное'},
  easterHoneyPancakes:{minLevel:0,baseXP:52,tier:'Праздничное'},
  birthdayCake:{minLevel:2,baseXP:54,tier:'Праздничное'},
  christmasApples:{minLevel:1,baseXP:35,tier:'Праздничное'},
  chickenRice: { minLevel: 3, baseXP: 50, tier: 'Домашнее' },
  grillChicken: { minLevel: 3, baseXP: 52, tier: 'Домашнее' },
  pastaBolognese: { minLevel: 4, baseXP: 56, tier: 'Домашнее' },
  grillBurgers: { minLevel: 4, baseXP: 58, tier: 'Домашнее' },
  homemadePizza: { minLevel: 4, baseXP: 62, tier: 'Домашнее' },
  beefStew: { minLevel: 5, baseXP: 67, tier: 'Продвинутое' },
  grillSteak: { minLevel: 6, baseXP: 73, tier: 'Продвинутое' },
  lasagna: { minLevel: 7, baseXP: 74, tier: 'Ресторанное' },
  mushroomRisotto: { minLevel: 8, baseXP: 78, tier: 'Ресторанное' },
  beefStroganoff: { minLevel: 9, baseXP: 82, tier: 'Ресторанное' },
  lakeFriedFish:{minLevel:2,baseXP:42,tier:'Домашнее'},
  lakeUkha:{minLevel:4,baseXP:60,tier:'Домашнее'},
  lakeBakedFish:{minLevel:7,baseXP:76,tier:'Ресторанное'},
  salmonLemon: { minLevel: 10, baseXP: 86, tier: 'Ресторанное' },
  creamyChicken: { minLevel: 11, baseXP: 90, tier: 'Высокая кухня' },
  shrimpLinguine: { minLevel: 12, baseXP: 94, tier: 'Высокая кухня' },
  duckOrange: { minLevel: 13, baseXP: 98, tier: 'Высокая кухня' },
  pepperMedallions: { minLevel: 14, baseXP: 102, tier: 'Высокая кухня' },
  pannaCotta: { minLevel: 15, baseXP: 106, tier: 'Высокая кухня' },
  cremeBrulee: { minLevel: 16, baseXP: 110, tier: 'Высокая кухня' },
  lambRosemary: { minLevel: 17, baseXP: 114, tier: 'Мастерское' },
  beefWellington: { minLevel: 18, baseXP: 118, tier: 'Мастерское' },
  seaBassRisotto: { minLevel: 19, baseXP: 122, tier: 'Мастерское' },
  chocolateFondant: { minLevel: 20, baseXP: 126, tier: 'Мастерское' },
};

export const COOKING_ORDER = (Object.keys(COOKING_RECIPES) as RecipeId[])
  .sort((a, b) => COOKING_RECIPES[a].minLevel - COOKING_RECIPES[b].minLevel ||
    COOKING_RECIPES[a].baseXP - COOKING_RECIPES[b].baseXP);

const repeatMultiplier = (count: number): number =>
  count === 0 ? 1.2 : count < 3 ? .9 : count < 7 ? .68 : count < 15 ? .43 : .24;

/** Shared UI/server prediction; no random numbers or daily caps. */
export function cookingExperience(profile: EducationProfile, role: CharacterId, id: RecipeId,
  assisting = false): number {
  const level = skillRank(profile.xp.cooking).level;
  if (level >= MAX_SKILL_LEVEL) return 0;
  const recipe = COOKING_RECIPES[id];
  const completed = profile.studied['life:recipe:' + id]?.completions ?? 0;
  // A dish far below the cook's ability is practice, not an efficient grinding route.
  const overqualified = Math.max(0, level - recipe.minLevel - 5);
  const relevance = Math.max(.12, 1 - overqualified * .17);
  const help = assisting ? .55 : 1;
  return Math.max(1, Math.round(recipe.baseXP * repeatMultiplier(completed) *
    relevance * help * (1 + talent(role, 'cooking') / 100)));
}

export function cookingEnergy(level: number, id: RecipeId): number {
  const required = COOKING_RECIPES[id].minLevel;
  const tier = required >= 16 ? 8 : required >= 11 ? 7 : required >= 7 ? 6 : required >= 3 ? 5 : 4;
  return Math.max(2, tier - (level >= required + 5 ? 2 : level >= required + 2 ? 1 : 0));
}
