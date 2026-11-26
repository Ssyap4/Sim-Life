import {COURIER_APPROACH,COURIER_PORCH} from './courier';
import { CASHIER_OBSTACLE } from './locationLayout';
import { DISTRICT_WORLD_FLOOR, INDUSTRIAL_EXIT, DISTRICT_BENCH, DISTRICT_WORLD_OBSTACLES, HOME_GATE_INSIDE, HOME_GATE_APPROACH, DISTRICT_SITES, districtArrival, districtPoint, districtStation, sitePoint } from './district';
import { furnishingObstacles } from './furniture';
import { CAREERS, CAREER_STATIONS, type CareerId, type WorkStation } from './careers';
import type { CharacterId } from './protocol';
import type { PicnicBasket } from './picnic';
import { PARK_TREES, type CampKit, type CampRecipe, type ParkDogVisit } from './park';
import type { BasketLine, MarketCategory } from './market';
import { COUNTER, HOME_DECOR, KITCHEN_WORK, HOME_FURNITURE, HOME_PLACEMENTS, HOUSE_ENTRY, HOME_STRUCTURE_OBSTACLES, HOME_FLOOR, HOME_YARD } from './home';

export const PLACES = {
  home: { name: 'Дом', icon: '⌂', detail: 'Дом и семейный участок' },
  district: {name:'Район',icon:'🏘️',detail:'Соседи, торговая улица и площадь'},
  industrial: {name:'Промышленная зона',icon:'🏭',detail:'Склады Ozon и Wildberries'},
  venue:{name:'PLAY ARENA',icon:'🎳',detail:'Боулинг, аэрохоккей, бильярд, настолки и PS5'},
  lake:{name:'Лесное озеро',icon:'🏕️',detail:'Загородный клуб, кемпинг и рыбалка'},
  spa:{name:'SPA «Лагуна»',icon:'♨️',detail:'Бассейн, джакузи, сауна и массаж'},
  barber:{name:'Барбершоп BRO',icon:'💈',detail:'Стрижка, бритьё и профессиональный уход'},
  clinic:{name:'Добрый доктор',icon:'🏥',detail:'Терапевт, диагностика и аптека'},
  fitness:{name:'PULSE Fitness',icon:'🏋️',detail:'Кардио, силовые тренировки и сауна'},
  petshop:{name:'Зоомагазин «Лапки»',icon:'🐾',detail:'Корм, лежанки, домики и когтеточки'},
  electronics: {name:'Магазин техники «Импульс»',icon:'🔌',detail:'Компьютеры, ноутбуки, телевизоры, смартфоны и кофемашины'},
  clothing: { name: 'Магазин одежды «Стиль»', icon: '👕', detail: 'Одежда, примерочная и касса' },
  market: { name: 'Супермаркет', icon: '🛒', detail: 'Отделы продуктов и касса' },
  cafe: { name: 'Кафе «Тёплый угол»', icon: '☕', detail: 'Заказ, выдача и столики для двоих' },
  park: { name: 'Сосновый парк', icon: '🌿', detail: 'Прогулки, отдых и Верделл' },
  education: { name: 'Центр «Потенциал»', icon: '🎓', detail: 'Аудитория, компьютерный класс и мастерская' },
  'work-it': { name: 'IT-офис «Север»', icon: '💻', detail: 'Внутренние системы и отчёты' },
  'work-detail': { name: 'Детейлинг «Линия блеска»', icon: '🚙', detail: 'Ресепшен и два рабочих поста' },
  'work-marketing': { name: 'Агентство «Искра»', icon: '📣', detail: 'Кампании, материалы и аналитика' },
  'work-clinic': { name: 'Клиника «Лапа и хвост»', icon: '🐾', detail: 'Приёмная, наблюдение и учебный кабинет' },
} as const;
export type PlaceId = keyof typeof PLACES;
export type Point = { x: number; z: number };
export const LAKE_FLOOR={minX:-15.6,maxX:9.4,minZ:-13.6,maxZ:13.6};
export const VENUE_FLOOR={minX:-9.62,maxX:9.62,minZ:-6.62,maxZ:6.62};
export const SPA_FLOOR={minX:-8.62,maxX:9.62,minZ:-6.62,maxZ:5.82};
export const FITNESS_FLOOR={minX:-8.62,maxX:14.62,minZ:-6.62,maxZ:6.62};
export const ELECTRONICS_FLOOR={minX:-5.62,maxX:10.62,minZ:-4.62,maxZ:4.62};
export const WORLD_FLOOR = { minX: -5.62, maxX: 5.62, minZ: -4.62, maxZ: 4.62 };
export const PARK_FLOOR={minX:-7.62,maxX:12.62,minZ:-6.62,maxZ:6.62};
export const INDUSTRIAL_FLOOR={minX:-9.12,maxX:9.12,minZ:-6.12,maxZ:6.62};
export const floorFor = (place: PlaceId) => place === 'home' ? HOME_FLOOR : place==='district'?DISTRICT_WORLD_FLOOR:place==='park'?PARK_FLOOR:place==='industrial'?INDUSTRIAL_FLOOR:place==='venue'?VENUE_FLOOR:place==='lake'?LAKE_FLOOR:place==='spa'?SPA_FLOOR:place==='fitness'?FITNESS_FLOOR:place==='electronics'?ELECTRONICS_FLOOR:WORLD_FLOOR;
export function isPlace(value: unknown): value is PlaceId {
  return typeof value === 'string' && Object.hasOwn(PLACES, value);
}
export function spawn(place: PlaceId, role: CharacterId): Point {
  if(place==='fitness')return {x:role==='vlad'?-.44:.44,z:5.56};
  if (place === 'home') return role === 'vlad' ? { x: .5, z: 3.5 } : { x: 1.12, z: 3.35 };
  if (place === 'district') return districtArrival('home',role);
  if (place === 'education') return { x: role === 'vlad' ? .47 : 1.38, z: 3.94 };
  return { x: role === 'vlad' ? .5 : 1.65, z: 4.10 };
}
export function meeting(place: PlaceId, role: CharacterId): Point {
  if(place==='spa')return {x:role==='vlad'?-.44:.44,z:4.04};
  if(place==='fitness')return {x:role==='vlad'?-.44:.44,z:5.00};
  if(place==='district')return districtPoint({x:role==='vlad'?-9.02:-8.18,z:-8.8});
  return { x: role === 'vlad' ? -0.42 : 0.42, z: place === 'home' ? 2.38 : 3.35 };
}

type SiteAction =
  | {kind:'lake';facility:'rental'|'pitch'|'fish'|'fire'|'rest'}
  | {kind:'venue';facility:import('./venue').VenueGame|'reception'}
  | {kind:'spa'; facility:import('./spa').SpaAction|'reception'}
  | {kind:'barber'; facility:'reception'|'chair'}
  | {kind:'clinic'; facility:string}
  | {kind:'fitness'; facility:string}
  | {kind:'warehouse';job:'ozon'|'wildberries'}
  | {kind:'console-display';sku:import('./consoleCatalog').ConsoleSku}
  | {kind:'speaker-display'}
  | {kind:'vacuum-display'}
  | {kind:'electronics-display';category:import('./electronics').ElectronicsKind}
  | {kind:'electronics-checkout'}
  | {kind:'pet-food-display';pet:import('./pets').PetId;form:'dry'|'wet'}
  | {kind:'pet-checkout'}
  | {kind:'pet-furniture-display'}
  | { kind: 'wardrobe' | 'clothes-rack' | 'fitting' | 'clothes-checkout' }
  | { kind: 'door'; destination: PlaceId }
  | { kind: 'shelf'; categories: MarketCategory[] }
  | { kind: 'education'; room: 'reception' | 'classroom' | 'lab' | 'workshop' }
  | { kind: 'career'; station: WorkStation }
  | { kind: 'employment'; career: CareerId }
  | { kind: 'waypoint' | 'checkout' | 'terminal' | 'pickup' | 'dine' | 'rest' | 'badminton' | 'campfire' | 'swing' | 'picnic' | 'exercise' | 'dog' | 'fridge' | 'cupboard' | 'parcel' | 'courier' | 'car' | 'unpack' };

export interface Station {
  id: string;
  name: string;
  center: Point;
  approach: Point;
  width: number;
  depth: number;
  action: SiteAction;
  blocks?: boolean;
}
function site(id: string, name: string, x: number, z: number, width: number, depth: number,
  action: SiteAction, options: { approach?: Point; blocks?: boolean } = {}): Station {
  return { id, name, center: { x, z }, approach: options.approach ?? { x, z: z + depth / 2 + 0.52 },
    width, depth, action, blocks: options.blocks ?? true };
}
const door = (id: string, name: string, destination: PlaceId, x: number, z: number, front = false) =>
  site(id, name, x, z, 1.22, 0.22, { kind: 'door', destination },
    { blocks: !front, approach: front ? { x, z: z - 0.70 } : undefined });
const shelf = (id: string, name: string, x: number, z: number, categories: MarketCategory[]) =>
  site(id, name, x, z, 1.86, 0.68, { kind: 'shelf', categories });

export const HOME_LAPTOP = 'career-laptop';
const workSites: Record<CareerId, readonly [number, number, number, number][]> = {
  it: [[-3.55,-2.35,1.72,.97],[1.30,-3.68,1.7,.54],[3.38,-2.65,1.95,1.14],[3.9,1.30,1.5,.87],[-3.55,1.46,1.6,.8]],
  detail: [[-3.74,1.13,1.60,.91],[-4.28,-2.22,1.45,.53],[-.44,1.64,1.93,.79],[-4.23,3.35,1.83,.60],[2.9,-1.38,2.65,2.80]],
  marketing: [[-3.63,-1.70,1.71,.99],[-4.05,1.45,1.74,.51],[3.59,1.42,2.04,1.21],[.1,-3.62,1.54,.65],[3.66,-2.23,1.9,.72]],
  clinic: [[3.54,-2.50,1.68,.90],[-3.97,-2.67,1.65,.66],[-3.90,1.34,1.86,.78],[3.68,1.63,1.81,.96],[.14,-1.94,1.52,1.35]],
};
function workStations(career: CareerId) {
  return CAREER_STATIONS.map((id,i) => site(id, CAREERS[career].stations[id], ...workSites[career][i], { kind:'career', station:id }));
}

export const WORK_DECOR: Partial<Record<PlaceId, { x: number; z: number; w: number; d: number }[]>> = {
  'work-it': [{x:-.65,z:-2.67,w:1.62,d:.85},{x:2.17,z:-4.12,w:1.28,d:.73},{x:-4.70,z:-4.47,w:1.15,d:.68}],
  'work-detail': [{x:.42,z:-2.86,w:2.13,d:2.27},{x:4.90,z:-3.9,w:1.28,d:.76},{x:3.62,z:2.70,w:2.5,d:.54}],
  'work-marketing': [{x:-.54,z:-1.64,w:1.56,d:.87},{x:1.66,z:-3.86,w:1.12,d:.57},{x:-.54,z:2.12,w:1.95,d:.51}],
  'work-clinic': [{x:1.4,z:-3.9,w:1.54,d:.74},{x:3.8,z:3.37,w:1.53,d:.67},{x:-.38,z:2.04,w:1.95,d:.54}],
};
export const WORK_NPCS: Record<CareerId, readonly Point[]> = {
  it:[{x:3.38,z:-3.42},{x:-.65,z:-3.22},{x:-3.55,z:.78}],
  detail:[{x:-.45,z:1.11},{x:1.75,z:-2.11},{x:.95,z:-3.91}],
  marketing:[{x:3.59,z:.65},{x:-.54,z:-2.27},{x:.1,z:-4.18}],
  clinic:[{x:3.54,z:-3.14},{x:1.4,z:-4.25},{x:-3.90,z:.81}],
};
export const WORK_VISITORS: Partial<Record<CareerId, Point>> = {
  detail:{x:5.25,z:2.35}, marketing:{x:-4.67,z:3.12}, clinic:{x:-3.10,z:3.72},
};

export const CAR_PARKING=HOME_YARD.parking;
export const CAR_APPROACH={x:CAR_PARKING.x-1.85,z:CAR_PARKING.z};
export const HOME_STATIONS: readonly Station[] = [
  site('family-car','Семейный автомобиль',CAR_PARKING.x,CAR_PARKING.z,2.46,4.96,{kind:'car'},{approach:CAR_APPROACH}),
  site('home-gate','Выйти на улицу',HOME_YARD.gate.x,HOME_YARD.gate.z,1.46,.24,{kind:'door',destination:'district'},{blocks:false,approach:HOME_GATE_INSIDE}),
  site('wardrobe-alina','Шкаф Алины',-8.57,1.48,1.16,.58,{kind:'wardrobe'},{approach:{x:-8.57,z:.57}}),
  site('wardrobe-vlad','Шкаф Влада',5.64,-1.53,1.16,.58,{kind:'wardrobe'},{approach:{x:5.50,z:-2.44}}),
  site(HOME_LAPTOP, 'Ноутбук Алины', -7.35, -.80, 1.78, .81, { kind:'career', station:'desk' }, { approach:{ x:-7.35,z:.69 } }),
  site('fridge', 'Холодильник', HOME_PLACEMENTS.fridge.x, HOME_PLACEMENTS.fridge.z, .94, .88, { kind: 'fridge' }),
  site('cupboard', 'Кухонные полки', COUNTER.x - 1.72, COUNTER.z - .56, .70, .46, { kind: 'cupboard' }, { blocks: false, approach: KITCHEN_WORK.tea.position }),
  site('courier-handoff','Курьер Максим',COURIER_PORCH.x,COURIER_PORCH.z,.64,.64,{kind:'courier'},{blocks:false,approach:COURIER_APPROACH}),
  site('parcel', 'Заказы у двери', 1.48, 4.59, 0.51, 0.38, { kind: 'parcel' }, { approach: { x: 1.48, z: 3.92 } }),
  site('home-doorstep', 'Дом', HOUSE_ENTRY.x, HOUSE_ENTRY.z, 1.4,.20, { kind:'waypoint' },
    { blocks:false,approach:{x:HOUSE_ENTRY.x,z:HOUSE_ENTRY.z-.66} }),
];

export const DISTRICT_STATIONS: readonly Station[] = [
  site('district-gate','Вернуться домой',HOME_YARD.gate.x,HOME_YARD.gate.z,1.46,.24,{kind:'door',destination:'home'},{blocks:false,approach:HOME_GATE_APPROACH}),
  ...DISTRICT_SITES.map(building => {
    const center = districtPoint(sitePoint(building, 0, building.d / 2 + .08));
    const career = (Object.keys(CAREERS) as CareerId[]).find(id => CAREERS[id].place === building.place);
    return site(districtStation(building.place),building.name,center.x,center.z,1.4,.24,
      career ? { kind:'employment',career } : { kind:'door',destination:building.place },
      { blocks:false,approach:districtPoint(sitePoint(building,0,building.d/2+1.06)) });
  }),
  site(districtStation('industrial'),'Выезд в промзону',INDUSTRIAL_EXIT.x,districtPoint(INDUSTRIAL_EXIT).z,3.2,.30,{kind:'door',destination:'industrial'},{blocks:false,approach:districtPoint({x:INDUSTRIAL_EXIT.x,z:INDUSTRIAL_EXIT.z-1.0})}),
  site('street-bench','Скамья у фонтана',DISTRICT_BENCH.x,districtPoint(DISTRICT_BENCH).z,DISTRICT_BENCH.w,DISTRICT_BENCH.d,{kind:'rest'}),
];

export const STATIONS: Record<PlaceId, readonly Station[]> = {
  home: HOME_STATIONS,
  district:DISTRICT_STATIONS,
  industrial:[
    site('warehouse-ozon','Склад Ozon',-4.65,-2.60,6.65,4.3,{kind:'warehouse',job:'ozon'},{approach:{x:-4.65,z:.35}}),
    site('warehouse-wildberries','Склад Wildberries',4.65,-2.60,6.65,4.3,{kind:'warehouse',job:'wildberries'},{approach:{x:4.65,z:.35}}),
    door('industrial-exit','Вернуться в район','district',-2.75,6.40,true),
  ],
  venue:[
    site('venue-reception','Касса PLAY ARENA',-7.5,4.7,2.1,.85,{kind:'venue',facility:'reception'}),
    site('venue-bowling','Боулинг',-6.2,-1.7,3.0,7.2,{kind:'venue',facility:'venueBowling'}),
    site('venue-hockey','Аэрохоккей',-1.6,-3.6,1.5,2.5,{kind:'venue',facility:'venueHockey'}),
    site('venue-billiards','Бильярд',2.3,-3.6,2.5,1.45,{kind:'venue',facility:'venueBilliards'}),
    site('venue-jenga','Дженга',-1.6,2.4,1.7,1.55,{kind:'venue',facility:'venueJenga'}),
    site('venue-uno','UNO',2.3,2.4,1.7,1.55,{kind:'venue',facility:'venueUno'}),
    site('venue-ufc','PS5 · UFC 6',6.9,-1.5,3.7,4.9,{kind:'venue',facility:'venueUfc'}),
    door('venue-exit','Выход','district',0,6.6,true),
  ],
  lake:[
    site('lake-rental','Прокат и кемпинг',-10,9,5.0,3.0,{kind:'lake',facility:'rental'},{approach:{x:-10,z:11.2}}),
    ...[[-10,-8],[-4,-8],[-10,1],[-4,1]].map(([x,z],i)=>site('lake-pitch-'+(i+1),'Площадка '+(i+1),x,z,4.0,3.4,{kind:'lake',facility:'pitch'})),
    ...[[-10,-8],[-4,-8],[-10,1],[-4,1]].map(([x,z],i)=>site('lake-fire-'+(i+1),'Костёр '+(i+1),x,z+4,1.8,1.6,{kind:'lake',facility:'fire'},{approach:{x,z:z+5.25}})),
    site('lake-pier','Рыбалка на пирсе',8.35,-3,1.0,1.2,{kind:'lake',facility:'fish'},{blocks:false,approach:{x:8.0,z:-3}}),
    ...[-10,-6,4,9].map((z,i)=>site('lake-fish-'+(i+1),'Рыбалка у воды',3.65,z,.8,1.3,{kind:'lake',facility:'fish'},{blocks:false,approach:{x:3.3,z}})),
    door('lake-exit','Выезд из клуба','district',-5,13.4,true),
  ],
  spa:[
    site('spa-reception','Ресепшен',-4,2.4,1.8,.7,{kind:'spa',facility:'reception'}),
    site('spa-pool','Бассейн',-3.8,-2.8,7.6,4.8,{kind:'spa',facility:'spaPool'}),
    site('spa-jacuzzi','Джакузи',2.5,-3.6,3.3,2.8,{kind:'spa',facility:'spaJacuzzi'}),
    site('spa-sauna','Сауна',4.1,.1,1.8,1.3,{kind:'spa',facility:'spaSauna'},{approach:{x:2.1,z:.1}}),
    site('spa-lounge-v','Лежак',-2.2,2.2,.85,2.08,{kind:'spa',facility:'spaLounge'}),
    site('spa-lounge-a','Лежак',-.8,2.2,.85,2.08,{kind:'spa',facility:'spaLounge'}),
    site('spa-massage-v','Массаж',2.0,2.2,.9,2.12,{kind:'spa',facility:'spaMassage'}),
    site('spa-massage-a','Массаж',3.4,2.2,.9,2.12,{kind:'spa',facility:'spaMassage'}),
    site('spa-locker-v','Раздевалка Влада',7.4,-3.3,1.8,1.2,{kind:'spa',facility:'spaLocker'}),
    site('spa-locker-a','Раздевалка Алины',7.4,1.0,1.8,1.2,{kind:'spa',facility:'spaLocker'}),
    site('spa-shower-v','Душ Влада',5.9,-1.7,1.05,1.10,{kind:'spa',facility:'spaShower'},{approach:{x:5.9,z:-.65}}),
    site('spa-shower-a','Душ Алины',7.8,3.0,1.05,1.10,{kind:'spa',facility:'spaShower'},{approach:{x:7.8,z:4.07}}),
    door('spa-exit','Выход','district',0,5.8,true),
  ],
  barber:[
    site('barber-reception','Ресепшен BRO',-3.8,2.5,2.1,.85,{kind:'barber',facility:'reception'}),
    site('barber-chair','Кресло барбера',0,-1.8,1.5,1.45,{kind:'barber',facility:'chair'}),
    site('barber-wait','Зона ожидания',3.6,2.4,2.2,.85,{kind:'rest'}),
    door('barber-exit','Выход на улицу','district',0,4.6,true),
  ],
  clinic:[
    site('clinic-reception','Ресепшен',-3.8,2.5,2.1,.85,{kind:'clinic',facility:'reception'}),
    site('clinic-wait','Зона ожидания',3.75,2.5,2.2,.85,{kind:'rest'}),
    site('clinic-doctor','Кабинет терапевта',-3.7,-2.9,2.35,1.4,{kind:'clinic',facility:'doctor'}),
    site('clinic-diagnostics','Диагностика',0,-2.9,2.0,1.4,{kind:'clinic',facility:'diagnostics'}),
    site('clinic-procedure','Процедурный кабинет',3.7,-2.9,2.25,1.4,{kind:'clinic',facility:'procedure'}),
    site('clinic-pharmacy','Аптека',3.7,.15,2.2,.85,{kind:'clinic',facility:'pharmacy'}),
    door('clinic-exit','Выход на улицу','district',0,4.6,true),
  ],
  fitness:[
    site('fitness-treadmill-a','Беговая дорожка',-7,-4.7,1.25,2.1,{kind:'fitness',facility:'treadmill'}),
    site('fitness-treadmill-b','Беговая дорожка',-4.8,-4.7,1.25,2.1,{kind:'fitness',facility:'treadmill'}),
    site('fitness-bike','Велотренажёр',-2.6,-4.7,1.1,1.65,{kind:'fitness',facility:'bike'}),
    site('fitness-elliptical','Эллипс',-0.5,-4.7,1.15,1.85,{kind:'fitness',facility:'elliptical'}),
    site('fitness-stepper','Степпер',1.65,-4.7,1.1,1.5,{kind:'fitness',facility:'stepper'}),
    site('fitness-rower','Гребной тренажёр',3.8,-4.7,1.1,2.2,{kind:'fitness',facility:'rower'}),
    site('fitness-legpress','Жим ногами',6.7,-4.7,1.8,2,{kind:'fitness',facility:'legpress'}),
    site('fitness-latpull','Вертикальная тяга',-7,-0.7,1.3,1.5,{kind:'fitness',facility:'latpull'}),
    site('fitness-seatedrow','Горизонтальная тяга',-4.8,-0.7,1.3,1.7,{kind:'fitness',facility:'seatedrow'}),
    site('fitness-chestpress','Жим от груди',-2.5,-0.7,1.35,1.65,{kind:'fitness',facility:'chestpress'}),
    site('fitness-legextension','Разгибание ног',-0.1,-0.7,1.3,1.6,{kind:'fitness',facility:'legextension'}),
    site('fitness-legcurl','Сгибание ног',2.2,-0.7,1.35,1.7,{kind:'fitness',facility:'legcurl'}),
    site('fitness-crossover','Кроссовер',5.85,-0.7,3.1,1.4,{kind:'fitness',facility:'crossover'}),
    site('fitness-rack','Стойка для приседаний',-7,3.05,1.7,1.65,{kind:'fitness',facility:'rack'}),
    site('fitness-bench','Скамья и штанга',-4.5,3.05,1.65,1.8,{kind:'fitness',facility:'bench'}),
    site('fitness-dumbbells','Гантели',-2.1,3.05,1.65,0.8,{kind:'fitness',facility:'dumbbells'}),
    site('fitness-mat-a','Коврик для йоги',0.25,3.05,1,1.7,{kind:'fitness',facility:'mat'}),
    site('fitness-mat-b','Коврик для растяжки',2.25,3.05,1,1.7,{kind:'fitness',facility:'mat'}),
    site('fitness-sauna','Сауна',7.1,3.05,2.35,2.2,{kind:'fitness',facility:'sauna'}),
    site('fitness-reception','Ресепшен PULSE',-6.7,5.8,2.7,0.85,{kind:'fitness',facility:'reception'},{approach:{x:-6.7,z:4.8}}),
    site('fitness-bar','Спортивный бар',5.05,5.8,2.2,0.85,{kind:'fitness',facility:'bar'},{approach:{x:5.05,z:4.8}}),
    site('fitness-locker-v','Мужская раздевалка',10.4,-4.7,2.1,1.8,{kind:'fitness',facility:'locker-v'}),
    site('fitness-locker-a','Женская раздевалка',13.1,-4.7,2.1,1.8,{kind:'fitness',facility:'locker-a'}),
    site('fitness-shower-v','Мужская душевая',10.4,-.7,2.1,1.8,{kind:'fitness',facility:'shower-v'}),
    site('fitness-shower-a','Женская душевая',13.1,-.7,2.1,1.8,{kind:'fitness',facility:'shower-a'}),
    site('fitness-toilet-v','Мужской туалет',10.4,3.05,2.1,1.8,{kind:'fitness',facility:'toilet-v'}),
    site('fitness-toilet-a','Женский туалет',13.1,3.05,2.1,1.8,{kind:'fitness',facility:'toilet-a'}),
    door('fitness-exit','Выход к машине','district',0,6.6,true),
  ],
  petshop:[
    site('pet-dog-dry','Сухой корм для собак',-3.75,-2.65,2.35,.95,{kind:'pet-food-display',pet:'verdell',form:'dry'}),
    site('pet-cat-dry','Сухой корм для кошек',0,-2.65,2.35,.95,{kind:'pet-food-display',pet:'simba',form:'dry'}),
    site('pet-cat-wet','Влажный корм для кошек',3.75,-2.65,2.35,.95,{kind:'pet-food-display',pet:'simba',form:'wet'}),
    site('pet-dog-wet','Влажный корм для собак',-3.75,.85,2.35,.95,{kind:'pet-food-display',pet:'verdell',form:'wet'}),
    site('pet-furniture','Для животных',0,.85,2.35,.95,{kind:'pet-furniture-display'}),
    site('pet-cash','Касса',3.65,1.45,1.75,.8,{kind:'pet-checkout'}),
    door('pet-exit','Выход на улицу','district',-2.75,4.60,true),
  ],
  electronics: [
    site('tech-desktop','Компьютеры',-3.75,-2.65,2.35,.95,{kind:'electronics-display',category:'desktop'}),
    site('tech-laptop','Ноутбуки',.0,-2.65,2.35,.95,{kind:'electronics-display',category:'laptop'}),
    site('tech-tv','Телевизоры',3.75,-2.65,2.35,.95,{kind:'electronics-display',category:'tv'}),
    site('tech-phone','Смартфоны',-3.75,.85,2.35,.95,{kind:'electronics-display',category:'phone'}),
    site('tech-coffee','Кофемашины',0,.85,2.35,.95,{kind:'electronics-display',category:'coffee'}),
    site('tech-speaker','Умные колонки',-4.15,3.65,2.15,.78,{kind:'speaker-display'},{approach:{x:-4.15,z:2.55}}),
    site('tech-vacuum','Роботы-пылесосы',4.05,3.65,2.15,.78,{kind:'vacuum-display'},{approach:{x:4.05,z:2.55}}),
    site('tech-ps5','PlayStation 5',8.15,-2.65,2.6,1.02,{kind:'console-display',sku:'console-ps5'}),
    site('tech-switch','Nintendo Switch 2',8.15,1.75,2.6,1.02,{kind:'console-display',sku:'console-switch2'},{approach:{x:8.15,z:.65}}),
    site('tech-cash','Касса',3.65,1.45,1.75,.8,{kind:'electronics-checkout'}),
    door('tech-exit','Выход на улицу','district',-1.80,4.60,true),
  ],
  clothing: [
    site('clothes-alina','Женская одежда',-3.75,-2.55,2.25,.84,{kind:'clothes-rack'}),
    site('clothes-vlad','Мужская одежда',3.75,-2.55,2.25,.84,{kind:'clothes-rack'}),
    site('clothes-fitting','Примерочная',-3.85,1.38,1.72,1.48,{kind:'fitting'}),
    site('clothes-cash','Касса',3.70,1.48,1.65,.76,{kind:'clothes-checkout'}),
    door('clothes-exit','Выход на улицу','district',-2.75,4.60,true),
  ],
  market: [
    shelf('dairy', 'Молочное', -4.37, -3.63, ['dairy']),
    shelf('bakery', 'Хлеб и выпечка', 0, -3.63, ['bakery']),
    shelf('meat', 'Мясо', 4.39, -3.63, ['meat']),
    shelf('produce', 'Овощи и фрукты', -4.37, -0.92, ['vegetables', 'fruit']),
    shelf('pantry', 'Бакалея', 0, -0.92, ['pantry']),
    shelf('drinks', 'Напитки', 4.39, -0.92, []),
    shelf('ready', 'Готовая еда', -4.37, 1.79, ['takeout']),
    shelf('pet-shelf', 'Для питомцев', 4.39, 1.79, ['pets']),
    site('checkout', 'Касса', 0, 1.83, 1.50, 0.72, { kind: 'checkout' }),
    door('market-exit', 'Выход на улицу', 'district', -2.75, 4.60, true),
  ],
  cafe: [
    site('terminal', 'Терминал заказов', -3.71, -2.51, 1.25, 0.84, { kind: 'terminal' }),
    site('pickup', 'Выдача заказов', 3.44, -2.51, 1.65, 0.84, { kind: 'pickup' }),
    site('cafe-left', 'Столик у окна', -2.93, 0.63, 1.76, 1.42, { kind: 'dine' }),
    site('cafe-right', 'Столик у растений', 2.93, 0.63, 1.76, 1.42, { kind: 'dine' }),
    site('cafe-center', 'Столик в центре', 0, -1.45, 1.76, 1.42, { kind: 'dine' }),
    door('cafe-exit', 'Выход на улицу', 'district', -2.75, 4.60, true),
  ],
  park: [
    site('park-swing','Качели под навесом',3.4,-3.55,2.2,1.2,{kind:'swing'},{approach:{x:3.4,z:-2.35}}),
    site('park-bench', 'Скамья под соснами', 3.69, -1.23, 1.69, 0.65, { kind: 'rest' }),
    site('park-pond-seat', 'Скамья у пруда', -3.85, -3.25, 1.65, .65, { kind: 'rest' }),
    site('park-badminton','Бадминтон',8.4,2.25,3.8,.24,{kind:'badminton'},{approach:{x:8.4,z:4.15}}),
    site('park-fire','Костровая поляна',8.45,-2.4,1.4,1.4,{kind:'campfire'},{approach:{x:8.45,z:-1.12}}),
    site('park-picnic', 'Место для пикника', -4.15, .98, 1.95, 1.28, { kind: 'picnic' }, { approach: {x:-4.15,z:2.15} }),
    site('park-path', 'Прогулочная дорожка', -2.68, -1.45, 0.67, 0.65, { kind: 'exercise' }, { blocks: false }),
    site('park-dog', 'Площадка для Верделла', 3.82, 2.12, 0.78, 0.65, { kind: 'dog' }, { blocks: false }),
    door('park-exit', 'Выход на улицу', 'district', -2.75, 4.60, true),
  ],
  education: [
    site('reception', 'Ресепшен', -3.65, 1.45, 2.00, .76, { kind: 'education', room: 'reception' }),
    site('classroom', 'Аудитория', -3.36, -2.25, 2.72, .98, { kind: 'education', room: 'classroom' }),
    site('lab', 'Компьютерный класс', 0, -2.25, 2.54, .98, { kind: 'education', room: 'lab' }),
    site('workshop', 'Практическая зона', 3.53, -2.25, 2.62, .98, { kind: 'education', room: 'workshop' }),
    door('education-exit', 'На площадь', 'district', -2.55, 4.60, true),
  ],
  'work-it': workStations('it'),
  'work-detail': workStations('detail'),
  'work-marketing': workStations('marketing'),
  'work-clinic': [...workStations('clinic'),door('vet-exit','Выход на улицу','district',0,4.6,true)],
};
export function doorwayArrival(destination:PlaceId, from:PlaceId, role:CharacterId):Point {
  if(destination==='home')return {x:HOME_GATE_INSIDE.x+(role==='vlad'?-.27:.27),z:HOME_GATE_INSIDE.z};
  if(destination==='district')return districtArrival(from,role);
  if(from !== 'district' && from!=='home') return spawn(destination,role);
  const exit=STATIONS[destination].find(station=>station.action.kind==='door'&&station.action.destination==='district');
  return exit ? {x:exit.approach.x+(role==='vlad'?-.44:.44),z:exit.approach.z-.34} : spawn(destination,role);
}
export const stationById = (place: PlaceId, id: unknown) => STATIONS[place].find(station => station.id === id);
export function approachFor(station: Station, role: CharacterId): Point {
  if (station.action.kind === 'education' && station.action.room !== 'reception')
    return { x: station.approach.x + (role === 'vlad' ? -.63 : .63), z: station.approach.z + .35 };
  if(station.action.kind==='venue'&&station.action.facility!=='reception'){
    const {x,z}=station.center,side=role==='vlad'?-1:1;
    if(station.action.facility==='venueBowling'||station.action.facility==='venueUfc')return {x:x+side*.65,z:station.approach.z};
    return {x,z:z+side*(station.depth/2+.63)};
  }
  if(station.action.kind==='lake'&&['fire','pitch'].includes(station.action.facility))return {x:station.approach.x+(role==='vlad'?-.43:.43),z:station.approach.z};
  if(station.action.kind==='spa'&&['spaPool','spaJacuzzi','spaSauna'].includes(station.action.facility))return {x:station.approach.x+(role==='vlad'?-.44:.44),z:station.approach.z};
  if(station.action.kind==='fitness'&&['sauna','bar'].includes(station.action.facility))return {x:station.approach.x+(role==='vlad'?-.42:.42),z:station.approach.z};
  if(station.action.kind==='badminton')return {x:station.center.x,z:station.center.z+(role==='vlad'?1:-1)*1.85};
  if (station.action.kind !== 'swing' && station.action.kind !== 'picnic' && station.action.kind !== 'dine' && station.action.kind !== 'rest') return station.approach;
  return { x: station.approach.x + (role === 'vlad' ? -0.40 : 0.40), z: station.approach.z };
}
export function placeObstacles(place: PlaceId, furnishing?: import('./furniture').FurnishingState) {
  const obstacles = STATIONS[place].flatMap(({ blocks, center, width, depth }) => blocks ? [{
    minX: center.x - width / 2 - 0.26, maxX: center.x + width / 2 + 0.26,
    minZ: center.z - depth / 2 - 0.26, maxZ: center.z + depth / 2 + 0.26,
  }] : []);
  if (place === 'home') obstacles.push(...HOME_DECOR.filter((_,index)=>
    !((index===0&&furnishing?.soldFixtures?.includes('nightstandLeft'))||
      (index===1&&furnishing?.soldFixtures?.includes('nightstandRight')))),
    ...HOME_STRUCTURE_OBSTACLES,
    ...Object.entries(HOME_FURNITURE).filter(([id])=>!furnishing?.soldFixtures?.includes(id as import('./furniture').StaticFurnitureId)).map(([,bounds]) => ({
    minX: bounds.minX - .27, maxX: bounds.maxX + .27, minZ: bounds.minZ - .27, maxZ: bounds.maxZ + .27,
  })));
  if (place === 'home' && furnishing) obstacles.push(...furnishingObstacles(furnishing));
  if(place==='lake')obstacles.push({minX:4.61,maxX:9.5,minZ:-13.7,maxZ:-4.05},{minX:4.61,maxX:9.5,minZ:-1.95,maxZ:13.7});
  if (place === 'park') obstacles.push({ minX: -1.8, maxX: 1.6, minZ: -3.32, maxZ: -0.58 },...PARK_TREES.map(([x,z])=>({minX:x-.37,maxX:x+.37,minZ:z-.37,maxZ:z+.37})));
  if (place === 'cafe') obstacles.push({ minX: -2.57, maxX: 2.57, minZ: -4.62, maxZ: -3.7 },{minX:-2.54,maxX:-.16,minZ:-4.25,maxZ:-2.77});
  if(place==='district')obstacles.push(...DISTRICT_WORLD_OBSTACLES);
  if (place === 'market') obstacles.push(CASHIER_OBSTACLE);
  for (const { x,z,w,d } of WORK_DECOR[place] ?? []) obstacles.push({
    minX:x-w/2-.26,maxX:x+w/2+.26,minZ:z-d/2-.26,maxZ:z+d/2+.26,
  });
  const workId = (Object.keys(CAREERS) as CareerId[]).find(id=>CAREERS[id].place===place);
  if (workId) {
    const visitor = WORK_VISITORS[workId];
    for (const {x,z} of WORK_NPCS[workId]) obstacles.push({minX:x-.42,maxX:x+.42,minZ:z-.39,maxZ:z+.39});
    if (visitor) obstacles.push({minX:visitor.x-.43,maxX:visitor.x+.43,minZ:visitor.z-.42,maxZ:visitor.z+.42});
  }
  const workDesk = STATIONS[place].find(site=>site.id===(place==='home'?HOME_LAPTOP:workId?'desk':''));
  if (workDesk) obstacles.push({minX:workDesk.center.x-.48,maxX:workDesk.center.x+.48,
    minZ:workDesk.center.z+.13,maxZ:Math.min(workDesk.approach.z-.10,workDesk.center.z+1.10)});
  if (place === 'education') obstacles.push(
    { minX: -4.45, maxX: -2.85, minZ: .43, maxZ: 1.10 },
    { minX: 1.46, maxX: 2.14, minZ: -3.98, maxZ: -3.30 },
  );
  return obstacles;
}

export const CAFE_MENU = {
  cappuccino: { name: 'Капучино', price: 260, hunger: 5, energy: 14, mood: 20, comfort: 15, minutes: 12 },
  tea: { name: 'Чай с ягодами', price: 190, hunger: 5, energy: 8, mood: 15, comfort: 10, minutes: 12 },
  brioche: { name: 'Бриошь с сыром', price: 380, hunger: 35, energy: 3, mood: 25, comfort: 20, minutes: 16 },
  pastry: { name: 'Ягодный тарт', price: 410, hunger: 25, energy: 4, mood: 45, comfort: 30, minutes: 16 },
  caesar: { name: 'Цезарь с курицей', price: 590, hunger: 65, energy: 0, mood: 50, comfort: 45, minutes: 20 },
  tomYum: { name: 'Том-ям с креветками и рисом', price: 890, hunger: 100, energy: 0, mood: 100, comfort: 100, minutes: 24 },
  tunaPoke: { name: 'Поке с тунцом и авокадо', price: 990, hunger: 100, energy: 0, mood: 100, comfort: 100, minutes: 27 },
  bbqRibs: { name: 'Свиные рёбрышки BBQ с коул-слоу', price: 1290, hunger: 100, energy: 0, mood: 100, comfort: 100, minutes: 30 },
} as const;
export const CAFE_TALK_SECONDS=18;
export function cafeSeatAt(state:Pick<import('./protocol').GameState,'world'|'characters'>,role:CharacterId):Station|undefined{
  if(state.world.places[role]!=='cafe'||state.characters[role].pose!=='sit')return;
  return STATIONS.cafe.find(station=>{
    const p=approachFor(station,role),c=state.characters[role];
    return station.action.kind==='dine'&&Math.hypot(p.x-c.x,p.z-c.z)<.22;
  });
}
export type CafeItem = keyof typeof CAFE_MENU;
export function isCafeItem(value: unknown): value is CafeItem {
  return typeof value === 'string' && Object.hasOwn(CAFE_MENU, value);
}
export const DELIVERY_FEE = 149;
export const DELIVERY_MINUTES = 18;
export const CAFE_MINUTES = 2;
export interface Delivery { id: string; role: CharacterId; lines: BasketLine[]; cost: number; readyAt: number; handedAt?:number }
export interface CafeOrder { item: CafeItem; readyAt: number; pickedUp: boolean; table?: string; orderedAt?: number }
export interface WorldState {
  districtLayout?: 1 | 2 | 3 | 4;
  places: Record<CharacterId, PlaceId>;
  sequence: Record<CharacterId, number>;
  bags: Record<CharacterId, number>;
  tableBags: number;
  deliveries: Delivery[];
  courierDepartAt?:number;
  carDriver?:CharacterId;
  electronics?: import('./electronics').ElectronicsState;
  wardrobe?: import('./previewWardrobe').OwnedWardrobe;
  cafe: Partial<Record<CharacterId, CafeOrder>>;
  dogWalker: CharacterId | null;
  vetVisit?:{owner:CharacterId;pet:import('./pets').PetId};
  picnic?: PicnicBasket;
  campKit?: Partial<Record<CharacterId,CampKit>>;
  campLitUntil?:number;
  parkDog?:ParkDogVisit;
  fitness?:import('./fitness').FitnessState;
  spa?:import('./spa').SpaState;
  lake?:import('./lake').LakeState;
  fishing?:import('./lake').FishingStock;
}
export function initialWorld(): WorldState {
  return { districtLayout: 4, places: { vlad: 'home', alina: 'home' }, sequence: { vlad: 0, alina: 0 },
    bags: { vlad: 0, alina: 0 }, tableBags: 0, deliveries: [], cafe: {}, dogWalker: null };
}
export type LocalActivity = import('./lake').LakeRestAction | import('./lake').LakeFishAction | import('./lake').LakeMealAction | import('./spa').SpaAction | import('./barber').BarberAction | import('./health').VetAction | import('./health').ClinicAction | import('./fitness').FitnessBarAction | 'fitnessLocker' | 'fitnessShower' | 'fitnessToilet' | 'fitnessSauna' | 'fitnessTrain' | 'rest' | 'badminton' | 'swing' | 'picnic' | 'exercise' | 'dine' | 'dog' | 'dogFetch' | 'dogChase' | 'dogRoll' | 'dogToilet' | 'campIgnite' | CampRecipe | 'unpack';
export type WorldCommand =
  | import('./venue').VenueCommand
  | import('./lake').LakeCommand
  | import('./spa').SpaCommand
  | import('./consoleCatalog').ConsoleCommand
  | import('./barber').BarberCommand
  | import('./health').HealthCommand
  | import('./fitness').FitnessCommand
  | { type:'camp_pack'; item:CampRecipe|'fuel' }
  | { type:'picnic_buy' }
  | { type:'picnic_pack' | 'picnic_unpack'; kind:'meal'|'takeout'; item:string }
  | { type: 'close_storage' }
  | { type: 'travel'; place: PlaceId; via?: string; dog?: boolean }
  | {type:'pet_food_buy';product:string}
  | {type:'pet_toy_buy';product:string}
  | {type:'pet_furniture_buy';sku:string}
  | {type:'speaker_buy';sku:import('./speakerCatalog').SpeakerSku}
  | import('./speaker').SpeakerCommand
  | {type:'vacuum_buy';sku:import('./vacuumCatalog').VacuumSku}
  | import('./vacuum').VacuumCommand
  | {type:'electronics_buy';model:import('./electronics').ElectronicsId}
  | { type:'clothing_buy'|'clothing_wear'; look:string }
  | { type: 'car_travel'; place:'market'|'cafe'|'park'|'clothing'|'electronics'|'petshop'|'industrial'|'fitness'|'clinic'|'barber'|'spa'|'lake'|'work-clinic';pass?:import('./lake').LakePass;dog?:boolean;pet?:import('./pets').PetId }
  | { type: 'walk'; place: PlaceId; x: number; z: number }
  | { type: 'approach'; place: PlaceId; station: string }
  | { type: 'store_pay'; lines: BasketLine[]; sequence: number }
  | { type: 'delivery_order'; lines: BasketLine[]; sequence: number }
  | {type:'delivery_handoff';id:string}
  | { type: 'delivery_claim'; id: string; storage?: 'fridge' | 'table' }
  | { type: 'ready_food_move'; kind: 'meal' | 'takeout'; item: string }
  | { type: 'ready_food_serve'; kind: 'meal' | 'takeout'; item: string }
  | { type: 'ready_food_discard'; kind: 'meal' | 'takeout'; item: string; storage: 'fridge' | 'table' }
  | { type: 'cafe_seat'; station: string }
  | { type: 'cafe_order'; item: CafeItem; sequence: number; table?: string }
  | { type: 'cafe_pickup' }
  | { type: 'dog_leash' }
  | { type: 'local_activity'; action: LocalActivity; station: string };

export { gameMinutes as clockMinutes } from './life';
