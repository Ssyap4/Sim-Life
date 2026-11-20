import { initialWorld, spawn, type LocalActivity, type PlaceId, type Point, type WorldCommand, type WorldState } from './locations';
import { EMPTY_MEALS, EMPTY_PANTRY, EMPTY_TAKEOUT, type CookedMeals, type Pantry, type TakeoutStock } from './food';
import type { LedgerEntry } from './economy';
import type { ShiftAssignment } from './jobs';
import { INITIAL_PETS, INITIAL_PET_FOOD, type PetFamily, type PetFoodStock } from './pets';
import { INITIAL_CLOCK, INITIAL_DAILY_NEEDS, type GameClock } from './life';
import { BATH_FIXTURES, HOME_PLACEMENTS, KITCHEN_WORK, type BathFixture, type HomeLeisure } from './home';
import type { WalkRoute } from '../game/navigation';
export type { PetId, PetAction } from './pets';
export type { IngredientId, RecipeId } from './food';

export type CharacterId = 'vlad' | 'alina';
export type Pose = 'idle' | 'sit' | 'sleep' | 'work';
export type ItemId = 'sofa' | 'bed' | 'desk' | 'kitchen' | 'tv' | 'table' | BathFixture | 'delivery';
export type SocialKind = 'hug' | 'highFive';
export const SOCIAL_LABELS: Record<SocialKind, string> = {
  hug: 'Обняться', highFive: 'Дать пять',
};
// Open shared space in the living room; both clients animate towards the same spots.
export const SOCIAL_SPOTS: Record<CharacterId, { x: number; z: number }> = {
  vlad: { x: -0.42, z: 2.38 },
  alina: { x: 0.42, z: 2.38 },
};

export interface Needs {
  hunger: number;
  energy: number;
  mood: number;
  skill: number;
  hygiene: number;
  social: number;
  fun: number;
  comfort: number;
  bladder: number;
}
export interface CharacterState extends Needs {
  x: number;
  z: number;
  pose: Pose;
}
export interface GameState {
  version: 2;
  revision: number;
  clock: GameClock;
  world: WorldState;
  money: number;
  pantry: Pantry;
  meals: CookedMeals;
  takeout: TakeoutStock;
  ledger: LedgerEntry[];
  shiftDays: Record<CharacterId, number>;
  activeShifts: Partial<Record<CharacterId, ShiftAssignment>>;
  pets: PetFamily;
  petFood: PetFoodStock;
  characters: Record<CharacterId, CharacterState>;
}

export const names: Record<CharacterId, string> = { vlad: 'Влад', alina: 'Алина' };
export const itemNames: Record<ItemId, string> = {
  sofa: 'Уютный диван', bed: 'Двуспальная кровать', desk: 'Рабочее место',
  kitchen: 'Кухня', tv: 'Телевизор', table: 'Обеденный стол',
  delivery: 'Магазин и доставка',
  toilet: 'Туалет', shower: 'Душевая', bathtub: 'Ванна', basin: 'Раковина в ванной',
};
export const points: Record<Exclude<ItemId, 'delivery'>, { x: number; z: number }> = {
  sofa: { x: HOME_PLACEMENTS.sofa.x, z: HOME_PLACEMENTS.sofa.z - 1.10 },
  bed: { x: HOME_PLACEMENTS.bed.x, z: HOME_PLACEMENTS.bed.z + 1.95 },
  desk: { x: HOME_PLACEMENTS.desk.x, z: HOME_PLACEMENTS.desk.z + 2.04 },
  kitchen: KITCHEN_WORK.stove.position,
  tv: { x: HOME_PLACEMENTS.tv.x + 1.53, z: HOME_PLACEMENTS.tv.z + .63 },
  table: { x: HOME_PLACEMENTS.table.x, z: HOME_PLACEMENTS.table.z + 1.14 },
  toilet: BATH_FIXTURES.toilet.approach, shower: BATH_FIXTURES.shower.approach,
  bathtub: BATH_FIXTURES.bathtub.approach, basin: BATH_FIXTURES.basin.approach,
};

export interface ActionDefinition {
  label: string;
  item: ItemId;
  pose: Pose;
  role?: CharacterId;
}
export const ACTIONS = {
  sofaRest: { label: '🛋️ Отдохнуть', item: 'sofa', pose: 'sit' },
  sofaMovie: { label: '🎬 Посмотреть фильм (диван + ТВ)', item: 'sofa', pose: 'sit' },
  sofaRead: { label: '📖 Почитать книгу', item: 'sofa', pose: 'sit' },
  sofaMusic: { label: '🎵 Послушать музыку', item: 'sofa', pose: 'sit' },
  sofaCall: { label: '📱 Позвонить близким', item: 'sofa', pose: 'sit' },
  bedSleep: { label: '🌙 Поспать', item: 'bed', pose: 'sleep' },
  bedNap: { label: '😴 Вздремнуть', item: 'bed', pose: 'sleep' },
  bedMake: { label: '🛏️ Заправить кровать', item: 'bed', pose: 'idle' },
  bedStretch: { label: '🌅 Утренняя зарядка', item: 'bed', pose: 'idle' },
  vladOrder: { label: '💻 Учебная практика без оплаты', item: 'desk', pose: 'work', role: 'vlad' },
  vladStudy: { label: '📚 Учиться разработке', item: 'desk', pose: 'work', role: 'vlad' },
  deskGames: { label: '🎮 Поиграть на компьютере', item: 'desk', pose: 'work' },
  deskJournal: { label: '📝 Записать мысли', item: 'desk', pose: 'work' },
  alinaStudy: { label: '📖 Изучить реконструкцию волос', item: 'desk', pose: 'work', role: 'alina' },
  alinaConsult: { label: '📋 Тренировка общения с клиентами', item: 'desk', pose: 'work', role: 'alina' },
  kitchenWash: { label: '🫧 Умыться у раковины', item: 'kitchen', pose: 'idle' },
  kitchenTidy: { label: '🧽 Убрать кухню', item: 'kitchen', pose: 'idle' },
  kitchenTea: { label: '🍵 Заварить чай', item: 'kitchen', pose: 'idle' },
  watchTv: { label: '📺 Смотреть передачу', item: 'tv', pose: 'idle' },
  tvMusic: { label: '🎶 Послушать концерт', item: 'tv', pose: 'idle' },
  tableRest: { label: '☕ Посидеть за столом', item: 'table', pose: 'sit' },
  tableTalk: { label: '💬 Пообщаться в переписке', item: 'table', pose: 'sit' },
  tablePlan: { label: '📒 Спланировать день', item: 'table', pose: 'sit' },
  toiletUse: { label: '🚽 Воспользоваться туалетом', item: 'toilet', pose: 'idle' },
  bathShower: { label: '🚿 Принять душ', item: 'shower', pose: 'idle' },
  bathSoak: { label: '🛁 Принять ванну', item: 'bathtub', pose: 'idle' },
  bathWash: { label: '🫧 Умыться', item: 'basin', pose: 'idle' },
} as const satisfies Record<string, ActionDefinition>;
export type ActionId = keyof typeof ACTIONS;

export type TimedCommand =
  | { type: 'local_activity'; action: LocalActivity; station: string }
  | { type: 'act'; actionId: ActionId }
  | { type: 'cook' | 'eat'; recipe: import('./food').RecipeId }
  | { type: 'eat_takeout'; item: import('./food').TakeoutId }
  | { type: 'pet_action'; pet: import('./pets').PetId; action: Exclude<import('./pets').PetAction, 'buyFood'> };

export type ClientPacket = WorldCommand
  | { type: 'resume'; role: CharacterId; token: string }
  | { type: 'forget_device' }
  | { type: 'auth'; role: CharacterId; code: string; remember?: boolean }
  | { type: 'act'; actionId: ActionId }
  | { type: 'buy'; item: import('./food').IngredientId }
  | { type: 'checkout'; lines: import('./market').BasketLine[] }
  | { type: 'job_start'; job: import('./jobs').JobId }
  | { type: 'job_cancel' } // compatibility with the first job-board prototype
  | { type: 'job_leave_early' }
  | { type: 'shift_speed'; enabled: boolean }
  | { type: 'sleep_start'; mode: import('./timeControl').SleepMode }
  | { type: 'sleep_stop' }
  | { type: 'eat_takeout'; item: import('./food').TakeoutId }
  | { type: 'cook'; recipe: import('./food').RecipeId }
  | { type: 'eat'; recipe: import('./food').RecipeId }
  | { type: 'social_offer'; kind: SocialKind }
  | { type: 'pet_action'; pet: import('./pets').PetId; action: import('./pets').PetAction }
  | { type: 'cancel_task'; taskId: number };

export type ServerPacket =
  | { type: 'time_status'; status: import('./timeControl').TimeStatus }
  | { type: 'storage_event'; role: CharacterId; station?: string }
  | { type: 'home_leisure'; roles: CharacterId[]; activity: HomeLeisure | null; routes: Partial<Record<CharacterId, WalkRoute>> }
  | { type: 'device_token'; role: CharacterId; token: string }
  | { type: 'world_path'; role: CharacterId; place: PlaceId; path: Point[]; station?: string }
  | { type: 'world_event'; role: CharacterId; message: string }
  | { type: 'delivery_arrived' }
  | { type: 'ready'; role: CharacterId; state: GameState; online: CharacterId[] }
  | { type: 'snapshot'; state: GameState }
  | { type: 'online'; online: CharacterId[] }
  | { type: 'action'; role: CharacterId; actionId: ActionId; message: string }
  | { type: 'food_event'; role: CharacterId; action: 'buy' | 'cook' | 'eat'; message: string }
  | { type: 'store_event'; role: CharacterId; message: string }
  | { type: 'job_event'; role: CharacterId; outcome: 'started' | 'finished' | 'left_early'; message: string }
  | { type: 'social_start'; kind: SocialKind; message: string }
  | { type: 'pet_event'; role: CharacterId; pet: import('./pets').PetId; action: import('./pets').PetAction; message: string }
  | { type: 'task_started'; role: CharacterId; taskId: number; label: string; durationMs: number; command: TimedCommand; automatic?: boolean }
  | { type: 'task_ended'; role: CharacterId; taskId: number; outcome: 'completed' | 'cancelled' | 'failed'; message: string }
  | { type: 'error'; reason: string };

export function initialState(): GameState {
  return {
    version: 2, revision: 0, world: initialWorld(), clock: { ...INITIAL_CLOCK }, money: 2500,
    pantry: { ...EMPTY_PANTRY, eggs: 4, bread: 3 }, meals: { ...EMPTY_MEALS },
    takeout: { ...EMPTY_TAKEOUT }, ledger: [], shiftDays: { vlad: 0, alina: 0 }, activeShifts: {},
    pets: structuredClone(INITIAL_PETS), petFood: { ...INITIAL_PET_FOOD },
    characters: {
      vlad: { hunger: 78, energy: 82, mood: 74, skill: 0, ...INITIAL_DAILY_NEEDS, ...spawn('home', 'vlad'), pose: 'idle' },
      alina: { hunger: 82, energy: 86, mood: 81, skill: 0, ...INITIAL_DAILY_NEEDS, ...spawn('home', 'alina'), pose: 'idle' },
    },
  };
}
