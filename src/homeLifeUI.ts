import {MEDIA_CATALOG,mediaTitle,mediaLabel as titleLabel,type MediaSelection,type MediaTitle} from './shared/mediaCatalog';
import {libraryFor,continueSeries,type MediaCommand} from './shared/mediaLibrary';
import { serviceAvailable } from './shared/services';
import { clockMinutes } from './shared/locations';
import { taskAccessError } from './shared/serviceAccess';
import type { BookId, Entertainment, Genre, MediaGenre } from './shared/homeLife';
import type { CharacterId, GameState } from './shared/protocol';
import { BOOKS, GENRES, HOME_SECONDS, TV_FOOD_SECONDS, readingReward, viewingReward } from './shared/homeLife';
import {mediaFoodInfo,type MediaFood} from './shared/food';
import {mediaTasteOptions,type MediaTasteFilter} from './shared/tasteMedia';
import {tasteButton,type TasteSubmit} from './foodTasteUI';
import {electronicsModel} from './shared/electronics';

import {CONSOLE_GAMES,consoleLibrary,consolePlayError,type ConsoleGameId} from './shared/consoleCatalog';
function button(label: string, click: () => void, className = 'action-button') {
  const element = document.createElement('button');
  element.type = 'button';
  element.className = className;
  element.textContent = label;
  element.addEventListener('click',click);
  return element;
}

export function homeLifeMenu(root: HTMLElement, heading: (title:string) => void,
  submit: (command: Entertainment) => boolean, invite: (genre: MediaGenre,food?:MediaFood,selection?:MediaSelection) => boolean,
  read: () => GameState | null, active: () => CharacterId | null, payments: (where: 'internet' | 'subscriptions') => void,
  education: (view: 'book' | 'tv') => void,inviteGame:(id:ConsoleGameId)=>boolean,shopGames:()=>void,favorite?:TasteSubmit,mark?:(command:MediaCommand)=>boolean) {
  const send = (result: boolean) => { if (result) root.hidden = true; };
  const permitted = (command: Entertainment) => {
    const state = read();
    if (!state) return false;
    const reason = taskAccessError(state, command);
    if (!reason) return true;
    const id = command.type === 'youtube' ? 'youtube' : 'netflix';
    const where = serviceAvailable(state.billing,id,clockMinutes(state.clock)) ? 'internet' : 'subscriptions';
    root.querySelector('.media-denial')?.remove();
    const alert = document.createElement('div');
    alert.className = 'media-denial';
    alert.setAttribute('role','status');
    const text = document.createElement('p');
    text.textContent = reason;
    alert.append(text,button(where === 'internet' ? 'Открыть интернет' : 'Открыть подписки', () => {
      root.hidden = true;
      payments(where);
    }));
    root.append(alert);
    return false;
  };
  const backToTv=()=>{heading('Телевизор');television();};
  const mediaLabel=(label:string)=>{const el=document.createElement('div');el.className='menu-section-label';el.textContent=label;root.append(el);};
  const foodMenu=(genre:MediaGenre,selection?:MediaSelection)=>{
    heading('🍕 Напитки и перекусы к просмотру');
    const state=read(),role=active();if(!state||!role)return;
    const detail=document.createElement('p');detail.className='food-empty';
    detail.textContent='Приём пищи · 90 с. '+(genre==='youtube'?'YouTube · 90 с.':'Фильм · 120 с.')+' Только свежие порции.';
    root.append(detail);
    const filters=document.createElement('div');filters.className='food-recipe-filter media-taste-filters';
    const list=document.createElement('div');list.className='media-taste-list';
    let selected:MediaTasteFilter='all';
    const buttons=([['all','Все'],['mine','♥ Моё'],['partner','♡ Партнёра'],['both','♥ Оба']] as const).map(([id,label])=>{const b=button(label,()=>{selected=id;render();});filters.append(b);return b;});
    const marks=new Map<string,boolean>();
    function render(){
      const latest=read()??state!;const view={...latest,foodTastes:{...latest.foodTastes}};
      if(marks.size){const keys=new Set(latest.foodTastes?.[role!]?.favorites??[]);for(const [k,on] of marks){if(on)keys.add(k);else keys.delete(k);}view.foodTastes[role!]={favorites:[...keys],lastBonusAt:latest.foodTastes?.[role!]?.lastBonusAt};}
      buttons.forEach((b,i)=>b.setAttribute('aria-pressed',String(selected===(['all','mine','partner','both'] as const)[i])));
      const rows=mediaTasteOptions(view,role!,selected);list.replaceChildren();
      for(const {food,kind,count,meal,mine,partner} of rows){
        const card=document.createElement('article');card.className='media-taste-card';
        const title=document.createElement('strong');title.textContent=meal.emoji+' '+meal.name+' · '+count+' порц.';
        const note=document.createElement('small');note.textContent='Сытость +'+meal.hunger+(mine&&partner?' · ♥ Любят оба':mine?' · ♥ Моё любимое':partner?' · ♡ Любит партнёр':'');
        const cmd:Entertainment=genre==='youtube'?{type:'youtube',food}:{type:'movie',genre,food,selection};
        card.append(title,note,button('Смотреть одному · с порцией',()=>permitted(cmd)&&send(submit(cmd))));
        if(count>=2)card.append(button('Смотреть вдвоём · по порции',()=>permitted(cmd)&&send(invite(genre,food,selection))));
        if(favorite)card.append(tasteButton(view,role!,kind,food,favorite,on=>{marks.set(kind+':'+food,on);render();}));
        list.append(card);
      }
      if(!rows.length){const empty=document.createElement('p');empty.className='food-empty';empty.textContent=selected==='all'?'Нет свежих порций. Приготовь напиток, десерт или купи перекус.':'Нет свежих порций из выбранного избранного.';list.append(empty);}
    }
    root.append(filters,list);render();
    root.append(button('← Назад',()=>genre==='youtube'?backToTv():movie(genre,selection)));
  };
  const movie = (genre: Genre,selection?:MediaSelection) => {
    heading(selection?titleLabel(selection):GENRES[genre]);
    const detail = document.createElement('p');
    detail.className = 'food-empty';
    const state=read(),role=active(),hardware=state&&role?electronicsModel(state,role,'tv'):undefined;
    const reward=viewingReward({type:'movie',genre},true,hardware?.bonus??0,hardware?.comfort??0);
    detail.textContent = '120 с · 🎲 Досуг +'+reward.fun+' · 🏡 Комфорт +'+reward.comfort+'. Вместе также ❤️ Общение +'+reward.social+' каждому.';
    root.append(detail,
      button('Смотреть одному', () => permitted({type:'movie',genre}) && send(submit({type:'movie',genre,selection}))),
      button('Смотреть вместе', () => permitted({type:'movie',genre}) && send(invite(genre,undefined,selection))),
      button('🍕 Смотреть с напитком или едой',()=>foodMenu(genre,selection)),
      button(selection?'← Медиатека':'← Жанры', selection?catalog:genres));
  };
  const catalog=()=>{
    heading('🎬 Медиатека');
    const state=read(),role=active();if(!state||!role)return;
    const search=document.createElement('input');search.type='search';search.placeholder='Название фильма или сериала';search.setAttribute('aria-label','Поиск в медиатеке');search.className='media-search';
    const filters=document.createElement('div');filters.className='media-catalog-filters';
    const list=document.createElement('div');list.className='media-catalog';
    let filter='new';
    const views=[['new','Новинки 2026'],['all','Все'],['films','Фильмы'],['series','Сериалы'],['favorites','♥ Избранное'],['watchLater','Позже'],['together','Вдвоём'],['history','История'],['continue','Продолжить']] as const;
    const render=()=>{
      const latest=read()??state,lib=libraryFor(latest),history=lib.history[role],q=search.value.toLocaleLowerCase().trim();
      filters.querySelectorAll('button').forEach((b,i)=>b.setAttribute('aria-pressed',String(views[i][0]===filter)));
      list.replaceChildren();
      if(filter==='history'){
        for(const entry of history){const t=mediaTitle(entry.id)!;if(q&&!t.title.toLocaleLowerCase().includes(q))continue;list.append(button(titleLabel(entry)+(entry.together?' · вдвоём':''),()=>movie(t.genre,entry)));}
      }else{
        for(const t of MEDIA_CATALOG){if(q&&!t.title.toLocaleLowerCase().includes(q))continue;
          const resume=continueSeries(latest,role,t.id),seen=history.some(h=>h.id===t.id);
          if(filter==='new'&&t.year!==2026||filter==='films'&&t.seasons||filter==='series'&&!t.seasons||filter==='favorites'&&!lib.favorites[role].includes(t.id)||filter==='watchLater'&&!lib.watchLater[role].includes(t.id)||filter==='together'&&!lib.together.includes(t.id)||filter==='continue'&&(!resume||!seen))continue;
          const card=document.createElement('article');card.className='media-catalog-card';card.dataset.genre=t.genre;
          const art=document.createElement('div');art.className='media-cover';art.textContent=GENRES[t.genre].split(' ')[0];
          const title=document.createElement('strong');title.textContent=t.title;
          const meta=document.createElement('small');meta.textContent=t.year+' · '+GENRES[t.genre]+(t.seasons?' · '+t.seasons.length+' сез. · '+t.seasons.reduce((a,b)=>a+b,0)+' эп.':' · Фильм');
          const desc=document.createElement('p');desc.textContent=t.description;
          card.append(art,title,meta,desc,button(t.seasons?'Выбрать серию':seen?'Пересмотреть':'Открыть',()=>titleDetails(t)));
          if(resume&&seen)card.append(button('Продолжить · С'+resume.season+' Э'+resume.episode,()=>movie(t.genre,resume)));
          list.append(card);
        }
      }
      if(!list.children.length){const p=document.createElement('p');p.textContent='Здесь пока пусто.';list.append(p);}
    };
    for(const [id,label] of views)filters.append(button(label,()=>{filter=id;render();}));
    search.oninput=render;root.append(search,filters,list,button('← Телевизор',backToTv));render();
  };
  const titleDetails=(t:MediaTitle)=>{
    heading(t.title+' · '+t.year);
    const state=read(),role=active();if(!state||!role)return;
    const lib=libraryFor(state),desc=document.createElement('p');desc.textContent=t.description;root.append(desc);
    for(const [key,label] of [['favorites','Избранное'],['watchLater','Посмотреть позже'],['together','Посмотреть вместе']] as const){
      const ids=key==='together'?lib.together:lib[key][role];let on=ids.includes(t.id);
      const b=button((on?'✓ ':'＋ ')+label,()=>{if(mark?.({type:'media_mark',list:key,id:t.id,enabled:!on})){on=!on;b.textContent=(on?'✓ ':'＋ ')+label;b.setAttribute('aria-pressed',String(on));}});b.setAttribute('aria-pressed',String(on));root.append(b);
    }
    if(t.seasons){
      const resume=continueSeries(state,role,t.id);if(resume)root.append(button('Продолжить · С'+resume.season+' Э'+resume.episode,()=>movie(t.genre,resume)));
      const season=document.createElement('select'),episode=document.createElement('select');season.setAttribute('aria-label','Сезон');episode.setAttribute('aria-label','Серия');
      for(let i=1;i<=t.seasons.length;i++){const o=document.createElement('option');o.value=String(i);o.textContent='Сезон '+i;season.append(o);}
      const fill=()=>{episode.replaceChildren();for(let i=1;i<=t.seasons![Number(season.value)-1];i++){const o=document.createElement('option');o.value=String(i);o.textContent='Серия '+i;episode.append(o);}};season.onchange=fill;fill();
      root.append(season,episode,button('Открыть серию',()=>movie(t.genre,{id:t.id,season:Number(season.value),episode:Number(episode.value)})));
    }else root.append(button('Смотреть фильм',()=>movie(t.genre,{id:t.id})));
    root.append(button('← Медиатека',catalog));
  };
  const genres = () => {
    heading('🎬 Выбор жанра');
    const grid = document.createElement('div');
    grid.className = 'genre-grid';
    for(const [genre,name] of Object.entries(GENRES)) grid.append(button(name,() => movie(genre as Genre)));
    root.append(grid,button('← Телевизор',backToTv));
  };
  const games=()=>{heading('🎮 Игровая библиотека');const state=read();if(!state)return;for(const id of consoleLibrary(state)){const g=CONSOLE_GAMES[id],error=consolePlayError(state,id);const detail=document.createElement('p');detail.textContent=g.name+' · '+g.seconds+' с'+(error?' · '+error:'');root.append(detail);if(!error){if(g.mode!=='coop')root.append(button('Играть одному',()=>send(submit({type:'console_play',game:id}))));if(g.mode!=='solo')root.append(button('Играть вместе',()=>send(inviteGame(id))));}}root.append(button('Магазин игр',()=>{root.hidden=true;shopGames();}),button('← Телевизор',backToTv));};
  function television(){
    mediaLabel('Смотреть');
    root.append(button('📺 Телеканалы · ' + HOME_SECONDS.freeTv + ' с',
      () => send(submit({type:'free_tv'}))),button('▶️ YouTube · ' + HOME_SECONDS.youtube + ' с',
      () => permitted({type:'youtube'}) && send(submit({type:'youtube'}))),
      button('🍕 YouTube с напитком или едой',()=>foodMenu('youtube')),
      button('🎬 Netflix · фильмы и сериалы',catalog),button('Выбор по жанру',() => {if (permitted({type:'movie',genre:'comedy'})) genres();}));
    mediaLabel('Игры и обучение');
    root.append(button('🎮 Игровые консоли',games),button('🎓 Передачи и курсы', () => education('tv')));
  }
  return {
    television,
    catalog,
    genres,
    library(seat?: 'officeChair') {
      heading(seat ? '📚 Почитать в кресле' : '📚 Домашняя библиотека');
      root.append(button('🎓 Учебные книги', () => education('book')));
      const role = active();
      const completed = new Set(role ? read()?.readBooks?.[role] : []);
      const shelf = document.createElement('div');
      shelf.className = 'library-list';
      for(const [id,[title,author,genre,seconds,color]] of Object.entries(BOOKS)) {
        const entry = document.createElement('article');
        entry.className = 'library-book';
        entry.style.setProperty('--book-color',color);
        const text = document.createElement('div');
        const name = document.createElement('strong');
        name.textContent=title;
        const authorLine=document.createElement('small');
        authorLine.textContent=author+' · '+genre;
        const reward=document.createElement('small');
        const effects=readingReward(id as BookId);
        reward.textContent=seconds+' с · 🎲 +'+effects.fun+' · 🏡 +'+effects.comfort;
        reward.title='Досуг +'+effects.fun+', комфорт +'+effects.comfort;
        const book = id as BookId;
        const finished = completed.has(book);
        const open = button(finished ? 'Перечитать' : 'Читать',() => send(submit({type:'read_book',book,seat})));
        open.setAttribute('aria-label',open.textContent + ': '+title);
        text.append(name,authorLine,reward);
        if (finished) {
          const badge = document.createElement('small');
          badge.className = 'book-read';
          badge.textContent = '✓ Прочитано';
          text.append(badge);
        }
        entry.append(text,open);
        shelf.append(entry);
      }
      root.append(shelf);
    },
  };
}

export function movieInvite(root: HTMLElement, respond: (id: number,accept: boolean) => boolean, withdraw: (id: number) => boolean) {
  let current: number | null = null;
  return {
    show(id: number, from: string, genre: MediaGenre, outgoing: boolean,food?:MediaFood,selection?:MediaSelection) {
      current = id;
      const title=document.createElement('strong');
      title.textContent=outgoing ? '🎬 Ждём ответа на приглашение' : ('🎬 '+from+' предлагает '+(genre==='youtube'?'посмотреть YouTube':'посмотреть фильм')+(food?' с едой':''));
      const detail=document.createElement('small');
      detail.textContent=(selection?titleLabel(selection):genre==='youtube'?'YouTube':GENRES[genre])+' · '+(genre==='youtube'?(food?TV_FOOD_SECONDS:HOME_SECONDS.youtube):HOME_SECONDS.movie)+' с'+(food?' · '+mediaFoodInfo(food).name+' · 1 порция каждому':'');
      const controls=document.createElement('div');
      if(outgoing) controls.append(button('Отозвать',() => { if (withdraw(id)) controls.remove(); }));
      else controls.append(button('Принять',() => { if(respond(id,true)) controls.remove(); }),
        button('Отклонить',() => { if(respond(id,false)) controls.remove(); }));
      root.replaceChildren(title,detail,controls);
      root.hidden=false;
    },
    close(id?: number) {
      if(id !== undefined && id !== current) return;
      current=null;
      root.hidden=true;
      root.replaceChildren();
    },
  };
}
