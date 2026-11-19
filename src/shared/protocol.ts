export type CharacterId = 'vlad' | 'alina';
export type Pose = 'idle' | 'sit' | 'sleep' | 'work';
export type ItemId = 'sofa' | 'bed' | 'desk' | 'kitchen' | 'tv' | 'table' | 'delivery';
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
}
export interface CharacterState extends Needs {
  x: number;
  z: number;
  pose: Pose;
}
export interface GameState {
  version: 2;
  revision: number;
  money: number;
  pantry: { eggs: number; bread: number };
  characters: Record<CharacterId, CharacterState>;
}

export const names: Record<CharacterId, string> = { vlad: 'Влад', alina: 'Алина' };
export const itemNames: Record<ItemId, string> = {
  sofa: 'Уютный диван', bed: 'Двуспальная кровать', desk: 'Рабочее место',
  kitchen: 'Кухня', tv: 'Телевизор', table: 'Журнальный столик',
  delivery: 'Пробная доставка продуктов',
};
export const points: Record<Exclude<ItemId, 'delivery'>, { x: number; z: number }> = {
  sofa: { x: -3.0, z: 0.6 }, bed: { x: -3.85, z: -0.76 },
  desk: { x: 3.17, z: 3.65 }, kitchen: { x: 3.10, z: -2.66 },
  tv: { x: -0.55, z: -2.58 }, table: { x: -0.80, z: 0.04 },
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
  bedSleep: { label: '🌙 Поспать', item: 'bed', pose: 'sleep' },
  bedNap: { label: '😴 Вздремнуть', item: 'bed', pose: 'sleep' },
  vladOrder: { label: '💻 Простой фриланс-заказ (+120 ₽)', item: 'desk', pose: 'work', role: 'vlad' },
  vladStudy: { label: '📚 Учиться разработке', item: 'desk', pose: 'work', role: 'vlad' },
  alinaStudy: { label: '📖 Изучить реконструкцию волос', item: 'desk', pose: 'work', role: 'alina' },
  alinaConsult: { label: '📋 Консультация клиентки (+80 ₽; навык 15)', item: 'desk', pose: 'work', role: 'alina' },
  omelette: { label: '🍳 Омлет (2 яйца)', item: 'kitchen', pose: 'idle' },
  snack: { label: '🍞 Перекусить хлебом', item: 'kitchen', pose: 'idle' },
  watchTv: { label: '📺 Смотреть передачу', item: 'tv', pose: 'idle' },
  tableRest: { label: '☕ Посидеть за столом', item: 'table', pose: 'sit' },
  buyEggs: { label: '🥚 Доставить 2 яйца (30 ₽)', item: 'delivery', pose: 'idle' },
  buyBread: { label: '🍞 Доставить хлеб (20 ₽)', item: 'delivery', pose: 'idle' },
} as const satisfies Record<string, ActionDefinition>;
export type ActionId = keyof typeof ACTIONS;

export type ClientPacket =
  | { type: 'auth'; role: CharacterId; code: string }
  | { type: 'act'; actionId: ActionId }
  | { type: 'social_offer'; kind: SocialKind }
  | { type: 'social_reply'; id: number; accept: boolean }
  | { type: 'social_cancel'; id: number };

export type ServerPacket =
  | { type: 'ready'; role: CharacterId; state: GameState; online: CharacterId[] }
  | { type: 'snapshot'; state: GameState }
  | { type: 'online'; online: CharacterId[] }
  | { type: 'action'; role: CharacterId; actionId: ActionId; message: string }
  | { type: 'social_offer'; id: number; from: CharacterId; to: CharacterId; kind: SocialKind }
  | { type: 'social_clear'; id: number; message: string }
  | { type: 'social_start'; kind: SocialKind; message: string }
  | { type: 'error'; reason: string };

export function initialState(): GameState {
  return {
    version: 2, revision: 0, money: 2500, pantry: { eggs: 4, bread: 3 },
    characters: {
      vlad: { hunger: 78, energy: 82, mood: 74, skill: 0, x: 0.5, z: 3.5, pose: 'idle' },
      alina: { hunger: 82, energy: 86, mood: 81, skill: 0, x: 1.65, z: 3.2, pose: 'idle' },
    },
  };
}
