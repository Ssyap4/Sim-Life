import { GROCERIES, RECIPES, ingredientList, isGrillRecipe, recipePortionCost, type IngredientId, type RecipeId } from './shared/food';
import { recipeAvailability } from './shared/recipeAvailability';
import type { CharacterId } from './shared/protocol';
import type { GameState } from './shared/protocol';
import { RECIPE_DESCRIPTIONS } from './shared/storageSpace';

export type FoodCommand = 'buy' | 'cook' | 'eat';

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
    // On a phone, dozens of long ingredient lists were making recipes
    // impossible to browse. Keep availability visible; reveal composition on tap.
    const recipes=(Object.entries(RECIPES) as Array<[RecipeId,(typeof RECIPES)[RecipeId]]>)
      .filter(([id])=>isGrillRecipe(id)===(location==='grill'))
      .map(([id,recipe])=>({id,recipe,availability:recipeAvailability(state,role,id)}))
      .sort((a,b)=>Number(b.availability.available)-Number(a.availability.available));
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
    let currentFilter:'all'|'available'='all';
    const buttons=([
      ['all','Все рецепты'],['available','Можно приготовить'],
    ] as const).map(([filter,label])=>{
      const b=document.createElement('button');
      b.type='button';b.textContent=label;
      b.setAttribute('aria-pressed',String(currentFilter===filter));
      b.addEventListener('click',()=>{currentFilter=filter;renderRecipes();});
      filters.append(b);return b;
    });
    tools.append(search,filters,count);
    container.append(tools,results);
    results.style.display='contents';
    function renderRecipes(){
      const query=search.value.trim().toLocaleLowerCase('ru-RU').replaceAll('ё','е');
      const visible=recipes.filter(item=>{
        const ingredients=ingredientList(item.id).map(([ingredient])=>GROCERIES[ingredient].name).join(' ');
        const text=(item.recipe.name+' '+ingredients).toLocaleLowerCase('ru-RU').replaceAll('ё','е');
        return (!query||text.includes(query))&&
          (currentFilter==='all'||item.availability.available);
      });
      count.textContent='Можно сейчас: '+recipes.filter(item=>item.availability.available).length+
        ' из '+recipes.length+' · показано: '+visible.length;
      buttons.forEach((b,i)=>b.setAttribute('aria-pressed',
        String(currentFilter===(i===0?'all':'available'))));
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
        name.textContent=recipe.emoji+' '+recipe.name;
        const summary=document.createElement('small');
        summary.textContent=(availability.available?'✅ Можно приготовить':
          'Нельзя сейчас: '+availability.reason)+
          ' · '+recipe.servings+' порц. · ≈'+recipePortionCost(id)+' ₽/порция';
        cook.append(name,summary);
        cook.addEventListener('click',()=>submit('cook',id));
        const details=document.createElement('details');
        const toggle=document.createElement('summary');
        toggle.textContent='📋 Состав и описание блюда';
        const paragraph=document.createElement('p');
        paragraph.textContent=RECIPE_DESCRIPTIONS[id]+' · Нужно: '+
          ingredientList(id).map(([ingredient,quantity])=>
            GROCERIES[ingredient].emoji+' '+GROCERIES[ingredient].name.split(' · ')[0]+
            ' ×'+quantity+(state.pantry[ingredient]<quantity?
              ' (есть '+state.pantry[ingredient]+')':'')).join(' · ');
        details.append(toggle,paragraph);
        card.append(cook,details);results.append(card);
      }
    }
    search.addEventListener('input',renderRecipes);
    renderRecipes();
  } else {
    let hasMeals = false;
    for (const [id, recipe] of Object.entries(RECIPES) as Array<[RecipeId, (typeof RECIPES)[RecipeId]]>) {
      if (!state.meals[id] || isGrillRecipe(id) !== (location === 'yardTable')) continue;
      hasMeals = true;
      entry(container, recipe.emoji + ' ' + recipe.name,
        'Порций: ' + state.meals[id] + ' · голод +' + recipe.hunger + ' · настроение +' + recipe.mood,
        false, () => submit('eat', id));
    }
    if (!hasMeals) {
      const hint = document.createElement('p');
      hint.className = 'food-empty';
      hint.textContent = location === 'yardTable' ? 'На столе пока нет блюд с гриля.'
        : 'Пока нет готовой еды. Купите ингредиенты и приготовьте что-нибудь на кухне.';
      container.append(hint);
    }
  }
}
