// Data-driven food catalogue. Add ingredients and recipes here instead of adding
// one action and one server switch-case per product.
export const GROCERIES = {
  eggs: { name: 'Яйца · 2 шт.', emoji: '🥚', price: 30, quantity: 2 },
  bread: { name: 'Хлеб', emoji: '🍞', price: 20, quantity: 1 },
  milk: { name: 'Молоко', emoji: '🥛', price: 45, quantity: 1 },
  cheese: { name: 'Сыр', emoji: '🧀', price: 65, quantity: 1 },
  tomato: { name: 'Помидоры · 2 шт.', emoji: '🍅', price: 40, quantity: 2 },
  carrot: { name: 'Морковь · 2 шт.', emoji: '🥕', price: 25, quantity: 2 },
  rice: { name: 'Рис', emoji: '🍚', price: 35, quantity: 2 },
  chicken: { name: 'Курица', emoji: '🍗', price: 95, quantity: 1 },
} as const;
export type IngredientId = keyof typeof GROCERIES;
export type Pantry = Record<IngredientId, number>;

export const RECIPES = {
  omelette: {
    name: 'Домашний омлет', emoji: '🍳', ingredients: { eggs: 2, milk: 1 },
    servings: 2, hunger: 30, mood: 5,
  },
  toast: {
    name: 'Сырные тосты', emoji: '🥪', ingredients: { bread: 2, cheese: 1 },
    servings: 2, hunger: 27, mood: 4,
  },
  salad: {
    name: 'Овощной салат', emoji: '🥗', ingredients: { tomato: 2, carrot: 1 },
    servings: 2, hunger: 23, mood: 6,
  },
  porridge: {
    name: 'Молочная каша', emoji: '🥣', ingredients: { rice: 1, milk: 1 },
    servings: 2, hunger: 28, mood: 4,
  },
  chickenRice: {
    name: 'Курица с рисом', emoji: '🍲', ingredients: { chicken: 1, rice: 1, carrot: 1 },
    servings: 2, hunger: 43, mood: 8,
  },
  sandwich: {
    name: 'Сэндвич с овощами', emoji: '🥙', ingredients: { bread: 1, cheese: 1, tomato: 1 },
    servings: 2, hunger: 26, mood: 5,
  },
} as const;
export type RecipeId = keyof typeof RECIPES;
export type CookedMeals = Record<RecipeId, number>;

export const EMPTY_PANTRY: Pantry = {
  eggs: 0, bread: 0, milk: 0, cheese: 0,
  tomato: 0, carrot: 0, rice: 0, chicken: 0,
};
export const EMPTY_MEALS: CookedMeals = {
  omelette: 0, toast: 0, salad: 0,
  porridge: 0, chickenRice: 0, sandwich: 0,
};
export function ingredientList(id: RecipeId): Array<[IngredientId, number]> {
  return Object.entries(RECIPES[id].ingredients) as Array<[IngredientId, number]>;
}
