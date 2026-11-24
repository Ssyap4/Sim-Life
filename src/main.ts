import {isNotebookDesk} from './shared/furniture';
import { defaultWardrobe } from './shared/previewWardrobe';
import { activeReward, rewardTime } from './shared/happiness';
import { CAT_BLOCKED, CAT_DESCENDING, catOccupiedPerch } from './shared/catOccupancy';
import { fitWardrobe, outfitChoices } from './game/Wardrobe';
import { createSocialOffer, showSocialMenu } from './socialUI';
import { familyMoments } from './shared/familyMoments';
import { AUTONOMY_LABELS, AUTONOMY_MODES, thoughtFor, type AutonomyMode } from './shared/autonomy';
import { PARK_TALK_TOPICS, SOCIAL_BY_ID, contextAvailable, otherPerson, type SocialGroup, type SocialIntent } from './shared/socialLife';
import { taskAccessError } from './shared/serviceAccess';
import { isSleepBed } from './shared/bedSleep';
import { FURNITURE_ACTIONS, furnitureActionList, availableFurnitureActions, type FurnitureUseAction } from './shared/furnitureUse';
import { FURNITURE_BY_ID } from './shared/furniture';
import { PLACES, stationById, cafeSeatAt } from './shared/locations';
import { formatRub } from './shared/economy';
import { dishCount } from './shared/dirtyDishes';
import { TABLE_READY_CAPACITY,readyFoodTableUsage } from './shared/readyFood';
import { PAYMENT_REMINDER_PREFIX, SERVICES, upcomingPayments, type ServiceId } from './shared/services';
import { homeLifeMenu, movieInvite } from './homeLifeUI';
import { BOOKS, GENRES } from './shared/homeLife';
import { createPhone } from './phoneUI';
import { createThoughtUI } from './thoughtUI';
import { createComputerUI } from './computerUI';
import { createFurnishingUI } from './furnishingUI';
import './furnishing.css';
import { needChips, needFeedback } from './needsFeedback';
import type { NeedEffects } from './shared/homeLife';
import { skillRank, type StudyMaterial } from './shared/education';
import { createSkillsPanel } from './skillsHUD';
import './skillsHUD.css';
import { MATERIAL_BY_ID, studyQuestion } from './shared/educationCatalog';
import type { EducationView } from './educationUI';
import { createCareerHUD } from './careerUI';
import { CAREERS } from './shared/careers';
import { WORK_EVENT_BY_ID } from './shared/careerCatalog';
import { HOME_LAPTOP } from './shared/locations';
import { createLocationUI } from './locationUI';
import { trustedDevice } from './core/trusted';
import './style.css';
import './mobile-polish.css';
import './queue-ui.css';
import './minimal-hud.css';
import './visual-polish-020.css';
import './mobile-controls-020.css';
import './mobile-ux-020.css';
import './district-minimal-021.css';
import { installMobileInput } from './mobileInput';
import { installMobileBack } from './mobileBack';
import { subtleHaptic } from './mobileHaptics';
import { gameAudio } from './game/GameAudio';
import { World, objectNames } from './game/World';
import { LiveConnection } from './core/network';
import { GameClockDisplay } from './core/gameClock';
import { showFoodChoices, type FoodCommand } from './foodMenu';
import { showCoffeeChoices } from './coffeeUI';
import { createMarketUI, showTakeoutChoices } from './marketUI';
import type { BasketLine } from './shared/market';
import { makeJobBoard } from './jobsUI';
import { HOME_OBJECT_DETAILS, storageUsage, FRIDGE_CAPACITY, CUPBOARD_CAPACITY } from './shared/storageSpace';
import {feedingStation,feederModel,feederReserve,dryRefills} from './shared/petFeeders';
import { renderPetChoices } from './petMenu';
import { PETS, PET_IDS, PET_BOWL_CAPACITY, PET_FOOD_REFILLS_PER_PACK, petHungerLevel, type PetId } from './shared/pets';
import { clockAt, dayPhase, gameDate, gameMinutes, timeLabel, LOW_BLADDER, NEED_INFO, VITAL_NEEDS } from './shared/life';
import type { TimeStatus } from './shared/timeControl';
import {
  ACTIONS, itemNames, names,
  type ActionId, type CharacterId, type GameState, type ItemId, type QueuedTask,
} from './shared/protocol';

let state: GameState | null = null;
let selectedDesktopFurnitureId:number|null=null;
const installedDesktopId=():number|undefined=>{
  if(!state?.furnishing.soldFixtures?.includes('desk'))return undefined;
  const available=state.furnishing.placed.filter(item=>FURNITURE_BY_ID.get(item.sku)?.shape==='desk'&&!isNotebookDesk(item.sku));
  return available.find(item=>item.id===selectedDesktopFurnitureId)?.id??available[0]?.id;
};
let active: CharacterId | null = null;
let online: CharacterId[] = [];
const waitingTasks = new Map<CharacterId,QueuedTask[]>();
let timeStatus: TimeStatus = { multiplier: 1, shiftVotes: [], sleepers: {}, paused: false, pauseRequestedBy: null };
let taskPauseStart: number | null = null;
let taskPauseTotal = 0;
const taskNow = () => (taskPauseStart ?? performance.now()) - taskPauseTotal;
let selectedRole: CharacterId = 'vlad';
let localPreviewNoCodes=false;
let toastTimer: number | undefined;
let paymentNoticeTimer: number | undefined;
const shownPayments = new Map<ServiceId, number>();
const displayClock = new GameClockDisplay();
let previousClockMinute = -1;
let previousClockSpeed: TimeStatus['multiplier'] | 0 = 1;
interface TaskView {
  taskId: number;
  label: string;
  since: number | null;
  effects?: NeedEffects;
  durationMs: number;
  automatic?: boolean;
  material?: StudyMaterial;
  studyProgress?: { elapsed: number; total: number };
  question?: string;
  paired?: SocialIntent;
  isCooking?:boolean;
  answer?: { correct: boolean; message: string };
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
        <div class="brand-icon" aria-hidden="true">⌂</div>
        <div><span class="brand-kicker">СИМУЛЯТОР ЖИЗНИ</span><h1>SIM LIFE</h1></div>
      </div>
      <div class="version">ДОМ · РАЙОН</div>
    </div>
    <div class="money-panel" role="group" aria-label="Семейный бюджет"><span>Семейный бюджет</span><strong id="money">— ₽</strong></div>
    <div class="life-strip">
      <span id="life-clock"><span data-game-time><span class="clock-full">☀️ 1 марта · 08:00</span><span class="clock-compact">01.03 · 08:00</span></span><small data-game-season>Весна · год 1</small></span>
      <button id="needs-toggle" type="button" aria-label="Потребности" aria-expanded="false" aria-controls="needs-panel"><span class="need-glyph" aria-hidden="true"><i></i><i></i><i></i></span><span class="hud-label"> Потребности</span></button>
      <button id="map-btn" type="button" disabled><svg class="ui-outline-icon" aria-hidden="true" viewBox="0 0 24 24"><path d="m3 6 6-3 6 3 6-3v15l-6 3-6-3-6 3z"/><path d="M9 3v15M15 6v15"/></svg><span class="hud-label"> Карта</span></button>
      <button id="pets-btn" class="pets-hud-btn" type="button" disabled aria-label="Питомцы Верделл и Симба" title="Питомцы"><svg class="ui-outline-icon" aria-hidden="true" viewBox="0 0 24 24"><ellipse cx="6.5" cy="7.2" rx="1.2" ry="1.8"/><ellipse cx="11" cy="5.3" rx="1.3" ry="1.9"/><ellipse cx="15.6" cy="6.4" rx="1.3" ry="1.9"/><ellipse cx="19" cy="10.2" rx="1.2" ry="1.8"/><path d="M9.3 12.2c1.7-2.2 3.9-2.4 5.5-.2l2.4 3c2.3 2.9.1 5.8-3 4.5a5.1 5.1 0 0 0-4.2 0c-3 1.3-5.3-1.7-3.1-4.4z"/></svg><small class="pet-alert" hidden></small></button>
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
      <button id="showcase-toggle" class="showcase-toggle" type="button" aria-controls="showcase-choices" aria-expanded="false" aria-label="Рассмотреть героев"><svg class="ui-outline-icon" aria-hidden="true" viewBox="0 0 24 24"><circle cx="10.5" cy="10.5" r="6.4"/><path d="m15.1 15.1 4.6 4.6"/></svg><span class="hud-label" id="showcase-label"> Рассмотреть героев</span></button>
      <div id="showcase-choices" class="showcase-choices" hidden>
        <button type="button" data-showcase="vlad">👨 Влад</button>
        <button type="button" data-showcase="alina">👩 Алина</button>
        <button type="button" data-showcase="verdell">🐕 Верделл</button>
        <button type="button" data-showcase="simba">🐈 Симба</button>
        <button type="button" data-showcase="home">🏡 Весь дом</button>
      </div>
    </div>
  </header>
  <div class="camera-dock"><button id="camera-reset" class="camera-reset" type="button" aria-label="Сбросить камеру к общему виду" title="Вернуть общий вид">⌂</button><button id="camera-follow" class="camera-reset camera-follow" type="button" aria-label="Следовать за персонажем" aria-pressed="false" title="Следовать за персонажем">◎</button></div>
  <section id="pause-sheet" class="pause-sheet" aria-live="polite" hidden><div class="pause-card"><span class="pause-emblem">⏸</span><strong id="pause-title">Пауза</strong><p id="pause-description"></p><div id="pause-actions"></div></div></section>
  <section id="skills-overlay" class="skills-overlay" aria-label="Навыки персонажа" hidden></section>
  <section id="needs-panel" class="needs-panel" aria-label="Потребности семьи" hidden>
    <div class="needs-header"><strong>Состояние и потребности</strong><button id="needs-close" type="button" aria-label="Закрыть потребности">×</button></div>
    <div id="needs-content"></div>
  </section>
  <aside id="thought-dock" class="thought-dock" aria-label="Мысли и желания персонажей" hidden></aside>
  <div id="map-panel" class="world-map" role="dialog" aria-label="Карта района" hidden></div>
  <div id="world-transition" aria-hidden="true"></div>
  <div id="message" class="message" aria-live="polite"></div>
  <aside id="payment-notice" class="payment-notice" hidden>
    <span role="status"></span><button type="button">К платежам</button>
  </aside>
  <section id="social-invite" class="social-invite" hidden aria-label="Совместное приглашение" aria-live="polite"></section>
  <section id="movie-invite" class="movie-invite" hidden aria-live="polite"></section>
  <section id="phone-overlay" class="phone-overlay" hidden></section>
  <section id="computer-overlay" class="computer-overlay" hidden></section>
  <section id="furnishing-overlay" class="furnish-overlay" hidden></section>
  <section id="furnishing-placement" class="furnish-placement" hidden></section>
  <section id="market-overlay" class="market-overlay" hidden aria-label="Магазин и семейная экономика"></section>
  <section id="jobs-overlay" class="jobs-overlay" hidden aria-label="Биржа подработок"></section>
  <footer class="bottom-ui">
    <div id="actions" class="actions" hidden></div>
    <div id="location-panel" class="actions location-panel" hidden></div>
    <div id="need-gain" class="need-gain" aria-live="polite"></div>
    <div id="task-panel" class="task-panel" hidden aria-live="polite"></div>
    <div id="time-panel" class="task-panel time-panel" hidden aria-live="polite"></div>
    <section id="career-hud" class="career-hud" aria-label="Рабочая смена" hidden></section>
    <div class="bottom-bar">
      <div id="stock-line" class="stock-line">🍳 Общие запасы и еда загружаются…</div>
      <div class="home-buttons">
        <button id="phone-btn" class="market-btn" type="button" disabled>📱 Телефон</button>
        <button id="skills-btn" class="market-btn" type="button" disabled>📊 Навыки <small>🍲 0 ур.</small></button>
        <button id="pause-btn" type="button" aria-label="Поставить игру на паузу" disabled></button>
      </div>
      <div class="tip">
        <span class="tip-icon">✦</span>
        <span>Тап по предмету · Щипок для масштаба</span>
      </div>
      <div class="footer-row"><span>Наш семейный дом</span><span id="online-note">Ожидание сервера</span></div>
    </div>
  </footer>
  <section id="auth" class="auth-screen" aria-labelledby="auth-title">
    <form id="auth-form" class="auth-card">
      <span class="auth-emblem">⌂</span>
      <div class="brand-kicker">SIM LIFE · НАШ ДОМ</div>
      <h2 id="auth-title">С возвращением домой</h2>
      <p>У каждого свой персонаж, но один дом, семейный бюджет и общий прогресс.</p>
      <div class="role-choices">
        <button data-role="vlad" class="role-option selected" type="button">💻 <b>Влад</b><span>Разработчик</span></button>
        <button data-role="alina" class="role-option" type="button">🌸 <b>Алина</b><span>Мастер реконструкции</span></button>
      </div>
      <label for="access-code">Личный код персонажа</label>
      <input id="access-code" name="access-code" type="password" minlength="12" maxlength="48" placeholder="Введи личный код" autocomplete="off" required />
      <label class="remember-device"><input type="checkbox" id="remember-device"> Запомнить вход на этом устройстве</label>
      <button class="enter-button" type="submit" disabled>Войти в общий дом</button>
      <p class="auth-status" id="auth-status">Выбери персонажа и введи личный код</p>
      <small>Ваш общий дом доступен в домашней сети.</small>
    </form>
  </section>
  <div class="rotate-notice">Для Sim-Life поверни телефон вертикально ↻</div>
`;

installMobileInput(app);
gameAudio.install(app);

const canvas = document.querySelector<HTMLCanvasElement>('#game-canvas')!;
const actionsEl = document.querySelector<HTMLDivElement>('#actions')!;
const taskPanelEl = document.querySelector<HTMLDivElement>('#task-panel')!;
const timePanelEl = document.querySelector<HTMLDivElement>('#time-panel')!;
const statusEl = document.querySelector<HTMLDivElement>('#status')!;
const messageEl = document.querySelector<HTMLDivElement>('#message')!;
const paymentNotice = document.querySelector<HTMLElement>('#payment-notice')!;
const authEl = document.querySelector<HTMLElement>('#auth')!;
const authStatusEl = document.querySelector<HTMLElement>('#auth-status')!;
const accessInput = document.querySelector<HTMLInputElement>('#access-code')!;
const phoneBtn = document.querySelector<HTMLButtonElement>('#phone-btn')!;
const skillsBtn = document.querySelector<HTMLButtonElement>('#skills-btn')!;
const mapBtn = document.querySelector<HTMLButtonElement>('#map-btn')!;
const mapPanel = document.querySelector<HTMLElement>('#map-panel')!;
const locationPanel = document.querySelector<HTMLElement>('#location-panel')!;
const transition = document.querySelector<HTMLElement>('#world-transition')!;
const rememberDevice = document.querySelector<HTMLInputElement>('#remember-device')!;
const petsBtn = document.querySelector<HTMLButtonElement>('#pets-btn')!;
const jobsOverlay=document.querySelector<HTMLElement>('#jobs-overlay')!;
const clockEl = document.querySelector<HTMLElement>('#life-clock')!;
const clockTime = clockEl.querySelector<HTMLElement>('[data-game-time]')!;
const clockFull = clockTime.querySelector<HTMLElement>('.clock-full')!;
const clockCompact = clockTime.querySelector<HTMLElement>('.clock-compact')!;
const clockSeason = clockEl.querySelector<HTMLElement>('[data-game-season]')!;
const needsPanelEl = document.querySelector<HTMLElement>('#needs-panel')!;
const needsContentEl = document.querySelector<HTMLElement>('#needs-content')!;
const needsToggleEl = document.querySelector<HTMLButtonElement>('#needs-toggle')!;
const marketOverlay = document.querySelector<HTMLElement>('#market-overlay')!;
function toggleNeeds(open: boolean): void {
  if(open) thoughts.close();
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
  label.textContent = id === null ? ' Рассмотреть героев'
    : ' ' + (id === 'vlad' || id === 'alina' ? names[id] : PETS[id].name);
  world.showcase(id);
}

showcaseToggle.addEventListener('click', () => {
  showcaseChoices.hidden = !showcaseChoices.hidden;
  showcaseToggle.setAttribute('aria-expanded', String(!showcaseChoices.hidden));
});
showcaseReturn.addEventListener('click', () => focusModel(null));
document.querySelector<HTMLButtonElement>('#camera-reset')!.addEventListener('click',()=>{
  if(!world)return;
  if(!showcaseReturn.hidden)focusModel(null);
  world.resetCamera();
});
document.querySelector<HTMLButtonElement>('#camera-follow')!.addEventListener('click',()=>world?.toggleFollowPlayer());
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && !showcaseReturn.hidden) focusModel(null);
  if (event.key === 'Escape') {
    actionsEl.hidden = true;
    toggleNeeds(false);
    phone.close();
    computer.close();
    furnishing.close();
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

function showUpcomingPayments(household: GameState): void {
  const fresh = upcomingPayments(household.billing, gameMinutes(household.clock))
    .filter(payment => payment.amount !== null && shownPayments.get(payment.id) !== payment.due);
  const first = fresh[0];
  if (!first) return;
  for (const { id, due } of fresh) shownPayments.set(id, due);
  paymentNotice.querySelector('span')!.textContent = fresh.length === 1 && first.amount !== null
    ? 'В течение игрового дня · ' + SERVICES[first.id].name + ' · ' + formatRub(first.amount)
    : 'В течение игрового дня · платежей: ' + fresh.length;
  paymentNotice.hidden = false;
  window.clearTimeout(paymentNoticeTimer);
  paymentNoticeTimer = window.setTimeout(() => { paymentNotice.hidden = true; }, 9000);
}

function drawTaskPanel(): void {
  taskPanelEl.replaceChildren();
  taskPanelEl.hidden = tasks.size === 0 && ![...waitingTasks.values()].some(rows=>rows.length);
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
    if (task.effects) box.append(needChips(task.effects,false));
    const question = task.question ? studyQuestion(task.question) : undefined;
    if ((question || task.answer) && role === active && task.since !== null) {
      const form = document.createElement('div');
      form.className = 'study-question';
      const title = document.createElement('strong');
      title.textContent = question ? question.prompt : 'Задание';
      form.append(title);
      for (const [choice, label] of (question?.choices ?? []).entries()) {
        const option = document.createElement('button');
        option.type = 'button';
        option.className = 'education-button';
        option.textContent = label;
        option.dataset.answer = String(choice);
        option.addEventListener('click', () => net.education({ type: 'education_answer', taskId: task.taskId, choice }));
        form.append(option);
      }
      if (task.answer) {
        const status = document.createElement('small');
        status.setAttribute('role', 'status');
        status.textContent = task.answer.message;
        form.append(status);
      }
      box.append(form);
    }
    if (role === active) {
      if(task.paired&&world?.place==='home'){
        const focus=document.createElement('button');
        focus.type='button';focus.className='task-focus';focus.dataset.focusShared='';
        focus.textContent='🎥 К действию';
        focus.setAttribute('aria-label','Приблизить камеру к совместному занятию');
        focus.addEventListener('click',()=>{
          if(!world?.focusSharedActivity())notify('Сначала вернитесь домой к занятию');
        });
        box.append(focus);
      }
      const cancel = document.createElement('button');
      cancel.type = 'button';
      cancel.className = 'task-cancel';
      cancel.textContent = '✕ Прервать';
      cancel.addEventListener('click', () => {
        if (net.cancelTask(task.taskId)) cancel.disabled = true;
      });
      box.append(cancel);
      if(task.paired&&['eat','takeout','cafeMeal'].includes(task.paired.action)){
        const finish=document.createElement('button');
        finish.type='button';finish.className='social-button';finish.dataset.socialFinish='';
        finish.textContent='Закончить свою порцию';
        finish.addEventListener('click',()=>net.social({type:'social_finish',taskId:task.taskId}));
        box.append(finish);
      }
    }
    taskPanelEl.append(box);
  }
  for(const [role, list] of waitingTasks){
    if(!list.length)continue;
    const section=document.createElement('div');
    section.className='queued-task-list';
    const caption=document.createElement('strong');
    caption.textContent='📋 '+names[role]+' · до 3 действий';
    section.append(caption);
    for(const [index,task] of list.entries()){
      const row=document.createElement('div');
      row.className='queued-task-row';
      const label=document.createElement('span');
      label.textContent=(index+1+(tasks.has(role)||Boolean(timeStatus.sleepers[role])?2:1))+'. '+task.label;
      row.append(label);
      if(role===active){
        const remove=document.createElement('button');
        remove.type='button';remove.textContent='×';
        remove.setAttribute('aria-label','Убрать из очереди: '+task.label);
        remove.addEventListener('click',()=>{if(net.cancelQueuedTask(task.id))remove.disabled=true;});
        row.append(remove);
      }
      section.append(row);
    }
    if(role===active){
      const clear=document.createElement('button');
      clear.type='button';clear.className='queue-clear';
      clear.textContent='Очистить ожидание';
      clear.addEventListener('click',()=>{if(net.clearTaskQueue())clear.disabled=true;});
      section.append(clear);
    }
    taskPanelEl.append(section);
  }
  updateTaskProgress();
}

function updateTaskProgress(): void {
  for (const [role, task] of tasks) {
    const card = taskPanelEl.querySelector<HTMLElement>('[data-role="' + role + '"]');
    if (!card) continue;
    const elapsed = task.since === null ? 0 : Math.min(taskNow() - task.since, task.durationMs);
    const finish=card.querySelector<HTMLButtonElement>('[data-social-finish]');
    if(finish)finish.disabled=elapsed/task.durationMs<.72;
    card.querySelector<HTMLElement>('.running-task-track i')!.style.width =
      (task.material ? (task.studyProgress ? task.studyProgress.elapsed / task.studyProgress.total * 100 : 0)
        : Math.min(100, elapsed / task.durationMs * 100)) + '%';
    card.querySelector<HTMLElement>('.task-seconds')!.textContent =
      task.since === null ? 'Подходит' : task.studyProgress
        ? Math.ceil(task.studyProgress.total - task.studyProgress.elapsed) + ' игр. мин'
        : Math.max(0, Math.ceil((task.durationMs - elapsed) / 1000)) + ' с';
  }
}
window.setInterval(() => {
  if (tasks.size) updateTaskProgress();
  renderClock();
}, 150);

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
    const thought=thoughtFor(state,role);
    const thoughtNode=document.createElement('p');
    thoughtNode.className='autonomy-thought';
    thoughtNode.textContent=thought.emoji+' '+thought.text;
    group.append(thoughtNode);
    const settings=document.createElement('div');
    settings.className='autonomy-mode-row';
    const name=document.createElement('span');
    name.textContent='🧠 Самостоятельность';
    const chosen=document.createElement('select');
    chosen.setAttribute('aria-label','Самостоятельность: '+names[role]);
    chosen.dataset.autonomy=role;
    chosen.disabled=role!==active;
    for(const mode of AUTONOMY_MODES){
      const option=document.createElement('option');
      option.value=mode;option.textContent=AUTONOMY_LABELS[mode];
      chosen.append(option);
    }
    chosen.value=state.autonomy[role];
    chosen.addEventListener('change',()=>{
      if(net.setAutonomyMode(chosen.value as AutonomyMode)) chosen.disabled=true;
    });
    settings.append(name,chosen);
    group.append(settings);
    if(role===active){
      const note=document.createElement('small');
      note.className='autonomy-note';
      note.textContent='«Выключена» — спокойный ритм: редкие прогулки и помощь только при очень сильной необходимости. Покупки и работу персонаж не начинает сам.';
      group.append(note);
    }
    for (const need of VITAL_NEEDS) {
      const info = NEED_INFO[need];
      const value = Math.round(char[need]);
      const row = document.createElement('div');
      row.className = 'need-row';
      row.title = info.hint;
      const label = document.createElement('span');
      const until=activeReward(state,role,need);
      label.textContent = info.emoji + ' ' + info.label+(until?' 🔒':'');
      if(until)row.title='Награда действует ещё '+rewardTime(until-gameMinutes(state.clock));
      const track = document.createElement('div');
      track.className = 'need-track';
      const fill = document.createElement('i');
      fill.style.width = value + '%';
      if(until)fill.classList.add('need-protected');
      else if (value < 30) fill.classList.add('need-low');
      else if (value < 55) fill.classList.add('need-mid');
      track.append(fill);
      const percent = document.createElement('span');
      percent.className = 'need-value';
      percent.textContent = value + '%';
      row.append(label, track, percent);
      group.append(row);
    }
    const urgent = char.bladder < LOW_BLADDER ? 'bladder' : VITAL_NEEDS.find(need => char[need] < 35);
    if (urgent) {
      const hint = document.createElement('small');
      hint.className = 'need-hint';
      hint.textContent = '✦ ' + NEED_INFO[urgent].hint;
      group.append(hint);
    }
    needsContentEl.append(group);
  }
}

function renderTimePanel(): void {
  timePanelEl.replaceChildren();
  if (!active || !state) { timePanelEl.hidden = true; return; }
  const mode = timeStatus.sleepers[active];
  timePanelEl.hidden = !mode;
  if (!mode) return;
  const status = document.createElement('strong');
  status.textContent = (mode === 'full' ? '🌙 Сон до 100%' : '😴 Отдых до 50%') +
    ' · энергия ' + Math.round(state.characters[active].energy) + '%' +
    ' · сейчас ×' + timeStatus.multiplier;
  const speeds = document.createElement('div');
  speeds.className = 'sleep-speed-guide';
  speeds.setAttribute('aria-label', 'Возможные ускорения сна');
  for (const [multiplier, label] of [[2, '×2 · до 100%'], [3, '×3 · до 50%']] as const) {
    const chip = document.createElement('span');
    chip.className = 'sleep-speed-chip';
    chip.textContent = label;
    chip.classList.toggle('sleep-speed-current', timeStatus.multiplier === multiplier);
    speeds.append(chip);
  }
  const note = document.createElement('small');
  note.textContent = online.some(role => !timeStatus.sleepers[role])
    ? '⏳ Ускорение начнётся, когда все игроки в сети будут спать. Пока ×1.'
    : 'Скорость выбирается автоматически по режимам сна. Разные режимы = ×2.';
  const track = document.createElement('progress');
  track.className = 'sleep-progress';
  track.max = mode === 'full' ? 100 : 50;
  track.value = state.characters[active].energy;
  track.setAttribute('aria-label','Восстановление энергии');
  const wake = document.createElement('button');
  wake.type = 'button';
  wake.className = 'action-button';
  wake.textContent = 'Проснуться сейчас';
  wake.addEventListener('click', () => net.stopSleep());
  timePanelEl.append(status,track,speeds,note,wake);
}

function renderPause(): void {
  const toggle = document.querySelector<HTMLButtonElement>('#pause-btn')!;
  const sheet = document.querySelector<HTMLElement>('#pause-sheet')!;
  const title = document.querySelector<HTMLElement>('#pause-title')!;
  const desc = document.querySelector<HTMLElement>('#pause-description')!;
  const actions = document.querySelector<HTMLElement>('#pause-actions')!;
  toggle.disabled = !active;
  toggle.textContent = '';
  toggle.dataset.paused = String(timeStatus.paused);
  toggle.setAttribute('aria-label', timeStatus.paused ? 'Продолжить игру' : 'Поставить игру на паузу');
  toggle.title = timeStatus.paused ? 'Продолжить игру' : 'Пауза';
  const request = timeStatus.pauseRequestedBy;
  sheet.hidden = !timeStatus.paused && !request;
  actions.replaceChildren();
  if (sheet.hidden) return;
  const action = (label: string, callback: () => void, secondary = false) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = label;
    if (secondary) button.className = 'pause-secondary';
    button.addEventListener('click', callback);
    actions.append(button);
  };
  if (timeStatus.paused) {
    title.textContent = 'Игра на паузе';
    desc.textContent = 'Часы, действия и жизнь соседей остановлены для обоих игроков.';
    action('▶ Продолжить', () => net.togglePause());
  } else if (request === active) {
    title.textContent = 'Ждём подтверждения';
    desc.textContent = 'Второй игрок должен согласиться. До этого игра продолжает идти.';
    action('Отменить запрос', () => net.togglePause(), true);
  } else {
    title.textContent = names[request!]+ ' предлагает паузу';
    desc.textContent = 'Остановить время и все игровые действия?';
    action('⏸ Поставить на паузу', () => net.replyPause(true));
    action('Нет, продолжить', () => net.replyPause(false), true);
  }
}

function renderClock(): void {
  if (!state) return;
  const minute = Math.floor(displayClock.read(performance.now()));
  const speed = timeStatus.paused ? 0 : timeStatus.multiplier;
  if (minute === previousClockMinute && speed === previousClockSpeed) return;
  previousClockMinute = minute;
  previousClockSpeed = speed;
  const clock = clockAt(minute);
  const date = gameDate(clock.day);
  const icon = { night: '🌙', morning: '☀️', day: '☀️', evening: '🌇' }[dayPhase(clock)];
  const hours = timeLabel(clock);
  const fullDate = date.day + ' ' + date.monthName + ' · ' + hours;
  const compactDate = String(date.day).padStart(2, '0') + '.' + String(date.month).padStart(2, '0') + ' · ' + hours;
  const season = date.season + ' · год ' + date.year +
    (speed > 1 ? ' · ×' + speed.toLocaleString('ru-RU') : '');
  clockTime.title = fullDate;
  clockFull.textContent = icon + ' ' + fullDate;
  clockCompact.textContent = compactDate;
  if (clockSeason.textContent !== season) clockSeason.textContent = season;
  phone.refreshClock(clock);
}

function render(reset = false): void {
  if (!state) return;
  if (active && world) {
    const place = state.world.places[active];
    if (world.place !== place) {
      actionsEl.hidden = true;
      phone.close();
      skillsPanel.close();
      computer.close();
      furnishing.close();
      focusModel(null);
      if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        transition.animate([{ opacity: 0.88 }, { opacity: 0 }], { duration: 225 });
      }
      statusEl.textContent = PLACES[place].name;
    }
    world.syncHousehold(state, active, reset, online);
    for(const role of ['vlad','alina'] as const){
      const worn=(state.world.wardrobe??defaultWardrobe())[role].worn;
      const actor=world.actors[role];
      if(actor.root.userData.wornLook!==worn){fitWardrobe(actor.root,role,outfitChoices(worn));actor.root.userData.wornLook=worn;}
    }
    locationUI.refresh(state, active);
    mapBtn.setAttribute('aria-label', 'Карта района. Сейчас: ' + PLACES[place].name);
    petsBtn.disabled = place !== 'home';
    const criticalPets = PET_IDS.filter(id => petHungerLevel(state!.pets[id].satiety) === 'critical');
    const hungryPets = PET_IDS.filter(id => petHungerLevel(state!.pets[id].satiety) === 'warning');
    const concern = criticalPets.length ? criticalPets.length : hungryPets.length;
    const alert = petsBtn.querySelector<HTMLElement>('.pet-alert')!;
    alert.textContent = String(concern);
    alert.hidden = concern === 0;
    petsBtn.classList.toggle('pets-urgent', criticalPets.length > 0);
    petsBtn.title = criticalPets.length ? 'Сильно голодны: ' + criticalPets.map(id => PETS[id].name).join(', ')
      : hungryPets.length ? 'Проголодались: ' + hungryPets.map(id => PETS[id].name).join(', ')
      : 'Уход за Верделлом и Симбой';
    petsBtn.setAttribute('aria-label', petsBtn.title);
    document.querySelector<HTMLElement>('#app')!.dataset.place = place;
    if (deliverySequence !== null && state.world.sequence[active] > deliverySequence) {
      deliverySequence = null;
      marketUI.acknowledge();
      computer.acknowledgeOrder();
    }
  }
  renderClock();
  thoughts.refresh();
  showUpcomingPayments(state);
  const lowBladder = !!active && state.characters[active].bladder < LOW_BLADDER;
  needsToggleEl.classList.toggle('needs-alert', lowBladder);
  needsToggleEl.setAttribute('aria-label', lowBladder ? 'Потребности. ' + NEED_INFO.bladder.hint : 'Потребности');
  needsToggleEl.title = lowBladder ? NEED_INFO.bladder.hint : '';
  world?.setTimeOfDay(state.clock.minute);
  phone.refresh();
  skillsPanel.refresh();
  computer.refresh();
  furnishing.refresh();
  furnishing.acknowledge(state);
  careerHUD.render(state,active);
  renderNeeds();
  renderTimePanel();
  if (active) skillsBtn.querySelector('small')!.textContent = '🍲 '+skillRank(state.education.characters[active].xp.cooking).level+' ур.';
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
const orderDelivery = (lines: BasketLine[]) => {
  if (!state || !active || deliverySequence !== null) return false;
  const sequence = state.world.sequence[active];
  if (!net.world({ type: 'delivery_order', lines, sequence })) return false;
  deliverySequence = sequence;
  return true;
};
const marketUI = createMarketUI(marketOverlay,orderDelivery,()=>phone.open('mobile'));
const locationUI = createLocationUI(locationPanel, mapPanel, () => world, command => net.world(command),
  recipe => { net.food('cook', recipe); }, signOut,
  (room, exam) => openEducation(exam ? 'exam' : 'center', room),
  station => net.career({type:'career_start',via:station}), () => phone.open('career'), action=>net.social({type:'social_propose',action}),job=>net.startJob(job));

function signOut(): void {
  gameAudio.setPlaying(false);
  net.forgetDevice();
  deliverySequence = null;
  active = null;
  state = null;
  tasks.clear();
  waitingTasks.clear();
  drawTaskPanel();
  accessInput.value = '';
  rememberDevice.checked = false;
  authEl.hidden = false;
  thoughts.reset();
  phoneBtn.disabled = skillsBtn.disabled = petsBtn.disabled = mapBtn.disabled = true;
  skillsPanel.close();
  actionsEl.hidden = true;
  phone.close();
  computer.close();
  furnishing.close();
  careerHUD.render(null,null);
  shownPayments.clear();
  paymentNotice.hidden = true;
  window.clearTimeout(paymentNoticeTimer);
  invites.close();
  socialInvite.clear();
  feedback.clear();
  locationUI.reset();
  showStatus(localPreviewNoCodes?'Выбери персонажа — тестовый вход без кода':'Выбери персонажа и введи личный код');
}
const jobsUI=makeJobBoard(jobsOverlay,id=>net.startJob(id),()=>net.leaveJobEarly(),
  enabled=>net.setShiftSpeed(enabled),()=>timeStatus,()=>online);
const thoughts=createThoughtUI(document.querySelector<HTMLElement>('#thought-dock')!,
  ()=>state&&active?{state,role:active}:null,
  ()=>{toggleNeeds(false);locationUI.closeMap();},
  ()=>phone.openAutonomyHistory(),
  (role,command)=>{
    if(!active||!state||active!==role)return false;
    if(command.type==='local_activity')return state.world.places[role]==='park'&&net.world({type:'approach',place:'park',station:command.station});
    if(state.world.places[role]!=='home')return false;
    if(command.type==='together')return net.social({type:'social_propose',action:command.action});
    if(command.type==='fridge'){
      const station=stationById('home','fridge');
      if(!station)return false;
      locationUI.visit(station);return true;
    }
    if(command.type==='sleep_start')return net.startSleep(command.mode);
    if(command.type==='act')return net.perform(command.actionId);
    if(command.type==='furniture_use')return net.furnitureUse(command);
    if(command.type==='cook'||command.type==='eat')return net.food(command.type,command.recipe);
    if(command.type==='eat_takeout')return net.eatTakeout(command.item);
    if(command.type==='pet_action')return net.petAction(command.pet,command.action);
    return false;
  },(type,id)=>net.happiness(type,id));
const phone = createPhone(document.querySelector<HTMLElement>('#phone-overlay')!,marketOverlay,jobsOverlay,
  () => state && active ? {state,role:active,online,time:timeStatus,clock:clockAt(displayClock.read(performance.now()))} : null,
  household => marketUI.open(household),(household,role) => jobsUI.open(household,role),
  () => {marketUI.close();jobsUI.close();},command=>net.service(command),command=>net.budget(command),command=>net.education(command),
  () => locationUI.go('education'),command=>net.career(command),enabled=>net.setShiftSpeed(enabled),{
    suggest(group,id){ if(!active)return;phone.close();openSocialActions(otherPerson(active),group,id); },
    moment(id){
      if(!active||!state)return;
      const story=familyMoments(state,active).find(candidate=>candidate.id===id);
      if(!story)return;
      if(net.social({type:'social_propose',action:story.action,item:story.item,moment:story.id}))
        phone.close();
    },
    offer(){phone.close();socialInvite.unfold();},
    pending:()=>socialInvite.pending,
    current(){
      const task=active&&tasks.get(active);
      if(task&&task.paired)return task.label+(task.since===null?' · готовимся':'');
    },
  },()=>furnishing.open(),mode=>net.setAutonomyMode(mode),thoughts,()=>{
    if(!state||!active)return false;
    if(state.furnishing.soldFixtures?.includes('sofa')){const sofa=state.furnishing.placed.find(p=>furnitureActionList(p).includes('sofaScroll'));if(!sofa){notify('Поставь диван для отдыха');return false;}return net.furnitureUse({type:'furniture_use',furnitureId:sofa.id,action:'sofaScroll'});}
    return net.perform('sofaScroll');
  });
const skillsPanel = createSkillsPanel(document.querySelector<HTMLElement>('#skills-overlay')!,
  () => state && active ? {state, role:active} : null);
skillsBtn.addEventListener('click',()=>{
  toggleNeeds(false); actionsEl.hidden=true; phone.close(); computer.close(); skillsPanel.open();
});
const careerHUD = createCareerHUD(document.querySelector<HTMLElement>('#career-hud')!,command=>net.career(command),()=>phone.open('career'),{answer:(nonce,choice)=>net.answerHomeJob(nonce,choice),leave:()=>net.leaveJobEarly()});
const computer = createComputerUI(document.querySelector<HTMLElement>('#computer-overlay')!, {
  read: () => active && state ? { state, role:active, time:timeStatus } : null,
  act: (actionId,device) => {
    if (!state || !active) return false;
    if(device==='desktop'&&state.furnishing.soldFixtures?.includes('desk')){
      const id=installedDesktopId();
      if(id===undefined){notify('Сначала поставь новый письменный стол');return false;}
      const item=state.furnishing.placed.find(row=>row.id===id);
      if(!item||!furnitureActionList(item).includes(actionId as FurnitureUseAction))return false;
      return net.furnitureUse({type:'furniture_use',furnitureId:id,action:actionId as FurnitureUseAction});
    }
    const denial = taskAccessError(state,{type:'act',actionId,computer:device});
    if (denial) { notify(denial); return false; }
    return net.perform(actionId,device);
  },
  playGame: (game,device) => {
    if(device==='desktop'&&state?.furnishing.soldFixtures?.includes('desk')&&installedDesktopId()===undefined){
      notify('Сначала поставь новый письменный стол');return false;
    }
    return net.playGame(game,device,device==='desktop'?installedDesktopId():undefined);
  },
  favorite: (game,enabled) => net.favoriteGame(game,enabled),
  watchVideo: (clip,device) => {
    if(device==='desktop'&&state?.furnishing.soldFixtures?.includes('desk')&&installedDesktopId()===undefined){
      notify('Сначала поставь новый письменный стол');return false;
    }
    return net.playComputerVideo(clip,device,device==='desktop'?installedDesktopId():undefined);
  },
  preview: (device,scene) => world.previewComputer(device,scene),
  career: command => net.career(command),
  homeJob: (id,device)=>net.startJob(id,device),
  leaveJob: ()=>net.leaveJobEarly(),
  answerHomeJob:(nonce,choice)=>net.answerHomeJob(nonce,choice),
  education: command => net.education(command),
  vote: enabled => net.setShiftSpeed(enabled),
  travel: () => locationUI.go('education'),
  service: command => net.service(command),
  budget: command => net.budget(command),
  checkout: lines => orderDelivery(lines),
  furnishing:()=>furnishing.open(),
});
function openEducation(view: EducationView, room?: string) {
  actionsEl.hidden = true;
  locationUI.close();
  phone.openEducation(view, room);
}
paymentNotice.querySelector('button')!.addEventListener('click', () => {
  paymentNotice.hidden = true;
  actionsEl.hidden = true;
  phone.open('finance');
});
const entertainmentMenu = homeLifeMenu(actionsEl,showActionMenu,command=>net.entertainment(command),genre=>net.social({type:'social_propose',action:'film',item:genre}),
  () => state, () => active, where => phone.open(where), openEducation);
const socialInvite=createSocialOffer(document.querySelector<HTMLElement>('#social-invite')!,command=>net.social(command),taskNow);
const invites = movieInvite(document.querySelector<HTMLElement>('#movie-invite')!,
  (id,accept)=>net.answerMovie(id,accept),id=>net.withdrawMovie(id));
const feedback = needFeedback(document.querySelector<HTMLElement>('#need-gain')!);
const net = new LiveConnection({
  onReady(role, household, players) {
    selectedDesktopFurnitureId=null;
    active = role;
    gameAudio.setPlaying(true);
    gameAudio.setPaused(false);
    state = household;
    thoughts.onReady(role);
    displayClock.reset(gameMinutes(household.clock), performance.now());
    online = players;
    timeStatus = { multiplier: 1, shiftVotes: [], sleepers: {}, paused: false, pauseRequestedBy: null };
    taskPauseStart = null;
    taskPauseTotal = 0;
    renderPause();
    tasks.clear();
    waitingTasks.clear();
    drawTaskPanel();
    toggleNeeds(false);
    phone.close();
    skillsPanel.close();
    authEl.hidden = true;
    mapBtn.disabled = false;
    skillsBtn.disabled = false;
    phoneBtn.disabled = false;
    petsBtn.disabled = false;
    actionsEl.hidden = true;
    world.setActive(role);
    render(true);
    notify('🏡 С возвращением, ' + names[role] + '!');
  },
  onSnapshot(household) {
    if (!state || household.revision >= state.revision) {
      const milestones = active ? household.education.characters[active].events.filter(event => event.milestone) : [];
      const last = milestones.at(-1);
      const known = active && state?.education.characters[active].events.some(event =>
        event.milestone && event.at === last?.at && event.title === last?.title);
      state = household;
      render();
      if (last && !known) notify(last.title);
      marketUI.refresh(household);
      jobsUI.refresh(household);
    }
  },
  onOnline(players) {
    online = players;
    renderPause();
    render();
    if (state) jobsUI.refresh(state);
  },
  onTimeStatus(status) {
    const before = timeStatus.sleepers;
    timeStatus = status;
    if (status.paused && taskPauseStart === null) taskPauseStart = performance.now();
    if (!status.paused && taskPauseStart !== null) {
      taskPauseTotal += performance.now() - taskPauseStart;
      taskPauseStart = null;
    }
    world?.setPaused(Boolean(status.paused));
    renderPause();
    if (active && world) {
      for (const role of ['vlad', 'alina'] as const) {
        if (Boolean(before[role]) !== Boolean(status.sleepers[role]))
          world.showSleep(role, Boolean(status.sleepers[role]));
      }
    }
    render();
    drawTaskPanel();
    if (state) jobsUI.refresh(state);
  },
  onClock(sample) {
    displayClock.sync(sample, performance.now());
    renderClock();
    furnishing.tick();
    world.updateFurnitureDeliveryTime(displayClock.read(performance.now()));
    world.setTimeOfDay(displayClock.read(performance.now()) % 1440);
  },
  onDisconnect() {
    gameAudio.setPlaying(false);
    displayClock.pause(performance.now());
    socialInvite.clear();
    waitingTasks.clear();
    for(const [role,task] of tasks)if(task.paired){world.cancelTimedAction(role);tasks.delete(role);}
    drawTaskPanel();
    renderPause();
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
  onBillingEvent(messages) {
    const updates = messages.filter(message => !message.includes(PAYMENT_REMINDER_PREFIX));
    if (!updates.length) return;
    phone.billingMessages(updates);
    notify(updates.length > 2 ? updates[0] + ' · ещё ' + (updates.length - 1) + ' в телефоне' : updates.join(' · '));
  },
  onReadyFoodSpoiled(message) {
    notify(message);
  },
  onDeliveryArrived() {
    if(active&&world.place==='home')gameAudio.play('ring','ui',.55);
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
    if(role===active)gameAudio.play('confirm','ui',.55);
    if(role===active){marketUI.acknowledge();computer.acknowledgeOrder();subtleHaptic('confirm');}
    statusEl.textContent=message;
    notify(message);
  },
  onJobEvent(_role,_outcome,message) {
    statusEl.textContent=message;
    notify(message);
  },
  onPetEvent(_role, _pet, _action, message) {
    if(_action==='treat')world.showPetTreat(_pet);
    if(world.place==='home'&&world.pets[_pet].root.visible&&_action==='call')gameAudio.play(_pet==='simba'?'meow':'bark','pets',.48,world.pets[_pet].root.position);
    statusEl.textContent = message;
    notify(message);
  },
  onHomeLeisure(roles, activity, routes) {
    world.setHomeLeisure(roles, activity, routes);
  },
  onStorageEvent(role, station) {
    if (world.place !== 'home') return;
    if (station) gameAudio.play('door','effects',.45,world.actors[role].root.position);
    if (station) world.openStorage(station, role);
    else world.closeStorage(role);
  },
  onTaskStarted(role, taskId, label, durationMs, command, automatic, home, effects) {
    tasks.set(role, { taskId, label, durationMs, automatic, effects, since: home ? null : taskNow(),
      paired: command.type==='together'?command:undefined, isCooking:command.type==='cook', question: home?.question, material: command.type === 'study' ? MATERIAL_BY_ID.get(command.material) : undefined });
    if(role===active&&command.type==='together'){actionsEl.hidden=true;phone.close();}
    if (role === active && command.type === 'study') phone.close();
    drawTaskPanel();
    const animated = world.startTimedAction(role, command, home);
    statusEl.textContent = names[role] + ': ' + label;
    if (!animated && role === active) notify('Действие началось на сервере, путь анимации пока недоступен');
  },
  onTaskQueue(role, queued){
    waitingTasks.set(role,queued);
    drawTaskPanel();
  },
  onTaskActive(role,taskId,elapsedMs) {
    const task=tasks.get(role);
    if(task?.taskId!==taskId) return;
    task.since=taskNow()-elapsedMs;
    world.activateHomeTask(role,elapsedMs);
    if(role===active&&task.paired)phone.refreshRelationship();
    if (task.material) drawTaskPanel(); else updateTaskProgress();
  },
  onStudyProgress(role, taskId, elapsed, total) {
    const task = tasks.get(role);
    if (task?.taskId !== taskId) return;
    task.studyProgress = { elapsed, total };
    updateTaskProgress();
  },
  onEducationFeedback(taskId, correct, message, question) {
    const task = active && tasks.get(active);
    if (!task || task.taskId !== taskId) return;
    task.answer = { correct, message };
    task.question = question;
    drawTaskPanel();
  },
  onEducationNotice(message) { if (!computer.educationMessage(message) && !phone.educationMessage(message)) notify(message); },
  onNeedGain(role,label,effects) { feedback.show(role,label,effects); },
  onMovieOffer(inviteId,from,genre) { invites.show(inviteId,names[from],genre,from===active); },
  onMovieOfferClosed(inviteId,message) { invites.close(inviteId);notify(message); },
  onTaskEnded(role, taskId, outcome, message, effects) {
    const previous = tasks.get(role);
    if (previous?.taskId === taskId) {
      if (outcome === 'completed') {
        if(role===active&&!previous.automatic)gameAudio.play('confirm','ui',.36);
        world.finishTimedAction(role);
        feedback.show(role,previous.label,effects);
        statusEl.textContent=message;
        if(role===active&&message.includes('✨ Желание исполнено'))notify(message.slice(message.indexOf('✨ Желание исполнено')));
      }
      tasks.delete(role);
      drawTaskPanel();
      if(role===active&&previous.paired)phone.refreshRelationship();
    }
    if (outcome !== 'completed') {
      if (previous?.taskId === taskId) world.cancelTimedAction(role);
      if (previous?.automatic) return;
      statusEl.textContent = message;
      notify(message);
    }
  },
  onSocialOffer(offer){
    if(!active)return;
    socialInvite.set(offer,active);
    phone.refresh();
  },
  onSocialClosed(id,message,reply){
    socialInvite.clear(id);
    if(reply&&message==='Разговор во время отдыха')world.parkConversation();
    notify(reply?'«'+reply+'»':message);
    phone.refresh();
  },
  onSocialStart(kind, message) {
    actionsEl.hidden = true;
    const animated = world.playSocial(kind);
    statusEl.textContent = message;
    notify(animated ? message : message + ' · анимация временно недоступна');
  },
  onError(reason) {
    if(active)gameAudio.play('error','ui',.35);
    if(reason===CAT_BLOCKED||reason===CAT_DESCENDING){
      phone.close();computer.close();
      showActionMenu('🐈 Симба');
      const note=document.createElement('p');note.className='food-empty';note.textContent=reason;actionsEl.append(note);
      const site=state&&catOccupiedPerch(state);
      if(site&&reason===CAT_BLOCKED){
        const button=document.createElement('button');button.type='button';button.className='action-button';button.textContent='🐾 Убрать Симбу';
        button.addEventListener('click',()=>{if(net.yieldSimba(site.key)){actionsEl.hidden=true;notify('Симба освобождает место…');}});actionsEl.append(button);
      }
      return;
    }
    furnishing.reject(reason);
    if(computer.visible) computer.billingMessages([reason]);
    else if (document.querySelector('#phone-overlay:not([hidden])') && !phone.educationMessage(reason))
      phone.billingMessages([reason]);
    deliverySequence = null;
    locationUI.reject();
    if (!authEl.hidden || reason.includes('Неверный код') || reason.includes('уже занят на другом устройстве')) {
      authEl.hidden = false;
      active = null;
      gameAudio.setPlaying(false);
      mapBtn.disabled = true;
      phoneBtn.disabled = true;
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
      invites.close();
      socialInvite.clear();
      phone.refreshRelationship();
      feedback.clear();
      locationUI.reject();
      locationUI.close();
      locationUI.closeMap();
    }
    if (!authEl.hidden) authStatusEl.textContent = text;
    statusEl.textContent = text;
  },
});
const furnishing=createFurnishingUI(
  document.querySelector<HTMLElement>('#furnishing-overlay')!,
  document.querySelector<HTMLElement>('#furnishing-placement')!,{
    read:()=>state,
    minute:()=>displayClock.read(performance.now()),
    send:command=>net.furnishing(command),
    start:(item,rotation)=>{
      actionsEl.hidden=true;
      world.beginFurnishingPlacement(item.sku,item.finish,rotation);
    },
    rotate:rotation=>world.turnFurnishingPlacement(rotation),
    preview:valid=>world.setFurnishingValidity(valid),
    cancel:()=>world.endFurnishingPlacement(),
    message:notify,
    useBed:id=>openPurchasedBedActions(id),
    useFurniture:id=>openPurchasedFurnitureActions(id),
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

function openSocialActions(target:CharacterId,group:SocialGroup='talk',action?:string):void{
  if(!active||!state||!net.isReady()){notify('Сначала войди в дом');return;}
  if(target===active)return;
  locationUI.close();
  showActionMenu('♡ Вместе с '+names[target]);
  const current=tasks.get(active),partner=tasks.get(target);
  if(world.place==='park'&&current?.paired&&partner?.paired&&current.since!==null&&partner.since!==null&&['picnic','parkSwing'].includes(SOCIAL_BY_ID.get(current.paired.action)?.object??'')&&current.paired.action===partner.paired.action){
    const me=active;
    const note=document.createElement('p');note.textContent='Разговаривайте, не прерывая отдых.';actionsEl.append(note);
    for(const topic of PARK_TALK_TOPICS.filter(t=>contextAvailable(t,state!,me))){const b=document.createElement('button');b.type='button';b.className='action-button';b.textContent=topic.title;b.onclick=()=>{if(net.social({type:'social_propose',action:topic.id}))actionsEl.hidden=true;};actionsEl.append(b);}
    return;
  }
  const busy=tasks.has(active)||tasks.has(target)?'Кто-то сейчас занят другим действием':undefined;
  if(online.includes(target)&&!tasks.has(active)&&tasks.get(target)?.isCooking){
    const join=document.createElement('button');
    join.type='button';join.className='action-button';join.dataset.socialJoin='';
    join.textContent='Предложить помощь с готовкой';
    join.addEventListener('click',()=>{if(net.social({type:'social_propose',action:'joinCook'}))actionsEl.hidden=true;});
    actionsEl.append(join);
  }
  showSocialMenu(actionsEl,state,active,online.includes(target),busy,command=>net.social(command),group,action);
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

function openPetBowlActions(pet: PetId): void {
  locationUI.close();
  if (!active || !state || !net.isReady()) return notify('Сначала войди в общий дом');
  const spec = PETS[pet];
  const servings = state.petBowls[pet];
  const fillings = state.petFood[pet];
  const station=feedingStation(state.furnishing,pet),reserve=feederReserve(state.pets[pet]).length,capacity=station.model?.capacity??0;
  showActionMenu('🥣 '+(station.model?.name??'Миска')+' · '+spec.name);
  const note = document.createElement('p');
  note.className = 'pet-note';
  note.textContent = 'В миске: ' + servings + '/' + PET_BOWL_CAPACITY + ' порции · в запасе: ' + fillings +
    ' насыпаний · пачка за ' + spec.foodPrice + ' ₽ даёт ' + PET_FOOD_REFILLS_PER_PACK +
    ' насыпаний по ' + PET_BOWL_CAPACITY + ' порции.';
  actionsEl.append(note);
  if(capacity||reserve){const status=document.createElement('p');status.className='pet-note';status.textContent='Сухой корм в бункере: '+reserve+'/'+(capacity||'снята с установки')+' насыпаний · '+(capacity?'выдаётся автоматически':'доступен при ручном кормлении');actionsEl.append(status);}
  if(capacity){const load=document.createElement('button');load.className='food-action pet-action';load.textContent='Заполнить кормушку · '+Math.max(0,capacity-reserve)+' мест';load.disabled=reserve>=capacity||dryRefills(state,pet)<=0;load.onclick=()=>{if(net.petAction(pet,'loadFeeder'))actionsEl.hidden=true;};actionsEl.append(load);}
  const refill = document.createElement('button');
  refill.type='button';
  refill.className='food-action pet-action';
  refill.disabled=servings>0 || fillings+reserve<1;
  const name=document.createElement('strong');
  name.textContent='🥣 Насыпать корм · +' + PET_BOWL_CAPACITY + ' порции';
  const hint=document.createElement('small');
  hint.textContent=servings>0 ? 'В миске ещё есть корм — дождись, когда питомец доест.'
    : fillings+reserve<1 ? 'Корм закончился — купи пачку в магазине или в меню питомца.'
    : '−1 насыпание из семейных запасов. Питомец сам подойдёт при сытости 40% и ниже.';
  refill.append(name,hint);
  refill.addEventListener('click',()=>{
    if(net.petAction(pet,'feed')) {actionsEl.hidden=true;statusEl.textContent='Насыпаем корм в миску…';}
  });
  actionsEl.append(refill);
}

function addBedSleepActions(furnitureId?:number):void{
  if(!state||!active)return;
  const sleeping=timeStatus.sleepers[active];
  if(sleeping){
    const wake=document.createElement('button');
    wake.type='button';wake.className='action-button';wake.textContent='☀️ Проснуться';
    wake.addEventListener('click',()=>{if(net.stopSleep())actionsEl.hidden=true;});
    actionsEl.append(wake);
    return;
  }
  for(const [mode,target,label] of [
    ['full',100,'🌙 Спать до 100% · ×2'],
    ['half',50,'💤 Отдых до 50% · ×3'],
  ] as const){
    const button=document.createElement('button');
    button.type='button';button.className='action-button';button.textContent=label;
    button.disabled=state.characters[active].energy>=target;
    button.addEventListener('click',()=>{
      if(net.startSleep(mode,furnitureId))actionsEl.hidden=true;
    });
    actionsEl.append(button);
  }
  const guide=document.createElement('p');
  guide.className='sleep-speed-condition';
  guide.textContent=online.length>1
    ? '⏩ Ускорение ×2 или ×3 включится, когда оба игрока в сети будут спать. Если режимы отличаются — ×2.'
    : '⏩ Ускорение ×2 / ×3 включается автоматически при начале сна.';
  actionsEl.append(guide);
}
function openPurchasedBedActions(id:number):void{
  if(!state||!active||!net.isReady())return;
  const item=state.furnishing.placed.find(row=>row.id===id);
  if(!item||!isSleepBed(item))return;
  const info=FURNITURE_BY_ID.get(item.sku)!;
  furnishing.close();
  showActionMenu('🛏️ '+info.name);
  const note=document.createElement('p');
  note.className='food-empty';
  note.textContent=info.width>=1.55&&info.shape==='bed'
    ?'Двуспальная: Влад и Алина могут отдыхать одновременно.'
    :'Одно спальное место: второй персонаж должен выбрать другую кровать.';
  actionsEl.append(note);
  addBedSleepActions(id);
  const edit=document.createElement('button');
  edit.type='button';edit.className='action-button';
  edit.textContent='🛠️ Переместить или продать кровать';
  edit.addEventListener('click',()=>{actionsEl.hidden=true;furnishing.selectPlaced(id);});
  actionsEl.append(edit);
}
function openPurchasedFurnitureActions(id:number):void{
  if(!state||!active||!net.isReady())return;
  const item=state.furnishing.placed.find(row=>row.id===id);
  if(!item)return;
  const feeder=feederModel(item.sku);if(feeder&&feedingStation(state.furnishing,feeder.pet).item?.id===id){furnishing.close();openPetBowlActions(feeder.pet);const manage=document.createElement('button');manage.className='action-button';manage.textContent='Переставить или продать';manage.onclick=()=>{actionsEl.hidden=true;furnishing.selectPlaced(id);};actionsEl.append(manage);return;}
  if(isSleepBed(item)){openPurchasedBedActions(id);return;}
  const info=FURNITURE_BY_ID.get(item.sku);
  if(!info)return;
  const supported=availableFurnitureActions(state,active,item);
  if(!supported.length){furnishing.selectPlaced(id);return;}
  furnishing.close();
  showActionMenu(info.emoji+' '+info.name);
  const detail=document.createElement('p');
  detail.className='food-empty';
  detail.textContent='Действия доступны на этом предмете в его текущем расположении.';
  actionsEl.append(detail);
  const send=(action:FurnitureUseAction,extra?:{book?:import('./shared/homeLife').BookId;genre?:import('./shared/homeLife').Genre})=>{
    const ok=net.furnitureUse({type:'furniture_use',furnitureId:id,action,...extra});
    if(ok)actionsEl.hidden=true;
  };
  const chooseMovie=()=>{
    showActionMenu('🎬 Выбери жанр фильма');
    for(const [genre,label] of Object.entries(GENRES) as [import('./shared/homeLife').Genre,string][]){
      const b=document.createElement('button');
      b.type='button';b.className='action-button';b.textContent=label;
      b.addEventListener('click',()=>send('movie',{genre}));
      actionsEl.append(b);
    }
  };
  const chooseBook=()=>{
    showActionMenu('📚 Выбери книгу');
    for(const [book,details]of Object.entries(BOOKS) as [import('./shared/homeLife').BookId,readonly [string,string,string,number,string]][]){
      const b=document.createElement('button');
      b.type='button';b.className='action-button';b.textContent=details[0];
      b.addEventListener('click',()=>send('read_book',{book}));
      actionsEl.append(b);
    }
  };
  for(const action of (isNotebookDesk(item.sku)?[]:supported)){
    const b=document.createElement('button');
    b.type='button';b.className='action-button';b.textContent=FURNITURE_ACTIONS[action];
    b.addEventListener('click',()=>action==='movie'?chooseMovie():action==='read_book'?chooseBook():send(action));
    actionsEl.append(b);
  }
  if(info.shape==='table'&&info.height>=.63){
    showFoodChoices(actionsEl,'table',state,(type:FoodCommand,recipe)=>{
      const ok=type==='store'
        ? net.world({type:'ready_food_move',kind:'meal',item:recipe})
        : net.food(type,recipe,type==='eat'?id:undefined);
      if(ok)actionsEl.hidden=true;
      return ok;
    }, active!);
    showTakeoutChoices(actionsEl,state,product=>{
      const ok=net.eatTakeout(product,id);
      if(ok)actionsEl.hidden=true;
      return ok;
    },product=>{
      const ok=net.world({type:'ready_food_move',kind:'takeout',item:product});
      if(ok)actionsEl.hidden=true;
      return ok;
    });
  }
  if(info.shape==='desk'){
    const pc=document.createElement('button');
    pc.type='button';pc.className='action-button';pc.textContent=isNotebookDesk(item.sku)?'💻 Открыть ноутбук':'💻 Открыть стационарный компьютер';
    pc.addEventListener('click',()=>{
      if(isNotebookDesk(item.sku)){const host=state?.furnishing.placed.find(p=>isNotebookDesk(p.sku));if(host?.id!==id){notify('Ноутбук установлен на другом столе');return;}openComputer('laptop');return;}
      if(!state?.furnishing.soldFixtures?.includes('desk')){notify('Сначала продай старый рабочий стол, чтобы перенести ПК');return;}
      const host=state.furnishing.placed.find(p=>FURNITURE_BY_ID.get(p.sku)?.shape==='desk'&&!isNotebookDesk(p.sku));
      if(host?.id!==id){notify('ПК установлен на другом столе');return;}
      openComputer('desktop',id);
    });
    actionsEl.append(pc);
  }
  const edit=document.createElement('button');
  edit.type='button';edit.className='action-button';edit.textContent='🛠️ Переместить, убрать или продать';
  edit.addEventListener('click',()=>{actionsEl.hidden=true;furnishing.selectPlaced(id);});
  actionsEl.append(edit);
}
/** Every physical computer starts a new desktop view, not the prior overlay. */
function openComputer(device:import('./shared/computer').ComputerDevice,furnitureId?:number):void {
  if(!active||!state||!net.isReady())return;
  actionsEl.hidden=true;phone.close();skillsPanel.close();furnishing.close();
  locationUI.close();locationUI.closeMap();toggleNeeds(false);
  if(device==='desktop'){
    selectedDesktopFurnitureId=furnitureId??null;
    if(furnitureId!==undefined)world.focusDesktopFurniture(furnitureId);
  }
  computer.open(device);
}
function openActions(item: ItemId): void {
  locationUI.close();
  if (!active || !net.isReady()) {
    notify('Сначала войди в дом');
    return;
  }
  if (item === 'desk') { openComputer('desktop'); return; }
  if(item==='delivery' && state) {
    actionsEl.hidden=true;
    phone.open('delivery');
    return;
  }
  if (item==='bookcase') { entertainmentMenu.library(); return; }
  showActionMenu((item === 'delivery' ? itemNames.delivery : objectNames[item]) +
    (item === 'kitchen' && state ? ' · 🥚 ' + state.pantry.eggs + ' · 🍞 ' + state.pantry.bread : ''));
  // On phone screens the cooking list must be the FIRST content after the
  // heading. General hints, washing dishes and collaboration follow below.
  if(state&&active&&(item==='kitchen'||item==='grill')){
    showFoodChoices(actionsEl,item,state,(type:FoodCommand,id)=>{
      if(type==='store')return false;
      const sent=net.food(type,id);
      if(sent){actionsEl.hidden=true;statusEl.textContent='Обрабатываем действие…';}
      return sent;
    },active);
  }
  const about=document.createElement('p');
  about.className='food-empty';
  about.textContent=HOME_OBJECT_DETAILS[item];
  actionsEl.appendChild(about);
  if (item === 'kettle') {
    const tea = document.createElement('button');
    tea.type = 'button';
    tea.className = 'action-button';
    tea.textContent = ACTIONS.kitchenTea.label;
    tea.addEventListener('click', () => {
      if (net.perform('kitchenTea')) {
        actionsEl.hidden = true;
        statusEl.textContent = '🍵 Завариваем чай…';
      }
    });
    actionsEl.append(tea);
    return;
  }
  if (state && (item === 'table' || item === 'yardTable' || item === 'kitchen')) {
    const quantity = item === 'table' ? state.dirtyDishes.table
      : item === 'yardTable' ? state.dirtyDishes.yardTable : dishCount(state.dirtyDishes);
    const note = document.createElement('p');
    note.className = 'food-empty';
    note.textContent = quantity > 0
      ? '🍽️ Грязная посуда: ' + quantity + ' шт. · можно помыть у кухонной раковины'
      : '✨ Грязной посуды нет';
    actionsEl.appendChild(note);
  }

  if(active&&['kitchen','table','yardTable','grill','sofa','tv','bookcase'].includes(item)){
    const together=document.createElement('button');
    together.type='button';together.className='action-button';
    together.textContent='♡ Предложить сделать вместе';
    together.addEventListener('click',()=>{
      if(!active)return;
      const id=item==='kitchen'?'cook':item==='grill'?'grill':item==='table'||item==='yardTable'?'eat':item==='sofa'?'sofaTalk':item==='tv'?'tv':'read';
      openSocialActions(otherPerson(active),item==='sofa'?'care':item==='tv'?'fun':'home',id);
    });
    actionsEl.append(together);
  }
  if (state && (item === 'delivery' || item === 'table' || item === 'yardTable')) {
    showFoodChoices(actionsEl, item, state, (type: FoodCommand, id) => {
      const sent = type==='store'
        ? net.world({type:'ready_food_move',kind:'meal',item:id})
        : net.food(type, id);
      if (sent) {
        actionsEl.hidden = true;
        statusEl.textContent = 'Обрабатываем действие…';
      }
      return sent;
    }, active);
  }

  if ((item === 'kitchen' || item === 'coffeeMaker') && state && active) {
    showCoffeeChoices(actionsEl, state, active, blend => {
      const sent = net.brewCoffee(blend);
      if (sent) { actionsEl.hidden = true; statusEl.textContent = '☕ Готовим кофе…'; }
      return sent;
    });
  }

  if (item === 'table' && state) {
    showTakeoutChoices(actionsEl,state,(id)=>{
      const sent=net.eatTakeout(id);
      if(sent) actionsEl.hidden=true;
      return sent;
    },(id)=>{
      const sent=net.world({type:'ready_food_move',kind:'takeout',item:id});
      if(sent)actionsEl.hidden=true;
      return sent;
    });

  }
  if (item === 'bed' && state && active) addBedSleepActions();
  if (item==='tv'||item==='sofa') entertainmentMenu.television();
  if (item === 'table') {
    const study = document.createElement('button');
    study.type = 'button';
    study.className = 'action-button';
    study.textContent = '🎓 Учебная практика';
    study.addEventListener('click', () => openEducation('practice'));
    actionsEl.append(study);
  }
  if (item==='sofa'||item==='officeChair') {
    const books=document.createElement('button');
    books.type='button'; books.className='action-button'; books.textContent='📚 Выбрать книгу';
    books.addEventListener('click', () => entertainmentMenu.library(item === 'officeChair' ? 'officeChair' : undefined));
    actionsEl.append(books);
  }
  for (const [actionId, definition] of Object.entries(ACTIONS)) {
    if (definition.item !== item) continue;
    if (['bedSleep','bedNap','sofaMovie','sofaRead','watchTv','tvMusic'].includes(actionId)) continue;
    if ('role' in definition && definition.role !== active) continue;
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'action-button';
    const now=state?gameMinutes(state.clock):0;
    const freshTable=state?.readyFood.filter(b=>b.storage==='table'&&b.expiresAt>now)
      .reduce((total,b)=>total+b.portions,0)??0;
    const freshFridge=state?.readyFood.filter(b=>b.storage==='fridge'&&b.expiresAt>now)
      .reduce((total,b)=>total+b.portions,0)??0;
    button.textContent = actionId === 'kitchenDishes' && state
      ? definition.label + ' · ' + dishCount(state.dirtyDishes) + ' шт.' :
      actionId==='kitchenLeftovers' ? definition.label+' · '+freshTable+' на столе' :
      actionId==='kitchenServe' ? definition.label+' · '+freshFridge+' в холодильнике' : definition.label;
    if (actionId === 'kitchenDishes') button.disabled = !state || dishCount(state.dirtyDishes) === 0;
    if (actionId === 'kitchenLeftovers') button.disabled = !state||!freshTable||
      storageUsage(state).fridge>=FRIDGE_CAPACITY;
    if (actionId === 'kitchenServe') button.disabled = !state||!freshFridge||
      readyFoodTableUsage(state)>=TABLE_READY_CAPACITY;
    button.addEventListener('click', () => {
      actionsEl.hidden = true;
      const denial = state && taskAccessError(state, {type:'act', actionId:actionId as ActionId});
      if (denial) {
        phone.open(actionId === 'sofaCall' || actionId === 'sofaScroll' || actionId === 'tableTalk' ? 'mobile' : 'internet');
        phone.billingMessages([denial]);
        notify(denial);
        return;
      }
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
    const simbaModel=import('./game/SimbaRig').then(({loadSimbaRig})=>loadSimbaRig()).catch(error=>{
      console.warn('Не удалось загрузить модель Симбы',error);
      return undefined;
    });
    const characters = useBlender ? await import('./game/BlenderCharacter')
      .then(async ({ loadResidents }) => {
        const look=new URLSearchParams(location.search).get('outfit')??'signature';
        const { outfitChoices }=await import('./game/Wardrobe');
        return loadResidents(look==='tee'?['alina-tee-upper']:outfitChoices(look));
      })
      .catch((err: unknown) => {
        console.warn('Не удалось загрузить Blender-модели. Используем встроенные.', err);
        return {};
      }) : {};
    const simbaRig = await simbaModel;
    const modelsReadyMs = performance.now();
    world = new World(canvas, (id) => {
      if (id === 'vlad' || id === 'alina') openSocialActions(id);
      else if (id === 'verdell' || id === 'simba') openPetActions(id);
      else if (id === 'bowl:verdell' || id === 'bowl:simba') openPetBowlActions(id.slice(5) as PetId);
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
        locationUI.cancelRoute();
        actionsEl.hidden = true;
        locationUI.close(); locationUI.closeMap();
        if (world.place === 'home' && id === HOME_LAPTOP) {
          openComputer('laptop');
          return;
        }
        if (stationById(world.place,id)?.action.kind==='career') {
          const shift=state?.careers.residents[active].shift;
          const task=shift?.task;
          if (shift&&task?.phase==='new') {
            const event=WORK_EVENT_BY_ID.get(task.event)!;
            const expected=shift.mode==='remote'?HOME_LAPTOP:event.station;
            if(id===expected) net.career({type:'career_approach',nonce:task.nonce});
            else notify('Текущее поручение · '+CAREERS[shift.career].stations[event.station]);
          } else if (!shift) phone.open('career');
          return;
        }
        if(world.place==='home'&&id==='fridge'){
          const fridge=stationById('home','fridge');
          if(fridge)locationUI.visit(fridge);
          return;
        }
        const seated=state&&cafeSeatAt(state,active);
        if(seated?.id===id){locationUI.visit(seated);return;}
        net.world({ type: 'approach', place: world.place, station: id });
      },
      dismissTap() {
        if(!actionsEl.hidden){actionsEl.hidden=true;return true;}
        if(!locationPanel.hidden){locationUI.close();return true;}
        if(!showcaseChoices.hidden){showcaseChoices.hidden=true;return true;}
        return false;
      },
      pondTap() { notify('Пруд можно обойти по берегу'); },
      ground(x, z) {
        if (!active) return;
        locationUI.cancelRoute();
        if (net.world({ type: 'walk', place: world.place, x, z })) {
          actionsEl.hidden = true;
          locationUI.close();
          locationUI.closeMap();
        }
      },
    }, simbaRig);
    world.setFurnishingPick((x,z)=>furnishing.setTarget(x,z),id=>{
      const model=state?.furnishing.placed.find(item=>item.id===id);
      if(model&&isSleepBed(model))openPurchasedBedActions(id);
      else if(model&&furnitureActionList(model).length)openPurchasedFurnitureActions(id);
      else furnishing.selectPlaced(id);
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
    mapBtn.addEventListener('click', () => { actionsEl.hidden = true; phone.close(); locationUI.openMap(); });
    phoneBtn.addEventListener('click', () => {
      actionsEl.hidden = true;
      computer.close();
      toggleNeeds(false);
      locationUI.close();
      locationUI.closeMap();
      phone.open();
    });
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
    showStatus('Подключаемся к дому…');
    try{
      const health=await fetch('/health',{cache:'no-store'});
      if(health.ok){
        const config=await health.json() as {testNoCodes?:boolean};
        localPreviewNoCodes=config.testNoCodes===true;
        if(localPreviewNoCodes){
          accessInput.required=false;
          document.querySelector<HTMLLabelElement>('label[for="access-code"]')!.hidden=true;
          accessInput.hidden=true;
          document.querySelector<HTMLElement>('.remember-device')!.hidden=true;
          document.querySelector<HTMLButtonElement>('.enter-button')!.textContent='Войти без кода';
          authStatusEl.textContent='Выбери героя, чтобы вернуться домой';
        }else authStatusEl.textContent='Выбери персонажа и введи личный код';
      }
    }catch{authStatusEl.textContent='Выбери персонажа и введи личный код';}
    const remembered = localPreviewNoCodes?null:trustedDevice();
    if (remembered) net.resume(remembered.role, remembered.token);
  } catch (error) {
    console.error(error);
    showStatus('Не удалось открыть игру. Попробуй обновить страницу или использовать другой браузер.');
  }
}

document.querySelector<HTMLFormElement>('#auth-form')!.addEventListener('submit', (event) => {
  event.preventDefault();
  if (!world) return;
  const code = localPreviewNoCodes?'TEST-LOCAL-NO-CODES':accessInput.value.trim();
  if (!localPreviewNoCodes && code.length < 12) { authStatusEl.textContent = 'Введи полный код персонажа'; return; }
  net.login(selectedRole, code, rememberDevice.checked);
});
/** Android Back / iOS browser Back dismisses gameplay UI before leaving.
 * UI order is deliberately explicit: nested phone screen -> phone home -> world.
 */
installMobileBack({
  root:app,
  isOpen:()=>authEl.hidden && (
    !document.querySelector<HTMLElement>('#pause-sheet')!.hidden ||
    !document.querySelector<HTMLElement>('#phone-overlay')!.hidden ||
    !document.querySelector<HTMLElement>('#computer-overlay')!.hidden ||
    !document.querySelector<HTMLElement>('#skills-overlay')!.hidden ||
    !document.querySelector<HTMLElement>('#furnishing-overlay')!.hidden ||
    !document.querySelector<HTMLElement>('#furnishing-placement')!.hidden ||
    !marketOverlay.hidden || !jobsOverlay.hidden || !mapPanel.hidden ||
    !locationPanel.hidden || !needsPanelEl.hidden || !actionsEl.hidden ||
    !showcaseChoices.hidden || !showcaseReturn.hidden
  ),
  closeTop:()=>{
    const visible=(selector:string)=>!document.querySelector<HTMLElement>(selector)!.hidden;
    if(visible('#pause-sheet')){notify('Пауза общая · для продолжения нажми ▶');return;}
    if(visible('#furnishing-placement')||visible('#furnishing-overlay')){furnishing.close();return;}
    if(visible('#phone-overlay')){phone.back();return;}
    if(visible('#computer-overlay')){computer.close();return;}
    if(visible('#skills-overlay')){skillsPanel.close();return;}
    if(visible('#market-overlay')){marketUI.close();return;}
    if(visible('#jobs-overlay')){jobsUI.close();return;}
    if(visible('#map-panel')){locationUI.closeMap();return;}
    if(visible('#location-panel')){locationUI.close();return;}
    if(visible('#needs-panel')){toggleNeeds(false);return;}
    if(!actionsEl.hidden){actionsEl.hidden=true;return;}
    if(!showcaseChoices.hidden){showcaseChoices.hidden=true;return;}
    if(!showcaseReturn.hidden){focusModel(null);return;}
  }
});

void initializeWorld(app);

document.querySelector<HTMLButtonElement>('#pause-btn')!.addEventListener('click', () => net.togglePause());
