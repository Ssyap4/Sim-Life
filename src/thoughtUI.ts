import { clockLabel, type VitalNeed } from './shared/life';
import { thoughtFor } from './shared/autonomy';
import { wishesFor, type WishCommand } from './shared/wishes';
import { modeShortLabel, thoughtLessons, thoughtStateLabel } from './shared/thoughtHelp';
import type { CharacterId, GameState } from './shared/protocol';

export type ThoughtRecord={time:string;text:string;emoji:string;need?:VitalNeed};
export type ThoughtPreferences={show:boolean;hints:boolean;pin:boolean};
export const DEFAULT_THOUGHT_PREFERENCES:ThoughtPreferences={show:true,hints:true,pin:false};
const roles:readonly CharacterId[]=['vlad','alina'];
const HISTORY_LIMIT=5;
const WINDOW_MS=11_000;
const key=(kind:'history'|'settings',role:CharacterId)=>'sim-life-017-'+kind+'-'+role;

export function validThoughtPreferences(value:unknown):value is ThoughtPreferences{
  if(!value||typeof value!=='object'||Array.isArray(value))return false;
  const obj=value as Record<string,unknown>;
  return typeof obj.show==='boolean'&&typeof obj.hints==='boolean'&&typeof obj.pin==='boolean';
}
export function parseThoughtHistory(value:unknown):ThoughtRecord[]{
  if(!Array.isArray(value))return [];
  return value.filter((entry):entry is ThoughtRecord=>{
    if(!entry||typeof entry!=='object'||Array.isArray(entry))return false;
    const row=entry as Record<string,unknown>;
    return typeof row.time==='string'&&row.time.length<=90&&
      typeof row.text==='string'&&row.text.length<=360&&
      typeof row.emoji==='string'&&row.emoji.length<=12&&
      (row.need===undefined||['bladder','hunger','energy','hygiene','social','fun','comfort'].includes(String(row.need)));
  }).slice(-HISTORY_LIMIT);
}
export function appendThought(history:readonly ThoughtRecord[],record:ThoughtRecord):ThoughtRecord[]{
  if(history.at(-1)?.text===record.text)return [...history];
  return [...history,record].slice(-HISTORY_LIMIT);
}
function readLocal(keyName:string):unknown{
  try{const value=localStorage.getItem(keyName);return value?JSON.parse(value):null;}
  catch{return null;}
}
function saveLocal(keyName:string,data:unknown):void{
  try{localStorage.setItem(keyName,JSON.stringify(data));}catch{/* Storage may be unavailable */ }
}
export function createThoughtUI(root:HTMLElement,read:()=>{state:GameState;role:CharacterId}|null,
  beforeOpen:()=>void,openPhone:()=>void,
  performWish:(role:CharacterId,command:WishCommand)=>boolean){
  root.innerHTML=`
    <button id="thought-trigger" class="thought-trigger" type="button" aria-expanded="false"
      aria-controls="thought-panel" aria-label="Желания персонажа">💭 <span>Желания</span></button>
    <section id="thought-panel" class="thought-panel" aria-label="Мысли, желания и подсказки" hidden>
      <header class="thought-heading">
        <div><strong data-thought-title>💭 Мысли</strong><small data-thought-mode></small></div>
        <div class="thought-heading-actions">
          <button type="button" data-thought-pin aria-label="Закрепить карточку" title="Закрепить карточку">📌</button>
          <button type="button" data-thought-close aria-label="Скрыть карточку">×</button>
        </div>
      </header>
      <div class="thought-switch" role="group" aria-label="Чьи мысли посмотреть">
        <button type="button" data-thought-role="vlad">Влад</button>
        <button type="button" data-thought-role="alina">Алина</button>
      </div>
      <div class="wish-list" data-wish-list role="group" aria-label="Желания"></div>
      <section class="wish-detail" aria-label="Подробности желания">
        <div class="wish-detail-heading"><strong data-wish-title></strong><small data-wish-need></small></div>
        <p data-wish-description></p>
        <button class="wish-do" type="button" data-wish-do>Выполнить</button>
        <small class="wish-feedback" data-wish-feedback aria-live="polite"></small>
      </section>
      <p class="thought-phrase" data-thought-phrase></p>
      <div class="thought-need" data-thought-need></div>
      <button class="thought-more" type="button" data-thought-more aria-expanded="false">❔ Почему персонаж этого хочет?</button>
      <section class="thought-lesson" data-thought-lesson hidden>
        <div class="thought-lesson-head"><strong data-lesson-title></strong>
          <button type="button" data-lesson-next aria-label="Следующая подсказка">Далее ›</button></div>
        <p data-lesson-body></p>
        <small data-lesson-count></small>
      </section>
      <div class="thought-preferences" data-thought-preferences hidden>
        <strong>Настройки желаний</strong>
        <label><input type="checkbox" data-thought-option="show"> Показывать текущее желание</label>
        <label><input type="checkbox" data-thought-option="hints"> Объяснения и обучение</label>
        <label><input type="checkbox" data-thought-option="pin"> Не закрывать автоматически</label>
        <small>Настройки хранятся на этом устройстве для твоего персонажа.</small>
      </div>
      <footer class="thought-footer">
        <button type="button" data-thought-settings>⚙ Настройки</button>
        <button type="button" data-thought-history>📱 История в телефоне</button>
      </footer>
    </section>`;
  const trigger=root.querySelector<HTMLButtonElement>('#thought-trigger')!;
  const panel=root.querySelector<HTMLElement>('#thought-panel')!;
  const title=root.querySelector<HTMLElement>('[data-thought-title]')!;
  const mode=root.querySelector<HTMLElement>('[data-thought-mode]')!;
  const phrase=root.querySelector<HTMLElement>('[data-thought-phrase]')!;
  const need=root.querySelector<HTMLElement>('[data-thought-need]')!;
  const lessonSection=root.querySelector<HTMLElement>('[data-thought-lesson]')!;
  const lessonTitle=root.querySelector<HTMLElement>('[data-lesson-title]')!;
  const lessonBody=root.querySelector<HTMLElement>('[data-lesson-body]')!;
  const lessonCount=root.querySelector<HTMLElement>('[data-lesson-count]')!;
  const pinButton=root.querySelector<HTMLButtonElement>('[data-thought-pin]')!;
  const settingsSection=root.querySelector<HTMLElement>('[data-thought-preferences]')!;
  const wishList=root.querySelector<HTMLElement>('[data-wish-list]')!;
  const wishTitle=root.querySelector<HTMLElement>('[data-wish-title]')!;
  const wishNeed=root.querySelector<HTMLElement>('[data-wish-need]')!;
  const wishDetail=root.querySelector<HTMLElement>('[data-wish-description]')!;
  const wishButton=root.querySelector<HTMLButtonElement>('[data-wish-do]')!;
  const wishFeedback=root.querySelector<HTMLElement>('[data-wish-feedback]')!;
  const moreButton=root.querySelector<HTMLButtonElement>('[data-thought-more]')!;
  let selectedWishId='', helpOpen=false, feedbackText='', feedbackAt=0;
  let viewer:CharacterId|null=null;
  let selected:CharacterId='vlad';
  let isOpen=false;
  let lessonIndex=0;
  let timer:ReturnType<typeof setTimeout>|null=null;
  let pref:ThoughtPreferences={...DEFAULT_THOUGHT_PREFERENCES};
  const histories:Record<CharacterId,ThoughtRecord[]>={vlad:[],alina:[]};
  const signatures:Partial<Record<CharacterId,string>>={};
  const clearTimer=()=>{if(timer!==null){clearTimeout(timer);timer=null;}};
  function close(){
    clearTimer();
    isOpen=false;panel.hidden=true;trigger.setAttribute('aria-expanded','false');
  }
  function scheduleClose(){
    clearTimer();
    if(!pref.pin)timer=setTimeout(close,WINDOW_MS);
  }
  function open(manual=true){
    const view=read();
    if(!view)return;
    beforeOpen();
    selected=manual&&isOpen?selected:view.role;
    if(!isOpen){selectedWishId='';helpOpen=false;}
    isOpen=true;panel.hidden=false;
    trigger.setAttribute('aria-expanded','true');
    render();
    scheduleClose();
  }
  function updatePref(option:keyof ThoughtPreferences,value:boolean){
    if(!viewer)return;
    pref={...pref,[option]:value};
    saveLocal(key('settings',viewer),pref);
    render();
    scheduleClose();
  }
  function render(){
    const view=read();
    if(!view||!viewer)return;
    const {state}=view;
    const previews=wishesFor(state,view.role);
    const peek=previews[0];
    root.classList.toggle('thought-urgent',peek?.urgency==='urgent');
    trigger.classList.toggle('thought-muted',!pref.show);
    trigger.querySelector('span')!.textContent=pref.show&&peek
      ? peek.icon+' '+peek.title:'Желания';
    trigger.setAttribute('aria-label','Желания '+(view.role==='vlad'?'Влада':'Алины')+
      (peek?' · '+peek.title:''));
    if(!isOpen)return;
    const current=thoughtFor(state,selected);
    const wishes=wishesFor(state,selected);
    if(!wishes.some(w=>w.id===selectedWishId))selectedWishId=wishes[0]?.id??'';
    const chosen=wishes.find(w=>w.id===selectedWishId);
    title.textContent='💭 Желания '+(selected==='vlad'?'Влада':'Алины');
    mode.textContent=modeShortLabel(state,selected);
    const matchedNeed=Boolean(chosen?.need&&current.need===chosen.need);
    phrase.hidden=!matchedNeed;
    need.hidden=!matchedNeed;
    if(matchedNeed){
      phrase.textContent='«'+current.text+'»';
      need.textContent=thoughtStateLabel(state,selected);
    }
    for(const button of root.querySelectorAll<HTMLButtonElement>('[data-thought-role]')){
      const selectedButton=button.dataset.thoughtRole===selected;
      button.classList.toggle('selected',selectedButton);
      button.setAttribute('aria-pressed',String(selectedButton));
    }
    wishList.replaceChildren();
    for(const wish of wishes){
      const button=document.createElement('button');
      button.type='button';button.className='wish-choice';
      button.classList.toggle('wish-urgent',wish.urgency==='urgent');
      button.setAttribute('aria-pressed',String(wish.id===selectedWishId));
      const symbol=document.createElement('span');
      symbol.className='wish-symbol';symbol.textContent=wish.icon;
      const label=document.createElement('span');
      label.className='wish-name';label.textContent=wish.title;
      button.append(symbol,label);
      button.addEventListener('click',()=>{
        selectedWishId=wish.id;feedbackText='';render();scheduleClose();
      });
      wishList.append(button);
    }
    wishTitle.textContent=chosen?chosen.icon+' '+chosen.title:'';
    wishNeed.textContent=chosen?.need?Math.round(state.characters[selected][chosen.need])+'%':'';
    wishDetail.textContent=chosen?.detail??'';
    const own=selected===view.role,atHome=state.world.places[selected]==='home';
    wishButton.disabled=!chosen?.command||!own||!atHome;
    wishButton.textContent=!own?'Другой игрок':!atHome?'Только дома':
      chosen?.command?chosen.cta:chosen?.cta??'Недоступно';
    wishFeedback.textContent=performance.now()-feedbackAt<5000?feedbackText:'';
    pinButton.classList.toggle('selected',pref.pin);
    pinButton.setAttribute('aria-pressed',String(pref.pin));
    moreButton.hidden=!pref.hints;
    moreButton.setAttribute('aria-expanded',String(helpOpen&&pref.hints));
    lessonSection.hidden=!(helpOpen&&pref.hints);
    if(helpOpen&&pref.hints){
      const lessons=thoughtLessons(state,selected);
      const lesson=lessons[lessonIndex%lessons.length];
      lessonTitle.textContent=lesson.icon+' '+lesson.title;
      lessonBody.textContent=lesson.body;
      lessonCount.textContent='Совет '+(lessonIndex%lessons.length+1)+' из '+lessons.length;
    }
    for(const input of settingsSection.querySelectorAll<HTMLInputElement>('input[data-thought-option]'))
      input.checked=pref[input.dataset.thoughtOption as keyof ThoughtPreferences];
  }
  function capture(state:GameState){
    for(const id of roles){
      const current=thoughtFor(state,id);
      const signature=current.emoji+' '+current.text;
      if(signatures[id]===signature)continue;
      signatures[id]=signature;
      histories[id]=appendThought(histories[id],
        {time:clockLabel(state.clock),emoji:current.emoji,text:current.text,...(current.need?{need:current.need}:{})});
      saveLocal(key('history',id),histories[id]);
    }
  }
  trigger.addEventListener('click',()=>isOpen?close():open(true));
  root.querySelector<HTMLButtonElement>('[data-thought-close]')!.addEventListener('click',close);
  pinButton.addEventListener('click',()=>updatePref('pin',!pref.pin));
  wishButton.addEventListener('click',()=>{
    const view=read();
    if(!view||view.role!==selected)return;
    const wish=wishesFor(view.state,selected).find(w=>w.id===selectedWishId);
    if(!wish?.command)return;
    const sent=performWish(selected,wish.command);
    feedbackText=sent?'Команда отправлена. Проверь очередь действий.':'Не удалось отправить команду.';
    feedbackAt=performance.now();render();scheduleClose();
  });
  moreButton.addEventListener('click',()=>{helpOpen=!helpOpen;render();scheduleClose();});
  root.querySelector<HTMLButtonElement>('[data-lesson-next]')!.addEventListener('click',()=>{
    lessonIndex++;render();scheduleClose();
  });
  root.querySelector<HTMLButtonElement>('[data-thought-settings]')!.addEventListener('click',()=>{
    settingsSection.hidden=!settingsSection.hidden;scheduleClose();
  });
  root.querySelector<HTMLButtonElement>('[data-thought-history]')!.addEventListener('click',()=>{
    close();openPhone();
  });
  for(const input of settingsSection.querySelectorAll<HTMLInputElement>('input[data-thought-option]')){
    input.addEventListener('change',()=>{
      updatePref(input.dataset.thoughtOption as keyof ThoughtPreferences,input.checked);
    });
  }
  for(const button of root.querySelectorAll<HTMLButtonElement>('[data-thought-role]')){
    button.addEventListener('click',()=>{
      selected=button.dataset.thoughtRole as CharacterId;
      lessonIndex=0;selectedWishId='';helpOpen=false;feedbackText='';render();scheduleClose();
    });
  }
  // Hovers and keyboard focus keep an unpinned card accessible long enough to read.
  panel.addEventListener('pointerenter',clearTimer);
  panel.addEventListener('pointerleave',scheduleClose);
  panel.addEventListener('focusin',clearTimer);
  panel.addEventListener('focusout',()=>scheduleClose());
  return {
    onReady(role:CharacterId){
      clearTimer();viewer=role;selected=role;isOpen=false;panel.hidden=true;root.hidden=false;
      trigger.setAttribute('aria-expanded','false');
      const loaded=readLocal(key('settings',role));
      pref=validThoughtPreferences(loaded)?loaded:{...DEFAULT_THOUGHT_PREFERENCES};
      for(const id of roles){
        histories[id]=parseThoughtHistory(readLocal(key('history',id)));
        delete signatures[id];
      }
      lessonIndex=0;settingsSection.hidden=true;
    },
    refresh(){
      const view=read();
      if(!view||!viewer)return;
      capture(view.state);
      // Unlike the old UI, no large pop-up opens automatically on login.
      render();
    },
    close,
    reset(){
      close();root.hidden=true;viewer=null;feedbackText='';
    },
    history(id:CharacterId):readonly ThoughtRecord[]{return histories[id];},
    preferences():ThoughtPreferences{return {...pref};},
    setPreference:updatePref,
  };
}
