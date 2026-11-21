import type { FloorRect } from '../game/navigation';

export type FurnitureCategory = 'seating' | 'sleep' | 'storage' | 'tables' | 'lighting' | 'decor';
export type FurnitureShape = 'sofa' | 'corner' | 'armchair' | 'ottoman' | 'bench' |
  'bed' | 'daybed' | 'wardrobe' | 'dresser' | 'shelves' | 'sideboard' |
  'table' | 'desk' | 'chair' | 'stool' | 'nightstand' | 'lamp' | 'plant' | 'rug' | 'mirror';
export type FurnitureFinish = 'oak' | 'walnut' | 'ivory' | 'sage' | 'terracotta' | 'slate' | 'blush' | 'midnight';
export type Rotation = 0 | 1 | 2 | 3;
export interface FurnitureProduct {
  id: string; name: string; category: FurnitureCategory; shape: FurnitureShape;
  price: number; width: number; depth: number; height: number;
  description: string; emoji: string;
  /** Rugs are walkable and may be installed beneath furniture. */
  walkable?: boolean;
}
export const FURNITURE_CATEGORIES: Record<FurnitureCategory,string> = {
  seating:'Диваны и кресла',sleep:'Спальня',storage:'Хранение',
  tables:'Столы и стулья',lighting:'Освещение',decor:'Декор и растения',
};
export const FURNITURE_FINISHES: Record<FurnitureFinish,{name:string;main:number;light:number;dark:number;fabric:number}> = {
  oak:{name:'Светлый дуб',main:0xc49d72,light:0xe5d0a8,dark:0x765642,fabric:0xdcc8aa},
  walnut:{name:'Орех',main:0x78533d,light:0xb98963,dark:0x432f2b,fabric:0xc9aa91},
  ivory:{name:'Слоновая кость',main:0xe4ddca,light:0xf9f3e8,dark:0xa8a08c,fabric:0xf0e8d9},
  sage:{name:'Шалфей',main:0x839b83,light:0xbed0ad,dark:0x526f62,fabric:0x9fb9a1},
  terracotta:{name:'Терракота',main:0xb46e54,light:0xe5ae91,dark:0x855044,fabric:0xc98975},
  slate:{name:'Графит',main:0x59666d,light:0x9daab0,dark:0x38454d,fabric:0x788b92},
  blush:{name:'Пудровый',main:0xc99f9b,light:0xebcfc8,dark:0x987678,fabric:0xd8b8b2},
  midnight:{name:'Тёмно-синий',main:0x394e67,light:0x8599a9,dark:0x263344,fabric:0x536d86},
};
export const FINISH_IDS = Object.keys(FURNITURE_FINISHES) as FurnitureFinish[];
const product = (id:string,name:string,category:FurnitureCategory,shape:FurnitureShape,
  price:number,width:number,depth:number,height:number,emoji:string,description:string,
  walkable=false):FurnitureProduct =>
  ({id,name,category,shape,price,width,depth,height,emoji,description,...(walkable?{walkable:true}:{})});
export const FURNITURE_CATALOG: readonly FurnitureProduct[] = [
  product('sofa-luna','Диван «Луна»','seating','sofa',18900,2.05,.82,.76,'🛋️','Компактный двухместный диван, мягкие подушки.'),
  product('sofa-nord','Диван «Норд»','seating','sofa',32900,2.72,.98,.79,'🛋️','Широкий семейный диван с глубоким сиденьем.'),
  product('sofa-arc','Угловой диван «Арка»','seating','corner',58500,2.80,1.76,.78,'🛋️','Мягкий угловой диван с оттоманкой.'),
  product('sofa-micro','Мини-диван «Капля»','seating','sofa',11900,1.38,.75,.76,'🛋️','Для небольших комнат и уютных уголков.'),
  product('chair-nest','Кресло «Гнездо»','seating','armchair',8900,.85,.83,.82,'🪑','Округлое кресло для спокойного отдыха.'),
  product('chair-cloud','Кресло «Облако»','seating','armchair',14900,1.04,.90,.90,'🪑','Широкое мягкое кресло с подлокотниками.'),
  product('pouf-joy','Пуф «Джой»','seating','ottoman',3500,.58,.58,.42,'🟡','Низкий мягкий пуф с аккуратной обивкой.'),
  product('bench-mori','Банкетка «Мори»','seating','bench',7400,1.18,.46,.47,'🪑','Деревянная банкетка с мягкой подушкой.'),
  product('bed-solo','Кровать «Соло»','sleep','bed',21900,1.15,2.15,.74,'🛏️','Односпальная кровать с изголовьем.'),
  product('bed-aurora','Кровать «Аврора»','sleep','bed',42500,1.86,2.18,.84,'🛏️','Большая кровать с мягким изголовьем.'),
  product('bed-line','Кровать «Линия»','sleep','bed',35900,1.62,2.07,.72,'🛏️','Сдержанная модель на устойчивой основе.'),
  product('bed-day','Кушетка «Вега»','sleep','daybed',17500,1.94,.91,.72,'🛏️','Компактная кушетка для гостевой комнаты.'),
  product('wardrobe-tall','Шкаф «Вертикаль»','storage','wardrobe',17900,1.16,.58,2.20,'🚪','Двустворчатый шкаф с полками.'),
  product('wardrobe-wide','Гардероб «Милан»','storage','wardrobe',35900,2.05,.65,2.24,'🚪','Просторный шкаф с декоративными ручками.'),
  product('wardrobe-mirror','Шкаф «Зеркало»','storage','wardrobe',28900,1.63,.62,2.16,'🚪','Шкаф с зеркальной створкой.'),
  product('dresser-nora','Комод «Нора»','storage','dresser',12900,1.12,.48,.87,'🗄️','Три вместительных ящика.'),
  product('dresser-mini','Комод «Мини»','storage','dresser',7900,.78,.44,.85,'🗄️','Узкий комод для белья и мелочей.'),
  product('shelf-open','Стеллаж «Куб»','storage','shelves',9900,.93,.39,1.95,'📚','Открытые полки и лёгкая конструкция.'),
  product('shelf-wide','Стеллаж «Атлас»','storage','shelves',15900,1.56,.42,1.88,'📚','Широкий книжный стеллаж.'),
  product('sideboard','Тумба «Тихий дом»','storage','sideboard',13400,1.37,.46,1.00,'🗄️','Комбинация ящиков и открытых отделений.'),
  product('table-round','Стол «Круг»','tables','table',11500,1.10,1.10,.76,'🍽️','Круглая столешница на устойчивой ножке.'),
  product('table-family','Стол «Семья»','tables','table',18900,1.72,.93,.77,'🍽️','Просторный обеденный стол.'),
  product('table-coffee','Журнальный стол «Лист»','tables','table',6200,.92,.57,.43,'☕','Низкий столик для гостиной.'),
  product('desk-simple','Письменный стол «Лайн»','tables','desk',14300,1.35,.64,.75,'💻','Рабочая поверхность с удобной полкой.'),
  product('desk-large','Стол «Проект»','tables','desk',28900,1.85,.76,.75,'💻','Большой письменный стол для будущих занятий.'),
  product('chair-dining','Стул «Клён»','tables','chair',3900,.47,.54,.87,'🪑','Лёгкий обеденный стул со спинкой.'),
  product('chair-padded','Стул «Мягкий»','tables','chair',6100,.52,.55,.88,'🪑','Стул с тканевой подушкой.'),
  product('stool-basic','Табурет «Пик»','tables','stool',2100,.39,.39,.49,'🪑','Небольшой деревянный табурет.'),
  product('nightstand','Прикроватная тумба «Сон»','tables','nightstand',4900,.44,.40,.52,'🗄️','Маленькая тумба рядом с кроватью.'),
  product('floor-lamp','Торшер «Тёплый свет»','lighting','lamp',7900,.39,.39,1.69,'💡','Напольный светильник с конусным плафоном.'),
  product('lamp-sphere','Светильник «Шар»','lighting','lamp',11500,.34,.34,1.48,'💡','Мягкий шарообразный плафон.'),
  product('lamp-tripod','Торшер «Тренога»','lighting','lamp',9300,.48,.48,1.73,'💡','Тонкие деревянные ножки, тканевый абажур.'),
  product('plant-ficus','Фикус в кашпо','decor','plant',2900,.55,.55,1.39,'🪴','Высокий комнатный фикус.'),
  product('plant-monstera','Монстера','decor','plant',4200,.70,.65,1.27,'🪴','Крупные листья и керамический горшок.'),
  product('plant-mini','Небольшой суккулент','decor','plant',1200,.34,.34,.53,'🪴','Миниатюрное растение в напольном кашпо.'),
  product('rug-weave','Ковёр «Плетение»','decor','rug',6700,1.9,1.4,.035,'🧶','Низкий ковёр; по нему можно свободно ходить.',true),
  product('rug-large','Ковёр «Уют»','decor','rug',11900,2.7,2.0,.035,'🧶','Большой мягкий ковёр; не блокирует перемещение.',true),
  product('mirror-arch','Напольное зеркало «Арка»','decor','mirror',7900,.65,.23,1.83,'🪞','Зеркало в тонкой высокой раме.'),
  product('mirror-wide','Зеркало «Свет»','decor','mirror',11500,.95,.24,1.73,'🪞','Широкое вертикальное зеркало.'),
] as const;
export const FURNITURE_BY_ID = new Map(FURNITURE_CATALOG.map(item=>[item.id,item]));
export const FURNITURE_DELIVERY = {
  regular:{fee:390,minutes:45,label:'Обычная'},
  express:{fee:990,minutes:15,label:'Быстрая'},
} as const;
export type FurnitureShipping = keyof typeof FURNITURE_DELIVERY;
export type FurnishingCommand =
  | { type:'furniture_order'; sku:string; finish:FurnitureFinish; shipping:FurnitureShipping; quantity:number }
  | { type:'furniture_unbox'; id:number }
  | { type:'furniture_place'; id:number; x:number; z:number; rotation:Rotation }
  | { type:'furniture_move'; id:number; x:number; z:number; rotation:Rotation }
  | { type:'furniture_store'; id:number }
  | { type:'furniture_sell'; id:number };
export interface FurnitureInstance { id:number; sku:string; finish:FurnitureFinish }
export interface PlacedFurniture extends FurnitureInstance {
  x:number;z:number;rotation:Rotation;
}
export interface FurnitureOrder extends FurnitureInstance {
  readyAt:number; shipping:FurnitureShipping;
}
export interface FurnishingState {
  nextId:number;
  orders:FurnitureOrder[];
  stored:FurnitureInstance[];
  placed:PlacedFurniture[];
}
export const emptyFurnishing = ():FurnishingState => ({nextId:1,orders:[],stored:[],placed:[]});
export function furnitureFootprint(item:PlacedFurniture,clearance=0):FloorRect {
  const info=FURNITURE_BY_ID.get(item.sku)!;
  const rotated=item.rotation%2===1;
  const w=(rotated?info.depth:info.width)/2+clearance;
  const d=(rotated?info.width:info.depth)/2+clearance;
  return {minX:item.x-w,maxX:item.x+w,minZ:item.z-d,maxZ:item.z+d};
}
export function furnishingObstacles(state:Pick<FurnishingState,'placed'>):FloorRect[] {
  return state.placed.filter(item=>!FURNITURE_BY_ID.get(item.sku)?.walkable)
    .map(item=>furnitureFootprint(item,.30));
}
export function isValidFurnishing(raw:unknown):raw is FurnishingState {
  if(!raw||typeof raw!=='object')return false;
  const state=raw as Partial<FurnishingState>;
  if(!Number.isSafeInteger(state.nextId)||state.nextId!<1||state.nextId!>1000000||
     !Array.isArray(state.orders)||!Array.isArray(state.stored)||!Array.isArray(state.placed)||
     state.orders.length+state.stored.length+state.placed.length>10000)return false;
  const all=[...state.orders,...state.stored,...state.placed];
  const ids=new Set<number>();
  return all.every(item=>{
    if(!item||!Number.isSafeInteger(item.id)||item.id<1||item.id>=state.nextId!||
      ids.has(item.id)||!FURNITURE_BY_ID.has(item.sku)||
      !Object.hasOwn(FURNITURE_FINISHES,item.finish))return false;
    ids.add(item.id);
    if('readyAt'in item){
      const order=item as FurnitureOrder;
      return Number.isSafeInteger(order.readyAt)&&order.readyAt>=0&&
        (order.shipping==='regular'||order.shipping==='express');
    }
    if('x'in item){
      const placed=item as PlacedFurniture;
      return Number.isFinite(placed.x)&&Math.abs(placed.x)<=100&&
        Number.isFinite(placed.z)&&Math.abs(placed.z)<=100&&
        [0,1,2,3].includes(placed.rotation);
    }
    return true;
  });
}
