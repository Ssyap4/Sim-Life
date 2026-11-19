import './style.css';
import { World, objectNames } from './game/World';
import { LiveConnection } from './core/network';
import {
  ACTIONS, itemNames, names, SOCIAL_LABELS,
  type ActionId, type CharacterId, type GameState, type ItemId, type SocialKind,
} from './shared/protocol';

let state: GameState | null = null;
let active: CharacterId | null = null;
let online: CharacterId[] = [];
let selectedRole: CharacterId = 'vlad';
let socialOffer: { id: number; from: CharacterId; to: CharacterId; kind: SocialKind } | null = null;
let toastTimer: number | undefined;
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
      <div class="version">0.3 · УЮТНЫЕ ВСТРЕЧИ</div>
    </div>
    <div class="money-panel"><span>🏡 Семейный бюджет</span><strong id="money">— ₽</strong></div>
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
    <div class="status-line" id="status">Подключение к общему дому…</div>
  </header>
  <div id="message" class="message" aria-live="polite"></div>
  <footer class="bottom-ui">
    <div id="social-panel" class="social-panel" hidden aria-live="polite"></div>
    <div id="actions" class="actions" hidden></div>
    <button id="market-btn" class="market-btn" type="button" disabled>🛒 Пробная доставка продуктов</button>
    <div class="tip">
      <span class="tip-icon">✦</span>
      <span>Нажимай на мебель для действий, а на Влада или Алину — для совместных моментов. Камеру можно вращать пальцем.</span>
    </div>
    <div class="footer-row"><span>♥ Наш семейный дом</span><span id="online-note">Ожидание сервера</span></div>
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
      <button class="enter-button" type="submit">Войти в общий дом</button>
      <p class="auth-status" id="auth-status">Коды созданы на компьютере в D:\\Sim-Life\\server-data\\access.json</p>
      <small>Доступен по домашней Wi-Fi сети. Пока не публикуй адрес сервера в интернете.</small>
    </form>
  </section>
  <div class="rotate-notice">Для Sim-Life поверни телефон вертикально ↻</div>
`;

const canvas = document.querySelector<HTMLCanvasElement>('#game-canvas')!;
const actionsEl = document.querySelector<HTMLDivElement>('#actions')!;
const socialEl = document.querySelector<HTMLDivElement>('#social-panel')!;
const statusEl = document.querySelector<HTMLDivElement>('#status')!;
const messageEl = document.querySelector<HTMLDivElement>('#message')!;
const authEl = document.querySelector<HTMLElement>('#auth')!;
const authStatusEl = document.querySelector<HTMLElement>('#auth-status')!;
const accessInput = document.querySelector<HTMLInputElement>('#access-code')!;
const marketBtn = document.querySelector<HTMLButtonElement>('#market-btn')!;

function notify(message: string): void {
  messageEl.textContent = message;
  messageEl.classList.add('show');
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => messageEl.classList.remove('show'), 3600);
}

function render(): void {
  if (!state) return;
  document.querySelector<HTMLElement>('#money')!.textContent =
    new Intl.NumberFormat('ru-RU').format(state.money) + ' ₽';
  document.querySelector<HTMLElement>('#online-note')!.textContent =
    online.length + ' из 2 игроков онлайн';
  for (const id of ['vlad', 'alina'] as const) {
    const stats = state.characters[id];
    const hunger = document.querySelector<HTMLElement>('#' + id + '-hunger')!;
    const energy = document.querySelector<HTMLElement>('#' + id + '-energy')!;
    hunger.style.background = 'linear-gradient(to right,#d4a977 ' + stats.hunger + '%,#e8e1d5 ' + stats.hunger + '%)';
    energy.style.background = 'linear-gradient(to right,#8eaa98 ' + stats.energy + '%,#e8e1d5 ' + stats.energy + '%)';
    const button = document.querySelector<HTMLButtonElement>('[data-id="' + id + '"]')!;
    button.classList.toggle('active', id === active);
    button.setAttribute('aria-pressed', String(id === active));
    button.title = 'Голод ' + Math.round(stats.hunger) + '%, энергия ' + Math.round(stats.energy) + '%, навык ' + Math.round(stats.skill) + '%';
    const indicator = document.querySelector<HTMLElement>('#online-' + id)!;
    indicator.textContent = online.includes(id) ? '●' : '○';
    indicator.style.color = online.includes(id) ? '#65a876' : '#b9b9b9';
  }
}

function renderSocialOffer(): void {
  socialEl.replaceChildren();
  if (!socialOffer || !active) { socialEl.hidden = true; return; }
  socialEl.hidden = false;
  const incoming = socialOffer.to === active;
  const title = document.createElement('strong');
  title.textContent = incoming
    ? '💌 ' + names[socialOffer.from] + ' предлагает: ' + SOCIAL_LABELS[socialOffer.kind].toLowerCase()
    : '💌 Приглашение для ' + names[socialOffer.to] + ' отправлено';
  socialEl.appendChild(title);
  const buttons = document.createElement('div');
  buttons.className = 'social-buttons';
  function action(label: string, fn: () => void, positive = false): void {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = label;
    if (positive) button.className = 'social-accept';
    button.addEventListener('click', fn);
    buttons.appendChild(button);
  }
  const id = socialOffer.id;
  if (incoming) {
    action('❤️ Принять', () => net.replySocial(id, true), true);
    action('Не сейчас', () => net.replySocial(id, false));
  } else action('Отменить', () => net.cancelSocial(id));
  socialEl.appendChild(buttons);
}

function showStatus(text: string): void {
  statusEl.textContent = text;
  authStatusEl.textContent = text;
}
const net = new LiveConnection({
  onReady(role, household, players) {
    active = role;
    state = household;
    online = players;
    authEl.hidden = true;
    marketBtn.disabled = false;
    actionsEl.hidden = true;
    socialOffer = null;
    renderSocialOffer();
    for (const id of ['vlad', 'alina'] as const) {
      const snapshot = household.characters[id];
      world.restoreCharacter(id, snapshot.x, snapshot.z, snapshot.pose);
    }
    world.setActive(role);
    render();
    notify('Добро пожаловать, ' + names[role] + '! Это настоящий общий дом ♥');
  },
  onSnapshot(household) {
    if (!state || household.revision >= state.revision) {
      state = household;
      render();
    }
  },
  onOnline(players) {
    online = players;
    render();
  },
  onAction(role, actionId, message) {
    const def = ACTIONS[actionId];
    if (!def) return;
    const animated = def.item === 'delivery' || world.perform(role, def.item, def.pose, () => {});
    statusEl.textContent = message;
    notify(animated ? message : message + ' · путь к предмету пока не найден');
  },
  onSocialOffer(id, from, to, kind) {
    socialOffer = { id, from, to, kind };
    actionsEl.hidden = true;
    renderSocialOffer();
    if (to === active) notify('💌 ' + names[from] + ' приглашает: ' + SOCIAL_LABELS[kind]);
  },
  onSocialClear(id, message) {
    if (socialOffer?.id === id) {
      socialOffer = null;
      renderSocialOffer();
      notify(message);
    }
  },
  onSocialStart(kind, message) {
    socialOffer = null;
    renderSocialOffer();
    actionsEl.hidden = true;
    const animated = world.playSocial(kind);
    statusEl.textContent = message;
    notify(animated ? message : message + ' · анимация временно недоступна');
  },
  onError(reason) {
    if (!authEl.hidden || reason.includes('занят') || reason.includes('Неверный код')) {
      authEl.hidden = false;
      active = null;
      marketBtn.disabled = true;
      actionsEl.hidden = true;
      authStatusEl.textContent = reason;
    } else notify(reason);
  },
  onStatus(text) {
    if (!authEl.hidden) authStatusEl.textContent = text;
    statusEl.textContent = text;
  },
});

function openSocialActions(target: CharacterId): void {
  if (!active || !net.isReady()) { notify('Сначала войди в дом'); return; }
  if (target === active) return;
  actionsEl.replaceChildren();
  actionsEl.hidden = false;
  const heading = document.createElement('div');
  heading.className = 'actions-heading';
  heading.textContent = '❤️ Вместе с ' + names[target];
  actionsEl.appendChild(heading);
  const close = document.createElement('button');
  close.type = 'button';
  close.className = 'close-actions';
  close.textContent = '×';
  close.setAttribute('aria-label', 'Закрыть меню');
  close.addEventListener('click', () => { actionsEl.hidden = true; });
  actionsEl.appendChild(close);
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
        statusEl.textContent = 'Отправляем приглашение…';
      }
    });
    actionsEl.appendChild(button);
  }
}

function openActions(item: ItemId): void {
  if (!active || !net.isReady()) {
    notify('Сначала войди в дом');
    return;
  }
  actionsEl.innerHTML = '';
  actionsEl.hidden = false;
  const heading = document.createElement('div');
  heading.className = 'actions-heading';
  heading.textContent = (item === 'delivery' ? itemNames.delivery : objectNames[item]) +
    (item === 'kitchen' && state ? ' · 🥚 ' + state.pantry.eggs + ' · 🍞 ' + state.pantry.bread : '');
  actionsEl.appendChild(heading);
  const close = document.createElement('button');
  close.type = 'button';
  close.className = 'close-actions';
  close.textContent = '×';
  close.setAttribute('aria-label', 'Закрыть меню');
  close.addEventListener('click', () => { actionsEl.hidden = true; });
  actionsEl.appendChild(close);

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

try {
  world = new World(canvas, (id) => {
    if (id === 'vlad' || id === 'alina') openSocialActions(id);
    else openActions(id);
  });
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
  marketBtn.addEventListener('click', () => openActions('delivery'));
  const form = document.querySelector<HTMLFormElement>('#auth-form')!;
  document.querySelectorAll<HTMLButtonElement>('[data-role]').forEach((button) => {
    button.addEventListener('click', () => {
      selectedRole = button.dataset.role === 'alina' ? 'alina' : 'vlad';
      document.querySelectorAll('.role-option').forEach((item) =>
        item.classList.toggle('selected', item === button),
      );
    });
  });
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const code = accessInput.value.trim();
    if (code.length < 12) { authStatusEl.textContent = 'Введи полный код персонажа'; return; }
    net.login(selectedRole, code);
  });
  window.addEventListener('pagehide', () => net.stop());
  showStatus('Выбери персонажа и введи личный код');
} catch (error) {
  console.error(error);
  showStatus('Не удалось запустить 3D. Проверь WebGL и поддержку браузера.');
}
