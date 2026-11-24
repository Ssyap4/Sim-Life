import { COFFEE_CUPS_PER_DAY, INSTANT_COFFEE, INSTANT_COFFEE_ENERGY, coffeeCupsToday, type CoffeeBlend, type CoffeeDrink, BEAN_COFFEE, COFFEE_DRINKS, coffeeMachineTier } from './shared/coffee';
import { GROCERIES } from './shared/food';
import type { CharacterId, GameState } from './shared/protocol';

export function showCoffeeChoices(container: HTMLElement, state: GameState,
  role: CharacterId, brew: (blend: CoffeeBlend,drink?:CoffeeDrink) => boolean): void {
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
  const tier=coffeeMachineTier(state,role);
  const machine=document.createElement('strong');machine.className='food-section-heading';machine.textContent='☕ Кофемашина';container.append(machine);
  if(!tier){const note=document.createElement('p');note.className='food-empty';note.textContent='Купи кофемашину в магазине техники для приготовления зернового кофе.';container.append(note);return;}
  const note=document.createElement('p');note.className='food-empty';note.textContent='+'+tier.energy+'% бодрости · все напитки · общий лимит '+COFFEE_CUPS_PER_DAY+' чашки';container.append(note);
  const select=document.createElement('select');select.className='food-action';select.setAttribute('aria-label','Зерновой кофе');
  for(const id of BEAN_COFFEE){const opt=document.createElement('option');opt.value=id;opt.textContent=GROCERIES[id].name+' · '+state.pantry[id]+' порц.';opt.disabled=state.pantry[id]<1;select.append(opt);}
  const first=BEAN_COFFEE.find(id=>state.pantry[id]>0);if(first)select.value=first;select.disabled=!first;container.append(select);
  const drinks=[...COFFEE_DRINKS].sort((a,b)=>Number((tier.suggestions as readonly string[]).includes(b))-Number((tier.suggestions as readonly string[]).includes(a)));
  for(const drink of drinks){const button=document.createElement('button');button.className='food-action';button.type='button';button.textContent=drink+' · +'+tier.energy+'%';button.disabled=used>=COFFEE_CUPS_PER_DAY||!first;button.onclick=()=>brew(select.value as CoffeeBlend,drink);container.append(button);}
  }
