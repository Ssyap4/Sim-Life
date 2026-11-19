import { PLACES, stationById } from './shared/locations';
import { createLocationUI } from './locationUI';
import { trustedDevice } from './core/trusted';
import './style.css';
import { World, objectNames } from './game/World';
import { LiveConnection } from './core/network';
import { showFoodChoices, type FoodCommand } from './foodMenu';
import { createMarketUI, showTakeoutChoices } from './marketUI';
import { makeJobBoard } from './jobsUI';
import { HOME_OBJECT_DETAILS, storageUsage, FRIDGE_CAPACITY, CUPBOARD_CAPACITY } from './shared/storageSpace';
import { renderPetChoices } from './petMenu';
import { PETS, type PetId } from './shared/pets';
import { clockLabel, NEED_INFO, VITAL_NEEDS } from './shared/life';
import {
  ACTIONS, itemNames, names, SOCIAL_LABELS,
  type ActionId, type CharacterId, type GameState, type ItemId,
} from './shared/protocol';

const shortPlaces = { home: 'Дом', street: 'Квартал', market: 'Магазин', cafe: 'Кафе', park: 'Парк' } as const;

let state: GameState | null = null;
let active: CharacterId | null = null;
let online: CharacterId[] = [];
let selectedRole: CharacterId = 'vlad';
let toastTimer: number | undefined;
interface TaskView {
  taskId: number;
  label: string;
  since: number;
  durationMs: number;
  automatic?: boolean;
}
const tasks = new Map<CharacterId, TaskView>();
let world: World;

const app = document.querySelector<HTMLDivElement>('#app');
if (!app) throw new Error('Missing app element');
app.innerHTML = `
  <canvas id="game-canvas" aria-label="Дом Sim-Life: интерактивная 3D-сцена"></canvas>
  <div class="vignette"></div>
  <header class="top-ui">
    <div class="brand-row">
      <div class="brand">
        <div class="brand-icon">⌂</div>
        <div><span class="brand-kicker">НАШ МАЛЕНЬКИЙ МИР</span><h1>Sim-Life <span class="heart">♥</span></h1></div>
      </div>
      <div class="version">0.4 · ЖИВОЙ РАЙОН</div>
    </div>
    <div class="money-panel" role="group" aria-label="Семейный бюджет"><span>Семейный бюджет</span><strong id="money">— ₽</strong></div>
    <div class="life-strip">
      <span id="life-clock">☀️ День 1 · 08:00</span>
      <button id="needs-toggle" type="button" aria-label="Потребности" aria-expanded="false" aria-controls="needs-panel"><span aria-hidden="true">💗</span><span class="hud-label"> Потребности</span></button>
      <button id="map-btn" type="button" disabled><span aria-hidden="true">🗺️</span><span class="hud-label"> Карта</span><span class="map-current"> Дом</span></button>
    </div>
    <div class="characters" id="characters">
      <button class="person" data-id="vlad" type="button" aria-pressed="false">
        <span class="avatar avatar-vlad">В</span>
        <span class="person-info"><strong>Влад <small id="online-vlad">○</small></strong><span>Разработка</span><span class="meters"><i class="hunger" id="vlad-hunger"></i><i class="energy" id="vlad-energy"></i></span></span>
      </button>
      <button class="person" data-id="alina" type="button" aria-pressed="false">
        <span class="avatar avatar-alina">А</span>
        <span class="person-info"><strong>Алина <small id="online-alina">○</small></strong><span>Реконструкция волос</span><span class="meters"><i class="hunger" id="alina-hunger"></i><i class="energy" id="alina-energy"></i></span></span>
      </button>
    </div>
    <div class="status-line" id="status" role="status">Подключение к общему дому…</div>
    <div class="showcase-ui">
      <button id="showcase-return" class="showcase-toggle" type="button" hidden>← Весь дом</button>
      <button id="showcase-toggle" class="showcase-toggle" type="button" aria-controls="showcase-choices" aria-expanded="false" aria-label="Посмотреть модели"><span aria-hidden="true">🔎</span><span class="hud-label" id="showcase-label"> Посмотреть модели</span></button>
      <div id="showcase-choices" class="showcase-choices" hidden>
        <button type="button" data-showcase="vlad">👨 Влад</button>
        <button type="button" data-showcase="alina">👩 Алина</button>
        <button type="button" data-showcase="verdell">🐕 Верделл</button>
        <button type="button" data-showcase="simba">🐈 Симба</button>
        <button type="button" data-showcase="home">🏡 Весь дом</button>
      </div>
    </div>
  </header>
  <section id="needs-panel" class="needs-panel" aria-label="Потребности семьи" hidden>
    <div class="needs-header"><strong>💗 Самочувствие семьи</strong><button id="needs-close" type="button" aria-label="Закрыть потребности">×</button></div>
    <div id="needs-content"></div>
  </section>
  <div id="map-panel" class="world-map" role="dialog" aria-label="Карта района" hidden></div>
  <div id="world-transition" aria-hidden="true"></div>
  <div id="message" class="message" aria-live="polite"></div>
  <section id="market-overlay" class="market-overlay" hidden aria-label="Магазин и семейная экономика"></section>
  <section id="jobs-overlay" class="jobs-overlay" hidden aria-label="Биржа подработок"></section>
  <footer class="bottom-ui">
    <div id="actions" class="actions" hidden></div>
    <div id="location-panel" class="actions location-panel" hidden></div>
    <div id="task-panel" class="task-panel" hidden aria-live="polite"></div>
    <div class="bottom-bar">
      <div id="stock-line" class="stock-line">🍳 Общие запасы и еда загружаются…</div>
      <div class="home-buttons">
        <button id="market-btn" class="market-btn" type="button" disabled>🛍️ Доставка</button>
        <button id="jobs-btn" class="market-btn jobs-btn" type="button" disabled>🧰 Подработки</button>
        <button id="pets-btn" class="market-btn pets-btn" type="button" disabled>🐾 Питомцы</button>
      </div>
      <div class="tip">
        <span class="tip-icon">✦</span>
        <span>Тап по предмету · Щипок для масштаба</span>
      </div>
      <div class="footer-row"><span>♥ Наш семейный дом</span><span id="online-note">Ожидание сервера</span></div>
    </div>
  </footer>
  <section id="auth" class="auth-screen" aria-labelledby="auth-title">
    <form id="auth-form" class="auth-card">
      <span class="auth-emblem">⌂</span>
      <div class="brand-kicker">НАША МАЛЕНЬКАЯ ИСТОРИЯ</div>
      <h2 id="auth-title">С возвращением домой ♥</h2>
      <p>У каждого свой персонаж, но один дом, семейный бюджет и общий прогресс.</p>
      <div class="role-choices">
        <button data-role="vlad" class="role-option selected" type="button">💻 <b>Влад</b><span>Разработчик</span></button>
        <button data-role="alina" class="role-option" type="button">🌸 <b>Алина</b><span>Мастер реконструкции</span></button>
      </div>
      <label for="access-code">Личный код персонажа</label>
      <input id="access-code" name="access-code" type="password" minlength="12" maxlength="48" placeholder="Код из server-data/access.json" autocomplete="off" required />
      <label class="remember-device"><input type="checkbox" id="remember-device"> Запомнить вход на этом устройстве</label>
      <button class="enter-button" type="submit" disabled>Войти в общий дом</button>
      <p class="auth-status" id="auth-status">Коды созданы на компьютере в D:\\Sim-Life\\server-data\\access.json</p>
      <small>Доступен по домашней Wi-Fi сети. Пока не публикуй адрес сервера в интернете.</small>
    </form>
  </section>
  <div class="rotate-notice">Для Sim-Life поверни телефон вертикально ↻</div>
`;

const canvas = document.querySelector<HTMLCanvasElement>('#game-canvas')!;
const actionsEl = document.querySelector<HTMLDivElement>('#actions')!;
const taskPanelEl = document.querySelector<HTMLDivElement>('#task-panel')!;
const statusEl = document.querySelector<HTMLDivElement>('#status')!;
const messageEl = document.querySelector<HTMLDivElement>('#message')!;
const authEl = document.querySelector<HTMLElement>('#auth')!;
const authStatusEl = document.querySelector<HTMLElement>('#auth-status')!;
const accessInput = document.querySelector<HTMLInputElement>('#access-code')!;
const marketBtn = document.querySelector<HTMLButtonElement>('#market-btn')!;
const mapBtn = document.querySelector<HTMLButtonElement>('#map-btn')!;
const mapCurrent = document.querySelector<HTMLElement>('.map-current')!;
const mapPanel = document.querySelector<HTMLElement>('#map-panel')!;
const locationPanel = document.querySelector<HTMLElement>('#location-panel')!;
const transition = document.querySelector<HTMLElement>('#world-transition')!;
const rememberDevice = document.querySelector<HTMLInputElement>('#remember-device')!;
const petsBtn = document.querySelector<HTMLButtonElement>('#pets-btn')!;
const jobsBtn = document.querySelector<HTMLButtonElement>('#jobs-btn')!;
const jobsOverlay=document.querySelector<HTMLElement>('#jobs-overlay')!;
const clockEl = document.querySelector<HTMLElement>('#life-clock')!;
const needsPanelEl = document.querySelector<HTMLElement>('#needs-panel')!;
const needsContentEl = document.querySelector<HTMLElement>('#needs-content')!;
const needsToggleEl = document.querySelector<HTMLButtonElement>('#needs-toggle')!;
const marketOverlay = document.querySelector<HTMLElement>('#market-overlay')!;
function toggleNeeds(open: boolean): void {
  needsPanelEl.hidden = !open;
  needsToggleEl.setAttribute('aria-expanded', String(open));
  if (open) renderNeeds();
}
needsToggleEl.addEventListener('click', () => toggleNeeds(Boolean(needsPanelEl.hidden)));
document.querySelector<HTMLButtonElement>('#needs-close')!.addEventListener('click', () => toggleNeeds(false));
const showcaseToggle = document.querySelector<HTMLButtonElement>('#showcase-toggle')!;
const showcaseChoices = document.querySelector<HTMLDivElement>('#showcase-choices')!;
const showcaseReturn = document.querySelector<HTMLButtonElement>('#showcase-return')!;
const topHud = document.querySelector<HTMLElement>('.top-ui')!;
const bottomHud = document.querySelector<HTMLElement>('.bottom-ui')!;
const bottomBar = document.querySelector<HTMLElement>('.bottom-bar')!;

function focusModel(id: CharacterId | PetId | null): void {
  document.querySelector('#app')?.classList.toggle('inspecting', Boolean(id));
  showcaseReturn.hidden = id === null;
  showcaseChoices.hidden = true;
  showcaseToggle.setAttribute('aria-expanded', 'false');
  showcaseChoices.querySelectorAll<HTMLButtonElement>('button').forEach((item) => {
    item.classList.toggle('selected', item.dataset.showcase === (id ?? 'home'));
  });
  const label = document.querySelector<HTMLElement>('#showcase-label')!;
  label.textContent = id === null ? ' Посмотреть модели'
    : ' ' + (id === 'vlad' || id === 'alina' ? names[id] : PETS[id].name);
  world.showcase(id);
}

showcaseToggle.addEventListener('click', () => {
  showcaseChoices.hidden = !showcaseChoices.hidden;
  showcaseToggle.setAttribute('aria-expanded', String(!showcaseChoices.hidden));
});
showcaseReturn.addEventListener('click', () => focusModel(null));
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && !showcaseReturn.hidden) focusModel(null);
  if (event.key === 'Escape') {
    actionsEl.hidden = true;
    toggleNeeds(false);
    marketUI.close();
    jobsUI.close();
    locationUI.closeMap();
    if (world) locationUI.close();
  }
});
showcaseChoices.addEventListener('click', (event) => {
  const id = (event.target as HTMLElement).closest<HTMLButtonElement>('[data-showcase]')?.dataset.showcase;
  if (id === 'home') focusModel(null);
  else if (id === 'vlad' || id === 'alina' || id === 'verdell' || id === 'simba') focusModel(id);
});

function notify(message: string): void {
  messageEl.textContent = message;
  messageEl.classList.add('show');
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => messageEl.classList.remove('show'), 3600);
}

function drawTaskPanel(): void {
  taskPanelEl.replaceChildren();
  taskPanelEl.hidden = tasks.size === 0;
  for (const [role, task] of tasks) {
    const box = document.createElement('div');
    box.className = 'running-task';
    box.dataset.role = role;
    const top = document.createElement('div');
    top.className = 'running-task-top';
    const title = document.createElement('strong');
    title.textContent = names[role] + ': ' + (task.automatic ? 'Самостоятельно · ' : '') + task.label;
    const secs = document.createElement('span');
    secs.className = 'task-seconds';
    top.append(title, secs);
    const track = document.createElement('div');
    track.className = 'running-task-track';
    const fill = document.createElement('i');
    track.appendChild(fill);
    box.append(top, track);
    if (role === active) {
      const cancel = document.createElement('button');
      cancel.type = 'button';
      cancel.className = 'task-cancel';
      cancel.textContent = '✕ Прервать';
      cancel.addEventListener('click', () => {
        if (net.cancelTask(task.taskId)) cancel.disabled = true;
      });
      box.append(cancel);
    }
    taskPanelEl.append(box);
  }
  updateTaskProgress();
}

function updateTaskProgress(): void {
  for (const [role, task] of tasks) {
    const card = taskPanelEl.querySelector<HTMLElement>('[data-role="' + role + '"]');
    if (!card) continue;
    const elapsed = Math.min(performance.now() - task.since, task.durationMs);
    card.querySelector<HTMLElement>('.running-task-track i')!.style.width =
      Math.min(100, elapsed / task.durationMs * 100) + '%';
    card.querySelector<HTMLElement>('.task-seconds')!.textContent =
      Math.max(0, Math.ceil((task.durationMs - elapsed) / 1000)) + ' с';
  }
}
window.setInterval(() => { if (tasks.size) updateTaskProgress(); }, 150);

function renderNeeds(): void {
  if (!state || needsPanelEl.hidden) return;
  needsContentEl.replaceChildren();
  for (const role of ['vlad', 'alina'] as const) {
    const char = state.characters[role];
    const group = document.createElement('div');
    group.className = 'needs-group';
    const heading = document.createElement('strong');
    heading.textContent = names[role] + ' · настроение ' + Math.round(char.mood) + '%';
    group.append(heading);
    for (const need of VITAL_NEEDS) {
      const info = NEED_INFO[need];
      const value = Math.round(char[need]);
      const row = document.createElement('div');
      row.className = 'need-row';
      row.title = info.hint;
      const label = document.createElement('span');
      label.textContent = info.emoji + ' ' + info.label;
      const track = document.createElement('div');
      track.className = 'need-track';
      const fill = document.createElement('i');
      fill.style.width = value + '%';
      if (value < 30) fill.classList.add('need-low');
      else if (value < 55) fill.classList.add('need-mid');
      track.append(fill);
      const percent = document.createElement('span');
      percent.className = 'need-value';
      percent.textContent = value + '%';
      row.append(label, track, percent);
      group.append(row);
    }
    const urgent = VITAL_NEEDS.find(need => char[need] < 35);
    if (urgent) {
      const hint = document.createElement('small');
      hint.className = 'need-hint';
      hint.textContent = '✦ ' + NEED_INFO[urgent].hint;
      group.append(hint);
    }
    needsContentEl.append(group);
  }
}

function render(reset = false): void {
  if (!state) return;
  if (active && world) {
    const place = state.world.places[active];
    if (world.place !== place) {
      actionsEl.hidden = true;
      marketUI.close();
      jobsUI.close();
      focusModel(null);
      if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        transition.animate([{ opacity: 0.88 }, { opacity: 0 }], { duration: 225 });
      }
      statusEl.textContent = PLACES[place].name;
    }
    world.syncHousehold(state, active, reset, online);
    locationUI.refresh(state, active);
    mapCurrent.textContent = ' ' + shortPlaces[place];
    mapBtn.setAttribute('aria-label', 'Карта района. Сейчас: ' + PLACES[place].name);
    petsBtn.disabled = place !== 'home';
    document.querySelector<HTMLElement>('#app')!.dataset.place = place;
    if (deliverySequence !== null && state.world.sequence[active] > deliverySequence) {
      deliverySequence = null;
      marketUI.acknowledge();
    }
  }
  clockEl.textContent = (state.clock.minute < 360 || state.clock.minute >= 1320 ? '🌙 ' :
    state.clock.minute >= 1080 ? '🌇 ' : '☀️ ') + clockLabel(state.clock);
  world?.setTimeOfDay(state.clock.minute);
  renderNeeds();
  document.querySelector<HTMLElement>('#money')!.textContent =
    new Intl.NumberFormat('ru-RU').format(state.money) + ' ₽';
  document.querySelector<HTMLElement>('#online-note')!.textContent =
    online.length + ' из 2 игроков онлайн';
  const used=storageUsage(state);
  document.querySelector<HTMLElement>('#stock-line')!.textContent =
    '🧊 Холодильник: '+used.fridge+'/'+FRIDGE_CAPACITY+
    ' · 🗄️ Полки: '+used.cupboard+'/'+CUPBOARD_CAPACITY+
    ' · 🍽️ '+(Object.values(state.meals).reduce((a,b)=>a+b,0)+
      Object.values(state.takeout).reduce((a,b)=>a+b,0))+' порц.';
  for (const id of ['vlad', 'alina'] as const) {
    const stats = state.characters[id];
    const hunger = document.querySelector<HTMLElement>('#' + id + '-hunger')!;
    const energy = document.querySelector<HTMLElement>('#' + id + '-energy')!;
    hunger.style.background = 'linear-gradient(to right,#d4a977 ' + stats.hunger + '%,#e8e1d5 ' + stats.hunger + '%)';
    energy.style.background = 'linear-gradient(to right,#8eaa98 ' + stats.energy + '%,#e8e1d5 ' + stats.energy + '%)';
    const button = document.querySelector<HTMLButtonElement>('[data-id="' + id + '"]')!;
    button.classList.toggle('active', id === active);
    button.setAttribute('aria-pressed', String(id === active));
    button.title = (state.activeShifts[id]?'На подработке · ':'')+'Голод ' + Math.round(stats.hunger) + '%, энергия ' + Math.round(stats.energy) + '%, навык ' + Math.round(stats.skill) + '%';
    const indicator = document.querySelector<HTMLElement>('#online-' + id)!;
    indicator.textContent = online.includes(id) ? '●' : '○';
    indicator.style.color = online.includes(id) ? '#65a876' : '#b9b9b9';
  }
}

function showStatus(text: string): void {
  statusEl.textContent = text;
  authStatusEl.textContent = text;
}
let deliverySequence: number | null = null;
const marketUI = createMarketUI(marketOverlay, (lines) => {
  if (!state || !active || deliverySequence !== null) return false;
  const sequence = state.world.sequence[active];
  if (!net.world({ type: 'delivery_order', lines, sequence })) return false;
  deliverySequence = sequence;
  return true;
});
const locationUI = createLocationUI(locationPanel, mapPanel, () => world, command => net.world(command),
  recipe => { net.food('cook', recipe); }, signOut);

function signOut(): void {
  net.forgetDevice();
  deliverySequence = null;
  active = null;
  state = null;
  tasks.clear();
  drawTaskPanel();
  accessInput.value = '';
  rememberDevice.checked = false;
  authEl.hidden = false;
  marketBtn.disabled = jobsBtn.disabled = petsBtn.disabled = mapBtn.disabled = true;
  actionsEl.hidden = true;
  marketUI.close();
  jobsUI.close();
  locationUI.reset();
  showStatus('Выбери персонажа и введи личный код');
}
const jobsUI=makeJobBoard(jobsOverlay,id=>net.startJob(id),()=>net.leaveJobEarly());
const net = new LiveConnection({
  onReady(role, household, players) {
    active = role;
    state = household;
    online = players;
    tasks.clear();
    drawTaskPanel();
    toggleNeeds(false);
    marketUI.close();
    jobsUI.close();
    authEl.hidden = true;
    mapBtn.disabled = false;
    marketBtn.disabled = false;
    jobsBtn.disabled = false;
    petsBtn.disabled = false;
    actionsEl.hidden = true;
    world.setActive(role);
    render(true);
    notify('Добро пожаловать, ' + names[role] + '! Это настоящий общий дом ♥');
  },
  onSnapshot(household) {
    if (!state || household.revision >= state.revision) {
      state = household;
      render();
      marketUI.refresh(household);
      jobsUI.refresh(household);
    }
  },
  onOnline(players) {
    online = players;
    render();
  },
  onWorldPath(role, place, path, station) {
    if (!active || world.place !== place) return;
    const target = stationById(place, station);
    world.runLocationPath(role, path, station, () => {
      if (role === active && target && world.place === place) locationUI.visit(target);
    });
  },
  onWorldEvent(role, message) {
    if (role === active) notify(message);
  },
  onDeliveryArrived() {
    notify('Доставка у двери дома');
  },
  onAction(_role, _actionId, message) {
    statusEl.textContent = message;
    notify(message);
  },
  onFoodEvent(_role, _action, message) {
    statusEl.textContent = message;
    notify(message);
  },
  onStoreEvent(role,message) {
    if(role===active) marketUI.acknowledge();
    statusEl.textContent=message;
    notify(message);
  },
  onJobEvent(_role,_outcome,message) {
    statusEl.textContent=message;
    notify(message);
  },
  onPetEvent(_role, _pet, _action, message) {
    statusEl.textContent = message;
    notify(message);
  },
  onHomeLeisure(roles, activity, routes) {
    world.setHomeLeisure(roles, activity, routes);
  },
  onStorageEvent(role, station) {
    if (world.place !== 'home') return;
    if (station) world.openStorage(station, role);
    else world.closeStorage(role);
  },
  onTaskStarted(role, taskId, label, durationMs, command, automatic) {
    tasks.set(role, { taskId, label, durationMs, automatic, since: performance.now() });
    drawTaskPanel();
    const animated = world.startTimedAction(role, command);
    statusEl.textContent = names[role] + ': ' + label;
    if (!animated) notify('Действие началось на сервере, путь анимации пока недоступен');
  },
  onTaskEnded(role, taskId, outcome, message) {
    const previous = tasks.get(role);
    if (previous?.taskId === taskId) {
      if (outcome === 'completed') world.finishTimedAction(role);
      tasks.delete(role);
      drawTaskPanel();
    }
    if (outcome !== 'completed') {
      world.cancelTimedAction(role);
      if (previous?.automatic) return;
      statusEl.textContent = message;
      notify(message);
    }
  },
  onSocialStart(kind, message) {
    actionsEl.hidden = true;
    const animated = world.playSocial(kind);
    statusEl.textContent = message;
    notify(animated ? message : message + ' · анимация временно недоступна');
  },
  onError(reason) {
    deliverySequence = null;
    locationUI.reject();
    if (!authEl.hidden || reason.includes('Неверный код') || reason.includes('уже занят на другом устройстве')) {
      authEl.hidden = false;
      active = null;
      mapBtn.disabled = true;
      marketBtn.disabled = true;
      jobsBtn.disabled = true;
      petsBtn.disabled = true;
      actionsEl.hidden = true;
      authStatusEl.textContent = reason;
    } else {
      notify(reason);
      if (state) {marketUI.refresh(state); jobsUI.refresh(state);} // failed action: re-enable controls
    }
  },
  onStatus(text) {
    if (text.includes('Связь потеряна')) {
      for (const role of tasks.keys()) world.cancelTimedAction(role);
      tasks.clear();
      drawTaskPanel();
      deliverySequence = null;
      locationUI.reject();
      locationUI.close();
      locationUI.closeMap();
    }
    if (!authEl.hidden) authStatusEl.textContent = text;
    statusEl.textContent = text;
  },
});

function showActionMenu(title: string): void {
  locationUI.closeMap();
  const header = document.createElement('div');
  header.className = 'actions-head';
  const heading = document.createElement('strong');
  heading.textContent = title;
  const close = document.createElement('button');
  close.type = 'button';
  close.className = 'close-actions';
  close.textContent = '×';
  close.setAttribute('aria-label', 'Закрыть меню');
  close.addEventListener('click', () => { actionsEl.hidden = true; });
  header.append(heading, close);
  actionsEl.replaceChildren(header);
  actionsEl.hidden = false;
  actionsEl.scrollTop = 0;
}

function openSocialActions(target: CharacterId): void {
  if (!active || !net.isReady()) { notify('Сначала войди в дом'); return; }
  if (target === active) return;
  locationUI.close();
  if (state && state.world.places[active] !== state.world.places[target]) {
    notify(names[target] + ' · ' + PLACES[state.world.places[target]].name);
    return;
  }
  showActionMenu('❤️ Вместе с ' + names[target]);
  if (!online.includes(target)) {
    const note = document.createElement('p');
    note.className = 'social-hint';
    note.textContent = names[target] + ' пока не в сети. Можно предложить действие, когда вы оба в доме.';
    actionsEl.appendChild(note);
    return;
  }
  for (const kind of ['hug', 'highFive'] as const) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'action-button';
    button.textContent = (kind === 'hug' ? '🤗 ' : '🙌 ') + SOCIAL_LABELS[kind];
    button.addEventListener('click', () => {
      if (net.offerSocial(kind)) {
        actionsEl.hidden = true;
        statusEl.textContent = 'Совместное действие…';
      }
    });
    actionsEl.appendChild(button);
  }
}

function openPetActions(pet: PetId | null = null): void {
  locationUI.close();
  if (active && world.place === 'park' && pet === 'verdell') {
    net.world({ type: 'approach', place: 'park', station: 'park-dog' });
    return;
  }
  if (!active || !net.isReady() || !state) {
    notify('Сначала войди в общий дом');
    return;
  }
  showActionMenu(pet ? PETS[pet].emoji + ' ' + PETS[pet].name : '🐾 Наши питомцы');
  renderPetChoices(actionsEl, state, pet,
    (id) => openPetActions(id),
    (id, action) => {
      const sent = net.petAction(id, action);
      if (sent) {
        actionsEl.hidden = true;
        statusEl.textContent = 'Ухаживаем за питомцем…';
      }
      return sent;
    });
}

function openActions(item: ItemId): void {
  locationUI.close();
  if (!active || !net.isReady()) {
    notify('Сначала войди в дом');
    return;
  }
  if(item==='delivery' && state) {
    actionsEl.hidden=true;
    marketUI.open(state);
    return;
  }
  showActionMenu((item === 'delivery' ? itemNames.delivery : objectNames[item]) +
    (item === 'kitchen' && state ? ' · 🥚 ' + state.pantry.eggs + ' · 🍞 ' + state.pantry.bread : ''));
  const about=document.createElement('p');
  about.className='food-empty';
  about.textContent=HOME_OBJECT_DETAILS[item];
  actionsEl.appendChild(about);

  if (state && (item === 'delivery' || item === 'kitchen' || item === 'table')) {
    showFoodChoices(actionsEl, item, state, (type: FoodCommand, id) => {
      const sent = net.food(type, id);
      if (sent) {
        actionsEl.hidden = true;
        statusEl.textContent = 'Обрабатываем действие…';
      }
      return sent;
    });
  }

  if (item === 'table' && state) {
    showTakeoutChoices(actionsEl,state,(id)=>{
      const sent=net.eatTakeout(id);
      if(sent) actionsEl.hidden=true;
      return sent;
    });
  }
  for (const [actionId, definition] of Object.entries(ACTIONS)) {
    if (definition.item !== item) continue;
    if ('role' in definition && definition.role !== active) continue;
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'action-button';
    button.textContent = definition.label;
    button.addEventListener('click', () => {
      actionsEl.hidden = true;
      if (net.perform(actionId as ActionId)) statusEl.textContent = 'Отправляем действие на сервер…';
    });
    actionsEl.appendChild(button);
  }
}

async function initializeWorld(app: HTMLDivElement): Promise<void> {
  try {
    const params = new URLSearchParams(window.location.search);
    const diagnostics = params.get('perf') === '1'
      ? await import('./game/PerformanceProbe').then(({ createPerformanceProbe }) => createPerformanceProbe(app))
      : null;
    const modelsStartedMs = performance.now();
    const useBlender = params.get('characters') !== 'procedural';
    const characters = useBlender ? await import('./game/BlenderCharacter')
      .then(({ loadResidents }) => loadResidents())
      .catch((err: unknown) => {
        console.warn('Не удалось загрузить Blender-модели. Используем встроенные.', err);
        return {};
      }) : {};
    const modelsReadyMs = performance.now();
    world = new World(canvas, (id) => {
      if (id === 'vlad' || id === 'alina') openSocialActions(id);
      else if (id === 'verdell' || id === 'simba') openPetActions(id);
      else openActions(id);
    }, (inspection) => {
      const viewport = canvas.getBoundingClientRect();
      const top = topHud.getBoundingClientRect();
      const bottom = (inspection ? bottomHud : bottomBar).getBoundingClientRect();
      const center = viewport.left + viewport.width / 2;
      return {
        top: top.right > center ? (top.bottom - viewport.top) / viewport.height : .08,
        bottom: bottom.left < center ? (bottom.top - viewport.top) / viewport.height : .92,
      };
    }, characters, diagnostics?.onFrame, {
      station(id) {
        if (!active) return;
        actionsEl.hidden = true;
        locationUI.close(); locationUI.closeMap();
        net.world({ type: 'approach', place: world.place, station: id });
      },
      ground(x, z) {
        if (!active) return;
        if (net.world({ type: 'walk', place: world.place, x, z })) {
          actionsEl.hidden = true;
          locationUI.close();
          locationUI.closeMap();
        }
      },
    });
    diagnostics?.ready(performance.now(), modelsReadyMs - modelsStartedMs,
      useBlender ? `${Object.keys(characters).length}/2 GLB` : 'процедурные');
    const layoutObserver = new ResizeObserver(() => {
      app.style.setProperty('--hud-top', topHud.getBoundingClientRect().bottom + 'px');
      world.refreshViewport();
    });
    for (const area of [canvas, topHud, bottomHud, bottomBar]) layoutObserver.observe(area);
    document.querySelectorAll<HTMLButtonElement>('.person').forEach((button) => {
      button.addEventListener('click', () => {
        if (active && button.dataset.id !== active) {
          openSocialActions(button.dataset.id === 'alina' ? 'alina' : 'vlad');
        } else if (active && state) {
          const s = state.characters[active];
          notify('Навык: ' + Math.round(s.skill) + '% · настроение: ' + Math.round(s.mood) + '%');
        }
      });
    });
    mapBtn.addEventListener('click', () => { actionsEl.hidden = true; marketUI.close(); jobsUI.close(); locationUI.openMap(); });
    marketBtn.addEventListener('click', () => { if(state) {actionsEl.hidden=true;locationUI.close();locationUI.closeMap();jobsUI.close();marketUI.open(state);} });
    jobsBtn.addEventListener('click',()=>{if(state && active){actionsEl.hidden=true;locationUI.close();locationUI.closeMap();marketUI.close();jobsUI.open(state,active);}});
    petsBtn.addEventListener('click', () => openPetActions());
    document.querySelectorAll<HTMLButtonElement>('[data-role]').forEach((button) => {
      button.addEventListener('click', () => {
        selectedRole = button.dataset.role === 'alina' ? 'alina' : 'vlad';
        document.querySelectorAll('.role-option').forEach((item) =>
          item.classList.toggle('selected', item === button),
        );
      });
    });
    window.addEventListener('pagehide', () => net.stop());
    document.querySelector<HTMLButtonElement>('.enter-button')!.disabled = false;
    showStatus('Выбери персонажа и введи личный код');
    const remembered = trustedDevice();
    if (remembered) net.resume(remembered.role, remembered.token);
  } catch (error) {
    console.error(error);
    showStatus('Не удалось запустить 3D. Проверь WebGL и поддержку браузера.');
  }
}

document.querySelector<HTMLFormElement>('#auth-form')!.addEventListener('submit', (event) => {
  event.preventDefault();
  if (!world) return;
  const code = accessInput.value.trim();
  if (code.length < 12) { authStatusEl.textContent = 'Введи полный код персонажа'; return; }
  net.login(selectedRole, code, rememberDevice.checked);
});
void initializeWorld(app);
