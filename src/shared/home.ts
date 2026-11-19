export const COUNTER = { x: 2.43, z: -3.91 };

export const HOME_FURNITURE = {
  sofa: { minX: -4.44, maxX: -1.76, minZ: 1.16379, maxZ: 2.30 },
  bed: { minX: -5.19, maxX: -2.51, minZ: -4.00, maxZ: -1.27 },
  kitchen: { minX: COUNTER.x - 2.195, maxX: COUNTER.x + 2.21, minZ: -4.485, maxZ: -3.42 },
  desk: { minX: 1.555, maxX: 3.805, minZ: 1.24, maxZ: 3.19 },
  tv: { minX: -1.56, maxX: 0.36, minZ: -3.905, maxZ: -3.346 },
  table: { minX: -2.56, maxX: -1.20, minZ: -0.65, maxZ: 0.71 },
};

export const HOME_DECOR = [
  { minX: 4.70, maxX: 5.35, minZ: -0.26, maxZ: 0.38 },
  { minX: 4.47, maxX: 5.62, minZ: 2.77, maxZ: 4.05 },
];

export const KITCHEN_WORK = {
  stove: { position: { x: COUNTER.x - .87, z: -3.08 }, target: { x: COUNTER.x - .87, y: 1.17, z: -3.76 } },
  wash: { position: { x: COUNTER.x + 1.28, z: -3.08 }, target: { x: COUNTER.x + 1.28, y: 1.09, z: -3.77 } },
  tidy: { position: { x: COUNTER.x + .37, z: -3.08 }, target: { x: COUNTER.x + .37, y: 1.04, z: -3.62 } },
  tea: { position: { x: COUNTER.x - 1.68, z: -3.08 }, target: { x: COUNTER.x - 1.68, y: 1.18, z: -3.75 } },
} as const;

export const KITCHEN_ACTIONS = {
  kitchenWash: 'wash', kitchenTidy: 'tidy', kitchenTea: 'tea',
} as const;

export type HomeLeisure = 'tv' | 'computer' | 'verdell' | 'simba' | 'chat';
