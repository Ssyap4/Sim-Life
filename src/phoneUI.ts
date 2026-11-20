import { formatRub } from './shared/economy';
import { JOBS } from './shared/jobs';
import { clockLabel, NEED_INFO, VITAL_NEEDS } from './shared/life';
import { PLACES } from './shared/locations';
import { PETS, PET_IDS } from './shared/pets';
import { names, type CharacterId, type GameState } from './shared/protocol';
import type { TimeStatus } from './shared/timeControl';

type App = 'delivery' | 'jobs' | 'calendar' | 'family';
const apps: Record<App,[string,string]> = {
  delivery:['🛍️','Доставка'],jobs:['🧰','Подработки'],calendar:['📅','Календарь'],family:['❤️','Семья'],
};
type View = {state:GameState;role:CharacterId;online:CharacterId[];time:TimeStatus};

export function createPhone(root: HTMLElement, delivery: HTMLElement, jobs: HTMLElement,
  read: () => View | null, openDelivery: (state: GameState) => void,
  openJobs: (state: GameState,role:CharacterId) => void, closeApps: () => void) {
  root.innerHTML = `<section class="phone-case" role="dialog" aria-modal="true" aria-label="Игровой телефон">
    <header class="phone-header">
      <button type="button" data-phone-back aria-label="На главный экран телефона" hidden>‹</button>
      <div><strong data-phone-owner></strong><small data-phone-clock></small></div>
      <button type="button" data-phone-close aria-label="Закрыть телефон">×</button>
    </header>
    <div class="phone-screen"><div class="phone-grid"></div><div class="phone-info" hidden></div></div>
  </section>`;
  const screen=root.querySelector<HTMLElement>('.phone-screen')!;
  const grid=root.querySelector<HTMLElement>('.phone-grid')!;
  const info=root.querySelector<HTMLElement>('.phone-info')!;
  const back=root.querySelector<HTMLButtonElement>('[data-phone-back]')!;
  const closeButton=root.querySelector<HTMLButtonElement>('[data-phone-close]')!;
  const owner=root.querySelector<HTMLElement>('[data-phone-owner]')!;
  const clock=root.querySelector<HTMLElement>('[data-phone-clock]')!;
  screen.append(delivery,jobs);
  let app: App | null = null;

  function block(title: string, description: string) {
    const card=document.createElement('article');
    const label=document.createElement('strong');
    label.textContent=title;
    const text=document.createElement('p');
    text.textContent=description;
    card.append(label,text);
    return card;
  }

  function refresh() {
    const view=read();
    if(root.hidden||!view) return;
    const {state,role,online,time}=view;
    clock.textContent=clockLabel(state.clock);
    root.dataset.owner=role;
    owner.textContent=names[role]+(app?' · '+apps[app][1]:'');
    if (app==='calendar') {
      const shift=state.activeShifts[role];
      const end=shift?.endsAt;
      const ending=end===undefined?'':clockLabel({day:Math.floor(end/1440)+1,minute:end%1440});
      info.replaceChildren(
        block('📅 Сегодня',clockLabel(state.clock)),
        block('🧰 Подработка',shift ? JOBS[shift.job].name+' · окончание '+ending : 'Активной смены нет'),
        block('⏱ Скорость общего времени','×'+time.multiplier.toLocaleString('ru-RU')));
    }
    if (app==='family') {
      const family=(['vlad','alina'] as const).map(id => {
        const place=state.activeShifts[id]?'На подработке':PLACES[state.world.places[id]].name;
        const status=online.includes(id)?'В сети':'Не в сети';
        const needs=VITAL_NEEDS.map(need=>NEED_INFO[need].label+' '+Math.round(state.characters[id][need])+'%');
        needs.push('Настроение '+Math.round(state.characters[id].mood)+'%');
        return block(names[id]+' · '+status,place+' · '+needs.join(' · '));
      });
      const pets=PET_IDS.map(id => {
        const pet=state.pets[id];
        return block(PETS[id].emoji+' '+PETS[id].name,`Сытость ${Math.round(pet.satiety)}% · Настроение ${Math.round(pet.happiness)}%`);
      });
      info.replaceChildren(block('Семейный бюджет',formatRub(state.money)),...family,...pets);
    }
  }

  function show(next: App | null) {
    const view=read();
    if (!view) return;
    closeApps();
    app=next;
    root.hidden=false;
    back.hidden=!next;
    grid.hidden=Boolean(next);
    info.hidden=next!=='calendar'&&next!=='family';
    if(next==='delivery') openDelivery(view.state);
    if(next==='jobs') openJobs(view.state,view.role);
    refresh();
  }

  function close() { closeApps(); root.hidden=true; app=null; }
  for(const [id,[icon,title]] of Object.entries(apps)) {
    const button=document.createElement('button');
    button.type='button';
    const tile=document.createElement('span');
    tile.textContent=icon;
    button.append(tile,document.createTextNode(title));
    button.dataset.phoneApp=id;
    button.addEventListener('click',()=>show(id as App));
    grid.append(button);
  }
  back.addEventListener('click',()=>show(null));
  closeButton.addEventListener('click',close);
  root.addEventListener('click',event=>{if(event.target===root) close();});
  // The existing apps own their own close buttons. Return to the icon grid.
  const observer = new MutationObserver(() => {
    if ((app==='delivery'&&delivery.hidden)||(app==='jobs'&&jobs.hidden)) show(null);
  });
  for(const section of [delivery,jobs]) observer.observe(section,{attributes:true,attributeFilter:['hidden']});
  return { open(next: App | null = null) {show(next);closeButton.focus();},close,refresh };
}
