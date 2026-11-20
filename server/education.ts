import {
  CLASS_WINDOW, SKILL_IDS, SKILLS, classDates, educationalXP, initialEducation, isSkillId,
  maximumXP, missingKnowledge, nextClassSlots, repeatFactor, skillRank, talent,
  type EducationProfile, type EducationState, type SkillId, type StudyMaterial,
} from '../src/shared/education';
import { GOAL_NAMES, MATERIAL_BY_ID, PROGRAMS, SKILL_GOALS } from '../src/shared/educationCatalog';
import { addLedger, formatRub } from '../src/shared/economy';
import { gameMinutes } from '../src/shared/life';
import { serviceAvailable } from '../src/shared/services';
import { BOOKS, type BookId } from '../src/shared/homeLife';
import type { CharacterId, GameState, TimedCommand } from '../src/shared/protocol';

const xpLogLimit = 60;
const ANSWERS = [0, 1, 2, 0, 1];
export const answerMatches = (id: string, choice: number) => ANSWERS[Number(id.split(':')[1])] === choice;

export function educationEvent(profile: EducationProfile, at: number, title: string,
  milestone = false, skill?: SkillId, xp?: number): void {
  profile.events.push({ at, title, milestone, ...(skill === undefined ? {} : { skill }), ...(xp === undefined ? {} : { xp }) });
  if (profile.events.length > xpLogLimit) profile.events.splice(0, profile.events.length - xpLogLimit);
}
const profileOf = (state: GameState, role: CharacterId) => state.education.characters[role];
function achievements(profile: EducationProfile, now: number): void {
  const reached = {
    'first-book': Object.keys(profile.studied).some(id => id.startsWith('book:') && profile.studied[id].completions > 0),
    'skill-5': SKILL_IDS.some(id => skillRank(profile.xp[id]).level >= 5),
    'first-program': profile.programs.length > 0,
    'first-course': Object.values(profile.enrollments).some(course => course.dates.length > 0 && course.attended === course.dates.length),
    'first-certificate': profile.certificates.length > 0,
    'three-skills': SKILL_IDS.filter(id => skillRank(profile.xp[id]).level >= 5).length >= 3,
    expert: SKILL_IDS.some(id => skillRank(profile.xp[id]).level >= 16),
  };
  const selected = profile.goals.filter(id => {
    const goal = SKILL_GOALS.get(id);
    return goal && skillRank(profile.xp[goal.skill]).level >= goal.level;
  });
  const met = [...Object.keys(reached).filter(id => reached[id as keyof typeof reached]), ...selected];
  for (const key of met) if (!profile.achievements.includes(key)) {
    profile.achievements.push(key);
    educationEvent(profile, now, 'Цель выполнена · ' + GOAL_NAMES[key], true);
  }
}
function grant(profile: EducationProfile, id: SkillId, value: number, label: string, now: number): number {
  const before = profile.xp[id];
  const oldRank = skillRank(before).level;
  profile.xp[id] = Math.min(maximumXP, before + Math.max(0, value));
  const earned = profile.xp[id] - before;
  if (earned > 0) educationEvent(profile, now, label, false, id, earned);
  const level = skillRank(profile.xp[id]).level;
  if (level > oldRank) educationEvent(profile, now, SKILLS[id][1] + ' · уровень ' + level, true, id);
  return earned;
}

export function studyDenial(state: GameState, role: CharacterId, material: StudyMaterial, now: number): string | undefined {
  const profile = profileOf(state, role);
  const center = material.channel === 'center' || material.channel === 'exam';
  if (state.world.places[role] !== (center ? 'education' : 'home'))
    return center ? 'Занятие проходит в центре «Потенциал»' : 'Это занятие проходит дома';
  if (skillRank(profile.xp[material.skill]).level < material.min)
    return 'Требуется навык «' + SKILLS[material.skill][1] + '» уровня ' + material.min;
  if (material.program) {
    if (profile.programs.includes(material.program)) return 'Программа уже освоена';
    const missing = missingKnowledge(profile, PROGRAMS[material.program].requirement);
    if (missing.length) return 'Ещё нужно освоить: ' + missing.join(', ');
  }
  if (material.channel === 'academy' && !serviceAvailable(state.billing, 'internet', gameMinutes(state.clock)))
    return 'Для Академии знаний нужен действующий домашний интернет';
  if (material.channel === 'center') {
    const enrollment = profile.enrollments[material.id];
    if (!enrollment) return 'Сначала запишись на курс';
    const date = enrollment.dates[enrollment.attended];
    if (date === undefined) return 'Курс уже завершён';
    if (date > now) return 'Занятие ещё не началось';
    if (date + CLASS_WINDOW <= now) return 'Окно посещения закрыто. Перенеси занятие в телефоне';
  } else if (material.channel === 'exam') {
    if (profile.certificates.includes(material.certificate!)) return 'Сертификат уже получен';
    if (!profile.enrollments[material.id]) return 'Сначала запишись на аттестацию';
  } else if (material.price && !state.education.licenses.includes(material.id)) {
    return 'Сначала купи доступ к материалу';
  }
}

export function studyMinutes(profile: EducationProfile, material: StudyMaterial): number {
  return Math.max(1, material.minutes - (profile.studied[material.id]?.minutes ?? 0));
}

export function saveBookMinutes(state: GameState, role: CharacterId, material: StudyMaterial, minutes: number): void {
  if ((material.channel !== 'book' && material.channel !== 'academy') || minutes < 1) return;
  const profile = profileOf(state, role);
  const record = profile.studied[material.id] ??= { minutes: 0, completions: 0 };
  record.minutes = Math.max(record.minutes, Math.min(material.minutes - 1, Math.floor(minutes)));
}

export function completeStudy(state: GameState, role: CharacterId, material: StudyMaterial, now: number): string {
  const profile = profileOf(state, role);
  const record = profile.studied[material.id] ??= { minutes: 0, completions: 0 };
  let earned = educationalXP(material, role, profile);
  if (material.channel === 'center') {
    const enrollment = profile.enrollments[material.id];
    enrollment.attended++;
    const level = skillRank(profile.xp[material.skill]).level;
    earned = level < material.max ? Math.round(material.xp * (1 + talent(role, material.skill) / 100)) : 0;
    if (enrollment.attended === enrollment.dates.length) educationEvent(profile, now, 'Курс завершён · ' + material.title, true);
  }
  if (material.certificate && !profile.certificates.includes(material.certificate)) {
    profile.certificates.push(material.certificate);
    educationEvent(profile, now, 'Сертификат · ' + SKILLS[material.skill][1], true);
  }
  if (material.program && !profile.programs.includes(material.program)) {
    profile.programs.push(material.program);
    educationEvent(profile, now, 'Освоена программа · ' + material.title, true);
  }
  record.minutes = 0;
  record.completions = Math.min(record.completions + 1, 9999);
  const actual = grant(profile, material.skill, earned, material.title, now);
  if (material.secondary && actual) grant(profile, material.secondary, Math.round(earned * .15), material.title, now);
  achievements(profile, now);
  return material.title + (actual ? ' · +' + actual + ' XP' : ' · завершено');
}

function conflicts(profile: EducationProfile, id: string, dates: number[]) {
  return Object.entries(profile.enrollments).some(([key, row]) => key !== id &&
    dates.some(at => row.dates.slice(row.attended).some(other => Math.abs(other - at) < CLASS_WINDOW)));
}

type Result = { ok: true; state: GameState; message: string } | { ok: false; reason: string };
const fail = (reason: string): Result => ({ ok: false, reason });
export function applyEducation(source: GameState, role: CharacterId, command: Record<string, unknown>,
  now = gameMinutes(source.clock)): Result {
  if (typeof command.id !== 'string') return fail('Выбери материал');
  const id = command.id;
  const state = structuredClone(source);
  const profile = profileOf(state, role);
  function done(message: string): Result {
    state.revision++;
    return { ok: true, state, message };
  }
  if (command.type === 'education_goal' && Object.hasOwn(GOAL_NAMES, id)) {
    if (profile.achievements.includes(id)) return fail('Цель уже выполнена');
    if (profile.goals.includes(id)) profile.goals = profile.goals.filter(goal => goal !== id);
    else {
      const selected = SKILL_GOALS.get(id);
      if (selected) {
        if (skillRank(profile.xp[selected.skill]).level >= selected.level) return fail('Этот уровень уже достигнут');
        profile.goals = profile.goals.filter(key => profile.achievements.includes(key) || SKILL_GOALS.get(key)?.skill !== selected.skill);
      }
      profile.goals.push(id);
    }
    return done('Цели обновлены');
  }
  const item = MATERIAL_BY_ID.get(id);
  if (!item) return fail('Учебный материал не найден');
  const enrollment = profile.enrollments[id];
  const course = item.channel === 'center';
  const exam = item.channel === 'exam';
  if (command.type === 'education_cancel' || command.type === 'education_reschedule') {
    if (!course || !enrollment || enrollment.attended >= enrollment.dates.length) return fail('Нет действующей записи');
    const next = enrollment.dates[enrollment.attended];
    if (command.type === 'education_cancel') {
      if (enrollment.attended || next <= now) return fail('Начатый курс можно только перенести');
      state.money += enrollment.paid;
      if (enrollment.paid) addLedger(state, role, 'income', 'education', enrollment.paid, 'Возврат · ' + item.title);
      delete profile.enrollments[id];
      educationEvent(profile, now, 'Запись отменена · ' + item.title);
      return done('Запись отменена, средства возвращены');
    }
    if (typeof command.slot !== 'number' || !nextClassSlots(now).includes(command.slot)) return fail('Выбери свободное время');
    const dates = classDates(command.slot, item.sessions! - enrollment.attended);
    if (conflicts(profile, id, dates)) return fail('На это время уже есть занятие');
    enrollment.dates.splice(enrollment.attended, dates.length, ...dates);
    educationEvent(profile, now, 'Занятия перенесены · ' + item.title);
    return done('Расписание обновлено');
  }
  if (command.type !== 'education_buy') return fail('Неизвестная операция');
  if (item.program && profile.programs.includes(item.program)) return fail('Программа уже освоена');
  if (skillRank(profile.xp[item.skill]).level < item.min)
    return fail('Сначала повысь навык до уровня ' + item.min);
  if (course || exam ? enrollment : state.education.licenses.includes(id)) return fail('Доступ уже оформлен');
  if (!item.price) return fail('Этот материал уже доступен');
  const examIncluded = exam && Object.entries(profile.enrollments).some(([key, row]) => {
    const other = MATERIAL_BY_ID.get(key);
    return other?.channel === 'center' && other.skill === item.skill && other.min >= item.min &&
      row.attended === row.dates.length;
  });
  const price = examIncluded ? 0 : item.price;
  if (state.money < price) return fail('Для оплаты нужно ' + formatRub(price));
  if (course) {
    if (typeof command.slot !== 'number' || !nextClassSlots(now).includes(command.slot)) return fail('Выбери доступное время начала');
    const dates = classDates(command.slot, item.sessions!);
    if (conflicts(profile, id, dates)) return fail('На это время уже есть занятие');
    profile.enrollments[id] = { dates, attended: 0, paid: price };
  } else if (exam) profile.enrollments[id] = { dates: [], attended: 0, paid: price };
  else state.education.licenses.push(id);
  state.money -= price;
  if (price) addLedger(state, role, 'expense', 'education', price, item.title);
  educationEvent(profile, now, (course || exam ? 'Запись · ' : 'Доступ открыт · ') + item.title);
  return done(course || exam ? 'Запись подтверждена' : 'Семейный доступ открыт');
}

const bookSkills: Partial<Record<BookId, SkillId>> = {
  master: 'creativity', prince: 'communication', pride: 'communication', orwell: 'logic', crime: 'logic',
  express: 'attention', holmes: 'attention', martian: 'practical', dune: 'creativity', flowers: 'technology',
};
export const readingSkill = (id: BookId): SkillId => bookSkills[id] ?? 'creativity';
export function migrateEducation(state: Pick<GameState, 'readBooks'>): EducationState {
  const education = initialEducation();
  for (const role of ['vlad', 'alina'] as const) for (const book of state.readBooks[role]) {
    education.characters[role].studied['life:book:' + book] = { minutes: 0, completions: 1 };
  }
  return education;
}
export function practiceXP(state: GameState, role: CharacterId, id: string, skill: SkillId,
  label: string, base: number, limit: number): void {
  const profile = profileOf(state, role);
  const level = skillRank(profile.xp[skill]).level;
  if (level >= limit) return;
  const key = 'life:' + id;
  const record = profile.studied[key] ??= { minutes: 0, completions: 0 };
  const factor = repeatFactor(record.completions);
  if (!factor) return;
  record.completions++;
  const now = gameMinutes(state.clock);
  grant(profile, skill, Math.round(base * factor * (1 + talent(role, skill) / 100)), label, now);
  achievements(profile, now);
}

const routines: Record<string, [SkillId, number]> = {
  bedStretch: ['fitness', 8], tablePlan: ['organization', 9], deskJournal: ['creativity', 8],
  deskGames: ['attention', 6], vladStudy: ['technology', 10], vladOrder: ['technology', 12],
  alinaStudy: ['practical', 9], alinaConsult: ['communication', 10], sofaCall: ['communication', 7], tableTalk: ['communication', 7],
  kitchenTidy: ['organization', 6],
};
export function awardActivity(state: GameState, role: CharacterId, command: TimedCommand, label: string) {
  if (command.type === 'read_book' && Object.hasOwn(BOOKS, command.book))
    practiceXP(state, role, 'book:' + command.book, readingSkill(command.book), label, 10, 8);
  else if (command.type === 'cook') practiceXP(state, role, 'recipe:' + command.recipe, 'cooking', label, 13, 12);
  else if (command.type === 'local_activity' && command.action === 'exercise')
    practiceXP(state, role, 'exercise:' + command.station, 'fitness', label, 9, 8);
  else if (command.type === 'act' && Object.hasOwn(routines, command.actionId)) {
    const [skill, base] = routines[command.actionId];
    practiceXP(state, role, 'action:' + command.actionId, skill, label, base, 8);
  } else if (command.type === 'movie' && (command.genre === 'crime' || command.genre === 'drama'))
    practiceXP(state, role, 'movie:' + command.genre, command.genre === 'crime' ? 'attention' : 'communication', label, 5, 4);
}

function whole(value: unknown, maximum = Number.MAX_SAFE_INTEGER): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 && value <= maximum;
}
function list(value: unknown, known: (entry: string) => boolean): value is string[] {
  return Array.isArray(value) && new Set(value).size === value.length &&
    value.every(id => typeof id === 'string' && known(id));
}
export function validEducation(value: unknown): value is EducationState {
  if (!value || typeof value !== 'object') return false;
  const state = value as Partial<EducationState>;
  if (!list(state.licenses, id => Boolean(MATERIAL_BY_ID.get(id)?.price) &&
      !['center', 'exam'].includes(MATERIAL_BY_ID.get(id)!.channel))) return false;
  return (['vlad', 'alina'] as const).every(role => {
    const p = state.characters?.[role];
    if (!p?.xp || !SKILL_IDS.every(skill => whole(p.xp[skill], maximumXP)) ||
        !p.studied || !p.enrollments || !list(p.programs, id => Object.hasOwn(PROGRAMS, id)) ||
        !list(p.certificates, isSkillId) || !list(p.goals, id => Object.hasOwn(GOAL_NAMES, id)) ||
        !list(p.achievements, id => Object.hasOwn(GOAL_NAMES, id)) ||
        !Array.isArray(p.events) || p.events.length > xpLogLimit) return false;
    return Object.entries(p.studied).every(([id, row]) =>
      (MATERIAL_BY_ID.has(id) || /^life:[\w:-]{1,90}$/.test(id)) && row &&
      whole(row.minutes, MATERIAL_BY_ID.get(id)?.minutes ?? 0) && whole(row.completions, 9999)) &&
      Object.entries(p.enrollments).every(([id, row]) => {
        const item = MATERIAL_BY_ID.get(id);
        return item && (item.channel === 'center' || item.channel === 'exam') && row &&
          whole(row.paid, item.price) && Array.isArray(row.dates) && row.dates.length === (item.sessions ?? 0) &&
          row.dates.every((date, i) => whole(date) && (i === 0 || date > row.dates[i - 1])) &&
          whole(row.attended, row.dates.length);
      }) &&
      p.events.every(event => event && whole(event.at) && typeof event.title === 'string' && event.title.length <= 180 &&
        (event.skill === undefined || isSkillId(event.skill)) && (event.xp === undefined || whole(event.xp, maximumXP)) &&
        (event.milestone === undefined || typeof event.milestone === 'boolean'));
  });
}
