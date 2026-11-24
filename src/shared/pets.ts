import { toysFor } from './petToys';
import { segmentIsClear, type FloorPoint, type FloorRect, type WalkRoute } from '../game/navigation';

export type PetId = 'verdell' | 'simba';
export type PetAction = 'buyFood' | 'feed' | 'play' | 'pet' | 'brush' | 'call' | 'perch' | 'fetch' | 'mat' | 'scratch' | 'treat' | 'toy' | 'bathe' | 'loadFeeder' | import('./dogTraining').DogTrainingAction;
export const PET_ROUTINES = ['wander', 'eat', 'sleep', 'toilet', 'perch', 'come', 'fetch', 'scratch', 'toy', 'beg','train','bath'] as const;
export const DOG_TOYS=[
  {kind:'marfa',name:'Марфа',x:-1.70,z:4.10},
  {kind:'rope',name:'Канатик',x:.17,z:-.47},
  {kind:'ball',name:'Мячик',x:1.12,z:1.84},
  {kind:'marfa',name:'Марфа',x:-3.65,z:9.55},
  {kind:'rope',name:'Канатик',x:-.96,z:10.28},
  {kind:'ball',name:'Мячик',x:1.40,z:8.85},
] as const;
export type DogToyKind=typeof DOG_TOYS[number]['kind'];
export function dogToyApproach(index:number):FloorPoint{
  const toy=DOG_TOYS[index];
  return {x:toy.x,z:toy.z-.48};
}
export const homeToysFor=(id:PetId)=>id==='verdell'?[...DOG_TOYS,...toysFor(id)]:toysFor(id);
export function homeToyApproach(id:PetId,index:number):FloorPoint{const toy=homeToysFor(id)[index];return {x:toy.x,z:toy.z-(id==='verdell'?.48:.39)};}
export interface PetRoutine {
  kind: typeof PET_ROUTINES[number];
  target: number;
  until: number;
  startedAt: number;
  route: WalkRoute;
  /** Present ONLY for a real cat-on-furniture routine. Ground navigation stays at approach. */
  perch?: import('./CatPerches').CatPerch;
  /** Ground destination for a pet called to an owner or fetching a ball. */
  goal?: FloorPoint;
  /** Real ball position and path distance before the dog picks it up. */
  fetchPoint?: FloorPoint;
  fetchPickupDistance?: number;
  /** Installed real pet furniture; invalid after sale or repositioning. */
  equipment?: import('./petFurniture').PetEquipmentRef;
  training?:import('./dogTraining').TrainingAttempt;
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
  /** Retained preference only while a matching purchased bed remains installed. */
  favoriteBedId?: number;
  treats?:{day:number;used:number};
  training?:Partial<Record<import('./dogTraining').DogCommand,import('./dogTraining').CommandSkill>>;
  lastTraining?:{command:import('./dogTraining').DogCommand;success:boolean};
  feederReserve?:(string|null)[];
  cleanliness?:number;
  ownedToys?:string[];
  toyPreferences?:Record<string,0|1|2|3>;
  foodQueue?:string[];
  bowlFood?:string;
  foodPreferences?:Record<string,import("./petShop").FoodPreference>;
  foodFullUntil?:number;
  furnitureYield?: {perch:import('./CatPerches').CatPerch;clearAt:number;cooldownUntil:number};
}
export type PetFamily = Record<PetId, PetState>;
export type PetFoodStock = Record<PetId, number>;
export type PetBowlStock = Record<PetId, number>;
export const PET_FOOD_REFILLS_PER_PACK = 10;
export const PET_BOWL_CAPACITY = 3;
export const PET_FOOD_MAX_REFILLS = 50;
// Pets approach their own filled bowl at 40% or lower, before red hunger.
export const PET_AUTO_EAT_BELOW = 40;
export const PET_EAT_SATIETY_GAIN = 36;
export const PET_TREAT_LIMIT=3;
export const PET_TREAT_REWARD={satiety:30,happiness:12,bond:8} as const;
export function treatsRemaining(pet:PetState,day:number):number{return PET_TREAT_LIMIT-(pet.treats?.day===day?pet.treats.used:0);}

// One shared, read-only classification for 3D signals, menus and any later
// veterinarian/health feature. It does not introduce illnesses or penalties.
export const PET_HUNGER_WARNING_BELOW = 35;
export type PetHungerLevel = 'normal' | 'warning' | 'critical';
export function petHungerLevel(satiety: number): PetHungerLevel {
  // Warning/critical colors are independent from the earlier meal trigger.
  if (satiety < 20) return 'critical';
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
    bowl: { x: -1.65, z: -2.63 },
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
    bowl: { x: .15, z: -2.63 },
    toilet: { x: 4.26, z: 4.48 },
  },
} as const satisfies Record<PetId, {
  name: string; species: string; emoji: string;
  foodName: string; foodPrice: number; foodAmount: number;
  home: { x: number; z: number };
  bowl: { x: number; z: number };
  toilet: { x: number; z: number };
}>;

// Spacious, deliberate resting/sniffing spots. Avoid walls, tight door
// edges, kitchen furniture and shared household work positions.
export const PET_ROAM = [
  { x: -2.90, z: 3.34 }, { x: -6.26, z: -3.71 }, { x: -.25, z: 1.32 },
  { x: .17, z: -.47 }, { x: .48, z: 4.43 }, { x: 1.12, z: 1.84 }, { x: 7.65, z: -3.72 },
  { x: -2.70, z: 8.20 }, { x: -3.65, z: 9.55 }, { x: -.96, z: 10.28 }, { x: 1.40, z: 8.85 },
] as const;

export function petApproach(position: FloorPoint, obstacles: readonly FloorRect[], floor: FloorRect) {
  for (const [dx, dz] of [[0, .74], [-.74, 0], [.74, 0], [0, -.74]]) {
    const target = { x: position.x + dx, z: position.z + dz };
    if (segmentIsClear(position, target, obstacles, floor)) return target;
  }
}

export function petDestination(id: PetId, routine: Pick<PetRoutine, 'kind' | 'target' | 'perch' | 'goal'>) {
  const pet = PETS[id];
  if (routine.kind === 'eat') return routine.goal??{ x: pet.bowl.x, z: pet.bowl.z + .51 };
  if (routine.kind === 'sleep') return routine.goal ?? pet.home;
  if (routine.kind === 'toilet') return pet.toilet;
  if (routine.kind === 'perch') return routine.perch?.approach ?? pet.home;
  if(routine.kind==='toy')return homeToyApproach(id,routine.target);
  if (routine.kind === 'come' || routine.kind === 'fetch' || routine.kind === 'scratch'||routine.kind==='beg'||routine.kind==='train'||routine.kind==='bath') return routine.goal ?? pet.home;
  return PET_ROAM[routine.target];
}

export const PET_SPEED: Record<PetId, number> = { verdell: 1.27, simba: 1.08 };

export const INITIAL_PETS: PetFamily = {
  verdell: { cleanliness:100,satiety: 72, happiness: 84, bond: 36, energy: 74, bladder: 80, position: PETS.verdell.home },
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
  call: 'Позвать к себе',
  perch: 'Попросить полежать на мебели',
  fetch: 'Принести мячик',
  mat: 'Отдохнуть на лежанке',
  scratch: 'Поточить когти',
  treat: 'Дать лакомство',
  toy: 'Поиграть с игрушкой',
  bathe: 'Искупать в ванной',
  loadFeeder: 'Заполнить кормушку',
  'train-sit':'Сидеть','train-lie':'Лежать','train-paw':'Дай лапу','train-beg':'Зайка','train-bark':'Голос','train-fetch':'Апорт','train-stay':'Место',
};
export const PET_IDS = ['verdell', 'simba'] as const;
