import { pendingHomeQuest, homeQuestContent } from "./shared/homeJobQuests";
import { JOBS, homeJobsFor, shiftFullPay, shiftWage, stageForJob, type JobId } from './shared/jobs';
import type { ComputerDevice } from './shared/computer';
import { CAREERS, CAREER_IDS, CLINIC_MODULES, DETAIL_SERVICES, nextCareerShift, shiftWindow, dayOf,
  type CareerCommand, type CareerProgress } from './shared/careers';
import { CAREER_STORIES, WORK_CHECKS, WORK_EVENT_BY_ID } from './shared/careerCatalog';
import { promotionNeeds } from './shared/careerPromotion';
import { educationalXP, missingKnowledge, skillRank } from './shared/education';
import { MATERIAL_BY_ID, PROGRAMS } from './shared/educationCatalog';
import { clockAt, clockLabel, gameMinutes, timeLabel } from './shared/life';
import { formatRub } from './shared/economy';
import type { CharacterId, GameState } from './shared/protocol';
import type { TimeStatus } from './shared/timeControl';

const weekdays = ['Пн','Вт','Ср','Чт','Пт','Сб','Вс'];
const at = (time: number) => clockLabel(clockAt(time));
const hour = (time: number) => timeLabel(clockAt(time));
const node = <K extends keyof HTMLElementTagNameMap>(tag: K, text = '', className = '') => {
  const n = document.createElement(tag);
  if (text) n.textContent = text;
  if (className) n.className = className;
  return n;
};
function button(text: string, press: () => void, disabled = false) {
  const n = node('button', text, 'career-button');
  n.type = 'button';
  n.disabled = disabled;
  n.addEventListener('click', press);
  return n;
}
function block(title: string, text?: string) {
  const n = node('article', '', 'career-card');
  n.append(node('h3',title));
  if (text) n.append(node('p',text));
  return n;
}
type Submit = (command: CareerCommand) => boolean;

function orderCards(parent: HTMLElement, progress: CareerProgress) {
  for (const order of progress.orders.slice(-4).reverse()) {
    parent.append(block(DETAIL_SERVICES[order.service].name + ' · пост ' + order.bay,
      formatRub(order.agreed) + ' · ' + (order.delivered ? 'Выдано, оценка ' + order.loyalty + '%' : 'Готовность ' + at(order.readyAt))));
  }
}
function taskCard(state: GameState, role: CharacterId, send: Submit, device: ComputerDevice = 'laptop') {
  const shift = state.careers.residents[role].shift!;
  const spec = CAREERS[shift.career], task = shift.task, now = gameMinutes(state.clock);
  const event = task && WORK_EVENT_BY_ID.get(task.event);
  const card = block(event?.title ?? (shift.mode === 'remote' ? 'Алина работает из дома' : 'Рабочая смена'),
    event?.text ?? 'Выполняются текущие обязанности. Новое поручение появится по графику.');
  if (!event || !task) return card;
  const staff = spec.staff[event.author];
  card.prepend(node('small', staff.name + ' · ' + staff.position + ' · ' + event.topic));
  if (task.story) {
    const story = CAREER_STORIES[shift.career].find(item => item.id === task.story)!;
    const entry = state.careers.residents[role].progress[shift.career]!.stories[task.story];
    card.append(node('small', story.title + ' · этап ' + ((entry?.stage ?? 0)+1) + '/' + story.events.length +
      (entry ? entry.outcome >= 0 ? ' · прошлый результат принят' : ' · требуется дополнительная сверка' : '')));
  }
  if (task.phase === 'new') {
    const action = button('Подойти · ' + (shift.mode === 'remote' ? (device === 'laptop' ? 'Ноутбук Алины' : 'ПК Влада') : spec.stations[event.station]),
      () => send({type:'career_approach',nonce:task.nonce}));
    action.dataset.careerApproach = '';
    card.append(action);
  } else if (task.phase === 'walking') card.append(node('p','Персонаж идёт к рабочему месту…'));
  else if (task.phase === 'checking') {
    const checks = WORK_CHECKS[event.id];
    const check = checks[task.checkStep ?? 0];
    card.append(node('small', 'Профессиональная проверка · шаг ' + ((task.checkStep ?? 0) + 1) + '/' + checks.length),
      node('p', check.prompt));
    if (task.hint) card.append(node('small', 'Разбор: ' + task.hint));
    for (const [index,label] of check.options.entries()) {
      const action = button(label,()=>send({type:'career_verify',nonce:task.nonce,choice:index,step:task.checkStep??0}));
      action.dataset.careerVerify=String(index); card.append(action);
    }
  }
  else if (task.phase === 'working') {
    const choice = event.choices[task.choice!];
    const track = node('progress');
    track.max = choice.minutes; track.value = Math.min(choice.minutes, Math.max(0,choice.minutes-(task.readyAt-now)));
    track.setAttribute('aria-label','Прогресс поручения');
    card.append(node('p',choice.label + ' · результат в ' + hour(task.readyAt)),track);
  } else {
    for (const [index,choice] of event.choices.entries()) {
      const need = choice.requires ? missingKnowledge(state.education.characters[role],choice.requires) : [];
      const action = button(choice.label + ' · ' + choice.minutes + ' мин' + (need.length ? ' · нужно: ' + need.join(', ') : ''),
        () => send({type:'career_choose',nonce:task.nonce,choice:index}), need.length > 0 || now + choice.minutes > task.deadline);
      action.dataset.careerChoice = String(index);
      card.append(action);
    }
    card.append(node('small','Срок до ' + hour(task.deadline)));
  }
  return card;
}

type HomeAnswer=(nonce:string,choice:number)=>boolean;
function homeQuestCard(state:GameState,role:CharacterId,answer:HomeAnswer){
  const shift=state.activeShifts[role],now=gameMinutes(state.clock);
  const run=pendingHomeQuest(shift,now);
  if(!shift||!run)return;
  const spec=homeQuestContent(shift,run);
  if(!spec)return;
  const card=block('⚡ '+spec.title,spec.prompt);
  card.classList.add('home-quest-card');
  card.dataset.homeQuest=run.nonce;
  const bonus=Math.max(0,Math.min(150,3500-shiftFullPay(shift)));
  card.append(node('small','Осталось '+(run.until-now)+' игровых мин. · '+(bonus?'бонус '+formatRub(bonus):'бонус настроения')));
  for(const [i,key] of run.order.entries()){
    const choice=button(spec.options[key],()=>{if(answer(run.nonce,i))for(const b of card.querySelectorAll('button'))b.disabled=true;});
    choice.dataset.homeQuestChoice=String(i);card.append(choice);
  }
  card.append(button('Пропустить',()=>{if(answer(run.nonce,-1))for(const b of card.querySelectorAll('button'))b.disabled=true;}));
  return card;
}
export function createCareerHUD(root: HTMLElement, send: Submit, open: () => void,
  home?:{answer:HomeAnswer;leave:()=>boolean}) {
  let previous = '', leaveConfirm='';
  return {
    render(state: GameState | null, role: CharacterId | null) {
      const person = state && role && state.careers.residents[role];
      const shift = person && person.shift;
      const remote=state&&role&&state.activeShifts[role];
      root.hidden = !shift && !remote?.homeDevice;
      if(state&&role&&remote?.homeDevice&&home){
        const now=gameMinutes(state.clock),signature=JSON.stringify([role,remote,now]);
        if(signature===previous)return;
        previous=signature;
        const label=node('header');
        const shiftKey=role+':'+remote.startedAt;
        const leave=button(leaveConfirm===shiftKey?'Подтвердить':'Досрочно',()=>{if(leaveConfirm===shiftKey){if(home.leave())leaveConfirm='';}else{leaveConfirm=shiftKey;leave.textContent='Подтвердить';}});
        label.append(node('strong','💻 '+JOBS[remote.job].name),leave);
        const fraction=Math.max(0,Math.min(1,(now-remote.startedAt)/(remote.endsAt-remote.startedAt)));
        const progress=node('progress');progress.max=1;progress.value=fraction;
        const details=node('small',now<remote.startedAt?'Идёт к компьютеру':stageForJob(remote.job,fraction)+' · '+Math.round(fraction*100)+'% · '+formatRub(shiftFullPay(remote)));
        root.replaceChildren(label,progress,details);
        const quest=homeQuestCard(state,role,home.answer);
        if(quest)root.append(quest);
        return;
      }
      if (!state || !role || !shift || !person) { previous = ''; leaveConfirm=''; root.replaceChildren(); return; }
      const p = person.progress[shift.career]!;
      const signature = JSON.stringify([shift,gameMinutes(state.clock),p.history.at(-1)]);
      if (signature === previous) return;
      previous = signature;
      const spec = CAREERS[shift.career];
      const label = node('header');
      label.append(node('strong',shift.mode === 'remote' ? 'Алина работает из дома' : spec.employer),
        button('Карьера',open));
      const task = taskCard(state,role,send);
      const last = p.history.at(-1);
      if (last?.choice && !shift.task) task.append(node('small',last.text));
      root.replaceChildren(label,task);
    },
  };
}

export function createCareerUI(root: HTMLElement, send: Submit, education: (materialId: string) => void,
  close: () => void, vote: (enabled: boolean) => boolean, device: () => ComputerDevice = () => 'laptop', homeOrders?: {start:(id:JobId)=>boolean;leave:()=>boolean;answer:HomeAnswer}) {
  const labels = { job:'Работа', vacancies:homeOrders?'Работа из дома':'Вакансии', inbox:'Письма', pay:'Зарплата' };
  let page: keyof typeof labels = 'job';
  let prior = '', confirmed = '';
  let historyCareer: typeof CAREER_IDS[number] | undefined;
  function render(state: GameState, role: CharacterId, time: TimeStatus) {
    const person = state.careers.residents[role], shift = person.shift, id = person.contract?.career, now = gameMinutes(state.clock);
    const signature = JSON.stringify([page,confirmed,historyCareer,person,now,role,time,state.education.characters[role],state.activeShifts[role],
      Object.values(state.careers.residents).map(member=>Boolean(member.shift))]);
    if (prior === signature) return;
    prior = signature;
    const scroll = root.scrollTop;
    const section = node('section','','career-phone');
    const tabs = node('nav','','career-tabs');
    for (const [value,label] of Object.entries(labels) as [keyof typeof labels,string][]) {
      const tab = button(label, () => { page=value; confirmed=''; render(state,role,time); root.scrollTop=0; });
      tab.setAttribute('aria-current',value===page?'page':'false');
      tab.dataset.careerTab = value;
      tabs.append(tab);
    }
    if(homeOrders)tabs.classList.add('home-career-tabs');
    section.append(tabs);
    if (Object.values(state.careers.residents).some(p=>p.shift)) {
      const enabled = time.shiftVotes.includes(role);
      section.append(button((enabled?'✓ ':'')+'Согласие на скорость ×1,5',()=>vote(!enabled)));
    }
    function confirm(key: string, label: string, action: CareerCommand) {
      return button(confirmed === key ? 'Подтвердить · ' + label : label, () => {
        if (confirmed === key) { if (send(action)) confirmed=''; }
        else confirmed=key;
        render(state,role,time);
      });
    }
    if (page === 'inbox' || page === 'pay') {
      section.append(node('h2',page==='inbox'?'Рабочая переписка':'Зарплата и премии'));
      const available = CAREER_IDS.filter(key=>person.progress[key]);
      const selected = historyCareer && available.includes(historyCareer) ? historyCareer : id ?? available[0];
      if (available.length > 1) {
        const selector = node('select'); selector.setAttribute('aria-label','История работодателя');
        for (const key of available) {
          const choice = node('option',CAREERS[key].employer); choice.value=key; selector.append(choice);
        }
        selector.value=selected;
        selector.addEventListener('change',()=>{historyCareer=available.find(key=>key===selector.value);render(state,role,time);});
        section.append(selector);
      }
      const spec = selected && CAREERS[selected];
      const events = selected ? person.progress[selected]!.history.filter(entry=>page==='inbox' || entry.pay !== undefined).slice(-24).reverse() : [];
      if (!events.length || !spec) section.append(block('История пока пуста'));
      else for (const item of events) {
        const author = item.author === undefined ? spec.employer : spec.staff[item.author]?.name + ' · ' + spec.employer;
        const card = block(item.title,item.text);
        card.prepend(node('small',author+' · '+at(item.at)));
        if (item.choice) card.append(node('small','Решение · '+item.choice));
        section.append(card);
      }
    } else if(page==='vacancies' && homeOrders) {
      section.append(node('h2','Работа из дома'),node('p','Разовые проекты · 2–3 игровых часа · 2 000–3 500 ₽. Во время заказа появляются мини-задания с бонусом за правильный ответ.'));
      const active=state.activeShifts[role];
      if(active?.homeDevice){
        const spec=JOBS[active.job],fraction=Math.max(0,Math.min(1,(now-active.startedAt)/(active.endsAt-active.startedAt)));
        const card=block('В работе · '+spec.name,now<active.startedAt?'Персонаж идёт к компьютеру':stageForJob(active.job,fraction));
        const progress=node('progress');progress.max=1;progress.value=fraction;
        card.append(progress,node('p',Math.round(fraction*100)+'% · осталось '+Math.max(0,active.endsAt-Math.max(now,active.startedAt))+' мин.'),node('small','Оплата: '+formatRub(shiftFullPay(active))),button('Завершить досрочно · '+formatRub(shiftWage(active,state.clock)),()=>homeOrders.leave()));section.append(card);
        const quest=homeQuestCard(state,role,homeOrders.answer);if(quest)section.append(quest);
      }
      if(role==='vlad'&&device()!=='desktop')section.append(block('Заказы Влада доступны на ПК'));
      else for(const key of homeJobsFor(role)){
        const job=JOBS[key],card=block(job.emoji+' '+job.name,job.description);
        card.append(node('small','2–3 игровых часа · 2 000–3 500 ₽'),node('small',job.stages.join(' → ')),button('Взять заказ',()=>{if(homeOrders.start(key))close();},Boolean(active||shift||state.world.places[role]!=='home')));section.append(card);
      }
    } else if (page === 'vacancies' || !id) {
      section.append(node('h2',homeOrders?'Основная работа':'Вакансии'));
      for (const career of CAREER_IDS.filter(candidate=>CAREERS[candidate].owner===role)) {
        const spec = CAREERS[career], progress = person.progress[career], rank = progress?.rank ?? 0;
        const card = block(spec.icon + ' ' + spec.title,spec.employer);
        const window = nextCareerShift(career,now,person.lastDay);
        card.append(node('p',spec.roles[rank][0]+' · '+formatRub(spec.roles[rank][1])+' за полную смену'),
          node('small','График '+spec.days.map(day=>weekdays[day]).join(', ')+' · '+hour(window.start)+'–'+hour(window.end) +
            (spec.remoteDays ? ' · дома по '+spec.remoteDays.map(day=>weekdays[day]).join(', ') : '')));
        const sign = id && id !== career ? confirm(career,'Сменить работу',{type:'career_hire',career})
          : button(id === career ? 'Текущий контракт' : 'Подписать договор',()=>send({type:'career_hire',career}),Boolean(shift || id===career || state.activeShifts[role]));
        sign.dataset.hire = career;
        card.append(sign);
        const list = node('ol','','career-ranks');
        for (const [name,pay] of spec.roles) list.append(node('li',name+' · '+formatRub(pay)));
        card.append(list); section.append(card);
      }
    } else {
      const spec = CAREERS[id], p = person.progress[id]!;
      const hero = block(spec.icon+' '+spec.employer,spec.roles[p.rank][0]+' · '+formatRub(spec.roles[p.rank][1])+' за полную смену');
      hero.classList.add('career-hero');
      hero.append(node('p','Репутация '+p.reputation+'% · Опыт '+p.experience+' · Смены '+p.shifts),
        node('small','Последняя продуктивность '+p.productivity+'% · Поручения '+p.duties));
      const work = p.workplace;
      const trustName = id==='it' ? 'Надёжность команды' : id==='detail' ? 'Доверие клиентов'
        : id==='marketing' ? 'Доверие агентства' : 'Доверие посетителей';
      hero.append(node('small',trustName+' '+(work?.trust??50)+'% · Нерешённые вопросы '+(work?.backlog??0)+
        ' · Улучшения '+(work?.improvements??0)));
      if ((work?.backlog??0) >= 3) hero.append(node('small',
        'На следующей смене может прийти отдельное поручение по разбору накопившихся вопросов.'));
      section.append(hero);
      if (shift) {
        const current = block(shift.mode === 'remote' ? 'Алина работает из дома' : 'Смена идёт',
          'До '+hour(shift.endsAt)+' · поручений выполнено '+shift.completed+' · пропущено '+shift.missed+
          (shift.completed ? ' · качество работы '+Math.round(shift.score/shift.completed)+'%' : ''));
        current.append(taskCard(state,role,send,device()),button('Закрыть рабочее окно',close),
          button('Взять дополнительный час',()=>send({type:'career_overtime'}),
            shift.overtime || now<shift.regularEnd-90 || now>=shift.regularEnd || p.reputation<55),
          confirm('leave','Уйти досрочно',{type:'career_leave'}));
        section.append(current);
      } else {
        const next = nextCareerShift(id,now,person.lastDay);
        const today = shiftWindow(id,dayOf(now));
        const allowed = today.open && person.lastDay<today.day && now>=today.start && now<=today.end-60 &&
          !state.activeShifts[role] && (today.mode!=='remote'||state.world.places[role]==='home');
        const card = block('График',at(next.start)+'–'+hour(next.end)+' · '+(next.mode==='remote'?'удалённо':'на месте'));
        card.append(node('small','Первые 30 отработанных минут без оплаты при раннем уходе. Опоздание свыше 30 минут снижает репутацию.'),
          button(today.mode==='remote'?'Начать из дома':'Отправиться на смену',()=>{if(send({type:'career_start'})) close();},!allowed),
          confirm('resign','Уволиться',{type:'career_resign'}));
        section.append(card);
      }
      const rules = promotionNeeds(state,role,id,p);
      const promotion = block('Продвижение',p.rank<4 ? spec.roles[p.rank+1][0]+' · '+formatRub(spec.roles[p.rank+1][1]) : 'Высшая должность');
      if (p.rank < 4) {
        for (const rule of rules.missing) promotion.append(node('small','• '+(PROGRAMS[rule]?.name ?? rule)));
        if (!rules.missing.length) promotion.append(node('small',p.evaluation?'Оценка руководителя пройдена':'В следующую смену доступна оценка руководителя'));
        promotion.append(button('Подать заявку',()=>send({type:'career_promote'}),Boolean(shift || rules.missing.length || !p.evaluation)));
        const profile = state.education.characters[role];
        const options = rules.recommendations.map(key=>MATERIAL_BY_ID.get(key)).filter(item=>item!==undefined);
        const suggestion = rules.missing.length && options.find(item=>
          item.min<=skillRank(profile.xp[item.skill]).level && (item.program && rules.missing.includes(item.program) ||
            item.certificate && rules.missing.includes(item.certificate) || !item.price && educationalXP(item,role,profile)>0));
        if (suggestion) promotion.append(button('К обучению · '+suggestion.title,()=>education(suggestion.id)));
      }
      section.append(promotion);
      if (id==='clinic') section.append(block('Игровая квалификация · Клинический практикум',
        p.clinicModules+'/'+CLINIC_MODULES.length+' модулей с наставником. Модули открываются после качественно отработанных смен.'));
      if (id==='detail') orderCards(section,p);
      if (p.campaign) section.append(block('Последняя кампания',formatRub(p.campaign.budget)+' · охват '+p.campaign.reach+
        ' · взаимодействия '+p.campaign.engagement+' · заявки '+p.campaign.leads));
      if (p.clinic) section.append(block('Учебная карточка №'+p.clinic.reference,
        'Наблюдений '+p.clinic.observations+' · '+(p.clinic.reviewed?'проверена наставником':'требуется сверка')));
      for (const story of CAREER_STORIES[id]) {
        const entry = p.stories[story.id];
        if (entry) section.append(block(story.title,'Выполнено этапов '+entry.stage+'/'+story.events.length));
      }
      const staff = block('Команда');
      for (const contact of spec.staff) staff.append(node('p',contact.name+' · '+contact.position+'. '+contact.approach));
      section.append(staff);
    }
    root.replaceChildren(section);
    root.scrollTop = scroll;
  }
  return { render, open(){prior='';confirmed='';historyCareer=undefined;page='job';} };
}
