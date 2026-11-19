import { GROCERIES, RECIPES, TAKEOUT, ingredientList, recipePortionCost, type TakeoutId } from './shared/food';
import { MARKET_PRODUCTS, MARKET_CATEGORIES, marketProduct, basketPrice, type BasketLine, type MarketCategory, type MarketProduct } from './shared/market';
import { formatRub } from './shared/economy';
import { PETS } from './shared/pets';
import { GROCERY_DETAILS, TAKEOUT_DESCRIPTIONS, RECIPE_DESCRIPTIONS,
  FRIDGE_CAPACITY, CUPBOARD_CAPACITY, storageUsage, storageCanFit } from './shared/storageSpace';
import type { GameState } from './shared/protocol';

type Tab = 'shop' | 'stock' | 'ledger';
type Filter = 'all' | MarketCategory;
const el = <K extends keyof HTMLElementTagNameMap>(tag: K, className = '', text = ''): HTMLElementTagNameMap[K] => {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text) node.textContent = text;
  return node;
};
function button(text: string, action: () => void, className = '', disabled = false): HTMLButtonElement {
  const node = el('button', className, text);
  node.type = 'button';
  node.disabled = disabled;
  node.addEventListener('click', action);
  return node;
}
function owned(state: GameState, p: MarketProduct): number {
  if (p.kind === 'grocery') return state.pantry[p.stockKey as keyof GameState['pantry']];
  if (p.kind === 'takeout') return state.takeout[p.stockKey as keyof GameState['takeout']];
  return state.petFood[p.stockKey as keyof GameState['petFood']];
}
function limit(p: MarketProduct): number { return p.kind === 'grocery' ? 99 : p.kind === 'takeout' ? 40 : 24; }

export function createMarketUI(
  root: HTMLElement,
  sendCheckout: (lines: BasketLine[]) => boolean,
): { open: (household: GameState) => void; refresh: (household: GameState) => void;
     close: () => void; acknowledge: () => void } {
  let state: GameState | null = null;
  let currentTab: Tab = 'shop';
  let category: Filter = 'all';
  const cart = new Map<string, number>();
  function cartFit(id?:string,delta=0):boolean {
    if(!state)return false;
    const simulated={pantry:{...state.pantry},meals:{...state.meals},takeout:{...state.takeout}};
    const choices=new Map(cart);
    if(id)choices.set(id,(choices.get(id)??0)+delta);
    for(const [key,qty] of choices) {
      if(qty<=0)continue;
      const product=marketProduct(key);
      if(!product)continue;
      const amount=product.quantity*qty;
      if(product.kind==='grocery')simulated.pantry[product.stockKey as keyof GameState['pantry']]+=amount;
      if(product.kind==='takeout')simulated.takeout[product.stockKey as keyof GameState['takeout']]+=amount;
    }
    return storageCanFit(state,simulated).ok;
  }
  const close = () => { root.hidden = true; root.replaceChildren(); };
  function redraw(): void {
    if (!state || root.hidden) return;
    const oldScroll = root.querySelector<HTMLElement>('.market-scroll')?.scrollTop ?? 0;
    root.replaceChildren();
    const panel = el('div','market-card');
    panel.setAttribute('role','dialog');
    panel.setAttribute('aria-label','Магазин и семейные запасы');
    const header = el('div','market-header');
    const title = el('div','market-title');
    title.append(el('strong','', '🛒 Магазин и холодильник'),
      el('small','', 'Семейный бюджет: '+formatRub(state.money)));
    header.append(title,button('✕',close,'market-close'));
    panel.append(header);
    const tabs = el('div','market-tabs');
    for (const [tab,label] of [['shop','🛍️ Каталог'],['stock','🥘 Запасы'],['ledger','📒 Финансы']] as const) {
      tabs.append(button(label,()=>{currentTab=tab;redraw();},'market-tab'+(currentTab===tab?' selected':'')));
    }
    panel.append(tabs);
    const scroll = el('div','market-scroll');
    if (currentTab==='shop') {
      const filters = el('div','market-filters');
      const filtersArray: Array<[Filter,string]> = [['all','Все'],...Object.entries(MARKET_CATEGORIES) as Array<[MarketCategory,string]>];
      for (const [id,label] of filtersArray) {
        filters.append(button(label,()=>{category=id;redraw();scroll.scrollTop=0;},
          'market-filter'+(category===id?' selected':'')));
      }
      scroll.append(filters);
      const caption = el('p','market-hint',
        'Продукты готовить дома выгоднее. Пицца и роллы доставляются готовыми и стоят заметно дороже.');
      scroll.append(caption);
      const used=storageUsage(state);
      scroll.append(el('div','market-capacity',
        '🧊 Холодильник '+used.fridge+'/'+FRIDGE_CAPACITY+' · 🗄️ Полки '+used.cupboard+'/'+CUPBOARD_CAPACITY+
        ' · упаковка обычно занимает одну ячейку'));
      const grid = el('div','market-products');
      for (const p of MARKET_PRODUCTS) {
        if (category!=='all' && p.category!==category) continue;
        const line = el('div','market-product');
        line.append(el('div','market-product-icon',p.emoji));
        const description=el('div','market-description');
        description.append(el('strong','',p.name),
          el('small','', '+'+p.quantity+' '+p.unit+' · дома: '+owned(state,p)));
        const about=p.kind==='grocery' ? GROCERY_DETAILS[p.stockKey as keyof typeof GROCERY_DETAILS]
          : p.kind==='takeout' ? null : null;
        const detail=p.kind==='grocery' ? about?.description
          : p.kind==='takeout' ? TAKEOUT_DESCRIPTIONS[p.stockKey as keyof typeof TAKEOUT_DESCRIPTIONS]
          : 'Корм для любимого питомца: '+p.quantity+' порции в одной упаковке.';
        description.append(el('small','market-product-about',detail??''),
          el('small','market-shelf',p.kind==='grocery'
            ? about?.area==='fridge'?'🧊 Холодильник':'🗄️ Кухонные полки'
            : p.kind==='takeout'?'🧊 Готовое блюдо':'🐾 Запасы питомца'));
        const pricing=el('div','market-price',formatRub(p.price));
        description.append(pricing);
        const stepper=el('div','market-stepper');
        const amount=cart.get(p.id)??0;
        stepper.append(
          button('−',()=>change(p.id,-1),'market-adjust',amount===0),
          el('span','',String(amount)),
          button('+',()=>change(p.id,1),'market-adjust',
            amount>=10 || owned(state!,p)+(amount+1)*p.quantity>limit(p) || !cartFit(p.id,1)));
        line.append(description,stepper);
        grid.append(line);
      }
      scroll.append(grid);
      const selected=[...cart.entries()].map(([id,quantity])=>({id,quantity}));
      const total=basketPrice(selected);
      const storageOkay=cartFit();
      const after={pantry:{...state.pantry},meals:{...state.meals},takeout:{...state.takeout}};
      for(const line of selected){
        const product=marketProduct(line.id)!;
        if(product.kind==='grocery')after.pantry[product.stockKey as keyof GameState['pantry']]+=product.quantity*line.quantity;
        if(product.kind==='takeout')after.takeout[product.stockKey as keyof GameState['takeout']]+=product.quantity*line.quantity;
      }
      const capacity=storageUsage(after);
      const footer=el('div','market-checkout');
      const amounts=el('div','market-summary');
      amounts.append(el('strong','', 'Корзина: '+selected.reduce((n,l)=>n+l.quantity,0)+' уп. · '+formatRub(total)),
        el('small','', !storageOkay ? 'Недостаточно мест для заказа' :
          total>state.money ? 'Не хватает '+formatRub(total-state.money) : 'После покупки: '+formatRub(state.money-total)),
        el('small','', '🧊 '+capacity.fridge+'/'+FRIDGE_CAPACITY+' · 🗄️ '+capacity.cupboard+'/'+CUPBOARD_CAPACITY));
      const sendBtn=button('Заказать продукты',()=>{
        if (sendCheckout(selected)) {
          // Keep the basket until the server acknowledges an atomic purchase.
          sendBtn.disabled=true;
          sendBtn.textContent='Отправлено…';
        }
      },'market-order',selected.length===0 || total>state.money || !storageOkay);
      footer.append(amounts,sendBtn);
      panel.append(scroll,footer);
    } else if (currentTab==='stock') {
      const used=storageUsage(state);
      scroll.append(el('div','market-capacity','🧊 Холодильник '+used.fridge+'/'+FRIDGE_CAPACITY+' мест · 🗄️ Кухонные полки '+used.cupboard+'/'+CUPBOARD_CAPACITY+' мест'));
      const pantry=Object.entries(GROCERIES).filter(([id])=>state!.pantry[id as keyof GameState['pantry']]>0);
      scroll.append(el('h3','market-subtitle','🥛 Продукты дома'));
      if (!pantry.length) scroll.append(el('p','market-empty','Запасы пока пусты. Купи продукты в каталоге.'));
      for (const [id,p] of pantry) {
        scroll.append(el('div','market-stock-row',p.emoji+' '+p.name+' · '+state.pantry[id as keyof GameState['pantry']]+' '+p.unit+' · '+
          (GROCERY_DETAILS[id as keyof typeof GROCERY_DETAILS].area==='fridge'?'🧊':'🗄️')));
      }
      scroll.append(el('h3','market-subtitle','🍳 Приготовлено дома'));
      const home=Object.entries(RECIPES).filter(([id])=>state!.meals[id as keyof GameState['meals']]>0);
      if (!home.length) scroll.append(el('p','market-empty','Ещё нет домашних блюд.'));
      for (const [id,p] of home) {
        scroll.append(el('div','market-stock-row',p.emoji+' '+p.name+' · '+state.meals[id as keyof GameState['meals']]+' порц.'));
      }
      scroll.append(el('h3','market-subtitle','🍕 Готовая еда с доставкой'));
      const takeaway=Object.entries(TAKEOUT).filter(([id])=>state!.takeout[id as TakeoutId]>0);
      if (!takeaway.length) scroll.append(el('p','market-empty','Нет заказанной готовой еды.'));
      for (const [id,p] of takeaway) {
        scroll.append(el('div','market-stock-row',p.emoji+' '+p.name+' · '+state.takeout[id as TakeoutId]+' порц.'));
      }
      scroll.append(el('h3','market-subtitle','🐾 Питомцы'));
      for (const [id,p] of Object.entries(PETS)) {
        scroll.append(el('div','market-stock-row',p.emoji+' '+p.foodName+' · '+state.petFood[id as keyof GameState['petFood']]+' порц.'));
      }
      scroll.append(el('h3','market-subtitle','📖 Что приготовить выгоднее'));
      for (const [id,p] of Object.entries(RECIPES)) {
        const recipeId=id as keyof GameState['meals'];
        const need=ingredientList(recipeId);
        const missing=need.filter(([ing,count])=>state!.pantry[ing]<count);
        const possible=missing.length===0;
        const row=el('div','market-stock-row market-recipe');
        row.append(el('strong','',(possible?'✅ ':'◯ ')+p.name+' · ≈'+formatRub(recipePortionCost(recipeId))+'/порц.'),
          el('small','',RECIPE_DESCRIPTIONS[recipeId]));
        if(missing.length) {
          row.append(el('small','','Не хватает: '+missing.map(([ing,count])=>GROCERIES[ing].name+' ×'+(count-state!.pantry[ing])).join(', ')));
          row.append(button('🛒 Добавить недостающие продукты',()=>{
            for(const [ingredient,count] of missing){
              const pack=GROCERIES[ingredient];
              const needed=Math.ceil((count-state!.pantry[ingredient])/pack.quantity);
              cart.set('grocery:'+ingredient,Math.min(10,(cart.get('grocery:'+ingredient)??0)+needed));
            }
            category='all';currentTab='shop';redraw();
          },'market-recipe-order'));
        }
        scroll.append(row);
      }
      panel.append(scroll);
    } else {
      scroll.append(el('p','market-hint','Последние 40 операций семейного бюджета. Доходы и покупки записываются на сервере.'));
      if (!state.ledger.length) scroll.append(el('p','market-empty','Покупок и заработка пока не было.'));
      for (const entry of [...state.ledger].reverse()) {
        const hour=Math.floor(entry.minute/60).toString().padStart(2,'0');
        const minute=(entry.minute%60).toString().padStart(2,'0');
        const row=el('div','market-ledger-row');
        const who=entry.actor==='vlad'?'Влад':'Алина';
        const details=el('div','market-ledger-description');
        details.append(el('strong','',entry.label),el('small','',who+' · день '+entry.day+' · '+hour+':'+minute));
        row.append(details,el('b',entry.kind==='income'?'market-positive':'market-negative',
          (entry.kind==='income'?'+':'−')+formatRub(entry.amount)));
        scroll.append(row);
      }
      panel.append(scroll);
    }
    root.append(panel);
    root.querySelector<HTMLElement>('.market-scroll')?.scrollTo({top:oldScroll});
  }
  function change(id: string, difference: number): void {
    const product=marketProduct(id);
    if (!product || !state) return;
    const current=cart.get(id)??0;
    const next=Math.max(0,Math.min(10,current+difference));
    if (owned(state,product)+next*product.quantity>limit(product)) return;
    if (!next) cart.delete(id); else cart.set(id,next);
    if(difference>0&&!cartFit()){if(current===0)cart.delete(id);else cart.set(id,current);return;}
    redraw();
  }
  return {
    open(household) {state=household; root.hidden=false; redraw();},
    refresh(household) {state=household;redraw();},
    close,
    acknowledge() {cart.clear(); redraw();},
  };
}

export function showTakeoutChoices(container:HTMLElement,state:GameState,send:(id:TakeoutId)=>boolean):void {
  const available=Object.entries(TAKEOUT).filter(([id])=>state.takeout[id as TakeoutId]>0);
  if (!available.length) return;
  container.append(el('div','food-section-heading','🍕 Еда из доставки'));
  for (const [id,meal] of available) {
    const mealId=id as TakeoutId;
    const choice=button(meal.emoji+' '+meal.name+' · '+state.takeout[mealId]+' порц. · голод +'+meal.hunger,
      ()=>send(mealId),'food-action');
    choice.title=TAKEOUT_DESCRIPTIONS[mealId];
    container.append(choice);
  }
}
