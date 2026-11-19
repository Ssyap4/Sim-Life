export type PetId = 'verdell' | 'simba';
export type PetAction = 'buyFood' | 'feed' | 'play' | 'pet' | 'brush';

export interface PetState {
  satiety: number;
  happiness: number;
  bond: number;
}
export type PetFamily = Record<PetId, PetState>;
export type PetFoodStock = Record<PetId, number>;

export const PETS = {
  verdell: {
    name: 'Верделл',
    species: 'чёрный пушистый шпиц',
    emoji: '🐕',
    foodName: 'Корм для шпица',
    foodPrice: 45,
    foodAmount: 3,
    home: { x: -1.24, z: 2.82 },
  },
  simba: {
    name: 'Симба',
    species: 'рыжий полосатый кот',
    emoji: '🐈',
    foodName: 'Корм для кота',
    foodPrice: 40,
    foodAmount: 3,
    home: { x: 1.18, z: 0.62 },
  },
} as const satisfies Record<PetId, {
  name: string; species: string; emoji: string;
  foodName: string; foodPrice: number; foodAmount: number;
  home: { x: number; z: number };
}>;

export const INITIAL_PETS: PetFamily = {
  verdell: { satiety: 72, happiness: 84, bond: 36 },
  simba: { satiety: 78, happiness: 76, bond: 32 },
};
export const INITIAL_PET_FOOD: PetFoodStock = { verdell: 2, simba: 2 };

export const PET_ACTION_NAMES: Record<PetAction, string> = {
  buyFood: 'Купить корм',
  feed: 'Покормить',
  play: 'Поиграть',
  pet: 'Погладить',
  brush: 'Расчесать',
};
export const PET_IDS = ['verdell', 'simba'] as const;
