import { GROCERIES, RECIPES, ingredientList, isGrillRecipe, recipePortionCost, type IngredientId, type RecipeId } from './shared/food';
import type { GameState } from './shared/protocol';
import { RECIPE_DESCRIPTIONS } from './shared/storageSpace';

export type FoodCommand = 'buy' | 'cook' | 'eat';

function entry(container: HTMLElement, heading: string, hint: string, disabled: boolean, onClick: () => void): void {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'food-action';
  button.disabled = disabled;
  const title = document.createElement('strong');
  title.textContent = heading;
  const small = document.createElement('small');
  small.textContent = hint;
  button.append(title, small);
  button.addEventListener('click', onClick);
  container.append(button);
}

export function showFoodChoices(
  container: HTMLElement,
  location: 'delivery' | 'kitchen' | 'table' | 'grill' | 'yardTable',
  state: GameState,
  submit: (type: FoodCommand, id: IngredientId | RecipeId) => boolean,
): void {
  const heading = document.createElement('div');
  heading.className = 'food-section-heading';
  heading.textContent = location === 'delivery' ? '🛍️ Продукты с доставкой'
    : location === 'grill' ? 'Блюда на гриле'
    : location === 'kitchen' ? '🍳 Приготовить из запасов'
    : '🍽️ Готовые порции на всех';
  container.append(heading);
  if (location === 'delivery') {
    for (const [id, product] of Object.entries(GROCERIES) as Array<[IngredientId, (typeof GROCERIES)[IngredientId]]>) {
      entry(container, product.emoji + ' ' + product.name + ' · ' + product.price + ' ₽',
        'В запасе: ' + state.pantry[id] + ' · получить: +' + product.quantity,
        state.money < product.price || state.pantry[id] + product.quantity > 99,
        () => submit('buy', id));
    }
  } else if (location === 'kitchen' || location === 'grill') {
    for (const [id, recipe] of Object.entries(RECIPES) as Array<[RecipeId, (typeof RECIPES)[RecipeId]]>) {
      if (isGrillRecipe(id) !== (location === 'grill')) continue;
      const ingredients = ingredientList(id);
      const needed = ingredients.map(([ingredient, quantity]) =>
        GROCERIES[ingredient].emoji + ' ' + GROCERIES[ingredient].name.split(' · ')[0] +
        ' ×' + quantity + (state.pantry[ingredient] < quantity ? ' ❗ (есть ' + state.pantry[ingredient] + ')' : ''),
      ).join(' · ');
      const missing = ingredients.filter(([ingredient, qty]) => state.pantry[ingredient] < qty);
      const available = missing.length === 0;
      const limitReached = state.meals[id] + recipe.servings > 30;
      const reason = missing.length ? 'Не хватает: ' + missing.map(([ingredient, qty]) =>
        GROCERIES[ingredient].name.split(' · ')[0] + ' ×' + (qty - state.pantry[ingredient])).join(', ') + '. ' :
        limitReached ? 'Запас готового блюда заполнен (максимум 30 порций). ' : '';
      entry(container, recipe.emoji + ' ' + recipe.name,
        reason + RECIPE_DESCRIPTIONS[id] + ' · Ингредиенты: ' + needed +
        ' · ' + recipe.servings + ' порц. · ~' + recipePortionCost(id) + ' ₽/порция',
        !available || limitReached,
        () => submit('cook', id));
    }
  } else {
    let hasMeals = false;
    for (const [id, recipe] of Object.entries(RECIPES) as Array<[RecipeId, (typeof RECIPES)[RecipeId]]>) {
      if (!state.meals[id] || isGrillRecipe(id) !== (location === 'yardTable')) continue;
      hasMeals = true;
      entry(container, recipe.emoji + ' ' + recipe.name,
        'Порций: ' + state.meals[id] + ' · голод +' + recipe.hunger + ' · настроение +' + recipe.mood,
        false, () => submit('eat', id));
    }
    if (!hasMeals) {
      const hint = document.createElement('p');
      hint.className = 'food-empty';
      hint.textContent = location === 'yardTable' ? 'На столе пока нет блюд с гриля.'
        : 'Пока нет готовой еды. Купите ингредиенты и приготовьте что-нибудь на кухне.';
      container.append(hint);
    }
  }
}
