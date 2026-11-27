import {HOCKEY_LIMIT,HOCKEY_STEP,type HockeyCommand,type HockeyMatch} from './shared/manualHockey';
import type {CharacterId} from './shared/protocol';
const names={vlad:'Влад',alina:'Алина'};
const el=<K extends keyof HTMLElementTagNameMap>(tag:K,cls='',label='')=>{const n=document.createElement(tag);n.className=cls;n.textContent=label;return n;};
export function createHockeyUI(root:HTMLElement,role:()=>CharacterId|null,send:(c:HockeyCommand)=>boolean,rematch:()=>boolean,cancel:()=>void){
 let match:HockeyMatch|undefined,seq=0,lastSent=0,frame=0,settled=false,arrived=0;
 let score:HTMLElement,clock:HTMLElement,status:HTMLElement,table:HTMLElement,own:HTMLElement,opponent:HTMLElement,puck:HTMLElement,controls:HTMLElement;
 let prev:HockeyMatch|undefined;
 const close=()=>{cancelAnimationFrame(frame);frame=0;match=prev=undefined;settled=false;root.hidden=true;root.replaceChildren();};
 const button=(label:string,action:()=>void)=>{const b=el('button','action-button',label);b.onclick=action;return b;};
 const draw=(now:number)=>{const m=match,me=role();if(!m||!me)return;const peer=me==='vlad'?'alina':'vlad';const t=Math.min(1,Math.max(0,(now-arrived)/50));
  const place=(node:HTMLElement,p:{x:number;y:number},old?:{x:number;y:number})=>{const x=old?old.x+(p.x-old.x)*t:p.x,y=old?old.y+(p.y-old.y)*t:p.y,sign=me==='vlad'?1:-1;node.style.left=(.5+sign*x)*100+'%';node.style.top=(.5+sign*y*.5)*100+'%';};
  place(own,m.pads[me],prev?.pads[me]);place(opponent,m.pads[peer],prev?.pads[peer]);place(puck,m.puck,m.serve?undefined:prev?.puck);
  if(!m.finished)frame=requestAnimationFrame(draw);else frame=0;
 };
 function mount(){
  const header=el('header','bowling-heading');header.append(el('strong','','🏒 PLAY ARENA · Аэрохоккей'),el('small','','До 7 голов · 90 секунд · 650 ₽'));
  score=el('div','hockey-score');clock=el('div','hockey-clock');status=el('p','bowling-status','Веди свою биту пальцем по нижней половине поля.');
  table=el('div','hockey-table');table.setAttribute('aria-label','Игровое поле аэрохоккея');
  const top=el('div','hockey-goal top'),bottom=el('div','hockey-goal bottom'),center=el('div','hockey-center');
  own=el('div','hockey-pad own');opponent=el('div','hockey-pad opponent');puck=el('div','hockey-puck');table.append(top,bottom,center,opponent,own,puck);
  function move(e:PointerEvent){if(!match||match.finished||!role())return;const now=performance.now();if(now-lastSent<25&&e.type!=='pointerdown')return;lastSent=now;const box=table.getBoundingClientRect(),sign=role()==='vlad'?1:-1,x=Math.max(-.4,Math.min(.4,(e.clientX-box.left)/box.width-.5)),y=Math.max(.12,Math.min(.89,((e.clientY-box.top)/box.height-.5)*2));send({type:'hockey_move',id:match.id,sequence:++seq,x:x*sign,y:y*sign});}
  table.onpointerdown=e=>{if(!e.isPrimary)return;table.setPointerCapture(e.pointerId);move(e);};table.onpointermove=e=>{if(table.hasPointerCapture(e.pointerId))move(e);};table.onpointerup=e=>{if(table.hasPointerCapture(e.pointerId))table.releasePointerCapture(e.pointerId);};
  controls=el('div','bowling-controls');controls.append(button('Отменить партию',cancel));root.replaceChildren(header,score,clock,table,status,controls);root.hidden=false;
 }
 function update(){
  const m=match;if(!m)return;
  score.textContent='Влад  '+m.score.vlad+' : '+m.score.alina+'  Алина';clock.textContent=Math.max(0,Math.ceil(HOCKEY_LIMIT-m.tick*HOCKEY_STEP))+' сек.';
  status.textContent=m.finished?'Сохраняем результат…':m.serve?'Подача…':'Веди свою биту пальцем. Забей в верхние ворота!';
  if(!frame)frame=requestAnimationFrame(draw);
 }
 return {show(next:HockeyMatch){if(match?.id!==next.id){close();seq=0;lastSent=0;mount();}else if(next.tick<match.tick)return;prev=match;match=next;arrived=performance.now();update();},complete(success:boolean){if(!match)return;if(!success||!match.finished){close();return;}if(settled)return;settled=true;const {vlad,alina}=match.score;status.textContent=vlad===alina?'Ничья!':names[vlad>alina?'vlad':'alina']+' победил(а)!';controls.replaceChildren(button('Реванш',()=>{if(rematch())close();}),button('Закрыть',close));},close};
}
