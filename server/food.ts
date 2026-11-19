import { GROCERIES, RECIPES, ingredientList, type IngredientId, type RecipeId } from '../src/shared/food';
import { names, points, type CharacterId, type GameState } from '../src/shared/protocol';

export type FoodCommand =
  | { type: 'buy'; item: string }
  | { type: 'cook'; recipe: string }
  | { type: 'eat'; recipe: string };
export type FoodResult = { ok: true; state: GameState; message: string } | { ok: false; reason: string };

const owns = <T extends object>(record: T, key: string): key is Extract<keyof T, string> =>
  Object.prototype.hasOwnProperty.call(record, key);

export function applyFoodAction(source: GameState, role: CharacterId, command: FoodCommand): FoodResult {
  const state = structuredClone(source);
  const actor = state.characters[role];
  let message: string;
  if (command.type === 'buy') {
    if (!owns(GROCERIES, command.item)) return { ok: false, reason: 'Нет такого продукта' };
    const id: IngredientId = command.item;
    const product = GROCERIES[id];
    if (state.money < product.price) return { ok: false, reason: 'Недостаточно денег на покупку' };
    if (state.pantry[id] + product.quantity > 99) return { ok: false, reason: 'Запас этого продукта заполнен' };
    state.money -= product.price;
    state.pantry[id] += product.quantity;
    message = names[role] + ': доставлено ' + product.name + ' за ' + product.price + ' ₽';
  } else if (command.type === 'cook') {
    if (!owns(RECIPES, command.recipe)) return { ok: false, reason: 'Неизвестный рецепт' };
    const id: RecipeId = command.recipe;
    const recipe = RECIPES[id];
    const missing = ingredientList(id).filter(([item, amount]) => state.pantry[item] < amount);
    if (missing.length) {
      return { ok: false, reason: 'Не хватает ингредиентов: ' +
        missing.map(([item, count]) => GROCERIES[item].name + ' (нужно ' + count + ')').join(', ') };
    }
    if (state.meals[id] + recipe.servings > 30) return { ok: false, reason: 'Слишком много готовой еды этого вида' };
    if (actor.energy < 4) return { ok: false, reason: 'Не хватает сил для готовки' };
    for (const [item, amount] of ingredientList(id)) state.pantry[item] -= amount;
    state.meals[id] += recipe.servings;
    actor.energy = Math.max(0, actor.energy - 4);
    actor.mood = Math.min(100, actor.mood + 2);
    Object.assign(actor, { ...points.kitchen, pose: 'work' as const });
    message = names[role] + ': приготовлено ' + recipe.name + ', ' + recipe.servings + ' порции';
  } else {
    if (!owns(RECIPES, command.recipe)) return { ok: false, reason: 'Неизвестное блюдо' };
    const id: RecipeId = command.recipe;
    const meal = RECIPES[id];
    if (state.meals[id] < 1) return { ok: false, reason: 'Готовых порций нет — сначала приготовь' };
    state.meals[id] -= 1;
    actor.hunger = Math.min(100, actor.hunger + meal.hunger);
    actor.mood = Math.min(100, actor.mood + meal.mood);
    Object.assign(actor, { ...points.table, pose: 'sit' as const });
    message = names[role] + ': поел(а) ' + meal.name;
  }
  state.revision += 1;
  return { ok: true, state, message };
}
