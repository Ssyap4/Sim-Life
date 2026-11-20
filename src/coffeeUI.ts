import { COFFEE_CUPS_PER_DAY, INSTANT_COFFEE, INSTANT_COFFEE_ENERGY, coffeeCupsToday, type InstantCoffeeId } from './shared/coffee';
import { GROCERIES } from './shared/food';
import type { CharacterId, GameState } from './shared/protocol';

export function showCoffeeChoices(container: HTMLElement, state: GameState,
  role: CharacterId, brew: (blend: InstantCoffeeId) => boolean): void {
  const used = coffeeCupsToday(state, role);
  const heading = document.createElement('strong');
  heading.className = 'food-section-heading';
  heading.textContent = '☕ Растворимый кофе · ' + used + '/' + COFFEE_CUPS_PER_DAY + ' сегодня';
  container.append(heading);
  const hint = document.createElement('p');
  hint.className = 'food-empty';
  hint.textContent = 'Одна порция из семейных запасов · бодрость +' + INSTANT_COFFEE_ENERGY +
    '% · максимум 3 чашки за игровые сутки для каждого персонажа.';
  container.append(hint);
  for (const id of INSTANT_COFFEE) {
    if (id === 'coffee' && state.pantry.coffee === 0) continue;
    const qty = state.pantry[id];
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'food-action';
    button.dataset.coffee = id;
    const title = document.createElement('strong');
    title.textContent = GROCERIES[id].name;
    const subtitle = document.createElement('small');
    subtitle.textContent = 'Дома: ' + qty + ' порц. · +' + INSTANT_COFFEE_ENERGY + '% бодрости';
    button.append(title, subtitle);
    button.disabled = used >= COFFEE_CUPS_PER_DAY || qty < 1;
    button.addEventListener('click', () => brew(id));
    container.append(button);
  }
}
