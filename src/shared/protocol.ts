import { initialRelationship, type Relationship, type SocialCommand, type SocialIntent, type SocialOffer, type SocialPhase } from './socialLife';
import { INITIAL_AUTONOMY, type AutonomyMode, type AutonomySettings } from './autonomy';
import { initialEducation, type EducationCommand, type EducationState } from './education';
import { initialCareers, type CareerCommand, type CareersState } from './careers';
import { initialComputerLibrary, type ComputerLibrary, type ComputerGameId, type VideoClipId } from './computerGames';
import type { ComputerDevice } from './computer';
import { initialServices, type FamilyServices, type ServiceCommand } from './services';
import { initialWorld, spawn, type LocalActivity, type PlaceId, type Point, type WorldCommand, type WorldState } from './locations';
import { EMPTY_MEALS, EMPTY_PANTRY, EMPTY_TAKEOUT, type CookedMeals, type Pantry, type TakeoutStock } from './food';
import { newCoffeeDaily, type CoffeeDaily, type InstantCoffeeId } from './coffee';
import type { ReadyFoodBatch } from './readyFood';
import { EMPTY_DIRTY_DISHES, type DirtyDishes } from './dirtyDishes';
import type { LedgerEntry } from './economy';
import { initialFamilyBudget, type FamilyBudget, type BudgetCommand } from './familyBudget';
import { emptyFurnishing, type FurnishingState } from './furniture';
import type { FurnishingCommand } from './furniture';
import type { FurnitureUseCommand } from './furnitureUse';
import type { ShiftAssignment } from './jobs';
import { INITIAL_PETS, INITIAL_PET_FOOD, INITIAL_PET_BOWLS, type PetFamily, type PetFoodStock, type PetBowlStock } from './pets';
import { INITIAL_CLOCK, INITIAL_DAILY_NEEDS, gameMinutes, type ClockSample, type GameClock } from './life';
import { BATH_FIXTURES, GRILL_WORK, LIBRARY_APPROACH, HOME_PLACEMENTS, KITCHEN_WORK, homeSeat, type BathFixture, type HomeLeisure } from './home';
import type { BookId, Entertainment, Genre, HomePresentation, NeedEffects } from './homeLife';
import type { WalkRoute } from '../game/navigation';
export type { PetId, PetAction } from './pets';
export type { IngredientId, RecipeId } from './food';

export type CharacterId = 'vlad' | 'alina';
export type Pose = 'idle' | 'sit' | 'sleep' | 'work';
export type ItemId = 'sofa' | 'bed' | 'desk' | 'kitchen' | 'tv' | 'table' | BathFixture | 'delivery' | 'bookcase' | 'officeChair' | 'grill' | 'yardTable' | 'coffeeMaker' | 'kettle';
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
  /** Installed bed currently used for sleep; absent for older households. */
  sleepingOn?: import('./bedSleep').SleepBedId;
  /** Keeps the chosen half/full sleep goal through a server restart. */
  sleepMode?: import('./timeControl').SleepMode;
}
export interface GameState {
  version: 2;
  revision: number;
  clock: GameClock;
  world: WorldState;
  money: number;
  furnishing: FurnishingState;
  billing: FamilyServices;
  pantry: Pantry;
  meals: CookedMeals;
  takeout: TakeoutStock;
  readyFood: ReadyFoodBatch[];
  dirtyDishes: DirtyDishes;
  ledger: LedgerEntry[];
  savings: FamilyBudget;
  shiftDays: Record<CharacterId, number>;
  activeShifts: Partial<Record<CharacterId, ShiftAssignment>>;
  pets: PetFamily;
  petFood: PetFoodStock;
  petBowls: PetBowlStock;
  readBooks: Record<CharacterId, BookId[]>;
  education: EducationState;
  careers: CareersState;
  computerLibrary: Record<CharacterId, ComputerLibrary>;
  relationship: Relationship;
  autonomy: AutonomySettings;
  coffeeDaily: CoffeeDaily;
  characters: Record<CharacterId, CharacterState>;
}

export const names: Record<CharacterId, string> = { vlad: 'Влад', alina: 'Алина' };
export const itemNames: Record<ItemId, string> = {
  bookcase: '📚 Домашняя библиотека',
  officeChair: 'Кресло в кабинете',
  sofa: 'Уютный диван', bed: 'Двуспальная кровать', desk: 'Рабочее место',
  kitchen: 'Кухня', kettle: '🍵 Чайник', coffeeMaker: '☕ Кофеварка', tv: 'Телевизор', table: 'Обеденный стол',
  grill: 'Дворовый гриль', yardTable: 'Стол во дворе', wcBasin: 'Раковина в туалете',
  delivery: 'Магазин и доставка',
  toilet: 'Туалет', shower: 'Душевая', bathtub: 'Ванна', basin: 'Раковина в ванной',
};
export const points: Record<Exclude<ItemId, 'delivery'>, { x: number; z: number }> = {
  bookcase: LIBRARY_APPROACH,
  officeChair: homeSeat('officeChair', 'vlad').approach,
  sofa: { x: HOME_PLACEMENTS.sofa.x, z: HOME_PLACEMENTS.sofa.z - 1.10 },
  bed: { x: HOME_PLACEMENTS.bed.x, z: HOME_PLACEMENTS.bed.z + 1.95 },
  desk: { x: HOME_PLACEMENTS.desk.x, z: HOME_PLACEMENTS.desk.z + 2.04 },
  kitchen: KITCHEN_WORK.stove.position, kettle: KITCHEN_WORK.tea.position, coffeeMaker: KITCHEN_WORK.coffee.position,
  grill: GRILL_WORK.position, yardTable: homeSeat('yardTable', 'vlad').approach,
  tv: { x: HOME_PLACEMENTS.tv.x + 1.53, z: HOME_PLACEMENTS.tv.z + .63 },
  table: { x: HOME_PLACEMENTS.table.x, z: HOME_PLACEMENTS.table.z + 1.14 },
  toilet: BATH_FIXTURES.toilet.approach, shower: BATH_FIXTURES.shower.approach,
  bathtub: BATH_FIXTURES.bathtub.approach, basin: BATH_FIXTURES.basin.approach, wcBasin: BATH_FIXTURES.wcBasin.approach,
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
  officeChairSit: { label: 'Посидеть в кресле', item: 'officeChair', pose: 'sit' },
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
  kitchenDishes: { label: '🫧 Помыть грязную посуду', item: 'kitchen', pose: 'idle' },
  kitchenLeftovers: { label: '🧊 Убрать оставшуюся еду в холодильник', item: 'kitchen', pose: 'idle' },
  kitchenServe: { label: '🍽️ Накрыть стол готовой едой', item: 'kitchen', pose: 'idle' },
  kitchenTea: { label: '🍵 Заварить чай', item: 'kitchen', pose: 'idle' },
  watchTv: { label: '📺 Смотреть передачу', item: 'tv', pose: 'sit' },
  tvMusic: { label: '🎶 Послушать концерт', item: 'tv', pose: 'sit' },
  tableRest: { label: '☕ Посидеть за столом', item: 'table', pose: 'sit' },
  tableTalk: { label: '💬 Пообщаться в переписке', item: 'table', pose: 'sit' },
  tablePlan: { label: '📒 Спланировать день', item: 'table', pose: 'sit' },
  toiletUse: { label: '🚽 Воспользоваться туалетом', item: 'toilet', pose: 'idle' },
  wcWash: { label: 'Помыть руки', item: 'wcBasin', pose: 'idle' },
  bathShower: { label: '🚿 Принять душ', item: 'shower', pose: 'idle' },
  bathSoak: { label: '🛁 Принять ванну', item: 'bathtub', pose: 'idle' },
  bathTeeth: { label: '🪥 Почистить зубы', item: 'basin', pose: 'idle' },
  bathFoam: { label: '🫧 Принять пенную ванну', item: 'bathtub', pose: 'idle' },
  bathWash: { label: '🫧 Умыться', item: 'basin', pose: 'idle' },
} as const satisfies Record<string, ActionDefinition>;
export type ActionId = keyof typeof ACTIONS;

export type TimedCommand = Entertainment | FurnitureUseCommand | SocialIntent
  | Extract<EducationCommand, { type: 'study' }>
  | { type: 'local_activity'; action: LocalActivity; station: string }
  | { type: 'act'; actionId: ActionId; computer?: import('./computer').ComputerDevice }
  | { type: 'play_game'; game: ComputerGameId; device: ComputerDevice; furnitureId?:number }
  | { type: 'computer_video'; clip: VideoClipId; device: ComputerDevice; furnitureId?:number }
  | { type: 'cook' | 'eat'; recipe: import('./food').RecipeId; furnitureId?:number }
  | { type: 'eat_takeout'; item: import('./food').TakeoutId; furnitureId?:number }
  | { type: 'brew_coffee'; blend: InstantCoffeeId }
  | { type: 'pet_action'; pet: import('./pets').PetId; action: Exclude<import('./pets').PetAction, 'buyFood' | 'call' | 'perch' | 'fetch' | 'mat' | 'scratch'> };

export type ClientPacket = FurnishingCommand | FurnitureUseCommand | WorldCommand | Entertainment | ServiceCommand | BudgetCommand | EducationCommand | CareerCommand | SocialCommand
  | { type: 'movie_invite'; genre: Genre }
  | { type: 'movie_reply'; inviteId: number; accept: boolean }
  | { type: 'movie_withdraw'; inviteId: number }
  | { type: 'resume'; role: CharacterId; token: string }
  | { type: 'forget_device' }
  | { type: 'auth'; role: CharacterId; code: string; remember?: boolean }
  | { type: 'act'; actionId: ActionId; computer?: import('./computer').ComputerDevice }
  | { type: 'play_game'; game: ComputerGameId; device: ComputerDevice; furnitureId?:number }
  | { type: 'computer_video'; clip: VideoClipId; device: ComputerDevice; furnitureId?:number }
  | { type: 'computer_favorite'; game: ComputerGameId; enabled: boolean }
  | { type: 'buy'; item: import('./food').IngredientId }
  | { type: 'checkout'; lines: import('./market').BasketLine[] }
  | { type: 'job_start'; job: import('./jobs').JobId }
  | { type: 'job_cancel' } // compatibility with the first job-board prototype
  | { type: 'job_leave_early' }
  | { type: 'autonomy_mode'; mode: AutonomyMode }
  | { type: 'shift_speed'; enabled: boolean }
  | { type: 'sleep_start'; mode: import('./timeControl').SleepMode; furnitureId?: number }
  | { type: 'sleep_stop' }
  | { type: 'eat_takeout'; item: import('./food').TakeoutId; furnitureId?:number }
  | { type: 'brew_coffee'; blend: InstantCoffeeId }
  | { type: 'cook'; recipe: import('./food').RecipeId }
  | { type: 'eat'; recipe: import('./food').RecipeId; furnitureId?:number }
  | { type: 'social_offer'; kind: SocialKind }
  | { type: 'pet_action'; pet: import('./pets').PetId; action: import('./pets').PetAction }
  | { type: 'cancel_task'; taskId: number }
  | { type: 'cancel_queued_task'; queueId: number }
  | { type: 'clear_task_queue' }
  | { type: 'pause_toggle' }
  | { type: 'pause_reply'; accept: boolean };

export type QueuedTask = { id: number; label: string };

export type ServerPacket =
  | { type: 'study_progress'; role: CharacterId; taskId: number; elapsed: number; total: number }
  | { type: 'education_feedback'; taskId: number; correct: boolean; message: string; question?: string }
  | { type: 'education_notice'; role: CharacterId; message: string }
  | { type: 'time_status'; status: import('./timeControl').TimeStatus }
  | { type: 'clock_sync'; sample: ClockSample }
  | { type: 'storage_event'; role: CharacterId; station?: string }
  | { type: 'home_leisure'; roles: CharacterId[]; activity: HomeLeisure | null; routes: Partial<Record<CharacterId, WalkRoute>> }
  | { type: 'device_token'; role: CharacterId; token: string }
  | { type: 'world_path'; role: CharacterId; place: PlaceId; path: Point[]; station?: string }
  | { type: 'world_event'; role: CharacterId; message: string }
  | { type: 'delivery_arrived' }
  | { type: 'ready_food_spoiled'; message: string }
  | { type: 'billing_event'; messages: string[] }
  | { type: 'ready'; role: CharacterId; state: GameState; online: CharacterId[] }
  | { type: 'snapshot'; state: GameState }
  | { type: 'online'; online: CharacterId[] }
  | { type: 'action'; role: CharacterId; actionId: ActionId; message: string }
  | { type: 'food_event'; role: CharacterId; action: 'buy' | 'cook' | 'eat'; message: string }
  | { type: 'store_event'; role: CharacterId; message: string }
  | { type: 'job_event'; role: CharacterId; outcome: 'started' | 'finished' | 'left_early'; message: string }
  | { type: 'social_pending'; offer: SocialOffer }
  | { type: 'social_closed'; inviteId: number; phase: SocialPhase; message: string; reply?: string }
  | { type: 'social_start'; kind: SocialKind; message: string }
  | { type: 'pet_event'; role: CharacterId; pet: import('./pets').PetId; action: import('./pets').PetAction; message: string }
  | { type: 'movie_offer'; inviteId: number; from: CharacterId; genre: Genre }
  | { type: 'movie_offer_closed'; inviteId: number; message: string }
  | { type: 'task_queue'; role: CharacterId; tasks: QueuedTask[] }
  | { type: 'task_active'; role: CharacterId; taskId: number; elapsedMs: number }
  | { type: 'need_gain'; role: CharacterId; label: string; effects: NeedEffects }
  | { type: 'task_started'; role: CharacterId; taskId: number; label: string; durationMs: number; command: TimedCommand; automatic?: boolean; home?: HomePresentation; effects?: NeedEffects }
  | { type: 'task_ended'; role: CharacterId; taskId: number; outcome: 'completed' | 'cancelled' | 'failed'; message: string; effects?: NeedEffects }
  | { type: 'error'; reason: string };

export function initialState(): GameState {
  return {
    version: 2, revision: 0, world: initialWorld(), clock: { ...INITIAL_CLOCK }, money: 10000,
    furnishing: emptyFurnishing(),
    billing: initialServices(gameMinutes(INITIAL_CLOCK)),
    pantry: { ...EMPTY_PANTRY, eggs: 4, bread: 3 }, meals: { ...EMPTY_MEALS },
    takeout: { ...EMPTY_TAKEOUT }, readyFood: [], dirtyDishes: { ...EMPTY_DIRTY_DISHES },
    ledger: [], savings: initialFamilyBudget(INITIAL_CLOCK), shiftDays: { vlad: 0, alina: 0 }, activeShifts: {},
    readBooks: { vlad: [], alina: [] }, coffeeDaily: newCoffeeDaily(), education: initialEducation(), careers: initialCareers(),
    computerLibrary: initialComputerLibrary(), relationship: initialRelationship(), autonomy: { ...INITIAL_AUTONOMY },
    pets: structuredClone(INITIAL_PETS), petFood: { ...INITIAL_PET_FOOD }, petBowls: { ...INITIAL_PET_BOWLS },
    characters: {
      vlad: { hunger: 78, energy: 82, mood: 74, skill: 0, ...INITIAL_DAILY_NEEDS, ...spawn('home', 'vlad'), pose: 'idle' },
      alina: { hunger: 82, energy: 86, mood: 81, skill: 0, ...INITIAL_DAILY_NEEDS, ...spawn('home', 'alina'), pose: 'idle' },
    },
  };
}
