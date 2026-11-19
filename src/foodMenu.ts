import { GROCERIES, RECIPES, ingredientList, recipePortionCost, type IngredientId, type RecipeId } from './shared/food';
import type { GameState } from './shared/protocol';

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
  location: 'delivery' | 'kitchen' | 'table',
  state: GameState,
  submit: (type: FoodCommand, id: IngredientId | RecipeId) => boolean,
): void {
  const heading = document.createElement('div');
  heading.className = 'food-section-heading';
  heading.textContent = location === 'delivery' ? '🛍️ Продукты с доставкой'
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
  } else if (location === 'kitchen') {
    for (const [id, recipe] of Object.entries(RECIPES) as Array<[RecipeId, (typeof RECIPES)[RecipeId]]>) {
      const needed = ingredientList(id).map(([ingredient, quantity]) =>
        GROCERIES[ingredient].emoji + quantity + (state.pantry[ingredient] < quantity ? ' ❗' : ''),
      ).join(' · ');
      const available = ingredientList(id).every(([ingredient, qty]) => state.pantry[ingredient] >= qty);
      entry(container, recipe.emoji + ' ' + recipe.name,
        needed + ' · '+recipe.servings+' порц. · ~'+recipePortionCost(id)+' ₽/порция',
        !available || state.meals[id] + recipe.servings > 30,
        () => submit('cook', id));
    }
  } else {
    for (const [id, recipe] of Object.entries(RECIPES) as Array<[RecipeId, (typeof RECIPES)[RecipeId]]>) {
      if (state.meals[id] === 0) continue;
      entry(container, recipe.emoji + ' ' + recipe.name,
        'Порций: ' + state.meals[id] + ' · голод +' + recipe.hunger + ' · настроение +' + recipe.mood,
        false, () => submit('eat', id));
    }
    if (Object.values(state.meals).every((count) => count === 0)) {
      const hint = document.createElement('p');
      hint.className = 'food-empty';
      hint.textContent = 'Пока нет готовой еды. Купите ингредиенты и приготовьте что-нибудь на кухне.';
      container.append(hint);
    }
  }
}
