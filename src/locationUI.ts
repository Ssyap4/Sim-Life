import { PICNIC_BASKET_PRICE, PICNIC_CAPACITY, picnicPortions } from './shared/picnic';
import { CAFE_TALK_TOPICS } from './shared/socialLife';
import { cafeSeatAt } from './shared/locations';
import { CAFE_MENU, PLACES, STATIONS, stationById, clockMinutes, type CafeItem, type PlaceId, type Station, type WorldCommand } from './shared/locations';
import { COURIER_NAME } from './shared/courier';
import { districtStation } from './shared/district';
import { CAREERS, isCareerPlace, type CareerId } from './shared/careers';
import { MARKET_PRODUCTS, basketPrice, marketProduct, type BasketLine } from './shared/market';
import { GROCERIES, RECIPES, ingredientList, type IngredientId, type RecipeId } from './shared/food';
import { GROCERY_DETAILS, storageUsage, FRIDGE_CAPACITY } from './shared/storageSpace';
import { READY_FOOD_SLOTS, readyFoodRemaining, readyFoodName, readyFoodTableUsage, TABLE_READY_CAPACITY,
  type ReadyFoodBatch } from './shared/readyFood';
import { MINUTES_PER_DAY } from './shared/life';
import { formatRub } from './shared/economy';
import type { CharacterId, GameState } from './shared/protocol';
import type { World } from './game/World';

function element<K extends keyof HTMLElementTagNameMap>(tag: K, className = '', text = '') {
  const node = document.createElement(tag);
  node.className = className;
  node.textContent = text;
  return node;
}
function button(label: string, click: () => void, disabled = false) {
  const node = element('button', 'action-button', label);
  node.type = 'button';
  node.disabled = disabled;
  node.addEventListener('click', click);
  return node;
}

export function createLocationUI(panel: HTMLElement, map: HTMLElement, getWorld: () => World,
  send: (operation: WorldCommand) => boolean, cook: (recipe: RecipeId) => void, signOut: () => void,
  openEducation: (room: string, exam?: boolean) => void,
  enterWork: (station:string) => boolean, openCareer: () => void, cafeSocial?: (action:string)=>boolean) {
  let state: GameState | null = null;
  let role: CharacterId = 'vlad';
  let location: PlaceId = 'home';
  let current: Station | null = null;
  let ingredient: IngredientId | null = null;
  let pending: number | null = null;
  let cafeChoice: CafeItem | null = null;
  let cafeTopicsOpen=false;
  let entrance: { station: string; dog: boolean; onward?: PlaceId } | null = null;
  const cart = new Map<string, number>();
  const list = (): BasketLine[] => [...cart].map(([id, quantity]) => ({ id, quantity }));
  const showCart = () => getWorld().setCart(list().reduce((count, line) => count + line.quantity, 0));

  function close() {
    if (current?.action.kind === 'fridge' || current?.action.kind === 'cupboard') send({ type: 'close_storage' });
    current = null;
    cafeChoice=null;
    cafeTopicsOpen=false;
    panel.hidden = true;
    panel.replaceChildren();
    getWorld()?.closeStorage();
  }
  function closeMap() { map.hidden = true; map.replaceChildren(); }
  function travel(destination: PlaceId, via?: string, dog = false) {
    if (send({ type: 'travel', place: destination, via, dog })) { close(); closeMap(); }
  }
  function go(destination:PlaceId,dog=false):boolean {
    if(state?.world.carDriver===role&&destination!=='home')return false;
    const target=location==='home'?stationById('home','home-gate'):
      location==='district'?stationById('district',destination==='home'?'district-gate':districtStation(destination)):
      STATIONS[location].find(site=>site.action.kind==='door'&&site.action.destination==='district');
    if(!target || !send({type:'approach',place:location,station:target.id}))return false;
    entrance={station:target.id,dog,onward:location!=='district'&&destination!=='district'?destination:undefined};
    close();closeMap();
    return true;
  }
  function transaction(operation: WorldCommand): void {
    if (pending !== null || !state) return;
    if (send(operation)) { pending = state.world.sequence[role]; draw(); }
  }
  function openMap() {
    if (!state) return;
    close();
    if (!map.hidden) { closeMap(); return; }
    map.hidden = false;
    const heading = element('div', 'world-map-head');
    heading.append(element('strong', '', 'Карта района'), button('Закрыть', closeMap));
    map.append(heading);
    const grid = element('div', 'world-map-grid');
    for (const [key, destination] of Object.entries(PLACES)) {
      const id = key as PlaceId;
      if (isCareerPlace(id)) continue;
      const here=location===id;
      const entry = button('', () => go(id), here || !!state.activeShifts[role] || Boolean(state.careers.residents[role].shift) || (state.world.carDriver===role&&id!=='home'));
      entry.dataset.place = id;
      entry.append(element('strong', '', destination.icon + ' ' + destination.name),
        element('small', '', here ? 'Вы здесь' : state.world.carDriver===role&&id==='home'?'Вернуться на машине':destination.detail));
      grid.append(entry);
    }
    map.append(grid);
    if (location === 'district') {
      map.append(button('🏘️ Осмотреть соседей',()=>{
        closeMap();getWorld().focusNeighborhood();
      }));
      map.append(button('🛍️ Камера к торговой улице',()=>{
        closeMap();getWorld().focusDistrict('market');
      }), button('🏠 Камера к нашему дому',()=>{
        closeMap();getWorld().focusDistrict('home');
      }), button('◉ Общий вид района',()=>{
        closeMap();getWorld().overviewDistrict();
      }));
    }
    if (location === 'home' && !state.world.dogWalker)
      map.append(button('🐾 В парк с Верделлом', () => go('park', true), !!state.activeShifts[role]));
    map.append(button('Выйти и забыть устройство', signOut));
  }
  function change(id: string, delta: number) {
    const amount = Math.max(0, Math.min(10, (cart.get(id) ?? 0) + delta));
    if (amount) cart.set(id, amount);
    else cart.delete(id);
    showCart();
    draw();
  }
  function productRow(id: string) {
    const product = marketProduct(id)!;
    const count = cart.get(id) ?? 0;
    const row = element('div', 'world-product');
    const label = element('span', '', product.emoji + ' ' + product.name + ' · ' + formatRub(product.price));
    const control = element('span', 'world-stepper');
    const down = button('−', () => change(id, -1), count === 0 || pending !== null);
    down.setAttribute('aria-label', 'Убрать ' + product.name);
    const up = button('+', () => change(id, 1), count >= 10 || pending !== null);
    up.setAttribute('aria-label', 'Добавить ' + product.name);
    up.dataset.product = id;
    control.append(down, element('strong', '', String(count)), up);
    row.append(label, control);
    return row;
  }

  function draw() {
    if (!state || !current || panel.hidden) return;
    const station = current;
    const place = state;
    const header = element('div', 'actions-head');
    const title = element('strong', '', station.name);
    const closeButton = element('button', 'close-actions', '×');
    closeButton.type = 'button';
    closeButton.setAttribute('aria-label', 'Закрыть');
    closeButton.addEventListener('click', close);
    const y = panel.scrollTop;
    header.append(title, closeButton);
    panel.replaceChildren(header);
    const options = element('div', 'world-station-options');
    const now = clockMinutes(place.clock);
    const kind = station.action.kind;
    const local = (label: string, action: 'rest' | 'chess' | 'swing' | 'picnic' | 'exercise' | 'dine' | 'dog' | 'unpack') =>
      button(label, () => { if (send({ type: 'local_activity', station: station.id, action })) close(); });
    if(kind==='car'){
      options.append(element('small','','Семейный автомобиль · поездка туда и обратно'));
      if(place.world.carDriver)options.append(element('small','','Машина сейчас в поездке'));
      else for(const destination of ['market','cafe','park'] as const)options.append(button('🚗 '+PLACES[destination].name,()=>{
        if(send({type:'car_travel',place:destination}))close();
      }));
    } else if (kind === 'shelf' || kind === 'checkout') {
      const lines = list();
      const summary = element('strong', 'world-cart-total', 'Корзина: ' + lines.reduce((n, line) => n + line.quantity, 0) + ' уп. · ' + formatRub(basketPrice(lines)));
      options.append(summary);
      if (station.action.kind === 'shelf') {
        const { categories } = station.action;
        const products = MARKET_PRODUCTS.filter(p => station.id === 'drinks'
          ? p.stockKey === 'tea' || p.stockKey.startsWith('coffee') || p.stockKey.startsWith('beans') : categories.includes(p.category));
        for (const product of products) options.append(productRow(product.id));
        options.append(element('small', '', 'Выбранные товары оплачиваются на кассе.'));
      } else {
        for (const line of lines) options.append(productRow(line.id));
        if(!place.world.picnic)options.append(button('🧺 Корзина для пикника · '+formatRub(PICNIC_BASKET_PRICE),()=>send({type:'picnic_buy'}),place.money<PICNIC_BASKET_PRICE));
        const sequence = place.world.sequence[role];
        const pay = button(pending === null ? 'Оплатить · ' + formatRub(basketPrice(lines)) : 'Подтверждаем…',
          () => transaction({ type: 'store_pay', lines, sequence }), !lines.length || pending !== null);
        pay.dataset.worldAction = 'pay';
        options.append(pay, button('Очистить корзину', () => { cart.clear(); showCart(); draw(); }, !lines.length || pending !== null));
      }
    } else if (kind === 'employment') {
      const career=CAREERS[(station.action as {career:CareerId}).career];
      const contracted=place.careers.residents[role].contract?.career=== (station.action as {career:CareerId}).career;
      options.append(element('small','',career.title),button('К работе',()=>{ close(); openCareer(); }));
      if(contracted) options.append(button('Начать смену здесь',()=>{ if(enterWork(station.id))close(); }));
    } else if (kind === 'fridge' || kind === 'cupboard') {
      const amount = storageUsage(place);
      const capacity = kind === 'fridge' ? amount.fridge + '/36' : amount.cupboard + '/42';
      options.append(element('small', '', 'Занято ячеек: ' + capacity + ' · Выбери ингредиент'));
      if (kind === 'fridge') {
        options.append(element('strong', '', '🍲 Готовая еда'));
        options.append(element('small', '', 'Только продукты, действительно убранные сюда, занимают ' +
          READY_FOOD_SLOTS + ' ячейки за порцию. Холод замедляет порчу, но не делает старую еду новой.'));
        const groups = (location: 'fridge' | 'table') => {
          const grouped = new Map<string, ReadyFoodBatch>();
          for (const batch of place.readyFood) {
            if (batch.storage !== location || batch.expiresAt <= now) continue;
            const key = batch.kind + ':' + batch.item;
            const current = grouped.get(key);
            if (current) { current.portions += batch.portions; current.expiresAt = Math.min(current.expiresAt, batch.expiresAt); }
            else grouped.set(key, { ...batch });
          }
          return [...grouped.values()].sort((a,b) => a.expiresAt - b.expiresAt);
        };
        const fridgeReady = groups('fridge');
        if(place.world.picnic){
          const mine=picnicPortions(place,role),count=picnicPortions(place,'vlad').length+picnicPortions(place,'alina').length;
          options.append(element('strong','','🧺 Корзина для пикника · '+count+'/'+PICNIC_CAPACITY));
          options.append(element('small','','Твои порции хранятся отдельно. Еда вне холодильника портится быстрее.'));
          for(const food of mine)options.append(button('Вернуть: '+readyFoodName(food.kind,food.item),()=>send({type:'picnic_unpack',kind:food.kind,item:food.item})));
          for(const batch of fridgeReady)options.append(button('В корзину: '+readyFoodName(batch.kind,batch.item),()=>send({type:'picnic_pack',kind:batch.kind,item:batch.item}),count>=PICNIC_CAPACITY));
        }
        if (!fridgeReady.length) options.append(element('small', '', 'Готовых блюд в холодильнике пока нет.'));
        for (const batch of fridgeReady) {
          const name = readyFoodName(batch.kind, batch.item);
          options.append(element('small', '', (batch.kind === 'meal' ? '🍳 ' : '🍕 ') + name +
            ' · ' + batch.portions + ' порц. · ' + readyFoodRemaining(batch.expiresAt, place.clock)));
          options.append(button('🍽️ Достать 1 порцию на стол', () =>
            send({ type: 'ready_food_serve', kind: batch.kind, item: batch.item }),
            readyFoodTableUsage(place)>=TABLE_READY_CAPACITY));
          options.append(button('🗑️ Выбросить 1 порцию', () =>
            send({ type: 'ready_food_discard', kind: batch.kind, item: batch.item, storage: 'fridge' })));
        }
        const onTable = groups('table');
        if (onTable.length) {
          options.append(element('strong', '', '🍽️ Готовая еда на столе · ' +
            readyFoodTableUsage(place) + '/' + TABLE_READY_CAPACITY));
          for (const batch of onTable) {
            options.append(element('small', '', readyFoodName(batch.kind, batch.item) + ' · ' +
              batch.portions + ' порц. · ' + readyFoodRemaining(batch.expiresAt, place.clock)));
            options.append(button('🧊 Убрать 1 порцию в холодильник', () =>
              send({ type: 'ready_food_move', kind: batch.kind, item: batch.item }),
              storageUsage(place).fridge + READY_FOOD_SLOTS > FRIDGE_CAPACITY));
            options.append(button('🗑️ Выбросить 1 порцию со стола', () =>
              send({ type: 'ready_food_discard', kind: batch.kind, item: batch.item, storage: 'table' })));
          }
        }
      }
      const ingredients = (Object.entries(place.pantry) as [IngredientId, number][])
        .filter(([id, qty]) => qty > 0 && GROCERY_DETAILS[id].area === kind);
      for (const [id, qty] of ingredients) options.append(button(
        GROCERIES[id].emoji + ' ' + GROCERIES[id].name + ' · ' + qty,
        () => { ingredient = id; draw(); }));
      if (!ingredients.length) options.append(element('small', '', 'Здесь пока ничего нет.'));
      if (ingredient) {
        options.append(element('strong', '', 'Рецепты с продуктом: ' + GROCERIES[ingredient].name));
        let count = 0;
        for (const [id, recipe] of Object.entries(RECIPES) as [RecipeId, typeof RECIPES[RecipeId]][]) {
          const needed = ingredientList(id);
          if (!needed.some(([item]) => item === ingredient)) continue;
          count++;
          options.append(button('Приготовить: ' + recipe.name, () => { close(); cook(id); },
            !needed.every(([item, qty]) => place.pantry[item] >= qty)));
        }
        if (!count) options.append(element('small', '', 'Для этого продукта пока нет рецепта.'));
      }
    } else if (kind === 'parcel'||kind==='courier') {
      if (!place.world.deliveries.length) options.append(element('small', '', 'У двери нет заказов.'));
      for (const order of place.world.deliveries) {
        const row = element('div', 'world-order');
        row.append(element('strong', '', (order.handedAt!==undefined?'У двери':order.readyAt<=now?COURIER_NAME+' ждёт у двери':'Курьер едет · '+(order.readyAt-now)+' мин.') + ' · ' + formatRub(order.cost)),
          element('small', '', order.lines.map(line => marketProduct(line.id)!.name + ' ×' + line.quantity).join(', ')));
        if(order.handedAt===undefined){
          if(kind==='courier')row.append(button('🤝 Получить у курьера',()=>send({type:'delivery_handoff',id:order.id}),order.readyAt>now));
          else row.append(button('Подойти к курьеру',()=>{close();send({type:'approach',place:'home',station:'courier-handoff'});},order.readyAt>now));
          options.append(row);continue;
        }
        if(kind==='courier'){
          row.append(button('📦 Забрать пакеты у двери',()=>{close();send({type:'approach',place:'home',station:'parcel'});}));
          options.append(row);continue;
        }
        const hasReady = order.lines.some(line => marketProduct(line.id)?.kind === 'takeout');
        if (hasReady) {
          if (now >= order.readyAt + 2 * MINUTES_PER_DAY)
            row.append(element('small', '', '⚠️ Готовая еда испортилась у двери. Остальные продукты можно забрать.'));
          else row.append(element('small', '', 'Выбери, куда положить готовые блюда. Срок годности не обновляется при переносе.'));
          row.append(button('🧊 Забрать и убрать в холодильник', () =>
            send({ type: 'delivery_claim', id: order.id, storage: 'fridge' }), order.readyAt > now));
          row.append(button('🍽️ Забрать и оставить на столе', () =>
            send({ type: 'delivery_claim', id: order.id, storage: 'table' }), order.readyAt > now));
        } else row.append(button('Забрать заказ', () =>
          send({ type: 'delivery_claim', id: order.id }), order.readyAt > now));
        options.append(row);
      }
    } else if (kind === 'terminal' || kind === 'pickup') {
      const order = place.world.cafe[role];
      if (order?.table) options.append(element('small','','Ваш заказ подадут прямо к столику.'));
      else if (order) {
        options.append(element('strong', '', CAFE_MENU[order.item].name + ' · ' + (order.pickedUp ? 'На подносе' : order.readyAt <= now
          ? 'Готово к выдаче' : 'Готовится · ' + (order.readyAt - now) + ' мин.')));
        if (kind === 'pickup' && !order.pickedUp)
          options.append(button('Забрать заказ', () => send({ type: 'cafe_pickup' }), order.readyAt > now));
      } else if (kind === 'pickup') options.append(element('small', '', 'Сначала сделай заказ у терминала.'));
      else options.append(element('small','','Выберите свободный столик и закажите блюдо там.'));
    } else if (station.action.kind === 'education') {
      const room = station.action.room;
      options.append(button(room === 'reception' ? 'Расписание и запись' : 'Занятия в этом зале', () => openEducation(room)));
      if (room === 'reception' || room === 'classroom')
        options.append(button('Квалификационные экзамены', () => openEducation('classroom', true)));
    } else if (kind === 'dine') {
      const order=place.world.cafe[role];
      const seated=cafeSeatAt(place,role)?.id===station.id;
      const partner=role==='vlad'?'alina':'vlad';
      const sameTable=seated&&cafeSeatAt(place,partner)?.id===station.id;
      if(cafeTopicsOpen&&sameTable&&cafeSocial){
        title.textContent='О чём поговорим?';
        options.append(element('small','','Выберите тему разговора. Ваш заказ продолжит готовиться.'));
        for(const topic of CAFE_TALK_TOPICS)options.append(button(topic.title,()=>{if(cafeSocial(topic.id))close();}));
        options.append(button('Назад к столику',()=>{cafeTopicsOpen=false;draw();}));
        panel.append(options);
        panel.scrollTop=y;
        return;
      }
      if(!sameTable)cafeTopicsOpen=false;
      if(sameTable&&cafeSocial){
        options.append(button('Поболтать за столиком ›',()=>{cafeTopicsOpen=true;draw();}));
        const other=place.world.cafe[partner];
        if(order?.table===station.id&&other?.table===station.id&&order.readyAt<=now&&other.readyAt<=now)options.append(button('Поесть вместе',()=>{if(cafeSocial('cafeMeal'))close();}));
      }
      if(!seated)options.append(button('Сесть за столик',()=>send({type:'cafe_seat',station:station.id})));
      else if(order?.pickedUp)options.append(local('Съесть блюдо','dine'));
      else if(order?.table===station.id){
        const meal=CAFE_MENU[order.item];
        const remaining=Math.max(0,order.readyAt-now);
        options.append(element('strong','',meal.name));
        if(remaining){
          const progress=element('progress','cafe-order-progress');
          progress.max=Math.max(1,order.readyAt-(order.orderedAt??(order.readyAt-meal.minutes))); progress.value=Math.max(0,progress.max-remaining);
          progress.setAttribute('aria-label','Приготовление заказа');
          options.append(element('small','','Готовится · '+remaining+' игровых мин.'),progress);
        }else options.append(local('Съесть блюдо','dine'));
      }else if(order)options.append(element('small','','Сначала закончи предыдущий заказ за своим столиком.'));
      else if(cafeChoice){
        const meal=CAFE_MENU[cafeChoice];
        options.append(element('strong','',meal.name+' · '+formatRub(meal.price)),
          element('small','','Сытость +'+meal.hunger+' · Настроение +'+meal.mood+' · Комфорт +'+meal.comfort+' · '+meal.minutes+' мин.'),
          button('Подтвердить заказ',()=>{const item=cafeChoice!;cafeChoice=null;transaction({type:'cafe_order',item,table:station.id,sequence:place.world.sequence[role]});},pending!==null||place.money<meal.price),
          button('Назад к меню',()=>{cafeChoice=null;draw();}));
      }else for(const [id,meal] of Object.entries(CAFE_MENU)){
        options.append(button(meal.name+' · '+formatRub(meal.price),()=>{cafeChoice=id as CafeItem;draw();},pending!==null||place.money<meal.price));
      }
    } else if (kind === 'rest') options.append(local('Сесть на скамью', 'rest'));
    else if (kind === 'swing') options.append(local('Покачаться на качелях','swing'));
    else if (kind === 'chess') options.append(local('♟️ Сыграть в шахматы', 'chess'));
    else if(kind==='picnic'){
      const food=picnicPortions(place,role)[0];
      options.append(element('small','',food?'Из корзины: '+readyFoodName(food.kind,food.item):'Купи корзину в супермаркете и положи готовую еду в неё у холодильника.'));
      if(food)options.append(local('🍽️ Поесть на пикнике','picnic'));
    }
    else if (kind === 'exercise') options.append(local('Сделать лёгкую зарядку', 'exercise'));
    else if (kind === 'dog') {
      const walker = place.world.dogWalker;
      options.append(button(walker === role ? 'Отпустить Верделла домой' : 'Взять Верделла на прогулку',
        () => send({ type: 'dog_leash' }), !!walker && walker !== role));
      if (walker) options.append(local('Поиграть с Верделлом', 'dog'));
    }
    panel.append(options);
    panel.scrollTop = y;
  }

  return {
    openMap, closeMap, close, go,
    cancelRoute() { entrance=null; },
    visit(station: Station) {
      if (station.action.kind === 'waypoint') { entrance=null; return; }
      if (station.action.kind === 'door') {
        const dog=entrance?.station===station.id&&entrance.dog&&station.action.destination==='district';
        travel(station.action.destination, station.id,dog);
        return;
      }
      current = station;
      cafeChoice=null;
      cafeTopicsOpen=false;
      ingredient = null;
      panel.hidden = false;
      panel.dataset.station = station.id;
      if (station.action.kind === 'fridge' || station.action.kind === 'cupboard') getWorld().openStorage(station.id);
      draw();
    },
    refresh(next: GameState, nextRole: CharacterId) {
      if (location !== next.world.places[nextRole] || role !== nextRole) {
        const onward=role===nextRole&&next.world.places[nextRole]==='district'?entrance?.onward:undefined;
        entrance=null;
        if (location === 'market') { cart.clear(); showCart(); }
        location = next.world.places[nextRole];
        role = nextRole;
        close(); closeMap();
        if(onward&&onward!==location)queueMicrotask(()=>go(onward));
      }
      if (pending !== null && next.world.sequence[role] > pending) {
        if (current?.action.kind === 'checkout') { cart.clear(); showCart(); }
        pending = null;
      }
      state = next;
      draw();
    },
    reject() { entrance=null; pending = null; draw(); },
    reset() { entrance=null; cart.clear(); pending = null; showCart(); close(); closeMap(); },
  };
}
