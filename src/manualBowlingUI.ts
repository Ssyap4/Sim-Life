import {bowlingScore,type BowlingMatch,type BowlingCommand} from './shared/manualBowling';
import type {CharacterId} from './shared/protocol';
const names={vlad:'Влад',alina:'Алина'};
const el=<K extends keyof HTMLElementTagNameMap>(tag:K,cls='',label='')=>{const node=document.createElement(tag);node.className=cls;node.textContent=label;return node;};
export function createBowlingUI(root:HTMLElement,role:()=>CharacterId|null,send:(c:BowlingCommand)=>boolean,rematch:()=>boolean,cancel:()=>void){
 let match:BowlingMatch|undefined,aim=0,power=.65,waiting=false,settled=false,animation:Animation|undefined;
 const close=()=>{animation?.cancel();root.hidden=true;root.replaceChildren();match=undefined;waiting=false;settled=false;};
 function render(){
  const m=match,me=role();if(!m||!me)return;
  const mine=m.turn===me&&!m.finished&&!waiting;
  root.hidden=false;root.replaceChildren();
  const header=el('header','bowling-heading');header.append(el('strong','','🎳 PLAY ARENA · Боулинг'),el('small','','5 фреймов · 1200 ₽ за законченную партию'));
  const score=el('div','bowling-score');
  for(const r of ['vlad','alina'] as const){const box=el('div','bowling-player'+(m.turn===r&&!m.finished?' current':''));box.append(el('strong','',names[r]),el('b','',String(bowlingScore(m.frames[r]))));const frames=el('div','bowling-frames');for(let i=0;i<5;i++){const f=m.frames[r][i];frames.append(el('span','',f?.length?f[0]===10&&f.length===1?'X':f.length===2&&f[0]+f[1]===10?f[0]+' /':f.join(' · '):'—'));}box.append(frames);score.append(box);}
  const lane=el('div','bowling-lane'),pins=el('div','bowling-pins');
  for(let i=0;i<10;i++){const pin=el('i',i<m.pins?'standing':'fallen');pin.style.setProperty('--pin',String(i));pins.append(pin);}
  const ball=el('div','bowling-ball');ball.style.left=(50+aim*37)+'%';
  lane.append(pins,ball);
  const caption=el('p','bowling-status',m.finished?(settled?'Партия завершена':'Сохраняем результат…'):mine?'Твой бросок!':waiting?'Бросок отправлен…':'Ходит '+names[m.turn]);
  if(m.last)caption.textContent+=' · Последний бросок: '+names[m.last.role]+' сбил(а) '+m.last.hit+' кег.';
  const controls=el('div','bowling-controls');
  function slider(label:string,min:number,max:number,step:number,val:number,on:(v:number)=>void){const wrap=el('label','bowling-slider',label);const input=el('input');input.type='range';input.min=String(min);input.max=String(max);input.step=String(step);input.value=String(val);input.disabled=!mine;input.setAttribute('aria-label',label);input.oninput=()=>on(Number(input.value));wrap.append(input);return wrap;}
  if(!m.finished){
   controls.append(slider('Направление',-1,1,.02,aim,v=>{aim=v;ball.style.left=(50+aim*37)+'%';}),slider('Сила броска',0,1,.02,power,v=>{power=v;}));
   const roll=el('button','action-button bowling-roll','Бросить шар');roll.disabled=!mine;roll.onclick=()=>{if(send({type:'bowling_roll',id:m.id,sequence:m.sequence,aim,power})){waiting=true;render();}};controls.append(roll);
   const exit=el('button','action-button','Отменить партию');exit.onclick=cancel;controls.append(exit);
  }else{
   if(settled){const v=bowlingScore(m.frames.vlad),a=bowlingScore(m.frames.alina);caption.textContent=v===a?'Ничья!':names[v>a?'vlad':'alina']+' победил(а)!';const again=el('button','action-button','Реванш');again.onclick=()=>{if(rematch())close();};controls.append(again);}
   const exit=el('button','action-button','Закрыть');exit.onclick=close;controls.append(exit);
  }
  root.append(header,score,lane,caption,controls);
  if(m.last&&m.sequence>0){const offset=(50+m.last.aim*37)+'%';animation=ball.animate([{left:offset,bottom:'8%',transform:'translateX(-50%) scale(1)'},{left:offset,bottom:'80%',transform:'translateX(-50%) scale(.48)'}],{duration:500,easing:'ease-out'});}
 }
 return {show(next:BowlingMatch){if(match?.id!==next.id){aim=0;power=.65;settled=false;}if(match?.id===next.id&&next.sequence<match.sequence)return;match=next;waiting=false;render();},retry(){if(waiting){waiting=false;render();}},complete(success:boolean){if(!match)return;if(success&&match.finished){settled=true;render();}else close();},close};
}
