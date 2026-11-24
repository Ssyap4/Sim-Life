import { electronicsModel } from "./shared/electronics";
import { createCareerUI } from './careerUI';
import { createBillingUI, type BillingApp } from './billingUI';
import { createMarketUI } from './marketUI';
import type { BasketLine } from './shared/market';
import type { ServiceCommand } from './shared/services';
import type { BudgetCommand } from './shared/familyBudget';
import { createEducationUI, type EducationView } from './educationUI';
import { MATERIAL_BY_ID } from './shared/educationCatalog';
import { serviceAvailable } from './shared/services';
import { gameMinutes } from './shared/life';
import { COMPUTER_GAMES, GAME_BY_ID, GAME_GENRES, VIDEO_CLIPS, gamePreference,
  type ComputerGame, type ComputerGameId, type GameGenre, type VideoClipId } from './shared/computerGames';
import { drawComputerScene, type ComputerScene } from './game/ComputerScreenArt';
import type { CareerCommand } from './shared/careers';
import type { EducationCommand } from './shared/education';
import type { ComputerDevice } from './shared/computer';
import type { ActionId, CharacterId, GameState } from './shared/protocol';
import type { TimeStatus } from './shared/timeControl';

type ComputerApp = 'furnishing' | 'career' | 'study' | 'browser' | 'shop' | BillingApp | 'games' | 'video' | 'mail' | 'notes';
const billingApps = new Set<ComputerApp>(['finance','internet','mobile','utilities','subscriptions']);
type GameFilter = 'all'|'favorites'|GameGenre;
type View = { state: GameState; role: CharacterId; time: TimeStatus };
type Callbacks = {
  read(): View | null;
  act(action: ActionId, device: ComputerDevice): boolean;
  playGame(game: ComputerGameId, device: ComputerDevice): boolean;
  favorite(game: ComputerGameId, enabled: boolean): boolean;
  watchVideo(clip: VideoClipId, device: ComputerDevice): boolean;
  preview(device: ComputerDevice, scene: ComputerScene|null): void;
  career(command: CareerCommand): boolean;
  homeJob(id:import("./shared/jobs").JobId,device:ComputerDevice):boolean;
  leaveJob():boolean;
  answerHomeJob(nonce:string,choice:number):boolean;
  education(command: EducationCommand): boolean;
  vote(enabled: boolean): boolean;
  travel(): boolean;
  service(command: ServiceCommand): boolean;
  budget(command: BudgetCommand): boolean;
  checkout(lines: BasketLine[]): boolean;
  furnishing():void;
};
const apps: ReadonlyArray<[ComputerApp, string, string, string]> = [
  ['career','💼','Работа','Смены, задачи и зарплата'],
  ['study','🎓','Обучение','Курсы и самообучение'],
  ['browser','🌐','Интернет','Сайты и онлайн-сервисы'],
  ['shop','🛍️','Покупки','Доставка и семейные запасы'],
  ['furnishing','🛋️','Мебель','Каталог, доставка и расстановка'],
  ['finance','💳','Финансы','Бюджет и платежи'],
  ['games','🎮','Игры','12 игр · 4 жанра'],
  ['video','▶️','Видео','Ролики и каналы'],
  ['mail','✉️','Почта','Рабочие сообщения'],
  ['notes','📝','Заметки','Практика и записи'],
];
const nestedAppTitles:Partial<Record<ComputerApp,string>>={
  internet:'Интернет и подключение',mobile:'Мобильная связь',
  utilities:'Коммунальные платежи',subscriptions:'Подписки',
};
const deviceName = (device: ComputerDevice) => device === 'laptop' ? 'Ноутбук Алины' : 'ПК Влада';
const button = (title: string, action: () => void, description?: string) => {
  const control = document.createElement('button');
  control.type = 'button';
  control.className = 'computer-action';
  const label = document.createElement('strong');
  label.textContent = title;
  control.append(label);
  if (description) {
    const hint = document.createElement('small');
    hint.textContent = description;
    control.append(hint);
  }
  control.addEventListener('click', action);
  return control;
};
const section = (tag: keyof HTMLElementTagNameMap, className: string, text?: string) => {
  const node = document.createElement(tag);
  node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
};

/** One shell, two physical devices, personal data and server-owned sessions. */
export function createComputerUI(root: HTMLElement, callbacks: Callbacks) {
  root.innerHTML = `<section class="computer-case" role="dialog" aria-modal="true" aria-label="Sim-Life OS">
    <header class="computer-topbar">
      <div class="computer-brand"><span class="computer-logo">✦</span><span><strong>Sim-Life OS</strong><small data-computer-device></small></span></div>
      <div class="computer-title"><strong data-computer-user></strong><small>Личный рабочий стол</small></div>
      <button type="button" data-computer-close aria-label="Закрыть компьютер">×</button>
    </header>
    <main class="computer-desktop">
      <nav class="computer-apps" aria-label="Приложения"></nav>
      <section class="computer-window" hidden>
        <header class="computer-window-head">
          <button type="button" data-computer-back>← Рабочий стол</button>
          <strong data-computer-app-title></strong>
        </header>
        <div class="computer-window-body"></div>
      </section>
    </main>
    <footer class="computer-taskbar"><span>✦ Sim-Life OS</span><span data-computer-session></span></footer>
  </section>`;
  const desktop = root.querySelector<HTMLElement>('.computer-apps')!;
  const windowEl = root.querySelector<HTMLElement>('.computer-window')!;
  const content = root.querySelector<HTMLElement>('.computer-window-body')!;
  const appTitle = root.querySelector<HTMLElement>('[data-computer-app-title]')!;
  const deviceLabel = root.querySelector<HTMLElement>('[data-computer-device]')!;
  const userLabel = root.querySelector<HTMLElement>('[data-computer-user]')!;
  const session = root.querySelector<HTMLElement>('[data-computer-session]')!;
  const closeButton = root.querySelector<HTMLButtonElement>('[data-computer-close]')!;
  const billing = createBillingUI(content,callbacks.service,callbacks.budget);
  const shopRoot = section('section','market-overlay computer-market-root');
  shopRoot.hidden = true;
  const shop = createMarketUI(shopRoot,callbacks.checkout,()=>show('mobile'),()=>show('browser'));
  // The canvas opens this overlay on pointerup. A synthetic click from the
  // same touch must never activate an application underneath that finger.
  let freshPointer=false;
  root.addEventListener('pointerdown',()=>{freshPointer=true;},{capture:true});
  root.addEventListener('pointercancel',()=>{freshPointer=false;},{capture:true});
  root.addEventListener('click',event=>{
    const pointerClick=event.detail>0||(event instanceof PointerEvent&&!!event.pointerType);
    if(pointerClick&&!freshPointer){event.preventDefault();event.stopImmediatePropagation();}
    freshPointer=false;
  },{capture:true});
  let device: ComputerDevice = 'desktop';
  let app: ComputerApp | null = null;
  let filter: GameFilter = 'all';
  let selectedGame: ComputerGameId = COMPUTER_GAMES[0].id;
  let selectedClip: VideoClipId = 'pets';
  let gameSignature = '';
  let videoSignature = '';
  let animationFrame: number|null = null;
  let lastPaint = -1;
  const currentView = () => callbacks.read();

  function stopPreview() {
    if(animationFrame!==null)cancelAnimationFrame(animationFrame);
    animationFrame=null;lastPaint=-1;
  }
  function animatePreview(time:number) {
    if(root.hidden || app!=='games' && app!=='video'){stopPreview();return;}
    if(time-lastPaint>125){
      const canvas=content.querySelector<HTMLCanvasElement>('.computer-scene-preview');
      const view=currentView();
      if(canvas && view) {
        const scene:ComputerScene = app==='games'
          ? {mode:'game',game:selectedGame,role:view.role}
          : {mode:'video',clip:selectedClip,role:view.role};
        drawComputerScene(canvas.getContext('2d')!,scene,time/1000);
      }
      lastPaint=time;
    }
    animationFrame=requestAnimationFrame(animatePreview);
  }
  const startPreview=()=>{
    if(animationFrame===null)animationFrame=requestAnimationFrame(animatePreview);
  };
  const currentScene=(role:CharacterId):ComputerScene=>{
    if(app==='games')return {mode:'game',role,game:selectedGame};
    if(app==='video')return {mode:'video',role,clip:selectedClip};
    return {mode:app==='career'?role==='vlad'?'code':'hair':
      app==='study'?'study':app==='browser'||app==='shop'||billingApps.has(app as ComputerApp)?'browser':app==='mail'?'mail':
        app==='notes'?'notes':'idle',role};
  };
  const preview=()=>{const view=currentView();if(view)callbacks.preview(device,currentScene(view.role));};

  const close=()=>{
    stopPreview();
    callbacks.preview(device,null);
    root.hidden=true;freshPointer=false;app=null;windowEl.hidden=true;desktop.hidden=false;
    content.replaceChildren();desktop.scrollTop=0;content.scrollTop=0;
  };
  const act=(action:ActionId)=>{if(callbacks.act(action,device))close();};
  const career=createCareerUI(content,command=>
    callbacks.career(command.type==='career_approach'?{...command,device}:command),
    id=>openEducation('academy',id),close,callbacks.vote,()=>device,{start:id=>callbacks.homeJob(id,device),leave:callbacks.leaveJob,answer:callbacks.answerHomeJob});
  const education=createEducationUI(content,command=>{
    if(command.type==='study' && MATERIAL_BY_ID.get(command.material)?.channel==='academy')
      return callbacks.education({...command,computer:device});
    return callbacks.education(command);
  },close,callbacks.travel);

  function openEducation(page:EducationView='academy',materialId?:string){
    show('study');education.open(page,undefined,materialId);refresh();
  }
  function panel(title:string,description:string){
    const heading=section('h3','',title);
    const hint=section('p','computer-hint',description);
    content.append(heading,hint);
  }
  function show(next:ComputerApp|null) {
    if(next==='furnishing'){close();callbacks.furnishing();return;}
    stopPreview();
    app=next;windowEl.hidden=next===null;desktop.hidden=next!==null;
    content.replaceChildren();
    gameSignature=videoSignature='';
    content.scrollTop=0;
    if(next===null){
      appTitle.textContent='';
      desktop.scrollTop=0;desktop.scrollLeft=0;
    }
    if(next){
      appTitle.textContent=apps.find(row=>row[0]===next)?.[2]??nestedAppTitles[next]??'';
      if(next==='career'||next==='mail')career.open();
      if(next==='study')education.open('academy');
      if(next==='shop') {
        const view=currentView();
        if(view){content.append(shopRoot);shop.open(view.state);}
      }
      if(billingApps.has(next))billing.reset();
      if(next==='games') {
        filter='all';
        const v=currentView();
        selectedGame=v?.state.computerLibrary[v.role].last??COMPUTER_GAMES[0].id;
      }
    }
    preview();refresh();
  }

  function gameCard(game:ComputerGame,role:CharacterId,stars:ReadonlyArray<string>){
    const tile=button(game.icon+' '+game.title,()=>{
      selectedGame=game.id;
      gameSignature='';
      renderGames();
    },game.subtitle);
    tile.classList.add('computer-game-card');
    tile.dataset.gameId=game.id;
    tile.setAttribute('aria-pressed',String(game.id===selectedGame));
    if(stars.includes(game.id))tile.append(section('span','computer-game-star','★'));
    const badge=section('span','computer-game-length',game.duration+' сек');
    tile.append(badge);
    if(game.id===selectedGame)tile.classList.add('selected');
    tile.title=game.title+' · '+GAME_GENRES[game.genre].title+
      (gamePreference(role,game.genre)?' · любимый жанр персонажа':'');
    return tile;
  }

  function renderGames(){
    const view=currentView();
    if(!view || app!=='games')return;
    const {role,state}=view,library=state.computerLibrary[role];
    // Keep the catalogue stable while unrelated household/pet snapshots arrive.
    const signature=JSON.stringify([role,filter,selectedGame,library]);
    if(signature===gameSignature)return;
    gameSignature=signature;
    content.replaceChildren();
    const heading=section('div','computer-game-heading');
    heading.append(section('h3','','🎮 Библиотека игр'),
      section('small','12 игр · 4 жанра · Сыграно партий: '+library.sessions));
    content.append(heading);
    if(library.recent.length){
      const strip=section('div','computer-recents');
      strip.append(section('strong','','Недавнее'));
      for(const id of library.recent){
        const game=GAME_BY_ID.get(id);
        if(game)strip.append(button(game.icon+' '+game.title,()=>{
          selectedGame=id;filter='all';gameSignature='';renderGames();
        }));
      }
      content.append(strip);
    }
    const filters=section('div','computer-filters');
    const categories:ReadonlyArray<[GameFilter,string]>=[
      ['all','Все 12'],['favorites','★ Избранное'],
      ...Object.entries(GAME_GENRES).map(([genre,value])=>[genre as GameGenre,value.icon+' '+value.title] as [GameFilter,string]),
    ];
    for(const [value,name] of categories){
      const control=button(name,()=>{filter=value;gameSignature='';renderGames();});
      control.dataset.gameFilter=value;
      control.setAttribute('aria-pressed',String(filter===value));
      filters.append(control);
    }
    content.append(filters);
    const layout=section('div','computer-game-layout');
    const list=section('div','computer-game-list');
    const games=COMPUTER_GAMES.filter(game=>filter==='all' ||
      filter==='favorites'&&library.favorites.includes(game.id) || game.genre===filter);
    for(const game of games)list.append(gameCard(game,role,library.favorites));
    if(!games.length)list.append(section('p','computer-hint','Здесь пока нет любимых игр. Отметь звёздочкой понравившуюся.'));
    const selected=GAME_BY_ID.get(selectedGame)??COMPUTER_GAMES[0];
    const detail=section('div','computer-game-detail');
    const canvas=document.createElement('canvas');
    canvas.width=256;canvas.height=144;canvas.className='computer-scene-preview';
    canvas.setAttribute('role','img');
    canvas.setAttribute('aria-label','Анимированный предпросмотр: '+selected.title);
    detail.append(canvas);
    const name=section('h3','',selected.icon+' '+selected.title);
    const desc=section('p','computer-hint',selected.subtitle+' · '+GAME_GENRES[selected.genre].title);
    const rewards=section('div','computer-game-rewards');
    const hardware=electronicsModel(view.state,role,device);
    rewards.append(section('span','','💚 Досуг +'+(selected.fun+gamePreference(role,selected.genre)+hardware.bonus)),
      section('span','','✨ Настроение +'+selected.mood),
      section('span','','⚡ Энергия '+selected.energy),
      section('span','','🛋 Комфорт '+(selected.comfort+hardware.comfort>=0?'+':'')+(selected.comfort+hardware.comfort)));
    if(selected.skill)rewards.append(section('span','','🧠 Навык +'+selected.skill));
    const controls=section('div','computer-game-controls');
    const run=button('▶ Играть · '+selected.duration+' сек',()=>{
      if(callbacks.playGame(selected.id,device))close();
    },'Персонаж подойдёт к '+(device==='desktop'?'ПК':'ноутбуку'));
    run.classList.add('computer-game-play');
    run.dataset.playGame=selected.id;
    const isFavorite=library.favorites.includes(selected.id);
    const fav=button(isFavorite?'★ В избранном':'☆ В избранное',()=>{
      if(callbacks.favorite(selected.id,!isFavorite))fav.disabled=true;
    });
    fav.dataset.favoriteGame=selected.id;
    controls.append(run,fav);
    detail.replaceChildren(name,desc,controls,canvas,rewards);
    if(gamePreference(role,selected.genre))
      detail.append(section('small','computer-personal-hint','♥ Этот жанр особенно нравится персонажу. Бонус +3 к досугу.'));
    const note=section('p','computer-hint','Игра проходит на выбранном устройстве. Вторая попытка даст обычные эффекты, без бесконечных бонусов.');
    detail.append(note);
    layout.append(list,detail);
    content.append(layout);
    const now=performance.now();
    drawComputerScene(canvas.getContext('2d')!,{mode:'game',game:selected.id,role},now/1000);
    preview();
    startPreview();
  }

  function renderVideo(){
    const view=currentView();
    if(!view || app!=='video')return;
    const {state,role}=view;
    const internet=serviceAvailable(state.billing,'internet',gameMinutes(state.clock));
    const signature=role+':'+selectedClip+':'+String(internet);
    if(signature===videoSignature)return;
    videoSignature=signature;
    content.replaceChildren();
    panel('▶️ Видеотека Sim-Life','Три коротких ролика с движением на экране. Для просмотра нужен домашний интернет.');
    const layout=section('div','computer-game-layout');
    const list=section('div','computer-game-list');
    for(const [id,clip] of Object.entries(VIDEO_CLIPS) as [VideoClipId,typeof VIDEO_CLIPS[VideoClipId]][]){
      const tile=button(clip.icon+' '+clip.title,()=>{
        selectedClip=id;videoSignature='';renderVideo();
      },clip.duration+' сек');
      tile.dataset.videoId=id;
      tile.setAttribute('aria-pressed',String(selectedClip===id));
      list.append(tile);
    }
    const detail=section('div','computer-game-detail');
    const canvas=document.createElement('canvas');
    canvas.width=256;canvas.height=144;canvas.className='computer-scene-preview';
    detail.append(canvas);
    const clip=VIDEO_CLIPS[selectedClip];
    detail.append(section('h3','',clip.icon+' '+clip.title));
    detail.append(section('p','computer-hint','Досуг +'+(clip.fun+electronicsModel(state,role,device).bonus)+' · комфорт +'+electronicsModel(state,role,device).comfort+' · настроение +'+clip.mood+' · энергия −2'));
    const play=button('▶ Смотреть · '+clip.duration+' сек',()=>{
      if(callbacks.watchVideo(selectedClip,device))close();
    },internet?'Видео покажется на выбранном устройстве':'Интернет не подключён');
    play.disabled=!internet;
    play.dataset.playVideo=selectedClip;
    detail.append(play);
    layout.append(list,detail);
    content.append(layout);
    drawComputerScene(canvas.getContext('2d')!,{mode:'video',role,clip:selectedClip},performance.now()/1000);
    preview();startPreview();
  }

  function refresh(){
    if(root.hidden)return;
    const view=currentView();
    if(!view){close();return;}
    const {state,role,time}=view;
    userLabel.textContent=role==='vlad'?'Влад':'Алина';
    deviceLabel.textContent=deviceName(device);
    session.textContent=(role==='vlad'?'● Профиль Влада':'● Профиль Алины')+
      ' · '+state.computerLibrary[role].sessions+' игр';
    root.dataset.owner=role;
    root.dataset.device=device;
    if(app==='career'||app==='mail'){
      career.render(state,role,time);
      if(app==='mail'&&content.querySelector('[data-career-tab="inbox"]')?.getAttribute('aria-current')!=='page')
        content.querySelector<HTMLButtonElement>('[data-career-tab="inbox"]')?.click();
      return;
    }
    if(app==='study'){education.render(state,role);return;}
    if(app==='shop'){shop.refresh(state);return;}
    if(billingApps.has(app as ComputerApp)){billing.renderPage(state,app as BillingApp);return;}
    if(app==='games'){renderGames();return;}
    if(app==='video'){renderVideo();return;}
    if(!app)return;
    content.replaceChildren();
    if(app==='browser'){
      const internet=serviceAvailable(state.billing,'internet',gameMinutes(state.clock));
      panel('🌐 Интернет и сервисы',internet
        ? 'Домашний интернет подключён. Сервисы доступны обоим персонажам.'
        : 'Домашний интернет отключён. Онлайн-занятия и удалённая работа требуют подключения.');
      content.append(
        button('🌐 Интернет и подключение',()=>show('internet'),'Состояние домашнего интернета, тариф и счета'),
        button('🛍️ Онлайн-покупки',()=>show('shop'),'Каталог, доставка, продукты и семейные запасы'),
        button('💳 Финансы семьи',()=>show('finance'),'Бюджет, история операций и предстоящие платежи'),
        button('📺 Подписки',()=>show('subscriptions'),'Каналы и онлайн-сервисы'),
        button('🏠 Коммунальные платежи',()=>show('utilities'),'ЖКХ и задолженности'),
        button('📱 Мобильная связь',()=>show('mobile'),'Тариф для доставки и звонков'),
      );
    }
    if(app==='notes'){
      panel('📝 Личные занятия',role==='vlad'
        ? 'Разработка, тренировочные проекты и заметки.'
        : 'Реконструкция волос, работа с клиентами и заметки.');
      content.append(
        button('📝 Записать мысли',()=>act('deskJournal')),
        role==='vlad'
          ? button('💻 Практика разработки',()=>act('vladOrder'),'Учебное задание без оплаты')
          : button('📋 Общение с клиентами',()=>act('alinaConsult'),'Тренировка без реального заказа'),
        button(role==='vlad'?'📚 Учиться разработке':'📖 Изучать восстановление волос',
          ()=>act(role==='vlad'?'vladStudy':'alinaStudy')),
      );
    }
  }
  for(const [id,emoji,name,description] of apps) {
    const tile=button(emoji+' '+name,()=>show(id),description);
    tile.classList.add('computer-icon');tile.dataset.computerApp=id;
    desktop.append(tile);
  }
  closeButton.addEventListener('click',close);
  root.querySelector('[data-computer-back]')!.addEventListener('click',()=>show(null));
  root.addEventListener('click',event=>{if(event.target===root)close();});
  return {
    open(nextDevice:ComputerDevice) {
      if(!currentView())return;
      if(!root.hidden)callbacks.preview(device,null);
      device=nextDevice;freshPointer=false;
      root.hidden=false;show(null);
      closeButton.focus({preventScroll:true});
      desktop.scrollTop=0;
    },
    close,refresh,
    acknowledgeOrder(){if(app==='shop')shop.acknowledge();},
    billingMessages(messages:string[]){if(app && billingApps.has(app)){billing.setMessages(messages);refresh();}},
    educationMessage(message:string){if(app!=='study'||root.hidden)return false;education.feedback(message);refresh();return true;},
    get visible(){return !root.hidden;},
  };
}
