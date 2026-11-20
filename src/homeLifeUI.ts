import { serviceAvailable } from './shared/services';
import { clockMinutes } from './shared/locations';
import { taskAccessError } from './shared/serviceAccess';
import type { BookId, Entertainment, Genre } from './shared/homeLife';
import type { CharacterId, GameState } from './shared/protocol';
import { BOOKS, GENRES, HOME_SECONDS } from './shared/homeLife';

function button(label: string, click: () => void, className = 'action-button') {
  const element = document.createElement('button');
  element.type = 'button';
  element.className = className;
  element.textContent = label;
  element.addEventListener('click',click);
  return element;
}

export function homeLifeMenu(root: HTMLElement, heading: (title:string) => void,
  submit: (command: Entertainment) => boolean, invite: (genre: Genre) => boolean,
  read: () => GameState | null, active: () => CharacterId | null, payments: (where: 'internet' | 'subscriptions') => void,
  education: (view: 'book' | 'tv') => void) {
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
  const movie = (genre: Genre) => {
    heading(GENRES[genre]);
    const detail = document.createElement('p');
    detail.className = 'food-empty';
    detail.textContent = '120 с · 🎲 Досуг +100 · 🏡 Комфорт +15. Вместе также ❤️ Общение +100 каждому.';
    root.append(detail,
      button('Смотреть одному', () => permitted({type:'movie',genre}) && send(submit({type:'movie',genre}))),
      button('Смотреть вместе', () => permitted({type:'movie',genre}) && send(invite(genre))),
      button('← Жанры', genres));
  };
  const genres = () => {
    heading('🎬 Выбор жанра');
    const grid = document.createElement('div');
    grid.className = 'genre-grid';
    for(const [genre,name] of Object.entries(GENRES)) grid.append(button(name,() => movie(genre as Genre)));
    root.append(grid);
  };
  return {
    television() {
      root.append(button('🎓 Образовательные передачи и курсы', () => education('tv')));
      root.append(button('📺 Смотреть обычные телеканалы · ' + HOME_SECONDS.freeTv + ' с',
        () => send(submit({type:'free_tv'}))),button('▶️ Смотреть YouTube · ' + HOME_SECONDS.youtube + ' с',
        () => permitted({type:'youtube'}) && send(submit({type:'youtube'}))),
        button('🎬 Смотреть Netflix',() => {if (permitted({type:'movie',genre:'comedy'})) genres();}));
    },
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
        reward.textContent=seconds+' с · 🎲 +60 · 🏡 +10';
        reward.title='Досуг +60, комфорт +10';
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
    show(id: number, from: string, genre: Genre, outgoing: boolean) {
      current = id;
      const title=document.createElement('strong');
      title.textContent=outgoing ? '🎬 Ждём ответа на приглашение' : '🎬 '+from+' предлагает посмотреть фильм';
      const detail=document.createElement('small');
      detail.textContent=GENRES[genre]+' · 2 минуты';
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
