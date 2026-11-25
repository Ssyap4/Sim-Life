import type {SpeakerMount} from './speakerPlacement';
import {SPEAKER_MODELS} from './speakerCatalog';
import {CONSOLES,isSurfaceDevice} from './consoleCatalog';
import {VACUUM_MODELS} from './vacuumCatalog';
import {FEEDING_MODELS} from './petFeeders';
import type { FloorRect } from '../game/navigation';

export type FurnitureCategory = 'seating' | 'sleep' | 'storage' | 'tables' | 'lighting' | 'decor' | 'pets' | 'leisure';
export type FurnitureStyle = 'scandi' | 'cozy' | 'industrial' | 'classic' | 'designer';
export type FurnitureShape = 'sofa' | 'corner' | 'armchair' | 'ottoman' | 'bench' |
  'bed' | 'daybed' | 'wardrobe' | 'dresser' | 'shelves' | 'sideboard' |
  'table' | 'desk' | 'chair' | 'stool' | 'nightstand' | 'lamp' | 'plant' | 'rug' | 'mirror' | 'leisure';
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
  tables:'Столы и стулья',lighting:'Освещение',decor:'Декор и растения',pets:'Для животных',leisure:'Досуг и отдых',
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
export const FURNITURE_STYLES:Record<FurnitureStyle,string> = {
  scandi:'Сканди и минимализм',
  cozy:'Мягкий и уютный',
  industrial:'Лофт и металл',
  classic:'Классика и винтаж',
  designer:'Современный дизайнерский',
};
const STYLE_SKUS:Record<Exclude<FurnitureStyle,'scandi'>,ReadonlySet<string>> = {
  cozy:new Set(['sofa-nord','sofa-arc','sofa-micro','chair-cloud','pouf-joy','bench-mori',
    'bed-day','bed-storage','sideboard','table-family','chair-padded','table-haven','chair-mellow','chair-lounge','stool-petal',
    'lamp-sphere','lamp-tripod','rug-weave','rug-large','plant-ficus','plant-monstera']),
  industrial:new Set(['sofa-modular','daybed-iron','dresser-industrial','shelf-asym',
    'table-industrial','table-glass','table-forge','table-aura','chair-frame','desk-large','desk-loft','desk-gamer','chair-industrial','lamp-industrial']),
  classic:new Set(['sofa-chester','chair-wing','bed-aurora','bed-rattan',
    'wardrobe-vintage','wardrobe-wide','dresser-rattan','sideboard-glass',
    'chair-bistro','chair-windsor','lamp-paper','mirror-window']),
  designer:new Set(['sofa-futon','chair-nest','chair-wicker','pouf-drum',
    'bed-canopy','bed-platform','wardrobe-sliding','shelf-ladder',
    'table-oval','table-coffee','table-silk','table-grand','table-nest','chair-mono','chair-velour','desk-corner','desk-hutch','desk-creator','desk-studio','desk-angle',
    'stool-round','lamp-arc','lamp-double','plant-palm','rug-round','mirror-round']),
};
export function furnitureStyle(sku:string):FurnitureStyle {
  for(const [style,skus] of Object.entries(STYLE_SKUS) as [FurnitureStyle,ReadonlySet<string>][])
    if(skus.has(sku))return style;
  return 'scandi';
}
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
  product('sideboard','Тумба «Тихий дом»','storage','sideboard',13400,1.37,.46,1.00,'🗄️','Закрытые дверцы и открытые полки для хранения.'),

  product("table-duet","Стол «Дуэт»","tables","table",7900,0.9,0.9,0.75,"🍽️","Круглый стол для двоих на центральной опоре."),
  product("table-bento","Стол «Бенто»","tables","table",10900,1.02,1.02,0.76,"🍽️","Квадратный стол с закруглёнными углами и деревянными ножками."),
  product("table-haven","Стол «Хейвен»","tables","table",15900,1.65,0.9,0.76,"🍽️","Семейный прямоугольный стол с лёгкими опорами."),
  product("table-silk","Стол «Силк»","tables","table",21900,1.78,0.96,0.76,"🍽️","Овальный стол на двух скульптурных опорах."),
  product("table-aura","Стол «Аура»","tables","table",27900,1.65,0.94,0.77,"🍽️","Стеклянная столешница и металлическая рама."),
  product("table-forge","Стол «Фордж»","tables","table",23900,1.92,0.98,0.77,"🍽️","Массив дерева на чёрных трапециевидных опорах."),
  product("table-grand","Стол «Гранд»","tables","table",38900,2.24,1.12,0.78,"🍽️","Большой дизайнерский стол с ребристыми пьедесталами."),
  product("table-pebble","Журнальный стол «Галька»","tables","table",4900,0.91,0.68,0.43,"☕","Низкий столик с округлой столешницей."),
  product("table-nest","Журнальные столики «Дуо»","tables","table",8900,1.3,0.79,0.48,"☕","Два столика разной высоты в одном комплекте."),
  product("chair-lino","Стул «Лино»","tables","chair",3200,0.47,0.53,0.86,"🪑","Лёгкий кухонный стул с деревянной спинкой."),
  product("chair-mellow","Стул «Меллоу»","tables","chair",5900,0.52,0.56,0.9,"🪑","Мягкое сиденье и широкая спинка."),
  product("chair-mono","Стул «Моно»","tables","chair",6900,0.49,0.55,0.88,"🪑","Цельная округлая спинка, минималистичный силуэт."),
  product("chair-windsor","Стул «Виндзор»","tables","chair",7900,0.51,0.57,0.96,"🪑","Классическая деревянная спинка с вертикальными рейками."),
  product("chair-frame","Стул «Фрейм»","tables","chair",6500,0.5,0.56,0.88,"🪑","Металлическая рама и деревянное сиденье."),
  product("chair-lounge","Стул «Лаунж»","tables","chair",10900,0.57,0.6,0.96,"🪑","Высокая мягкая спинка и глубокое сиденье."),
  product("chair-velour","Стул «Велюр»","tables","chair",15900,0.6,0.63,1,"🪑","Премиальное мягкое кресло-стул с обивкой и тонкими опорами."),
  product("stool-cube","Табурет «Кубик»","tables","stool",2100,0.39,0.39,0.49,"🪑","Компактный табурет с четырьмя ножками."),
  product("stool-petal","Табурет «Лепесток»","tables","stool",3900,0.44,0.44,0.49,"🪑","Круглое мягкое сиденье на трёх опорах."),
  product("desk-neo","Ноутбучный стол «Нео»","tables","desk",8900,1.18,1.32,0.96,"💻","Компактный светлый стол на тонких ножках, стул в комплекте."),
  product("desk-air","Ноутбучный стол «Эйр»","tables","desk",13900,1.42,1.3,0.96,"💻","Минималистичный стол с открытой нишей и лёгким креслом."),
  product("desk-office","Рабочий стол «Офис»","tables","desk",15900,1.65,1.32,0.96,"💻","Стол с тумбой и удобным офисным стулом."),
  product("desk-loft","Рабочий стол «Лофт»","tables","desk",19900,1.85,1.38,0.98,"💻","Широкая деревянная поверхность на металлических рамах."),
  product("desk-gamer","Игровой стол «Арена»","tables","desk",25900,1.92,1.4,1.1,"💻","Графитовая столешница, кабельный канал и спортивное кресло."),
  product("desk-creator","Рабочая станция «Креатор»","tables","desk",32900,2.05,1.42,1.04,"💻","Широкий стол с двумя боковыми секциями и рабочим креслом."),
  product("desk-studio","Рабочий стол «Студио»","tables","desk",42900,2.15,1.45,1.08,"💻","Дизайнерский стол с округлыми опорами, ящиками и креслом."),
  product("desk-angle","Угловая станция «Контур»","tables","desk",37900,2.18,1.58,1.02,"💻","Г-образное рабочее место с правым крылом и креслом."),

  product('nightstand','Прикроватная тумба «Сон»','storage','nightstand',4900,.44,.40,.52,'🗄️','Маленькая тумба рядом с кроватью.'),
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
  // Additional design families. Every SKU has a distinct lightweight 3D construction.
  product('sofa-chester','Диван «Вельвет»','seating','sofa',52900,2.43,.99,.91,'🛋️','Винтажный диван с закруглёнными подлокотниками и пуговицами.'),
  product('sofa-modular','Диван «Модуль»','seating','corner',64900,3.08,1.71,.78,'🛋️','Современный угловой диван из крупных низких модулей.'),
  product('sofa-futon','Диван «Футон»','seating','sofa',23900,2.12,.91,.73,'🛋️','Низкий диван с открытой деревянной рамой.'),
  product('chair-wicker','Кресло «Ротанг»','seating','armchair',16900,.91,.85,.97,'🪑','Плетёное кресло с воздушной спинкой и подушкой.'),
  product('chair-wing','Кресло «Крыло»','seating','armchair',25900,1.04,1.01,1.25,'🪑','Высокая спинка с боковыми крыльями для чтения.'),
  product('pouf-drum','Пуф «Барабан»','seating','ottoman',5900,.66,.66,.44,'🟠','Круглый цилиндрический пуф с вертикальной прострочкой.'),
  product('bed-canopy','Кровать «Балдахин»','sleep','bed',67900,1.89,2.17,2.10,'🛏️','Четыре высокие стойки и лёгкая рама над кроватью.'),
  product('bed-platform','Кровать «Парящая»','sleep','bed',47900,1.81,2.14,.64,'🛏️','Низкая широкая платформа со скрытой опорой.'),
  product('bed-rattan','Кровать «Эко»','sleep','bed',39900,1.66,2.11,1.04,'🛏️','Плетёное закруглённое изголовье и деревянная рама.'),
  product('daybed-iron','Кушетка «Лофт»','sleep','daybed',22500,1.98,.96,.92,'🛏️','Металлическая кушетка с решётчатой боковой спинкой.'),
  product('bed-storage','Кровать «Секрет»','sleep','bed',51500,1.77,2.13,.89,'🛏️','Кровать-подиум с выдвижными ящиками в основании.'),
  product('wardrobe-sliding','Шкаф «Слайд»','storage','wardrobe',42900,2.12,.65,2.30,'🚪','Крупные раздвижные панели на направляющих.'),
  product('wardrobe-vintage','Шкаф «Прованс»','storage','wardrobe',34500,1.72,.64,2.13,'🚪','Классический шкаф с карнизом и фигурными фасадами.'),
  product('dresser-industrial','Комод «Сталь»','storage','dresser',21500,1.26,.50,.89,'🗄️','Графичные металлические стойки и открытые полки.'),
  product('dresser-rattan','Комод «Канва»','storage','dresser',17900,1.06,.49,.94,'🗄️','Комод с плетёными вставками на фасадах.'),
  product('shelf-ladder','Стеллаж «Лестница»','storage','shelves',11900,.92,.46,1.92,'📚','Открытый стеллаж с сужающимися кверху полками.'),
  product('shelf-asym','Стеллаж «Геометрия»','storage','shelves',18900,1.62,.41,1.86,'📚','Асимметричная модульная сетка открытых ниш.'),
  product('sideboard-glass','Витрина «Стекло»','storage','sideboard',33500,1.29,.49,1.45,'🗄️','Витрина со стеклянными дверцами и полками.'),

  product('lamp-arc','Торшер «Дуга»','lighting','lamp',13900,1.06,.51,1.91,'💡','Изогнутая стойка с большим нависающим абажуром.'),
  product('lamp-industrial','Торшер «Завод»','lighting','lamp',9100,.45,.45,1.65,'💡','Металлический конусный плафон с направленным светом.'),
  product('lamp-paper','Светильник «Фонарик»','lighting','lamp',7500,.43,.43,1.46,'💡','Высокий светильник с бумажными округлыми секциями.'),
  product('lamp-double','Торшер «Дуэт»','lighting','lamp',12500,.57,.46,1.78,'💡','Два абажура на разной высоте одной стойки.'),
  product('plant-palm','Пальма в кашпо','decor','plant',6300,.91,.83,1.77,'🪴','Высокая пальма с длинными веерными листьями.'),
  product('plant-cactus','Кактус «Пустыня»','decor','plant',2300,.49,.49,.91,'🌵','Разветвлённый кактус с округлыми боковыми побегами.'),
  product('plant-rubber','Фикус каучуконосный','decor','plant',4700,.64,.60,1.51,'🪴','Выразительные крупные плотные листья вдоль ствола.'),
  product('rug-round','Ковёр «Солнце»','decor','rug',6900,1.64,1.64,.035,'🧶','Круглый ковёр с концентрическими полосами.',true),
  product('mirror-round','Зеркало «Луна»','decor','mirror',8500,1.05,.19,1.29,'🪞','Круглое зеркало на лаконичной напольной стойке.'),
  product('mirror-window','Зеркало «Окно»','decor','mirror',14500,1.01,.24,1.92,'🪞','Арочное зеркало с металлическими перемычками.'),
  product('leisure-board','Набор настольных игр со столиком','leisure','leisure',1200,1.16,1.80,1.09,'🎲','Игровой столик с двумя сиденьями, кубиками и фишками.'),
  product('leisure-darts','Напольный дартс','leisure','leisure',2500,.85,.55,1.83,'🎯','Мишень на устойчивой стойке. Оставь свободное место для бросков.'),
  product('leisure-chess','Шахматный столик','leisure','leisure',3500,1.16,1.80,1.09,'♟️','Шахматная доска и два места напротив друг друга.'),
  product('oasis-pool','Бассейн «Лагуна дома»','leisure','leisure',89500,6.5,4.7,1.55,'🏊','Просторный бассейн 6 × 3,5 м, настил, ступени и две надувные лежанки. Только для двора.'),
  product('oasis-terrace','Терраса «Оазис»','leisure','leisure',32900,3.20,2.0,2.20,'🌿','Деревянная площадка с диванчиком на двоих, мягкими подушками и перголой. Только для двора.'),
  product('leisure-hammock','Гамак на стойке','leisure','leisure',5900,2.60,1.08,1.30,'🌴','Тканевый гамак для спокойного отдыха во дворе.'),
  product('leisure-swing','Садовые качели','leisure','leisure',18900,2.35,1.38,2.10,'🌿','Двухместное подвесное сиденье под навесом.'),
  product('leisure-tennis','Стол для настольного тенниса','leisure','leisure',24900,1.55,2.40,.95,'🏓','Стол, сетка, ракетки и место для игры с двух сторон.'),
  product('leisure-billiards','Бильярдный стол','leisure','leisure',69900,1.47,2.42,.92,'🎱','Зелёное сукно, лузы, шары и кии.'),
  // Real pet accessories use the existing buy/delivery/placement/move/sell pipeline.
  // Low washable cushions are walkable (no fake invisible collision walls).
  ...FEEDING_MODELS.map(m=>product(m.id,m.name,'pets','plant',m.price,m.width,m.depth,m.height,'🥣',m.capacity?'Автоматически выдаёт корм из бункера на '+m.capacity+' насыпаний. Только сухой корм.':'Сменная миска для кормления. Новая модель заменяет штатную миску; запас еды сохраняется.')),
  product('pet-bed-stairs','Мягкая лесенка для Верделла','pets','plant',3490,.66,1.02,.76,'🐾','Четыре мягкие ступеньки. Поставь высоким краем к кровати, оставив проход снизу. Верделл сможет забраться спать рядом.'),
  product("pet-bed-dog-nest","Лежанка «Бублик» для собак","pets","rug",2490,1.08,0.94,0.15,"🐕","Круглый мягкий валик и низкая подушка.",true),
  product("pet-bed-dog-sofa","Лежанка «Софа» для собак","pets","rug",4990,1.24,1,0.15,"🐕","Прямоугольный матрас с мягкой спинкой.",true),
  product("pet-bed-cat-donut","Лежанка «Пончик» для кошек","pets","rug",2190,1.02,0.9,0.15,"🐈","Круглая плюшевая лежанка.",true),
  product("pet-bed-cat-shell","Лежанка «Ракушка» для кошек","pets","rug",4490,1.14,0.96,0.15,"🐈","Овальный матрас с фигурной спинкой.",true),
  product("pet-scratcher-palm","Когтеточка «Пальма»","pets","plant",2290,0.66,0.66,0.88,"🐾","Столбик с сизалем и подвесным шариком."),
  product("pet-scratcher-duet","Когтеточка «Дуэт»","pets","plant",5490,0.88,0.76,1.12,"🐾","Два столбика на устойчивом основании."),
  product("pet-house-igloo","Домик «Иглу»","pets","plant",3990,1.16,1.04,0.8,"🐈","Мягкое укрытие с открытым входом и площадкой."),
  product("pet-house-loft","Домик «Лофт»","pets","plant",6990,1.22,1.12,0.92,"🐈","Деревянный домик с матрасом и верхней площадкой."),
  product("pet-house-sky","Комплекс «Небоскрёб»","pets","plant",15900,1.92,1.18,1.34,"🐾","Два уровня отдыха и отдельный сизалевый столбик."),
] as const;
// Keep the old models for already-owned furniture, but no new decorative purchases.
export const PURCHASABLE_FURNITURE=FURNITURE_CATALOG.filter(item=>item.category!=='decor');
export const RETIRED_PET_PRODUCTS:readonly FurnitureProduct[]=[
  product('pet-bed-verdell','Лежанка Верделла «Облачко»','pets','rug',4900,1.08,.94,.15,'🐕','Уютная низкая лежанка с мягкими бортиками; Верделл может на ней спать.',true),
  product('pet-bed-simba','Лежанка Симбы «Полумесяц»','pets','rug',4500,1.14,.90,.15,'🐈','Мягкая лежанка для кота; Симба выбирает её для отдыха.',true),
  product('pet-scratcher-simba','Когтеточка «Рыжий инспектор»','pets','plant',6900,.78,.72,1.12,'🐾','Устойчивая когтеточка со столбиком и подвесной игрушкой.'),
  product('pet-house-cabin','Домик «Лисья нора»','pets','plant',5900,1.15,1.05,.84,'🐈','Деревянное укрытие с открытым входом, мягким матрасом и площадкой на крыше.'),
  product('pet-house-soft','Домик «Плюшевый кокон»','pets','plant',8900,1.22,1.12,.92,'🐈','Мягкая капсула с просторным входом и утопленной лежанкой сверху.'),
  product('pet-house-tower','Комплекс «Король Симба»','pets','plant',14900,1.92,1.18,1.34,'🐾','Домик, отдельная сизалевая когтеточка, игрушка и широкая верхняя лежанка.'),
  product('pet-house-starter','Первый домик Симбы','pets','plant',2400,1.16,1.04,.75,'🐈','Старый домик.'),
  product('pet-scratcher-starter','Первая когтеточка Симбы','pets','plant',1100,.62,.62,.82,'🐾','Старый столбик.'),
];
export const STARTER_CAT_HOUSE='pet-house-nook';
export const STARTER_CAT_SCRATCHER='pet-scratcher-mini';
export const STARTER_PET_PRODUCTS:readonly FurnitureProduct[]=[
  product(STARTER_CAT_HOUSE,'Домик «Уголок»','pets','plant',2400,1.16,1.04,.75,'🐈','Невысокий тканевый домик с мягкой крышей для сна.'),
  product(STARTER_CAT_SCRATCHER,'Когтеточка «Мини»','pets','plant',1100,.62,.62,.82,'🐾','Простой столбик из сизаля на круглой подставке.'),
];
export const RETIRED_DESKS:readonly FurnitureProduct[]=[
  product('desk-simple','Письменный стол «Лайн»','tables','desk',14300,1.35,.64,.75,'💻','Рабочая поверхность с удобной полкой.'),
  product('desk-large','Стол «Проект»','tables','desk',28900,1.85,.76,.75,'💻','Большой письменный стол для будущих занятий.'),
  product('desk-corner','Угловой стол «Поворот»','tables','desk',27900,1.72,1.29,.76,'💻','Г-образный компьютерный стол с широким крылом.'),
  product('desk-hutch','Стол «Мастерская»','tables','desk',25500,1.48,.69,1.64,'💻','Рабочий стол с высоким настольным органайзером.'),
];
export const isNotebookDesk=(sku:string)=>sku==='desk-neo'||sku==='desk-air';
export const workstationLayout=(sku:string)=>sku.startsWith('desk-')&&!RETIRED_DESKS.some(p=>p.id===sku)?{top:.76,z:-.24,seat:.40,scale:.80}:undefined;
export const RETIRED_DINING:readonly FurnitureProduct[]=[
  product('table-round','Стол «Круг»','tables','table',11500,1.10,1.10,.76,'🍽️','Круглая столешница на устойчивой ножке.'),
  product('table-family','Стол «Семья»','tables','table',18900,1.72,.93,.77,'🍽️','Просторный обеденный стол.'),
  product('table-coffee','Журнальный стол «Лист»','tables','table',6200,.92,.57,.43,'☕','Низкий столик для гостиной.'),
  product('chair-dining','Стул «Клён»','tables','chair',3900,.47,.54,.87,'🪑','Лёгкий обеденный стул со спинкой.'),
  product('chair-padded','Стул «Мягкий»','tables','chair',6100,.52,.55,.88,'🪑','Стул с тканевой подушкой.'),
  product('stool-basic','Табурет «Пик»','tables','stool',2100,.39,.39,.49,'🪑','Небольшой деревянный табурет.'),
  product('table-oval','Стол «Овал»','tables','table',22900,1.84,.94,.76,'🍽️','Овальная столешница на двух широких опорах.'),
  product('table-industrial','Стол «Фабрика»','tables','table',19900,1.78,.87,.78,'🍽️','Деревянный верх на чёрных стальных козлах.'),
  product('table-glass','Стол «Кристалл»','tables','table',29500,1.55,.86,.76,'🍽️','Стеклянная столешница и перекрещенные опоры.'),
  product('chair-industrial','Стул «Металл»','tables','chair',5900,.52,.54,.89,'🪑','Лаконичный стальной стул с тонкой спинкой.'),
  product('chair-bistro','Стул «Бистро»','tables','chair',7400,.49,.55,.91,'🪑','Классический стул с круглой плетёной спинкой.'),
  product('stool-round','Табурет «Кафе»','tables','stool',3600,.43,.43,.60,'🪑','Круглый высокий табурет на четырёх ножках.'),
];
export const diningSeatTop=(sku:string)=>["chair-lino","chair-mellow","chair-mono","chair-windsor","chair-frame","chair-lounge","chair-velour","stool-cube","stool-petal"].includes(sku)? .45:undefined;
export const VACUUM_FURNITURE=Object.entries(VACUUM_MODELS).map(([id,m])=>product(id,m.name,'decor','plant',m.price,m.width,m.depth,m.height,'🧹',m.spec));
export const SPEAKER_FURNITURE=Object.entries(SPEAKER_MODELS).map(([id,m])=>product(id,m.name,'decor','plant',m.price,m.width,m.depth,m.height,'🔊',m.assistant));
export const CONSOLE_FURNITURE=Object.entries(CONSOLES).map(([id,m])=>product(id,m.name,'decor','plant',m.price,m.width,m.depth,m.height,'🎮',m.description));
export const FURNITURE_BY_ID = new Map([...CONSOLE_FURNITURE,...SPEAKER_FURNITURE,...VACUUM_FURNITURE,...FURNITURE_CATALOG,...RETIRED_DESKS,...RETIRED_DINING,...RETIRED_PET_PRODUCTS,...STARTER_PET_PRODUCTS].map(item=>[item.id,item]));

// Display order only. Never reorder the persisted catalogue IDs or household data.
// All old and newly introduced products share one intuitive furniture-type grouping.
export type FurnitureDisplayGroup = Exclude<FurnitureShape,'corner'> | 'pet-care';
export const FURNITURE_DISPLAY_GROUPS: readonly FurnitureDisplayGroup[] = [
  'sofa','armchair','ottoman','bench',
  'bed','daybed',
  'wardrobe','dresser','nightstand','sideboard','shelves',
  'table','desk','chair','stool',
  'lamp',
  'leisure','pet-care',
  'plant','rug','mirror',
];
export const FURNITURE_GROUP_LABELS: Record<FurnitureDisplayGroup,string> = {
  sofa:'Диваны и угловые диваны',
  armchair:'Кресла',
  ottoman:'Пуфы',
  bench:'Банкетки',
  bed:'Кровати',
  daybed:'Кушетки',
  wardrobe:'Шкафы и гардеробы',
  dresser:'Комоды',
  nightstand:'Прикроватные тумбы',
  sideboard:'Тумбы и витрины',
  shelves:'Стеллажи',
  table:'Обеденные и журнальные столы',
  desk:'Письменные и компьютерные столы',
  chair:'Стулья',
  stool:'Табуреты',
  lamp:'Светильники и торшеры',
  leisure:'Игры и отдых',
  'pet-care':'Домики, лежанки и когтеточки',
  plant:'Растения',
  rug:'Ковры',
  mirror:'Зеркала',
};
const furnitureGroupRank = new Map(FURNITURE_DISPLAY_GROUPS.map((group,index)=>[group,index]));
export function furnitureDisplayGroup(product:Pick<FurnitureProduct,'shape'> & Partial<Pick<FurnitureProduct,'category'>>):FurnitureDisplayGroup {
  return product.category==='pets'?'pet-care':product.shape==='corner'?'sofa':product.shape;
}
export function compareFurnitureProducts(a:FurnitureProduct,b:FurnitureProduct):number {
  const groupA=furnitureDisplayGroup(a),groupB=furnitureDisplayGroup(b);
  return (furnitureGroupRank.get(groupA)??999)-(furnitureGroupRank.get(groupB)??999) ||
    a.name.localeCompare(b.name,'ru') || a.id.localeCompare(b.id);
}
export const SORTED_FURNITURE_CATALOG:readonly FurnitureProduct[] =
  [...FURNITURE_CATALOG].sort(compareFurnitureProducts);
export function compareFurnitureSkus(skuA:string,skuB:string):number {
  const a=FURNITURE_BY_ID.get(skuA),b=FURNITURE_BY_ID.get(skuB);
  if(a&&b)return compareFurnitureProducts(a,b);
  if(a)return -1;
  if(b)return 1;
  return skuA.localeCompare(skuB);
}
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
  | { type:'furniture_sell'; id:number }
  | { type:'furniture_sell_static'; fixture:StaticFurnitureId };
/** Existing starter furniture, independent from purchased inventory.
 * Only these explicit movable pieces may be sold; built-in cabinets,
 * sanitary fixtures, appliances and structural elements stay permanent. */
export const STATIC_FURNITURE = {
  sofa: {sku:'sofa-nord',label:'Диван в гостиной'},
  bed: {sku:'bed-aurora',label:'Двуспальная кровать'},
  table: {sku:'table-family',label:'Обеденный стол со стульями'},
  officeChair: {sku:'chair-padded',label:'Кресло в кабинете'},
  desk: {sku:'desk-large',label:'Рабочий стол с компьютером'},
  bookcase: {sku:'shelf-wide',label:'Книжный стеллаж'},
  nightstandLeft: {sku:'nightstand',label:'Прикроватная тумба слева'},
  nightstandRight: {sku:'nightstand',label:'Прикроватная тумба справа'},
  rugLiving: {sku:'rug-large',label:'Ковёр в гостиной'},
  rugWork: {sku:'rug-weave',label:'Ковёр в кабинете'},
  rugSleep: {sku:'rug-large',label:'Ковёр в спальне'},
} as const;
export type StaticFurnitureId=keyof typeof STATIC_FURNITURE;
export const STATIC_FURNITURE_IDS=Object.keys(STATIC_FURNITURE) as StaticFurnitureId[];
export const isStaticFurnitureId=(id:unknown):id is StaticFurnitureId=>
  typeof id==='string'&&Object.hasOwn(STATIC_FURNITURE,id);

export interface FurnitureInstance { id:number; sku:string; finish:FurnitureFinish }
export interface PlacedFurniture extends FurnitureInstance {
  x:number;z:number;rotation:Rotation;mount?:SpeakerMount;
}
export interface FurnitureOrder extends FurnitureInstance {
  readyAt:number; shipping:FurnitureShipping;
}
export interface FurnishingState {
  nextId:number;
  orders:FurnitureOrder[];
  stored:FurnitureInstance[];
  placed:PlacedFurniture[];
  /** Permanent tombstones for sold starter models, synced across both players. */
  soldFixtures?:StaticFurnitureId[];
  starterPetsGranted?:true;
}
export const emptyFurnishing = ():FurnishingState => ({nextId:1,orders:[],stored:[],placed:[],soldFixtures:[]});
export function furnitureFootprint(item:PlacedFurniture,clearance=0):FloorRect {
  const info=FURNITURE_BY_ID.get(item.sku)!;
  const rotated=item.rotation%2===1;
  const w=(rotated?info.depth:info.width)/2+clearance;
  const d=(rotated?info.width:info.depth)/2+clearance;
  return {minX:item.x-w,maxX:item.x+w,minZ:item.z-d,maxZ:item.z+d};
}
export function furnishingObstacles(state:Pick<FurnishingState,'placed'>):FloorRect[] {
  return state.placed.filter(item=>!isSurfaceDevice(item.sku)&&!FURNITURE_BY_ID.get(item.sku)?.walkable)
    .map(item=>furnitureFootprint(item,.30));
}
export function isValidFurnishing(raw:unknown):raw is FurnishingState {
  if(!raw||typeof raw!=='object')return false;
  const state=raw as Partial<FurnishingState>;
  if(!Number.isSafeInteger(state.nextId)||state.nextId!<1||state.nextId!>1000000||
     !Array.isArray(state.orders)||!Array.isArray(state.stored)||!Array.isArray(state.placed)||
     state.orders.length+state.stored.length+state.placed.length>10000)return false;
  if(state.soldFixtures!==undefined && (!Array.isArray(state.soldFixtures)||
     state.soldFixtures.length>STATIC_FURNITURE_IDS.length||
     new Set(state.soldFixtures).size!==state.soldFixtures.length||
     !state.soldFixtures.every(isStaticFurnitureId)))return false;
  if(state.starterPetsGranted!==undefined&&state.starterPetsGranted!==true)return false;
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
        [0,1,2,3].includes(placed.rotation)&&(!placed.mount||(isSurfaceDevice(placed.sku)&&typeof placed.mount.support==='string'&&placed.mount.support.length<80&&Number.isFinite(placed.mount.u)&&Number.isFinite(placed.mount.v)));
    }
    return true;
  });
}
