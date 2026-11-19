import type { WalkRoute } from '../game/navigation';

export type PetId = 'verdell' | 'simba';
export type PetAction = 'buyFood' | 'feed' | 'play' | 'pet' | 'brush';
export const PET_ROUTINES = ['wander', 'eat', 'sleep', 'toilet'] as const;
export interface PetRoutine {
  kind: typeof PET_ROUTINES[number];
  target: number;
  until: number;
  startedAt: number;
  route: WalkRoute;
}

export interface PetState {
  satiety: number;
  happiness: number;
  bond: number;
  energy: number;
  bladder: number;
  position: { x: number; z: number };
  parkPosition?: { x: number; z: number };
  routine?: PetRoutine;
}
export type PetFamily = Record<PetId, PetState>;
export type PetFoodStock = Record<PetId, number>;

export const PETS = {
  verdell: {
    name: 'Верделл',
    species: 'чёрный пушистый шпиц',
    emoji: '🐕',
    foodName: 'Корм для шпица',
    foodPrice: 650,
    foodAmount: 3,
    home: { x: -4.72, z: 3.64 },
    bowl: { x: -4.04, z: 3.75 },
    toilet: { x: -5.15, z: 4.49 },
  },
  simba: {
    name: 'Симба',
    species: 'рыжий полосатый кот',
    emoji: '🐈',
    foodName: 'Корм для кота',
    foodPrice: 550,
    foodAmount: 3,
    home: { x: 4.67, z: -1.94 },
    bowl: { x: 5.30, z: -1.81 },
    toilet: { x: 5.12, z: 1.40 },
  },
} as const satisfies Record<PetId, {
  name: string; species: string; emoji: string;
  foodName: string; foodPrice: number; foodAmount: number;
  home: { x: number; z: number };
  bowl: { x: number; z: number };
  toilet: { x: number; z: number };
}>;

export const PET_ROAM = [
  { x: -3.2, z: 3.65 }, { x: -2.0, z: -1.6 }, { x: -.5, z: 2.4 },
  { x: 1.25, z: -.8 }, { x: 4.01, z: -.90 }, { x: 1.05, z: 4.09 }, { x: -4.00, z: .40 },
] as const;

export function petDestination(id: PetId, routine: Pick<PetRoutine, 'kind' | 'target'>) {
  const pet = PETS[id];
  if (routine.kind === 'eat') return { x: pet.bowl.x, z: pet.bowl.z + .51 };
  if (routine.kind === 'sleep') return pet.home;
  if (routine.kind === 'toilet') return pet.toilet;
  return PET_ROAM[routine.target];
}

export const PET_SPEED: Record<PetId, number> = { verdell: 1.27, simba: 1.08 };

export const INITIAL_PETS: PetFamily = {
  verdell: { satiety: 72, happiness: 84, bond: 36, energy: 74, bladder: 80, position: PETS.verdell.home },
  simba: { satiety: 78, happiness: 76, bond: 32, energy: 81, bladder: 76, position: PETS.simba.home },
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
