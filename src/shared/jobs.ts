import { GAME_MINUTES_PER_REAL_SECOND, gameMinutes as totalGameMinutes, type GameClock } from './life';
export { totalGameMinutes };
export interface ShiftAssignment {
  job: JobId;
  hours: number;
  startedAt: number;
  endsAt: number;
  /** Rolled on the server at shift start; optional only for compatibility with older saves. */
  targetPay?: number;
}


/** Non-career side gigs. All durations are full IN-GAME hours (48 real minutes per game day). */
export const JOBS = {
  taxi: {
    name: 'Таксист', emoji: '🚕', location: 'Город · таксопарк',
    payMin: 2500, payMax: 4500, hoursMin: 10, hoursMax: 12,
    energyCost: 26, hungerCost: 16, hygieneCost: 8,
    description: 'Принимай заказы в городе, встречай пассажиров, выбирай маршруты. Попадутся и короткие поездки, и длинный заказ в пригород.',
    stages: ['Получение автомобиля и проверка маршрутов','Утренние поездки по району','Дальние заказы и ожидание клиентов','Завершение смены и сдача машины'],
  },
  courier: {
    name: 'Курьер', emoji: '🛵', location: 'Город · доставки',
    payMin: 2300, payMax: 4300, hoursMin: 8, hoursMax: 10,
    energyCost: 26, hungerCost: 17, hygieneCost: 8,
    description: 'Собирай заказы в ресторанах и пунктах выдачи, доставляй их по адресам. Влияют количество заказов и расстояния.',
    stages: ['Получение сумки и первых заказов','Доставка по соседним улицам','Час пик: новые адреса','Последние доставки и сдача сумки'],
  },
  ozon: {
    name: 'Стикеровщик Ozon', emoji: '🏷️', location: 'Склад Ozon',
    payMin: 2500, payMax: 5250, hoursMin: 14, hoursMax: 16,
    energyCost: 36, hungerCost: 23, hygieneCost: 11,
    description: 'Принимай коробки на линии, сверяй маркировку, наклеивай штрихкоды и отправляй товары на сортировку.',
    stages: ['Инструктаж и рабочее место','Стикеровка первой партии','Проверка маркировки на конвейере','Последняя партия и сдача смены'],
  },
  wildberries: {
    name: 'Упаковщик Wildberries', emoji: '📦', location: 'Склад Wildberries',
    payMin: 2400, payMax: 5400, hoursMin: 14, hoursMax: 16,
    energyCost: 37, hungerCost: 22, hygieneCost: 11,
    description: 'Собирай заказ по накладной, проверяй товар, выбирай упаковку и передавай коробки на отправку.',
    stages: ['Инструктаж и накладные','Сборка заказов','Упаковка хрупких отправлений','Отгрузка и завершение смены'],
  },
  barista: {
    name: 'Помощник бариста', emoji: '☕', location: 'Кофейня у метро',
    payMin: 2200, payMax: 3600, hoursMin: 7, hoursMax: 9,
    energyCost: 19, hungerCost: 12, hygieneCost: 7,
    description: 'Готовь напитки по карточкам, выдавай кофе с собой, общайся с гостями и помогай закрыть кофейню.',
    stages: ['Подготовка кофемашины и витрины','Утренний поток гостей','Заказы на вынос','Уборка стойки и расчёт'],
  },
  inventory: {
    name: 'Сотрудник инвентаризации', emoji: '📋', location: 'Ночной пересчёт магазина',
    payMin: 2600, payMax: 4100, hoursMin: 9, hoursMax: 11,
    energyCost: 23, hungerCost: 14, hygieneCost: 6,
    description: 'Сканируй остатки, считай коробки на полках, ищи расхождения и передавай сводку старшему смены.',
    stages: ['Получение сканера и списка зон','Подсчёт стеллажей','Поиск расхождений по остаткам','Сводка и сдача оборудования'],
  },
} as const;
export type JobId = keyof typeof JOBS;
export const JOB_IDS = Object.keys(JOBS) as JobId[];
export function isJobId(id: unknown): id is JobId {
  return typeof id === 'string' && Object.prototype.hasOwnProperty.call(JOBS,id);
}
/** Compatibility for shifts created before early-leave payments existed.
 * Computes a stable value, so old assignments cannot reroll on reconnect. */
export function shiftFullPay(shift: ShiftAssignment): number {
  const spec=JOBS[shift.job];
  if(Number.isSafeInteger(shift.targetPay) &&
     shift.targetPay!>=spec.payMin && shift.targetPay!<=spec.payMax) return shift.targetPay!;
  let hash=(shift.startedAt*17+shift.hours*101)>>>0;
  for(const char of shift.job)hash=(Math.imul(hash,31)+char.charCodeAt(0))>>>0;
  return spec.payMin+(hash%(spec.payMax-spec.payMin+1));
}
export function shiftWorkedMinutes(shift: ShiftAssignment, clock: GameClock): number {
  return Math.max(0,Math.min(shift.endsAt-shift.startedAt,totalGameMinutes(clock)-shift.startedAt));
}
export function shiftWage(shift: ShiftAssignment, clock: GameClock): number {
  const duration=shift.endsAt-shift.startedAt;
  if(duration<=0)return 0;
  return Math.round(shiftFullPay(shift)*shiftWorkedMinutes(shift,clock)/duration);
}
export function gameHoursToRealMs(hours: number): number {
  return Math.round(hours * 60 / GAME_MINUTES_PER_REAL_SECOND * 1000);
}
export function stageForJob(id: JobId, progress: number): string {
  const stages=JOBS[id].stages;
  return stages[Math.min(stages.length-1, Math.max(0,Math.floor(progress*stages.length)))];
}
