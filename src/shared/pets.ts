import { segmentIsClear, type FloorPoint, type FloorRect, type WalkRoute } from '../game/navigation';

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
export type PetBowlStock = Record<PetId, number>;
export const PET_FOOD_REFILLS_PER_PACK = 10;
export const PET_BOWL_CAPACITY = 3;
export const PET_FOOD_MAX_REFILLS = 50;
export const PET_AUTO_EAT_BELOW = 20;
export const PET_EAT_SATIETY_GAIN = 36;

// One shared, read-only classification for 3D signals, menus and any later
// veterinarian/health feature. It does not introduce illnesses or penalties.
export const PET_HUNGER_WARNING_BELOW = 35;
export type PetHungerLevel = 'normal' | 'warning' | 'critical';
export function petHungerLevel(satiety: number): PetHungerLevel {
  if (satiety < PET_AUTO_EAT_BELOW) return 'critical';
  if (satiety < PET_HUNGER_WARNING_BELOW) return 'warning';
  return 'normal';
}

export const PETS = {
  verdell: {
    name: 'Верделл',
    species: 'чёрный пушистый шпиц',
    emoji: '🐕',
    foodName: 'Корм для шпица',
    foodPrice: 650,
    foodAmount: PET_FOOD_REFILLS_PER_PACK,
    home: { x: -3.52, z: 4.48 },
    bowl: { x: -.91, z: -2.63 },
    toilet: { x: 3.25, z: 4.48 },
  },
  simba: {
    name: 'Симба',
    species: 'рыжий полосатый кот',
    emoji: '🐈',
    foodName: 'Корм для кота',
    foodPrice: 550,
    foodAmount: PET_FOOD_REFILLS_PER_PACK,
    home: { x: -2.24, z: 4.48 },
    bowl: { x: -.18, z: -2.63 },
    toilet: { x: 4.26, z: 4.48 },
  },
} as const satisfies Record<PetId, {
  name: string; species: string; emoji: string;
  foodName: string; foodPrice: number; foodAmount: number;
  home: { x: number; z: number };
  bowl: { x: number; z: number };
  toilet: { x: number; z: number };
}>;

export const PET_ROAM = [
  { x: -3.0, z: 3.43 }, { x: -6.30, z: -3.81 }, { x: -.62, z: 2.40 },
  { x: .84, z: -.56 }, { x: .48, z: 4.45 }, { x: 1.20, z: 2.58 }, { x: 7.72, z: -3.80 },
  { x: -2.64, z: 8.08 }, { x: -3.82, z: 9.63 }, { x: -.96, z: 10.53 }, { x: 1.37, z: 8.88 },
] as const;

export function petApproach(position: FloorPoint, obstacles: readonly FloorRect[], floor: FloorRect) {
  for (const [dx, dz] of [[0, .74], [-.74, 0], [.74, 0], [0, -.74]]) {
    const target = { x: position.x + dx, z: position.z + dz };
    if (segmentIsClear(position, target, obstacles, floor)) return target;
  }
}

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
export const INITIAL_PET_BOWLS: PetBowlStock = { verdell: 0, simba: 0 };

export const PET_ACTION_NAMES: Record<PetAction, string> = {
  buyFood: 'Купить корм',
  feed: 'Насыпать корм в миску',
  play: 'Поиграть',
  pet: 'Погладить',
  brush: 'Расчесать',
};
export const PET_IDS = ['verdell', 'simba'] as const;
