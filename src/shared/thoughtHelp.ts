import { RECIPES, ingredientList, isGrillRecipe, type RecipeId } from './food';
import { NEED_INFO, type VitalNeed } from './life';
import { thoughtFor, AUTONOMY_LABELS } from './autonomy';
import { isSleepBed } from './bedSleep';
import type { CharacterId, GameState } from './protocol';

export type MiniLesson={id:string;icon:string;title:string;body:string};
export function thoughtLessons(state:GameState,role:CharacterId):MiniLesson[]{
  const thought=thoughtFor(state,role);
  const mode=state.autonomy[role];
  const general:MiniLesson={
    id:'mode',icon:'🧠',title:'Как работает самостоятельность',
    body:mode==='off'
      ? 'При выключенной самостоятельности потребности продолжают изменяться, персонаж иногда гуляет по дому и может помочь себе только в крайнем случае, когда потребность почти на нуле.'
      :mode==='needs'
      ? 'Режим заботы помогает с потребностями, а между делами может уделять немного внимания питомцам. Твои команды важнее.'
      : 'Полная самостоятельность добавляет досуг и общение, если есть условия. Персонажи не покупают товары и не начинают работу без игрока.',
  };
  const priority:MiniLesson={
    id:'priority',icon:'👆',title:'Твой выбор всегда главнее',
    body:'Ручные команды важнее автоматических. Можно поставить до трёх действий подряд. Для смены режима открой «Потребности» или приложение «Жизнь и привычки».',
  };
  const stock:MiniLesson={
    id:'stock',icon:'🛒',title:'Продукты покупает игрок',
    body:'Доставка и супермаркет пополняют домашние запасы, но самостоятельность не оформляет заказы и не тратит семейные деньги.',
  };
  const generic:MiniLesson[]=[
    {id:'furniture',icon:'🛋️',title:'Каждый предмет — на своём месте',
      body:'Если исходную мебель продали, установи подходящую замену. Персонажи используют только существующие доступные места.'},
    {id:'pets',icon:'🐾',title:'Симба и Верделл',
      body:'Питомцы живут по своим привычкам. Корм в мисках и их потребности проверяются отдельно от потребностей персонажей.'},
    {id:'work',icon:'💼',title:'Работа остаётся под контролем',
      body:'Автономия не отправляет никого на смену и не принимает рабочие решения. Это делает игрок в меню карьеры.'},
  ];
  const need=thought.need;
  const contextual:Partial<Record<VitalNeed,MiniLesson>>={
    hunger:{id:'hunger',icon:'🍳',title:'Голод и домашняя еда',body:(()=>{
      if(Object.values(state.meals).some(n=>n>0)||Object.values(state.takeout).some(n=>n>0))
        return 'Дома уже есть готовые порции: персонаж может их съесть, если они доступны. Без покупки новых продуктов.';
      const recipe=(Object.keys(RECIPES) as RecipeId[]).find(id=>!isGrillRecipe(id)&&
        ingredientList(id).every(([item,count])=>state.pantry[item]>=count));
      return recipe
        ? 'Готовых порций нет, но некоторые блюда можно приготовить из имеющихся ингредиентов. При подходящем режиме персонаж попробует сделать это сам.'
        : 'Для приготовления не хватает продуктов. Самостоятельность не делает заказы: пополни запасы через магазин или доставку.';
    })()},
    energy:{id:'energy',icon:'🛏️',title:'Сон и энергия',
      body:state.furnishing.soldFixtures?.includes('bed')&&!state.furnishing.placed.some(isSleepBed)
        ? 'Исходную кровать продали. Чтобы персонаж мог выспаться, нужно поставить настоящую доступную кровать.'
        : 'Сон восстанавливает энергию. При заботе о потребностях персонаж может выбрать доступную кровать; ручной сон остаётся под твоим контролем.'},
    bladder:{id:'bladder',icon:'🚽',title:'Туалет и гигиена',
      body:'Если очень хочется в туалет, персонаж может сходить самостоятельно. После туалета он автоматически моет руки в отдельной раковине.'},
    hygiene:{id:'hygiene',icon:'🚿',title:'Душ и чистота',
      body:'Душ восполняет гигиену. Выбери его вручную или разреши заботу о потребностях — тогда свободный персонаж сможет принять душ сам.'},
    social:{id:'social',icon:'❤️',title:'Общение в доме',
      body:'Для спонтанного разговора нужны оба персонажа дома, свободные и с полной самостоятельностью. Ручные предложения общения остаются отдельными действиями.'},
    fun:{id:'fun',icon:'🎮',title:'Отдых и развлечения',
      body:'Телевизор, компьютер, книги и питомцы помогают с досугом. В полной автономии персонаж выбирает только доступные занятия и не покупает ничего сам.'},
    comfort:{id:'comfort',icon:'🛋️',title:'Комфорт и обстановка',
      body:'Отдых на диване и некоторые домашние действия помогают с комфортом. Если старый диван продан, понадобится установленная замена.'},
  };
  return [need?contextual[need]!:generic[Math.floor(state.clock.minute/160)%generic.length],
    general,priority,stock].filter((item,index,array)=>array.findIndex(other=>other.id===item.id)===index);
}
export function thoughtStateLabel(state:GameState,role:CharacterId):string{
  const t=thoughtFor(state,role);
  return t.need
    ? `${NEED_INFO[t.need].emoji} ${NEED_INFO[t.need].label}: ${Math.round(state.characters[role][t.need])}%`
    : state.autonomy[role]==='full'?'✨ Можно заняться своими делами':'🌿 Спокойный момент';
}
export function modeShortLabel(state:GameState,role:CharacterId):string{
  return 'Самостоятельность: '+AUTONOMY_LABELS[state.autonomy[role]];
}
