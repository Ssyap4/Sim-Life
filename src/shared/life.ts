/** The shared daily-life rules are data-only and safe for the client. */
export const GAME_MINUTES_PER_REAL_SECOND = 0.5; // One game day takes 48 real minutes.
export const INITIAL_CLOCK = { day: 1, minute: 8 * 60 };
export interface GameClock { day: number; minute: number }

export const INITIAL_DAILY_NEEDS = {
  hygiene: 82, social: 75, fun: 72, comfort: 80,
};
export type DailyNeed = keyof typeof INITIAL_DAILY_NEEDS;
export type VitalNeed = 'hunger' | 'energy' | DailyNeed;
export const VITAL_NEEDS: readonly VitalNeed[] =
  ['hunger', 'energy', 'hygiene', 'social', 'fun', 'comfort'];

export const NEED_INFO: Record<VitalNeed, { label: string; emoji: string; hint: string }> = {
  hunger: { label: 'Сытость', emoji: '🍽️', hint: 'Приготовь еду и поешь' },
  energy: { label: 'Энергия', emoji: '🌙', hint: 'Поспи или отдохни' },
  hygiene: { label: 'Гигиена', emoji: '🫧', hint: 'Умойся и приведи себя в порядок' },
  social: { label: 'Общение', emoji: '❤️', hint: 'Обними, поговори или позвони близким' },
  fun: { label: 'Досуг', emoji: '🎲', hint: 'Почитай, посмотри кино или поиграй' },
  comfort: { label: 'Комфорт', emoji: '🏡', hint: 'Отдохни и наведи уют' },
};

export function clockLabel(clock: GameClock): string {
  const hours = Math.floor(clock.minute / 60);
  const minutes = Math.floor(clock.minute % 60);
  return 'День ' + clock.day + ' · ' + String(hours).padStart(2, '0') +
    ':' + String(minutes).padStart(2, '0');
}
export function dayPhase(clock: GameClock): 'night' | 'morning' | 'day' | 'evening' {
  const hour = clock.minute / 60;
  return hour < 6 || hour >= 22 ? 'night' : hour < 11 ? 'morning' : hour < 18 ? 'day' : 'evening';
}
