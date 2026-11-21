import { GROCERIES, type IngredientId, type RecipeId, type TakeoutId } from './food';
import type { Pantry, CookedMeals, TakeoutStock } from './food';
import { READY_FOOD_SLOTS, TABLE_READY_CAPACITY, readyFoodTableUsage, type ReadyFoodBatch } from './readyFood';

export const FRIDGE_CAPACITY = 36;  // simulated food-container slots; upgrade path: furniture later
export const CUPBOARD_CAPACITY = 42; // dry-goods shelf slots
export type StorageArea = 'fridge' | 'cupboard';

export const GROCERY_DETAILS: Record<IngredientId,{area:StorageArea;description:string}> = {
  eggs:{area:'fridge',description:'Десяток яиц для омлета, выпечки и завтраков. Одна коробка занимает одно место в холодильнике.'},
  bread:{area:'cupboard',description:'Свежий нарезной хлеб для тостов и сэндвичей. Хранится на кухонной полке.'},
  milk:{area:'fridge',description:'Литр молока для каш, омлета и блинов. Береги место на полке холодильника.'},
  cheese:{area:'fridge',description:'Полутвёрдый сыр: удобно для тостов, пасты и домашней пиццы.'},
  tomato:{area:'fridge',description:'Сочные томаты для салатов, соуса и пиццы.'},
  carrot:{area:'fridge',description:'Морковь для супов и овощных блюд; одна упаковка расходуется порциями.'},
  rice:{area:'cupboard',description:'Универсальная крупа для гарниров к курице и овощам.'},
  chicken:{area:'fridge',description:'Охлаждённая курица для супа, риса и сытного ужина.'},
  sausage:{area:'fridge',description:'Нарезка для сэндвичей, завтраков и домашней пиццы.'},
  mince:{area:'fridge',description:'Мясной фарш для пасты болоньезе и будущих домашних котлет.'},
  beef:{area:'fridge',description:'Кусок говядины на несколько порций тушёного мяса.'},
  potato:{area:'cupboard',description:'Картошка для гарнира, супа и жарки; хранится в шкафу.'},
  onion:{area:'cupboard',description:'Лук для супа, мяса и ароматной зажарки.'},
  pasta:{area:'cupboard',description:'Макароны для быстрого обеда и пасты с сыром.'},
  butter:{area:'fridge',description:'Сливочное масло для блинов, каши и ароматного гарнира.'},
  oil:{area:'cupboard',description:'Растительное масло для жарки и заправки блюд.'},
  charcoal:{area:'cupboard',description:'Упаковка древесного угля 2,5 кг рассчитана на 5 приготовлений на мангале. Для каждого розжига также нужна жидкость.'},
  lighterFluid:{area:'cupboard',description:'Бутылка 0,5 л рассчитана на 10 розжигов мангала. Один розжиг требует также одну закладку угля.'},
  flour:{area:'cupboard',description:'Мука для блинов и домашней пиццы.'},
  sugar:{area:'cupboard',description:'Сахар для чая и домашней выпечки.'},
  buckwheat:{area:'cupboard',description:'Гречка — недорогой и сытный домашний гарнир.'},
  oats:{area:'cupboard',description:'Овсяные хлопья для завтрака и каши.'},
  apple:{area:'fridge',description:'Яблоки для перекуса и фруктового салата.'},
  banana:{area:'cupboard',description:'Спелые бананы для десерта и быстрого перекуса.'},
  cucumber:{area:'fridge',description:'Хрустящие огурцы для салатов и свежих закусок.'},
  sourCream:{area:'fridge',description:'Сметана для домашних блюд и фруктового салата.'},
  tea:{area:'cupboard',description:'Пакетированный чай для уютного вечера дома.'},
  coffee:{area:'cupboard',description:'Старый запас кофе сохранён после обновления. Подходит для растворимой кофеварки.'},
  coffeeNescafeGold:{area:'cupboard',description:'Растворимый Nescafé Gold. 15 чашек, по одной порции на приготовление.'},
  coffeeEgoiste:{area:'cupboard',description:'Растворимый Egoiste. 25 чашек, по одной порции на приготовление.'},
  beansJardin:{area:'cupboard',description:'Кофе в зёрнах для будущих кофемашин. Сейчас можно купить и хранить, но не сварить.'},
  beansLavazza:{area:'cupboard',description:'Зерновой кофе для будущих кофемашин. Подходит для любых напитков после покупки техники.'},
  beansBushido:{area:'cupboard',description:'Премиальные зёрна для будущих кофемашин. Сейчас напитки из зёрен недоступны.'},
};
export const TAKEOUT_DESCRIPTIONS: Record<TakeoutId,string> = {
  shawarma:'Горячая шаурма с соусом: быстро утоляет голод, но дома готовить дешевле.',
  burgerCombo:'Бургер и гарнир из доставки. Удобно после длинной смены.',
  pizzaCheese:'Сырная пицца на двоих — коробка занимает одно место в холодильнике.',
  pizzaPepperoni:'Пицца с пепперони на троих; дороже домашнего аналога.',
  pizzaBig:'Большая пицца для семейного вечера, четыре сытные порции.',
  rollsSmall:'Небольшая порция роллов на одного человека.',
  rollsSet:'Набор роллов на компанию, три порции в одной упаковке.',
  rollsPremium:'Большой праздничный сет роллов — дорогое удовольствие на четверых.',
};
export const RECIPE_DESCRIPTIONS: Record<RecipeId,string> = {
  omelette:'Обжарь взбитые яйца с молоком: быстрый завтрак на двоих.',
  toast:'Подрумянь хлеб с сыром, чтобы сделать тёплый перекус.',
  salad:'Нарежь овощи и смешай их — свежий лёгкий обед.',
  porridge:'Свари овсянку на молоке: домашний горячий завтрак.',
  chickenRice:'Приготовь курицу и подай с рисом и морковью.',
  sandwich:'Собери свежий сэндвич из хлеба, сыра и томатов.',
  pastaBolognese:'Потуши фарш с овощами и смешай с пастой.',
  friedPotatoes:'Обжарь картофель с луком до золотистой корочки.',
  chickenSoup:'Свари куриный суп: сразу три порции на семью.',
  pancakes:'Замеси тесто и выпеки три домашних блинчика.',
  buckwheatChicken:'Гречка с курицей — сытный обед из доступных продуктов.',
  beefStew:'Медленно туши говядину с картофелем и овощами.',
  homemadePizza:'Замеси основу и запеки пиццу с колбасой, сыром и томатами.',
  fruitSalad:'Смешай свежие фрукты со сметаной — лёгкий десерт.',
  pastaCheese:'Свари макароны и смешай их с маслом и сыром.',
  grillChicken:'Подрумянь курицу с луком на шампурах.',
  grillSteak:'Обжарь говядину на горячей решётке.',
  grillVegetables:'Запеки помидоры, морковь и лук на гриле.',
  grillBurgers:'Поджарь котлеты и собери бургеры с сыром и томатом.',
};
export const HOME_OBJECT_DETAILS = {
  bookcase: 'Выбери произведение и почитай в свободном уютном месте.',
  officeChair: 'Место для отдыха и чтения рядом с книжной полкой.',
  sofa:'Общий диван — место отдыха, чтения, музыки и совместного кино. Помогает восстановить комфорт.',
  bed:'Двуспальная кровать для сна и отдыха. Персонажи могут занимать разные места.',
  desk:'Домашнее рабочее место для учёбы, компьютерных игр, заметок и планирования.',
  kitchen:'Кухня — готовь блюда из реальных семейных запасов. Готовка расходует ингредиенты и занимает место в холодильнике.',
  kettle:'Чайник для приготовления чая. Заваривание требует запасов чая и занимает время.',
  coffeeMaker:'Отдельная кофеварка: растворимый Nescafé Gold или Egoiste. Одна чашка = 1 порция, +10% бодрости, не больше 3 чашек за игровые сутки для каждого.' ,
  tv:'Телевизор для совместных передач, музыки и домашнего досуга.',
  table:'Общий стол для еды. Здесь можно съесть приготовленные порции и доставку.',
  toilet:'Восстанавливает потребность «Нужда».',
  shower:'Восстанавливает гигиену.',
  bathtub:'Дольше душа. Восстанавливает гигиену и комфорт.',
  basin:'Короткое умывание для гигиены.',
  wcBasin:'Компактная раковина для мытья рук.',
  grill:'Для любого блюда на мангале нужны продукты, 1 закладка древесного угля и 1 порция жидкости для розжига. Их можно купить в супермаркете или заказать с доставкой.',
  yardTable:'Здесь подаются готовые блюда с гриля.',
  delivery:'Магазин продуктов, готовых блюд и корма для питомцев. Покупки проверяются общим семейным бюджетом.',
} as const;
export function storageUsage(s:{pantry:Pantry;meals:CookedMeals;takeout:TakeoutStock;readyFood?:ReadyFoodBatch[]}):{fridge:number;cupboard:number} {
  let fridge=0,cupboard=0;
  for(const [id,p] of Object.entries(GROCERIES) as Array<[IngredientId,(typeof GROCERIES)[IngredientId]]>) {
    const count=s.pantry[id];
    const slots=Math.ceil(count/p.quantity);
    if(GROCERY_DETAILS[id].area==='fridge')fridge+=slots;
    else cupboard+=slots;
  }
  // Each prepared or delivered portion uses two cells; food left on the table
  // consumes table space instead. Backfill any pre-update stock without batches.
  const accountedMeals:Record<string,number>={};
  const accountedTakeout:Record<string,number>={};
  for (const batch of s.readyFood??[]) {
    const accounted=batch.kind==='meal'?accountedMeals:accountedTakeout;
    accounted[batch.item]=(accounted[batch.item]??0)+batch.portions;
    if(batch.storage==='fridge') fridge+=batch.portions*READY_FOOD_SLOTS;
  }
  for(const [id,count] of Object.entries(s.meals)) fridge+=Math.max(0,count-(accountedMeals[id]??0))*READY_FOOD_SLOTS;
  for(const [id,count] of Object.entries(s.takeout)) fridge+=Math.max(0,count-(accountedTakeout[id]??0))*READY_FOOD_SLOTS;
  return {fridge,cupboard};
}
export function storageCanFit(before:{pantry:Pantry;meals:CookedMeals;takeout:TakeoutStock;readyFood?:ReadyFoodBatch[]},
  after:{pantry:Pantry;meals:CookedMeals;takeout:TakeoutStock;readyFood?:ReadyFoodBatch[]}):{ok:true}|{ok:false;reason:string} {
  const old=storageUsage(before),next=storageUsage(after);
  if(next.fridge>FRIDGE_CAPACITY && next.fridge>old.fridge)
    return {ok:false,reason:'В холодильнике нет места: '+next.fridge+'/'+FRIDGE_CAPACITY+' ячеек'};
  if(next.cupboard>CUPBOARD_CAPACITY && next.cupboard>old.cupboard)
    return {ok:false,reason:'Кухонные полки заполнены: '+next.cupboard+'/'+CUPBOARD_CAPACITY+' ячеек'};
  const prevTable=readyFoodTableUsage(before),newTable=readyFoodTableUsage(after);
  if(newTable>TABLE_READY_CAPACITY && newTable>prevTable)
    return {ok:false,reason:'На столе недостаточно места для готовой еды: '+newTable+'/'+TABLE_READY_CAPACITY+' порций'};
  return {ok:true};
}
