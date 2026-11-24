import { electronicsModel } from './shared/electronics';
import { renderRelationship } from './socialUI';
import type { createThoughtUI, ThoughtPreferences } from './thoughtUI';
import { residentEmotion,PERSONALITIES,activeEmotions,EVENTS } from './shared/emotions';
import { AUTONOMY_LABELS, AUTONOMY_MODES, thoughtFor, type AutonomyMode } from './shared/autonomy';
import type { SocialGroup } from './shared/socialLife';
import type { FamilyMomentId } from './shared/familyMoments';
import { createBillingUI, type BillingApp } from './billingUI';
import { createEducationUI, educationAppointments, type EducationView } from './educationUI';
import { createCareerUI } from './careerUI';
import { CAREERS, nextCareerShift, type CareerCommand } from './shared/careers';
import { MATERIAL_BY_ID } from './shared/educationCatalog';
import type { EducationCommand } from './shared/education';
import type { ServiceCommand } from './shared/services';
import type { BudgetCommand } from './shared/familyBudget';
import { formatRub } from './shared/economy';
import { JOBS } from './shared/jobs';
import { clockAt, clockLabel, gameDate, gameMinutes, NEED_INFO, VITAL_NEEDS, type GameClock } from './shared/life';
import { PLACES } from './shared/locations';
import { PETS, PET_IDS } from './shared/pets';
import { petWish } from './shared/petWishes';
import { names, type CharacterId, type GameState } from './shared/protocol';
import type { TimeStatus } from './shared/timeControl';
import { gameAudio,AUDIO_LABELS,type AudioChannel } from './game/GameAudio';
import { hapticsEnabled, setHapticsEnabled, subtleHaptic } from './mobileHaptics';

import {vacuumItem,vacuumState,type VacuumCommand} from './shared/vacuum';
import {VACUUM_MODELS,type VacuumSku} from './shared/vacuumCatalog';
import {DUST_ROOMS,initialDust,cleanliness,dustStage,type DustRoomId} from './shared/homeDust';
import {speakerItems,speakerDevice,type SpeakerCommand,type SpeakerAction} from './shared/speaker';
import {SPEAKER_MODELS,MUSIC_GENRES,trackInfo,type SpeakerSku,type MusicGenre} from './shared/speakerCatalog';
import {roomAt} from './shared/homeDust';
import {FITNESS_PASSES,FITNESS_PROGRAMS,fitnessExercise,type FitnessProgramId,fitnessStats,fitnessForm,fitnessBonuses,fitnessProfile,fitnessAccess,fitnessBookingSlots,type FitnessCommand,type FitnessPass} from './shared/fitness';

type App = 'fitness' | 'speakers' | 'home' | 'audio' | 'feed' | 'furnishing' | 'delivery' | 'jobs' | 'calendar' | 'family' | 'pets' | 'education' | 'career' | 'relationship' | 'autonomy' | BillingApp;
const billingApps = new Set<App>(['finance','subscriptions','utilities','internet','mobile']);
const apps: Record<App,[string,string]> = {
  fitness:['🏋️','PULSE Fitness'],
  speakers:['🔊','Умные колонки'],
  home:['🏠','Чистота дома'],
  feed:['📲','Лента'],
  audio:['🔊','Звук'],
  finance:['💳','Финансы'], subscriptions:['📺','Подписки'], internet:['🌐','Интернет'],
  utilities:['🏠','ЖКХ'], mobile:['📱','Мобильная связь'],
  furnishing:['🛋️','Мебель и дом'],delivery:['🛍️','Доставка'],jobs:['🧰','Подработки'],calendar:['📅','Календарь'],
  family:['❤️','Семья'],pets:['🐾','Питомцы'],education:['🎓','Обучение и курсы'],
  career:['💼','Работа и карьера'],relationship:['♥','Мы вместе'],
  autonomy:['🧠','Жизнь и привычки'],
};
type View = {state:GameState;role:CharacterId;online:CharacterId[];time:TimeStatus;clock:GameClock};

export function createPhone(root: HTMLElement, delivery: HTMLElement, jobs: HTMLElement,
  read: () => View | null, openDelivery: (state: GameState) => void,
  openJobs: (state: GameState,role:CharacterId) => void, closeApps: () => void,
  sendService: (command: ServiceCommand) => boolean, sendBudget: (command: BudgetCommand) => boolean,
  sendEducation: (command: EducationCommand) => boolean,
  travelToCenter: () => boolean, sendCareer: (command: CareerCommand) => boolean, vote: (enabled: boolean) => boolean,
  social: {suggest:(group:SocialGroup,id?:string)=>void; moment:(id:FamilyMomentId)=>void; offer:()=>void; pending:()=>boolean; current:()=>string|undefined},
  openFurnishing:()=>void, setAutonomy:(mode:AutonomyMode)=>boolean,
  thoughts:ReturnType<typeof createThoughtUI>,openFeed?:()=>boolean,cleanRoom?:(room:DustRoomId)=>boolean,vacuumControl?:(command:VacuumCommand)=>boolean,speakerControl?:(command:SpeakerCommand)=>boolean,fitnessControl?:(command:FitnessCommand)=>boolean) {
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
  const billing = createBillingUI(info, sendService, sendBudget);
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
  let speakerKey='',fitnessKey='';
  const alarmTimes=new Map<number,string>();
  const expandedSpeakers=new Map<number,boolean>();
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
    if(app==='fitness'){
      const p=fitnessProfile(state,role),now=gameMinutes(state.clock),key=JSON.stringify([role,p,state.money,Math.floor(now/60),state.world.places[role],state.world.carDriver]);
      if(key!==fitnessKey){
        fitnessKey=key;const scroll=info.scrollTop;
        const formatTime=(at:number)=>{const c=clockAt(at);return 'День '+c.day+' · '+String(Math.floor(c.minute/60)).padStart(2,'0')+':'+String(c.minute%60).padStart(2,'0')};
        const card=block('PULSE Fitness',p.until>now?'Абонемент до: '+formatTime(p.until):p.visit?'Разовое посещение активно':p.ticket?'Разовый билет куплен':'Нет действующего абонемента');
        for(const pass of Object.keys(FITNESS_PASSES) as FitnessPass[]){const product=FITNESS_PASSES[pass],b=document.createElement('button');b.type='button';b.textContent=product.name+' · '+product.price.toLocaleString('ru-RU')+' ₽';b.disabled=state.money<product.price||pass==='single'&&(fitnessAccess(state,role)||!!p.ticket);b.onclick=()=>fitnessControl?.({type:'fitness_pass',pass});card.append(b);}
        if(state.world.places[role]==='home'&&!state.world.carDriver){const b=document.createElement('button');b.type='button';b.textContent='Поехать вдвоём';b.onclick=()=>fitnessControl?.({type:'fitness_trip'});card.append(b);}
        const booking=block('Запись',p.booking!==undefined&&p.booking>=now?'Записан: '+formatTime(p.booking):'Выбери удобное время.');
        const select=document.createElement('select');select.setAttribute('aria-label','Время посещения');
        for(const at of fitnessBookingSlots(now)){const option=document.createElement('option');option.value=String(at);option.textContent=formatTime(at);select.append(option);}
        const book=document.createElement('button');book.type='button';book.textContent='Записаться';book.onclick=()=>fitnessControl?.({type:'fitness_book',at:Number(select.value)});
        booking.append(select,book);if(p.booking!==undefined){const b=document.createElement('button');b.type='button';b.textContent='Отменить запись';b.onclick=()=>fitnessControl?.({type:'fitness_cancel'});booking.append(b);}
        const stats=fitnessStats(state,role),bonus=fitnessBonuses(state,role);
        const form=block('Физическая форма · '+Math.round(fitnessForm(state,role))+'%', 'Сила '+Math.round(stats.strength)+'% · Выносливость '+Math.round(stats.endurance)+'% · Гибкость '+Math.round(stats.flexibility)+'% · Восстановление '+Math.round(stats.recovery)+'%');
        form.append(block('Мышечная усталость · '+Math.round(p.fatigue)+'%','Завершено упражнений: '+(p.workouts??0)+' · Расход энергии −'+Math.round((1-bonus.energyDrain)*100)+'%'));
        const programs=block('Готовые тренировки','Выбери программу в клубе — персонаж сам сменит тренажёры.');
        for(const id of Object.keys(FITNESS_PROGRAMS) as FitnessProgramId[]){const program=FITNESS_PROGRAMS[id],b=document.createElement('button');b.type='button';b.textContent=program.name+' · '+program.stations.length+' упр.';b.disabled=state.world.places[role]!=='fitness'||!fitnessAccess(state,role);b.onclick=()=>{if(fitnessControl?.({type:'fitness_program',program:id}))close();};programs.append(b);}
        const history=block('Последние упражнения',p.history?.length?'':'Тренировок пока нет.');
        for(const h of p.history??[]){const line=document.createElement('p');line.textContent='День '+h.day+' · '+(fitnessExercise(h.facility)?.name??'Тренировка');history.append(line);}
        info.replaceChildren(card,booking,programs,form,history);info.scrollTop=scroll;
      }
    }
    if(app==='speakers'){
      const items=speakerItems(state),key=JSON.stringify([items,state.speakers,state.world.places[role]]);
      if(key!==speakerKey){
        speakerKey=key;const scroll=info.scrollTop;
        const intro=block('Умные колонки',items.length?'Музыка звучит в доме для обоих игроков.':'Купи колонку в «Импульсе» и размести её из склада мебели.');
        const cards=items.map(item=>{
          const m=SPEAKER_MODELS[item.sku as SpeakerSku],d=speakerDevice(state,item.id),where=roomAt(item)?.label??'Дом';
          const card=block(m.name+' · '+where,m.assistant+' · '+(d.track?trackInfo(d.track).title:'Музыка выключена'));card.dataset.speakerId=String(item.id);card.classList.add('speaker-card');
          const disabled=state.world.places[role]!=='home';
          const send=(action:SpeakerAction,extra:Partial<SpeakerCommand>={})=>speakerControl?.({type:'speaker_control',id:item.id,action,...extra});
          const button=(title:string,action:SpeakerAction,extra:Partial<SpeakerCommand>={})=>{const b=document.createElement('button');b.type='button';b.textContent=title;b.disabled=disabled;b.onclick=()=>send(action,extra);return b;};
          const genres=document.createElement('select');genres.setAttribute('aria-label','Жанр музыки');genres.disabled=disabled;
          for(const [id,label] of Object.entries(MUSIC_GENRES)){const o=document.createElement('option');o.value=id;o.textContent=label;genres.append(o);}
          if(d.track)genres.value=trackInfo(d.track).genre;
          const play=button('Включить музыку','play');play.onclick=()=>send('play',{genre:genres.value as MusicGenre});
          card.append(genres,play,button('Случайный трек','random'),button('Следующий','next'),button('Стоп','stop'));
          const vol=document.createElement('input'),volLabel=document.createElement('label');vol.type='range';vol.min='0';vol.max='100';vol.step='5';vol.value=String(d.volume);vol.disabled=disabled;vol.setAttribute('aria-label','Громкость колонки');
          volLabel.textContent='Громкость '+d.volume+'%';vol.oninput=()=>{volLabel.textContent='Громкость '+vol.value+'%';};vol.onchange=()=>send('volume',{volume:Number(vol.value)});card.append(volLabel,vol);
          const commands=document.createElement('details');const summary=document.createElement('summary');summary.textContent='Команды: '+m.assistant;commands.append(summary);commands.open=expandedSpeakers.get(item.id)??false;commands.ontoggle=()=>expandedSpeakers.set(item.id,commands.open);
          for(const [action,title] of [['weather','Какая погода?'],['time','Который час?'],['joke','Расскажи анекдот'],['morning','Доброе утро'],['night','Спокойной ночи'],['vacuum','Запусти пылесос']] as const)commands.append(button(title,action));
          const alarm=document.createElement('input');alarm.type='time';alarm.value=alarmTimes.get(item.id)??'08:00';alarm.disabled=disabled;alarm.setAttribute('aria-label','Время будильника');alarm.onchange=()=>alarmTimes.set(item.id,alarm.value);
          const set=button('Поставить будильник','alarm');set.onclick=()=>{const [h,min]=alarm.value.split(':').map(Number);send('alarm',{minute:h*60+min});};commands.append(alarm,set);
          if(d.alarmAt!==undefined){const line=document.createElement('p');line.textContent='Будильник: '+clockLabel(clockAt(d.alarmAt));commands.append(line,button('Отменить будильник','cancelAlarm'));}
          card.append(commands);
          if(d.reply){const answer=document.createElement('p');answer.textContent=m.assistant+': '+d.reply.text;card.append(answer);}
          return card;
        });info.replaceChildren(intro,...cards);info.scrollTop=scroll;
      }
    }
    if(app==='home'){
      const dust=state.homeDust??initialDust(),scroll=info.scrollTop;
      const avg=Math.round(DUST_ROOMS.reduce((sum,r)=>sum+cleanliness(dust[r.id]),0)/DUST_ROOMS.length);
      const intro=block('Чистота дома · '+avg+'%','Пыль снижает комфорт и настроение в комнате. За сутки накапливается 25%.');
      const cards=DUST_ROOMS.map(r=>{
        const stage=dustStage(dust[r.id]),card=block(r.label+' · '+cleanliness(dust[r.id])+'%',stage.label+(stage.mood?' · настроение −'+stage.mood+'/ч, комфорт −'+stage.comfort+'/ч':''));
        const meter=document.createElement('progress');meter.max=100;meter.value=cleanliness(dust[r.id]);meter.style.width='100%';card.append(meter);
        const button=document.createElement('button');button.type='button';button.textContent='Убрать комнату';
        button.disabled=state.world.places[role]!=='home'||dust[r.id]<288;
        button.addEventListener('click',()=>{if(cleanRoom?.(r.id))close();});card.append(button);return card;
      });
      const item=vacuumItem(state),v=item&&vacuumState(state,item);
      const robot=block('Робот-пылесос',item&&v?VACUUM_MODELS[item.sku as VacuumSku].name+' · '+({docked:'На станции',cleaning:'Убирает дом',returning:'Возвращается',stopped:'Остановлен'}[v.mode]):'Купи в «Импульсе» и установи станцию из склада мебели.');
      if(v){
        for(const [action,label] of [['start','Начать уборку'],['stop','Остановить'],['return','На станцию']] as const){
          const b=document.createElement('button');b.type='button';b.textContent=label;b.disabled=action==='start'?v.mode==='cleaning':v.mode==='docked';b.onclick=()=>{vacuumControl?.({type:'vacuum_control',action});};robot.append(b);
        }
        const label=document.createElement('label'),check=document.createElement('input');check.type='checkbox';check.checked=v.auto;check.onchange=()=>{vacuumControl?.({type:'vacuum_control',action:'auto',enabled:check.checked});};label.append(check,document.createTextNode(' Убирать ежедневно в 10:00'));robot.append(label);
        if(v.skipped.length){const note=document.createElement('small');note.textContent='Недоступные комнаты: '+v.skipped.map(id=>DUST_ROOMS.find(r=>r.id===id)?.label).join(', ');robot.append(note);}
        for(const [i,card] of cards.entries()){
          const b=document.createElement('button');b.type='button';b.textContent='Убрать роботом';b.disabled=v.mode==='cleaning';b.onclick=()=>{vacuumControl?.({type:'vacuum_control',action:'start',room:DUST_ROOMS[i].id});};card.append(b);
        }
      }
      info.replaceChildren(intro,robot,...cards);info.scrollTop=scroll;
    }
    if(app==='feed'){
      const phone=electronicsModel(state,role,'phone');
      const card=block(phone.name,'Полистать новости, фотографии и короткие ролики. 20 сек. · досуг +'+(18+phone.bonus)+' · настроение +'+(4+phone.comfort));
      const start=document.createElement('button');start.type='button';start.textContent='Полистать ленту';start.disabled=state.world.places[role]!=='home';start.addEventListener('click',()=>{if(openFeed?.())close();});card.append(start);info.replaceChildren(card);
    }
    if(app==='autonomy'){
      const scroll=info.scrollTop;
      const intro=block('🧠 Живая повседневность',
        '«Выключена» оставляет спокойную повседневность: редкие прогулки и помощь лишь при крайней необходимости. Другие режимы дают больше самостоятельности. Твои команды всегда главнее; покупки и рабочие смены остаются под твоим контролем.');
      intro.classList.add('autonomy-phone-intro');
      const cards=(['vlad','alina'] as const).map(id=>{
        const current=block(names[id]+' · '+AUTONOMY_LABELS[state.autonomy[id]],'');
        current.classList.add('autonomy-phone-card');
        const thought=thoughtFor(state,id),emotion=residentEmotion(state,id);
        current.querySelector('p')!.textContent=emotion.emoji+' '+emotion.label+' · '+Math.round(state.characters[id].mood)+'% · '+emotion.reason;
        const traits=document.createElement('small');traits.textContent=PERSONALITIES[id].traits.join(' · ')+' · Любимый питомец: '+(PERSONALITIES[id].pet==='simba'?'Симба':'Верделл');current.append(traits);
        const reflection=document.createElement('p');reflection.textContent=thought.emoji+' '+thought.text;current.append(reflection);
        for(const event of activeEmotions(state,id)){const line=document.createElement('small');line.style.display='block';line.textContent='• '+EVENTS[event.kind].label+' · ещё '+Math.ceil(event.until-(state.clock.day-1)*1440-state.clock.minute)+' мин.';current.append(line);}
        if(role===id){
          const select=document.createElement('select');
          select.dataset.autonomy=id;
          select.setAttribute('aria-label','Выбрать самостоятельность '+names[id]);
          for(const mode of AUTONOMY_MODES){
            const option=document.createElement('option');
            option.value=mode;option.textContent=AUTONOMY_LABELS[mode];
            select.append(option);
          }
          select.value=state.autonomy[id];
          select.addEventListener('change',()=>{if(setAutonomy(select.value as AutonomyMode))select.disabled=true;});
          current.append(select);
        }else{
          const note=document.createElement('small');
          note.textContent='Настраивает только сам персонаж со своего устройства.';
          current.append(note);
        }
        return current;
      });
      const settings=block('💭 Всплывающая карточка',
        'Настройки показываемых мыслей для этого персонажа на данном устройстве.');
      settings.classList.add('autonomy-phone-settings');
      const preferences=thoughts.preferences();
      for(const [id,label] of [
        ['show','Показывать всплывающие мысли'],
        ['hints','Показывать мини-подсказки'],
        ['pin','Закрепить карточку на экране'],
      ] as [keyof ThoughtPreferences,string][]){
        const row=document.createElement('label');
        const checkbox=document.createElement('input');
        checkbox.type='checkbox';checkbox.dataset.thoughtSetting=id;
        checkbox.checked=preferences[id];
        checkbox.addEventListener('change',()=>{thoughts.setPreference(id,checkbox.checked);});
        row.append(checkbox,document.createTextNode(label));
        settings.append(row);
      }
      const touchCard=block('📱 Удобство управления',
        'Лёгкая вибрация подтверждения на поддерживаемых Android. На iPhone Safari вибрация недоступна, визуальный отклик остаётся.');
      touchCard.classList.add('autonomy-phone-settings');
      const touchRow=document.createElement('label');
      const touchToggle=document.createElement('input');
      touchToggle.type='checkbox';touchToggle.dataset.haptics='';
      touchToggle.checked=hapticsEnabled();
      touchToggle.addEventListener('change',()=>{
        setHapticsEnabled(touchToggle.checked);
        if(touchToggle.checked)subtleHaptic('confirm');
      });
      touchRow.append(touchToggle,document.createTextNode('Тактильный отклик (необязательно)'));
      touchCard.append(touchRow);
      const historyIntro=block('🕰 Недавние мысли',
        'Пять последних мыслей каждого персонажа. История хранится на этом устройстве, не изменяя семейное сохранение.');
      historyIntro.dataset.thoughtHistoryAnchor='true';
      const historyCards=(['vlad','alina'] as const).map(id=>{
        const section=block('💭 '+names[id],'');
        section.classList.add('autonomy-phone-history');
        section.querySelector('p')!.remove();
        const entries=[...thoughts.history(id)].reverse();
        if(!entries.length){
          const empty=document.createElement('p');
          empty.textContent='Пока нет записей. Мысли появятся во время игры.';
          section.append(empty);
        }
        for(const entry of entries){
          const item=document.createElement('div');
          item.className='thought-history-item';
          const time=document.createElement('small');
          time.textContent=entry.emoji+' '+entry.time;
          const text=document.createElement('p');
          text.textContent='«'+entry.text+'»';
          item.append(time,text);
          section.append(item);
        }
        return section;
      });
      info.replaceChildren(intro,...cards,settings,touchCard,historyIntro,...historyCards);
      info.scrollTop=scroll;
    }
    if (app === 'relationship') {
      const scroll=info.scrollTop;
      renderRelationship(info,state,role,social.suggest,social.offer,social.pending(),social.current(),
        social.moment,online.includes(role==='vlad'?'alina':'vlad'));
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
    if(next==='furnishing'){close();openFurnishing();return;}
    const view=read();
    if (!view) return;
    closeApps();
    app=next;speakerKey='';fitnessKey='';
    if (next === 'education') education.open(educationView, room, materialId);
    if (next === 'career') career.open();
    root.hidden=false;
    back.hidden=!next;
    grid.hidden=Boolean(next);
    info.hidden=next!=='fitness'&&next!=='speakers'&&next!=='home'&&next!=='audio'&&next!=='feed'&&next!=='relationship'&&next!=='autonomy'&&next!=='education'&&next!=='career'&&next!=='calendar'&&next!=='family'&&next!=='pets'&&(!next||!billingApps.has(next));
    billing.reset();
    info.scrollTop=0;
    if(next==='audio'){
      const card=block('🔊 Звук','Настройки действуют только на этом устройстве. Звук включается после первого касания.');
      card.dataset.audioSetting='';card.classList.add('audio-settings');
      for(const key of Object.keys(AUDIO_LABELS) as AudioChannel[]){
        const row=document.createElement('label'),name=document.createElement('span'),slider=document.createElement('input'),value=document.createElement('output');
        name.textContent=AUDIO_LABELS[key];slider.type='range';slider.min='0';slider.max='100';slider.step='5';slider.value=String(Math.round(gameAudio.settings[key]*100));slider.setAttribute('aria-label',AUDIO_LABELS[key]);value.textContent=slider.value+'%';
        slider.addEventListener('input',()=>{gameAudio.setVolume(key,Number(slider.value)/100);value.textContent=slider.value+'%';});
        row.append(name,value,slider);card.append(row);
      }
      const demo=document.createElement('button');demo.type='button';demo.textContent='Проверить звук';demo.addEventListener('click',()=>{void gameAudio.unlock().then(()=>gameAudio.play('confirm','ui',.65));});card.append(demo);info.replaceChildren(card);
    }
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
  return { open(next: App | null = null) {show(next);closeButton.focus();},
    openSpeaker(id:number){show('speakers');info.querySelector('[data-speaker-id="'+id+'"]')?.scrollIntoView({block:'start'});},
    openAutonomyHistory(){
      show('autonomy');
      info.querySelector<HTMLElement>('[data-thought-history-anchor]')?.scrollIntoView({block:'start'});
      closeButton.focus();
    },
    close,
    back(){if(app!==null)show(null);else close();},
    refresh,refreshClock,
    refreshRelationship() { if(app==='relationship')refresh(); },
    openEducation(view: EducationView, room?: string) { show('education', view, room); closeButton.focus(); },
    educationMessage(message: string) {
      if (app !== 'education' || root.hidden) return false;
      education.feedback(message); refresh(); return true;
    },
    billingMessages(messages: string[]) { billing.setMessages(messages); refresh(); } };
}
