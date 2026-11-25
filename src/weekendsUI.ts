import {WEEKEND_ACTIVITIES,WEEKEND_PRESETS,weekendEstimate,initialWeekends,type WeekendActivity,type WeekendPreset,type WeekendCommand} from './shared/weekends';
import {formatRub} from './shared/economy';
import {names,type CharacterId,type GameState} from './shared/protocol';
import {PLACES} from './shared/locations';
const actions:Partial<Record<WeekendActivity,string>>={breakfast:'breakfastCare',pool:'poolSwimTogether',grill:'grill',hookah:'yardHookah',ufc:'consoleTogether',cafe:'cafeMeal',evening:'sofaTalk',bowling:'venueBowling',billiards:'venueBilliards',hockey:'venueHockey',dog:'walk',picnic:'picnic',coffee:'yardCoffee'};
export function createWeekendsUI(root:HTMLElement,send:(c:WeekendCommand)=>boolean,openAction:(id:string)=>void,openTravel:(id:WeekendActivity)=>void){
 let draft:{preset:WeekendPreset;items:WeekendActivity[]}|undefined,key='';
 const card=(title:string,description?:string)=>{const a=document.createElement('article');a.className='weekend-card';const h=document.createElement('strong');h.textContent=title;a.append(h);if(description){const p=document.createElement('p');p.textContent=description;a.append(p);}return a;};
 const button=(label:string,fn:()=>void,disabled=false,secondary=false)=>{const b=document.createElement('button');b.type='button';b.textContent=label;b.disabled=disabled;b.className=secondary?'weekend-secondary':'weekend-primary';b.onclick=fn;return b;};
 const text=(parent:HTMLElement,label:string)=>{const p=document.createElement('p');p.textContent=label;parent.append(p);return p;};
 const estimate=(items:WeekendActivity[])=>{const e=weekendEstimate(items);return e.min===e.max?formatRub(e.min):formatRub(e.min)+' – '+formatRub(e.max);};
 function render(s:GameState,role:CharacterId,online:CharacterId[],force=false){
  const w=s.weekends??initialWeekends(),p=w.plan;
  const next=JSON.stringify([w,role,online,s.money,s.world.places,s.world.dogWalker,s.world.spa]);
  if(!force&&key===next)return;key=next;
  const scroll=root.scrollTop,partner=role==='vlad'?'alina':'vlad';
  const refresh=()=>render(s,role,online,true);
  const title=card('Наши планы','Выходные в вашем ритме. Это идеи для отдыха, не обязательные задания.');
  title.classList.add('weekend-intro');
  const cards=[title];
  if(p){
   const preset=WEEKEND_PRESETS[p.preset],confirmed=p.approved.length===2;
   const plan=card(preset.icon+' '+preset.title,confirmed?'Согласовано вдвоём':names[p.author]+' предложил(а) программу');
   const votes=document.createElement('div');votes.className='weekend-votes';
   for(const r of ['vlad','alina'] as const){const span=document.createElement('span');span.textContent=(p.approved.includes(r)?'✓ ':'○ ')+names[r]+(online.includes(r)?'':' · офлайн');votes.append(span);}plan.append(votes);
   text(plan,'Ориентир на услуги: '+estimate(p.items)+' · Баланс '+formatRub(s.money));
   text(plan,'Продукты, расходники и покупки оборудования не включены. Деньги списываются только при реальном использовании.');
   if(!confirmed){if(!p.approved.includes(role))plan.append(button('Согласовать программу',()=>send({type:'weekend_accept',version:w.version})));else text(plan,'Ждём ответ второго игрока. План сохраняется даже после выхода.');}
   for(const id of p.items){
    const a=WEEKEND_ACTIVITIES[id],row=document.createElement('section');row.className='weekend-step';row.dataset.weekendStep=id;
    const label=document.createElement('strong');label.textContent=(p.done.includes(id)?'✓ ':a.icon+' ')+a.title;row.append(label);
    text(row,p.done.includes(id)?'Провели вместе':a.hint);
    if(!p.done.includes(id)&&confirmed){
     const together=s.world.places[role]===a.place&&s.world.places[partner]===a.place;
     if(id==='spa'&&together)text(row,'Выберите доступную процедуру на самой локации.');
     else if(together&&actions[id]&&(id!=='dog'||s.world.dogWalker))row.append(button('К занятию',()=>openAction(actions[id]!),!online.includes(partner),true));
     else row.append(button(id==='spa'?'Открыть SPA':id==='bowling'||id==='hockey'||id==='billiards'?'Поездка в PLAY ARENA':id==='dog'?'Карта / прогулка с Верделлом':'Карта · '+PLACES[a.place].name,()=>openTravel(id),false,true));
    }
    plan.append(row);
   }
   if(confirmed&&p.done.length){plan.append(button(p.finishVotes.includes(role)?'Ждём подтверждение завершения':p.finishVotes.includes(partner)?'Подтвердить завершение дня':'Завершить день и сохранить память',()=>send({type:'weekend_finish',version:w.version}),p.finishVotes.includes(role)));text(plan,'Не обязательно выполнять всё. В память попадут только состоявшиеся занятия.');}
   plan.append(button('Изменить программу',()=>{draft={preset:p.preset,items:[...p.items]};refresh();},false,true),button('Отменить план без штрафа',()=>{if(send({type:'weekend_cancel',version:w.version})){draft=undefined;}},false,true));cards.push(plan);
  }
  if(!p||draft){
   const chooser=card(p?'Новая программа':'Выбрать выходной','Можно менять состав занятий.');
   const presets=document.createElement('div');presets.className='weekend-presets';
   for(const id of Object.keys(WEEKEND_PRESETS) as WeekendPreset[]){const d=WEEKEND_PRESETS[id],b=button(d.icon+' '+d.title,()=>{draft={preset:id,items:[...d.items]};refresh();},false,true);b.dataset.weekendPreset=id;b.setAttribute('aria-pressed',String(draft?.preset===id));presets.append(b);}
   chooser.append(presets);
   if(draft){
    const selection=document.createElement('div');selection.className='weekend-selection';
    for(const id of Object.keys(WEEKEND_ACTIVITIES) as WeekendActivity[]){const a=WEEKEND_ACTIVITIES[id],l=document.createElement('label'),c=document.createElement('input');c.type='checkbox';c.checked=draft.items.includes(id);c.disabled=!c.checked&&draft.items.length>=6;c.dataset.weekendPick=id;c.onchange=()=>{if(!draft)return;draft.items=c.checked?[...draft.items,id]:draft.items.filter(x=>x!==id);refresh();};l.append(c,document.createTextNode(a.icon+' '+a.title));selection.append(l);}
    chooser.append(selection);text(chooser,'Услуги: '+estimate(draft.items)+' · до 6 занятий. Без предоплаты.');
    const propose=button('Предложить программу',()=>{if(!draft)return;if(send({type:'weekend_propose',version:w.version,preset:draft.preset,items:[...draft.items]}))draft=undefined;},!draft.items.length);propose.dataset.weekendPropose='';chooser.append(propose);
    if(p)chooser.append(button('Закрыть редактирование',()=>{draft=undefined;refresh();},false,true));
   }
   cards.push(chooser);
  }
  const memory=s.relationship.memories.filter(m=>m.action.startsWith('familyWeekend:')).slice(-3).reverse();
  if(memory.length){const history=card('Наши выходные');for(const m of memory)text(history,m.title+' · '+m.description);cards.push(history);}
  root.replaceChildren(...cards);root.scrollTop=scroll;
 }
 return {render,reset(){key='';draft=undefined;}};
}
