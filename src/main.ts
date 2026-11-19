import './style.css';
import { World, objectNames } from './game/World';
import { changeStat, loadState, names, saveState, type CharacterId, type GameState } from './core/state';

type ItemId = keyof typeof objectNames;
type Pose = 'idle' | 'sit' | 'sleep' | 'work';
type GameAction = {
  label: string;
  pose: Pose;
  apply: (state: GameState, character: CharacterId) => string;
};

const state = loadState();
let active: CharacterId = 'vlad';
let toastTimer: number | undefined;

const app = document.querySelector<HTMLDivElement>('#app');
if (!app) throw new Error('Отсутствует #app');
app.innerHTML = `
  <canvas id="game-canvas" aria-label="Трёхмерный дом Sim-Life"></canvas>
  <div class="vignette"></div>
  <header class="top-ui">
    <div class="brand-row">
      <div class="brand">
        <div class="brand-icon">⌂</div>
        <div><span class="brand-kicker">НАШ МАЛЕНЬКИЙ МИР</span><h1>Sim-Life <span class="heart">♥</span></h1></div>
      </div>
      <div class="version">ПРОТОТИП 0.1</div>
    </div>
    <div class="money-panel"><span>🏡 Семейный бюджет</span><strong id="money"></strong></div>
    <div class="characters" id="characters">
      <button class="person" data-id="vlad" type="button" aria-pressed="true">
        <span class="avatar avatar-vlad">В</span>
        <span class="person-info"><strong>Влад</strong><span>Разработка</span><span class="meters"><i class="hunger" id="vlad-hunger"></i><i class="energy" id="vlad-energy"></i></span></span>
      </button>
      <button class="person" data-id="alina" type="button" aria-pressed="false">
        <span class="avatar avatar-alina">А</span>
        <span class="person-info"><strong>Алина</strong><span>Реконструкция волос</span><span class="meters"><i class="hunger" id="alina-hunger"></i><i class="energy" id="alina-energy"></i></span></span>
      </button>
    </div>
    <div class="status-line" id="status">Выбери предмет в доме, чтобы открыть действия</div>
  </header>
  <div id="message" class="message" aria-live="polite"></div>
  <footer class="bottom-ui">
    <div id="actions" class="actions" hidden></div>
    <div class="tip" id="tip">
      <span class="tip-icon">✦</span>
      <span>Нажимай на мебель, чтобы действовать. Перетаскивай для поворота камеры, двумя пальцами меняй масштаб.</span>
    </div>
    <div class="footer-row">
      <span>♥ Дом Влада и Алины</span>
      <span>Тест двух ролей · без онлайна</span>
    </div>
  </footer>
  <div class="rotate-notice">Для Sim-Life поверни телефон вертикально ↻</div>
`;

const canvas = document.querySelector<HTMLCanvasElement>('#game-canvas')!;
const actionsEl = document.querySelector<HTMLDivElement>('#actions')!;
const statusEl = document.querySelector<HTMLDivElement>('#status')!;
const messageEl = document.querySelector<HTMLDivElement>('#message')!;

function notify(message: string): void {
  messageEl.textContent = message;
  messageEl.classList.add('show');
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => messageEl.classList.remove('show'), 3500);
}

function render(): void {
  document.querySelector<HTMLElement>('#money')!.textContent =
    new Intl.NumberFormat('ru-RU').format(state.money) + ' ₽';
  for (const id of ['vlad', 'alina'] as const) {
    const stats = state.characters[id];
    const hunger = document.querySelector<HTMLElement>(`#${id}-hunger`)!;
    const energy = document.querySelector<HTMLElement>(`#${id}-energy`)!;
    hunger.style.background = `linear-gradient(to right,#d4a977 ${stats.hunger}%,#e8e1d5 ${stats.hunger}%)`;
    energy.style.background = `linear-gradient(to right,#8eaa98 ${stats.energy}%,#e8e1d5 ${stats.energy}%)`;
    const button = document.querySelector<HTMLButtonElement>(`[data-id="${id}"]`)!;
    button.classList.toggle('active', id === active);
    button.setAttribute('aria-pressed', String(id === active));
    button.title = `Голод ${Math.round(stats.hunger)}%, энергия ${Math.round(stats.energy)}%, навык ${Math.round(stats.skill)}%`;
  }
}

function getActions(id: ItemId): GameAction[] {
  switch (id) {
    case 'sofa':
      return [
        { label: '🛋️ Отдохнуть', pose: 'sit', apply: (s, c) => {
          changeStat(s, c, 'energy', 12);
          changeStat(s, c, 'mood', 4);
          return `${names[c]} немного отдохнул(а) на диване`;
        }},
        { label: '🎬 Посмотреть фильм (диван + ТВ)', pose: 'sit', apply: (s, c) => {
          changeStat(s, c, 'mood', 15);
          changeStat(s, c, 'energy', -3);
          return `${names[c]} посмотрел(а) фильм и отлично провёл(а) время`;
        }},
      ];
    case 'bed':
      return [
        { label: '🌙 Поспать', pose: 'sleep', apply: (s, c) => {
          changeStat(s, c, 'energy', 37);
          changeStat(s, c, 'hunger', -6);
          return `${names[c]} выспал(ась)`;
        }},
        { label: '😴 Вздремнуть', pose: 'sleep', apply: (s, c) => {
          changeStat(s, c, 'energy', 15);
          changeStat(s, c, 'hunger', -2);
          return `${names[c]} немного поспал(а)`;
        }},
      ];
    case 'desk':
      return active === 'vlad' ? [
        { label: '💻 Выполнить простой заказ', pose: 'work', apply: (s, c) => {
          s.money += 120;
          changeStat(s, c, 'skill', 6);
          changeStat(s, c, 'energy', -11);
          changeStat(s, c, 'hunger', -7);
          return 'Влад завершил первый фриланс-заказ: +120 ₽';
        }},
        { label: '📚 Учиться разработке', pose: 'work', apply: (s, c) => {
          changeStat(s, c, 'skill', 11);
          changeStat(s, c, 'energy', -7);
          return 'Влад потренировался в программировании';
        }},
      ] : [
        { label: '📖 Изучать реконструкцию волос', pose: 'work', apply: (s, c) => {
          changeStat(s, c, 'skill', 11);
          changeStat(s, c, 'energy', -7);
          return 'Алина изучила основы восстановления волос';
        }},
        { label: '🗓️ Подготовить записи клиентов', pose: 'work', apply: (s, c) => {
          changeStat(s, c, 'skill', 5);
          changeStat(s, c, 'energy', -4);
          return 'Алина потренировалась вести записи клиентов';
        }},
      ];
    case 'kitchen':
      return [
        { label: `🍳 Приготовить омлет (2 яйца, есть ${state.pantry.eggs})`, pose: 'idle', apply: (s, c) => {
          if (s.pantry.eggs < 2) return 'Недостаточно яиц — продукты нужно будет купить';
          s.pantry.eggs -= 2;
          changeStat(s, c, 'hunger', 32);
          changeStat(s, c, 'mood', 5);
          changeStat(s, c, 'energy', -4);
          return `${names[c]} приготовил(а) омлет из настоящих запасов`;
        }},
        { label: `🍞 Перекусить хлебом (есть ${state.pantry.bread})`, pose: 'idle', apply: (s, c) => {
          if (s.pantry.bread < 1) return 'Хлеб закончился — нельзя приготовить еду из воздуха';
          s.pantry.bread--;
          changeStat(s, c, 'hunger', 13);
          return `${names[c]} перекусил(а), хлеба осталось: ${s.pantry.bread}`;
        }},
      ];
    case 'tv':
      return [
        { label: '📺 Смотреть передачу', pose: 'idle', apply: (s, c) => {
          changeStat(s, c, 'mood', 13);
          changeStat(s, c, 'energy', -2);
          return `${names[c]} посмотрел(а) телевизор`;
        }},
      ];
    case 'table':
      return [
        { label: '☕ Посидеть за столом', pose: 'sit', apply: (s, c) => {
          changeStat(s, c, 'energy', 6);
          changeStat(s, c, 'mood', 3);
          return `${names[c]} спокойно посидел(а) за столом`;
        }},
      ];
  }
}

let world: World;
function openActions(id: ItemId): void {
  const available = getActions(id);
  actionsEl.hidden = false;
  actionsEl.innerHTML = '';
  const heading = document.createElement('div');
  heading.className = 'actions-heading';
  heading.textContent = objectNames[id];
  actionsEl.appendChild(heading);

  const close = document.createElement('button');
  close.type = 'button';
  close.className = 'close-actions';
  close.textContent = '×';
  close.setAttribute('aria-label', 'Закрыть действия');
  close.addEventListener('click', () => { actionsEl.hidden = true; });
  actionsEl.appendChild(close);

  for (const action of available) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'action-button';
    button.textContent = action.label;
    button.addEventListener('click', () => {
      const actor = active;
      actionsEl.hidden = true;
      statusEl.textContent = `${names[actor]} идёт: ${objectNames[id]}`;
      world.perform(actor, id, action.pose, () => {
        const outcome = action.apply(state, actor);
        statusEl.textContent = outcome;
        saveState(state);
        render();
        notify(outcome);
      });
    });
    actionsEl.appendChild(button);
  }
}

try {
  world = new World(canvas, openActions);
  document.querySelectorAll<HTMLButtonElement>('.person').forEach((button) => {
    button.addEventListener('click', () => {
      active = button.dataset.id === 'alina' ? 'alina' : 'vlad';
      world.setActive(active);
      actionsEl.hidden = true;
      statusEl.textContent = `Управление: ${names[active]} (локальный прототип)`;
      render();
    });
  });
  render();
  notify('Добро пожаловать домой! Выбери диван, кровать или компьютер ♥');
} catch (error) {
  console.error(error);
  statusEl.textContent = 'Не удалось запустить 3D. Проверь поддержку WebGL браузером.';
  notify('Ошибка запуска сцены. Подробности — в консоли браузера.');
}
