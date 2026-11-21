import { renderRelationship } from './socialUI';
import type { SocialGroup } from './shared/socialLife';
import { createBillingUI, type BillingApp } from './billingUI';
import { createEducationUI, educationAppointments, type EducationView } from './educationUI';
import { createCareerUI } from './careerUI';
import { CAREERS, nextCareerShift, type CareerCommand } from './shared/careers';
import { MATERIAL_BY_ID } from './shared/educationCatalog';
import type { EducationCommand } from './shared/education';
import type { ServiceCommand } from './shared/services';
import { formatRub } from './shared/economy';
import { JOBS } from './shared/jobs';
import { clockAt, clockLabel, gameDate, gameMinutes, NEED_INFO, VITAL_NEEDS, type GameClock } from './shared/life';
import { PLACES } from './shared/locations';
import { PETS, PET_IDS } from './shared/pets';
import { petWish } from './shared/petWishes';
import { names, type CharacterId, type GameState } from './shared/protocol';
import type { TimeStatus } from './shared/timeControl';

type App = 'delivery' | 'jobs' | 'calendar' | 'family' | 'pets' | 'education' | 'career' | 'relationship' | BillingApp;
const billingApps = new Set<App>(['finance','subscriptions','utilities','internet','mobile']);
const apps: Record<App,[string,string]> = {
  finance:['💳','Финансы'], subscriptions:['📺','Подписки'], internet:['🌐','Интернет'],
  utilities:['🏠','ЖКХ'], mobile:['📱','Мобильная связь'],
  delivery:['🛍️','Доставка'],jobs:['🧰','Подработки'],calendar:['📅','Календарь'],
  family:['❤️','Семья'],pets:['🐾','Питомцы'],education:['🎓','Навыки и развитие'],
  career:['💼','Работа и карьера'],relationship:['♥','Мы вместе'],
};
type View = {state:GameState;role:CharacterId;online:CharacterId[];time:TimeStatus;clock:GameClock};

export function createPhone(root: HTMLElement, delivery: HTMLElement, jobs: HTMLElement,
  read: () => View | null, openDelivery: (state: GameState) => void,
  openJobs: (state: GameState,role:CharacterId) => void, closeApps: () => void,
  sendService: (command: ServiceCommand) => boolean, sendEducation: (command: EducationCommand) => boolean,
  travelToCenter: () => boolean, sendCareer: (command: CareerCommand) => boolean, vote: (enabled: boolean) => boolean,
  social: {suggest:(group:SocialGroup,id?:string)=>void; offer:()=>void; pending:()=>boolean}) {
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
  const billing = createBillingUI(info, sendService);
  const education = createEducationUI(info, sendEducation, () => close(), travelToCenter);
  const career = createCareerUI(info, sendCareer, id => {
    const material = MATERIAL_BY_ID.get(id);
    if (material) show('education',material.channel,undefined,id);
  }, () => close(), vote);
  const back=root.querySelector<HTMLButtonElement>('[data-phone-back]')!;
  const closeButton=root.querySelector<HTMLButtonElement>('[data-phone-close]')!;
  const owner=root.querySelector<HTMLElement>('[data-phone-owner]')!;
  const clock=root.querySelector<HTMLElement>('[data-phone-clock]')!;
  screen.append(delivery,jobs);
  let app: App | null = null;
  let calendarDate: HTMLElement | null = null;

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
    root.dataset.owner=role;
    owner.textContent=names[role]+(app?' · '+apps[app][1]:'');
    if (app && billingApps.has(app)) billing.renderPage(state, app as BillingApp);
    if (app === 'education') education.render(state, role);
    if (app === 'career') career.render(state,role,time);
    if (app === 'relationship') {
      const scroll=info.scrollTop;
      renderRelationship(info,state,role,social.suggest,social.offer,social.pending());
      info.scrollTop=scroll;
    }
    if (app==='calendar') {
      const shift=state.activeShifts[role];
      const end=shift?.endsAt;
      const ending=end===undefined?'':clockLabel(clockAt(end));
      const work=state.careers.residents[role];
      const careerId=work.contract?.career;
      const careerDate=careerId&&nextCareerShift(careerId,gameMinutes(state.clock),work.lastDay);
      const today=block('📅 Сегодня','');
      calendarDate=today.querySelector('p');
      info.replaceChildren(
        today,
        block('🧰 Подработка',shift ? JOBS[shift.job].name+' · окончание '+ending : 'Активной смены нет'),
        ...(careerId&&careerDate?[block('💼 '+CAREERS[careerId].employer,work.shift ? 'Смена до '+clockLabel(clockAt(work.shift.endsAt)) :
          clockLabel(clockAt(careerDate.start))+(careerDate.mode==='remote'?' · из дома':''))]:[]),
        block('⏱ Скорость общего времени','×'+time.multiplier.toLocaleString('ru-RU')),
        ...educationAppointments(state, role).slice(0, 8).map(item =>
          block('🎓 '+item.title, 'Занятие '+item.lesson+' · '+clockLabel(clockAt(item.at)))));
    }
    if (app==='family') {
      const family=(['vlad','alina'] as const).map(id => {
        const place=state.activeShifts[id]?'На подработке':state.careers.residents[id].shift?.mode==='remote'?'Работает из дома':PLACES[state.world.places[id]].name;
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
    if (app==='pets') {
      const cards=PET_IDS.map(id => {
        const pet=state.pets[id];
        const wish=petWish(state,id);
        const card=block(PETS[id].emoji+' '+PETS[id].name+' · '+wish.title,
          wish.message+'\n\nПодсказка: '+wish.advice);
        card.classList.add('pet-phone-card');
        if (wish.urgent) card.classList.add('pet-phone-urgent');
        const stats=document.createElement('small');
        stats.textContent='Сытость '+Math.round(pet.satiety)+'% · Энергия '+Math.round(pet.energy)+
          '% · Настроение '+Math.round(pet.happiness)+'% · Миска '+state.petBowls[id]+'/3';
        card.append(stats);
        return card;
      });
      info.replaceChildren(block('💭 О чём думают питомцы?',
        'Это примерное настроение по их потребностям и привычкам. Тексты меняются со временем.'),...cards);
    }
    refreshClock(view.clock);
  }

  function refreshClock(value: GameClock) {
    if (root.hidden) return;
    const label=clockLabel(value);
    if (clock.textContent!==label) clock.textContent=label;
    if (app==='calendar'&&calendarDate) {
      const today=label+' · '+gameDate(value.day).season;
      if (calendarDate.textContent!==today) calendarDate.textContent=today;
    }
  }

  function show(next: App | null, educationView?: EducationView, room?: string, materialId?: string) {
    const view=read();
    if (!view) return;
    closeApps();
    app=next;
    if (next === 'education') education.open(educationView, room, materialId);
    if (next === 'career') career.open();
    root.hidden=false;
    back.hidden=!next;
    grid.hidden=Boolean(next);
    info.hidden=next!=='relationship'&&next!=='education'&&next!=='career'&&next!=='calendar'&&next!=='family'&&next!=='pets'&&(!next||!billingApps.has(next));
    billing.reset();
    info.scrollTop=0;
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
  return { open(next: App | null = null) {show(next);closeButton.focus();},close,refresh,refreshClock,
    openEducation(view: EducationView, room?: string) { show('education', view, room); closeButton.focus(); },
    educationMessage(message: string) {
      if (app !== 'education' || root.hidden) return false;
      education.feedback(message); refresh(); return true;
    },
    billingMessages(messages: string[]) { billing.setMessages(messages); refresh(); } };
}
