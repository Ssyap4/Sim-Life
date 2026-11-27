export const MEAL_EAT_SECONDS = 32;
// Moscow-region inspired *game balancing* prices in RUB, not live shop quotations.
// Stock counts are usable units: 1 egg, 1 bread slice, 1 carton of milk, etc.
// The catalogue is data-first so many goods reuse the same lightweight 3D models.
export const GROCERIES = {
  eggs:    { name:'Яйца С1 · 10 шт.', emoji:'🥚', price:190, quantity:10, unit:'шт.', category:'dairy' },
  bread:   { name:'Хлеб · 8 ломтиков', emoji:'🍞', price:45, quantity:8, unit:'ломт.', category:'bakery' },
  milk:    { name:'Молоко · 1 л', emoji:'🥛', price:95, quantity:1, unit:'л', category:'dairy' },
  cheese:  { name:'Сыр · 200 г', emoji:'🧀', price:230, quantity:4, unit:'порц.', category:'dairy' },
  tomato:  { name:'Помидоры · 500 г', emoji:'🍅', price:180, quantity:4, unit:'шт.', category:'vegetables' },
  carrot:  { name:'Морковь · 1 кг', emoji:'🥕', price:85, quantity:8, unit:'шт.', category:'vegetables' },
  rice:    { name:'Рис · 900 г', emoji:'🍚', price:140, quantity:9, unit:'порц.', category:'pantry' },
  chicken: { name:'Курица · 1 кг', emoji:'🍗', price:430, quantity:5, unit:'порц.', category:'meat' },
  sausage: { name:'Колбаса · 300 г', emoji:'🥓', price:280, quantity:5, unit:'порц.', category:'meat' },
  mince:   { name:'Фарш · 400 г', emoji:'🥩', price:320, quantity:4, unit:'порц.', category:'meat' },
  beef:    { name:'Говядина · 700 г', emoji:'🥩', price:790, quantity:5, unit:'порц.', category:'meat' },
  potato:  { name:'Картофель · 2 кг', emoji:'🥔', price:140, quantity:12, unit:'шт.', category:'vegetables' },
  onion:   { name:'Лук · 1 кг', emoji:'🧅', price:80, quantity:8, unit:'шт.', category:'vegetables' },
  pasta:   { name:'Макароны · 450 г', emoji:'🍝', price:110, quantity:6, unit:'порц.', category:'pantry' },
  butter:  { name:'Масло сливочное · 180 г', emoji:'🧈', price:250, quantity:8, unit:'порц.', category:'dairy' },
  oil:     { name:'Масло подсолнечное · 1 л', emoji:'🫗', price:170, quantity:12, unit:'порц.', category:'pantry' },
  charcoal: { name:'Древесный уголь для мангала · 2,5 кг', emoji:'⚫', price:390, quantity:5, unit:'закладок', category:'grill' },
  lighterFluid: { name:'Жидкость для розжига · 0,5 л', emoji:'🔥', price:210, quantity:10, unit:'розжигов', category:'grill' },
  flour:   { name:'Мука · 1 кг', emoji:'🌾', price:95, quantity:12, unit:'порц.', category:'pantry' },
  sugar:   { name:'Сахар · 1 кг', emoji:'🍬', price:95, quantity:20, unit:'порц.', category:'pantry' },
  buckwheat:{ name:'Гречка · 900 г', emoji:'🌾', price:150, quantity:9, unit:'порц.', category:'pantry' },
  oats:    { name:'Овсянка · 500 г', emoji:'🥣', price:115, quantity:8, unit:'порц.', category:'pantry' },
  apple:   { name:'Яблоки · 1 кг', emoji:'🍎', price:170, quantity:6, unit:'шт.', category:'fruit' },
  banana:  { name:'Бананы · 1 кг', emoji:'🍌', price:145, quantity:6, unit:'шт.', category:'fruit' },
  cucumber:{ name:'Огурцы · 500 г', emoji:'🥒', price:170, quantity:4, unit:'шт.', category:'vegetables' },
  sourCream:{ name:'Сметана · 300 г', emoji:'🥛', price:135, quantity:4, unit:'порц.', category:'dairy' },
  tea:     { name:'Чай · 25 пакетиков', emoji:'🍵', price:160, quantity:25, unit:'пак.', category:'pantry' },
  coffee:  { name:'Кофе (старые запасы) · 100 г', emoji:'☕', price:390, quantity:20, unit:'порц.', category:'pantry' },
  coffeeNescafeGold: { name:'Nescafé Gold · 15 порций', emoji:'☕', price:480, quantity:15, unit:'порц.', category:'pantry' },
  coffeeEgoiste: { name:'Egoiste · 25 порций', emoji:'☕', price:860, quantity:25, unit:'порц.', category:'pantry' },
  beansJardin: { name:'Jardin Espresso Di Milano · зерно 500 г', emoji:'🫘', price:2200, quantity:30, unit:'порц.', category:'pantry' },
  beansLavazza: { name:'Lavazza Qualità Oro · зерно 500 г', emoji:'🫘', price:2450, quantity:30, unit:'порц.', category:'pantry' },
  beansBushido: { name:'Bushido Red Katana · зерно 500 г', emoji:'🫘', price:2700, quantity:30, unit:'порц.', category:'pantry' },

  // New restaurant recipes use real, recognizable ingredients. Quantities are gameplay portions.
  lasagnaSheets: { name:'Листы для лазаньи · 250 г', emoji:'🍝', price:210, quantity:5, unit:'порц.', category:'pantry' },
  tenderloin: { name:'Говяжья вырезка · 600 г', emoji:'🥩', price:1650, quantity:3, unit:'порц.', category:'meat' },
  linguine: { name:'Лингвини · 500 г', emoji:'🍝', price:180, quantity:6, unit:'порц.', category:'pantry' },
  mushroom: { name:'Шампиньоны · 300 г', emoji:'🍄', price:220, quantity:4, unit:'порц.', category:'vegetables' },
  cream: { name:'Сливки 20% · 500 мл', emoji:'🥛', price:230, quantity:5, unit:'порц.', category:'dairy' },
  garlic: { name:'Чеснок · 3 головки', emoji:'🧄', price:90, quantity:8, unit:'зубч.', category:'vegetables' },
  parmesan: { name:'Пармезан · 150 г', emoji:'🧀', price:450, quantity:5, unit:'порц.', category:'dairy' },
  arborio: { name:'Рис арборио · 500 г', emoji:'🍚', price:320, quantity:5, unit:'порц.', category:'pantry' },
  broth: { name:'Овощной бульон · 500 мл', emoji:'🥣', price:140, quantity:5, unit:'порц.', category:'pantry' },
  salmon: { name:'Филе лосося · 500 г', emoji:'🐟', price:1100, quantity:3, unit:'порц.', category:'fish' },
  lemon: { name:'Лимоны · 2 шт.', emoji:'🍋', price:140, quantity:2, unit:'шт.', category:'fruit' },
  herbs: { name:'Свежий укроп · пучок', emoji:'🌿', price:100, quantity:4, unit:'порц.', category:'vegetables' },
  shrimp: { name:'Очищенные креветки · 400 г', emoji:'🦐', price:650, quantity:4, unit:'порц.', category:'fish' },
  duck: { name:'Утиная грудка · 600 г', emoji:'🦆', price:1000, quantity:3, unit:'порц.', category:'meat' },
  orange: { name:'Апельсины · 1 кг', emoji:'🍊', price:230, quantity:6, unit:'шт.', category:'fruit' },
  honey: { name:'Мёд · 250 г', emoji:'🍯', price:240, quantity:8, unit:'порц.', category:'pantry' },
  peppercorn: { name:'Чёрный перец горошком · 60 г', emoji:'🫙', price:130, quantity:12, unit:'порц.', category:'pantry' },
  gelatin: { name:'Желатин · 20 г', emoji:'🍮', price:110, quantity:8, unit:'порц.', category:'pantry' },
  berries: { name:'Ягодная смесь · 300 г', emoji:'🫐', price:330, quantity:4, unit:'порц.', category:'fruit' },
  vanilla: { name:'Ваниль · 10 г', emoji:'🌼', price:220, quantity:8, unit:'порц.', category:'pantry' },
  lamb: { name:'Каре ягнёнка · 500 г', emoji:'🥩', price:1150, quantity:3, unit:'порц.', category:'meat' },
  rosemary: { name:'Розмарин · 20 г', emoji:'🌿', price:130, quantity:5, unit:'порц.', category:'vegetables' },
  puffPastry: { name:'Слоёное тесто · 500 г', emoji:'🥐', price:200, quantity:3, unit:'порц.', category:'bakery' },
  dijonMustard: { name:'Дижонская горчица · 200 г', emoji:'🫙', price:210, quantity:8, unit:'порц.', category:'pantry' },
  seaBass: { name:'Филе сибаса · 500 г', emoji:'🐟', price:950, quantity:3, unit:'порц.', category:'fish' },
  saffron: { name:'Шафран · 1 г', emoji:'🌸', price:850, quantity:6, unit:'порц.', category:'pantry' },
  marshmallow: { name:'Зефир маршмеллоу · 150 г', emoji:'🍡', price:180, quantity:12, unit:'шт.', category:'pantry' },
  greenTea:{"name":"Зелёный чай · 25 пакетиков","emoji":"🍵","price":220,"quantity":25,"unit":"пак.","category":"drinks"},
  fruitTea:{"name":"Фруктовый чай · 20 пакетиков","emoji":"🍓","price":260,"quantity":20,"unit":"пак.","category":"drinks"},
  cocoa:{"name":"Какао · 10 порций","emoji":"☕","price":290,"quantity":10,"unit":"порц.","category":"drinks"},
  mint:{"name":"Свежая мята · пучок","emoji":"🌿","price":120,"quantity":5,"unit":"порц.","category":"fruit"},
  sparklingWater:{"name":"Газированная вода · 1 л","emoji":"💧","price":85,"quantity":4,"unit":"порц.","category":"drinks"},
  creamCheese:{"name":"Сливочный сыр · 300 г","emoji":"🧀","price":320,"quantity":3,"unit":"порц.","category":"dairy"},
  cookieCrumbs:{"name":"Песочное печенье · 200 г","emoji":"🍪","price":145,"quantity":4,"unit":"порц.","category":"sweets"},
  iceCreamBase:{"name":"Ванильное мороженое · 500 г","emoji":"🍨","price":350,"quantity":5,"unit":"порц.","category":"sweets"},
  darkChocolate: { name:'Тёмный шоколад · 200 г', emoji:'🍫', price:280, quantity:4, unit:'порц.', category:'pantry' },
} as const;
export type IngredientId = keyof typeof GROCERIES;
export type Pantry = Record<IngredientId, number>;
export const GROCERY_CATEGORIES = {
  drinks:'Напитки и чай', sweets:'Сладости и перекусы', dairy:'Молочные и яйца', bakery:'Хлеб', meat:'Мясо и колбаса',
  vegetables:'Овощи', pantry:'Крупы и бакалея', fruit:'Фрукты', fish:'Рыба и морепродукты', grill:'Для мангала',
} as const;

export const RECIPES = {
  omelette: { name:'Домашний омлет',emoji:'🍳', ingredients:{ eggs:2, milk:1 }, servings:2,hunger:65,mood:5 },
  toast: { name:'Сырные тосты',emoji:'🥪', ingredients:{ bread:2,cheese:1 }, servings:2,hunger:60,mood:4 },
  salad: { name:'Овощной салат',emoji:'🥗', ingredients:{ tomato:2,carrot:1,cucumber:1 }, servings:2,hunger:60,mood:6 },
  porridge: { name:'Молочная каша',emoji:'🥣', ingredients:{ oats:2,milk:1 }, servings:2,hunger:65,mood:4 },
  chickenRice: { name:'Курица с рисом',emoji:'🍲', ingredients:{ chicken:2,rice:2,carrot:1 }, servings:2,hunger:70,mood:8 },
  sandwich: { name:'Сэндвич с овощами',emoji:'🥙', ingredients:{ bread:2,cheese:1,tomato:1 }, servings:2,hunger:60,mood:5 },
  pastaBolognese: { name:'Паста болоньезе',emoji:'🍝', ingredients:{ pasta:2,mince:2,tomato:2,onion:1 }, servings:2,hunger:70,mood:9 },
  friedPotatoes: { name:'Жареная картошка',emoji:'🥔', ingredients:{ potato:4,onion:1,oil:1 }, servings:2,hunger:65,mood:6 },
  chickenSoup: { name:'Домашний куриный суп',emoji:'🍜', ingredients:{ chicken:1,potato:2,carrot:1,onion:1 }, servings:3,hunger:65,mood:6 },
  pancakes: { name:'Блинчики',emoji:'🥞', ingredients:{ flour:2,milk:1,eggs:2,butter:1 }, servings:3,hunger:65,mood:8 },
  easterBerryPancakes:{name:'Пасхальные блинчики с ягодами и сливками',emoji:'🥞',ingredients:{flour:2,milk:1,eggs:2,butter:1,berries:2,cream:1},servings:3,hunger:80,mood:18},
  easterHoneyPancakes:{name:'Пасхальные блинчики с мёдом и яблоками',emoji:'🥞',ingredients:{flour:2,milk:1,eggs:2,butter:1,honey:1,apple:2},servings:3,hunger:80,mood:18},
  birthdayCake:{name:'Именинный торт со сливками и ягодами',emoji:'🎂',ingredients:{flour:2,eggs:3,sugar:2,butter:1,cream:2,berries:2},servings:4,hunger:80,mood:20},
  christmasApples:{name:'Рождественские яблоки с мёдом и ягодами',emoji:'🍎',ingredients:{apple:3,honey:1,berries:1,butter:1},servings:3,hunger:65,mood:16},
  buckwheatChicken: { name:'Гречка с курицей',emoji:'🍛', ingredients:{ buckwheat:2,chicken:2,onion:1 }, servings:2,hunger:70,mood:7 },
  beefStew: { name:'Тушёная говядина',emoji:'🥘', ingredients:{ beef:2,potato:3,onion:1,carrot:1 }, servings:3,hunger:70,mood:10 },
  homemadePizza: { name:'Домашняя пицца',emoji:'🍕', ingredients:{ flour:2,cheese:2,sausage:2,tomato:2 }, servings:4,hunger:70,mood:11 },
  fruitSalad: { name:'Фруктовый салат',emoji:'🍎', ingredients:{ apple:2,banana:2,sourCream:1 }, servings:2,hunger:60,mood:8 },
  pastaCheese: { name:'Макароны с сыром',emoji:'🧀', ingredients:{ pasta:2,cheese:2,butter:1 }, servings:2,hunger:65,mood:7 },
  grillChicken: { name:'Куриные шашлычки',emoji:'🍢', ingredients:{ chicken:2,onion:1 }, servings:3,hunger:70,mood:8, appliance:'grill' },
  grillSteak: { name:'Стейки на углях',emoji:'🥩', ingredients:{ beef:2,onion:1,oil:1 }, servings:2,hunger:100,mood:10, appliance:'grill' },
  grillVegetables: { name:'Овощи на решётке',emoji:'🍅', ingredients:{ tomato:2,carrot:2,onion:1,oil:1 }, servings:2,hunger:60,mood:8, appliance:'grill' },
  grillBurgers: { name:'Бургеры с гриля',emoji:'🍔', ingredients:{ mince:2,bread:2,cheese:1,tomato:1 }, servings:2,hunger:70,mood:10, appliance:'grill' },
  lasagna: { name:'Лазанья болоньезе',emoji:'🍝', ingredients:{ lasagnaSheets:2,mince:2,tomato:2,onion:1,cheese:1,milk:1,flour:1,butter:1 }, servings:3,hunger:100,mood:8 },
  mushroomRisotto: { name:'Ризотто с грибами',emoji:'🍄', ingredients:{ arborio:2,mushroom:2,broth:2,parmesan:1,butter:1,onion:1 }, servings:2,hunger:100,mood:8 },
  beefStroganoff: { name:'Бефстроганов с грибами',emoji:'🥘', ingredients:{ beef:2,mushroom:2,sourCream:1,onion:1,butter:1 }, servings:2,hunger:100,mood:8 },
  lakeFriedFish:{name:'Жареная озёрная рыба с картофелем',emoji:'🐟',ingredients:{potato:2,oil:1,onion:1},servings:2,hunger:80,mood:12},
  lakeUkha:{name:'Домашняя уха из улова',emoji:'🍲',ingredients:{potato:2,carrot:1,onion:1,herbs:1},servings:3,hunger:90,mood:15},
  lakeBakedFish:{name:'Запечённая озёрная рыба с овощами',emoji:'🐟',ingredients:{tomato:2,carrot:1,lemon:1,butter:1},servings:2,hunger:100,mood:20},
  salmonLemon: { name:'Запечённый лосось с лимоном',emoji:'🐟', ingredients:{ salmon:2,lemon:1,butter:1,herbs:1 }, servings:2,hunger:100,mood:8 },
  creamyChicken: { name:'Курица в сливочно-грибном соусе',emoji:'🍗', ingredients:{ chicken:2,mushroom:2,cream:2,garlic:1,butter:1 }, servings:2,hunger:100,mood:8 },
  shrimpLinguine: { name:'Лингвини с креветками',emoji:'🍤', ingredients:{ linguine:2,shrimp:2,garlic:2,tomato:1,lemon:1,oil:1 }, servings:2,hunger:100,mood:8 },
  duckOrange: { name:'Утиная грудка с апельсином',emoji:'🦆', ingredients:{ duck:2,orange:2,honey:1,butter:1 }, servings:2,hunger:100,mood:8 },
  pepperMedallions: { name:'Медальоны в перечном соусе',emoji:'🥩', ingredients:{ tenderloin:2,cream:2,peppercorn:1,butter:1,potato:2 }, servings:2,hunger:100,mood:8 },
  pannaCotta: { name:'Панна-котта с ягодным соусом',emoji:'🍮', ingredients:{ cream:2,gelatin:1,vanilla:1,sugar:1,berries:2 }, servings:3,hunger:60,mood:8 },
  cremeBrulee: { name:'Крем-брюле с карамельной корочкой',emoji:'🍮', ingredients:{ cream:2,eggs:3,sugar:2,vanilla:1 }, servings:3,hunger:60,mood:8 },
  lambRosemary: { name:'Каре ягнёнка с розмарином',emoji:'🍖', ingredients:{ lamb:2,rosemary:1,garlic:2,butter:1 }, servings:2,hunger:100,mood:8 },
  beefWellington: { name:'Говядина Веллингтон',emoji:'🥩', ingredients:{ tenderloin:3,puffPastry:2,mushroom:2,dijonMustard:1,eggs:1 }, servings:3,hunger:100,mood:8 },
  seaBassRisotto: { name:'Сибас с шафрановым ризотто',emoji:'🐟', ingredients:{ seaBass:2,arborio:2,broth:2,parmesan:1,saffron:1,butter:1 }, servings:2,hunger:100,mood:8 },
  chocolateFondant: { name:'Шоколадный фондан с ягодами',emoji:'🍫', ingredients:{ darkChocolate:2,eggs:2,butter:2,sugar:1,flour:1,berries:1 }, servings:2,hunger:65,mood:8 },
  blackTeaCup:{"name":"Чёрный чай","emoji":"🍵","ingredients":{"tea":1},"servings":1,"hunger":3,"mood":7},
  greenTeaCup:{"name":"Зелёный чай","emoji":"🍵","ingredients":{"greenTea":1},"servings":1,"hunger":3,"mood":8},
  fruitTeaCup:{"name":"Фруктовый чай","emoji":"🍓","ingredients":{"fruitTea":1},"servings":1,"hunger":3,"mood":9},
  lemonHoneyTea:{"name":"Чай с лимоном и мёдом","emoji":"🍋","ingredients":{"tea":1,"lemon":1,"honey":1},"servings":2,"hunger":6,"mood":12},
  hotChocolate:{"name":"Горячий шоколад","emoji":"☕","ingredients":{"milk":1,"darkChocolate":1},"servings":2,"hunger":15,"mood":14},
  marshmallowCocoa:{"name":"Какао с маршмеллоу","emoji":"☕","ingredients":{"milk":1,"cocoa":1,"marshmallow":2},"servings":2,"hunger":14,"mood":15},
  bananaShake:{"name":"Банановый молочный коктейль","emoji":"🥛","ingredients":{"milk":1,"banana":2,"iceCreamBase":1},"servings":2,"hunger":22,"mood":12},
  berrySmoothie:{"name":"Ягодный смузи","emoji":"🫐","ingredients":{"berries":2,"banana":1,"milk":1},"servings":2,"hunger":20,"mood":13},
  orangeJuice:{"name":"Свежевыжатый апельсиновый сок","emoji":"🍊","ingredients":{"orange":2},"servings":2,"hunger":10,"mood":9},
  mintLemonade:{"name":"Домашний лимонад с мятой","emoji":"🍋","ingredients":{"lemon":1,"mint":1,"sparklingWater":2,"sugar":1},"servings":2,"hunger":5,"mood":12},
  appleCharlotte:{"name":"Яблочная шарлотка","emoji":"🍰","ingredients":{"apple":3,"flour":2,"eggs":2,"sugar":1,"butter":1},"servings":4,"hunger":28,"mood":12},
  brownie:{"name":"Шоколадный брауни","emoji":"🍫","ingredients":{"darkChocolate":2,"butter":2,"eggs":2,"sugar":1,"flour":1},"servings":4,"hunger":26,"mood":13},
  berryCheesecake:{"name":"Ягодный чизкейк","emoji":"🍰","ingredients":{"creamCheese":2,"cookieCrumbs":2,"butter":1,"berries":1,"sugar":1},"servings":4,"hunger":27,"mood":15},
  butterCroissant:{"name":"Слоёные круассаны","emoji":"🥐","ingredients":{"puffPastry":2,"butter":1,"eggs":1},"servings":4,"hunger":24,"mood":12},
} as const;
export type RecipeId = keyof typeof RECIPES;
export type CookedMeals = Record<RecipeId, number>;
export function isGrillRecipe(id: RecipeId) {
  const recipe = RECIPES[id];
  return Boolean(recipe && 'appliance' in recipe);
}
export const GRILL_RECIPES = (Object.keys(RECIPES) as RecipeId[]).filter(isGrillRecipe);
/** Every ignition uses one coal charge and one lighter-fluid portion.
 * The same rule applies automatically to all current and future grill recipes. */
export const GRILL_FUEL_PER_SESSION = { charcoal:1, lighterFluid:1 } as const;

export const TAKEOUT = {
  shawarma: { name:'Шаурма',emoji:'🌯',price:650,quantity:1,hunger:65,mood:7 },
  burgerCombo: { name:'Бургер-комбо',emoji:'🍔',price:890,quantity:1,hunger:70,mood:8 },
  pizzaCheese: { name:'Пицца «Маргарита»',emoji:'🍕',price:850,quantity:2,hunger:65,mood:9 },
  pizzaPepperoni: { name:'Пицца «Пепперони»',emoji:'🍕',price:1350,quantity:3,hunger:70,mood:11 },
  pizzaBig: { name:'Большая пицца на компанию',emoji:'🍕',price:2800,quantity:4,hunger:100,mood:12 },
  rollsSmall: { name:'Роллы · 8 шт.',emoji:'🍣',price:850,quantity:1,hunger:65,mood:10 },
  rollsSet: { name:'Сет роллов',emoji:'🍣',price:2200,quantity:3,hunger:100,mood:12 },
  rollsPremium: { name:'Большой сет роллов',emoji:'🍱',price:2990,quantity:4,hunger:100,mood:13 },
  milkChocolate:{"name":"Молочный шоколад","emoji":"🍫","price":145,"quantity":2,"hunger":12,"mood":9},
  assortedCandy:{"name":"Шоколадные конфеты","emoji":"🍬","price":290,"quantity":4,"hunger":9,"mood":8},
  oatCookies:{"name":"Овсяное печенье","emoji":"🍪","price":170,"quantity":3,"hunger":15,"mood":8},
  vanillaIceCream:{"name":"Ванильное мороженое","emoji":"🍨","price":160,"quantity":1,"hunger":12,"mood":12},
  berryIceCream:{"name":"Ягодное мороженое","emoji":"🍨","price":190,"quantity":1,"hunger":12,"mood":13},
  saltPopcorn:{"name":"Попкорн","emoji":"🍿","price":160,"quantity":2,"hunger":12,"mood":8},
  crispyChips:{"name":"Картофельные чипсы","emoji":"🥔","price":180,"quantity":2,"hunger":15,"mood":7},
} as const;
export type TakeoutId = keyof typeof TAKEOUT;
export const HOME_DRINK_COLORS:Partial<Record<RecipeId,number>>={"blackTeaCup":10183474,"greenTeaCup":10726752,"fruitTeaCup":11949410,"lemonHoneyTea":12819523,"hotChocolate":6504242,"marshmallowCocoa":9988948,"bananaShake":16048049,"berrySmoothie":13138082,"orangeJuice":15902527,"mintLemonade":14605443};
export const DRINK_SEATS=['sofa','yardTable','officeChair'] as const;
export type DrinkSeat=typeof DRINK_SEATS[number];
export const isDrinkSeat=(x:unknown):x is DrinkSeat=>DRINK_SEATS.includes(x as DrinkSeat);
export const isHomeDrink=(id:unknown):boolean=>typeof id==='string'&&Object.hasOwn(HOME_DRINK_COLORS,id);
export const isShopSnack=(id:unknown):boolean=>typeof id==='string'&&["milkChocolate","assortedCandy","oatCookies","vanillaIceCream","berryIceCream","saltPopcorn","crispyChips"].includes(id);
export const HOME_DESSERTS:readonly RecipeId[]=["appleCharlotte","brownie","berryCheesecake","butterCroissant"];
export type TakeoutStock = Record<TakeoutId, number>;

export const EMPTY_PANTRY = Object.fromEntries(Object.keys(GROCERIES).map(id=>[id,0])) as Pantry;
export const EMPTY_MEALS = Object.fromEntries(Object.keys(RECIPES).map(id=>[id,0])) as CookedMeals;
export const EMPTY_TAKEOUT = Object.fromEntries(Object.keys(TAKEOUT).map(id=>[id,0])) as TakeoutStock;
export function ingredientList(id: RecipeId): Array<[IngredientId, number]> {
  const ingredients=Object.entries(RECIPES[id].ingredients) as Array<[IngredientId, number]>;
  return isGrillRecipe(id) ? [...ingredients,...Object.entries(GRILL_FUEL_PER_SESSION) as Array<[IngredientId,number]>] : ingredients;
}
export function recipePortionCost(id: RecipeId): number {
  const cost = ingredientList(id).reduce((sum,[ingredient,amount])=>{
    const data=GROCERIES[ingredient];
    return sum+data.price*amount/data.quantity;
  },0);
  return Math.round(cost/RECIPES[id].servings);
}
