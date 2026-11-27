import {POOL_LIMIT,POOL_STEP,POOL_POCKETS,type PoolCommand,type PoolMatch} from './shared/manualPool';
import type {CharacterId} from './shared/protocol';
const names={vlad:'Влад',alina:'Алина'},colors=['#fffaf0','#ecc94b','#416eac','#b9534b','#8453a2','#dc8b40','#4f9777','#854e3c','#292e34','#dcc94e'];
const el=<K extends keyof HTMLElementTagNameMap>(tag:K,cls='',label='')=>{const n=document.createElement(tag);n.className=cls;n.textContent=label;return n;};
export function createPoolUI(root:HTMLElement,role:()=>CharacterId|null,send:(c:PoolCommand)=>boolean,rematch:()=>boolean,cancel:()=>void){
 let match:PoolMatch|undefined,prev:PoolMatch|undefined,angle=0,power=.75,waiting=false,settled=false,frame=0,arrived=0;
 let table:HTMLElement,score:HTMLElement,status:HTMLElement,clock:HTMLElement,guide:HTMLElement,cue:HTMLElement,shoot:HTMLButtonElement,slider:HTMLInputElement,controls:HTMLElement;
 let nodes:HTMLElement[]=[];
 const close=()=>{cancelAnimationFrame(frame);frame=0;match=prev=undefined;waiting=settled=false;root.hidden=true;root.replaceChildren();};
 const button=(label:string,action:()=>void)=>{const b=el('button','action-button',label);b.onclick=action;return b;};
 const mine=()=>!!match&&!match.moving&&!match.finished&&!waiting&&match.turn===role();
 function aimGuide(){if(!match)return;const b=match.balls[0],x=Math.sin(angle),y=-Math.cos(angle);
  const xwall=x>0?.466:-.466,ywall=y>0?.966:-.966;
  const length=Math.min(Math.abs(x)>1e-6?(xwall-b.x)/x:Infinity,Math.abs(y)>1e-6?(ywall-b.y)/y:Infinity,.9);
  const scale=table.clientWidth;
  guide.style.left=(.5+b.x)*100+'%';guide.style.top=(.5+b.y/2)*100+'%';guide.style.width=Math.max(0,length)*scale+'px';guide.style.transform='rotate('+(angle-Math.PI/2)+'rad)';
  cue.style.left=guide.style.left;cue.style.top=guide.style.top;cue.style.transform='rotate('+(angle+Math.PI/2)+'rad)';guide.hidden=cue.hidden=!mine();
 }
 function draw(now:number){const m=match;if(!m)return;const t=m.moving?Math.min(1,Math.max(0,(now-arrived)/50)):1;
  for(const b of m.balls){const node=nodes[b.id],old=prev?.balls[b.id];node.hidden=b.out;const x=old&&!old.out?old.x+(b.x-old.x)*t:b.x,y=old&&!old.out?old.y+(b.y-old.y)*t:b.y;node.style.left=(.5+x)*100+'%';node.style.top=(.5+y/2)*100+'%';}
  aimGuide();if(m.moving)frame=requestAnimationFrame(draw);else frame=0;
 }
 function mount(){
  const header=el('header','bowling-heading');header.append(el('strong','','🎱 PLAY ARENA · Бильярд'),el('small','','9 шаров · свободный выбор лузы · 850 ₽'));
  score=el('div','hockey-score');clock=el('div','hockey-clock');status=el('p','bowling-status');
  table=el('div','pool-table');table.setAttribute('aria-label','Бильярдный стол');
  for(const p of POOL_POCKETS){const n=el('div','pool-pocket');n.style.left=(.5+p.x)*100+'%';n.style.top=(.5+p.y/2)*100+'%';table.append(n);}
  guide=el('div','pool-guide');cue=el('div','pool-cue');table.append(guide,cue);nodes=colors.map((color,id)=>{const n=el('div','pool-ball',id?String(id):'');n.style.background=color;if(id===9)n.classList.add('stripe');table.append(n);return n;});
  function aim(e:PointerEvent){if(!mine()||!match)return;const box=table.getBoundingClientRect(),b=match.balls[0],dx=(e.clientX-box.left-table.clientLeft)/table.clientWidth-.5-b.x,dy=((e.clientY-box.top-table.clientTop)/table.clientHeight-.5)*2-b.y;if(Math.hypot(dx,dy)>.015){angle=Math.atan2(dx,-dy);aimGuide();}}
  table.onpointerdown=e=>{if(!e.isPrimary||!mine())return;table.setPointerCapture(e.pointerId);aim(e);};table.onpointermove=e=>{if(table.hasPointerCapture(e.pointerId))aim(e);};
  const label=el('label','bowling-slider','Сила удара');slider=el('input');slider.type='range';slider.min='.08';slider.max='1';slider.step='.01';slider.value=String(power);slider.setAttribute('aria-label','Сила удара');slider.oninput=()=>{power=Number(slider.value);};label.append(slider);
  shoot=button('Ударить кием',()=>{if(match&&mine()&&send({type:'pool_shot',id:match.id,sequence:match.sequence,angle,power})){waiting=true;update();}});
  controls=el('div','bowling-controls');controls.append(label,shoot,button('Отменить партию',cancel));root.replaceChildren(header,score,clock,table,status,controls);root.hidden=false;
 }
 function update(){const m=match;if(!m)return;score.textContent='Влад '+m.score.vlad+' : '+m.score.alina+' Алина';clock.textContent=Math.max(0,Math.ceil(POOL_LIMIT-m.tick*POOL_STEP))+' сек. · осталось '+m.balls.slice(1).filter(b=>!b.out).length+' шаров';
  status.textContent=m.finished?'Сохраняем результат…':waiting?'Удар отправлен…':m.moving?'Шары катятся…':(mine()?'Твой ход · коснись стола для прицела':'Ходит '+names[m.turn])+' · '+m.last;
  shoot.disabled=slider.disabled=!mine();if(!frame)frame=requestAnimationFrame(draw);
 }
 return {show(next:PoolMatch){if(match?.id!==next.id){close();angle=0;power=.75;mount();}else if(next.tick<match.tick)return;prev=match;if(!match||next.sequence!==match.sequence)waiting=false;match=next;arrived=performance.now();update();},retry(){if(waiting){waiting=false;update();}},complete(success:boolean){if(!match)return;if(!success||!match.finished){close();return;}if(settled)return;settled=true;const {vlad,alina}=match.score;status.textContent=names[vlad>alina?'vlad':'alina']+' победил(а)!';controls.replaceChildren(button('Реванш',()=>{if(rematch())close();}),button('Закрыть',close));},close};
}
