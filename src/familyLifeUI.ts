import {OCCASIONS,PERSONAL_OCCASIONS,HOBBIES,HOBBY_LEVELS,HOBBY_RESULTS,LIFE_EVENTS,occasionsAhead,familyLife,currentLifeEvent,isGoalEvent,eventStatus,type FamilyLifeCommand,type Hobby} from './shared/familyLife';
import type {GameState,CharacterId} from './shared/protocol';
import {displayDate} from './shared/life';
const make=<K extends keyof HTMLElementTagNameMap>(tag:K,text='')=>{const el=document.createElement(tag);el.textContent=text;return el;};
export function createFamilyLifeUI(info:HTMLElement,send:(c:FamilyLifeCommand)=>boolean){
 let key='';
 function card(title:string,description:string){const a=make('article');a.append(make('strong',title),make('p',description));return a;}
 function button(label:string,action:()=>void){const b=make('button',label);b.type='button';b.onclick=action;return b;}
 function render(s:GameState,role:CharacterId,view:'holidays'|'hobbies'|'events'){
  const f=familyLife(s),e=currentLifeEvent(s),signature=JSON.stringify([view,role,s.clock.day,view==='holidays'?[f.dates,f.celebrated]:view==='hobbies'?f.hobbies[role]:[e,s.money,f.eventHistory,f.event]]);
  if(signature===key)return;key=signature;
  const scroll=info.scrollTop,nodes:HTMLElement[]=[];
  if(view==='holidays'){
   nodes.push(card('🎉 Семейные праздники','Праздники по семейному календарю. Отметьте их совместным занятием: праздничные возможности доступны все игровые сутки, в которые попадает дата.'));
   for(const o of occasionsAhead(s)){
    const c=card(OCCASIONS[o.id].title,o.date+'.'+String(o.month).padStart(2,'0')+' · '+(o.inDays===0?o.celebrated?'Уже отметили':'Можно праздновать!':'Через '+o.inDays+' игр. дн.'));
    if(o.id==='easter')c.append(make('small','В этот день на кухне: блинчики с ягодами и сливками, с мёдом и яблоками.'));
    if(o.id==='vladBirthday'||o.id==='alinaBirthday')c.append(make('small','На кухне: именинный торт. Подарки можно заказать в доставке и вручить дома.'));
    if(o.inDays===0&&!o.celebrated)c.append(make('small','Вместе → Нежность → Поздравить с праздником.'));
    if(o.id==='christmas')c.append(make('small','В этот день на кухне: рождественские яблоки с мёдом и ягодами.'));
    nodes.push(c);
   }
   for(const id of PERSONAL_OCCASIONS){
    const c=card(OCCASIONS[id].title,'Дата праздника (день и месяц).');
    const row=make('div');row.className='family-date-row';
    const day=make('input'),month=make('select');day.type='number';day.min='1';day.max='31';day.value=String(f.dates[id]?.day??1);day.setAttribute('aria-label','День · '+OCCASIONS[id].title);
    for(let i=1;i<=12;i++){const o=make('option',String(i).padStart(2,'0'));o.value=String(i);month.append(o);}month.value=String(f.dates[id]?.month??1);month.setAttribute('aria-label','Месяц · '+OCCASIONS[id].title);
    row.append(day,month,button('Сохранить',()=>send({type:'family_date',id,day:Number(day.value),month:Number(month.value)})));c.append(row);nodes.push(c);
   }
  }else if(view==='hobbies'){
   nodes.push(card('Мои увлечения','Занимайтесь любимыми делами в игре. Один зачёт за каждое хобби в игровой день; новые книги и блюда пополняют коллекцию.'));
   for(const id of Object.keys(HOBBIES) as Hobby[]){
    const h=HOBBIES[id],p=f.hobbies[role][id],n=p?.sessions??0,level=HOBBY_LEVELS.filter(x=>n>=x).length;
    const c=card(h.icon+' '+h.name,h.hint);c.append(make('small',(level?h.milestones[level-1]:'Начало пути')+' · Занятий: '+n+' · Разновидностей: '+(p?.unique.length??0)));
    if(id==='painting'||id==='modeling'){
      const collection=make('div');collection.className='hobby-collection';
      for(const [key,work] of Object.entries(HOBBY_RESULTS).filter(([k])=>id==='painting'?k.startsWith('paint'):k.startsWith('build'))){
        const done=p?.unique.includes(key)??false;const tile=make('div');tile.className='hobby-work';tile.dataset.done=String(done);tile.append(make('strong',done?work.icon:'🔒'),make('span',work.title),make('small',done?'В коллекции':'Не завершено'));collection.append(tile);
      }c.append(collection);
    }
    const track=make('progress');track.max=HOBBY_LEVELS[level]??15;track.value=Math.min(n,track.max);track.setAttribute('aria-label','Прогресс '+h.name);c.append(track,make('p',p?.lastDay===s.clock.day?'Сегодня зачтено':level===3?'Все основные этапы пройдены':'Следующий этап: '+track.max+' занятий'));nodes.push(c);
   }
  }else{
   nodes.push(card('✨ Жизненные события','Небольшие общие возможности появляются время от времени. Решение одного игрока действует для всей семьи; пропуск не штрафуется.'));
   if(!e)nodes.push(card('Пока спокойно','Новых событий сегодня нет.'));
   else{
    const v=LIFE_EVENTS[e.id],c=card(v.title,v.description);
    if(e.status==='open')c.append(button(v.accept,()=>send({type:'family_event',day:e.day,id:e.id,accept:true})),button(v.decline,()=>send({type:'family_event',day:e.day,id:e.id,accept:false})));
    else c.append(make('small',eventStatus(e,s.clock.day)));
    if(e.status==='accepted'&&isGoalEvent(e.id))c.append(make('p','Выполните указанное занятие до конца игровых суток. За завершение: +8 настроения.'));
    nodes.push(c);
   }
   const past=[...(f.eventHistory??[]),...(f.event&&f.event.day<s.clock.day?[f.event]:[])].slice(-6).reverse();
   if(past.length){nodes.push(card('Недавние события','История последних событий семьи.'));for(const old of past)nodes.push(card(LIFE_EVENTS[old.id].title,eventStatus(old,s.clock.day)+' · '+displayDate({day:old.day,minute:600}).day+'.'+String(displayDate({day:old.day,minute:600}).month).padStart(2,'0')));}
  }
  info.replaceChildren(...nodes);info.scrollTop=scroll;
 }
 return {render,reset:()=>{key='';}};
}
