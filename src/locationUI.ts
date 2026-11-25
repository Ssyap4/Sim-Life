import {PET_TOYS,toyProduct,toyOwned} from './shared/petToys';
import { PURCHASABLE_FURNITURE } from './shared/furniture';
import { PET_SHOP_FOOD,petFoodProduct,petFoodBenefit,FOOD_REACTIONS } from './shared/petShop';
import {SPEAKER_MODELS,type SpeakerSku} from './shared/speakerCatalog';
import {VACUUM_MODELS,isVacuumSku,type VacuumSku} from './shared/vacuumCatalog';
import { ELECTRONICS, electronicsFor, electronicsBenefit, installedElectronics, type ElectronicsId } from './shared/electronics';
import { qualityLabel } from './shared/foodQuality';
import { JOBS, type JobId } from './shared/jobs';
import { PREVIEW_LOOKS, defaultWardrobe, outfitPrice } from './shared/previewWardrobe';
import { PICNIC_BASKET_PRICE, PICNIC_CAPACITY, picnicPortions, picnicName } from './shared/picnic';
import { CAMP_RECIPES, type CampRecipe, campIngredients } from './shared/park';
import type { LocalActivity } from './shared/locations';
import { CAFE_TALK_TOPICS, PARK_TALK_TOPICS, PICNIC_TALK_TOPICS, contextAvailable } from './shared/socialLife';
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
import {CLINIC_SERVICES,clinicAvailable,humanHealth,healthStatus,medicinePrice,type ClinicAction} from './shared/health';
import {FITNESS_PASSES,FITNESS_BAR,fitnessCareAction,fitnessCareRole,type FitnessBarAction,FITNESS_PROGRAMS,type FitnessProgramId,fitnessExercise,fitnessProfile,fitnessAccess,SAUNA_PRICE,type FitnessPass} from './shared/fitness';
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
  enterWork: (station:string) => boolean, openCareer: () => void, cafeSocial?: (action:string)=>boolean, startWarehouse?: (job:JobId)=>boolean) {
  let state: GameState | null = null;
  let role: CharacterId = 'vlad';
  let location: PlaceId = 'home';
  let current: Station | null = null;
  let ingredient: IngredientId | null = null;
  let pending: number | null = null;
  let cafeChoice: CafeItem | null = null;
  let cafeTopicsOpen=false;
  let entrance: { station: string; dog: boolean; onward?: PlaceId } | null = null;
  const clothesCart=new Set<string>();
  let fittingLook:string|null=null;
  let fittingAngle=0;
  let fittingIndex=0;
  const cart = new Map<string, number>();
  const list = (): BasketLine[] => [...cart].map(([id, quantity]) => ({ id, quantity }));
  const showCart = () => getWorld().setCart(list().reduce((count, line) => count + line.quantity, 0));

  function close() {
    if(current?.action.kind==='fitting'){getWorld()?.fittingCamera(null);panel.classList.remove('clothes-fitting-panel');document.querySelector('#app')?.classList.remove('fitting-open');}
    fittingLook=null;
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
    if((state?.world.carDriver===role||location==='fitness')&&destination!=='home')return false;
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
      if (isCareerPlace(id)||(id==='fitness'||id==='clinic')&&location!==id) continue;
      const here=location===id;
      const entry = button('', () => go(id), here || !!state.activeShifts[role] || Boolean(state.careers.residents[role].shift) || ((state.world.carDriver===role||location==='fitness')&&id!=='home'));
      entry.dataset.place = id;
      entry.append(element('strong', '', destination.icon + ' ' + destination.name),
        element('small', '', here ? 'Вы здесь' : (state.world.carDriver===role||location==='fitness')&&id==='home'?'Вернуться домой':destination.detail));
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

  let electronicsCart:ElectronicsId|undefined;
  let vacuumCart:VacuumSku|undefined;
  let speakerCart:SpeakerSku|undefined;
  let petCart:string|undefined;
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
    const local = (label: string, action: LocalActivity) =>
      button(label, () => { if (send({ type: 'local_activity', station: station.id, action })) close(); });
    if(kind==='car'){
      options.append(element('small','','Семейный автомобиль · поездка туда и обратно'));
      if(place.world.carDriver)options.append(element('small','','Машина сейчас в поездке'));
      else {options.append(button('🏋️ В PULSE вместе',()=>{if(send({type:'fitness_trip'}))close();}));for(const destination of ['market','cafe','park','clothing','electronics','petshop','industrial','fitness','clinic'] as const)options.append(button('🚗 '+PLACES[destination].name,()=>{
        if(send({type:'car_travel',place:destination}))close();
      }));}
    } else if(station.action.kind==='clinic'){
      options.append(element('small','',healthStatus(place,role)));
      if(station.action.facility==='reception'){
        const booking=humanHealth(place,role).booking;
        options.append(element('small','',booking!==undefined&&booking>=now?'Запись сохранена. Пройдите к терапевту.':'Приём доступен без записи. Запись — в телефоне.'));
      }
      for(const [key,service] of Object.entries(CLINIC_SERVICES)){
        const a=key as ClinicAction;if(service.station!==station.id)continue;
        const price=a==='clinicMedicine'?medicinePrice(place,role):service.price;
        options.append(button(service.name+' · '+formatRub(price),()=>{if(send({type:'local_activity',station:station.id,action:a}))close();},!clinicAvailable(place,role,a)||place.money<price));
      }
    } else if(station.action.kind==='fitness'){
      if(station.action.facility==='reception'){
        options.append(element('small','',fitnessAccess(place,role)?'Абонемент действует':'Выбери билет или абонемент'));
        for(const pass of Object.keys(FITNESS_PASSES) as FitnessPass[]){const p=FITNESS_PASSES[pass];options.append(button(p.name+' · '+formatRub(p.price),()=>send({type:'fitness_pass',pass}),place.money<p.price||pass==='single'&&(fitnessAccess(place,role)||!!fitnessProfile(place,role).ticket)));}
        options.append(element('strong','','Программы тренировок'));
        for(const id of Object.keys(FITNESS_PROGRAMS) as FitnessProgramId[]){const p=FITNESS_PROGRAMS[id];options.append(button(p.name+' · '+p.stations.length+' упр.',()=>{if(send({type:'fitness_program',program:id}))close();},!fitnessAccess(place,role)));}
      }else if(station.action.facility==='sauna'){
        options.append(element('small','','20 игровых минут · восстановление и комфорт'),local('Посетить сауну · '+formatRub(SAUNA_PRICE),'fitnessSauna'));
      }else if(station.action.facility==='bar'){
        for(const [id,item] of Object.entries(FITNESS_BAR))options.append(local(item.name+' · '+formatRub(item.price),id as FitnessBarAction));
      }else if(fitnessCareAction(station.action.facility)){
        const a=fitnessCareAction(station.action.facility)!;
        if(fitnessCareRole(station.action.facility)!==role)options.append(element('small','','Выбери свою санитарную зону'));
        else options.append(local(a==='fitnessShower'?'Принять душ':a==='fitnessToilet'?'Воспользоваться туалетом':'Отдохнуть на скамье',a));
      }else{
        const exercise=fitnessExercise(station.action.facility);
        if(exercise)options.append(element('small','',exercise.minutes+' игровых минут · усталость +'+exercise.fatigue+' · текущая '+Math.round(fitnessProfile(place,role).fatigue)+'%'),local(exercise.name,'fitnessTrain'));
        else options.append(element('small','',station.name));
      }
    } else if(station.action.kind==='warehouse'){
      const id=station.action.job,job=JOBS[id];
      options.append(element('strong','',job.name),element('small','','Смена '+job.hoursMin+'–'+job.hoursMax+' ч. · '+formatRub(job.payMin)+'–'+formatRub(job.payMax)),element('p','',job.description));
      options.append(button('Начать смену',()=>{if(startWarehouse?.(id))close();},!startWarehouse||!!place.activeShifts[role]||place.shiftDays[role]===place.clock.day||place.characters[role].energy<25||place.characters[role].hunger<20));
    } else if(station.action.kind==='pet-food-display'){
      const {pet,form}=station.action;
      for(const p of PET_SHOP_FOOD.filter(p=>p.pet===pet&&p.id.includes('-'+form+'-'))){
        const pref=place.pets[pet].foodPreferences?.[p.id];
        options.append(element('strong','',p.name+' · '+formatRub(p.price)),element('small','',petFoodBenefit(p)+' · '+(pref===undefined?'Вкус ещё неизвестен':FOOD_REACTIONS[pref])),button(petCart===p.id?'В корзине ✓':'Выбрать',()=>{petCart=petCart===p.id?undefined:p.id;draw();}));
      }
    } else if(kind==='pet-furniture-display'){
      for(const p of PURCHASABLE_FURNITURE.filter(p=>p.category==='pets')){options.append(element('strong','',p.name+' · '+formatRub(p.price)),element('small','',p.description),button(petCart===p.id?'В корзине ✓':'Выбрать',()=>{petCart=petCart===p.id?undefined:p.id;draw();}));}
      for(const p of PET_TOYS){const owned=toyOwned(place.pets[p.pet],p.id);options.append(element('strong','',(p.pet==='simba'?'🐈 ':'🐕 ')+p.name+' · '+formatRub(p.price)),element('small','',p.description),button(owned?'Уже дома':petCart===p.id?'В корзине ✓':'Выбрать',()=>{petCart=petCart===p.id?undefined:p.id;draw();},owned));}
    } else if(kind==='pet-checkout'){
      const p=petFoodProduct(petCart),f=PURCHASABLE_FURNITURE.find(i=>i.category==='pets'&&i.id===petCart);
      const toy=toyProduct(petCart);
      if(toy)options.append(element('strong','',toy.name),element('small','',toy.description),button('Купить · '+formatRub(toy.price),()=>{if(send({type:'pet_toy_buy',product:toy.id})){petCart=undefined;close();}},place.money<toy.price||toyOwned(place.pets[toy.pet],toy.id)),button('Отмена',()=>{petCart=undefined;draw();}));
      else if(f)options.append(element('strong','',f.name),element('small','','После покупки предмет будет в домашнем инвентаре.'),button('Купить · '+formatRub(f.price),()=>{if(send({type:'pet_furniture_buy',sku:f.id})){petCart=undefined;close();}},place.money<f.price),button('Отмена',()=>{petCart=undefined;draw();}));
      else if(!p)options.append(element('small','','Выбери товар на витрине.'));
      else options.append(element('strong','',p.name),element('small','',petFoodBenefit(p)),button('Купить · '+formatRub(p.price),()=>{if(send({type:'pet_food_buy',product:p.id})){petCart=undefined;close();}},place.money<p.price||place.petFood[p.pet]+p.refills>50),button('Отмена',()=>{petCart=undefined;draw();}));
    } else if(station.action.kind==='speaker-display'){
      for(const sku of Object.keys(SPEAKER_MODELS) as SpeakerSku[]){
        const m=SPEAKER_MODELS[sku];options.append(element('strong','',m.name+' · '+formatRub(m.price)),element('small','',m.assistant+' · Музыка и домашние команды'),button(speakerCart===sku?'В корзине ✓':'Выбрать',()=>{speakerCart=speakerCart===sku?undefined:sku;electronicsCart=undefined;vacuumCart=undefined;draw();}));
      }
    } else if(station.action.kind==='vacuum-display'){
      const owned=[...place.furnishing.placed,...place.furnishing.stored,...place.furnishing.orders].some(p=>isVacuumSku(p.sku));
      for(const sku of Object.keys(VACUUM_MODELS) as VacuumSku[]){
        const m=VACUUM_MODELS[sku];options.append(element('strong','',m.name+' · '+formatRub(m.price)),element('small','',m.spec+' · чистота до '+m.clean+'%'),button(owned?'Уже есть робот':vacuumCart===sku?'В корзине ✓':'Выбрать',()=>{vacuumCart=vacuumCart===sku?undefined:sku;electronicsCart=undefined;speakerCart=undefined;draw();},owned));
      }
    } else if(station.action.kind==='electronics-display'){
      const category=station.action.category;const current=installedElectronics(place,role,category);
      options.append(element('small','','Сейчас: '+ELECTRONICS[current].name),element('small','','Выбери модель, затем оплати на кассе. Новая техника заменяет старую без возврата денег.'));
      for(const id of electronicsFor(category)){const m=ELECTRONICS[id];options.append(element('strong','',m.name+' · '+formatRub(m.price)),element('small','',m.spec+' · '+electronicsBenefit(m)),button(current===id?'Установлено':electronicsCart===id?'В корзине ✓':'Выбрать',()=>{electronicsCart=electronicsCart===id?undefined:id;vacuumCart=undefined;speakerCart=undefined;draw();},current===id));}
    } else if(kind==='electronics-checkout'){
      if(speakerCart){
        const sku=speakerCart,m=SPEAKER_MODELS[sku];options.append(element('strong','',m.name+' · '+formatRub(m.price)),element('small','','После покупки размести колонку из склада мебели.'),button('Купить · '+formatRub(m.price),()=>{if(send({type:'speaker_buy',sku})){speakerCart=undefined;close();}},place.money<m.price),button('Отмена',()=>{speakerCart=undefined;draw();}));
      } else if(vacuumCart){
        const sku=vacuumCart,m=VACUUM_MODELS[sku];options.append(element('strong','',m.name+' · '+formatRub(m.price)),element('small','','После покупки установи станцию из склада мебели.'),button('Купить · '+formatRub(m.price),()=>{if(send({type:'vacuum_buy',sku})){vacuumCart=undefined;close();}},place.money<m.price),button('Отмена',()=>{vacuumCart=undefined;draw();}));
      } else if(!electronicsCart||installedElectronics(place,role,ELECTRONICS[electronicsCart].kind)===electronicsCart)options.append(element('small','','Выбери модель на витрине.'));
      else{const id=electronicsCart,m=ELECTRONICS[id];options.append(element('strong','',m.name+' · '+formatRub(m.price)),element('small','',m.spec+' · '+electronicsBenefit(m)),button('Купить и заменить · '+formatRub(m.price),()=>send({type:'electronics_buy',model:id}),place.money<m.price),button('Отмена',()=>{electronicsCart=undefined;draw();}));}
    } else if(kind==='wardrobe'||kind==='clothes-rack'||kind==='fitting'||kind==='clothes-checkout'){
      const personal=(place.world.wardrobe??defaultWardrobe())[role];
      const catalog=PREVIEW_LOOKS[role];
      if(kind==='wardrobe'){
        for(const [look,label] of catalog.filter(([id])=>personal.owned.includes(id)))
          options.append(button(label+(personal.worn===look?' · На тебе':''),()=>send({type:'clothing_wear',look}),personal.worn===look));
      }else if(kind==='clothes-rack'){
        if(station.id!=='clothes-'+role)options.append(element('small','','Выбери свой отдел одежды.'));
        else for(const [look,label] of catalog.filter(([id])=>id!=='signature')){
          const owned=personal.owned.includes(look);
          options.append(button(label+' · '+(owned?'Куплено':clothesCart.has(look)?'В корзине ✓':formatRub(outfitPrice(look))),()=>{
            if(clothesCart.has(look))clothesCart.delete(look);else clothesCart.add(look);draw();
          },owned));
        }
        options.append(element('small','','Примерь комплект в примерочной, оплати на кассе.'));
      }else if(kind==='fitting'){
        const looks=catalog.filter(([id])=>id!=='signature');
        const [look,label]=looks[fittingIndex%looks.length];
        const pick=(index:number)=>{fittingIndex=(index+looks.length)%looks.length;fittingLook=looks[fittingIndex][0];getWorld().fittingCamera(role,fittingAngle,fittingLook);draw();};
        const nav=element('div','fitting-navigation');
        nav.append(button('‹',()=>pick(fittingIndex-1)),element('strong','', (fittingIndex+1)+' / '+looks.length),button('›',()=>pick(fittingIndex+1)));
        const rotate=element('div','fitting-navigation');
        rotate.append(button('↶',()=>{fittingAngle-=Math.PI/2;getWorld().fittingCamera(role,fittingAngle);}),element('span','','Повернуть'),button('↷',()=>{fittingAngle+=Math.PI/2;getWorld().fittingCamera(role,fittingAngle);}));
        options.append(element('strong','',label),nav,rotate,
          button(personal.owned.includes(look)?'Уже в гардеробе':clothesCart.has(look)?'В корзине ✓':'В корзину · '+formatRub(outfitPrice(look)),()=>{if(clothesCart.has(look))clothesCart.delete(look);else clothesCart.add(look);draw();},personal.owned.includes(look)));
      }else{
        for(const [look,label] of catalog.filter(([id])=>clothesCart.has(id)&&!personal.owned.includes(id))){
          options.append(button('Купить '+label+' · '+formatRub(outfitPrice(look)),()=>send({type:'clothing_buy',look}),place.money<outfitPrice(look)));
          options.append(button('Убрать из корзины',()=>{clothesCart.delete(look);draw();}));
        }
        if(![...clothesCart].some(id=>!personal.owned.includes(id)))options.append(element('small','','Корзина пуста. Выбери комплект на стойке или в примерочной.'));
      }
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
            if (current) { current.portions += batch.portions; if(batch.expiresAt<current.expiresAt){current.expiresAt=batch.expiresAt;current.quality=batch.quality;} }
            else grouped.set(key, { ...batch });
          }
          return [...grouped.values()].sort((a,b) => a.expiresAt - b.expiresAt);
        };
        const fridgeReady = groups('fridge');
        if(place.world.picnic){
          const mine=picnicPortions(place,role),count=picnicPortions(place,'vlad').length+picnicPortions(place,'alina').length;
          options.append(element('strong','','🧺 Корзина для пикника · '+count+'/'+PICNIC_CAPACITY));
          options.append(element('small','','Твои порции хранятся отдельно. Еда вне холодильника портится быстрее.'));
          for(const food of mine){if(food.kind==='campfire'){options.append(element('small','',picnicName(food)));continue;}const kind=food.kind;options.append(button('Вернуть: '+picnicName(food),()=>send({type:'picnic_unpack',kind,item:food.item})));}
          const kit=place.world.campKit?.[role];
          options.append(element('strong','','Припасы для костра'),button('Уголь + розжиг · '+(kit?.fuel??0),()=>send({type:'camp_pack',item:'fuel'}),place.pantry.charcoal<1||place.pantry.lighterFluid<1||(kit?.fuel??0)>=3));
          for(const [id,meal] of Object.entries(CAMP_RECIPES)){const item=id as CampRecipe;const ingredients=campIngredients(item);options.append(element('small','',ingredients.map(([k,n])=>GROCERIES[k].name.split(' · ')[0]+' '+place.pantry[k]+'/'+n).join(' · ')));options.append(button('Собрать: '+meal.name+' · '+(kit?.recipes[item]??0),()=>send({type:'camp_pack',item}),ingredients.some(([k,n])=>place.pantry[k]<n)||(kit?.recipes[item]??0)>=3));}
          for(const batch of fridgeReady)options.append(button('В корзину: '+readyFoodName(batch.kind,batch.item),()=>send({type:'picnic_pack',kind:batch.kind,item:batch.item}),count>=PICNIC_CAPACITY));
        }
        if (!fridgeReady.length) options.append(element('small', '', 'Готовых блюд в холодильнике пока нет.'));
        for (const batch of fridgeReady) {
          const name = readyFoodName(batch.kind, batch.item)+(batch.kind==="meal"?" · Следующая: "+qualityLabel(batch.quality):"");
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
            options.append(element('small', '', readyFoodName(batch.kind, batch.item)+(batch.kind==="meal"?" · Следующая: "+qualityLabel(batch.quality):"") + ' · ' +
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
    else if(kind==='swing'||kind==='picnic'){
      const partner=role==='vlad'?'alina':'vlad';const together=place.world.places[partner]==='park'&&!!cafeSocial;
      if(kind==='swing')options.append(local('Покачаться на качелях','swing'));
      else{const food=picnicPortions(place,role)[0];options.append(element('small','',food?'Из корзины: '+picnicName(food):'В твоём отделении корзины нет еды'));if(food)options.append(local('🍽️ Поесть на пикнике · 1,5 мин','picnic'));}
      if(together&&cafeSocial){
        if(cafeTopicsOpen){const topics=kind==='picnic'&&[role,partner].every(r=>picnicPortions(place,r as typeof role).length)?PICNIC_TALK_TOPICS:PARK_TALK_TOPICS;for(const topic of topics.filter(t=>contextAvailable(t,place,role)))options.append(button(topic.title,()=>{if(cafeSocial(topic.id))close();}));options.append(button('Назад',()=>{cafeTopicsOpen=false;draw();}));}
        else{options.append(button(kind==='swing'?'Покачаться вдвоём':'Устроить пикник вдвоём',()=>{if(cafeSocial(kind==='swing'?'parkSwing':'picnic'))close();}));options.append(button('Поговорить ›',()=>{cafeTopicsOpen=true;draw();}));}
      }
    }
    else if(kind==='badminton'){
      if(cafeSocial&&place.world.places[role==='vlad'?'alina':'vlad']==='park')options.append(button('🏸 Играть вдвоём',()=>{if(cafeSocial('parkBadminton'))close();}));else options.append(element('small','','Пригласи второго игрока в парк.'));
    }else if(kind==='campfire'){
      const kit=place.world.campKit?.[role];const lit=(place.world.campLitUntil??0)>now;
      options.append(element('small','',lit?'Костёр горит':'Костёр погашен'));
      if(!lit)options.append(button('Разжечь костёр',()=>{if(send({type:'local_activity',station:station.id,action:'campIgnite'}))close();},!kit?.fuel));
      for(const [id,meal] of Object.entries(CAMP_RECIPES))options.append(button(meal.name+' · 2 порции',()=>{if(send({type:'local_activity',station:station.id,action:id as CampRecipe}))close();},!lit||!kit?.recipes[id as CampRecipe]));
      options.append(element('small','','Возьми уголь, розжиг и продукты в корзину дома. Готовые блюда попадут в корзину.'));
    }
    else if (kind === 'exercise') options.append(local('Сделать лёгкую зарядку', 'exercise'));
    else if (kind === 'dog') {
      const walker = place.world.dogWalker;
      options.append(button(walker === role ? 'Отпустить Верделла домой' : 'Взять Верделла на прогулку',
        () => send({ type: 'dog_leash' }), !!walker && walker !== role));
      if (walker&&place.world.places[walker]==='park')options.append(local('Поиграть с Верделлом','dog'),local('Бросить палочку','dogFetch'),local('Играть в догонялки','dogChase'),local('Поваляться на траве','dogRoll'));if(walker&&(place.world.parkDog?.toilets??0)<2)options.append(local('Дать справить нужду','dogToilet'));
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
      if(station.action.kind==='fitting'){
        panel.classList.add('clothes-fitting-panel');
        fittingAngle=0;fittingIndex=0;
        fittingLook=PREVIEW_LOOKS[role][1][0];
        document.querySelector('#app')?.classList.add('fitting-open');
        getWorld().fittingCamera(role,0,fittingLook);
      }
      if (station.action.kind === 'fridge' || station.action.kind === 'cupboard') getWorld().openStorage(station.id);
      draw();
    },
    refresh(next: GameState, nextRole: CharacterId) {
      if (location !== next.world.places[nextRole] || role !== nextRole) {
        const onward=role===nextRole&&next.world.places[nextRole]==='district'?entrance?.onward:undefined;
        entrance=null;
        if(location==='clothing')clothesCart.clear();if(location==='electronics'){electronicsCart=undefined;vacuumCart=undefined;speakerCart=undefined;}if(location==='petshop')petCart=undefined;
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
    reset() { entrance=null; petCart=undefined; electronicsCart=undefined;vacuumCart=undefined;speakerCart=undefined; clothesCart.clear(); cart.clear(); pending = null; showCart(); close(); closeMap(); },
  };
}
