import {FURNITURE_CATALOG,FURNITURE_DELIVERY} from './furniture';
import type {LampSpot} from './renovationPlacement';
import type {BathFixture} from './home';
import {HOUSE,HOUSE_WING,WEST_WALL,EAST_WALL,BEDROOM_END,WC_START,OFFICE_END} from './home';
export const ROOM_IDS=['bedroom','spare','wc','kitchen','living','office','bathroom','wing1','wing2','wing3'] as const;
export type RoomId=typeof ROOM_IDS[number];
export type SurfaceKind='wall'|'floor'|'ceiling'|'portable'|'sanitary';
export const ROOMS=[
 ['bedroom','Спальня',HOUSE.minX,WEST_WALL,HOUSE.minZ,BEDROOM_END],
 ['spare','Вторая комната',HOUSE.minX,WEST_WALL,BEDROOM_END,WC_START],
 ['wc','Туалет',HOUSE.minX,WEST_WALL,WC_START,HOUSE.maxZ],
 ['kitchen','Кухня',WEST_WALL,EAST_WALL,HOUSE.minZ,-.85],
 ['living','Гостиная',WEST_WALL,EAST_WALL,-.85,HOUSE.maxZ],
 ['office','Кабинет',EAST_WALL,HOUSE.maxX,HOUSE.minZ,OFFICE_END],
 ['bathroom','Ванная',EAST_WALL,HOUSE.maxX,OFFICE_END,HOUSE.maxZ],
 ...(['wing1','wing2','wing3'] as const).map((id,i)=>[id,'Дополнительная '+(i+1),HOUSE_WING.minX,HOUSE_WING.maxX,[HOUSE_WING.minZ,...HOUSE_WING.crossWalls][i],[...HOUSE_WING.crossWalls,HOUSE_WING.maxZ][i]] as const)
].map(([id,name,x1,x2,z1,z2])=>({id,name,x1,x2,z1,z2})) as readonly {id:RoomId;name:string;x1:number;x2:number;z1:number;z2:number}[];
type Pattern='linen'|'plain'|'plaster'|'slat'|'stone'|'tile'|'wood'|'herringbone'|'carpet'|'vinyl'|'stripe'|'botanical'|'hex'|'flush'|'ring'|'pendant'|'globe'|'rail'|'crystal';
export type Covering={id:string;name:string;kind:SurfaceKind;pattern:Pattern;color:number;price:number;wet:boolean;fixture?:BathFixture;design?:number};
const c=(id:string,name:string,kind:SurfaceKind,pattern:Pattern,color:number,price:number,wet=false):Covering=>({id,name,kind,pattern,color,price,wet});
const sanitary=(id:string,name:string,fixture:BathFixture,design:number,color:number,price:number):Covering=>({...c(id,name,'sanitary','plain',color,price,true),fixture,design});
export const FIXTURE_ROOMS:Record<BathFixture,RoomId>={toilet:'wc',wcBasin:'wc',basin:'bathroom',shower:'bathroom',bathtub:'bathroom'};
export const FIXTURE_LABELS:Record<BathFixture,string>={toilet:'Унитаз',wcBasin:'Компактная раковина',basin:'Раковина в ванной',shower:'Душевая',bathtub:'Ванна'};
export const SANITARY=[
 sanitary('wc-compact','Унитаз «Компакт»','toilet',1,0xf5f2e8,11900),
 sanitary('wc-float','Унитаз «Флоат»','toilet',2,0xe5e5e0,21900),
 sanitary('wc-onyx','Унитаз «Оникс»','toilet',3,0x41494b,27900),
 sanitary('wc-classic','Унитаз «Классика»','toilet',4,0xf1e5d4,16900),
 sanitary('shower-line','Душевая «Линия»','shower',1,0x353c3b,22900),
 sanitary('shower-clear','Душевая «Кристалл»','shower',2,0xc0d5d6,32900),
 sanitary('shower-stone','Душевая «Травертин»','shower',3,0xc9ae88,39900),
 sanitary('shower-rain','Душевая «Дождь»','shower',4,0x718c8d,47900),
 sanitary('bath-oval','Ванна «Овал»','bathtub',1,0xf4f0e9,28900),
 sanitary('bath-oak','Ванна «Дуб»','bathtub',2,0xb08a62,36900),
 sanitary('bath-stone','Ванна «Камень»','bathtub',3,0x929d9d,45900),
 sanitary('bath-classic','Ванна «Ретро»','bathtub',4,0xf2e5d2,49900),
 sanitary('basin-oak','Раковина «Дуб»','basin',1,0xb99163,16900),
 sanitary('basin-float','Раковина «Воздух»','basin',2,0xe3e4de,22900),
 sanitary('basin-stone','Раковина «Графит»','basin',3,0x555f60,26900),
 sanitary('basin-round','Раковина «Луна»','basin',4,0xd4c0a3,24900),
 sanitary('mini-oak','Мини-раковина «Дуб»','wcBasin',1,0xb99163,7900),
 sanitary('mini-float','Мини-раковина «Воздух»','wcBasin',2,0xe3e4de,10900),
 sanitary('mini-stone','Мини-раковина «Графит»','wcBasin',3,0x555f60,13900),
 sanitary('mini-round','Мини-раковина «Луна»','wcBasin',4,0xd4c0a3,11900),
] as const;
export const COVERINGS=[
 ...SANITARY,
 c('wall-linen-cream','Лён · сливочный','wall','linen',0xe8dbc4,390),
 c('wall-linen-sage','Лён · шалфей','wall','linen',0x9cae98,420),
 c('wall-linen-rose','Лён · пудра','wall','linen',0xd6aba8,420),
 c('wall-matte-milk','Матовые · молоко','wall','plain',0xf0e9dc,310),
 c('wall-matte-blue','Матовые · дымчатый синий','wall','plain',0x839da9,350),
 c('wall-matte-olive','Матовые · олива','wall','plain',0x9c9b73,350),
 c('wall-plaster-sand','Штукатурка · песок','wall','plaster',0xd0b698,690,true),
 c('wall-plaster-pearl','Штукатурка · жемчуг','wall','plaster',0xdedbd3,780,true),
 c('wall-slat-oak','Рейки · светлый дуб','wall','slat',0xc8a476,1250),
 c('wall-slat-walnut','Рейки · орех','wall','slat',0x78523e,1490),
 c('wall-tile-white','Плитка · белая','wall','tile',0xe9e9df,790,true),
 c('wall-tile-sage','Плитка · шалфей','wall','tile',0xa2b9a6,890,true),
 c('wall-tile-blue','Плитка · море','wall','tile',0x7d9aab,990,true),
 c('wall-stone-ivory','Камень · травертин','wall','stone',0xd3c2a4,1390,true),
 c('wall-stone-graphite','Камень · графит','wall','stone',0x777b79,1490,true),
 c('floor-oak-light','Ламинат · светлый дуб','floor','wood',0xd4b68f,890),
 c('floor-oak-honey','Ламинат · медовый дуб','floor','wood',0xb98c61,950),
 c('floor-walnut','Ламинат · орех','floor','wood',0x836044,1090),
 c('floor-ash','Ламинат · серый ясень','floor','wood',0xb4b3ad,990),
 c('floor-parquet-oak','Паркет ёлочка · дуб','floor','herringbone',0xc3a17b,1850),
 c('floor-parquet-walnut','Паркет ёлочка · орех','floor','herringbone',0x90684c,2190),
 c('floor-vinyl-natural','Кварцвинил · натуральный','floor','vinyl',0xc5ac91,1390,true),
 c('floor-vinyl-grey','Кварцвинил · серый','floor','vinyl',0xa6a7a4,1490,true),
 c('floor-tile-sand','Керамогранит · песок','floor','tile',0xcdbb9c,1190,true),
 c('floor-tile-slate','Керамогранит · сланец','floor','tile',0x748584,1390,true),
 c('floor-tile-marble','Керамогранит · мрамор','floor','stone',0xe1dfd7,1690,true),
 c('floor-carpet-cream','Ковролин · кремовый','floor','carpet',0xd4c4ae,790),
 c('floor-carpet-sage','Ковролин · шалфей','floor','carpet',0xa4b29e,890),
 c('floor-carpet-grey','Ковролин · серый','floor','carpet',0xa3a5a4,890),
 c('wall-linen-oat','Лён · овсяный','wall','linen',0xc6b79e,430),
 c('wall-matte-grey','Матовые · туман','wall','plain',0xb7bdbe,330),
 c('wall-matte-clay','Матовые · терракота','wall','plain',0xb97e65,380),
 c('wall-plaster-grey','Штукатурка · бетон','wall','plaster',0xa3a5a2,730,true),
 c('wall-plaster-rose','Штукатурка · розовый кварц','wall','plaster',0xd8bab4,760,true),
 c('wall-stripe-cream','Полосы · крем','wall','stripe',0xe0d5bf,520),
 c('wall-stripe-blue','Полосы · голубой','wall','stripe',0xa5b7c3,540),
 c('wall-botanical-sage','Ботаника · шалфей','wall','botanical',0xd7e1ca,620),
 c('wall-botanical-rose','Ботаника · роза','wall','botanical',0xe5c8bf,650),
 c('wall-slat-ash','Рейки · ясень','wall','slat',0xbeb9ab,1290),
 c('wall-tile-cream','Плитка · айвори','wall','tile',0xddd0b6,850,true),
 c('wall-tile-charcoal','Плитка · уголь','wall','tile',0x545e60,990,true),
 c('wall-hex-white','Соты · белые','wall','hex',0xe8e5de,1090,true),
 c('wall-hex-green','Соты · зелёные','wall','hex',0x8eaa96,1190,true),
 c('wall-stone-marble','Камень · мрамор','wall','stone',0xdedcda,1590,true),
 c('floor-wood-smoked','Ламинат · копчёный дуб','floor','wood',0x665c53,1190),
 c('floor-wood-birch','Ламинат · берёза','floor','wood',0xe0ceb0,890),
 c('floor-parquet-ash','Паркет ёлочка · ясень','floor','herringbone',0xb7af9e,1950),
 c('floor-parquet-honey','Паркет ёлочка · мёд','floor','herringbone',0xc59563,1990),
 c('floor-vinyl-walnut','Кварцвинил · орех','floor','vinyl',0x8e6e52,1590,true),
 c('floor-vinyl-white','Кварцвинил · белёный дуб','floor','vinyl',0xd7cbb7,1490,true),
 c('floor-tile-cream','Керамогранит · крем','floor','tile',0xe1d4bc,1290,true),
 c('floor-tile-concrete','Керамогранит · бетон','floor','tile',0xa6a7a4,1390,true),
 c('floor-hex-grey','Плитка соты · туман','floor','hex',0xa5b1b2,1590,true),
 c('floor-hex-sand','Плитка соты · песок','floor','hex',0xc9b99b,1490,true),
 c('floor-carpet-rose','Ковролин · пудра','floor','carpet',0xc3a3a2,950),
 c('floor-carpet-blue','Ковролин · дымчатый синий','floor','carpet',0x899ca8,950),
 c('ceiling-flush','Плафон «Луна»','ceiling','flush',0xffe6c1,3490,true),
 c('ceiling-ring','Люстра «Орбита»','ceiling','ring',0xffdfaa,11900),
 c('ceiling-pendant','Подвес «Трио»','ceiling','pendant',0xffd5a5,7900),
 c('ceiling-globe','Люстра «Жемчуг»','ceiling','globe',0xffebce,14900),
 c('ceiling-rail','Споты «Линия»','ceiling','rail',0xffe3c2,5990,true),
 c('ceiling-crystal','Люстра «Кристалл»','ceiling','crystal',0xffefda,18900),
 ...FURNITURE_CATALOG.filter(p=>p.category==='lighting').map(p=>c(p.id,p.name,'portable','plain',0xf0d4ac,p.price)),
] as const;
export const COVERING_BY_ID=new Map(COVERINGS.map(x=>[x.id,x]));
export const roomById=(id:unknown)=>ROOMS.find(r=>r.id===id);
export const coveringById=(id:unknown)=>typeof id==='string'?COVERING_BY_ID.get(id):undefined;
export type RenovationState={surfaces:Partial<Record<RoomId,Partial<Record<SurfaceKind,string>>>>;samples:string[];lights?:Partial<Record<RoomId,'auto'|'off'|'soft'|'warm'>>;fixtures?:Partial<Record<BathFixture,string>>};
export const initialRenovation=():RenovationState=>({surfaces:{},samples:[]});
export function compatible(room:RoomId,product:Covering){return product.fixture?FIXTURE_ROOMS[product.fixture]===room:!['bathroom','wc'].includes(room)||product.wet;}
export function renovationQuote(room:RoomId,product:Covering){
 const r=roomById(room)!;const w=r.x2-r.x1,d=r.z2-r.z1;
 if(product.fixture){const installation=product.fixture==='shower'?4500:product.fixture==='bathtub'?3500:product.fixture==='toilet'?1800:1500;return {area:1,materials:product.price,installation,total:product.price+installation};}
 if(product.kind==='portable')return {area:1,materials:product.price,installation:FURNITURE_DELIVERY.regular.fee,total:product.price+FURNITURE_DELIVERY.regular.fee};
 if(product.kind==='ceiling')return {area:1,materials:product.price,installation:1200,total:product.price+1200};
 const area=Math.ceil(product.kind==='floor'?w*d:2*(w+d)*2.65*.88);
 const materials=area*product.price,installation=area*(product.kind==='floor'?280:220);
 return {area,materials,installation,total:materials+installation};
}
export function validRenovation(v:unknown):v is RenovationState{
 if(!v||typeof v!=='object'||Array.isArray(v))return false;
 const s=v as RenovationState;
 return (s.fixtures===undefined||!!s.fixtures&&typeof s.fixtures==='object'&&!Array.isArray(s.fixtures)&&Object.entries(s.fixtures).every(([slot,sku])=>coveringById(sku)?.fixture===slot))&&(s.lights===undefined||!!s.lights&&typeof s.lights==='object'&&!Array.isArray(s.lights)&&Object.entries(s.lights).every(([r,m])=>!!roomById(r)&&['auto','off','soft','warm'].includes(m)))&&Array.isArray(s.samples)&&s.samples.length<=COVERINGS.length&&new Set(s.samples).size===s.samples.length&&s.samples.every(id=>!!coveringById(id))&&!!s.surfaces&&typeof s.surfaces==='object'&&!Array.isArray(s.surfaces)&&Object.entries(s.surfaces).every(([room,entries])=>!!roomById(room)&&!!entries&&typeof entries==='object'&&!Array.isArray(entries)&&Object.entries(entries).every(([kind,id])=>{const p=coveringById(id);return !!p&&p.kind!=='portable'&&p.kind!=='sanitary'&&p.kind===kind&&compatible(room as RoomId,p);}));
}
export const installedRenovation=(s:RenovationState|undefined,room:RoomId,p:Covering)=>p.fixture?s?.fixtures?.[p.fixture]??null:s?.surfaces[room]?.[p.kind]??null;
export type RenovationPreview={room:RoomId;sku:string;spot?:LampSpot};
