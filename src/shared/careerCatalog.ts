import { CAREERS, CAREER_IDS, CLINIC_MODULES, DETAIL_SERVICES, type CareerId, type WorkStation } from './careers';
import type { KnowledgeRequirement, SkillId } from './education';
import { it } from './work/it';
import { detail } from './work/detail';
import { marketing } from './work/marketing';
import { clinic } from './work/clinic';

export type CareerTopic = 'Поручение' | 'Клиент' | 'Сроки' | 'Команда' | 'Качество' | 'Обучение' | 'Оценка' | 'Инициатива';
export interface CareerChoice {
  label: string; minutes: number; quality: number; reputation: number; requires?: KnowledgeRequirement;
  result: string; service?: keyof typeof DETAIL_SERVICES; discount?: number; spend?: number;
}
export interface CareerEvent {
  id: string; title: string; text: string; author: number; topic: CareerTopic; station: WorkStation;
  skill: SkillId; rank: number; choices: CareerChoice[]; effect?: 'booking' | 'handover' | 'campaign' | 'patient' | 'clinical' | 'evaluation';
}
export const WORK_CHECKS: Record<string, { prompt: string; options: [string,string,string] }> = {
  'it-1':{prompt:'Какую строку можно сохранить, если нужны уникальный номер, отдел «Склад» и статус «Новая»?',options:['№104 · Склад · Новая','№104 · Снабжение · Новая','Без номера · Склад · Новая']},
  'it-2':{prompt:'В базе уже есть №201 и №203. Какая строка должна попасть в итоговый импорт?',options:['№201 · 12 000 ₽','№202 · 8 460 ₽','№203 · 2 500 ₽']},
  'it-4':{prompt:'Выбери правильный порядок числовых номеров для теста сортировки.',options:['20, 2, 10','10, 2, 20','2, 10, 20']},
  'it-22':{prompt:'Исходник содержит заголовок и 26 строк данных. В отчёте не хватает первой строки. Что должно оказаться в исправленном файле?',options:['26 строк данных и заголовок','25 строк и заголовок','27 строк данных']},
  'detail-1':{prompt:'Клиенту нужна чистка одного элемента на 25 минут. Пост 1 занят до 11:20, пост 2 свободен в 10:40. Какой ближайший срок?',options:['10:40–11:05 · пост 2','10:45–11:10 · пост 1','10:40–10:55 · пост 2']},
  'detail-4':{prompt:'Первый пост уже работает до 14:00. Запись на 13:25 занимает 25 минут, второй пост свободен. Какая запись выполнима?',options:['13:25 · первый пост','13:25 · второй пост','13:50 · первый пост']},
  'detail-15':{prompt:'Ключи с биркой С45. Журнал назначает владельцу С45 синюю машину. Что можно выдать?',options:['Серую · бирка С45','Синюю · бирка С54','Синюю · бирка С45']},
  'marketing-1':{prompt:'Сервис доставляет рассаду в два района по будням. Какой заголовок соответствует условиям?',options:['Рассада с доставкой по будням в Сосновый и Северный','Рассада в любой район и любой день','Рассада с доставкой только по воскресеньям']},
  'marketing-2':{prompt:'Из 800 показов пришли 40 переходов и 2 заявки. Какой переход в цепочке сейчас сильнее всего просел в абсолютном объёме?',options:['Из двух заявок в подписку','Из 800 показов в 40 переходов','Из 40 переходов в 2 заявки']},
  'marketing-12':{prompt:'Суббота потратила 1 500 ₽ на 3 заявки, воскресенье — 900 ₽ на 3. Какой день дал меньшую стоимость заявки?',options:['Суббота','Стоимость одинакова','Воскресенье']},
  'clinic-1':{prompt:'Владелец подтвердил учебную карточку №073 и сегодняшнюю дату. Какую запись нужно открыть?',options:['№073 · сегодняшний приём','№037 · сегодняшний приём','№073 · прошлый визит']},
  'clinic-2':{prompt:'В записи владельца Бублика есть код В-18. Какая карточка совпадает?',options:['Бублик · В-81','Бублик · В-18','Плюша · В-18']},
  'clinic-15':{prompt:'Что из трёх записей является наблюдением, которое можно передать наставнику?',options:['«Наверное, просто не любит людей»','«С ним всё было в порядке как всегда»','«В 11:15 сидел в переноске, в 11:25 подошёл к дверце»']},
};
const sources = { it, detail, marketing, clinic };
const stations: Record<CareerId, WorkStation[]> = {
  it:['desk','records','desk','desk','board','service','desk','service','lead','board'],
  detail:['lead','board','records','desk','lead','board','records','service','lead','desk'],
  marketing:['desk','service','board','lead','service','desk','lead','board','lead','records'],
  clinic:['lead','board','service','lead','lead','board','records','desk','service','lead'],
};
const topics: CareerTopic[] = ['Поручение','Клиент','Сроки','Команда','Качество','Обучение','Оценка','Инициатива'];
export const WORK_EVENTS = Object.fromEntries(CAREER_IDS.map(career => [career,
  sources[career].trim().split('\n').map((row, index): CareerEvent => {
    const [title, text, thorough, pragmatic] = row.split('|');
    const rank = index < 24 ? 0 : index < 31 ? 1 : index < 36 ? 2 : index < 41 ? 3 : 4;
    const skill = CAREERS[career].skills[index % 3];
    const coordination = index % 5 === 1 || index % 5 === 4;
    const choices: CareerChoice[] = [
      { label: thorough, minutes: coordination ? 14 : 19, quality: coordination ? 73 : 87, reputation: coordination ? 4 : 2,
        result: coordination ? 'Команда получила ясное решение и согласовала следующий шаг.' : 'Результат проверен и у задачи есть зафиксированный итог.',
        ...(rank && index % 3 === 0 ? { requires: { skills: { [skill]: rank * 2 } } } : {}) },
      { label: pragmatic, minutes: coordination ? 21 : 12, quality: coordination ? 89 : 67, reputation: coordination ? 2 : 3,
        result: coordination ? 'Пришлось потратить больше времени, зато у команды есть запасной вариант.' :
          'Срочная часть закрыта. Следующую проверку внесли в рабочий журнал.' },
    ];
    return { id: career + '-' + (index + 1), title, text, rank, author: index % 7 === 0 ? 0 : (index % 2) + 1,
      station: stations[career][index % stations[career].length], topic: topics[index % topics.length], skill, choices,
      effect: career === 'marketing' && [1,4,11,14,29,32,36,40,44].includes(index) ? 'campaign'
        : career === 'clinic' && [0,1,8,14,18,24,31,36,44].includes(index) ? 'patient' : undefined };
  })])) as Record<CareerId, CareerEvent[]>;

const serviceChoices = [[0,'trim',0],[13,'interior',0],[15,'wash',8],[9,'polish',0],[30,'coating',5],[34,'full',0]] as const;
for (const [index, service, discount] of serviceChoices) {
  const spec = DETAIL_SERVICES[service];
  const event = WORK_EVENTS.detail[index];
  event.effect = 'booking';
  event.station = 'desk';
  event.choices.unshift({ label: 'Согласовать «' + spec.name + '» · ' + Math.round(spec.price * (1 - discount / 100)) + ' ₽',
    minutes: 16, quality: 89, reputation: 3, service, discount, result: 'Заказ внесён в график с согласованной ценой.' });
}

const special = new Map<string, CareerEvent>();
for (const [i,title] of CLINIC_MODULES.entries()) {
  const exercise = WORK_EVENTS.clinic[[0,14,6,7,29,44][i]];
  special.set('clinical-' + i, { ...exercise, id:'clinical-' + i, title:'Практикум · ' + title, author: 0, rank: 1,
    topic:'Обучение', effect:'clinical', text:'Наставник проводит отдельное профессиональное обучение. ' + exercise.text,
    choices: exercise.choices.map((choice, j) => ({ ...choice, minutes: 25 + i * 3, quality: j ? 68 : 90 })) });
}
for (const id of CAREER_IDS) {
  special.set(id + '-review', { id:id + '-review', title:'Оценка для повышения', text:'Руководитель ждёт, что ты объяснишь результат, порядок проверки и кто примет следующий этап.',
    author:0, topic:'Оценка', station:'lead', skill:CAREERS[id].skills[0], rank:0, effect:'evaluation',
    choices:[{label:'Представить проверенный пример и согласовать следующий шаг',minutes:24,quality:95,reputation:4,result:'Руководитель одобрил оценку. Подай заявку в телефоне после смены.'},
      {label:'Попросить наставника разобрать пример вместе',minutes:12,quality:72,reputation:2,result:'Получена полезная обратная связь. На следующей смене можно пройти оценку снова.'}] });
}
special.set('detail-handover', { id:'detail-handover', title:'Выдача готового автомобиля', text:'В графике закончен заказ. Сверь карточку, покажи результат и передай ключи владельцу.',
  author:1, topic:'Клиент', station:'service', skill:'attention', rank:0, effect:'handover',
  choices:[{label:'Сверить результат с карточкой вместе с владельцем',minutes:16,quality:93,reputation:4,result:'Автомобиль выдан после совместной приёмки.'},
    {label:'Попросить мастера подтвердить готовность, затем выдать ключи',minutes:12,quality:78,reputation:2,result:'Выдача закрыта с отметкой мастера.'}] });
export const WORK_EVENT_BY_ID = new Map([...Object.values(WORK_EVENTS).flat().map(row => [row.id,row] as const), ...special]);

type Story = { id: string; title: string; events: string[] };
const story = (id: CareerId, suffix: string, title: string, events: number[]): Story =>
  ({ id:id+'-'+suffix, title, events:events.map(number => id+'-'+number) });
export const CAREER_STORIES: Record<CareerId, Story[]> = {
  it: [story('it','forms','Новая форма закупок',[5,1,6,45]), story('it','feeds','Отчёт без расхождений',[2,3,22,25]),
    story('it','release','Запуск справочника',[12,18,19,37])],
  detail: [story('detail','company','Три машины для компании',[13,7,25,45]), story('detail','repeat','Повторный визит',[19,5,26,32]),
    story('detail','timing','Заказы утренней смены',[4,16,28,39])],
  marketing: [story('marketing','seed','Кампания рассады',[1,2,5,45]), story('marketing','launch','Месяц публикаций',[3,16,28,44]),
    story('marketing','budget','Заявки на меньшем бюджете',[9,12,23,33])],
  clinic: [story('clinic','patient','Учебная карточка пациента',[1,9,15,45]), story('clinic','queue','Спокойный маршрут приёма',[3,4,10,18]),
    story('clinic','handoff','Проверка документации',[2,14,30,41])],
};
