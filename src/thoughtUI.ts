import type {NoticeInput} from './shared/notices';
import { clockLabel, gameMinutes, NEED_INFO, VITAL_NEEDS, type VitalNeed } from './shared/life';
import { thoughtFor, foodSupplyProblem } from './shared/autonomy';
import { REWARDS, REWARD_IDS, activeReward, gameReward, rewardTime, type RewardId } from './shared/happiness';
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
  performWish:(role:CharacterId,command:WishCommand)=>boolean,
  rewardAction:(type:'happiness_buy'|'happiness_activate',id:RewardId)=>boolean=()=>false,sendNotice?:(notice:NoticeInput)=>void){
  root.innerHTML=`
    <button id="thought-trigger" class="thought-trigger" type="button" aria-expanded="false"
      aria-controls="thought-panel" aria-label="Желания персонажа">💭 <span>Желания</span></button>
    <div class="life-pop" hidden role="status" aria-live="polite">
      <span class="life-pop-icon"></span><div class="life-pop-copy"><strong></strong><small></small><span class="life-pop-meter" hidden><i></i></span></div>
      <button type="button" class="life-pop-open" aria-label="Открыть желания">›</button>
      <button type="button" class="life-pop-dismiss" aria-label="Скрыть уведомление">×</button>
    </div>
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
      <button type="button" class="happiness-toggle" data-happiness-toggle></button>
      <section class="happiness-shop" data-happiness-shop hidden></section>
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
  const pop=root.querySelector<HTMLElement>('.life-pop')!;
  let popTimer:ReturnType<typeof setTimeout>|undefined;
  let lastPopAt=-Infinity,lastWishMinute=-Infinity;
  const alerted=new Map<string,number>();
  const dismissPop=()=>{if(popTimer!==undefined)clearTimeout(popTimer);popTimer=undefined;pop.hidden=true;};
  function showPop(icon:string,title:string,body:string,value?:number,urgent=false){
    if(sendNotice){lastPopAt=performance.now();sendNotice({title,message:body,kind:urgent?'warning':'info',target:title.includes('Нет еды')?'delivery':value===undefined?'autonomy':'needs'});return;}
    dismissPop();
    pop.querySelector('.life-pop-icon')!.textContent=icon;
    pop.querySelector('strong')!.textContent=title;
    pop.querySelector('small')!.textContent=body;
    const meter=pop.querySelector<HTMLElement>('.life-pop-meter')!;
    meter.hidden=value===undefined;
    meter.querySelector<HTMLElement>('i')!.style.width=Math.max(0,Math.min(100,value??0))+'%';
    pop.classList.toggle('life-pop-urgent',urgent);pop.hidden=false;
    lastPopAt=performance.now();popTimer=setTimeout(dismissPop,urgent?10500:7200);
  }
  function notifyLife(state:GameState,role:CharacterId){
    if(!pref.show||isOpen)return;
    const minute=gameMinutes(state.clock),now=performance.now(),name=role==='vlad'?'Влад':'Алина';
    const person=state.characters[role];
    const low=[...VITAL_NEEDS].sort((a,b)=>person[a]-person[b]);
    for(const need of low)if(person[need]>65)alerted.delete('need:'+need);
    if(!foodSupplyProblem(state,role))alerted.delete('food');
    if(now-lastPopAt<16000)return;
    if(state.autonomy[role]!=='off'&&foodSupplyProblem(state,role)&&minute-(alerted.get('food')??-Infinity)>=90){
      alerted.set('food',minute);
      showPop('🍽️',name+' · Нет доступной еды','Нет свежих порций или доступного рецепта. Проверь продукты, кулинарию и силы.',person.hunger,true);return;
    }
    const need=low.find(n=>person[n]>15&&person[n]<=(state.autonomy[role]==='off'?50:25)&&minute-(alerted.get('need:'+n)??-Infinity)>=90);
    if(need){
      alerted.set('need:'+need,minute);
      const info=NEED_INFO[need],wish=wishesFor(state,role).find(w=>w.need===need),thought=thoughtFor(state,role);
      showPop(info.emoji,name+' · '+info.label+' '+Math.round(person[need])+'%',thought.need===need?thought.text:wish?.title??info.hint,person[need],person[need]<=25);return;
    }
    if(minute-lastWishMinute<55)return;
    const wishes=wishesFor(state,role).filter(w=>w.command);
    const wish=wishes[Math.floor(minute/55)%Math.max(1,wishes.length)];
    if(wish&&minute-(alerted.get('wish:'+wish.id)??-Infinity)>=150){
      lastWishMinute=minute;alerted.set('wish:'+wish.id,minute);
      showPop(wish.icon,name+' · '+wish.title,wish.detail,undefined,false);
    }
  }
  pop.querySelector('.life-pop-dismiss')!.addEventListener('click',dismissPop);
  pop.querySelector('.life-pop-open')!.addEventListener('click',()=>{dismissPop();open(true);});
  const shop=root.querySelector<HTMLElement>('[data-happiness-shop]')!;
  const shopToggle=root.querySelector<HTMLButtonElement>('[data-happiness-toggle]')!;
  let shopOpen=false;
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
    if(!pref.pin&&!shopOpen)timer=setTimeout(close,WINDOW_MS);
  }
  function open(manual=true){
    const view=read();
    if(!view)return;
    dismissPop();beforeOpen();
    selected=manual&&isOpen?selected:view.role;
    if(!isOpen){selectedWishId='';helpOpen=false;shopOpen=false;}
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
    const happiness=state.happiness[selected];
    shopToggle.textContent='✨ '+happiness.points.toLocaleString('ru-RU')+' · '+(shopOpen?'К желаниям':'Магазин счастья ›');
    shop.hidden=!shopOpen;
    wishList.hidden=shopOpen;
    const detailPanel=root.querySelector<HTMLElement>('.wish-detail')!;
    detailPanel.hidden=shopOpen||!chosen;
    if(shopOpen){
      phrase.hidden=true;need.hidden=true;
      shop.replaceChildren();
      const summary=document.createElement('small');summary.textContent='Исполнено желаний: '+happiness.count+' · Награды хранятся до активации.';shop.append(summary);
      for(const id of REWARD_IDS){
        const reward=REWARDS[id],stock=happiness.stock[id]??0,until=activeReward(state,selected,id);
        const card=document.createElement('article');card.className='happiness-card';
        const title=document.createElement('strong');title.textContent=reward.icon+' '+reward.title;
        const desc=document.createElement('small');desc.textContent=reward.description+' При активации: 100%.';
        const status=document.createElement('small');status.textContent='В запасе: '+stock+(until?' · Активно: '+rewardTime(until-gameMinutes(state.clock)):'');
        const actions=document.createElement('div');actions.className='happiness-actions';
        const buy=document.createElement('button');buy.type='button';buy.textContent='Купить · '+reward.price+' ✨';buy.disabled=selected!==view.role||happiness.points<reward.price;
        buy.onclick=()=>{if(rewardAction('happiness_buy',id))buy.disabled=true;};
        const use=document.createElement('button');use.type='button';use.textContent=until?'Действует':'Активировать';use.disabled=selected!==view.role||!stock||!!until;
        use.onclick=()=>{if(rewardAction('happiness_activate',id))use.disabled=true;};
        actions.append(buy,use);card.append(title,desc,status,actions);shop.append(card);
      }
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
    wishDetail.textContent=chosen?chosen.detail+' · ✨ +'+gameReward(chosen.id).points+' · 😊 +'+gameReward(chosen.id).mood+'%':'';
    const own=selected===view.role,atHome=state.world.places[selected]==='home'||chosen?.command?.type==='local_activity'&&state.world.places[selected]==='park';
    wishButton.disabled=!chosen?.command||!own||!atHome;
    wishButton.textContent=!own?'Другой игрок':!atHome?'Только дома':
      chosen?.command?chosen.cta:chosen?.cta??'Недоступно';
    wishFeedback.textContent=performance.now()-feedbackAt<5000?feedbackText:'';
    pinButton.classList.toggle('selected',pref.pin);
    pinButton.setAttribute('aria-pressed',String(pref.pin));
    moreButton.hidden=shopOpen||!pref.hints;
    moreButton.setAttribute('aria-expanded',String(helpOpen&&pref.hints));
    lessonSection.hidden=shopOpen||!(helpOpen&&pref.hints);
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
  shopToggle.addEventListener('click',()=>{shopOpen=!shopOpen;render();scheduleClose();});
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
      dismissPop();alerted.clear();lastPopAt=performance.now()-16000;lastWishMinute=-Infinity;
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
      render();
      notifyLife(view.state,view.role);
    },
    close,
    reset(){
      dismissPop();close();root.hidden=true;viewer=null;feedbackText='';
    },
    history(id:CharacterId):readonly ThoughtRecord[]{return histories[id];},
    preferences():ThoughtPreferences{return {...pref};},
    setPreference:updatePref,
  };
}
