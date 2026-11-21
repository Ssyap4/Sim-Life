import { FURNITURE_BY_ID, FURNITURE_CATALOG, FURNITURE_CATEGORIES,
  FURNITURE_FINISHES, FINISH_IDS, FURNITURE_DELIVERY, type FurnitureCategory,
  type FurnitureFinish, type FurnitureInstance, type PlacedFurniture, type Rotation,
  type FurnishingCommand } from './shared/furniture';
import { formatRub } from './shared/economy';
import type { GameState } from './shared/protocol';

type Tab = 'catalog'|'delivery'|'storage'|'placed';
type Callbacks = {
  read():GameState|null;
  minute():number;
  send(command:FurnishingCommand):boolean;
  start(item:FurnitureInstance|PlacedFurniture,rotation:Rotation):void;
  rotate(rotation:Rotation):void;
  cancel():void;
  message(message:string):void;
};

export function createFurnishingUI(root:HTMLElement,controls:HTMLElement,callbacks:Callbacks) {
  root.innerHTML=`<section class="furnish-case" role="dialog" aria-modal="true" aria-label="Мебель и обустройство">
    <header class="furnish-head"><div><small>Sim-Life · НАШ ДОМ</small><h2>🛋️ Мебель и интерьер</h2></div>
      <button type="button" data-furnish-close aria-label="Закрыть">×</button></header>
    <nav class="furnish-tabs" aria-label="Разделы магазина">
      <button data-tab="catalog">🛍️ Каталог</button>
      <button data-tab="delivery">📦 Доставка</button>
      <button data-tab="storage">🗄️ Склад</button>
      <button data-tab="placed">🏠 Установлено</button>
    </nav>
    <div class="furnish-topline"></div><div class="furnish-body"></div>
  </section>`;
  controls.innerHTML=`<section class="furnish-placebox" role="group" aria-label="Размещение мебели">
    <strong data-place-title>Расстановка</strong>
    <small data-place-hint>Тапни по полу, чтобы выбрать место.</small>
    <div class="furnish-place-buttons">
      <button type="button" data-turn-left aria-label="Повернуть против часовой стрелки">↶ Повернуть</button>
      <button type="button" data-turn-right aria-label="Повернуть по часовой стрелке">Повернуть ↷</button>
      <button type="button" class="furnish-apply" data-place-apply disabled>✓ Установить</button>
      <button type="button" data-place-cancel>Отмена</button>
    </div></section>`;
  const body=root.querySelector<HTMLElement>('.furnish-body')!;
  const status=root.querySelector<HTMLElement>('.furnish-topline')!;
  const tabs=root.querySelectorAll<HTMLButtonElement>('[data-tab]');
  const placeTitle=controls.querySelector<HTMLElement>('[data-place-title]')!;
  const placeHint=controls.querySelector<HTMLElement>('[data-place-hint]')!;
  const apply=controls.querySelector<HTMLButtonElement>('[data-place-apply]')!;
  let tab:Tab='catalog';
  let category:FurnitureCategory|'all'='all';
  let search='';
  let finish:FurnitureFinish='oak';
  let quantity=1;
  let draft:{item:FurnitureInstance|PlacedFurniture;rotation:Rotation;
    target:{x:number;z:number}|null;
    pending:{x:number;z:number;rotation:Rotation}|null;
    submitted:boolean}|null=null;
  const node=(tag:keyof HTMLElementTagNameMap,cls:string,text:string)=>{
    const el=document.createElement(tag);el.className=cls;el.textContent=text;return el;
  };
  const button=(label:string,onClick:()=>void,cls='furnish-button')=>{
    const control=document.createElement('button');control.type='button';
    control.className=cls;control.textContent=label;control.addEventListener('click',onClick);
    return control;
  };
  function refresh(){
    const state=callbacks.read();if(!state)return;
    tabs.forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.tab===tab)));
    const {orders,stored,placed}=state.furnishing;
    const ready=orders.filter(item=>item.readyAt<=callbacks.minute()).length;
    const counts={catalog:FURNITURE_CATALOG.length,delivery:orders.length,storage:stored.length,placed:placed.length};
    tabs.forEach(button=>{
      const t=button.dataset.tab as Tab;
      button.textContent=({catalog:'🛍️ Каталог',delivery:'📦 Доставка',storage:'🗄️ Склад',placed:'🏠 Установлено'}[t])+' · '+counts[t];
    });
    status.textContent='💳 Семейный бюджет: '+formatRub(state.money)+
      ' · 📦 '+ready+' посылок готовы · '+stored.length+' предметов на складе';
    if(root.hidden)return;
    const scroll=body.scrollTop;
    if(tab==='catalog')renderCatalog(state);
    else if(tab==='delivery')renderDeliveries(state);
    else if(tab==='storage')renderItems(stored,false);
    else renderItems(placed,true);
    body.scrollTop=scroll;
  }
  function renderCatalog(state:GameState){
    const focused=body.contains(document.activeElement) ?
      (document.activeElement as HTMLElement).getAttribute('aria-label') : null;
    const selection=focused==='Поиск мебели' ? (document.activeElement as HTMLInputElement).selectionStart : null;
    body.replaceChildren();
    const filters=node('div','furnish-filters','');
    const searchInput=document.createElement('input');
    searchInput.type='search';searchInput.placeholder='Поиск мебели с первой буквы…';
    searchInput.setAttribute('aria-label','Поиск мебели');searchInput.value=search;
    searchInput.addEventListener('input',()=>{search=searchInput.value;renderCards(state);});
    const select=document.createElement('select');
    select.setAttribute('aria-label','Категория мебели');
    for(const [id,label] of [['all','Все категории'],...Object.entries(FURNITURE_CATEGORIES)]){
      const option=document.createElement('option');option.value=id;option.textContent=label;
      select.append(option);
    }
    select.value=category;select.addEventListener('change',()=>{category=select.value as typeof category;renderCards(state);});
    filters.append(searchInput,select);
    const tint=document.createElement('select');tint.setAttribute('aria-label','Цвет и материал мебели');
    for(const id of FINISH_IDS){
      const option=document.createElement('option');option.value=id;option.textContent=FURNITURE_FINISHES[id].name;
      tint.append(option);
    }
    tint.value=finish;tint.addEventListener('change',()=>{finish=tint.value as FurnitureFinish;renderCards(state);});
    const qty=document.createElement('select');qty.setAttribute('aria-label','Количество одного товара');
    for(let amount=1;amount<=5;amount++){
      const option=document.createElement('option');option.value=String(amount);option.textContent='Количество: '+amount;
      qty.append(option);
    }
    qty.value=String(quantity);qty.addEventListener('change',()=>{quantity=Number(qty.value);renderCards(state);});
    const secondary=node('div','furnish-filters','');
    secondary.append(tint,qty);
    const list=node('div','furnish-grid','');
    list.dataset.furnishCards='';
    body.append(filters,secondary,
      node('p','furnish-instructions','Выбирай цвет, количество и тип доставки. Модели отличаются не только оттенком, но и конструкцией.'),
      list);
    renderCards(state);
    if(focused){
      const elements=Array.from(body.querySelectorAll<HTMLInputElement|HTMLSelectElement>('input,select'));
      const restore=elements.find(element=>element.getAttribute('aria-label')===focused);
      restore?.focus({preventScroll:true});
      if(selection!==null&&restore instanceof HTMLInputElement)
        restore.setSelectionRange(selection,selection);
    }
  }
  function renderCards(state:GameState){
    const list=body.querySelector<HTMLElement>('[data-furnish-cards]');if(!list)return;
    list.replaceChildren();
    const query=search.trim().toLocaleLowerCase('ru-RU');
    const matching=FURNITURE_CATALOG.filter(info=>
      (category==='all'||category===info.category)&&
      (!query||(info.name+' '+info.description+' '+FURNITURE_CATEGORIES[info.category]).toLocaleLowerCase('ru-RU').includes(query)));
    if(!matching.length){list.append(node('p','furnish-empty','Ничего не найдено. Попробуй другое название.'));return;}
    for(const info of matching){
      const card=node('article','furnish-card','');
      const image=node('div','furnish-card-icon',info.emoji);image.style.background='#'+
        FURNITURE_FINISHES[finish].light.toString(16).padStart(6,'0');
      const desc=node('div','furnish-card-copy','');
      desc.append(node('strong','',info.name),
        node('small','',info.description),
        node('small','furnish-dimensions',info.width+' × '+info.depth+' м · '+info.height+' м высота'),
        node('strong','furnish-price',formatRub(info.price*quantity)));
      const purchase=node('div','furnish-card-actions','');
      for(const shipping of ['regular','express'] as const){
        const config=FURNITURE_DELIVERY[shipping];
        const total=info.price*quantity+config.fee;
        const buy=button(shipping==='regular'?'🚚 '+config.minutes+' мин · '+formatRub(total):
          '⚡ '+config.minutes+' мин · '+formatRub(total),()=>{
          if(!confirm('Заказать '+info.name+' ×'+quantity+' ('+
            FURNITURE_FINISHES[finish].name+') за '+formatRub(total)+'?'))return;
          if(callbacks.send({type:'furniture_order',sku:info.id,finish,shipping,quantity}))
            callbacks.message('Заказ отправлен. Посмотри вкладку «Доставка».');
        });
        buy.disabled=state.money<total;
        buy.title='С учётом стоимости доставки '+formatRub(config.fee);
        purchase.append(buy);
      }
      card.append(image,desc,purchase);list.append(card);
    }
  }
  function renderDeliveries(state:GameState){
    body.replaceChildren();
    if(!state.furnishing.orders.length){
      body.append(node('p','furnish-empty','Пока посылок нет. Выбери мебель в каталоге.'));
      return;
    }
    const now=callbacks.minute();
    for(const item of state.furnishing.orders){
      const info=FURNITURE_BY_ID.get(item.sku)!;
      const row=node('article','furnish-line','');
      row.append(node('strong','', '📦 '+info.name+' · '+FURNITURE_FINISHES[item.finish].name));
      if(item.readyAt>now){
        row.append(node('p','', 'В пути · осталось примерно '+Math.ceil(item.readyAt-now)+' игровых минут'));
      }else{
        row.append(node('p','', 'Курьер доставил посылку к дому. Готова к распаковке.'));
        row.append(button('📦 Распаковать → на склад',()=>{
          callbacks.send({type:'furniture_unbox',id:item.id});
        }));
      }
      body.append(row);
    }
  }
  function renderItems(items:readonly (FurnitureInstance|PlacedFurniture)[],isPlaced:boolean){
    body.replaceChildren();
    if(!items.length){
      body.append(node('p','furnish-empty',isPlaced?
        'В доме пока нет новой мебели. Распакуй посылку и установи предмет.':
        'На складе пусто. Распакованные заказы появятся здесь.'));
      return;
    }
    for(const item of items){
      const info=FURNITURE_BY_ID.get(item.sku)!;
      const row=node('article','furnish-line','');
      row.dataset.furnitureId=String(item.id);
      row.append(node('strong','',info.emoji+' '+info.name),
        node('small','',FURNITURE_FINISHES[item.finish].name+' · '+info.width+' × '+info.depth+' м'));
      if('x'in item)row.append(node('p','', 'Координаты: '+item.x.toFixed(1)+' / '+item.z.toFixed(1)+
        ' · поворот: '+item.rotation*90+'°'));
      const choices=node('div','furnish-line-buttons','');
      choices.append(button(isPlaced?'↔ Переставить':'↗ Разместить в доме',()=>{
        begin(item,'rotation'in item?item.rotation:0);
      }));
      if(isPlaced)choices.append(button('📦 Убрать на склад',()=>{
        callbacks.send({type:'furniture_store',id:item.id});
      }));
      choices.append(button('Продать за '+formatRub(Math.floor(info.price*.55)),()=>{
        if(confirm('Продать '+info.name+' за '+formatRub(Math.floor(info.price*.55))+'?'))
          callbacks.send({type:'furniture_sell',id:item.id});
      },'furnish-button furnish-sell'));
      row.append(choices);body.append(row);
    }
  }
  function begin(item:FurnitureInstance|PlacedFurniture,rotation:Rotation){
    draft={item,rotation,target:null,pending:null,submitted:false};
    root.hidden=true;
    controls.hidden=false;
    const info=FURNITURE_BY_ID.get(item.sku)!;
    placeTitle.textContent='↔ '+info.name+' · '+FURNITURE_FINISHES[item.finish].name;
    placeHint.textContent='Тапни по свободному полу, выбери место, затем нажми «Установить».';
    apply.disabled=true;
    callbacks.start(item,rotation);
  }
  function setTarget(x:number,z:number):boolean{
    if(!draft||draft.submitted)return false;
    draft.target={x:Math.round(x*100)/100,z:Math.round(z*100)/100};
    placeHint.textContent='📍 Место: '+draft.target.x.toFixed(1)+
      ' / '+draft.target.z.toFixed(1)+' · поворот '+draft.rotation*90+'°';
    apply.disabled=false;
    return true;
  }
  function turn(amount:number){
    if(!draft||draft.submitted)return;
    draft.rotation=((draft.rotation+amount+4)%4) as Rotation;
    callbacks.rotate(draft.rotation);
    if(draft.target)setTarget(draft.target.x,draft.target.z);
  }
  function cancel(){
    if(draft)callbacks.cancel();
    draft=null;controls.hidden=true;
    root.hidden=false;refresh();
  }
  function submit(){
    if(!draft||!draft.target||draft.submitted)return;
    const {item,rotation,target}=draft;
    const command:FurnishingCommand='rotation'in item
      ?{type:'furniture_move',id:item.id,x:target.x,z:target.z,rotation}
      :{type:'furniture_place',id:item.id,x:target.x,z:target.z,rotation};
    if(callbacks.send(command)){
      draft.pending={...target,rotation};draft.submitted=true;apply.disabled=true;
      placeHint.textContent='Проверяем проходимость комнат и сохраняем расположение…';
    }
  }
  function acknowledge(state:GameState){
    if(!draft)return;
    const {item}=draft;
    if(!draft.submitted||!draft.pending)return;
    const submitted=draft.pending;
    const placed=state.furnishing.placed.find(row=>row.id===item.id);
    if(placed&&Math.abs(placed.x-submitted.x)<.01&&
      Math.abs(placed.z-submitted.z)<.01&&placed.rotation===submitted.rotation&&
      !state.furnishing.stored.some(row=>row.id===item.id))cancel();
  }
  controls.querySelector('[data-turn-left]')!.addEventListener('click',()=>turn(-1));
  controls.querySelector('[data-turn-right]')!.addEventListener('click',()=>turn(1));
  controls.querySelector('[data-place-cancel]')!.addEventListener('click',cancel);
  apply.addEventListener('click',submit);
  root.querySelector('[data-furnish-close]')!.addEventListener('click',()=>{root.hidden=true;});
  tabs.forEach(button=>button.addEventListener('click',()=>{
    tab=button.dataset.tab as Tab;body.scrollTop=0;refresh();
  }));
  root.addEventListener('click',event=>{if(event.target===root)root.hidden=true;});
  return {
    open(next:Tab='catalog'){tab=next;root.hidden=false;controls.hidden=true;
      if(draft){callbacks.cancel();draft=null;}refresh();},
    close(){root.hidden=true;controls.hidden=true;if(draft){callbacks.cancel();draft=null;}},
    refresh,acknowledge,setTarget,
    tick(){if(!root.hidden && tab==='delivery')refresh();},
    isPlacing:()=>draft!==null,
    selectPlaced(id:number){
      const state=callbacks.read();
      if(!state)return;
      const item=state.furnishing.placed.find(row=>row.id===id);
      if(!item)return;
      tab='placed';this.open('placed');
      const selected=body.querySelector<HTMLElement>('.furnish-line[data-furniture-id="'+id+'"]');
      selected?.classList.add('furnish-selected');
      selected?.scrollIntoView({block:'nearest'});
    },
    reject(reason:string){if(!draft)return;draft.submitted=false;draft.pending=null;
      apply.disabled=!draft.target;placeHint.textContent=reason;},
  };
}
