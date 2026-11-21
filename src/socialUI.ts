import {
  activityItems, contextAvailable, needsItem, otherPerson, SOCIAL_ACTIVITIES, SOCIAL_GROUPS, socialRestriction, socialText,
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
  if(state.relationship.recent.slice(-3).some(e=>e.action===a.id))return 6;
  if(socialRestriction(a,state,role))return 4;
  if(a.context)return 0;
  if(a.object==='eat'&&[role,otherPerson(role)].some(id=>state.characters[id].hunger<54))return 0;
  if(a.object==='dishes'&&state.dirtyDishes.table+state.dirtyDishes.yardTable>0)return 0;
  if(a.object==='unpack'&&state.world.tableBags>0)return 0;
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
    const list=SOCIAL_ACTIVITIES.filter(a=>a.group===group&&(!a.context||contextAvailable(a,state,role)))
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

export function renderRelationship(root:HTMLElement,state:GameState,role:CharacterId,suggest:(group:SocialGroup,id?:string)=>void,onOffer:()=>void,offered:boolean){
  const p=state.relationship, now=gameMinutes(state.clock);
  const pane=node('section','','relationship');
  const cover=node('header','','relationship-hero');
  cover.append(node('small','ДОМ, КОТОРЫЙ МЫ ДЕЛИМ'),node('h2','Влад и Алина'),
    node('p',p.lastTogether!==undefined&&now-p.lastTogether<=1440?'Сегодня уже нашли время друг для друга.':'Вместе можно прожить даже самый обычный день.'));
  pane.append(cover);
  if(offered)pane.append(button('Открыть приглашение',onOffer));
  const available=SOCIAL_ACTIVITIES.filter(a=>!socialRestriction(a,state,role))
    .sort((a,b)=>contextOrder(a,state,role)-contextOrder(b,state,role));
  const suggestions=node('div','','relationship-suggestions');
  for(const a of [...new Map(available.map(a=>[a.group,a])).keys()].slice(0,4).map(group=>available.find(a=>a.group===group)!)) {
    suggestions.append(button(SOCIAL_GROUPS[a.group][0]+' '+a.title,()=>suggest(a.group,a.id)));
  }
  if(suggestions.childElementCount)pane.append(node('h3','Что сделать вместе'),suggestions);
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

export function createSocialOffer(root:HTMLElement,send:SocialSend){
  let offer:SocialOffer|null=null, self:CharacterId|null=null, folded=false;
  let timer:number|undefined;
  function render(){
    root.hidden=!offer;
    if(!offer){root.replaceChildren();return;}
    const current=offer, outgoing=current.from===self;
    const heading=node('strong',outgoing?'Приглашение отправлено':names[current.from]+' предлагает');
    const title=node('h3',current.title);
    const clock=node('small','','social-clock');
    const tick=()=>{clock.textContent=Math.max(0,Math.ceil((current.expiresAt-Date.now())/1000))+' с';};
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
    set(next:SocialOffer,role:CharacterId){offer=next;self=role;folded=false;render();},
    clear(id?:number){if(id!==undefined&&offer?.id!==id)return;window.clearInterval(timer);timer=undefined;offer=null;render();},
    get pending(){return !!offer;},
    unfold(){folded=false;render();},
  };
}
