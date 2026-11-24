import { JOBS, JOB_IDS, stageForJob, shiftWage, shiftWorkedMinutes, shiftFullPay, type JobId } from './shared/jobs';
import { formatRub } from './shared/economy';
import { totalGameMinutes } from './shared/jobs';
import { names, type GameState, type CharacterId } from './shared/protocol';
import type { TimeStatus } from './shared/timeControl';

const create=<K extends keyof HTMLElementTagNameMap>(tag:K,cls='',value=''):HTMLElementTagNameMap[K]=>{
  const node=document.createElement(tag);
  if(cls)node.className=cls;
  if(value)node.textContent=value;
  return node;
};
function control(label:string,callback:()=>void,cls='',disabled=false):HTMLButtonElement {
  const b=create('button',cls,label);b.type='button';b.disabled=disabled;b.addEventListener('click',callback);return b;
}
export interface JobBoard {
  open:(state:GameState,role:CharacterId)=>void;
  refresh:(state:GameState)=>void;
  close:()=>void;
}
export function makeJobBoard(root:HTMLElement,
  sendStart:(id:JobId)=>boolean,sendLeaveEarly:()=>boolean,
  sendSpeedVote:(enabled:boolean)=>boolean, getTime:()=>TimeStatus,
  getOnline:()=>CharacterId[]):JobBoard {
  let state:GameState|null=null;
  let role:CharacterId='vlad';
  let busy=false;
  const close=()=>{root.hidden=true;root.replaceChildren();};
  function draw():void {
    if(root.hidden||!state)return;
    const scrollTop=root.querySelector<HTMLElement>('.jobs-scroll')?.scrollTop??0;
    root.replaceChildren();
    const wrap=create('div','jobs-card');
    wrap.setAttribute('role','dialog');
    wrap.setAttribute('aria-label','Биржа подработок');
    const head=create('div','jobs-head');
    const label=create('div','jobs-title');
    label.append(create('strong','','🧰 Подработки города'),
      create('small','','Смены в игровых часах · реальные выплаты в ₽'));
    head.append(label,control('✕',close,'jobs-close'));
    wrap.append(head);
    const intro=create('p','jobs-intro',
      'Выбирай смену и следи за её этапами. Склады Ozon и Wildberries находятся в промзоне. Можно начать смену здесь или у входа в склад.');
    wrap.append(intro);
    const scroll=create('div','jobs-scroll');
    const now=totalGameMinutes(state.clock);
    for(const r of ['vlad','alina'] as const) {
      const s=state.activeShifts[r];
      if(!s)continue;
      const p=JOBS[s.job];
      const percent=Math.max(0,Math.min(1,(now-s.startedAt)/(s.endsAt-s.startedAt)));
      const card=create('div','jobs-active');
      card.append(create('strong','','🚧 '+names[r]+' на смене: '+p.emoji+' '+p.name));
      card.append(create('p','',''+p.location+' · '+s.hours+' игровых часов'));
      const progress=create('div','jobs-progress');const fill=create('i');
      fill.style.width=Math.round(percent*100)+'%';progress.append(fill);
      card.append(progress,create('small','',Math.round(percent*100)+'% · '+stageForJob(s.job,percent)));
      const minutesRemain=Math.max(0,s.endsAt-now);
      card.append(create('small','','Осталось '+Math.ceil(minutesRemain/60)+' ч. '+Math.round(minutesRemain%60)+' мин. игрового времени (≈'+Math.ceil(minutesRemain/0.5/60)+' мин. реального времени при непрерывной игре)'));
      card.append(create('strong','jobs-earnings','Отработано: '+(shiftWorkedMinutes(s,state.clock)/60).toFixed(1).replace('.',',')+
        ' ч. · при уходе сейчас: '+formatRub(shiftWage(s,state.clock))+
        ' · за полную смену: '+formatRub(shiftFullPay(s))));
      if(r===role)card.append(control('Завершить досрочно · получить '+formatRub(shiftWage(s,state.clock)),()=>{
        if(sendLeaveEarly())busy=true;draw();
      },'jobs-abort',busy));
      scroll.append(card);
    }
    if (Object.values(state.activeShifts).some(Boolean)) {
      const status = getTime();
      const agreed = status.shiftVotes.includes(role);
      const votes = getOnline().filter(id => status.shiftVotes.includes(id)).length;
      const note = create('div', 'jobs-active');
      note.append(create('strong', '', '⏩ Ускорение подработок · ×1,5'),
        create('small', '', status.multiplier === 1.5
          ? 'Ускорение включено по согласию всех игроков онлайн.'
          : 'Согласие: ' + votes + ' из ' + getOnline().length +
            '. Если второй игрок онлайн, он тоже должен нажать кнопку в разделе «Подработки».'));
      note.append(control(agreed ? 'Вернуть обычное время ×1' : 'Разрешить ускорение ×1,5', () => {
        if (sendSpeedVote(!agreed)) busy = false;
      }, 'jobs-speed'));
      scroll.append(note);
    }
    if(state.shiftDays[role]===state.clock.day)
      scroll.append(create('p','jobs-message','Сегодня смена уже оплачена. Следующую можно взять завтра.'));
    const working=Boolean(state.activeShifts[role]);
    for(const id of JOB_IDS) {
      const job=JOBS[id];
      const card=create('article','jobs-offer');
      const heading=create('div','jobs-offer-heading');
      heading.append(create('strong','',job.emoji+' '+job.name),
        create('span','',''+formatRub(job.payMin)+'–'+formatRub(job.payMax)));
      card.append(heading,create('small','jobs-location','📍 '+job.location));
      card.append(create('p','jobs-description',job.description));
      const spec=create('div','jobs-spec');
      spec.append(create('span','','⏰ '+job.hoursMin+'–'+job.hoursMax+' игровых часов'),
        create('span','','🎲 Полная смена — вся ставка, досрочный уход — по часам'));
      card.append(spec);
      const phases=create('div','jobs-phases');
      phases.append(create('small','','Что будет происходить:'));
      const steps=create('ol');
      for(const stage of job.stages)steps.append(create('li','',stage));
      phases.append(steps);card.append(phases);
      card.append(control('Начать смену',()=>{
        if(sendStart(id)){busy=true;draw();}
      },'jobs-start',working||busy||state.shiftDays[role]===state.clock.day||
        state.characters[role].energy<25||state.characters[role].hunger<20));
      scroll.append(card);
    }
    wrap.append(scroll);root.append(wrap);
    root.querySelector<HTMLElement>('.jobs-scroll')?.scrollTo({top:scrollTop});
  }
  return {
    close,
    open(household,character){state=household;role=character;busy=false;root.hidden=false;draw();},
    refresh(household){state=household;busy=false;draw();},
  };
}
