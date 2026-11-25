import { GAME_MINUTES_PER_REAL_SECOND, gameMinutes as totalGameMinutes, type GameClock } from './life';
export { totalGameMinutes };
export interface ShiftAssignment {
  job: JobId;
  hours: number;
  startedAt: number;
  endsAt: number;
  /** Rolled on the server at shift start; optional only for compatibility with older saves. */
  targetPay?: number;
  homeDevice?: import("./computer").ComputerDevice;
  coffeeServed?: boolean; // one delivered cup per active home order
  homeSpeed?: number; // Percent duration reduction locked when accepting a home order.
  quests?: import("./homeJobQuests").HomeQuestRun[];
}


/** Non-career side gigs. All durations are full IN-GAME hours (48 real minutes per game day). */
export const JOBS = {
  taxi: {
    name: 'Таксист', emoji: '🚕', location: 'Город · таксопарк',
    payMin: 3700, payMax: 6700, hoursMin: 10, hoursMax: 12,
    energyCost: 26, hungerCost: 16, hygieneCost: 8,
    description: 'Принимай заказы в городе, встречай пассажиров, выбирай маршруты. Попадутся и короткие поездки, и длинный заказ в пригород.',
    stages: ['Получение автомобиля и проверка маршрутов','Утренние поездки по району','Дальние заказы и ожидание клиентов','Завершение смены и сдача машины'],
  },
  courier: {
    name: 'Курьер', emoji: '🛵', location: 'Город · доставки',
    payMin: 3200, payMax: 6000, hoursMin: 8, hoursMax: 10,
    energyCost: 26, hungerCost: 17, hygieneCost: 8,
    description: 'Собирай заказы в ресторанах и пунктах выдачи, доставляй их по адресам. Влияют количество заказов и расстояния.',
    stages: ['Получение сумки и первых заказов','Доставка по соседним улицам','Час пик: новые адреса','Последние доставки и сдача сумки'],
  },
  ozon: {
    name: 'Стикеровщик Ozon', emoji: '🏷️', location: 'Промзона · склад Ozon',
    payMin: 5000, payMax: 6800, hoursMin: 14, hoursMax: 16,
    energyCost: 36, hungerCost: 23, hygieneCost: 11,
    description: 'Принимай коробки на линии, сверяй маркировку, наклеивай штрихкоды и отправляй товары на сортировку.',
    stages: ['Инструктаж и рабочее место','Стикеровка первой партии','Проверка маркировки на конвейере','Последняя партия и сдача смены'],
  },
  wildberries: {
    name: 'Упаковщик Wildberries', emoji: '📦', location: 'Промзона · склад Wildberries',
    payMin: 5000, payMax: 6800, hoursMin: 14, hoursMax: 16,
    energyCost: 37, hungerCost: 22, hygieneCost: 11,
    description: 'Собирай заказ по накладной, проверяй товар, выбирай упаковку и передавай коробки на отправку.',
    stages: ['Инструктаж и накладные','Сборка заказов','Упаковка хрупких отправлений','Отгрузка и завершение смены'],
  },
  petsitter: {
    name: 'Зооняня', emoji: '🐾', location: 'Город · дома клиентов',
    payMin: 2300, payMax: 3300, hoursMin: 6, hoursMax: 7,
    energyCost: 17, hungerCost: 10, hygieneCost: 7,
    description: 'Навещай питомцев клиентов, корми их, гуляй и играй с ними, следи за самочувствием и отправляй владельцам отчёты.',
    stages: ['Знакомство с питомцами и инструкции','Кормление и прогулки','Игры и уход за питомцами','Отчёт владельцам и завершение смены'],
  },
  driver: {
    name: 'Личный водитель', emoji: '🚘', location: 'Город · частные поездки',
    payMin: 3200, payMax: 4500, hoursMin: 7, hoursMax: 8,
    energyCost: 20, hungerCost: 12, hygieneCost: 5,
    description: 'Встречай клиента, заранее проверяй маршрут, отвози его на встречи и жди между поездками. В конце смены сдавай автомобиль.',
    stages: ['Проверка автомобиля и расписания','Поездки по делам клиента','Ожидание и дополнительные адреса','Возвращение и сдача автомобиля'],
  },
  vibeSite: { name: "Лендинг под ключ", emoji: "💻", location: "Дом · компьютер", payMin: 2000, payMax: 3500, hoursMin: 3, hoursMax: 4, energyCost: 10, hungerCost: 7, hygieneCost: 2, description: "Небольшая кофейня ждёт адаптивный сайт с меню и формой заявки. Собери страницу с ИИ, исправь ошибки и передай рабочую ссылку.", stages: ["Бриф и структура","Вайбкодинг и интерфейс","Проверка мобильной версии","Передача проекта"] },
  vibeBot: { name: "Telegram-бот на заказ", emoji: "🤖", location: "Дом · компьютер", payMin: 2000, payMax: 3500, hoursMin: 3, hoursMax: 4, energyCost: 10, hungerCost: 7, hygieneCost: 2, description: "Магазину нужен бот для заявок и уведомлений. Настрой сценарии, проверь ответы и подготовь инструкцию.", stages: ["Сценарии бота","Разработка логики","Тестирование диалогов","Передача заказчику"] },
  videoEdit: { name: "Монтаж ролика", emoji: "🎬", location: "Дом · компьютер", payMin: 2000, payMax: 3500, hoursMin: 3, hoursMax: 4, energyCost: 10, hungerCost: 7, hygieneCost: 2, description: "Из исходников клиента собери динамичный ролик, подбери переходы, звук и титры.", stages: ["Разбор исходников","Монтаж таймлайна","Звук и цвет","Экспорт ролика"] },
  marketTrade: { name: "Биржевая аналитика", emoji: "📈", location: "Дом · компьютер", payMin: 2000, payMax: 3500, hoursMin: 3, hoursMax: 4, energyCost: 10, hungerCost: 7, hygieneCost: 2, description: "Подготовь обзор котировок и проведи учебную торговую сессию на виртуальном счёте клиента. Оплата за отчёт, без риска семейного бюджета.", stages: ["Обзор рынка","Виртуальные сделки","Проверка графиков","Отчёт клиенту"] },
  gameFix: { name: "Исправление багов игры", emoji: "🎮", location: "Дом · компьютер", payMin: 2000, payMax: 3500, hoursMin: 3, hoursMax: 4, energyCost: 10, hungerCost: 7, hygieneCost: 2, description: "Независимая студия прислала список ошибок прототипа. Воспроизведи их, исправь и отправь тестовую сборку.", stages: ["Воспроизведение ошибок","Исправления","Прогон тестов","Отправка сборки"] },
  automation: { name: "Автоматизация для бизнеса", emoji: "⚙️", location: "Дом · компьютер", payMin: 2000, payMax: 3500, hoursMin: 3, hoursMax: 4, energyCost: 10, hungerCost: 7, hygieneCost: 2, description: "Настрой обработку заявок и автоматический отчёт для небольшой компании.", stages: ["Изучение процесса","Настройка автоматизации","Проверка данных","Документация"] },
  wbCards: { name: "Карточки Wildberries", emoji: "🛍️", location: "Дом · компьютер", payMin: 2000, payMax: 3500, hoursMin: 3, hoursMax: 4, energyCost: 10, hungerCost: 7, hygieneCost: 2, description: "Создай привлекательные карточки товаров: обработай фото, собери инфографику и напиши понятные преимущества.", stages: ["Анализ товаров","Дизайн карточек","Описание и ключевые слова","Отправка макетов"] },
  ozonCards: { name: "Карточки Ozon", emoji: "📦", location: "Дом · компьютер", payMin: 2000, payMax: 3500, hoursMin: 3, hoursMax: 4, energyCost: 10, hungerCost: 7, hygieneCost: 2, description: "Оформи новую линейку товаров для магазина: характеристики, изображения, описание и проверка публикации.", stages: ["Изучение ассортимента","Подготовка изображений","Заполнение характеристик","Проверка карточек"] },
  hairLesson: { name: "Онлайн-урок по реконструкции волос", emoji: "💇", location: "Дом · компьютер", payMin: 2000, payMax: 3500, hoursMin: 3, hoursMax: 4, energyCost: 10, hungerCost: 7, hygieneCost: 2, description: "Проведи занятие для начинающих мастеров: разбор структуры волос, подбор ухода и ответы на вопросы учениц.", stages: ["Подготовка материалов","Объяснение теории","Разбор примеров","Вопросы и обратная связь"] },
  support: { name: "Оператор поддержки", emoji: "🎧", location: "Дом · компьютер", payMin: 2000, payMax: 3500, hoursMin: 3, hoursMax: 4, energyCost: 10, hungerCost: 7, hygieneCost: 2, description: "Помоги покупателям интернет-магазина: отвечай в чате, уточняй статусы и передавай сложные обращения специалистам.", stages: ["Очередь обращений","Ответы клиентам","Разбор сложных вопросов","Отчёт по обращениям"] },
  socialDesign: { name: "Оформление соцсетей", emoji: "🎨", location: "Дом · компьютер", payMin: 2000, payMax: 3500, hoursMin: 3, hoursMax: 4, energyCost: 10, hungerCost: 7, hygieneCost: 2, description: "Подготовь набор публикаций для студии красоты: визуальная концепция, обложки и тексты.", stages: ["Бриф студии","Дизайн обложек","Тексты публикаций","Передача контента"] },
  hairConsult: { name: "Онлайн-консультации по уходу", emoji: "📝", location: "Дом · компьютер", payMin: 2000, payMax: 3500, hoursMin: 3, hoursMax: 4, energyCost: 10, hungerCost: 7, hygieneCost: 2, description: "Разбери анкеты клиентов, составь индивидуальные рекомендации по косметическому уходу и отправь памятки.", stages: ["Анкеты клиентов","Разбор состояния волос","Подбор ухода","Отправка памяток"] },
  // Retired jobs remain readable ONLY for finishing shifts from old saves.
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
export const HOME_JOBS = {"vibeSite":{"owner":"vlad","style":"code","animation":0},"vibeBot":{"owner":"vlad","style":"code","animation":1},"videoEdit":{"owner":"vlad","style":"video","animation":2},"marketTrade":{"owner":"vlad","style":"trade","animation":3},"gameFix":{"owner":"vlad","style":"code","animation":4},"automation":{"owner":"vlad","style":"notes","animation":5},"wbCards":{"owner":"alina","style":"design","animation":6},"ozonCards":{"owner":"alina","style":"design","animation":7},"hairLesson":{"owner":"alina","style":"hair","animation":8},"support":{"owner":"alina","style":"mail","animation":9},"socialDesign":{"owner":"alina","style":"design","animation":10},"hairConsult":{"owner":"alina","style":"hair","animation":11}} as const;
export type HomeJobId = keyof typeof HOME_JOBS;
export function isHomeJob(id:unknown):id is HomeJobId {return typeof id==="string" && Object.hasOwn(HOME_JOBS,id);}
export const homeJobsFor=(role: "vlad"|"alina")=>(Object.keys(HOME_JOBS) as HomeJobId[]).filter(id=>HOME_JOBS[id].owner===role);
export const JOB_IDS = ['taxi','courier','ozon','wildberries','petsitter','driver'] as const satisfies readonly JobId[];
export function isOfferedJob(id:unknown):id is typeof JOB_IDS[number]{return JOB_IDS.some(job=>job===id);}
export function isJobId(id: unknown): id is JobId {
  return typeof id === 'string' && Object.prototype.hasOwnProperty.call(JOBS,id);
}
const OLD_PAY:Partial<Record<JobId,readonly [number,number]>>={taxi:[2500,4500],courier:[2300,4300],ozon:[2500,5250],wildberries:[2400,5400]};
export function validShiftPay(id:JobId,pay:unknown):boolean{
 const spec=JOBS[id],old=OLD_PAY[id];
 return typeof pay==='number'&&Number.isSafeInteger(pay)&&((pay>=spec.payMin&&pay<=spec.payMax)||!!old&&pay>=old[0]&&pay<=old[1]);
}
/** Compatibility for shifts created before early-leave payments existed.
 * Computes a stable value, so old assignments cannot reroll on reconnect. */
export function shiftFullPay(shift: ShiftAssignment): number {
  const spec=JOBS[shift.job];
  if(validShiftPay(shift.job,shift.targetPay))return shift.targetPay!;
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
