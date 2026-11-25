import { NEIGHBOR_HOMES, REAR_WALK_Z, yardFeatures } from './neighborHomes';
import type { PlaceId, Point } from './locations';
import type { CharacterId } from './protocol';
import type { FloorRect } from '../game/navigation';
import { HOME_FLOOR, HOME_YARD, HOUSE, YARD_EXPANSION } from './home';

export const DISTRICT_FLOOR: FloorRect = { minX: -28.4, maxX: 28.4, minZ: -30.7, maxZ: 32.0 };
export const DISTRICT_OFFSET_Z = 41.5+YARD_EXPANSION;
export const HOME_WORLD_FLOOR: FloorRect = { ...DISTRICT_FLOOR,
  minZ: HOME_FLOOR.minZ, maxZ: DISTRICT_FLOOR.maxZ + DISTRICT_OFFSET_Z };
export const inHomeGrounds = ({x,z}:Point) => x>=HOME_FLOOR.minX && x<=HOME_FLOOR.maxX &&
  z>=HOME_FLOOR.minZ && z<=HOME_YARD.gate.z;
export const districtPoint = ({x,z}:Point):Point => ({x,z:z+DISTRICT_OFFSET_Z});
export const DISTRICT_WORLD_FLOOR:FloorRect={minX:DISTRICT_FLOOR.minX,maxX:DISTRICT_FLOOR.maxX,minZ:HOME_YARD.gate.z+.38,maxZ:DISTRICT_FLOOR.maxZ+DISTRICT_OFFSET_Z};
export const HOME_GATE_INSIDE={x:HOME_YARD.gate.x,z:HOME_YARD.gate.z-.78};
export const HOME_GATE_APPROACH = { x:HOME_YARD.gate.x, z:HOME_YARD.gate.z+.66 };
export const INDUSTRIAL_EXIT = {x:15.6,z:31.0};
export const DISTRICT_FOUNTAIN = { x: -8.6, z: -4.45, radius: 1.69 };
export const DISTRICT_POND = { x:21.38, z:21.05, radiusX:2.07, radiusZ:1.43 };
export const inDistrictPond = ({x,z}:Point) =>
  ((x-DISTRICT_POND.x)/DISTRICT_POND.radiusX)**2 + ((z-DISTRICT_OFFSET_Z-DISTRICT_POND.z)/DISTRICT_POND.radiusZ)**2 <= 1;
export const DISTRICT_SITES = [
  { place: 'market', x: -23.8, z: 6.65, w: 6.8, d: 5.4, turn: 1, name: 'Супермаркет', sign: 'ПРОДУКТЫ', color: 0x397766 },
  { place: 'cafe', x: -23.8, z: -.50, w: 5.30, d: 4.8, turn: 1, name: 'Кафе «Тёплый угол»', sign: 'ТЁПЛЫЙ УГОЛ', color: 0xa85846 },
  { place: 'education', x: -23.8, z: -6.98, w: 5.65, d: 5.1, turn: 1, name: 'Центр «Потенциал»', sign: 'ПОТЕНЦИАЛ', color: 0xc09058 },
  { place:'petshop',x:25.5,z:14.1,w:5.8,d:4.9,turn:-1,name:'Зоомагазин «Лапки»',sign:'ЛАПКИ',color:0x588e72 },
  { place:'electronics',x:25.5,z:7.2,w:5.8,d:4.9,turn:-1,name:'Магазин техники «Импульс»',sign:'ИМПУЛЬС',color:0x396d8c },
  { place: 'clothing', x: 25.5, z: .30, w: 5.8, d: 4.9, turn: -1, name: 'Магазин одежды «Стиль»', sign: 'СТИЛЬ', color: 0x776987 },
  { place: 'work-it', x: -23.8, z: -13, w: 4.95, d: 4.90, turn: 1, name: 'IT-офис «Север»', sign: 'СЕВЕР · IT', color: 0x517986 },
  { place: 'work-detail', x: -23.8, z: 14.05, w: 7.4, d: 4.9, turn: 1, name: 'Детейлинг «Линия блеска»', sign: 'ЛИНИЯ БЛЕСКА', color: 0x546569 },
  { place: 'work-marketing', x: -23.8, z: 20.90, w: 5.25, d: 4.8, turn: 1, name: 'Агентство «Искра»', sign: 'ИСКРА', color: 0xaa704f },
  { place: 'work-clinic', x: -23.8, z: 27.10, w: 6.1, d: 4.75, turn: 1, name: 'Клиника «Лапа и хвост»', sign: 'ЛАПА И ХВОСТ', color: 0x658871 },
  { place: 'park', x: 20, z: -8.55, w: 3.7, d: .95, turn: -1, name: 'Сосновый парк', sign: 'СОСНОВЫЙ ПАРК', color: 0x40634b },
] as const;
export type DistrictSite = typeof DISTRICT_SITES[number];
export const districtSite = (place: PlaceId) => DISTRICT_SITES.find(site => site.place === place);
export const districtStation = (place: PlaceId) => 'street-' + place;
export const districtYaw = (site: DistrictSite) => site.turn * Math.PI / 2;

export function sitePoint(site: DistrictSite, side: number, depth: number): Point {
  const angle = districtYaw(site), c = Math.cos(angle), s = Math.sin(angle);
  return { x: site.x + c * side + s * depth, z: site.z - s * side + c * depth };
}

export function districtArrival(place: PlaceId, role: CharacterId): Point {
  if(place==='industrial')return districtPoint({x:INDUSTRIAL_EXIT.x+(role==='vlad'?-.45:.45),z:INDUSTRIAL_EXIT.z-1.0});
  const site = districtSite(place);
  return site ? districtPoint(sitePoint(site, role === 'vlad' ? -.59 : .59, site.d / 2 + 1.06))
    : {x:HOME_GATE_APPROACH.x+(role==='vlad'?-.27:.27),z:HOME_GATE_APPROACH.z};
}

export const DISTRICT_PLAZA = {x:-8.6,z:-4.45,w:11.5,d:8.0};
export const DISTRICT_PATHS = [
  { x: -1.9, z: 7.3, w: 33.6, d: 2.36 },
  { x: -19.45, z: 7.2, w: 3.10, d: 45.4 },
  { x: 17.7, z: .30, w: 9.7, d: 1.9 },
  { x: 18.2,z:7.2,w:9.0,d:1.9 },
  { x: 19.1,z:14.1,w:7.4,d:1.9 },
  { x: -7.4, z: -.6, w: 20, d: 1.8 },
  { x: 13.35, z: -6.20, w: 2.2, d: 28.1 },
  { x: 15.6,z:19.5,w:1.7,d:23.0 },
  { x:14.4,z:7.5,w:4.5,d:1.7 },
  { x: 1.9, z: -10, w: 33.4, d: 1.78 },
  { x: -.22, z: -15.35, w: 51.5, d: 1.8 },
  { x: HOME_YARD.gate.x, z:(HOME_YARD.gate.z-DISTRICT_OFFSET_Z+REAR_WALK_Z)/2,
    w:HOME_YARD.gate.width,d:DISTRICT_OFFSET_Z+REAR_WALK_Z-HOME_YARD.gate.z+.26 },
] as const;

export const DISTRICT_BEDS = [
  { x: -11.95, z: -7.28, w: 3.35, d: 1.08, scheme: 0 },
  { x: -4.5, z: -7.11, w: 2.0, d: 1.09, scheme: 1 },
  { x: -13.9, z: 4.68, w: 2.8, d: .86, scheme: 2 },
  { x: 3.74, z: -12.31, w: 3.5, d: 1.10, scheme: 3 },
  { x: 16.3, z: -7.36, w: 2.2, d: .95, scheme: 0 },
  { x: 6.2, z: 8.96, w: 2.05, d: .73, scheme: 2 },
  { x: -2.5, z: 3.0, w: 2.0, d: 1.16, scheme: 1 },
  { x: -15.4, z: 14.0, w: 1.1, d: 2.2, scheme: 0 },
  { x: -15.4, z: 21.2, w: 1.1, d: 2.2, scheme: 2 },
  { x: -15.4, z: 28.0, w: 1.1, d: 2.0, scheme: 1 },
  { x: -11.28, z: -2.23, w: 2.40, d: .81, scheme: 3 },
  { x: -5.43, z: -2.22, w: 1.87, d: .77, scheme: 2 },
  { x: -15.77, z: 1.43, w: 1.10, d: 1.85, scheme: 1 },
  { x: -15.47, z: -5.47, w: 1.12, d: 1.78, scheme: 3 },
  { x: -15.35, z: 10.35, w: 1.17, d: 1.70, scheme: 0 },
  { x: 15.03, z: 13.95, w: 1.54, d: 1.13, scheme: 1 },
  { x: 20.94, z: 23.60, w: 2.22, d: .76, scheme: 1 },
  { x: 21.28, z: 28.50, w: 2.50, d: .93, scheme: 2 },
  { x: 24.10, z: 29.18, w: 2.09, d: .95, scheme: 3 },
] as const;

export const DISTRICT_TREES = [
  [-25.7,-17.4,'birch',1.12],[-24.8,-20.2,'birch',.88],[-14.1,-18.75,'maple',1.07],
  [-1.05,-19.15,'linden',1.03],[12.76,-18.7,'spruce',1.17],[26.0,-19.2,'linden',1.12],
  [-26.3,3.0,'maple',1.08],
  [-14.45,-9.75,'ornamental',.82],[-2.1,-6.8,'linden',1.06],[6.64,-12.09,'maple',1.07],
  [9.7,-6.3,'birch',.93],[11.1,-3.35,'maple',.95],[23.2,-10.45,'spruce',1.23],
  [23.8,-5.85,'spruce',1], [21.9,-3.8,'spruce',1.07],[21.8,3.7,'linden',1.18],
  [10.8,11.55,'ornamental',.80],
  [3.6,12.4,'linden',1.09],[-6.9,13.4,'birch',.83],[-1.7,5.1,'ornamental',.76],
  [-12.35,2.12,'maple',.91],[-13.7,-12.6,'birch',.89],[-10.4,-12.55,'ornamental',.8],
  [26,-16.7,'spruce',1.08],[26.5,-10.55,'spruce',.95],
  [14.1,16.25,'birch',.88],[20.60,18.10,'linden',1.05],[23.76,23.62,'birch',.94],[26.9,26.2,'spruce',1.06],
  [11.35,25.05,'maple',.91],[8.5,19.4,'linden',1.08],[3.25,26.25,'birch',1.02],
  [-4.95,22.80,'ornamental',.9],[-9.97,28.3,'linden',.96],[-12.98,11.20,'linden',.86],
] as const;

export const DISTRICT_BENCH = { x: -8.65, z: -7.77, w: 2.02, d: .68 };
export const DISTRICT_LAMPS = [
  [-17.25,10.40],[-17.25,3.42],[-17.25,-3.8],[-17.25,-10.1],[-17.25,17.8],[-17.25,24.5],[-14.7,-1.7],
  [-4.13,-1.7],[-12.1,5.63],[-5.3,5.63],[.92,8.76],[8.4,8.76],[16.5,6.0],
  [14.68,-2.1],[14.67,-11.36],[-10,-16.58],[4.4,-16.61],[17.85,-16.53],
] as const;

export function districtRect(x: number, z: number, w: number, d: number, margin = .28): FloorRect {
  return { minX:x-w/2-margin, maxX:x+w/2+margin, minZ:z-d/2-margin,maxZ:z+d/2+margin };
}

const yardFence = (x:number,z:number, w:number) => {
  const halfGap = .74, side = w / 2 - halfGap;
  return [-1,1].map(direction => districtRect(x + direction * (side / 2 + halfGap), z, side, .16));
};
const pondObstacles = (() => {
  const {x,z,radiusX,radiusZ}=DISTRICT_POND;
  const bands=7, depth=radiusZ*2/bands;
  // Each band covers the widest part of this slice of the elliptical bank.
  return Array.from({length:bands},(_,i)=>{
    const near=2*Math.max(0,Math.abs(i-(bands-1)/2)-.5)/bands;
    const width=2*radiusX*Math.sqrt(1-near*near);
    return districtRect(x,z-radiusZ+(i+.5)*depth,width,depth,.23);
  });
})();
export const DISTRICT_OBSTACLES: readonly FloorRect[] = [
  ...DISTRICT_SITES.filter(site=>site.place !== 'park').map(site =>
    districtRect(site.x,site.z,Math.abs(site.turn)%2 ? site.d : site.w,Math.abs(site.turn)%2 ? site.w : site.d)),
  districtRect(20,-10.22,1.15,.35),districtRect(20,-6.88,1.15,.35),
  ...NEIGHBOR_HOMES.flatMap((home,i)=>{
    const yard=yardFeatures(home,i);
    return [
      districtRect(home.x,home.z,home.width+(i===3?1.1:.25),home.depth+.25),
      ...yardFence(home.x,home.z+home.depth/2+4.35,home.width),
      // Reserve real solid objects while keeping the shared centre walkway
      // open. NPC seating is a controlled animation on its own bench surface.
      districtRect(yard.grill.x,yard.grill.z,.81,.57,.07),
      districtRect(yard.patch.x,yard.patch.z,yard.patchArea.w,yard.patchArea.d,.05),
      districtRect(yard.bench.x,yard.bench.z,1.54,.44,.06),
    ];
  }),
  districtRect(DISTRICT_FOUNTAIN.x,DISTRICT_FOUNTAIN.z,3.38,2.64),
  districtRect(DISTRICT_FOUNTAIN.x,DISTRICT_FOUNTAIN.z,2.64,3.38),
  ...pondObstacles,
  ...DISTRICT_BEDS.map(({x,z,w,d})=>districtRect(x,z,w,d)),
  ...DISTRICT_TREES.map(([x,z])=>districtRect(x,z,.46,.46)),
  ...DISTRICT_LAMPS.map(([x,z])=>districtRect(x,z,.29,.29,.19)),
];
const gateEdge = .26;
const {gate}=HOME_YARD;
export const DISTRICT_WORLD_OBSTACLES:readonly FloorRect[]=DISTRICT_OBSTACLES.map(rect=>({...rect,minZ:rect.minZ+DISTRICT_OFFSET_Z,maxZ:rect.maxZ+DISTRICT_OFFSET_Z}));
export const HOME_WORLD_OBSTACLES: readonly FloorRect[] = [
  ...DISTRICT_OBSTACLES.map(rect=>({...rect,minZ:rect.minZ+DISTRICT_OFFSET_Z,maxZ:rect.maxZ+DISTRICT_OFFSET_Z})),
  {minX:HOUSE.minX-.26,maxX:HOUSE.minX+.28,minZ:HOME_WORLD_FLOOR.minZ,maxZ:HOUSE.maxZ+.25},
  {minX:-6.26,maxX:gate.x-gate.width/2+gateEdge,minZ:gate.z-.36,maxZ:gate.z+.36},
  {minX:gate.x+gate.width/2-gateEdge,maxX:6.26,minZ:gate.z-.36,maxZ:gate.z+.36},
];

export function hydrateLegacyDistrict(point: Point, role: CharacterId): Point {
  const landmarks = [
    { x:-3.88,z:-3.25, place:'home' },{x:.11,z:-3.25,place:'market'},
    {x:4.10,z:-3.25,place:'cafe'},{x:4.55,z:2.02,place:'park'},
    {x:-5.35,z:-2.3,place:'education'},
  ] as const;
  const closest = landmarks.find(door => Math.hypot(door.x-point.x,door.z-point.z)<1.5);
  return districtArrival(closest?.place??'home',role);
}

export function restoreDistrictPosition(point:Point,role:CharacterId,layout:1|undefined):Point {
  if(layout!==1)return hydrateLegacyDistrict(point,role);
  // The former duplicate house occupied this plot. Its entrance is now the existing yard gate.
  if(Math.abs(point.x-4.3)<2 && Math.abs(point.z-5.56)<2)return districtArrival('home',role);
  return districtPoint(point);
}
