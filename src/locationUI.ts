import {LAKE_PASSES,LAKE_TENTS,LAKE_RODS,LAKE_BAIT,LAKE_REST,LAKE_CARE,LAKE_LEISURE,lakeCanSwim,lakeNeedsFish,lakeCampFor,LAKE_FISH,FISH_ACTIONS,fishLabel,freshFish,type LakeFishAction,LAKE_MEALS,LAKE_MEAL_ACTIONS,type LakeMealAction,lakeAccess,type LakePass,type LakeTent,type LakeRod} from './shared/lake';
import {DOG_AGILITY,AGILITY_ACTIONS,agilityReady,agilityConfidence} from './shared/dogAgility';
import {PET_TOYS,toyProduct,toyOwned} from './shared/petToys';
import { PURCHASABLE_FURNITURE } from './shared/furniture';
import { PET_SHOP_FOOD,petFoodProduct,petFoodBenefit,FOOD_REACTIONS } from './shared/petShop';
import {SPEAKER_MODELS,type SpeakerSku} from './shared/speakerCatalog';
import {VACUUM_MODELS,isVacuumSku,type VacuumSku} from './shared/vacuumCatalog';
import { ELECTRONICS, electronicsFor, electronicsBenefit, installedElectronics, type ElectronicsId } from './shared/electronics';
import { qualityLabel } from './shared/foodQuality';
import { JOBS, type JobId } from './shared/jobs';
import { PREVIEW_LOOKS, defaultWardrobe, outfitPrice, contextualLook, OUTFIT_CONTEXTS, OUTFIT_LABELS } from './shared/previewWardrobe';
import { PICNIC_BASKET_PRICE, PICNIC_CAPACITY, picnicPortions, picnicName } from './shared/picnic';
import { CAMP_RECIPES, type CampRecipe, campIngredients } from './shared/park';
import type { LocalActivity } from './shared/locations';
import { CAFE_TALK_TOPICS, LAKE_TALK_TOPICS, lakeTalkStation, PARK_TALK_TOPICS, PICNIC_TALK_TOPICS, contextAvailable } from './shared/socialLife';
import { cafeSeatAt } from './shared/locations';
import {tasteButton,tasteLabel,tastePair,type TasteSubmit} from './foodTasteUI';
import {productTaste,favoriteProduct,favoriteRecipeIngredients} from './shared/tasteShopping';
import {favoriteFood,favoritePriority} from './shared/foodTastes';
import { CAFE_MENU, PLACES, STATIONS, stationById, clockMinutes, type CafeItem, type PlaceId, type Station, type WorldCommand } from './shared/locations';
import { COURIER_NAME } from './shared/courier';
import { districtStation } from './shared/district';
import {CONSOLES,CONSOLE_GAMES,consoleOwned,consoleGames} from './shared/consoleCatalog';
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
import {VENUE_GAMES} from './shared/venue';
import {SPA_PASSES,SPA_ACTIVITIES,SPA_MASSAGE_PRICE,spaDenial} from './shared/spa';
import {BARBER_SERVICES,barberDenial,type BarberAction} from './shared/barber';
import {VET_SERVICES,vetAvailable,petHealth,PET_CONDITIONS,CLINIC_SERVICES,clinicAvailable,humanHealth,healthStatus,medicinePrice,type ClinicAction} from './shared/health';
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
  enterWork: (station:string) => boolean, openCareer: () => void, cafeSocial?: (action:string)=>boolean, startWarehouse?: (job:JobId)=>boolean,favorite?:TasteSubmit) {
  let state: GameState | null = null;
  let role: CharacterId = 'vlad';
  let location: PlaceId = 'home';
  let current: Station | null = null;
  let ingredient: IngredientId | null = null;
  let storagePage:'ready'|'ingredients'|'picnic'='ready';
  let pending: number | null = null;
  let cafeChoice: CafeItem | null = null;
  let cafeTopicsOpen=false;
  let carPage:'destinations'|'lake'='destinations';
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
    carPage='destinations';
    panel.hidden = true;
    panel.replaceChildren();
    getWorld()?.closeStorage();
  }
  function closeMap() { map.hidden = true; map.replaceChildren(); }
  function travel(destination: PlaceId, via?: string, dog = false) {
    if (send({ type: 'travel', place: destination, via, dog })) { close(); closeMap(); }
  }
  function go(destination:PlaceId,dog=false):boolean {
    if((state?.world.carDriver===role||(location==='fitness'||location==='clinic'||location==='barber'||location==='spa'||location==='venue'||location==='lake'))&&destination!=='home')return false;
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
      if (isCareerPlace(id)||(id==='fitness'||id==='clinic'||id==='barber'||id==='spa'||id==='venue'||id==='lake')&&location!==id) continue;
      const here=location===id;
      const entry = button('', () => go(id), here || !!state.activeShifts[role] || Boolean(state.careers.residents[role].shift) || ((state.world.carDriver===role||(location==='fitness'||location==='clinic'||location==='barber'||location==='spa'||location==='venue'||location==='lake'))&&id!=='home'));
      entry.dataset.place = id;
      entry.append(element('strong', '', destination.icon + ' ' + destination.name),
        element('small', '', here ? 'Вы здесь' : (state.world.carDriver===role||(location==='fitness'||location==='clinic'||location==='barber'||location==='spa'||location==='venue'||location==='lake'))&&id==='home'?'Вернуться домой':destination.detail));
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
    const t=productTaste(product);
    const label = element('span', '', product.emoji + ' ' + product.name + ' · ' + formatRub(product.price)+(state&&t?tasteLabel(state,role,t.kind,t.item):''));
    const control = element('span', 'world-stepper');
    const down = button('−', () => change(id, -1), count === 0 || pending !== null);
    down.setAttribute('aria-label', 'Убрать ' + product.name);
    const up = button('+', () => change(id, 1), count >= 10 || pending !== null);
    up.setAttribute('aria-label', 'Добавить ' + product.name);
    up.dataset.product = id;
    control.append(down, element('strong', '', String(count)), up);
    row.append(label, control);
    if(state&&t&&favorite){const heart=tasteButton(state,role,t.kind,t.item,favorite);heart.classList.add('world-taste-heart');row.append(heart);}
    return row;
  }

  let electronicsCart:ElectronicsId|undefined;
  let vacuumCart:VacuumSku|undefined;
  let consoleCart:import('./shared/consoleCatalog').ConsoleSku|undefined;
  let speakerCart:SpeakerSku|undefined;
  let petCart:string|undefined;
  function draw() {
    if (!state || !current || panel.hidden) return;
    const station = current;
    const place = state;
    const header = element('div', 'actions-head');
    if(station.action.kind==='car'&&place.world.carDriver)carPage='destinations';
    const title = element('strong', '', station.action.kind==='car'&&carPage==='lake'?PLACES.lake.name:station.name);
    const closeButton = element('button', 'close-actions', '×');
    closeButton.type = 'button';
    closeButton.setAttribute('aria-label', 'Закрыть');
    closeButton.addEventListener('click', close);
    const y = panel.scrollTop;
    if(station.action.kind==='car'&&carPage==='lake'){
      const back=button('← Назад',()=>{carPage='destinations';draw();panel.scrollTop=0;});
      back.classList.add('car-menu-back');back.dataset.carPage='destinations';header.append(back);
    }
    header.append(title, closeButton);
    panel.replaceChildren(header);
    const options = element('div', 'world-station-options');
    const now = clockMinutes(place.clock);
    const kind = station.action.kind;
    const local = (label: string, action: LocalActivity) =>
      button(label, () => { if (send({ type: 'local_activity', station: station.id, action })) close(); });
    if(kind==='car'){
      options.classList.add('car-destination-options');
      if(place.world.carDriver){
        options.append(element('small','','Машина сейчас в поездке'));
      }else if(carPage==='lake'){
        options.classList.add('car-lake-options');
        options.append(element('small','car-menu-note','Выбери длительность и состав поездки. Верделл едет без доплаты.'));
        for(const [id,p] of Object.entries(LAKE_PASSES)){
          const pass=id as LakePass;
          const group=element('section','car-lake-pass');
          group.dataset.lakePass=pass;
          group.append(element('strong','car-menu-heading',p.name));
          const choices=element('div','car-lake-choices');
          for(const [pair,dog] of [[false,false],[true,false],[false,true],[true,true]] as const){
            const cost=pair?p.pair:p.single;
            const entry=button('',()=>{
              const command:WorldCommand=pair?{type:'lake_trip',pass,...(dog?{dog:true}:{})}:{type:'car_travel',place:'lake',pass,...(dog?{dog:true}:{})};
              if(send(command))close();
            },place.money<cost||(dog&&!!place.world.dogWalker));
            entry.dataset.lakeParty=pair?'pair':'single';
            entry.dataset.lakeDog=String(dog);
            entry.append(element('strong','',pair?'Вдвоём':'Один'),element('small','',(dog?'🐾 С Верделлом · ':'')+formatRub(cost)));
            choices.append(entry);
          }
          group.append(choices);options.append(group);
        }
      }else{
        options.append(element('small','car-menu-note','Куда поедем?'));
        const heading=(label:string)=>options.append(element('strong','car-menu-heading',label));
        const destinationButton=(destination:Extract<WorldCommand,{type:'car_travel'}>['place'])=>button(PLACES[destination].icon+' '+PLACES[destination].name,()=>{
          if(send({type:'car_travel',place:destination}))close();
        });
        heading('Город');
        for(const destination of ['market','cafe','park','clothing','electronics','petshop','industrial'] as const)options.append(destinationButton(destination));
        heading('Отдых');
        const lake=button('🏕️ Лесное озеро ›',()=>{carPage='lake';draw();panel.scrollTop=0;});
        lake.dataset.carPage='lake';options.append(lake);
        options.append(button('🎳 PLAY ARENA вдвоём',()=>{if(send({type:'venue_trip'}))close();}));
        options.append(button('♨️ SPA · один · '+formatRub(SPA_PASSES.single.price),()=>{if(send({type:'car_travel',place:'spa'}))close();},place.money<SPA_PASSES.single.price));
        for(const pass of ['pair','package'] as const)options.append(button(SPA_PASSES[pass].name+' · '+formatRub(SPA_PASSES[pass].price),()=>{if(send({type:'spa_trip',pass}))close();},place.money<SPA_PASSES[pass].price));
        heading('Здоровье и уход');
        options.append(destinationButton('fitness'),button('🏋️ PULSE вдвоём',()=>{if(send({type:'fitness_trip'}))close();}),destinationButton('clinic'),button('🏥 В клинику вместе',()=>{if(send({type:'clinic_trip'}))close();}));
        if(role==='vlad')options.append(destinationButton('barber'));
        heading('С питомцами');
        for(const pet of ['verdell','simba'] as const)options.append(button('🐾 В «Лапа и хвост» · '+(pet==='verdell'?'Верделл':'Симба'),()=>{if(send({type:'car_travel',place:'work-clinic',pet}))close();},pet==='verdell'&&!!place.world.dogWalker));
      }
    } else if(station.action.kind==='career'&&place.world.vetVisit?.owner===role){
      const pet=place.world.vetVisit.pet,h=petHealth(place,pet);
      options.append(element('small','',(pet==='verdell'?'Верделл':'Симба')+' · '+(h.illness?h.illness.diagnosed?PET_CONDITIONS[h.illness.id].name:'Недомогание':'Здоров')));
      for(const a of ['vetExam','vetTreatment','vetMedicine'] as const){const s=VET_SERVICES[a];if(s.station===station.id)options.append(button(s.name+' · '+formatRub(s.price),()=>{if(send({type:'local_activity',action:a,station:station.id}))close();},!vetAvailable(place,pet,a)||place.money<s.price));}
      if(station.id!=='service'&&station.id!=='records')options.append(element('small','','Осмотр и лечение — у смотрового стола, лекарства — у стойки записей.'));
    } else if(station.action.kind==='venue'){
      const id=station.action.facility;
      if(id==='reception')options.append(element('small','','Оплата каждой партии только после завершения. Выберите игровую зону.'));
      else {const g=VENUE_GAMES[id];options.append(element('small','',g.name+' · '+g.seconds+' сек. · '+formatRub(g.price)+' за двоих'));if(cafeSocial){options.append(button('Наблюдать · автоигра',()=>{if(cafeSocial(id))close();},place.money<g.price||place.world.places[role==='vlad'?'alina':'vlad']!=='venue'));if(id==='venueBowling'||id==='venueHockey'||id==='venueBilliards'||id==='venueJenga')options.append(button(id==='venueBowling'?'🎳 Играть вручную · 5 фреймов':id==='venueHockey'?'🏒 Играть вручную · до 7 голов':id==='venueBilliards'?'🎱 Играть вручную · 9 шаров':'🧱 Играть вручную · башня',()=>{if(cafeSocial(id+'Manual'))close();},place.money<g.price||place.world.places[role==='vlad'?'alina':'vlad']!=='venue'));}}
      const manualHistory=id==='venueBowling'?place.bowlingHistory:id==='venueHockey'?place.hockeyHistory:id==='venueBilliards'?place.poolHistory:id==='venueJenga'?place.jengaHistory:undefined;
      if(manualHistory?.length){const h=manualHistory;options.append(element('strong','','Ручные партии · Влад '+h.filter(r=>r.vlad>r.alina).length+' : '+h.filter(r=>r.alina>r.vlad).length+' Алина'));for(const r of h.slice(0,5))options.append(element('small','','Влад '+r.vlad+' : '+r.alina+' Алина'));}
    } else if(station.action.kind==='lake'){
      const visit=place.world.lake?.[role],access=lakeAccess(place,role);
      options.append(element('small','',access?'Билет действует ещё '+Math.ceil((visit!.until-now)/60)+' ч.':'Билет закончился'));
      if(visit?.catch){const fish=visit.catch;options.append(element('strong','','Улов: '+fishLabel(fish)+' · '+['Обычная','Крупная','Редкая'][LAKE_FISH[fish.species].tier]));options.append(button('Забрать улов',()=>{if(send({type:'lake_catch',keep:true}))close();},freshFish(place).length>=12||fish.expires<=now));options.append(button('Отпустить рыбу',()=>{if(send({type:'lake_catch',keep:false}))close();}));if(visit.rod&&station.action.facility==='fish'&&access){const again=Object.keys(FISH_ACTIONS).find(k=>FISH_ACTIONS[k as LakeFishAction]===visit.rod) as LakeFishAction;options.append(button('Забрать и продолжить',()=>{if(send({type:'lake_catch',keep:true,again,station:station.id}))close();},freshFish(place).length>=12||fish.expires<=now),button('Отпустить и продолжить',()=>{if(send({type:'lake_catch',keep:false,again,station:station.id}))close();}));}}
      if(station.action.facility==='rental'){
        for(const [id,p] of Object.entries(LAKE_TENTS))options.append(button(p.name+' · '+formatRub(p.price),()=>{if(send({type:'lake_rent',category:'tent',item:id as LakeTent}))close();},!access||place.money<p.price||Object.values(place.world.lake??{}).some(v=>!!v.tent)));
        options.append(button(visit?.bait?'Прикормка активна · +8 п.п. к редкой рыбе':'Прикормка на весь визит · '+formatRub(LAKE_BAIT.price),()=>{if(send({type:'lake_buy_bait'}))close();},!access||!!visit?.bait||place.money<LAKE_BAIT.price));
        for(const [id,p] of Object.entries(LAKE_RODS))options.append(button(p.name+' · '+formatRub(p.price),()=>{if(send({type:'lake_rent',category:'rod',item:id as LakeRod}))close();},!access||place.money<p.price||!!visit?.rod));
      }else if(station.action.facility==='pitch'){options.append(button('Выбрать площадку',()=>{if(send({type:'lake_pitch',station:station.id}))close();},!access||!visit?.tent||!!visit?.pitch||Object.values(place.world.lake??{}).some(v=>v.pitch===station.id)));const camp=lakeCampFor(place,station.id);if(camp?.tent){options.append(element('strong','',LAKE_TENTS[camp.tent].name));for(const action of ['lakeNap','lakeSleep'] as const)options.append(button(LAKE_REST[action].name+' · '+LAKE_REST[action].seconds+' сек.',()=>{if(send({type:'local_activity',station:station.id,action}))close();},!access||action==='lakeSleep'&&(visit?.pass==='day'||camp.pass==='day')));}}
      else if(station.action.facility==='fire'){
        const camp=Object.values(place.world.lake??{}).find(v=>v.pitch===station.id.replace('lake-fire-','lake-pitch-'));
        if(place.world.dogWalker&&place.world.places[place.world.dogWalker]==='lake'&&camp){options.append(button('🐾 Дать Верделлу лакомство',()=>{if(send({type:'lake_dog_treat',station:station.id,fish:false}))close();},!access),button('🐟 Угостить Верделла рыбкой',()=>{if(send({type:'lake_dog_treat',station:station.id,fish:true}))close();},!access||!camp.meals?.fish));}
        options.append(button('Посидеть у костра · 45 сек.',()=>{if(send({type:'local_activity',station:station.id,action:'lakeFireRest'}))close();},!access||!camp?.fire));
        if(cafeSocial){const ready=lakeTalkStation(place,role)?.id===station.id;if(cafeTopicsOpen&&ready){for(const topic of LAKE_TALK_TOPICS.filter(t=>contextAvailable(t,place,role)))options.append(button(topic.title,()=>{if(cafeSocial(topic.id))close();}));options.append(button('Назад к костру',()=>{cafeTopicsOpen=false;draw();}));}else options.append(button('Поговорить у костра ›',()=>{cafeTopicsOpen=true;draw();},!ready));}
        for(const [id,p] of Object.entries(LAKE_MEAL_ACTIONS)){const action=id as LakeMealAction,d=LAKE_MEALS[p.meal],count=camp?.meals?.[p.meal]??0;options.append(button((p.cook?'Приготовить: ':'Съесть: ')+d.name+(p.cook?' · '+formatRub(d.price)+' / 2 порции':' · '+count+' порц.'),()=>{if(send({type:'local_activity',station:station.id,action}))close();},!access||!camp||(p.cook?!camp.fire||count>2||place.money<d.price||(lakeNeedsFish(p.meal)&&freshFish(place).length===0):count<1)));}
        options.append(button(camp?.fire?'Потушить костёр':'Разжечь костёр',()=>{if(send({type:'lake_fire',station:station.id,lit:!camp?.fire}))close();},!access||!camp));
      }else if(['rest','swim','dog'].includes(station.action.facility)){
        for(const [key,d] of Object.entries(LAKE_LEISURE)){if(d.facility!==station.action.facility)continue;const action=key as keyof typeof LAKE_LEISURE;options.append(button(d.name+' · '+d.seconds+' сек.',()=>{if(send({type:'local_activity',station:station.id,action}))close();},!access||action==='lakeSwim'&&(!lakeCanSwim(place)||place.characters[role].energy<20)||d.facility==='dog'&&(!place.world.dogWalker||place.world.places[place.world.dogWalker]!=='lake')));}
        if(station.action.facility==='swim'&&!lakeCanSwim(place))options.append(element('small','','Купание открыто в ясную или облачную погоду от +20°C'));
      }else if(station.action.facility==='toilet'||station.action.facility==='wash'){const action=station.action.facility==='toilet'?'lakeToilet':'lakeWash';options.append(button(LAKE_CARE[action].name+' · бесплатно',()=>{if(send({type:'local_activity',station:station.id,action}))close();},!access));}else if(station.action.facility==='fish'){const rod=visit?.rod;options.append(element('small','',rod?LAKE_RODS[rod].name+' · '+LAKE_RODS[rod].seconds+' сек.':'Сначала арендуй снасть в прокате'));if(rod){const action=Object.keys(FISH_ACTIONS).find(k=>FISH_ACTIONS[k as LakeFishAction]===rod) as LakeFishAction;options.append(button('Забросить снасть',()=>{if(send({type:'local_activity',station:station.id,action}))close();},!access||!!visit.catch));}options.append(element('small','','Улов в термосумке: '+freshFish(place).length+'/12 · рекорд '+((place.world.fishing?.record[role]??0)/1000).toFixed(2)+' кг'));}
    } else if(station.action.kind==='spa'){
 const a=station.action.facility,visit=place.world.spa?.[role];
 if(a==='reception')options.append(element('small','',visit?SPA_PASSES[visit.pass].name+' · оплачено':'Посещение не оплачено'));
 else if((a==='spaLocker'||a==='spaShower')&&!station.id.endsWith('-'+role[0]))options.append(element('small','','Выбери свою раздевалку или душ'));
 else options.append(button((a==='spaLocker'?(visit?.changed===false?'Надеть одежду для SPA':'Надеть свою одежду'):SPA_ACTIVITIES[a].name)+(a==='spaMassage'&&visit?.pass!=='package'?' · '+formatRub(SPA_MASSAGE_PRICE):''),()=>{if(send({type:'local_activity',station:station.id,action:a}))close();},!!spaDenial(place,role,a)));
    } else if(station.action.kind==='barber'){
      if(station.action.facility==='reception')options.append(element('small','','BRO · услуги у кресла. Можно без записи.'));
      else for(const [id,d] of Object.entries(BARBER_SERVICES)){const action=id as BarberAction;options.append(button(d.name+' · '+formatRub(d.price)+' · '+d.hours+' ч.',()=>{if(send({type:'local_activity',station:station.id,action}))close();},!!barberDenial(place,role,action)));}
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
    } else if(station.action.kind==='console-display'){
      const sku=station.action.sku,m=CONSOLES[sku],owned=consoleOwned(place,sku);
      options.append(element('strong','',m.name+' · '+formatRub(m.price)),element('small','',m.description),button(owned?'Уже есть':consoleCart===sku?'В корзине ✓':'Выбрать',()=>{consoleCart=consoleCart===sku?undefined:sku;electronicsCart=undefined;vacuumCart=undefined;speakerCart=undefined;draw();},owned));
      for(const id of consoleGames(sku))options.append(element('small','',CONSOLE_GAMES[id].name+' · '+formatRub(CONSOLE_GAMES[id].price)));
    } else if(station.action.kind==='speaker-display'){
      for(const sku of Object.keys(SPEAKER_MODELS) as SpeakerSku[]){
        const m=SPEAKER_MODELS[sku];options.append(element('strong','',m.name+' · '+formatRub(m.price)),element('small','',m.assistant+' · Музыка и домашние команды'),button(speakerCart===sku?'В корзине ✓':'Выбрать',()=>{speakerCart=speakerCart===sku?undefined:sku;consoleCart=undefined;electronicsCart=undefined;vacuumCart=undefined;draw();}));
      }
    } else if(station.action.kind==='vacuum-display'){
      const owned=[...place.furnishing.placed,...place.furnishing.stored,...place.furnishing.orders].some(p=>isVacuumSku(p.sku));
      for(const sku of Object.keys(VACUUM_MODELS) as VacuumSku[]){
        const m=VACUUM_MODELS[sku];options.append(element('strong','',m.name+' · '+formatRub(m.price)),element('small','',m.spec+' · чистота до '+m.clean+'%'),button(owned?'Уже есть робот':vacuumCart===sku?'В корзине ✓':'Выбрать',()=>{vacuumCart=vacuumCart===sku?undefined:sku;consoleCart=undefined;electronicsCart=undefined;speakerCart=undefined;draw();},owned));
      }
    } else if(station.action.kind==='electronics-display'){
      const category=station.action.category;const current=installedElectronics(place,role,category);
      options.append(element('small','','Сейчас: '+ELECTRONICS[current].name),element('small','','Выбери модель, затем оплати на кассе. Новая техника заменяет старую без возврата денег.'));
      for(const id of electronicsFor(category)){const m=ELECTRONICS[id];options.append(element('strong','',m.name+' · '+formatRub(m.price)),element('small','',m.spec+' · '+electronicsBenefit(m)),button(current===id?'Установлено':electronicsCart===id?'В корзине ✓':'Выбрать',()=>{electronicsCart=electronicsCart===id?undefined:id;consoleCart=undefined;vacuumCart=undefined;speakerCart=undefined;draw();},current===id));}
    } else if(kind==='electronics-checkout'){
      if(consoleCart){const sku=consoleCart,m=CONSOLES[sku];options.append(element('strong','',m.name+' · '+formatRub(m.price)),element('small','','После покупки установи на свободную полку ТВ-тумбы или другую подходящую мебель.'),button('Купить · '+formatRub(m.price),()=>{if(send({type:'console_buy',sku})){consoleCart=undefined;close();}},place.money<m.price||consoleOwned(place,sku)),button('Отмена',()=>{consoleCart=undefined;draw();}));
      } else if(speakerCart){
        const sku=speakerCart,m=SPEAKER_MODELS[sku];options.append(element('strong','',m.name+' · '+formatRub(m.price)),element('small','','После покупки размести колонку из склада мебели.'),button('Купить · '+formatRub(m.price),()=>{if(send({type:'speaker_buy',sku})){speakerCart=undefined;close();}},place.money<m.price),button('Отмена',()=>{speakerCart=undefined;draw();}));
      } else if(vacuumCart){
        const sku=vacuumCart,m=VACUUM_MODELS[sku];options.append(element('strong','',m.name+' · '+formatRub(m.price)),element('small','','После покупки установи станцию из склада мебели.'),button('Купить · '+formatRub(m.price),()=>{if(send({type:'vacuum_buy',sku})){vacuumCart=undefined;close();}},place.money<m.price),button('Отмена',()=>{vacuumCart=undefined;draw();}));
      } else if(!electronicsCart||installedElectronics(place,role,ELECTRONICS[electronicsCart].kind)===electronicsCart)options.append(element('small','','Выбери модель на витрине.'));
      else{const id=electronicsCart,m=ELECTRONICS[id];options.append(element('strong','',m.name+' · '+formatRub(m.price)),element('small','',m.spec+' · '+electronicsBenefit(m)),button('Купить и заменить · '+formatRub(m.price),()=>send({type:'electronics_buy',model:id}),place.money<m.price),button('Отмена',()=>{electronicsCart=undefined;draw();}));}
    } else if(kind==='wardrobe'||kind==='clothes-rack'||kind==='fitting'||kind==='clothes-checkout'){
      const personal=(place.world.wardrobe??defaultWardrobe())[role];
      const catalog=PREVIEW_LOOKS[role];
      if(kind==='wardrobe'){
        const worn=contextualLook(place,role);
        options.append(element('strong','','Переодевание по ситуации'),button(personal.auto?'Авто: включено · отключить':'Авто: выключено · включить',()=>send({type:'clothing_auto',enabled:!personal.auto})));
        options.append(element('small','','Выбери купленный комплект для каждой ситуации. Без выбора остаётся ручной наряд. Ручная смена отключает авто.'));
        for(const context of OUTFIT_CONTEXTS){
          const row=element('label','outfit-context');row.append(element('strong','',OUTFIT_LABELS[context]));
          const select=element('select','');select.setAttribute('aria-label',OUTFIT_LABELS[context]);const empty=element('option','','Без смены');empty.value='';select.append(empty);
          for(const [id,label] of catalog.filter(([id])=>personal.owned.includes(id))){const opt=element('option','',label);opt.value=id;select.append(opt);}
          select.value=personal.contexts?.[context]??'';select.onchange=()=>send({type:'clothing_context',context,look:select.value||null});row.append(select);options.append(row);
        }
        options.append(element('strong','','Ручная смена'));
        for(const [look,label] of catalog.filter(([id])=>personal.owned.includes(id)))
          options.append(button(label+(worn===look?' · На тебе':''),()=>send({type:'clothing_wear',look}),worn===look&&!personal.auto));
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
          ? p.category==='drinks'||p.stockKey === 'tea' || p.stockKey.startsWith('coffee') || p.stockKey.startsWith('beans') : categories.includes(p.category));
        const missing=favoriteRecipeIngredients(place,role);
        for (const product of products.sort((a,b)=>Number(favoriteProduct(place,role,b))-Number(favoriteProduct(place,role,a))||Number(missing.has(b.stockKey))-Number(missing.has(a.stockKey)))) options.append(productRow(product.id));
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
      options.classList.add('storage-menu');
      const used=kind==='fridge'?amount.fridge:amount.cupboard,max=kind==='fridge'?36:42;
      const meter=element('div','storage-meter');
      const bar=element('div','storage-meter-track'),fill=element('i');
      fill.style.width=Math.min(100,used/max*100)+'%';bar.append(fill);
      meter.append(element('strong','','Запасы · '+capacity),bar);options.append(meter);
      if(kind==='fridge'){
        if(storagePage==='picnic'&&!place.world.picnic)storagePage='ready';
        const tabs=element('div','storage-tabs');
        const pages:Array<['ready'|'ingredients'|'picnic',string]>=[['ready','Готовая еда'],['ingredients','Продукты']];
        if(place.world.picnic)pages.push(['picnic','Пикник']);
        for(const [id,label] of pages){
          const tab=button(label,()=>{storagePage=id;ingredient=null;draw();panel.scrollTop=0;});
          tab.dataset.storagePage=id;tab.setAttribute('aria-pressed',String(storagePage===id));tabs.append(tab);
        }
        options.append(tabs);
      }
      if (kind === 'fridge') {
        if(storagePage==='ready'){options.append(element('strong','menu-section-label','🍲 Готовая еда'));
        options.append(element('small', '', 'Только продукты, действительно убранные сюда, занимают ' +
          READY_FOOD_SLOTS + ' ячейки за порцию. Холод замедляет порчу, но не делает старую еду новой.'));}
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
        if(storagePage==='picnic'&&place.world.picnic){
          const mine=picnicPortions(place,role),count=picnicPortions(place,'vlad').length+picnicPortions(place,'alina').length;
          options.append(element('strong','','🧺 Корзина для пикника · '+count+'/'+PICNIC_CAPACITY));
          options.append(element('small','','Твои порции хранятся отдельно. Еда вне холодильника портится быстрее.'));
          for(const food of mine){if(food.kind==='campfire'){options.append(element('small','',picnicName(food)));continue;}const kind=food.kind;options.append(button('Вернуть: '+picnicName(food),()=>send({type:'picnic_unpack',kind,item:food.item})));}
          const kit=place.world.campKit?.[role];
          options.append(element('strong','','Припасы для костра'),button('Уголь + розжиг · '+(kit?.fuel??0),()=>send({type:'camp_pack',item:'fuel'}),place.pantry.charcoal<1||place.pantry.lighterFluid<1||(kit?.fuel??0)>=3));
          for(const [id,meal] of Object.entries(CAMP_RECIPES)){const item=id as CampRecipe;const ingredients=campIngredients(item);options.append(element('small','',ingredients.map(([k,n])=>GROCERIES[k].name.split(' · ')[0]+' '+place.pantry[k]+'/'+n).join(' · ')));options.append(button('Собрать: '+meal.name+' · '+(kit?.recipes[item]??0),()=>send({type:'camp_pack',item}),ingredients.some(([k,n])=>place.pantry[k]<n)||(kit?.recipes[item]??0)>=3));}
          for(const batch of [...fridgeReady].sort((a,b)=>Number(favoriteFood(place,role,b.kind,b.item))-Number(favoriteFood(place,role,a.kind,a.item))))options.append(button('В корзину: '+readyFoodName(batch.kind,batch.item)+tasteLabel(place,role,batch.kind,batch.item),()=>send({type:'picnic_pack',kind:batch.kind,item:batch.item}),count>=PICNIC_CAPACITY));
        }
        if(storagePage==='ready'){
        if (!fridgeReady.length) options.append(element('small', '', 'Готовых блюд в холодильнике пока нет.'));
        for (const batch of fridgeReady) {
          const name = readyFoodName(batch.kind, batch.item)+tasteLabel(place,role,batch.kind,batch.item)+(batch.kind==="meal"?" · Следующая: "+qualityLabel(batch.quality):"");
          const card=element('article','storage-food-card');
          card.append(element('strong', '', (batch.kind === 'meal' ? '🍳 ' : '🍕 ') + name +
            ' · ' + batch.portions + ' порц. · ' + readyFoodRemaining(batch.expiresAt, place.clock)));
          card.append(button('🍽️ Достать на стол', () =>
            send({ type: 'ready_food_serve', kind: batch.kind, item: batch.item }),
            readyFoodTableUsage(place)>=TABLE_READY_CAPACITY));
          if(favorite)card.append(tasteButton(place,role,batch.kind,batch.item,favorite));
          card.append(button('Выбросить 1 порцию', () =>
            send({ type: 'ready_food_discard', kind: batch.kind, item: batch.item, storage: 'fridge' })));
          options.append(card);
        }
        const onTable = groups('table');
        if (onTable.length) {
          options.append(element('strong', '', '🍽️ Готовая еда на столе · ' +
            readyFoodTableUsage(place) + '/' + TABLE_READY_CAPACITY));
          for (const batch of onTable) {
            const card=element('article','storage-food-card');
            card.append(element('strong', '', readyFoodName(batch.kind, batch.item)+(batch.kind==="meal"?" · Следующая: "+qualityLabel(batch.quality):"") + ' · ' +
              batch.portions + ' порц. · ' + readyFoodRemaining(batch.expiresAt, place.clock)));
            card.append(button('🧊 Убрать в холодильник', () =>
              send({ type: 'ready_food_move', kind: batch.kind, item: batch.item }),
              storageUsage(place).fridge + READY_FOOD_SLOTS > FRIDGE_CAPACITY));
            card.append(button('Выбросить 1 порцию', () =>
              send({ type: 'ready_food_discard', kind: batch.kind, item: batch.item, storage: 'table' })));
            options.append(card);
          }
        }
      }
      }
      if(kind==='cupboard'||storagePage==='ingredients'){
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
      }else for(const [id,meal] of Object.entries(CAFE_MENU).sort(([a],[b])=>favoritePriority(place,role,'cafe',a,b))){
        const choice=button(meal.name+' · '+formatRub(meal.price)+tasteLabel(place,role,'cafe',id),()=>{cafeChoice=id as CafeItem;draw();},pending!==null||place.money<meal.price);
        options.append(favorite?tastePair(choice,tasteButton(place,role,'cafe',id,favorite)):choice);
      }
    } else if (kind === 'rest') options.append(local('Сесть на скамью', 'rest'));
    else if(kind==='swing'||kind==='picnic'){
      const partner=role==='vlad'?'alina':'vlad';const together=place.world.places[partner]==='park'&&!!cafeSocial;
      if(kind==='swing')options.append(local('Покачаться на качелях','swing'));
      else{const food=picnicPortions(place,role)[0];options.append(element('small','',food?'Из корзины: '+picnicName(food)+tasteLabel(place,role,food.kind,food.item):'В твоём отделении корзины нет еды'));if(food)options.append(local('🍽️ Поесть на пикнике · 1,5 мин','picnic'));}
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
      if(walker&&place.world.places[walker]==='park'){const stats=place.world.parkDog?.agility;options.append(element('strong','','🐾 Полоса препятствий'),element('small','',stats?'Самостоятельно: '+stats.independent+' из '+stats.attempts+' · '+(stats.last?DOG_AGILITY[stats.last.action].name+' — '+(stats.last.independent?'сам':'с подсказкой'):''):'Тренируй знакомые команды на четырёх препятствиях.'));for(const action of AGILITY_ACTIONS){const d=DOG_AGILITY[action];options.append(button(d.name+' · «'+d.cue+'»',()=>{if(send({type:'local_activity',station:station.id,action}))close();},!agilityReady(place.pets.verdell)),element('small','','Уверенность: '+agilityConfidence(place.pets.verdell,action)+'%'));}}
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
      carPage='destinations';
      ingredient = null;
      storagePage=station.action.kind==='cupboard'?'ingredients':'ready';
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
        if(location==='clothing')clothesCart.clear();if(location==='electronics'){consoleCart=undefined;electronicsCart=undefined;vacuumCart=undefined;speakerCart=undefined;}if(location==='petshop')petCart=undefined;
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
      const newCatch=location==='lake'&&next.world.lake?.[role]?.catch&&!state?.world.lake?.[role]?.catch;
      state = next;
      if(newCatch){current=STATIONS.lake.find(s=>s.action.kind==='lake'&&s.action.facility==='fish'&&Math.hypot(s.approach.x-next.characters[role].x,s.approach.z-next.characters[role].z)<1)??STATIONS.lake.find(s=>s.id==='lake-fish-1')!;panel.hidden=false;panel.dataset.station=current.id;}
      draw();
    },
    reject() { entrance=null; pending = null; draw(); },
    reset() { entrance=null; consoleCart=undefined;petCart=undefined; electronicsCart=undefined;vacuumCart=undefined;speakerCart=undefined; clothesCart.clear(); cart.clear(); pending = null; showCart(); close(); closeMap(); },
  };
}
