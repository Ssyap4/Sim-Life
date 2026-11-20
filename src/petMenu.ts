import {
  PETS, PET_IDS, PET_ACTION_NAMES, PET_BOWL_CAPACITY, PET_FOOD_MAX_REFILLS, type PetId, type PetAction,
} from './shared/pets';
import type { GameState } from './shared/protocol';

/** Small touch-friendly family panel driven by persistent server state. */
export function renderPetChoices(
  container: HTMLElement,
  state: GameState,
  selected: PetId | null,
  choose: (id: PetId) => void,
  send: (id: PetId, action: PetAction) => boolean,
): void {
  const tabs = document.createElement('div');
  tabs.className = 'pet-tabs';
  for (const id of PET_IDS) {
    const pet = PETS[id];
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'pet-tab' + (selected === id ? ' selected' : '');
    button.textContent = pet.emoji + ' ' + pet.name;
    button.addEventListener('click', () => choose(id));
    tabs.appendChild(button);
  }
  container.appendChild(tabs);
  if (!selected) return;
  const pet = PETS[selected];
  const stats = state.pets[selected];
  const description = document.createElement('p');
  description.className = 'pet-note';
  description.textContent = pet.species + ' · запас: ' + state.petFood[selected] + ' насыпаний' +
    ' · миска: ' + state.petBowls[selected] + '/' + PET_BOWL_CAPACITY + ' порций';
  container.appendChild(description);
  if (stats.satiety < 20 && state.petBowls[selected] === 0) {
    const hungry = document.createElement('p');
    hungry.className = 'pet-note';
    hungry.textContent = '⚠️ ' + pet.name + ' голоден, а миска пуста. Насыпь корм, чтобы он смог поесть.';
    container.appendChild(hungry);
  }

  const status = document.createElement('div');
  status.className = 'pet-status';
  const meters: Array<[string, number, string]> = [
    ['Сытость', stats.satiety, 'food'],
    ['Энергия', stats.energy, 'happy'],
    ['Туалет', stats.bladder, 'bond'],
    ['Радость', stats.happiness, 'happy'],
    ['Привязанность', stats.bond, 'bond'],
  ];
  for (const [label, value, className] of meters) {
    const line = document.createElement('div');
    line.className = 'pet-meter';
    const legend = document.createElement('span');
    legend.textContent = label + ' · ' + Math.round(value) + '%';
    const track = document.createElement('div');
    track.className = 'pet-meter-track';
    const fill = document.createElement('i');
    fill.className = className;
    fill.style.width = value + '%';
    track.append(fill);
    line.append(legend, track);
    status.appendChild(line);
  }
  container.appendChild(status);

  const actions: Array<{ action: PetAction; icon: string; hint: string; disabled: boolean }> = [
    {
      action: 'feed', icon: '🥣',
      hint: '−1 насыпание из пачки · +3 порции в миску · питомец ест сам при сытости <20%',
      disabled: state.petFood[selected] < 1 || state.petBowls[selected] > 0,
    },
    {
      action: 'play', icon: '🎾',
      hint: 'Радость и дружба · немного энергии игрока',
      disabled: stats.satiety < 8,
    },
    { action: 'pet', icon: '❤️', hint: 'Ласка, настроение и доверие', disabled: false },
    { action: 'brush', icon: '🪮', hint: 'Уход за шерстью и привязанность', disabled: false },
    {
      action: 'buyFood', icon: '🛍️',
      hint: pet.foodName + ' · ' + pet.foodPrice + ' ₽ за 10 насыпаний (30 порций)',
      disabled: state.money < pet.foodPrice || state.petFood[selected] > PET_FOOD_MAX_REFILLS - pet.foodAmount,
    },
  ];
  for (const row of actions) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'food-action pet-action';
    button.disabled = row.disabled;
    const title = document.createElement('strong');
    title.textContent = row.icon + ' ' + PET_ACTION_NAMES[row.action];
    const hint = document.createElement('small');
    hint.textContent = row.hint;
    button.append(title, hint);
    button.addEventListener('click', () => send(selected, row.action));
    container.appendChild(button);
  }
}
