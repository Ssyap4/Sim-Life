/** The shared daily-life rules are data-only and safe for the client. */
export const GAME_MINUTES_PER_REAL_SECOND = 0.5; // One game day takes 48 real minutes.
export const INITIAL_CLOCK = { day: 1, minute: 8 * 60 };
export interface GameClock { day: number; minute: number }
export const MINUTES_PER_DAY = 1440;
export const CLOCK_SYNC_MS = 2000;
export interface ClockSample { minutes: number; multiplier: 0 | 1 | 1.5 | 2 | 3 }

export const GAME_DAYS_PER_MONTH=3;
export const GAME_DAYS_PER_YEAR=36;
/** Real dates are retained for labels, but each ten-day band is one simulated day. */
export const calendarSlot=(day:number)=>Math.min(3,Math.floor((day-1)/10)+1);
const months = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня',
  'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
const seasons = ['Зима', 'Весна', 'Лето', 'Осень'] as const;

export const gameMinutes = ({ day, minute }: GameClock) => (day - 1) * MINUTES_PER_DAY + minute;
export function clockAt(minutes: number): GameClock {
  return { day: Math.floor(minutes / MINUTES_PER_DAY) + 1, minute: Math.floor(minutes % MINUTES_PER_DAY) };
}

/** Each month contains three actual simulated days; day 1 is March, year 1. */
export function gameDate(day: number) {
  const offset=Math.max(0,Math.floor(day)-1),absoluteMonth=2+Math.floor(offset/GAME_DAYS_PER_MONTH),month=absoluteMonth%12;
  return {day:offset%GAME_DAYS_PER_MONTH+1,month:month+1,monthName:months[month],year:Math.floor(absoluteMonth/12)+1,season:seasons[Math.floor(((month+1)%12)/3)]};
}

/** Presentation only: ten calendar dates pass during one simulated day.
 * Do not use this number for bills, needs, weather or action cooldowns. */
export function displayDate(clock:GameClock){
  const slot=gameDate(clock.day);
  const first=(slot.day-1)*10+1;
  const last=slot.day===3?new Date(Date.UTC(2000+slot.year,slot.month,0)).getUTCDate():slot.day*10;
  const minute=Math.max(0,Math.min(MINUTES_PER_DAY-1,Math.floor(clock.minute)));
  return {...slot,day:first+Math.floor(minute*(last-first+1)/MINUTES_PER_DAY)};
}

export const INITIAL_DAILY_NEEDS = {
  hygiene: 82, social: 75, fun: 72, comfort: 80, bladder: 86,
};
export type DailyNeed = keyof typeof INITIAL_DAILY_NEEDS;
export type VitalNeed = 'hunger' | 'energy' | DailyNeed;
export const VITAL_NEEDS: readonly VitalNeed[] =
  ['hunger', 'energy', 'hygiene', 'bladder', 'social', 'fun', 'comfort'];

export const LOW_BLADDER = 30;

export const NEED_INFO: Record<VitalNeed, { label: string; emoji: string; hint: string }> = {
  hunger: { label: 'Сытость', emoji: '🍽️', hint: 'Приготовь еду и поешь' },
  energy: { label: 'Энергия', emoji: '🌙', hint: 'Поспи или отдохни' },
  bladder: { label: 'Нужда', emoji: '🚽', hint: 'Нужда низкая. Воспользуйся туалетом.' },
  hygiene: { label: 'Гигиена', emoji: '🫧', hint: 'Умойся и приведи себя в порядок' },
  social: { label: 'Общение', emoji: '❤️', hint: 'Обними, поговори или позвони близким' },
  fun: { label: 'Досуг', emoji: '🎲', hint: 'Почитай, посмотри кино или поиграй' },
  comfort: { label: 'Комфорт', emoji: '🏡', hint: 'Отдохни и наведи уют' },
};

export function timeLabel(clock: GameClock): string {
  const hours = Math.floor(clock.minute / 60);
  const minutes = Math.floor(clock.minute % 60);
  return String(hours).padStart(2, '0') + ':' + String(minutes).padStart(2, '0');
}
export function clockLabel(clock: GameClock): string {
  const date = displayDate(clock);
  return date.day + ' ' + date.monthName + ', год ' + date.year + ' · ' + timeLabel(clock);
}
export function dayPhase(clock: GameClock): 'night' | 'morning' | 'day' | 'evening' {
  const hour = clock.minute / 60;
  return hour < 6 || hour >= 22 ? 'night' : hour < 11 ? 'morning' : hour < 18 ? 'day' : 'evening';
}
