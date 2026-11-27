import {HOCKEY_LIMIT,HOCKEY_STEP,approachHockeyPad,hockeyTarget,type HockeyPoint,type HockeyCommand,type HockeyMatch} from './shared/manualHockey';
import type {CharacterId} from './shared/protocol';
const names={vlad:'Влад',alina:'Алина'};
const el=<K extends keyof HTMLElementTagNameMap>(tag:K,cls='',label='')=>{const n=document.createElement(tag);n.className=cls;n.textContent=label;return n;};
const lerp=(a:HockeyPoint,b:HockeyPoint,t:number)=>({x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t});
export function createHockeyUI(root:HTMLElement,role:()=>CharacterId|null,send:(c:HockeyCommand)=>boolean,rematch:()=>boolean,cancel:()=>void){
 let match:HockeyMatch|undefined,seq=0,lastSent=-Infinity,frame=0,settled=false,arrived=0,lastFrame=0,pointer:number|null=null;
 let score:HTMLElement,clock:HTMLElement,status:HTMLElement,table:HTMLElement,own:HTMLElement,opponent:HTMLElement,puck:HTMLElement,controls:HTMLElement,flash:HTMLElement,trail:HTMLElement,progress:HTMLElement;
 let scoreKey='',clockKey='';
 let prev:HockeyMatch|undefined,target:HockeyPoint|undefined,predicted:HockeyPoint|undefined,goalTick=-100,goalLabel='',lastHit=-1;
 const close=()=>{cancelAnimationFrame(frame);frame=0;match=prev=undefined;target=predicted=undefined;pointer=null;settled=false;root.hidden=true;root.replaceChildren();};
 const button=(label:string,action:()=>void)=>{const b=el('button','action-button',label);b.onclick=action;return b;};
 const draw=(now:number)=>{const m=match,me=role();if(!m||!me){frame=0;return;}
  const peer=me==='vlad'?'alina':'vlad',dt=Math.min(.05,Math.max(0,(now-lastFrame)/1000)),age=now-arrived,t=Math.min(1,Math.max(0,age/50)),sign=me==='vlad'?1:-1;lastFrame=now;
  const place=(node:HTMLElement,p:HockeyPoint)=>{node.style.left=(.5+sign*p.x)*100+'%';node.style.top=(.5+sign*p.y*.5)*100+'%';};
  const authoritative=m.pads[me];
  if(target&&age<220&&!m.finished){predicted=approachHockeyPad(predicted??authoritative,target,dt);const dx=predicted.x-authoritative.x,dy=predicted.y-authoritative.y,d=Math.hypot(dx,dy);if(d>.18)predicted={x:authoritative.x+dx*.18/d,y:authoritative.y+dy*.18/d};}
  else predicted=authoritative;
  place(own,m.finished?authoritative:predicted);place(opponent,prev&&!m.finished?lerp(prev.pads[peer],m.pads[peer],t):m.pads[peer]);
  const pos=prev&&!m.serve&&!m.finished&&!prev.serve?lerp(prev.puck,m.puck,t):m.puck;place(puck,pos);
  const speed=Math.hypot(m.velocity.x,m.velocity.y);trail.hidden=!!m.serve||m.finished||speed<1.1;
  if(!trail.hidden){place(trail,pos);trail.style.width=Math.min(19,5+speed*4)+'%';trail.style.transform='rotate('+Math.atan2(sign*m.velocity.y,sign*m.velocity.x)+'rad)';}
  flash.hidden=m.finished||(!m.serve&&m.tick-goalTick>45);const label=m.serve?(m.tick-goalTick<45?goalLabel:'Подача · '+Math.max(1,Math.ceil(m.serve*HOCKEY_STEP))):goalLabel;if(flash.textContent!==label)flash.textContent=label;
  if(!m.finished)frame=requestAnimationFrame(draw);else frame=0;
 };
 function mount(){
  const header=el('header','hockey-header');header.append(el('strong','','🏒 PLAY ARENA'),el('small','','Аэрохоккей · 650 ₽'));
  score=el('div','hockey-score');clock=el('div','hockey-clock');progress=el('div','hockey-time-fill');const track=el('div','hockey-time-track');track.append(progress);
  status=el('p','bowling-status','Управляй синей битой внизу.');
  table=el('div','hockey-table');table.setAttribute('aria-label','Игровое поле аэрохоккея');
  const top=el('div','hockey-goal top'),bottom=el('div','hockey-goal bottom'),center=el('div','hockey-center');
  const topArc=el('div','hockey-arc top'),bottomArc=el('div','hockey-arc bottom');
  own=el('div','hockey-pad own');opponent=el('div','hockey-pad opponent');puck=el('div','hockey-puck');trail=el('div','hockey-trail');flash=el('div','hockey-flash');flash.hidden=true;
  table.append(top,bottom,center,topArc,bottomArc,trail,opponent,own,puck,flash);
  function move(e:PointerEvent,force=false){const m=match,me=role();if(!m||m.finished||!me)return;const box=table.getBoundingClientRect(),sign=me==='vlad'?1:-1;
   const x=(e.clientX-box.left-table.clientLeft)/table.clientWidth-.5,y=((e.clientY-box.top-table.clientTop)/table.clientHeight-.5)*2;
   target=hockeyTarget(me,{x:sign*x,y:sign*y});const now=performance.now();if(now-lastSent<25&&!force)return;lastSent=now;send({type:'hockey_move',id:m.id,sequence:++seq,...target});
  }
  table.onpointerdown=e=>{if(!e.isPrimary||pointer!==null||match?.finished)return;const box=table.getBoundingClientRect();if(e.clientY<box.top+box.height/2)return;pointer=e.pointerId;table.setPointerCapture(e.pointerId);move(e,true);};
  table.onpointermove=e=>{if(pointer===e.pointerId)move(e);};
  table.onpointerup=e=>{if(pointer!==e.pointerId)return;move(e,true);pointer=null;if(table.hasPointerCapture(e.pointerId))table.releasePointerCapture(e.pointerId);};
  table.onpointercancel=table.onlostpointercapture=e=>{if(pointer===e.pointerId)pointer=null;};
  controls=el('div','bowling-controls');controls.append(button('Отменить партию',cancel));root.replaceChildren(header,score,clock,track,table,status,controls);root.hidden=false;
 }
 function update(){
  const m=match;if(!m)return;const me=role()??'vlad',peer=me==='vlad'?'alina':'vlad';
  const key=me+':'+m.score.vlad+':'+m.score.alina;if(key!==scoreKey){scoreKey=key;const blue=el('span','hockey-own-score',names[me]+' '+m.score[me]),red=el('span','hockey-other-score',m.score[peer]+' '+names[peer]);score.replaceChildren(blue,el('b','',':'),red);}
  const left=Math.max(0,HOCKEY_LIMIT-m.tick*HOCKEY_STEP);const clockText=Math.ceil(left)+' сек. · до 7 голов';if(clockText!==clockKey){clockKey=clockText;clock.textContent=clockText;}progress.style.width=left/HOCKEY_LIMIT*100+'%';
  status.textContent=m.finished?'Сохраняем результат…':m.serve?'Приготовься к подаче':'Веди синюю биту пальцем · забей в верхние ворота';
  if(m.hitTick!==undefined&&m.hitTick!==lastHit){lastHit=m.hitTick;puck.animate([{filter:'brightness(1.7)'},{filter:'brightness(1)'}],{duration:160});}
  if(!frame){lastFrame=performance.now();frame=requestAnimationFrame(draw);}
 }
 return {show(next:HockeyMatch){if(match?.id!==next.id){close();seq=0;lastSent=-Infinity;goalTick=-100;goalLabel='';lastHit=-1;scoreKey=clockKey='';mount();}else if(next.tick<=match.tick)return;
  if(match&&(next.score.vlad!==match.score.vlad||next.score.alina!==match.score.alina)){goalTick=next.tick;goalLabel=next.lastGoal===role()?'ТВОЙ ГОЛ!':'Гол соперника';}
  prev=match;match=next;arrived=performance.now();update();
 },complete(success:boolean){if(!match)return;if(!success||!match.finished){close();return;}if(settled)return;settled=true;const {vlad,alina}=match.score;status.textContent=vlad===alina?'Ничья!':names[vlad>alina?'vlad':'alina']+' победил(а)!';controls.replaceChildren(button('Реванш',()=>{if(rematch())close();}),button('Закрыть',close));},close};
}
