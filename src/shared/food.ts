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
} as const;
export type IngredientId = keyof typeof GROCERIES;
export type Pantry = Record<IngredientId, number>;
export const GROCERY_CATEGORIES = {
  dairy:'Молочные и яйца', bakery:'Хлеб', meat:'Мясо и колбаса',
  vegetables:'Овощи', pantry:'Крупы и бакалея', fruit:'Фрукты',
} as const;

export const RECIPES = {
  omelette: { name:'Домашний омлет',emoji:'🍳', ingredients:{ eggs:2, milk:1 }, servings:2,hunger:30,mood:5 },
  toast: { name:'Сырные тосты',emoji:'🥪', ingredients:{ bread:2,cheese:1 }, servings:2,hunger:27,mood:4 },
  salad: { name:'Овощной салат',emoji:'🥗', ingredients:{ tomato:2,carrot:1,cucumber:1 }, servings:2,hunger:23,mood:6 },
  porridge: { name:'Молочная каша',emoji:'🥣', ingredients:{ oats:2,milk:1 }, servings:2,hunger:28,mood:4 },
  chickenRice: { name:'Курица с рисом',emoji:'🍲', ingredients:{ chicken:2,rice:2,carrot:1 }, servings:2,hunger:43,mood:8 },
  sandwich: { name:'Сэндвич с овощами',emoji:'🥙', ingredients:{ bread:2,cheese:1,tomato:1 }, servings:2,hunger:26,mood:5 },
  pastaBolognese: { name:'Паста болоньезе',emoji:'🍝', ingredients:{ pasta:2,mince:2,tomato:2,onion:1 }, servings:2,hunger:46,mood:9 },
  friedPotatoes: { name:'Жареная картошка',emoji:'🥔', ingredients:{ potato:4,onion:1,oil:1 }, servings:2,hunger:39,mood:6 },
  chickenSoup: { name:'Домашний куриный суп',emoji:'🍜', ingredients:{ chicken:1,potato:2,carrot:1,onion:1 }, servings:3,hunger:32,mood:6 },
  pancakes: { name:'Блинчики',emoji:'🥞', ingredients:{ flour:2,milk:1,eggs:2,butter:1 }, servings:3,hunger:29,mood:8 },
  buckwheatChicken: { name:'Гречка с курицей',emoji:'🍛', ingredients:{ buckwheat:2,chicken:2,onion:1 }, servings:2,hunger:44,mood:7 },
  beefStew: { name:'Тушёная говядина',emoji:'🥘', ingredients:{ beef:2,potato:3,onion:1,carrot:1 }, servings:3,hunger:48,mood:10 },
  homemadePizza: { name:'Домашняя пицца',emoji:'🍕', ingredients:{ flour:2,cheese:2,sausage:2,tomato:2 }, servings:4,hunger:38,mood:11 },
  fruitSalad: { name:'Фруктовый салат',emoji:'🍎', ingredients:{ apple:2,banana:2,sourCream:1 }, servings:2,hunger:24,mood:8 },
  pastaCheese: { name:'Макароны с сыром',emoji:'🧀', ingredients:{ pasta:2,cheese:2,butter:1 }, servings:2,hunger:41,mood:7 },
  grillChicken: { name:'Куриные шашлычки',emoji:'🍢', ingredients:{ chicken:2,onion:1 }, servings:3,hunger:38,mood:8, appliance:'grill' },
  grillSteak: { name:'Стейки на углях',emoji:'🥩', ingredients:{ beef:2,onion:1,oil:1 }, servings:2,hunger:49,mood:10, appliance:'grill' },
  grillVegetables: { name:'Овощи на решётке',emoji:'🍅', ingredients:{ tomato:2,carrot:2,onion:1,oil:1 }, servings:2,hunger:27,mood:8, appliance:'grill' },
  grillBurgers: { name:'Бургеры с гриля',emoji:'🍔', ingredients:{ mince:2,bread:2,cheese:1,tomato:1 }, servings:2,hunger:44,mood:10, appliance:'grill' },
} as const;
export type RecipeId = keyof typeof RECIPES;
export type CookedMeals = Record<RecipeId, number>;
export function isGrillRecipe(id: RecipeId) {
  const recipe = RECIPES[id];
  return Boolean(recipe && 'appliance' in recipe);
}
export const GRILL_RECIPES = (Object.keys(RECIPES) as RecipeId[]).filter(isGrillRecipe);

export const TAKEOUT = {
  shawarma: { name:'Шаурма',emoji:'🌯',price:650,quantity:1,hunger:38,mood:7 },
  burgerCombo: { name:'Бургер-комбо',emoji:'🍔',price:890,quantity:1,hunger:44,mood:8 },
  pizzaCheese: { name:'Пицца «Маргарита»',emoji:'🍕',price:850,quantity:2,hunger:40,mood:9 },
  pizzaPepperoni: { name:'Пицца «Пепперони»',emoji:'🍕',price:1350,quantity:3,hunger:42,mood:11 },
  pizzaBig: { name:'Большая пицца на компанию',emoji:'🍕',price:2800,quantity:4,hunger:48,mood:12 },
  rollsSmall: { name:'Роллы · 8 шт.',emoji:'🍣',price:850,quantity:1,hunger:36,mood:10 },
  rollsSet: { name:'Сет роллов',emoji:'🍣',price:2200,quantity:3,hunger:42,mood:12 },
  rollsPremium: { name:'Большой сет роллов',emoji:'🍱',price:2990,quantity:4,hunger:44,mood:13 },
} as const;
export type TakeoutId = keyof typeof TAKEOUT;
export type TakeoutStock = Record<TakeoutId, number>;

export const EMPTY_PANTRY = Object.fromEntries(Object.keys(GROCERIES).map(id=>[id,0])) as Pantry;
export const EMPTY_MEALS = Object.fromEntries(Object.keys(RECIPES).map(id=>[id,0])) as CookedMeals;
export const EMPTY_TAKEOUT = Object.fromEntries(Object.keys(TAKEOUT).map(id=>[id,0])) as TakeoutStock;
export function ingredientList(id: RecipeId): Array<[IngredientId, number]> {
  return Object.entries(RECIPES[id].ingredients) as Array<[IngredientId, number]>;
}
export function recipePortionCost(id: RecipeId): number {
  const cost = ingredientList(id).reduce((sum,[ingredient,amount])=>{
    const data=GROCERIES[ingredient];
    return sum+data.price*amount/data.quantity;
  },0);
  return Math.round(cost/RECIPES[id].servings);
}
