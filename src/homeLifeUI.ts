import { serviceAvailable } from './shared/services';
import { clockMinutes } from './shared/locations';
import { taskAccessError } from './shared/serviceAccess';
import type { BookId, Entertainment, Genre, MediaGenre } from './shared/homeLife';
import type { CharacterId, GameState } from './shared/protocol';
import { BOOKS, GENRES, HOME_SECONDS, TV_FOOD_SECONDS, readingReward, viewingReward } from './shared/homeLife';
import {TAKEOUT,RECIPES,isMediaFood,mediaFoodKind,mediaFoodInfo,type MediaFood} from './shared/food';
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
  submit: (command: Entertainment) => boolean, invite: (genre: MediaGenre,food?:MediaFood) => boolean,
  read: () => GameState | null, active: () => CharacterId | null, payments: (where: 'internet' | 'subscriptions') => void,
  education: (view: 'book' | 'tv') => void,inviteGame:(id:ConsoleGameId)=>boolean,shopGames:()=>void) {
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
  const foodMenu=(genre:MediaGenre)=>{
    heading('🍕 Напитки и перекусы к просмотру');
    const state=read();if(!state)return;
    const now=clockMinutes(state.clock);
    const detail=document.createElement('p');detail.className='food-empty';
    detail.textContent='Приём пищи · 90 с. '+(genre==='youtube'?'YouTube · 90 с.':'Фильм · 120 с.')+' Выбирайте из свежих готовых порций.';
    root.append(detail);
    let found=false;
    for(const [id,meal] of [...Object.entries(TAKEOUT),...Object.entries(RECIPES)]){
      if(!isMediaFood(id))continue;const food=id;
      const count=state.readyFood.filter(b=>b.kind===mediaFoodKind(food)&&b.item===id&&(b.kind==='takeout'||b.storage==='table')&&b.expiresAt>now).reduce((n,b)=>n+b.portions,0);
      if(!count)continue;
      found=true;mediaLabel(meal.emoji+' '+meal.name+' · '+count+' порц. · Сытость +'+meal.hunger);
      const cmd:Entertainment=genre==='youtube'?{type:'youtube',food}:{type:'movie',genre,food};
      root.append(button('Смотреть одному · с порцией',()=>permitted(cmd)&&send(submit(cmd))));
      if(count>=2)root.append(button('Смотреть вдвоём · по порции',()=>permitted(cmd)&&send(invite(genre,food))));
    }
    if(!found){const empty=document.createElement('p');empty.className='food-empty';empty.textContent='Нет свежих порций. Приготовь напиток, десерт или купи перекус.';root.append(empty);}
    root.append(button('← Назад',()=>genre==='youtube'?backToTv():movie(genre)));
  };
  const movie = (genre: Genre) => {
    heading(GENRES[genre]);
    const detail = document.createElement('p');
    detail.className = 'food-empty';
    const state=read(),role=active(),hardware=state&&role?electronicsModel(state,role,'tv'):undefined;
    const reward=viewingReward({type:'movie',genre},true,hardware?.bonus??0,hardware?.comfort??0);
    detail.textContent = '120 с · 🎲 Досуг +'+reward.fun+' · 🏡 Комфорт +'+reward.comfort+'. Вместе также ❤️ Общение +'+reward.social+' каждому.';
    root.append(detail,
      button('Смотреть одному', () => permitted({type:'movie',genre}) && send(submit({type:'movie',genre}))),
      button('Смотреть вместе', () => permitted({type:'movie',genre}) && send(invite(genre))),
      button('🍕 Смотреть с напитком или едой',()=>foodMenu(genre)),
      button('← Жанры', genres));
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
      button('🎬 Netflix · фильмы',() => {if (permitted({type:'movie',genre:'comedy'})) genres();}));
    mediaLabel('Игры и обучение');
    root.append(button('🎮 Игровые консоли',games),button('🎓 Передачи и курсы', () => education('tv')));
  }
  return {
    television,
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
    show(id: number, from: string, genre: MediaGenre, outgoing: boolean,food?:MediaFood) {
      current = id;
      const title=document.createElement('strong');
      title.textContent=outgoing ? '🎬 Ждём ответа на приглашение' : ('🎬 '+from+' предлагает '+(genre==='youtube'?'посмотреть YouTube':'посмотреть фильм')+(food?' с едой':''));
      const detail=document.createElement('small');
      detail.textContent=(genre==='youtube'?'YouTube':GENRES[genre])+' · '+(genre==='youtube'?(food?TV_FOOD_SECONDS:HOME_SECONDS.youtube):HOME_SECONDS.movie)+' с'+(food?' · '+mediaFoodInfo(food).name+' · 1 порция каждому':'');
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
