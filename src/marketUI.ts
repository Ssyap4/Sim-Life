import { GROCERIES, RECIPES, TAKEOUT, ingredientList, recipePortionCost, type TakeoutId } from './shared/food';
import { MARKET_PRODUCTS, MARKET_CATEGORIES, marketProduct, basketPrice, type BasketLine, type MarketCategory, type MarketProduct } from './shared/market';
import { formatRub } from './shared/economy';
import { PETS } from './shared/pets';
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
      const grid = el('div','market-products');
      for (const p of MARKET_PRODUCTS) {
        if (category!=='all' && p.category!==category) continue;
        const line = el('div','market-product');
        line.append(el('div','market-product-icon',p.emoji));
        const description=el('div','market-description');
        description.append(el('strong','',p.name),
          el('small','', '+'+p.quantity+' '+p.unit+' · дома: '+owned(state,p)));
        const pricing=el('div','market-price',formatRub(p.price));
        description.append(pricing);
        const stepper=el('div','market-stepper');
        const amount=cart.get(p.id)??0;
        stepper.append(
          button('−',()=>change(p.id,-1),'market-adjust',amount===0),
          el('span','',String(amount)),
          button('+',()=>change(p.id,1),'market-adjust',
            amount>=10 || owned(state!,p)+(amount+1)*p.quantity>limit(p)));
        line.append(description,stepper);
        grid.append(line);
      }
      scroll.append(grid);
      const selected=[...cart.entries()].map(([id,quantity])=>({id,quantity}));
      const total=basketPrice(selected);
      const footer=el('div','market-checkout');
      const amounts=el('div','market-summary');
      amounts.append(el('strong','', 'Корзина: '+selected.reduce((n,l)=>n+l.quantity,0)+' уп. · '+formatRub(total)),
        el('small','', total>state.money ? 'Не хватает '+formatRub(total-state.money) : 'После покупки: '+formatRub(state.money-total)));
      const sendBtn=button('Заказать продукты',()=>{
        if (sendCheckout(selected)) {
          // Keep the basket until the server acknowledges an atomic purchase.
          sendBtn.disabled=true;
          sendBtn.textContent='Отправлено…';
        }
      },'market-order',selected.length===0 || total>state.money);
      footer.append(amounts,sendBtn);
      panel.append(scroll,footer);
    } else if (currentTab==='stock') {
      const pantry=Object.entries(GROCERIES).filter(([id])=>state!.pantry[id as keyof GameState['pantry']]>0);
      scroll.append(el('h3','market-subtitle','🥛 Ингредиенты в холодильнике'));
      if (!pantry.length) scroll.append(el('p','market-empty','Запасы пока пусты. Купи продукты в каталоге.'));
      for (const [id,p] of pantry) {
        scroll.append(el('div','market-stock-row',p.emoji+' '+p.name+' · '+state.pantry[id as keyof GameState['pantry']]+' '+p.unit));
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
        const need=ingredientList(id as keyof GameState['meals']);
        const possible=need.every(([ing,count])=>state!.pantry[ing]>=count);
        scroll.append(el('div','market-stock-row',
          (possible?'✅ ':'◯ ')+p.name+' · ≈'+formatRub(recipePortionCost(id as keyof GameState['meals']))+'/порц.'));
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
    container.append(choice);
  }
}
