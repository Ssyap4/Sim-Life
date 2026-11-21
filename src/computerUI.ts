import { createCareerUI } from './careerUI';
import { createEducationUI, type EducationView } from './educationUI';
import { MATERIAL_BY_ID } from './shared/educationCatalog';
import { serviceAvailable } from './shared/services';
import { gameMinutes } from './shared/life';
import type { CareerCommand } from './shared/careers';
import type { EducationCommand } from './shared/education';
import type { ComputerDevice } from './shared/computer';
import type { ActionId, CharacterId, GameState } from './shared/protocol';
import type { TimeStatus } from './shared/timeControl';

type ComputerApp = 'career' | 'study' | 'browser' | 'games' | 'mail' | 'notes';
type View = { state: GameState; role: CharacterId; time: TimeStatus };
type Callbacks = {
  read(): View | null;
  act(action: ActionId, device: ComputerDevice): boolean;
  career(command: CareerCommand): boolean;
  education(command: EducationCommand): boolean;
  vote(enabled: boolean): boolean;
  travel(): boolean;
  phone(app: 'internet' | 'finance' | 'delivery'): void;
};
const apps: ReadonlyArray<[ComputerApp, string, string, string]> = [
  ['career','💼','Работа','Смены, задачи и зарплата'],
  ['study','🎓','Обучение','Курсы и навыки'],
  ['browser','🌐','Интернет','Сервисы и покупки'],
  ['games','🎮','Игры','Компьютерный досуг'],
  ['mail','✉️','Почта','Рабочие сообщения'],
  ['notes','📝','Заметки','Практика и записи'],
];
const deviceName = (device: ComputerDevice) => device === 'laptop' ? 'Ноутбук Алины' : 'ПК Влада';
const button = (title: string, action: () => void, description?: string) => {
  const control = document.createElement('button');
  control.type = 'button';
  control.className = 'computer-action';
  const label = document.createElement('strong');
  label.textContent = title;
  control.append(label);
  if (description) {
    const hint = document.createElement('small');
    hint.textContent = description;
    control.append(hint);
  }
  control.addEventListener('click', action);
  return control;
};

/** One computer shell and one set of apps. Content is chosen by authenticated character. */
export function createComputerUI(root: HTMLElement, callbacks: Callbacks) {
  root.innerHTML = `<section class="computer-case" role="dialog" aria-modal="true" aria-label="Sim-Life OS">
    <header class="computer-topbar">
      <div class="computer-brand"><span class="computer-logo">✦</span><span><strong>Sim-Life OS</strong><small data-computer-device></small></span></div>
      <div class="computer-title"><strong data-computer-user></strong><small>Личный рабочий стол</small></div>
      <button type="button" data-computer-close aria-label="Закрыть компьютер">×</button>
    </header>
    <main class="computer-desktop">
      <nav class="computer-apps" aria-label="Приложения"></nav>
      <section class="computer-window" hidden>
        <header class="computer-window-head">
          <button type="button" data-computer-back>← Рабочий стол</button>
          <strong data-computer-app-title></strong>
        </header>
        <div class="computer-window-body"></div>
      </section>
    </main>
    <footer class="computer-taskbar"><span>✦ Sim-Life OS</span><span data-computer-session></span></footer>
  </section>`;
  const desktop = root.querySelector<HTMLElement>('.computer-apps')!;
  const windowEl = root.querySelector<HTMLElement>('.computer-window')!;
  const content = root.querySelector<HTMLElement>('.computer-window-body')!;
  const appTitle = root.querySelector<HTMLElement>('[data-computer-app-title]')!;
  const deviceLabel = root.querySelector<HTMLElement>('[data-computer-device]')!;
  const userLabel = root.querySelector<HTMLElement>('[data-computer-user]')!;
  const session = root.querySelector<HTMLElement>('[data-computer-session]')!;
  const closeButton = root.querySelector<HTMLButtonElement>('[data-computer-close]')!;
  let device: ComputerDevice = 'desktop';
  let app: ComputerApp | null = null;

  const close = () => { root.hidden = true; app = null; content.replaceChildren(); };
  const act = (action: ActionId) => {
    if (callbacks.act(action, device)) close();
  };
  const career = createCareerUI(content, command =>
    callbacks.career(command.type === 'career_approach'
      ? { ...command, device } : command),
    id => openEducation('academy', id), close, callbacks.vote, () => device);
  const education = createEducationUI(content, command => {
    if (command.type === 'study' && MATERIAL_BY_ID.get(command.material)?.channel === 'academy')
      return callbacks.education({ ...command, computer: device });
    return callbacks.education(command);
  }, close, callbacks.travel);

  function openEducation(page: EducationView = 'academy', materialId?: string) {
    show('study');
    education.open(page, undefined, materialId);
    refresh();
  }
  function panel(title: string, description: string) {
    const heading = document.createElement('h3');
    heading.textContent = title;
    const hint = document.createElement('p');
    hint.className = 'computer-hint';
    hint.textContent = description;
    content.append(heading, hint);
  }
  function show(next: ComputerApp | null) {
    app = next;
    windowEl.hidden = next === null;
    desktop.hidden = next !== null;
    content.replaceChildren();
    if (next) {
      appTitle.textContent = apps.find(row => row[0] === next)![2];
      content.scrollTop = 0;
      if (next === 'career' || next === 'mail') career.open();
      if (next === 'study') education.open('academy');
    }
    refresh();
  }
  function refresh() {
    if (root.hidden) return;
    const view = callbacks.read();
    if (!view) { close(); return; }
    const { state, role, time } = view;
    userLabel.textContent = role === 'vlad' ? 'Влад' : 'Алина';
    deviceLabel.textContent = deviceName(device);
    session.textContent = role === 'vlad' ? '● Профиль Влада' : '● Профиль Алины';
    root.dataset.owner = role;
    root.dataset.device = device;
    if (app === 'career' || app === 'mail') {
      career.render(state, role, time);
      if (app === 'mail' && content.querySelector('[data-career-tab="inbox"]')?.getAttribute('aria-current') !== 'page')
        (content.querySelector<HTMLButtonElement>('[data-career-tab="inbox"]'))?.click();
      return;
    }
    if (app === 'study') { education.render(state, role); return; }
    if (!app) return;
    // These smaller apps are cheap to render and do not create a second 3D view.
    content.replaceChildren();
    if (app === 'browser') {
      const internet = serviceAvailable(state.billing, 'internet', gameMinutes(state.clock));
      panel('🌐 Интернет и сервисы', internet
        ? 'Домашний интернет подключён. Сервисы доступны обоим персонажам.'
        : 'Домашний интернет отключён. Онлайн-занятия и удалённая работа требуют подключения.');
      content.append(
        button('🌐 Управление интернетом', () => callbacks.phone('internet'), 'Оплата и состояние подключения'),
        button('🛍️ Онлайн-покупки', () => callbacks.phone('delivery'), 'Заказ из семейного каталога'),
        button('💳 Финансы семьи', () => callbacks.phone('finance'), 'Бюджет и платежи'),
      );
    }
    if (app === 'games') {
      panel('🎮 Компьютерные игры', 'Провести время за игрой и восстановить досуг.');
      content.append(button('▶ Начать играть', () => act('deskGames'),
        'Персонаж займёт выбранный компьютер'));
    }
    if (app === 'notes') {
      panel('📝 Личные занятия', role === 'vlad'
        ? 'Разработка, тренировочные проекты и заметки.'
        : 'Реконструкция волос, работа с клиентами и заметки.');
      content.append(
        button('📝 Записать мысли', () => act('deskJournal')),
        role === 'vlad'
          ? button('💻 Практика разработки', () => act('vladOrder'), 'Учебное задание без оплаты')
          : button('📋 Общение с клиентами', () => act('alinaConsult'), 'Тренировка без реального заказа'),
        button(role === 'vlad' ? '📚 Учиться разработке' : '📖 Изучать восстановление волос',
          () => act(role === 'vlad' ? 'vladStudy' : 'alinaStudy')),
      );
    }
  }
  for (const [id, emoji, name, description] of apps) {
    const tile = button(emoji + ' ' + name, () => show(id), description);
    tile.classList.add('computer-icon');
    tile.dataset.computerApp = id;
    desktop.append(tile);
  }
  closeButton.addEventListener('click', close);
  root.querySelector('[data-computer-back]')!.addEventListener('click', () => show(null));
  root.addEventListener('click', event => { if (event.target === root) close(); });
  return {
    open(nextDevice: ComputerDevice) { device = nextDevice; root.hidden = false; show(null); closeButton.focus(); },
    close,
    refresh,
    get visible() { return !root.hidden; },
  };
}
