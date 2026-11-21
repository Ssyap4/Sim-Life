import {
  CAREERS, CAREER_STATIONS, CLINIC_MODULES, DETAIL_SERVICES, dayOf, initialCareers, isCareer, isCareerPlace,
  newCareerProgress, shiftWindow, type CareerProgress, type CareerShift, type CareersState,
} from '../src/shared/careers';
import { CAREER_STORIES, WORK_CHECKS, WORK_EVENTS, WORK_EVENT_BY_ID, type CareerChoice, type CareerEvent } from '../src/shared/careerCatalog';
import { promotionNeeds } from '../src/shared/careerPromotion';
import { missingKnowledge, skillRank } from '../src/shared/education';
import { addLedger, formatRub } from '../src/shared/economy';
import { floorFor, HOME_LAPTOP, placeObstacles, spawn, stationById, type Point } from '../src/shared/locations';
import { computerDevice } from '../src/shared/computer';
import { points } from '../src/shared/protocol';
import { HOME_WALK_SPEED } from '../src/shared/home';
import { GAME_MINUTES_PER_REAL_SECOND } from '../src/shared/life';
import type { GameState, CharacterId } from '../src/shared/protocol';
import { serviceAvailable } from '../src/shared/services';
import { findRoute, nearestClearPoint } from '../src/game/navigation';
import { unoccupiedDestination } from '../src/game/residentCollision';
import { practiceXP } from './education';

export const careerCommands = new Set(['career_hire','career_resign','career_start','career_leave','career_overtime','career_promote','career_approach','career_choose','career_verify']);
const roles = ['vlad','alina'] as const;
const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)));
const UNPAID = 30;
const COOLDOWN = 7;
const TASK_WINDOW = 72;
const taskCap = (p: CareerProgress) => p.rank >= 3 ? 6 : p.rank >= 1 ? 5 : 4;
const workplace = (p: CareerProgress) =>
  p.workplace ??= { trust:50, backlog:0, improvements:0, recoveries:0 };

function journal(state: GameState, p: CareerProgress, at: number, title: string, text: string,
  extra: { choice?: string; author?: number; pay?: number; bonus?: number } = {}) {
  p.history.push({ id: state.careers.nextId++, at, title, text, ...extra });
  if (p.history.length > 60) p.history.shift();
}

function atDesk(shift: CareerShift): string {
  const event = shift.task && WORK_EVENT_BY_ID.get(shift.task.event);
  return shift.mode === 'remote' ? HOME_LAPTOP : event ? event.station : 'desk';
}

function settle(state: GameState, role: CharacterId, now: number, early: boolean) {
  const r = state.careers.residents[role];
  const shift = r.shift!;
  const p = r.progress[shift.career]!;
  const [, base] = CAREERS[shift.career].roles[p.rank];
  const duration = CAREERS[shift.career].hours * 60;
  const until = Math.min(now, shift.endsAt);
  const worked = Math.max(0, until - shift.startedAt);
  const regular = Math.max(0, Math.min(until, shift.regularEnd) - shift.startedAt);
  const extra = Math.max(0, until - shift.regularEnd);
  const pay = worked < UNPAID ? 0 : Math.floor(base * (regular + 1.25 * extra) / duration);
  const productivity = clamp(shift.completed ? shift.score / shift.completed * Math.min(1, shift.completed / 3) - 6 * shift.missed : 0);
  const bonus = early || !pay || productivity < 76 ? 0 : Math.round(pay *
    ((productivity >= 90 ? .14 : .08) +
      (p.workplace && p.workplace.improvements >= 3 && p.workplace.backlog === 0 ? .02 : 0)));
  state.money += pay + bonus;
  if (pay) addLedger(state, role, 'income', 'work', pay, CAREERS[shift.career].employer + (early ? ' · досрочный уход' : ' · зарплата'));
  if (bonus) addLedger(state, role, 'income', 'work', bonus, CAREERS[shift.career].employer + ' · премия');
  p.productivity = productivity;
  if (worked >= UNPAID) {
    p.shifts++;
    p.experience += 1 + Math.floor(shift.completed / 2);
    if (productivity >= 62 && worked >= duration / 2) p.qualityShifts++;
  }
  p.reputation = clamp(p.reputation + (early ? -2 : productivity >= 75 ? 3 : shift.missed ? -1 : 0));
  const explanation = 'Отработано ' + worked + ' мин · продуктивность ' + productivity + '% · зарплата ' + formatRub(pay) +
    (bonus ? ' · премия ' + formatRub(bonus) : worked < UNPAID ? ' · первые 30 минут не оплачиваются' : '');
  journal(state, p, now, early ? 'Досрочный уход' : 'Смена завершена', explanation, { pay, bonus });
  const character = state.characters[role];
  character.energy = clamp(character.energy - Math.round(Math.min(1, worked / duration) * 12));
  r.shift = null;
  if (shift.mode === 'office') {
    const partnerRole = role === 'vlad' ? 'alina' : 'vlad';
    const partner = state.world.places[partnerRole] === 'street' ? state.characters[partnerRole] : undefined;
    const entry = spawn('street', role);
    Object.assign(character, partner ? unoccupiedDestination(entry, partner, placeObstacles('street'), floorFor('street')) ?? entry : entry);
    state.world.places[role] = 'street';
  }
  character.pose = 'idle';
  return explanation;
}

function nextTask(state: GameState, online: boolean, role: CharacterId, now: number) {
  const owner = state.careers.residents[role];
  const shift = owner.shift;
  if (!shift || !online || shift.task || now < shift.nextTaskAt || now > shift.endsAt - 33) return;
  const p = owner.progress[shift.career]!;
  if (shift.completed + shift.missed >= taskCap(p) + Number(shift.overtime)) return;
  const id = shift.career;
  const stories = CAREER_STORIES[id];
  const openStory = stories.find(story => p.stories[story.id]?.stage < story.events.length);
  const nextStory = stories.find(story => !p.stories[story.id] && p.shifts >= 1 + stories.indexOf(story) * 4);
  const story = openStory ?? nextStory;
  const progress = story && (p.stories[story.id] ?? { stage:0, nextShift:0, outcome:0 });
  let event: CareerEvent | undefined;
  let storyId: string | undefined;
  if (shift.completed + shift.missed === 0 && p.rank < 4 && !p.evaluation && !promotionNeeds(state, role, id, p).missing.length) {
    event = WORK_EVENT_BY_ID.get(id + '-review');
  } else if (id === 'clinic' && p.rank >= 1 && p.clinicModules < CLINIC_MODULES.length &&
      shift.completed + shift.missed === 0 && p.qualityShifts >= 2 + p.clinicModules) {
    event = WORK_EVENT_BY_ID.get('clinical-' + p.clinicModules);
  } else if (story && progress && progress.nextShift <= p.shifts && shift.completed + shift.missed <= 1) {
    event = WORK_EVENT_BY_ID.get(story.events[progress.stage]);
    storyId = story.id;
  } else if (id === 'detail' && p.orders.some(order => !order.delivered && order.readyAt <= now)) {
    event = WORK_EVENT_BY_ID.get('detail-handover');
  } else if (shift.completed + shift.missed === 0 &&
      (p.workplace?.backlog ?? 0) >= 3 &&
      (!p.seen[id+'-recovery'] || shift.day + 1 - p.seen[id+'-recovery'] >= 2)) {
    event = WORK_EVENT_BY_ID.get(id+'-recovery');
  } else if (shift.completed + shift.missed === 0 &&
      (p.workplace?.improvements ?? 0) >= 3 && (p.workplace?.trust ?? 50) >= 65 &&
      (!p.seen[id+'-recognition'] || shift.day + 1 - p.seen[id+'-recognition'] >= 3)) {
    event = WORK_EVENT_BY_ID.get(id+'-recognition');
  } else {
    const options = WORK_EVENTS[id].filter(item => item.rank <= p.rank &&
      (!p.seen[item.id] || shift.day + 1 - p.seen[item.id] >= COOLDOWN));
    event = options.sort((a,b) => (p.seen[a.id] ?? -1) - (p.seen[b.id] ?? -1) ||
      (p.shifts ? b.rank-a.rank : 0))[0];
  }
  if (!event) return;
  shift.task = { nonce:state.careers.nextId++, event:event.id, phase:'new', readyAt:now, deadline:Math.min(shift.endsAt,now+TASK_WINDOW),
    ...(storyId ? { story:storyId } : {}) };
  if (!storyId && !event.effect?.startsWith('clinical')) p.seen[event.id] = shift.day + 1;
}

function applyEffect(state: GameState, p: CareerProgress, event: CareerEvent, choice: CareerChoice, now: number, quality: number) {
  if (event.effect === 'booking' && choice.service) {
    const service = DETAIL_SERVICES[choice.service];
    const bayEnd = ([1,2] as const).map(bay => Math.max(now, ...p.orders.filter(x => x.bay === bay && !x.delivered).map(x => x.readyAt)));
    const bay = bayEnd[0] <= bayEnd[1] ? 1 : 2;
    p.orders.push({ service:choice.service, bay, agreed:Math.round(service.price * (1-(choice.discount ?? 0)/100)),
      readyAt:bayEnd[bay-1]+service.minutes, delivered:false, loyalty:quality });
    if (p.orders.length > 16) p.orders.shift();
    return ' Пост ' + bay + ' добавлен в график.';
  }
  if (event.effect === 'handover') {
    const order = p.orders.find(x => !x.delivered && x.readyAt <= now);
    if (order) { order.delivered = true; order.loyalty = clamp((order.loyalty+quality)/2); return ' Оценка клиента ' + order.loyalty + '%.'; }
  }
  if (event.effect === 'campaign') {
    const budget = choice.minutes > 15 ? 1600 : 1100;
    const reach = Math.round(budget * (4 + quality/40));
    const engagement = Math.round(reach * quality / 1500);
    const leads = Math.round(engagement * quality / 800);
    p.campaign = { budget, reach, engagement, leads };
    return ' Кампания принесла ' + leads + ' заявок при бюджете ' + formatRub(budget) + '.';
  }
  if (event.effect === 'patient') {
    const record = p.clinic ??= { reference:state.careers.nextId++, observations:0, reviewed:false };
    record.observations++;
    record.reviewed = quality >= 85;
  }
  if (event.effect === 'clinical' && choice.quality >= 85) {
    p.clinicModules++;
    return p.clinicModules === CLINIC_MODULES.length ? ' Выдана игровая квалификация «Клинический практикум».' : ' Учебный модуль зачтён.';
  }
  if (event.effect === 'evaluation') p.evaluation = choice.quality >= 90;
  if (event.effect === 'recovery') {
    const work = workplace(p);
    const cleared = quality >= 88 ? 3 : quality >= 75 ? 2 : 1;
    work.backlog = Math.max(0,work.backlog-cleared);
    work.recoveries++;
    return ' Снято незакрытых вопросов: ' + cleared + '.';
  }
  if (event.effect === 'recognition') {
    const work = workplace(p);
    work.trust = clamp(work.trust + 4);
    work.improvements = Math.max(0,work.improvements-2);
    return ' Благодарность команды внесена в историю работы.';
  }
  return '';
}

function advanceTask(state: GameState, role: CharacterId, now: number) {
  const owner = state.careers.residents[role], shift = owner.shift;
  const task = shift?.task;
  if (!shift || !task) return;
  const p = owner.progress[shift.career]!, event = WORK_EVENT_BY_ID.get(task.event)!;
  if (task.phase === 'walking' && now >= task.readyAt && now < task.deadline) {
    task.phase = 'ready';
    shift.station = event.station;
  }
  if (task.phase === 'working' && now >= task.readyAt && task.readyAt <= task.deadline) {
    const choice = event.choices[task.choice!];
    const work = workplace(p);
    const level = skillRank(state.education.characters[role].xp[event.skill]).level;
    // Past choices matter: a reliable team gets a small advantage, unresolved work
    // makes future tasks harder. No hidden random roll overrides a player decision.
    const quality = clamp(choice.quality - 9 * (task.attempts ?? 0) + Math.min(8, level) +
      (task.story ? Math.sign(p.stories[task.story]?.outcome ?? 0) * 3 : 0) +
      Math.trunc((work.trust-50)/24) - Math.min(6,work.backlog));
    shift.completed++;
    shift.score += quality;
    p.duties++;
    p.experience++;
    p.reputation = clamp(p.reputation + choice.reputation);
    practiceXP(state, role, 'career:' + event.id, event.skill, event.title, 10 + p.rank * 4 + Math.floor(quality / 20), 9 + p.rank * 2);
    const result = applyEffect(state,p,event,choice,task.readyAt,quality);
    if (event.effect !== 'recovery' && event.effect !== 'recognition') {
      work.trust = clamp(work.trust + (quality >= 90 ? 2 : quality >= 78 ? 1 : quality < 65 ? -3 : 0));
      if (quality >= 90 && !(task.attempts ?? 0)) work.improvements = Math.min(9999,work.improvements+1);
      if (quality < 70 || (task.attempts ?? 0) >= 2) work.backlog = Math.min(12,work.backlog+1);
      else if (quality >= 85) work.backlog = Math.max(0,work.backlog-1);
    }
    if (task.story) {
      const progress = p.stories[task.story] ??= { stage:0, nextShift:0, outcome:0 };
      progress.stage++; progress.nextShift = p.shifts + 1; progress.outcome += quality-75;
    }
    const proof = WORK_CHECKS[event.id] ? ' Проверено шагов: ' + WORK_CHECKS[event.id].length +
      (task.attempts ? ', понадобились ' + task.attempts + ' исправления.' : ', без исправлений.') : '';
    journal(state,p,task.readyAt,event.title,choice.result + result + proof + ' Оценка ' + quality +
      '%. Доверие ' + work.trust + '%, незакрытые вопросы ' + work.backlog + '.',
      { choice:choice.label,author:event.author });
  } else if (now >= task.deadline) {
    shift.missed++;
    const work = workplace(p);
    work.backlog = Math.min(12,work.backlog+1);
    work.trust = clamp(work.trust-2);
    journal(state,p,task.deadline,'Истёк срок · ' + event.title,
      'Поручение передано другой смене. В очереди незакрытых вопросов теперь ' + work.backlog + '.',{ author:event.author });
  } else return;
  delete shift.task;
  shift.nextTaskAt = Math.min(now, shift.endsAt) + 19;
}

export function advanceCareers(state: GameState, before: number, now: number, players: readonly CharacterId[]) {
  for (const role of roles) {
    const owner = state.careers.residents[role];
    if (owner.shift) {
      advanceTask(state, role, now);
      if (owner.shift.endsAt <= now) settle(state, role, owner.shift.endsAt, false);
      else nextTask(state, players.includes(role), role, now);
    }
    if (!owner.contract) continue;
    const { career, hiredAt } = owner.contract;
    const p = owner.progress[career]!;
    for (let day = dayOf(before); day <= dayOf(now); day++) {
      const window = shiftWindow(career, day);
      if (window.open && before < window.end && window.end <= now && hiredAt < window.start && owner.lastDay < day) {
        p.reputation = clamp(p.reputation - 2);
        journal(state,p,window.end,'Пропущенная смена','Рабочее окно завершилось. Ближайшая смена доступна по расписанию.');
      }
    }
  }
}

type Result = { ok:false; reason:string } | { ok:true; state:GameState; message:string; path?:Point[] };
const fail = (reason: string): Result => ({ ok:false, reason });

export function applyCareer(source: GameState, role: CharacterId, command: Record<string, unknown>, now: number,
  occupied = false, partnerOnline = false): Result {
  const state = structuredClone(source);
  const owner = state.careers.residents[role];
  const done = (message: string, path?: Point[]): Result => { state.revision++; return { ok:true, state, message, path }; };
  if (command.type === 'career_hire') {
    const id = command.career;
    if (!isCareer(id) || CAREERS[id].owner !== role) return fail('Эта вакансия доступна другому персонажу');
    if (owner.shift || state.activeShifts[role]) return fail('Сначала закончи текущую смену');
    if (owner.contract?.career === id) return fail('Контракт уже действует');
    const p = owner.progress[id] ??= newCareerProgress();
    owner.contract = { career:id, hiredAt:now };
    journal(state,p,now,'Трудовой договор',CAREERS[id].employer + ' · ' + CAREERS[id].roles[p.rank][0],{author:0});
    return done('Контракт подписан');
  }
  const contract = owner.contract;
  if (!contract) return fail('Выбери вакансию в телефоне');
  const id = contract.career, p = owner.progress[id]!, spec = CAREERS[id], shift = owner.shift;
  if (command.type === 'career_resign') {
    if (shift || state.activeShifts[role]) return fail('Сначала закончи смену');
    owner.contract = null;
    journal(state,p,now,'Контракт завершён','Должность и данные опыта сохранены.');
    return done('Контракт завершён');
  }
  if (command.type === 'career_promote') {
    if (shift || state.activeShifts[role]) return fail('Подай заявку вне смены');
    const needs = promotionNeeds(state, role, id, p);
    if (needs.missing.length) return fail(needs.missing.join(' · '));
    if (!p.evaluation) return fail('Пройди оценку руководителя на рабочей смене');
    p.rank++;
    p.evaluation = false;
    journal(state,p,now,'Повышение','Новая должность · ' + spec.roles[p.rank][0],{author:0});
    return done('Повышение утверждено');
  }
  if (command.type === 'career_start') {
    if (shift || occupied || state.activeShifts[role]) return fail('Заверши текущее действие или смену');
    const window = shiftWindow(id,dayOf(now));
    if (!window.open) return fail('По твоему расписанию сегодня выходной');
    if (owner.lastDay >= window.day) return fail('Сегодня уже была рабочая смена');
    if (now < window.start || now > window.end - 60) return fail('Приходи в рабочее окно, до конца должно остаться минимум 60 минут');
    if (state.characters[role].energy < 20 || state.characters[role].hunger < 15) return fail('Перед сменой нужны еда и отдых');
    if (window.mode === 'remote' && (state.world.places[role] !== 'home' || !serviceAvailable(state.billing,'internet',now)))
      return fail('Для удалённой смены нужно находиться дома и иметь действующий интернет');
    owner.shift = { id:state.careers.nextId++, career:id, mode:window.mode, day:window.day, startedAt:now, regularEnd:window.end,
      endsAt:window.end, late:Math.max(0,now-window.start), overtime:false, completed:0, missed:0, score:0, nextTaskAt:now };
    owner.lastDay = p.lastDay = window.day;
    if (owner.shift.late > 30) p.reputation = clamp(p.reputation - 2);
    if (window.mode === 'office') {
      state.world.places[role] = spec.place;
      Object.assign(state.characters[role],spawn(spec.place,role),{ pose:'idle' });
    }
    journal(state,p,now,'Смена открыта',(window.mode === 'remote' ? 'Удалённо из дома' : 'На рабочем месте') +
      (owner.shift.late > 30 ? ' · опоздание ' + owner.shift.late + ' мин' : ''),{author:0});
    nextTask(state,true,role,now);
    return done(window.mode === 'remote' ? 'Алина работает из дома' : 'Смена открыта · ' + spec.employer);
  }
  if (!shift) return fail('Активной смены нет');
  if (command.type === 'career_leave') {
    advanceTask(state,role,now);
    return done(settle(state,role,now,now < shift.endsAt));
  }
  if (command.type === 'career_overtime') {
    if (shift.overtime || now < shift.regularEnd - 90 || now >= shift.regularEnd || p.reputation < 55)
      return fail('Дополнительный час доступен при репутации от 55 и в последние полтора часа смены');
    shift.overtime = true;
    shift.endsAt += 60;
    journal(state,p,now,'Дополнительный час','В график добавлен 1 час с повышенной оплатой.',{author:0});
    return done('К смене добавлен час');
  }
  const task = shift.task;
  if (!task || task.nonce !== command.nonce || now >= task.deadline || now >= shift.endsAt) return fail('Поручение больше не активно');
  const event = WORK_EVENT_BY_ID.get(task.event)!;
  if (command.type === 'career_approach' && task.phase === 'new') {
    const place = state.world.places[role];
    if (command.device !== undefined && (!computerDevice(command.device) || shift.mode !== 'remote'))
      return fail('Неверное рабочее устройство');
    const device = computerDevice(command.device) ? command.device : 'laptop';
    const station = stationById(place, atDesk(shift));
    if (!station) return fail('Рабочее место сейчас недоступно');
    const target = shift.mode === 'remote' && device === 'desktop' ? points.desk : station.approach;
    const obstacles = placeObstacles(place,state.furnishing), floor = floorFor(place);
    const actor = state.characters[role], partnerRole = role === 'vlad' ? 'alina' : 'vlad';
    const partner = partnerOnline && state.world.places[partnerRole] === place ? state.characters[partnerRole] : undefined;
    const destination = partner ? unoccupiedDestination(target,partner,obstacles,floor) : target;
    const origin = nearestClearPoint(actor,obstacles,floor);
    const path = origin && destination ? findRoute(origin,destination,obstacles,floor) : null;
    if (!path || !destination) return fail('Освободи подход к рабочему месту');
    let point = origin!;
    const meters = path.reduce((sum,next) => { const length = Math.hypot(next.x-point.x,next.z-point.z); point = next; return sum + length; },0);
    task.readyAt = now + Math.ceil(meters / HOME_WALK_SPEED * GAME_MINUTES_PER_REAL_SECOND);
    task.phase = meters < .05 ? 'ready' : 'walking';
    if (task.phase === 'ready') shift.station = event.station;
    if (shift.mode === 'remote') shift.homeDevice = device;
    Object.assign(actor,destination,{pose:'idle'});
    return done('Подход к рабочему месту',path);
  }
  if (command.type === 'career_verify' && task.phase === 'checking') {
    const checks = WORK_CHECKS[event.id], step = task.checkStep ?? 0;
    const check = checks?.[step];
    const choice = event.choices[task.choice!];
    if (!check || !whole(command.step) || command.step !== step) return fail('Этап уже обработан. Обнови поручение');
    if (!whole(command.choice) || Number(command.choice) >= check.options.length) return fail('Выбери вариант проверки');
    if (now + choice.minutes > task.deadline) return fail('На этот вариант не хватит времени');
    if (shift.mode === 'remote' && !serviceAvailable(state.billing,'internet',now)) return fail('Нужен действующий домашний интернет');
    const correct = command.choice === check.answer;
    if (!correct) {
      task.attempts = (task.attempts ?? 0) + 1;
      task.hint = check.explanation;
      if (task.wrongAtStep !== step) {
        task.wrongAtStep = step;
        return done('В проверке найдено расхождение. ' + check.explanation);
      }
    }
    task.checkStep = step + 1;
    if (task.checkStep < checks.length) {
      task.hint = correct ? check.explanation : 'Напарник объяснил решение. ' + check.explanation;
      return done('Этап ' + (step + 1) + '/' + checks.length + ' проверен. ' + check.explanation);
    }
    task.hint = correct ? check.explanation : 'Понадобилась помощь коллеги. ' + check.explanation;
    task.phase='working'; task.readyAt=now+choice.minutes;
    return done(correct ? 'Контрольная проверка завершена. ' + check.explanation
      : 'Коллега помог устранить расхождение. ' + check.explanation);
  }
  if (command.type !== 'career_choose' || task.phase !== 'ready') return fail('Сначала подойди к рабочему месту');
  if (typeof command.choice !== 'number' || !Number.isInteger(command.choice) ||
      command.choice < 0 || command.choice >= event.choices.length) return fail('Выбери вариант решения');
  const choice = event.choices[command.choice];
  if (choice.requires && missingKnowledge(state.education.characters[role],choice.requires).length) return fail('Не хватает подготовки');
  if (now + choice.minutes > task.deadline) return fail('На этот вариант не хватит времени');
  if (shift.mode === 'remote' && !serviceAvailable(state.billing,'internet',now)) return fail('Нужен действующий домашний интернет');
  task.choice = command.choice;
  task.phase = WORK_CHECKS[event.id] ? 'checking' : 'working';
  task.readyAt = now + choice.minutes;
  return done(task.phase==='checking'?'Сверь рабочие данные перед выполнением':'Работа началась · ' + choice.label);
}

export function recoverCareers(state: GameState): boolean {
  let changed = false;
  state.careers ??= initialCareers();
  for (const role of roles) {
    const actor = state.careers.residents[role];
    const place = state.world.places[role], shift = actor.shift;
    if (shift && (state.activeShifts[role] || (shift.mode === 'office' ? place !== CAREERS[shift.career].place : place !== 'home'))) {
      actor.shift = null; changed = true;
    }
    if (isCareerPlace(place) && !actor.shift) {
      state.world.places[role] = 'street';
      Object.assign(state.characters[role],spawn('street',role),{pose:'idle'}); changed = true;
    }
  }
  return changed;
}

const whole = (n: unknown, min = 0) => typeof n === 'number' && Number.isSafeInteger(n) && n >= min;
export function validCareers(value: unknown): value is CareersState {
  if (!value || typeof value !== 'object') return false;
  const data = value as Partial<CareersState>;
  return whole(data.nextId,1) && roles.every(role => {
    const person = data.residents?.[role];
    if (!person || !whole(person.lastDay,-1) || !person.progress || Array.isArray(person.progress)) return false;
    if (person.contract !== null && (!person.contract || !isCareer(person.contract.career) ||
      CAREERS[person.contract.career].owner !== role || !whole(person.contract.hiredAt) || !person.progress[person.contract.career])) return false;
    for (const [id,p] of Object.entries(person.progress)) {
      if (!isCareer(id) || CAREERS[id].owner !== role || !p || !whole(p.rank) || p.rank > 4 ||
        ![p.shifts,p.qualityShifts,p.experience,p.reputation,p.productivity,p.duties,p.clinicModules].every(n=>whole(n)) ||
        !whole(p.lastDay,-1) || p.reputation > 100 || p.productivity > 100 || p.clinicModules > CLINIC_MODULES.length ||
        typeof p.evaluation !== 'boolean' || !p.seen || !p.stories || Object.values(p.seen).some(n => !whole(n)) ||
        !Array.isArray(p.history) || p.history.length > 60 || !p.history.every(h => h && whole(h.at) && whole(h.id,1) &&
          typeof h.title === 'string' && typeof h.text === 'string' && (h.pay===undefined || whole(h.pay)) &&
          (h.bonus===undefined || whole(h.bonus)) && (h.author===undefined || whole(h.author) && h.author<=2)) ||
        !Array.isArray(p.orders) || p.orders.length > 16 ||
        !p.orders.every(o => o && Object.hasOwn(DETAIL_SERVICES,o.service) && (o.bay===1 || o.bay===2) &&
          whole(o.agreed) && whole(o.readyAt) && typeof o.delivered==='boolean' && whole(o.loyalty))) return false;
      if (p.workplace !== undefined && (!p.workplace ||
        !whole(p.workplace.trust) || p.workplace.trust > 100 ||
        !whole(p.workplace.backlog) || p.workplace.backlog > 12 ||
        !whole(p.workplace.improvements) || p.workplace.improvements > 9999 ||
        !whole(p.workplace.recoveries) || p.workplace.recoveries > 9999)) return false;
      if (p.campaign !== undefined && (!p.campaign || ![p.campaign.budget,p.campaign.reach,p.campaign.engagement,p.campaign.leads].every(n=>whole(n)))) return false;
      if (p.clinic !== undefined && (!p.clinic || !whole(p.clinic.reference,1) || !whole(p.clinic.observations) || typeof p.clinic.reviewed!=='boolean')) return false;
      if (Object.entries(p.stories).some(([key,s])=>!s || !CAREER_STORIES[id].some(story=>story.id===key &&
        whole(s.stage) && s.stage <= story.events.length && whole(s.nextShift) && Number.isSafeInteger(s.outcome)))) return false;
    }
    const shift = person.shift;
    if (shift === null) return true;
    if (!shift || shift.career !== person.contract?.career || !['office','remote'].includes(shift.mode) ||
      ![shift.id,shift.day,shift.startedAt,shift.endsAt,shift.regularEnd,shift.late,shift.completed,shift.missed,shift.score,shift.nextTaskAt].every(n=>whole(n)) ||
      shift.endsAt <= shift.startedAt || shift.regularEnd > shift.endsAt || typeof shift.overtime !== 'boolean' ||
      shift.station && !CAREER_STATIONS.includes(shift.station)) return false;
    const t = shift.task;
    if (!t) return true;
    const event = WORK_EVENT_BY_ID.get(t.event);
    return !!event && (event.id.startsWith(shift.career+'-') || shift.career==='clinic' && event.effect==='clinical') &&
      (!t.story || CAREER_STORIES[shift.career].some(story=>story.id===t.story && story.events.includes(event.id))) &&
      whole(t.nonce,1) && ['new','walking','ready','checking','working'].includes(t.phase) &&
      whole(t.readyAt) && whole(t.deadline) && t.deadline <= shift.endsAt &&
      (t.attempts===undefined || (whole(t.attempts) && t.attempts<=2*(WORK_CHECKS[event.id]?.length??1))) &&
      (t.checkStep===undefined || (whole(t.checkStep) && t.checkStep <= (WORK_CHECKS[event.id]?.length ?? 0))) &&
      (t.wrongAtStep===undefined || (whole(t.wrongAtStep) && t.wrongAtStep < (WORK_CHECKS[event.id]?.length ?? 0))) &&
      (t.hint===undefined || (typeof t.hint==='string' && t.hint.length<=360)) &&
      (!['working','checking'].includes(t.phase) || (whole(t.choice) && t.choice! < event.choices.length));
  });
}
