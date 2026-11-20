import {
  CLASS_WINDOW, SKILLS, SKILL_IDS, educationalXP, materialRepeatFactor, missingKnowledge, nextClassSlots, rankTitle, skillRank, talent,
  type EducationCommand, type EducationProfile, type LearningChannel, type SkillId, type StudyMaterial,
} from './shared/education';
import { COURSE_STAGES, EDUCATION_GOALS, GOAL_NAMES, MATERIALS, MATERIAL_BY_ID, PROGRAMS, SKILL_GOALS,
  SKILL_GOAL_LEVELS } from './shared/educationCatalog';
import { formatRub } from './shared/economy';
import { clockAt, clockLabel, gameMinutes } from './shared/life';
import { serviceAvailable } from './shared/services';
import type { CharacterId, GameState } from './shared/protocol';

export type EducationView = 'overview' | 'record' | LearningChannel;
const views: Record<EducationView, string> = {
  overview: 'Навыки', tv: 'Телевидение', book: 'Книги', academy: 'Академия знаний', practice: 'Практика',
  center: 'Очные курсы', exam: 'Аттестация', record: 'Мой прогресс',
};
const tabNames: Record<EducationView, string> = {
  overview: 'Навыки', tv: 'ТВ', book: 'Книги', academy: 'Академия', practice: 'Практика',
  center: 'Курсы', exam: 'Экзамены', record: 'Прогресс',
};
const date = (minute: number) => clockLabel(clockAt(minute));

function node<K extends keyof HTMLElementTagNameMap>(tag: K, value = '', className = '') {
  const element = document.createElement(tag);
  if (value) element.textContent = value;
  if (className) element.className = className;
  return element;
}
function button(label: string, activate: () => void, disabled = false) {
  const control = node('button', label, 'education-button');
  control.type = 'button';
  control.disabled = disabled;
  control.addEventListener('click', activate);
  return control;
}
function bar(value: number, maximum: number) {
  const progress = node('progress');
  progress.setAttribute('aria-label', 'Прогресс навыка');
  progress.max = maximum || 1;
  progress.value = maximum ? value : 1;
  return progress;
}

export function educationAppointments(state: GameState, role: CharacterId) {
  return Object.entries(state.education.characters[role].enrollments).flatMap(([id, row]) =>
    row.dates.slice(row.attended).map((at, i) => ({ at, id, title: MATERIAL_BY_ID.get(id)!.title, lesson: row.attended + i + 1 })))
    .sort((a, b) => a.at - b.at);
}

export function createEducationUI(root: HTMLElement, submit: (command: EducationCommand) => boolean,
  close: () => void, travelToCenter: () => boolean) {
  let page: EducationView = 'overview';
  let skill: SkillId = 'logic';
  let detail = false;
  let selectedRoom: string | undefined;
  let requestedMaterial: string | undefined;
  let previous = '';
  let feedback = '';
  const slotSelection = new Map<string, number>();

  function render(state: GameState, role: CharacterId) {
    const profile = state.education.characters[role], now = gameMinutes(state.clock), place = state.world.places[role];
    const hasInternet = serviceAvailable(state.billing, 'internet', now);
    const signature = JSON.stringify([page, skill, detail, selectedRoom, feedback, state.money, place, hasInternet,
      profile, state.education.licenses, (page === 'center' || page === 'record') && Math.floor(now / 15)]);
    if (signature === previous) return;
    previous = signature;
    const scroll = root.scrollTop;
    const section = node('section', '', 'education-panel');
    const change = (next: EducationView) => {
      page = next; detail = false; selectedRoom = undefined; feedback = '';
      root.scrollTop = 0; render(state, role);
    };
    const send = (command: EducationCommand) => {
      if (!submit(command)) return;
      if (command.type === 'study') close();
    };
    const tabs = node('nav', '', 'education-tabs');
    tabs.setAttribute('aria-label', 'Разделы образования');
    for (const [key, label] of Object.entries(views)) {
      const tab = button(tabNames[key as EducationView], () => change(key as EducationView));
      tab.setAttribute('aria-label', label);
      tab.dataset.educationTab = key;
      tab.setAttribute('aria-current', key === page ? 'page' : 'false');
      tabs.append(tab);
    }
    section.append(tabs);
    const level = (id: SkillId) => skillRank(profile.xp[id]);
    const selected = level(skill);

    if (feedback) {
      const notice = node('p', feedback, 'education-feedback');
      notice.setAttribute('role', 'status');
      section.append(notice);
    }
    if (page === 'overview') {
      const hero = node('header', '', 'education-hero');
      hero.append(node('h2', 'Навыки и развитие'),
        node('p', SKILL_IDS.filter(id => talent(role, id)).map(id => SKILLS[id][1]).join(' и ') + ' · склонность +10% XP'));
      section.append(hero);
      const cards = node('div', '', 'education-grid');
      for (const id of SKILL_IDS) {
        const rank = level(id), [icon, name] = SKILLS[id];
        const label = button(icon + ' ' + name, () => {
          skill = id; detail = true; root.scrollTop = 0; render(state, role);
        });
        label.dataset.skill = id;
        label.append(node('small', 'Уровень ' + rank.level + '/20'), bar(rank.current, rank.next));
        cards.append(label);
      }
      section.append(cards);
      if (detail) {
        const card = node('article', '', 'education-card');
        card.append(node('h3', SKILLS[skill][1] + ' · ' + rankTitle(selected.level)),
          node('p', SKILLS[skill][2]), node('p', profile.xp[skill] + ' XP всего' +
            (selected.next ? ' · до следующего уровня ' + (selected.next - selected.current) + ' XP' : ' · максимальный уровень')));
        const next = MATERIALS.find(item => item.skill === skill && item.min > selected.level && item.channel === 'book');
        if (next) card.append(node('small', 'Уровень ' + next.min + ' откроет «' + next.title + '»'));
        const methods = node('div', '', 'education-controls');
        for (const mode of ['tv', 'book', 'academy', 'practice', 'center'] as const)
          methods.append(button(views[mode], () => change(mode)));
        card.append(methods); section.append(card);
        const target = SKILL_GOAL_LEVELS.find(value => value > selected.level);
        if (target) {
          const id = skill + '-' + target;
          card.append(button(profile.goals.includes(id) ? 'Снять цель · уровень ' + target : 'Поставить цель · уровень ' + target,
            () => send({ type: 'education_goal', id })));
        }
      }
      const aim = profile.goals.filter(id => !profile.achievements.includes(id)).map(id => SKILL_GOALS.get(id)?.skill).find(Boolean);
      const options = [...SKILL_IDS].sort((a, b) => Number(b === aim) - Number(a === aim) || profile.xp[a] - profile.xp[b]);
      const available = MATERIALS.filter(item => !item.price && !item.program &&
        (item.channel === 'book' || item.channel === 'practice' || item.channel === 'tv' || item.channel === 'academy' && hasInternet) &&
        educationalXP(item, role, profile) > 0);
      const recommendation = options.map(id => available.find(item => item.skill === id && item.channel === 'book') ??
        available.find(item => item.skill === id)).find(Boolean);
      if (recommendation) {
        const card = node('article', '', 'education-card');
        card.append(node('h3', 'Что изучить дальше?'), node('p', recommendation.title),
          button('Открыть · ' + views[recommendation.channel], () => { skill = recommendation.skill; change(recommendation.channel); }));
        section.append(card);
      }
    } else if (page === 'record') {
      section.append(node('h2', 'Цели и учебный журнал'));
      const goals = node('div', '', 'education-card');
      for (const id of new Set([...EDUCATION_GOALS, ...profile.goals, ...profile.achievements])) {
        const achieved = profile.achievements.includes(id);
        goals.append(button((achieved ? '✓ ' : profile.goals.includes(id) ? '★ ' : '☆ ') + GOAL_NAMES[id],
          () => send({ type: 'education_goal', id }), achieved));
      }
      section.append(goals);
      const achievements = node('article', '', 'education-card');
      achievements.append(node('h3', 'Программы и сертификаты'));
      for (const [id, program] of Object.entries(PROGRAMS)) {
        if (profile.programs.includes(id)) achievements.append(node('p', '✓ ' + program.name));
        else {
          const lesson = MATERIAL_BY_ID.get('program:' + id)!;
          achievements.append(button(program.name, () => { skill = lesson.skill; change('academy'); }));
        }
      }
      for (const id of profile.certificates) achievements.append(node('p', '🏅 ' + SKILLS[id as SkillId][1]));
      achievements.append(button('К аттестациям', () => change('exam')));
      section.append(achievements);
      for (const [id, row] of Object.entries(profile.enrollments)) {
        const item = MATERIAL_BY_ID.get(id)!;
        if (!row.dates.length) continue;
        section.append(node('p', item.title + ' · ' + row.attended + '/' + row.dates.length +
          (row.attended < row.dates.length ? ' · ' + date(row.dates[row.attended]) : ' · завершён'), 'education-card'));
      }
      for (const event of [...profile.events].reverse().slice(0, 18))
        section.append(node('p', date(event.at) + ' · ' + event.title + (event.xp ? ' · +' + event.xp + ' XP' : ''), 'education-event'));
    } else {
      section.append(node('h2', views[page]));
      const picker = node('select');
      picker.setAttribute('aria-label', 'Направление обучения');
      for (const id of SKILL_IDS) {
        const option = node('option', SKILLS[id][1] + ' · ' + level(id).level);
        option.value = id; picker.append(option);
      }
      picker.value = skill;
      picker.addEventListener('change', () => { skill = picker.value as SkillId; render(state, role); });
      section.append(picker);
      if (page === 'academy' && !hasInternet)
        section.append(node('p', 'Для занятий в Академии нужен оплаченный домашний интернет.', 'education-feedback'));
      const archived = [...MATERIAL_BY_ID.values()].filter(item => item.retired && item.channel === page &&
        item.skill === skill && (state.education.licenses.includes(item.id) ||
          Boolean(profile.studied[item.id]?.completions || profile.studied[item.id]?.minutes)));
      const items = [...MATERIALS, ...archived].filter(item => item.channel === page && item.skill === skill &&
        (!selectedRoom || item.station === selectedRoom || selectedRoom === 'reception'));
      for (const item of items) section.append(materialCard(item, profile, state, role, selected.level, now, send, !hasInternet));
      if (!items.length) section.append(node('p', 'В этой зоне выбери другое направление или открой расписание всех курсов.'));
    }
    root.replaceChildren(section);
    root.scrollTop = scroll;
    if (requestedMaterial) {
      const card = section.querySelector<HTMLElement>('[data-material="' + CSS.escape(requestedMaterial) + '"]');
      if (card) root.scrollTop += card.getBoundingClientRect().top - root.getBoundingClientRect().top - 12;
      requestedMaterial = undefined;
    }
  }
  function materialCard(item: StudyMaterial, profile: EducationProfile, state: GameState, role: CharacterId, level: number,
    now: number, send: (command: EducationCommand) => void, noInternet: boolean) {
    const record = profile.studied[item.id], course = item.channel === 'center', exam = item.channel === 'exam';
    const enrollment = profile.enrollments[item.id];
    const bought = course || exam ? Boolean(enrollment) : state.education.licenses.includes(item.id);
    const feeIncluded = exam && Object.entries(profile.enrollments).some(([id, other]) => {
      const material = MATERIAL_BY_ID.get(id);
      return material?.channel === 'center' && material.skill === item.skill && material.min >= item.min &&
        other.attended === other.dates.length;
    });
    const fee = feeIncluded ? 0 : item.price;
    const xp = course && level >= item.min && level < item.max
      ? Math.round(item.xp * (1 + talent(role, item.skill) / 100)) : educationalXP(item, role, profile);
    const card = node('article', '', 'education-card');
    card.dataset.material = item.id;
    card.append(node('h3', item.title + (item.retired ? ' · Архив' : '')), node('p', item.description),
      node('small', (item.author ? item.author + ' · ' : '') + 'Уровни ' + item.min + '–' +
        (exam ? 20 : item.max - 1) + ' · ' + item.minutes + ' игровых мин' + (exam ? '' : ' · +' + xp + ' XP')));
    if (record?.completions && !course && !exam) card.append(node('small', 'Завершено: ' + record.completions +
      ' · следующее повторение ' + Math.round(100 * materialRepeatFactor(item, record.completions)) + '%'));
    if (record?.minutes) card.append(node('small', 'Сохранено ' + Math.round(record.minutes / item.minutes * 100) + '%'),
      bar(record.minutes, item.minutes));
    if (item.channel === 'book' && record?.completions) card.append(node('small', '✓ Изучено'));
    const need = item.program ? missingKnowledge(profile, PROGRAMS[item.program].requirement) : [];
    if (need.length) card.append(node('small', 'Требуется: ' + need.map(id => MATERIAL_BY_ID.get(id)?.title ?? id).join(', ')));
    if (item.program && profile.programs.includes(item.program)) {
      card.append(node('small', '✓ Программа освоена')); return card;
    }
    if (exam && profile.certificates.includes(item.certificate!)) {
      card.append(node('small', '✓ Сертификат получен')); return card;
    }
    if (exam) card.append(node('small', feeIncluded ? 'Аттестация включена в завершённый курс' : 'Очная проверка знаний · ' + formatRub(fee)));
    const controls = node('div', '', 'education-controls');
    const due = enrollment?.dates[enrollment.attended];
    if (course) {
      card.append(node('small', (enrollment?.attended ?? 0) + '/' + item.sessions + ' очных занятий · ' +
        formatRub(item.price)));
      for (const [i, stage] of COURSE_STAGES.entries()) {
        const at = enrollment?.dates[i];
        card.append(node('small', (enrollment && i < enrollment.attended ? '✓ ' : '') + stage +
          (at === undefined ? '' : ' · ' + date(at))));
      }
      if (enrollment && due === undefined) {
        card.append(node('small', '✓ Курс завершён')); return card;
      }
      if (due !== undefined && due + CLASS_WINDOW <= now)
        card.append(node('small', 'Занятие пропущено. Выбери новое время начала.'));
      const slots = nextClassSlots(now);
      const chooser = node('select');
      chooser.setAttribute('aria-label', 'Время начала курса');
      for (const at of slots) {
        const option = node('option', date(at)); option.value = String(at); chooser.append(option);
      }
      const selected = slotSelection.get(item.id);
      if (selected !== undefined && slots.includes(selected)) chooser.value = String(selected);
      chooser.addEventListener('change', () => slotSelection.set(item.id, Number(chooser.value)));
      controls.append(chooser, button(enrollment ? 'Перенести' : 'Записаться · ' + formatRub(fee), () =>
        send({ type: enrollment ? 'education_reschedule' : 'education_buy', id: item.id, slot: Number(chooser.value) }),
      level < item.min || !enrollment && state.money < fee));
      if (enrollment && !enrollment.attended && due !== undefined && due > now)
        controls.append(button('Отменить с возвратом', () => send({ type: 'education_cancel', id: item.id })));
    } else if (!bought && item.price) {
      controls.append(button((exam ? 'Записаться · ' : 'Купить доступ · ') + formatRub(fee), () =>
        send({ type: 'education_buy', id: item.id }), level < item.min || state.money < fee));
    } else card.append(node('small', bought ? '✓ Доступ оплачен' : 'Бесплатно'));
    const correctPlace = state.world.places[role] === (course || exam ? 'education' : 'home');
    if (correctPlace && (bought || !item.price)) {
      const inWindow = !course || (due !== undefined && now >= due && now < due + CLASS_WINDOW);
      const control = button(course ? 'Начать занятие' : exam ? 'Сдать аттестацию'
        : record?.minutes ? 'Продолжить' : 'Начать', () => send({ type: 'study', material: item.id }),
      !inWindow || level < item.min || need.length > 0 || (item.channel === 'academy' && noInternet));
      control.dataset.study = item.id;
      controls.append(control);
    } else if (!correctPlace && bought && (exam || course && due !== undefined && now >= due && now < due + CLASS_WINDOW)) {
      controls.append(button('Поехать в «Потенциал»', () => { if (travelToCenter()) close(); }));
    } else if (!correctPlace && (bought || !item.price)) {
      card.append(node('small', course || exam ? 'Занятие проходит в центре «Потенциал»' : 'Занятие доступно дома'));
    }
    card.append(controls);
    return card;
  }
  return {
    render,
    open(view: EducationView = 'overview', room?: string, materialId?: string) {
      page = view; detail = false; feedback = ''; previous = ''; selectedRoom = room;
      requestedMaterial = materialId;
      const material = materialId && MATERIAL_BY_ID.get(materialId);
      if (material) skill = material.skill;
      if (room === 'lab') skill = 'technology';
      else if (room === 'workshop') skill = 'practical';
      else if (room === 'classroom') skill = 'communication';
    },
    feedback(message: string) { feedback = message; previous = ''; },
  };
}
