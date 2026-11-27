import {favoriteFood} from './shared/foodTastes';
import {tasteButton,tasteLabel,type TasteSubmit} from './foodTasteUI';
import {freshFish,isCatchRecipe} from './shared/lake';
import { GROCERIES, RECIPES,isHomeDrink,HOME_DESSERTS, ingredientList, isGrillRecipe, recipePortionCost, type IngredientId, type RecipeId } from './shared/food';
import { recipeAvailability,holidayRecipeOpen } from './shared/recipeAvailability';
import { skillRank } from './shared/education';
import { COOKING_ORDER, COOKING_RECIPES, cookingExperience, cookingSeconds } from './shared/cookingProgression';
import { gameMinutes } from './shared/life';
import { qualityLabel, foodQualityChances, type FoodQuality } from './shared/foodQuality';
import { readyFoodRemaining } from './shared/readyFood';
import type { CharacterId } from './shared/protocol';
import type { GameState } from './shared/protocol';
import { RECIPE_DESCRIPTIONS } from './shared/storageSpace';

export type FoodCommand = 'buy' | 'cook' | 'eat' | 'store';

function entry(container: HTMLElement, heading: string, hint: string, disabled: boolean, onClick: () => void): void {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'food-action';
  button.disabled = disabled;
  const title = document.createElement('strong');
  title.textContent = heading;
  const small = document.createElement('small');
  small.textContent = hint;
  button.append(title, small);
  button.addEventListener('click', onClick);
  container.append(button);
}

export function showFoodChoices(
  container: HTMLElement,
  location: 'delivery' | 'kitchen' | 'table' | 'grill' | 'yardTable',
  state: GameState,
  submit: (type: FoodCommand, id: IngredientId | RecipeId) => boolean,
  role: CharacterId,
  favorite?: TasteSubmit,
): void {
  const heading = document.createElement('div');
  heading.className = 'food-section-heading';
  heading.textContent = location === 'delivery' ? '🛍️ Продукты с доставкой'
    : location === 'grill' ? 'Блюда на гриле'
    : location === 'kitchen' ? '🍳 Приготовить из запасов'
    : '🍽️ Готовые порции на всех';
  container.append(heading);
  if (location === 'delivery') {
    for (const [id, product] of Object.entries(GROCERIES) as Array<[IngredientId, (typeof GROCERIES)[IngredientId]]>) {
      entry(container, product.emoji + ' ' + product.name + ' · ' + product.price + ' ₽',
        'В запасе: ' + state.pantry[id] + ' · получить: +' + product.quantity,
        state.money < product.price || state.pantry[id] + product.quantity > 99,
        () => submit('buy', id));
    }
  } else if (location === 'kitchen' || location === 'grill') {
    const skill=skillRank(state.education.characters[role].xp.cooking);
    const info=document.createElement('small');
    info.className='food-cooking-skill';
    info.textContent='🍲 Кулинария · ур. '+skill.level+'/20 · '+
      (skill.next?skill.current+'/'+skill.next+' XP':'максимальный уровень')+
      '. Новые рецепты открываются с ростом уровня. Прогресс всех навыков — кнопка «Навыки» в главном интерфейсе.';
    container.append(info);
    const chance=document.createElement("small");chance.className="food-cooking-skill";
    const [bad,average,good,perfect]=foodQualityChances(skill.level);
    chance.textContent="Шансы качества еды: плохое "+bad+"% · среднячок "+average+"% · хорошее "+good+"% · идеальное "+perfect+"% · Напитки: 85% хорошее / 15% идеальное";
    container.append(chance);
    // On a phone, dozens of long ingredient lists were making recipes
    // impossible to browse. Keep availability visible; reveal composition on tap.
    const recipes=COOKING_ORDER
      .filter(id=>isGrillRecipe(id)===(location==='grill')&&holidayRecipeOpen(state,id))
      .map(id=>({id,recipe:RECIPES[id],availability:recipeAvailability(state,role,id)}));
    const tools=document.createElement('div');
    tools.className='food-recipe-tools';
    const search=document.createElement('input');
    search.type='search';
    search.placeholder='🔎 Найти блюдо по названию';
    search.setAttribute('aria-label','Найти рецепт');
    search.autocomplete='off';
    const filters=document.createElement('div');
    filters.className='food-recipe-filter';
    const count=document.createElement('small');
    count.className='food-recipe-count';
    const results=document.createElement('div');
    // Direct child cards participate in the shared two-column action grid.
    results.className='food-recipe-results';
    let currentFilter:'all'|'available'|'locked'|'favorite'='all';
    const favorites=new Set(recipes.filter(r=>favoriteFood(state,role,'meal',r.id)).map(r=>r.id));
    const category=document.createElement('select');category.setAttribute('aria-label','Категория рецептов');for(const [v,label] of [['all','Все рецепты'],['meal','Основные блюда'],['drink','Напитки'],['dessert','Выпечка и десерты']]){const o=document.createElement('option');o.value=v;o.textContent=label;category.append(o);}category.hidden=location==='grill';category.addEventListener('change',renderRecipes);
    const buttons=([
      ['all','Все'],['available','Готовить'],['locked','Недоступно'],['favorite','♥ Любимое'],
    ] as const).map(([filter,label])=>{
      const b=document.createElement('button');
      b.type='button';b.textContent=label;
      b.setAttribute('aria-pressed',String(currentFilter===filter));
      b.addEventListener('click',()=>{currentFilter=filter;renderRecipes();});
      filters.append(b);return b;
    });
    tools.append(search,category,filters,count);
    container.append(tools,results);
    // Keep a real grid container. iOS Safari incorrectly collapses the
    // nested recipe cards when display:contents is nested in the HUD grid.
    results.style.display='grid';
    function renderRecipes(){
      const query=search.value.trim().toLocaleLowerCase('ru-RU').replaceAll('ё','е');
      const visible=recipes.filter(item=>{
        const ingredients=ingredientList(item.id).map(([ingredient])=>GROCERIES[ingredient].name).join(' ');
        const text=(item.recipe.name+' '+ingredients).toLocaleLowerCase('ru-RU').replaceAll('ё','е');
        const kind=isHomeDrink(item.id)?'drink':HOME_DESSERTS.includes(item.id)||['pannaCotta','cremeBrulee','chocolateFondant','birthdayCake','fruitSalad','christmasApples'].includes(item.id)?'dessert':'meal';
        return (category.value==='all'||category.value===kind)&&(!query||text.includes(query))&&
          (currentFilter==='all'||(currentFilter==='favorite'?favorites.has(item.id):currentFilter==='available'?item.availability.available:!item.availability.available));
      });
      count.textContent='По сложности ↑ · можно сейчас: '+recipes.filter(item=>item.availability.available).length+
        ' из '+recipes.length+' · показано: '+visible.length;
      buttons.forEach((b,i)=>b.setAttribute('aria-pressed',
        String(currentFilter===(['all','available','locked','favorite'] as const)[i])));
      results.replaceChildren();
      if(!visible.length){
        const empty=document.createElement('p');
        empty.className='food-empty food-recipe-empty';
        empty.textContent='Ничего не найдено. Попробуй другое название или открой «Все рецепты».';
        results.append(empty);
      }
      for(const {id,recipe,availability} of visible){
        const card=document.createElement('article');
        card.className='food-recipe-card'+(availability.available?'':' unavailable');
        const cook=document.createElement('button');
        cook.type='button';cook.className='food-action';
        cook.disabled=!availability.available;
        const name=document.createElement('strong');
        name.textContent=recipe.emoji+' '+recipe.name+(favorites.has(id)?' ♥':'')+(favoriteFood(state,role==='vlad'?'alina':'vlad','meal',id)?' · ♡ партнёр':'');
        const summary=document.createElement('small');
        const difficulty=COOKING_RECIPES[id];
        summary.textContent=cookingSeconds(id)+' \u0441 \u00b7 '+difficulty.tier+' · ур. '+difficulty.minLevel+' · '+
          (availability.available?'✅ Можно приготовить':'Недоступно: '+availability.reason)+
          ' · '+recipe.servings+' порц.';
        cook.append(name,summary);
        cook.addEventListener('click',()=>submit('cook',id));
        const details=document.createElement('details');
        const toggle=document.createElement('summary');
        toggle.textContent='📋 Состав и описание блюда';
        const paragraph=document.createElement('p');
        paragraph.textContent=RECIPE_DESCRIPTIONS[id]+' · +'+cookingExperience(state.education.characters[role],role,id)+' XP · ≈'+recipePortionCost(id)+' ₽/порция · Нужно: '+(isCatchRecipe(id)?'🐟 Улов ×1 (есть '+freshFish(state).length+') · ':'')+
          ingredientList(id).map(([ingredient,quantity])=>
            GROCERIES[ingredient].emoji+' '+GROCERIES[ingredient].name.split(' · ')[0]+
            ' ×'+quantity+(state.pantry[ingredient]<quantity?
              ' (есть '+state.pantry[ingredient]+')':'')).join(' · ');
        details.append(toggle,paragraph);
        card.append(cook);if(favorite){const view={...state,foodTastes:{...state.foodTastes,[role]:{favorites:[...favorites].map(x=>'meal:'+x)}}};card.append(tasteButton(view,role,'meal',id,favorite,on=>{if(on)favorites.add(id);else favorites.delete(id);renderRecipes();}));}card.append(details);results.append(card);
      }
    }
    search.addEventListener('input',renderRecipes);
    renderRecipes();
  } else {
    const now=gameMinutes(state.clock);
    // Totals in state.meals include refrigerated leftovers. The dining table
    // must show ONLY the actual, fresh servings physically placed on it.
    const batches=state.readyFood.filter(b=>b.kind==='meal'&&b.storage==='table'&&
      b.portions>0&&b.expiresAt>now&&
      isGrillRecipe(b.item as RecipeId)===(location==='yardTable'));
    const groups=new Map<RecipeId,{portions:number;expiresAt:number;quality?:FoodQuality;mixed:boolean}>();
    for(const batch of batches){
      const id=batch.item as RecipeId;
      const previous=groups.get(id);
      groups.set(id,{portions:(previous?.portions??0)+batch.portions,
        expiresAt:Math.min(previous?.expiresAt??batch.expiresAt,batch.expiresAt),quality:!previous||batch.expiresAt<previous.expiresAt?batch.quality:previous.quality,mixed:!!previous&&(previous.mixed||(previous.quality??"good")!==(batch.quality??"good"))});
    }
    for(const [id,stored] of groups){
      const recipe=RECIPES[id];
      const card=document.createElement('article');
      card.className='food-serving-card';
      const title=document.createElement('strong');
      title.textContent=recipe.emoji+' '+recipe.name+' · '+stored.portions+' порц.'+tasteLabel(state,role,'meal',id);
      const hint=document.createElement('small');
      hint.textContent='Голод +'+recipe.hunger+' · '+readyFoodRemaining(stored.expiresAt,state.clock)+
        ' · '+(stored.mixed?'Следующая порция: ':'Качество: ')+qualityLabel(stored.quality)+' · на столе портится быстрее';
      const actions=document.createElement('div');
      actions.className='food-serving-actions';
      entry(actions,'🍽️ Съесть','1 порция · '+qualityLabel(stored.quality),false,()=>submit('eat',id));
      entry(actions,'🧊 Убрать в холодильник','1 порция · холод замедлит порчу',false,()=>submit('store',id));
      card.append(title,hint,actions);if(favorite)card.append(tasteButton(state,role,'meal',id,favorite));
      container.append(card);
    }
    if (!groups.size) {
      const hint = document.createElement('p');
      hint.className = 'food-empty';
      hint.textContent = location === 'yardTable' ?
        'На столе пока нет свежих блюд с гриля. Приготовь их на мангале.' :
        'На столе нет готовых порций. Приготовь блюдо или достань еду из холодильника.';
      container.append(hint);
    }
  }
}
