import { familyMoments, type FamilyMomentId } from './shared/familyMoments';
import {
  activityItems, contextAvailable, eveningDishId, eveningDinnerAction, eveningMealName, needsItem, otherPerson, SOCIAL_ACTIVITIES, SOCIAL_BY_ID, SOCIAL_GROUPS, socialRestriction, socialText,
  type SocialActivity, type SocialCommand, type SocialGroup, type SocialOffer,
} from './shared/socialLife';
import { clockAt, clockLabel, gameMinutes } from './shared/life';
import { names, type CharacterId, type GameState } from './shared/protocol';

const node=<K extends keyof HTMLElementTagNameMap>(tag:K,text='',style='')=>{
  const item=document.createElement(tag);
  if(text)item.textContent=text;
  if(style)item.className=style;
  return item;
};
function button(text:string,click:()=>void,disabled=false){
  const control=node('button',text,'social-button');
  control.type='button';control.disabled=disabled;
  control.addEventListener('click',click);
  return control;
}
export type SocialSend=(message:SocialCommand)=>boolean;
const contextOrder=(a:SocialActivity,state:GameState,role:CharacterId)=>{
  const evening=state.relationship.evening;
  if(evening?.phase==='prepare'&&a.id==='cook'||
    evening?.phase==='dine'&&a.id===eveningDinnerAction(evening)||
    evening?.phase==='unwind'&&['film','tv','cuddle','eveningHeartTalk','petPlay'].includes(a.id))return 0;
  if(a.id==='eveningPlan'&&state.clock.minute>=17*60)return 0;
  if(state.relationship.recent.slice(-3).some(e=>e.action===a.id))return 6;
  if(socialRestriction(a,state,role))return 4;
  if(a.context)return 0;
  if(a.object==='eat'&&[role,otherPerson(role)].some(id=>state.characters[id].hunger<54))return 0;
  if(a.object==='dishes'&&state.dirtyDishes.table+state.dirtyDishes.yardTable>0)return 0;
  if(a.object==='unpack'&&state.world.tableBags>0)return 0;
  if(state.clock.minute>=17*60&&['evening','eveningTea','sofaTalk','film'].includes(a.id))return 0;
  return a.object?2:1;
};

export function showSocialMenu(root:HTMLElement,state:GameState,role:CharacterId,online:boolean,busy:string|undefined,
  send:SocialSend,preferred:SocialGroup='talk',activity?:string){
  let group=preferred,expanded=activity,more=false;
  const panel=node('section','','social-menu');
  function render(){
    const tabs=node('nav','','social-tabs');
    tabs.setAttribute('aria-label','Темы общения');
    for(const [id,[icon,label]] of Object.entries(SOCIAL_GROUPS)){
      const tab=button(icon+' '+label,()=>{group=id as SocialGroup;expanded=undefined;more=false;render();root.scrollTop=0;});
      tab.dataset.socialGroup=id;
      tab.setAttribute('aria-current',group===id?'true':'false');
      tabs.append(tab);
    }
    const list=SOCIAL_ACTIVITIES.filter(a=>a.group===group&&a.object!=='unpack'&&!a.id.startsWith('nearTalk:')&&!a.id.startsWith('parkTalk:')&&!a.id.startsWith('picnicTalk:')&&
      (!a.context||contextAvailable(a,state,role)))
      .sort((a,b)=>Number(b.id===expanded)-Number(a.id===expanded)||contextOrder(a,state,role)-contextOrder(b,state,role));
    const cards=node('div','','social-cards');
    for(const a of list.slice(0,more?list.length:7)){
      const reason=!online?'Партнёр пока не в сети':busy??socialRestriction(a,state,role);
      const card=node('article','','social-card');
      const toggler=button(a.title,()=>{expanded=expanded===a.id?undefined:a.id;render();});
      toggler.dataset.socialAction=a.id;
      toggler.setAttribute('aria-expanded',expanded===a.id?'true':'false');
      card.append(toggler);
      if(expanded===a.id){
        card.append(node('p',socialText(a,state,role)));
        if(reason)card.append(node('small',reason,'social-reason'));
        else {
          const picker=needsItem(a)?node('select'):undefined;
          if(picker){
            picker.setAttribute('aria-label','Выбор для приглашения');
            picker.dataset.socialItem=a.id;
            for(const {id,label} of activityItems(a,state,role)){
              const option=node('option',label);option.value=id;picker.append(option);
            }
            const planned=state.relationship.evening;
            const selected=planned&&eveningDishId(planned);
            if(selected&&['cook','eat','takeout'].includes(a.id)&&
              Array.from(picker.options).some(option=>option.value===selected))picker.value=selected;
            card.append(picker);
          }
          const offer=button(a.object?'Предложить занятие':'Предложить и дождаться ответа',()=>{
            if(send({type:'social_propose',action:a.id,item:picker?.value}))root.hidden=true;
          });
          offer.dataset.socialPropose=a.id;card.append(offer);
          card.append(node('small',a.object?'Оба игрока подходят к объекту после согласия.':'Короткая сцена с ответом партнёра.'));
        }
      }
      cards.append(card);
    }
    panel.replaceChildren(tabs,...(busy||!online?[node('p',busy??'Партнёр пока не в сети','social-reason')]:[]),cards);
    if(list.length>7)panel.append(button(more?'Свернуть список':'Ещё варианты',()=>{more=!more; render();}));
  }
  render();
  root.append(panel);
}

export function renderRelationship(root:HTMLElement,state:GameState,role:CharacterId,suggest:(group:SocialGroup,id?:string)=>void,
  onOffer:()=>void,offered:boolean,current:string|undefined,
  offerMoment:(id:FamilyMomentId)=>void,partnerOnline:boolean){
  const p=state.relationship, now=gameMinutes(state.clock);
  const pane=node('section','','relationship');
  const cover=node('header','','relationship-hero');
  cover.append(node('small','ДОМ, КОТОРЫЙ МЫ ДЕЛИМ'),node('h2','Влад и Алина'),
    node('p',p.lastTogether!==undefined&&now-p.lastTogether<=1440?'Сегодня уже нашли время друг для друга.':'Вместе можно прожить даже самый обычный день.'));
  pane.append(cover);
  const evening=p.evening;
  const story=node('article','','relationship-event');
  story.append(node('strong','💛 Наш домашний вечер'));
  if(!evening||evening.phase==='complete'){
    story.append(node('p',evening?.phase==='complete'
      ? 'Прошлый вечер удался! Попробуйте новый способ ужина или другое совместное занятие.'
      : 'Выберите: приготовить вдвоём, разделить готовый ужин или доставку. Затем побудьте вместе.'));
    story.append(button('Спланировать вечер вдвоём',()=>suggest('home','eveningPlan')));
  } else {
    const phaseLabel=evening.phase==='prepare'?'1 из 3 · Готовим':
      evening.phase==='dine'?'2 из 3 · Ужинаем':'3 из 3 · Отдыхаем';
    const occasion=evening.occasion==='comfort'?'Сегодня особенно важна поддержка.':
      evening.occasion==='rest'?'Усталость заметна — хорошо бы отдохнуть вместе.':
      'Проведите этот вечер так, как нравится вам обоим.';
    story.append(node('p',phaseLabel+' · '+eveningMealName(evening)));
    story.append(node('p',evening.phase==='prepare'
      ? 'Выбранное блюдо нужно приготовить вместе. Продукты спишутся после готовки.'
      : evening.phase==='dine'
        ? 'Две настоящие порции ждут на столе. Пригласите друг друга поужинать.'
        : occasion));
    if(evening.phase==='prepare'){
      story.append(button('🍳 Приготовить вместе',()=>suggest('home','cook')));
    } else if(evening.phase==='dine'){
      const delivery=eveningDinnerAction(evening)==='takeout';
      story.append(button(delivery?'🍕 Разделить доставку':'🍽️ Позвать к столу',
        ()=>suggest('home',delivery?'takeout':'eat')));
    } else {
      story.append(button('📺 Посмотреть ТВ вдвоём',()=>suggest('fun','tv')));
      story.append(button('💛 Поговорить по душам',()=>suggest('care','eveningHeartTalk')));
      if(activityItems(SOCIAL_BY_ID.get('petPlay')!,state,role).length)
        story.append(button('🐾 Поиграть с питомцем',()=>suggest('home','petPlay')));
    }
    story.append(button('Выбрать другой план',()=>suggest('home','eveningPlan')));
  }
  pane.append(node('h3','Планы на вечер'),story);
  const moments=familyMoments(state,role);
  if(moments.length){
    const momentCards=node('section','','relationship-moments');
    momentCards.append(node('p','Сегодня дома есть повод сделать что-нибудь друг для друга.','relationship-moment-intro'));
    for(const moment of moments){
      const card=node('article','','relationship-event relationship-moment');
      card.append(node('strong',moment.emoji+' '+moment.title),node('p',moment.description));
      const action=button('Предложить вдвоём',()=>offerMoment(moment.id),!partnerOnline||!!current||offered);
      action.setAttribute('aria-label','Предложить семейный момент: '+moment.title);
      card.append(action);
      if(!partnerOnline)card.append(node('small','Партнёр пока не в сети','social-reason'));
      momentCards.append(card);
    }
    pane.append(node('h3','Поводы дня'),momentCards);
  }
  if(current)pane.append(node('h3','Сейчас вместе'),node('p',current));
  if(offered)pane.append(button('Открыть приглашение',onOffer));
  const available=SOCIAL_ACTIVITIES.filter(a=>!a.id.startsWith('nearTalk:')&&!['eveningPlan','evening','eveningTea'].includes(a.id)&&!socialRestriction(a,state,role))
    .sort((a,b)=>contextOrder(a,state,role)-contextOrder(b,state,role));
  const suggestions=node('div','','relationship-suggestions');
  for(const a of [...new Map(available.map(a=>[a.group,a])).keys()].slice(0,4).map(group=>available.find(a=>a.group===group)!)) {
    suggestions.append(button(SOCIAL_GROUPS[a.group][0]+' '+a.title,()=>suggest(a.group,a.id)));
  }
  if(suggestions.childElementCount)pane.append(node('h3','Что сделать вместе'),suggestions);
  const recent=node('ul','','relationship-recent');
  const memories=new Set(p.memories.map(m=>m.at+'|'+m.action));
  for(const e of p.recent.slice().reverse()){
    if(memories.has(e.at+'|'+e.action))continue;
    const activity=SOCIAL_BY_ID.get(e.action);
    if(activity)recent.append(node('li',activity.title+' · '+clockLabel(clockAt(e.at))));
    if(recent.childElementCount===3)break;
  }
  if(recent.childElementCount)pane.append(node('h3','Недавно вместе'),recent);
  pane.append(node('h3','Воспоминания'));
  if(!p.memories.length)pane.append(node('p','Первый совместный ужин, прогулка или другой особый момент появится здесь.'));
  for(const m of p.memories.slice().reverse()){
    const entry=node('article','','relationship-event');
    entry.append(node('small',clockLabel(clockAt(m.at))),node('strong',SOCIAL_GROUPS[m.group][0]+' '+m.title),
      node('p',m.description));
    pane.append(entry);
  }
  root.replaceChildren(pane);
}

export function createSocialOffer(root:HTMLElement,send:SocialSend, now:()=>number=Date.now){
  let offer:SocialOffer|null=null, self:CharacterId|null=null, folded=false;
  let deadline = 0;
  let timer:number|undefined;
  function render(){
    root.hidden=!offer;
    if(!offer){root.replaceChildren();return;}
    const current=offer, outgoing=current.from===self;
    const heading=node('strong',outgoing?'Приглашение отправлено':names[current.from]+' предлагает');
    const title=node('h3',current.title);
    const clock=node('small','','social-clock');
    const tick=()=>{clock.textContent=Math.max(0,Math.ceil((deadline-now())/1000))+' с';};
    tick();
    window.clearInterval(timer);timer=window.setInterval(tick,500);
    const top=node('header');top.append(heading,clock);
    root.replaceChildren(top,title);
    if(folded){root.append(button('Открыть',()=>{folded=false;render();}));return;}
    root.append(node('p','«'+current.text+'»'));
    if(outgoing)root.append(button('Отозвать',()=>send({type:'social_withdraw',inviteId:current.id})));
    else{
      for(const [choice,reply] of current.replies.entries()){
        const b=button(reply,()=>send({type:'social_reply',inviteId:current.id,choice}));
        b.dataset.socialReply=String(choice); root.append(b);
      }
      const controls=node('footer');
      controls.append(button('Отказаться',()=>send({type:'social_reply',inviteId:current.id,choice:null})),
        button('Ответить позже',()=>{folded=true;render();}));
      root.append(controls);
    }
  }
  return {
    set(next:SocialOffer,role:CharacterId){
      offer=next;self=role;folded=false;
      // Use a local, pause-aware countdown. Server expiry remains authoritative;
      // wall clocks across two phones may differ substantially.
      deadline=now()+(next.remainingMs??Math.max(0,next.expiresAt-Date.now()));
      render();
    },
    clear(id?:number){if(id!==undefined&&offer?.id!==id)return;window.clearInterval(timer);timer=undefined;offer=null;render();},
    get pending(){return !!offer;},
    unfold(){folded=false;render();},
  };
}
