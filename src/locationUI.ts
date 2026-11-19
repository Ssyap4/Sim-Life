import { CAFE_MENU, PLACES, clockMinutes, type CafeItem, type PlaceId, type Station, type WorldCommand } from './shared/locations';
import { MARKET_PRODUCTS, basketPrice, marketProduct, type BasketLine } from './shared/market';
import { GROCERIES, RECIPES, ingredientList, type IngredientId, type RecipeId } from './shared/food';
import { GROCERY_DETAILS, storageUsage } from './shared/storageSpace';
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
  send: (operation: WorldCommand) => boolean, cook: (recipe: RecipeId) => void, signOut: () => void) {
  let state: GameState | null = null;
  let role: CharacterId = 'vlad';
  let location: PlaceId = 'home';
  let current: Station | null = null;
  let ingredient: IngredientId | null = null;
  let pending: number | null = null;
  const cart = new Map<string, number>();
  const list = (): BasketLine[] => [...cart].map(([id, quantity]) => ({ id, quantity }));
  const showCart = () => getWorld().setCart(list().reduce((count, line) => count + line.quantity, 0));

  function close() {
    if (current?.action.kind === 'fridge' || current?.action.kind === 'cupboard') send({ type: 'close_storage' });
    current = null;
    panel.hidden = true;
    panel.replaceChildren();
    getWorld()?.closeStorage();
  }
  function closeMap() { map.hidden = true; map.replaceChildren(); }
  function travel(destination: PlaceId, via?: string, dog = false) {
    if (send({ type: 'travel', place: destination, via, dog })) { close(); closeMap(); }
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
      const entry = button('', () => travel(id), location === id || !!state.activeShifts[role]);
      entry.dataset.place = id;
      entry.append(element('strong', '', destination.icon + ' ' + destination.name),
        element('small', '', location === id ? 'Вы здесь' : destination.detail));
      grid.append(entry);
    }
    map.append(grid);
    if (location === 'home' && !state.world.dogWalker)
      map.append(button('🐾 В парк с Верделлом', () => travel('park', undefined, true), !!state.activeShifts[role]));
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
    const title = element('div', 'actions-heading', station.name);
    const closeButton = element('button', 'close-actions', '×');
    closeButton.type = 'button';
    closeButton.setAttribute('aria-label', 'Закрыть');
    closeButton.addEventListener('click', close);
    const y = panel.scrollTop;
    panel.replaceChildren(title, closeButton);
    const options = element('div', 'world-station-options');
    const now = clockMinutes(place.clock);
    const kind = station.action.kind;
    const local = (label: string, action: 'rest' | 'exercise' | 'dine' | 'dog' | 'unpack') =>
      button(label, () => { if (send({ type: 'local_activity', station: station.id, action })) close(); });
    if (kind === 'shelf' || kind === 'checkout') {
      const lines = list();
      const summary = element('strong', 'world-cart-total', 'Корзина: ' + lines.reduce((n, line) => n + line.quantity, 0) + ' уп. · ' + formatRub(basketPrice(lines)));
      options.append(summary);
      if (station.action.kind === 'shelf') {
        const { categories } = station.action;
        const products = MARKET_PRODUCTS.filter(p => station.id === 'drinks'
          ? p.stockKey === 'tea' || p.stockKey === 'coffee' : categories.includes(p.category));
        for (const product of products) options.append(productRow(product.id));
        options.append(element('small', '', 'Выбранные товары оплачиваются на кассе.'));
      } else {
        for (const line of lines) options.append(productRow(line.id));
        const sequence = place.world.sequence[role];
        const pay = button(pending === null ? 'Оплатить · ' + formatRub(basketPrice(lines)) : 'Подтверждаем…',
          () => transaction({ type: 'store_pay', lines, sequence }), !lines.length || pending !== null);
        pay.dataset.worldAction = 'pay';
        options.append(pay, button('Очистить корзину', () => { cart.clear(); showCart(); draw(); }, !lines.length || pending !== null));
      }
    } else if (kind === 'fridge' || kind === 'cupboard') {
      const amount = storageUsage(place);
      const capacity = kind === 'fridge' ? amount.fridge + '/36' : amount.cupboard + '/42';
      options.append(element('small', '', 'Занято ячеек: ' + capacity + ' · Выбери ингредиент'));
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
    } else if (kind === 'parcel') {
      if (!place.world.deliveries.length) options.append(element('small', '', 'У двери нет заказов.'));
      for (const order of place.world.deliveries) {
        const row = element('div', 'world-order');
        row.append(element('strong', '', (order.readyAt <= now ? 'У двери' : 'Едет · ' + (order.readyAt - now) + ' мин.') + ' · ' + formatRub(order.cost)),
          element('small', '', order.lines.map(line => marketProduct(line.id)!.name + ' ×' + line.quantity).join(', ')));
        row.append(button('Забрать заказ', () => send({ type: 'delivery_claim', id: order.id }), order.readyAt > now));
        options.append(row);
      }
      if (place.world.bags[role]) options.append(local('Разобрать покупки', 'unpack'));
    } else if (kind === 'terminal' || kind === 'pickup') {
      const order = place.world.cafe[role];
      if (order) {
        options.append(element('strong', '', CAFE_MENU[order.item].name + ' · ' + (order.pickedUp ? 'На подносе' : order.readyAt <= now
          ? 'Готово к выдаче' : 'Готовится · ' + (order.readyAt - now) + ' мин.')));
        if (kind === 'pickup' && !order.pickedUp)
          options.append(button('Забрать заказ', () => send({ type: 'cafe_pickup' }), order.readyAt > now));
      } else if (kind === 'pickup') options.append(element('small', '', 'Сначала сделай заказ у терминала.'));
      else for (const [item, meal] of Object.entries(CAFE_MENU)) {
        const option = button(meal.name + ' · ' + formatRub(meal.price),
          () => transaction({ type: 'cafe_order', item: item as CafeItem, sequence: place.world.sequence[role] }),
          pending !== null || place.money < meal.price);
        option.dataset.menuItem = item;
        options.append(option);
      }
    } else if (kind === 'dine') {
      options.append(local(place.world.cafe[role]?.pickedUp ? 'Сесть и поесть' : 'Сесть и отдохнуть', 'dine'));
    } else if (kind === 'rest') options.append(local('Сесть на скамью', 'rest'));
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
    openMap, closeMap, close,
    visit(station: Station) {
      if (station.action.kind === 'door') { travel(station.action.destination, station.id); return; }
      current = station;
      ingredient = null;
      panel.hidden = false;
      panel.dataset.station = station.id;
      if (station.action.kind === 'fridge' || station.action.kind === 'cupboard') getWorld().openStorage(station.id);
      draw();
    },
    refresh(next: GameState, nextRole: CharacterId) {
      if (location !== next.world.places[nextRole] || role !== nextRole) {
        if (location === 'market') { cart.clear(); showCart(); }
        location = next.world.places[nextRole];
        role = nextRole;
        close(); closeMap();
      }
      if (pending !== null && next.world.sequence[role] > pending) {
        if (current?.action.kind === 'checkout') { cart.clear(); showCart(); }
        pending = null;
      }
      state = next;
      draw();
    },
    reject() { pending = null; draw(); },
    reset() { cart.clear(); pending = null; showCart(); close(); closeMap(); },
  };
}
