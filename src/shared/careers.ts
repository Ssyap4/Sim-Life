import type { CharacterId } from './protocol';
import type { SkillId } from './education';
import type { CareerRequirements } from './careerEducation';

export const CAREER_IDS = ['it', 'detail', 'marketing', 'clinic'] as const;
export type CareerId = typeof CAREER_IDS[number];
export type CareerPlace = 'work-it' | 'work-detail' | 'work-marketing' | 'work-clinic';
export type WorkStation = 'desk' | 'board' | 'lead' | 'records' | 'service';
export type CareerMode = 'office' | 'remote';
export type CareerStaff = { name: string; position: string; approach: string };
type RankSpec = [name: string, pay: number];
export interface CareerSpec {
  owner: CharacterId; title: string; employer: string; place: CareerPlace; icon: string;
  start: number; hours: number; days: number[]; remoteDays?: number[];
  skills: readonly [SkillId, SkillId, SkillId]; roles: readonly RankSpec[];
  staff: readonly [CareerStaff, CareerStaff, CareerStaff];
  stations: Record<WorkStation, string>;
}
export const CAREERS: Record<CareerId, CareerSpec> = {
  it: { owner: 'vlad', title: 'Специалист по внутренним IT-проектам', employer: 'Север · Внутренние системы', place: 'work-it', icon: '💻',
    start: 540, hours: 7, days: [0,1,2,3,4], skills: ['technology','logic','attention'],
    roles: [['Стажёр IT-отдела',2800],['Младший IT-специалист',3300],['Специалист внутренних систем',4100],['Старший IT-специалист',5000],['Координатор цифровых проектов',6100]],
    staff: [{name:'Антон Рябов',position:'Руководитель IT-отдела',approach:'Ценит проверенные сроки и последовательность.'},
      {name:'Лера Сомова',position:'Аналитик',approach:'Сверяет данные и оставляет короткие заметки.'},
      {name:'Илья Белых',position:'Инженер',approach:'Всегда готов помочь с повторяемым сбоем.'}],
    stations: {desk:'ПК Влада',board:'Доска задач',lead:'Переговорная',records:'Принтер и архив',service:'Стол проверки'} },
  detail: { owner: 'vlad', title: 'Администратор детейлинг-центра', employer: 'Линия блеска', place: 'work-detail', icon: '🚙',
    start: 480, hours: 8, days: [1,2,3,4,5], skills: ['communication','organization','attention'],
    roles: [['Помощник администратора',2500],['Администратор',3100],['Координатор заказов',3900],['Старший администратор',4900],['Управляющий клиентским сервисом',6200]],
    staff: [{name:'Марина Уварова',position:'Управляющая',approach:'Держит слово перед клиентами и защищает время мастеров.'},
      {name:'Павел Шестов',position:'Мастер кузова',approach:'Замечает следы, которые не видны под обычным светом.'},
      {name:'Денис Ветров',position:'Мастер салона',approach:'Предпочитает заранее сверять комплектацию заказа.'}],
    stations: {desk:'ПК заказов',board:'График мастеров',lead:'Стойка клиентов',records:'Ресепшен и ключи',service:'Приёмка автомобиля'} },
  marketing: { owner: 'alina', title: 'Маркетолог', employer: 'Искра · Агентство', place: 'work-marketing', icon: '📣',
    start: 600, hours: 6, days: [0,1,2,3,4], remoteDays: [0,3], skills: ['creativity','communication','technology'],
    roles: [['Стажёр маркетинга',2600],['Младший маркетолог',3200],['Маркетолог',4100],['Старший маркетолог',5200],['Ведущий маркетолог',6500]],
    staff: [{name:'Надежда Лукина',position:'Руководитель агентства',approach:'Любит инициативу, которую можно проверить.'},
      {name:'Кира Цветкова',position:'Редактор',approach:'Задаёт вопросы о читателе и тоне.'},
      {name:'Миша Белов',position:'Аналитик',approach:'Решает споры сравнением результатов.'}],
    stations: {desk:'Ноутбук Алины',board:'Доска идей',lead:'Переговорная',records:'Контент-календарь',service:'Экран аналитики'} },
  clinic: { owner: 'alina', title: 'Ветеринарная карьера', employer: 'Лапа и хвост · Клиника', place: 'work-clinic', icon: '🐾',
    start: 660, hours: 7, days: [0,2,3,4,6], skills: ['attention','practical','communication'],
    roles: [['Помощник клиники',2400],['Помощник по уходу за животными',3000],['Ассистент ветеринара',3900],['Ветеринар',5500],['Старший ветеринар',7000]],
    staff: [{name:'Елена Синицына',position:'Главный ветеринар',approach:'Ценит спокойствие, наблюдение и точную передачу данных.'},
      {name:'Арсений Рудин',position:'Ассистент',approach:'Помогает подготовить безопасное место для животных.'},
      {name:'Вера Калинина',position:'Администратор',approach:'Встречает владельцев и сверяет карточки.'}],
    stations: {desk:'Место врача',board:'Картотека',lead:'Ресепшен',records:'Зона подготовки',service:'Стол осмотра'} },
};

export const CAREER_STATIONS = ['desk','board','lead','records','service'] as const;
export const isCareer = (value: unknown): value is CareerId => typeof value === 'string' && Object.hasOwn(CAREERS, value);
export const isCareerPlace = (value: unknown): value is CareerPlace => CAREER_IDS.some(id => CAREERS[id].place === value);
export const careerAt = (place: CareerPlace): CareerId => CAREER_IDS.find(id => CAREERS[id].place === place)!;
export const dayOf = (time: number) => Math.floor(time / 1440);
export function shiftWindow(id: CareerId, day: number) {
  const spec = CAREERS[id];
  const weekday = day % 7;
  const start = day * 1440 + spec.start;
  return { day, start, end: start + spec.hours * 60, open: spec.days.includes(weekday),
    mode: (spec.remoteDays?.includes(weekday) ? 'remote' : 'office') as CareerMode };
}
export function nextCareerShift(id: CareerId, now: number, lastDay: number) {
  const day = dayOf(now);
  for (let i = day; i <= day + 7; i++) {
    const window = shiftWindow(id, i);
    if (window.open && window.end - 60 >= now && i > lastDay) return window;
  }
  return shiftWindow(id, day + 7);
}
export function rankRequirements(id: CareerId, rank: number): CareerRequirements {
  const keys = CAREERS[id].skills;
  const programs = id === 'it' ? 'tablica' : id === 'detail' ? 'plan' : id === 'marketing' ? 'design' : 'audit';
  return { professionId: id, positionId: String(rank),
    skills: rank ? { [keys[0]]: [0,2,4,6,9][rank], [keys[1]]: [0,1,3,5,7][rank], [keys[2]]: [0,0,2,4,6][rank] } : {},
    experience: [0,3,9,19,33][rank],
    ...(rank >= 3 && id !== 'clinic' ? { programs: [programs] } : {}),
    ...(rank === 4 || id === 'clinic' && rank >= 3 ? { certificates: [keys[0]] } : {}),
    ...(id === 'clinic' && rank >= 3 ? { conditions: ['Клинический практикум'] } : {}),
  };
}

export const DETAIL_SERVICES = {
  wash: {name:'Детейлинг-мойка',price:1400,minutes:45}, interior: {name:'Химчистка салона',price:4200,minutes:95},
  polish: {name:'Полировка кузова',price:6600,minutes:130}, coating: {name:'Защитное покрытие',price:7200,minutes:150},
  trim: {name:'Чистка элементов',price:900,minutes:25}, full: {name:'Комплексный детейлинг',price:11800,minutes:175},
} as const;
export interface DetailOrder {
  service: keyof typeof DETAIL_SERVICES; bay: 1 | 2; agreed: number; readyAt: number; delivered: boolean; loyalty: number;
}
export interface CampaignResult { budget: number; reach: number; engagement: number; leads: number }
export interface ClinicRecord { reference: number; observations: number; reviewed: boolean }
export interface ClinicAppointment { animalName: string; ownerId: CharacterId; scheduledAt: number; serviceId: string }
export const CLINIC_MODULES = ['Приём и безопасный маршрут', 'Наблюдения и карточка', 'Подготовка места', 'Работа с владельцем',
  'Проверка документации', 'Итоговый разбор с наставником'] as const;

export interface CareerHistory {
  id: number; at: number; title: string; text: string; choice?: string; author?: number; pay?: number; bonus?: number;
}
export interface CareerStoryProgress { stage: number; nextShift: number; outcome: number }
export interface CareerProgress {
  rank: number; shifts: number; qualityShifts: number; experience: number; reputation: number;
  productivity: number; duties: number; lastDay: number; evaluation: boolean;
  stories: Record<string, CareerStoryProgress>; seen: Record<string, number>; history: CareerHistory[];
  orders: DetailOrder[]; campaign?: CampaignResult; clinic?: ClinicRecord; clinicModules: number;
}
export interface CareerTask {
  nonce: number; event: string; phase: 'new' | 'walking' | 'ready' | 'checking' | 'working'; readyAt: number;
  deadline: number; choice?: number; story?: string; attempts?: number;
}
export interface CareerShift {
  id: number; career: CareerId; mode: CareerMode; day: number; startedAt: number; endsAt: number; regularEnd: number;
  late: number; overtime: boolean; completed: number; missed: number; score: number; nextTaskAt: number;
  station?: WorkStation; task?: CareerTask;
}
export interface CareerResident {
  contract: { career: CareerId; hiredAt: number } | null;
  shift: CareerShift | null; lastDay: number; progress: Partial<Record<CareerId, CareerProgress>>;
}
export interface CareersState { nextId: number; residents: Record<CharacterId, CareerResident> }
export const newCareerProgress = (): CareerProgress => ({
  rank: 0, shifts: 0, qualityShifts: 0, experience: 0, reputation: 50, productivity: 0, duties: 0,
  lastDay: -1, evaluation: false, stories: {}, seen: {}, history: [], orders: [], clinicModules: 0,
});
export function initialCareers(): CareersState {
  const resident = (): CareerResident => ({ contract: null, shift: null, lastDay: -1, progress: {} });
  return { nextId: 1, residents: { vlad: resident(), alina: resident() } };
}
export type CareerCommand =
  | { type: 'career_hire'; career: CareerId }
  | { type: 'career_resign' | 'career_start' | 'career_leave' | 'career_overtime' | 'career_promote' }
  | { type: 'career_approach'; nonce: number }
  | { type: 'career_choose' | 'career_verify'; nonce: number; choice: number };
