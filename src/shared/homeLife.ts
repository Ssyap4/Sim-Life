import type { WalkRoute } from '../game/navigation';
import type { BathFixture } from './home';
import type { Needs } from './protocol';

export const GENRES = {
  horror: '👻 Хоррор', drama: '🎭 Драма', crime: '🕵️ Криминал',
  thriller: '🔪 Триллер', action: '💥 Боевик', comedy: '😂 Комедия', romance: '❤️ Мелодрама',
} as const;
export type Genre = keyof typeof GENRES;
export const YOUTUBE = ['pets', 'vlog', 'travel', 'tech', 'cooking'] as const;
export type Program = Genre | (typeof YOUTUBE)[number] | 'broadcast' | 'concert';

export const BOOKS = {
  master: ['Мастер и Маргарита', 'Михаил Булгаков', 'Мистический роман', 120, '#7d4749'],
  crime: ['Преступление и наказание', 'Фёдор Достоевский', 'Психологический роман', 115, '#664f5c'],
  orwell: ['1984', 'Джордж Оруэлл', 'Антиутопия', 100, '#536572'],
  prince: ['Маленький принц', 'Антуан де Сент-Экзюпери', 'Повесть-сказка', 40, '#af7a42'],
  potter: ['Гарри Поттер и философский камень', 'Дж. К. Роулинг', 'Фэнтези', 90, '#8a5353'],
  comrades: ['Три товарища', 'Эрих Мария Ремарк', 'Драма', 105, '#6c734c'],
  express: ['Убийство в Восточном экспрессе', 'Агата Кристи', 'Детектив', 80, '#794f3b'],
  pride: ['Гордость и предубеждение', 'Джейн Остин', 'Роман о любви', 95, '#9d5b70'],
  dune: ['Дюна', 'Фрэнк Герберт', 'Научная фантастика', 120, '#aa643c'],
  holmes: ['Шерлок Холмс: Собака Баскервилей', 'Артур Конан Дойл', 'Детектив', 75, '#515a62'],
  flowers: ['Цветы для Элджернона', 'Дэниел Киз', 'Научная фантастика', 85, '#546c66'],
  musketeers: ['Три мушкетёра', 'Александр Дюма', 'Историческое приключение', 110, '#435c7c'],
  eightyDays: ['Вокруг света за 80 дней', 'Жюль Верн', 'Приключения', 80, '#996c4f'],
  treasure: ['Остров сокровищ', 'Роберт Льюис Стивенсон', 'Приключения', 75, '#55756a'],
  martian: ['Марсианин', 'Энди Вейер', 'Научная фантастика', 100, '#a2604a'],
  monteCristo: ['Граф Монте-Кристо', 'Александр Дюма', 'Исторический роман', 120, '#56567b'],
} as const;
export type BookId = keyof typeof BOOKS;
export const READING_SKILL_PREVIEW = { skill: 'logic', label: 'Логика', percent: 1 } as const;
export const readingSkillLabel = () => READING_SKILL_PREVIEW.label + ' +' + READING_SKILL_PREVIEW.percent + '%';
export const HOME_SECONDS = { teeth: 18, foamBath: 75, shower: 38, youtube: 40, movie: 120, freeTv: 60 } as const;
export const READING_REWARD = { fun: 60, comfort: 10 } as const;
export type NeedKey = Exclude<keyof Needs, 'skill'>;
export type NeedEffects = Partial<Record<NeedKey, number>>;

export type Entertainment =
  | { type: 'youtube' }
  | { type: 'free_tv' }
  | { type: 'movie'; genre: Genre }
  | { type: 'read_book'; book: BookId; seat?: 'officeChair' };
export const HOME_SEATS = ['sofa','officeChair','table','yardTable'] as const;
export type HomeSeat = (typeof HOME_SEATS)[number];
export type HomePresentation = {
  route: WalkRoute;
  pickup?: number;
  pickupMs?: number;
  station: HomeSeat | BathFixture | 'grill';
  program?: Program;
};
