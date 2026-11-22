import { NEIGHBOR_HOMES } from './neighborHomes';
import type { PlaceId, Point } from './locations';
import type { CharacterId } from './protocol';
import type { FloorRect } from '../game/navigation';

export const DISTRICT_FLOOR: FloorRect = { minX: -28.4, maxX: 28.4, minZ: -30.7, maxZ: 15.3 };
export const DISTRICT_FOUNTAIN = { x: -8.6, z: -4.45, radius: 1.69 };
export const DISTRICT_SITES = [
  { place: 'home', x: 4.3, z: 1.40, w: 9.60, d: 6.2, turn: 0, name: 'Дом', sign: 'ДОМ', color: 0xd0a67b },
  { place: 'market', x: -21.8, z: 6.65, w: 6.8, d: 5.4, turn: 1, name: 'Супермаркет', sign: 'ПРОДУКТЫ', color: 0x397766 },
  { place: 'cafe', x: -22.1, z: -.50, w: 5.30, d: 4.8, turn: 1, name: 'Кафе «Тёплый угол»', sign: 'ТЁПЛЫЙ УГОЛ', color: 0xa85846 },
  { place: 'education', x: -22, z: -6.98, w: 5.65, d: 5.1, turn: 1, name: 'Центр «Потенциал»', sign: 'ПОТЕНЦИАЛ', color: 0xc09058 },
  { place: 'work-it', x: -23.58, z: -13, w: 4.95, d: 4.90, turn: 1, name: 'IT-офис «Север»', sign: 'СЕВЕР · IT', color: 0x517986 },
  { place: 'work-detail', x: -11.5, z: 12.3, w: 7.4, d: 4.9, turn: 2, name: 'Детейлинг «Линия блеска»', sign: 'ЛИНИЯ БЛЕСКА', color: 0x546569 },
  { place: 'work-marketing', x: -2.3, z: 12.36, w: 5.25, d: 4.8, turn: 2, name: 'Агентство «Искра»', sign: 'ИСКРА', color: 0xaa704f },
  { place: 'work-clinic', x: 15.4, z: 11.72, w: 6.1, d: 4.75, turn: 2, name: 'Клиника «Лапа и хвост»', sign: 'ЛАПА И ХВОСТ', color: 0x658871 },
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
  const site = districtSite(place) ?? DISTRICT_SITES[0];
  return sitePoint(site, role === 'vlad' ? -.59 : .59, site.d / 2 + 1.06);
}

export const DISTRICT_PLAZA = {x:-8.6,z:-4.45,w:11.5,d:8.0};
export const DISTRICT_PATHS = [
  { x: -1.9, z: 7.3, w: 33.6, d: 2.36 },
  { x: -17.08, z: -4.6, w: 2.45, d: 24.3 },
  { x: -7.4, z: -.6, w: 20, d: 1.8 },
  { x: 13.35, z: -6.20, w: 2.2, d: 28.1 },
  { x: 1.9, z: -10, w: 33.4, d: 1.78 },
  { x: -.22, z: -15.35, w: 51.5, d: 1.8 },
  { x: 4.3, z: 6.12, w: 2.0, d: 3.1 },
] as const;

export const DISTRICT_BEDS = [
  { x: -11.95, z: -7.28, w: 3.35, d: 1.08, scheme: 0 },
  { x: -4.5, z: -7.11, w: 2.0, d: 1.09, scheme: 1 },
  { x: -13.9, z: 4.68, w: 2.8, d: .86, scheme: 2 },
  { x: 3.74, z: -12.31, w: 3.5, d: 1.10, scheme: 3 },
  { x: 16.3, z: -7.36, w: 2.2, d: .95, scheme: 0 },
  { x: 6.2, z: 8.96, w: 2.05, d: .73, scheme: 2 },
  { x: -2.5, z: 3.0, w: 2.0, d: 1.16, scheme: 1 },
] as const;

export const DISTRICT_TREES = [
  [-25.7,-17.4,'birch',1.12],[-24.8,-20.2,'birch',.88],[-14.1,-18.75,'maple',1.07],
  [-1.05,-19.15,'linden',1.03],[12.76,-18.7,'spruce',1.17],[26.0,-19.2,'linden',1.12],
  [-26.0,10.4,'maple',1.26],[-24.9,13.8,'spruce',1.13],[-19.25,11.93,'birch',.99],
  [-14.45,-9.75,'ornamental',.82],[-2.1,-6.8,'linden',1.06],[6.64,-12.09,'maple',1.07],
  [9.7,-6.3,'birch',.93],[11.1,-3.35,'maple',.95],[23.2,-10.45,'spruce',1.23],
  [23.8,-5.85,'spruce',1], [21.9,-3.8,'spruce',1.07],[21.8,3.7,'linden',1.18],
  [25.3,7.5,'birch',1.17],[23.3,12.7,'maple',1.10],[10.8,11.55,'ornamental',.80],
  [3.6,12.4,'linden',1.09],[-6.9,13.4,'birch',.83],[-1.7,5.1,'ornamental',.76],
  [-12.35,2.12,'maple',.91],[-13.7,-12.6,'birch',.89],[-10.4,-12.55,'ornamental',.8],
] as const;

export const DISTRICT_BENCH = { x: -8.65, z: -7.77, w: 2.02, d: .68 };
export const DISTRICT_LAMPS = [
  [-18.57,8.95],[-18.55,3.42],[-18.63,-3.8],[-18.52,-10.1],[-14.7,-1.7],
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
export const DISTRICT_OBSTACLES: readonly FloorRect[] = [
  ...DISTRICT_SITES.filter(site=>site.place !== 'park').map(site =>
    districtRect(site.x,site.z,Math.abs(site.turn)%2 ? site.d : site.w,Math.abs(site.turn)%2 ? site.w : site.d)),
  districtRect(20,-10.22,1.15,.35),districtRect(20,-6.88,1.15,.35),
  ...NEIGHBOR_HOMES.flatMap((home,i)=>[
    districtRect(home.x,home.z,home.width + (i===3 ? 1.1 : .25),home.depth+.25),
    ...yardFence(home.x,home.z+home.depth/2+4.35,home.width),
  ]),
  districtRect(DISTRICT_FOUNTAIN.x,DISTRICT_FOUNTAIN.z,3.38,2.64),
  districtRect(DISTRICT_FOUNTAIN.x,DISTRICT_FOUNTAIN.z,2.64,3.38),
  ...DISTRICT_BEDS.map(({x,z,w,d})=>districtRect(x,z,w,d)),
  ...DISTRICT_TREES.map(([x,z])=>districtRect(x,z,.46,.46)),
  ...DISTRICT_LAMPS.map(([x,z])=>districtRect(x,z,.29,.29,.19)),
];

export function hydrateLegacyDistrict(point: Point, role: CharacterId): Point {
  const landmarks = [
    { x:-3.88,z:-3.25, place:'home' },{x:.11,z:-3.25,place:'market'},
    {x:4.10,z:-3.25,place:'cafe'},{x:4.55,z:2.02,place:'park'},
    {x:-5.35,z:-2.3,place:'education'},
  ] as const;
  const closest = landmarks.find(door => Math.hypot(door.x-point.x,door.z-point.z)<1.5);
  return closest ? districtArrival(closest.place,role) : districtArrival('home',role);
}
