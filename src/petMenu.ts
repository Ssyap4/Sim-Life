import {
  PETS, PET_IDS, PET_ACTION_NAMES, PET_BOWL_CAPACITY, PET_FOOD_MAX_REFILLS, petHungerLevel, type PetId, type PetAction,
} from './shared/pets';
import type { GameState } from './shared/protocol';
import { catPerchCandidates } from './shared/CatPerches';
import { petWish } from './shared/petWishes';

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
    const hunger = petHungerLevel(state.pets[id].satiety);
    button.textContent = pet.emoji + ' ' + pet.name + (hunger === 'critical' ? ' ❗' : hunger === 'warning' ? ' ⚠️' : '');
    button.title = 'Сытость: ' + Math.round(state.pets[id].satiety) + '%';
    button.addEventListener('click', () => choose(id));
    tabs.appendChild(button);
  }
  container.appendChild(tabs);
  if (!selected) {
    // First tap on the Pets panel shows both personalities immediately;
    // opening individual stats/actions remains optional.
    for (const id of PET_IDS) {
      const wish = petWish(state, id);
      const overview = document.createElement('button');
      overview.type = 'button';
      overview.className = 'pet-wish pet-wish-preview' + (wish.urgent ? ' pet-wish-urgent' : '');
      const title = document.createElement('strong');
      title.textContent = PETS[id].emoji + ' ' + PETS[id].name + ' · ' + wish.title;
      const phrase = document.createElement('span');
      phrase.textContent = wish.message;
      const tip = document.createElement('small');
      tip.textContent = 'Подробнее о питомце и его потребностях';
      overview.append(title, phrase, tip);
      overview.addEventListener('click', () => choose(id));
      container.appendChild(overview);
    }
    return;
  }
  const pet = PETS[selected];
  const stats = state.pets[selected];
  const description = document.createElement('p');
  description.className = 'pet-note';
  description.textContent = pet.species + ' · запас: ' + state.petFood[selected] + ' насыпаний' +
    ' · миска: ' + state.petBowls[selected] + '/' + PET_BOWL_CAPACITY + ' порций';
  container.appendChild(description);
  const wish = petWish(state, selected);
  const thoughts = document.createElement('section');
  thoughts.className = 'pet-wish' + (wish.urgent ? ' pet-wish-urgent' : '');
  const title = document.createElement('strong');
  title.textContent = '💭 Что хочет ' + pet.name + '? · ' + wish.title;
  const phrase = document.createElement('p');
  phrase.textContent = wish.message;
  const tip = document.createElement('small');
  tip.textContent = 'Подсказка: ' + wish.advice;
  thoughts.append(title, phrase, tip);
  container.appendChild(thoughts);
  const hungerLevel = petHungerLevel(stats.satiety);
  if (hungerLevel !== 'normal') {
    const hungry = document.createElement('p');
    hungry.className = 'pet-note';
    hungry.setAttribute('role','status');
    hungry.textContent = (hungerLevel === 'critical' ? '❗ Критический голод' : '⚠️ Проголодался') +
      ' · сытость ' + Math.round(stats.satiety) + '%.' +
      (state.petBowls[selected] === 0
        ? ' Миска пуста: насыпь корм, чтобы ' + pet.name + ' смог поесть.'
        : ' В миске есть корм: ' + pet.name + ' сможет самостоятельно поесть.');
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
      hint: '−1 насыпание из пачки · +3 порции в миску · питомец ест сам при сытости 40% и ниже',
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
  // These are new server-owned routes, not copies of the existing pet/play actions.
  actions.unshift({
    action:'call',icon:'📣',hint:'Питомец сам подходит к хозяину, обходя мебель',
    disabled:stats.satiety<40||stats.bladder<35||stats.energy<20,
  });
  if(selected==='simba')actions.splice(1,0,{
    action:'perch',icon:'🛋️',hint:'Запрыгнуть на доступную кровать, диван или кресло',
    disabled:stats.satiety<40||stats.bladder<35||stats.energy<20||
      catPerchCandidates(state.furnishing).length===0,
  });
  else actions.splice(1,0,{
    action:'fetch',icon:'🎾',hint:'Пробежать к мячику и принести его обратно',
    disabled:stats.satiety<40||stats.bladder<35||stats.energy<42,
  });
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
