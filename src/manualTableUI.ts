import {DART_SECTORS,dartWobble,jengaMeter,jengaRisk,TABLE_STEP,type TableMatch,type TableCommand} from './shared/manualTableGames';
import type {CharacterId} from './shared/protocol';
const names={vlad:'Влад',alina:'Алина'};
const el=<K extends keyof HTMLElementTagNameMap>(tag:K,cls='',label='')=>{const n=document.createElement(tag);n.className=cls;n.textContent=label;return n;};
export function createTableUI(root:HTMLElement,role:()=>CharacterId|null,send:(c:TableCommand)=>boolean,rematch:(m:TableMatch)=>boolean,cancel:()=>void){
 let match:TableMatch|undefined,waiting=false,settled=false,frame=0,arrived=0,aim={x:0,y:0},chosen:{row:number;slot:number}|undefined,force=.45,board:HTMLElement,status:HTMLElement,score:HTMLElement,action:HTMLButtonElement,controls:HTMLElement,detail:HTMLElement,meter:HTMLElement,reticle:HTMLElement,canvas:HTMLCanvasElement|undefined,rendered=-1;
 const close=()=>{cancelAnimationFrame(frame);frame=0;match=undefined;waiting=settled=false;chosen=undefined;root.hidden=true;root.replaceChildren();};
 const btn=(label:string,fn:()=>void)=>{const b=el('button','action-button',label);b.onclick=fn;return b;};
 const mine=()=>!!match&&!match.finished&&!waiting&&match.turn===role()&&match.tick>=match.readyAt;
 function paintDarts(){const c=canvas?.getContext('2d');if(!c||!canvas)return;const s=canvas.width/2,r=s*.87;c.clearRect(0,0,s*2,s*2);
 c.fillStyle='#212c2a';c.beginPath();c.arc(s,s,s*.99,0,Math.PI*2);c.fill();
 const wedge=(lo:number,hi:number,a:number,b:number,color:string)=>{c.fillStyle=color;c.beginPath();c.arc(s,s,r*hi,a,b);c.arc(s,s,r*lo,b,a,true);c.closePath();c.fill();};
 for(let i=0;i<20;i++){const a=i*Math.PI/10-Math.PI/2-Math.PI/20,b=a+Math.PI/10;wedge(.093,1,a,b,i%2?'#e8dfc7':'#343634');for(const [lo,hi] of [[.53,.62],[.91,1]])wedge(lo,hi,a,b,i%2?'#39856b':'#b84644');const mid=(a+b)/2;c.fillStyle='#fff7e6';c.font='bold 17px sans-serif';c.textAlign='center';c.textBaseline='middle';c.fillText(String(DART_SECTORS[i]),s+Math.cos(mid)*r*1.085,s+Math.sin(mid)*r*1.085);}
 for(const [ratio,color] of [[.093,'#39856b'],[.037,'#b84644']] as const){c.fillStyle=color;c.beginPath();c.arc(s,s,r*ratio,0,Math.PI*2);c.fill();}
 if(match?.game==='darts')for(const h of match.hits.slice(-3)){c.fillStyle=h.role==='vlad'?'#65b9ff':'#ffc35e';c.beginPath();c.arc(s+h.x*r,s+h.y*r,4,0,Math.PI*2);c.fill();}
 }
 function tower(){const m=match;if(m?.game!=='jenga')return;board.replaceChildren();for(let i=m.rows.length-1;i>=0;i--){const row=el('div','jenga-row');row.dataset.level=String(i);for(let j=0;j<3;j++){const b=el('button','jenga-block'+(m.rows[i]&(1<<j)?'':' empty'));b.type='button';b.setAttribute('aria-label','Этаж '+(i+1)+' · брусок '+(j+1));const risk=jengaRisk(m,i,j);b.disabled=risk===undefined||!mine();b.classList.toggle('selected',chosen?.row===i&&chosen.slot===j);b.onclick=()=>{chosen={row:i,slot:j};rendered=-1;update();};row.append(b);}board.append(row);}board.classList.toggle('collapsed',!!m.collapsed);}
 function draw(now:number){const m=match;if(!m){frame=0;return;}const tick=m.tick+Math.min(2,Math.max(0,(now-arrived)/TABLE_STEP));
 if(m.game==='darts'){const w=dartWobble(tick,m.sequence);reticle.style.left=(.5+(aim.x+w.x)*.435)*100+'%';reticle.style.top=(.5+(aim.y+w.y)*.435)*100+'%';reticle.hidden=m.finished||m.turn!==role();}
 else meter.style.left=jengaMeter(tick,m.sequence)*100+'%';
 if(!m.finished)frame=requestAnimationFrame(draw);else frame=0;
 }
 function mount(m:TableMatch){const header=el('header','bowling-heading');header.append(el('strong','',m.game==='darts'?'🎯 Домашний дартс':'🧱 PLAY ARENA · Дженга'),el('small','',m.game==='darts'?'5 раундов по 3 броска · бесплатно':'Не урони башню · 450 ₽'));
 score=el('div','hockey-score');status=el('p','bowling-status');detail=el('p','table-detail');board=el('div',m.game==='darts'?'darts-board':'jenga-tower');controls=el('div','bowling-controls');
 if(m.game==='darts'){canvas=el('canvas');canvas.width=360;canvas.height=360;reticle=el('div','darts-reticle');board.append(canvas,reticle);
 const target=(e:PointerEvent)=>{if(!mine())return;const r=board.getBoundingClientRect();aim={x:Math.max(-1,Math.min(1,((e.clientX-r.left)/r.width-.5)/.435)),y:Math.max(-1,Math.min(1,((e.clientY-r.top)/r.height-.5)/.435))};};
 board.onpointerdown=e=>{if(!e.isPrimary||!mine())return;board.setPointerCapture(e.pointerId);target(e);};board.onpointermove=e=>{if(board.hasPointerCapture(e.pointerId))target(e);};
 action=btn('Бросить дротик',()=>{if(match&&mine()&&send({type:'table_throw',id:match.id,sequence:match.sequence,...aim})){waiting=true;update();}});
 }else{canvas=undefined;const track=el('div','jenga-meter');meter=el('i');track.append(meter);const label=el('label','bowling-slider','Усилие извлечения');const slider=el('input');slider.type='range';slider.min='0';slider.max='1';slider.step='.01';slider.value=String(force);slider.setAttribute('aria-label','Усилие извлечения');slider.oninput=()=>{force=Number(slider.value);};label.append(slider);controls.append(track,label);
 action=btn('Вытащить брусок',()=>{if(match&&chosen&&mine()&&send({type:'table_pull',id:match.id,sequence:match.sequence,...chosen,force})){waiting=true;update();}});
 }
 controls.append(action,btn('Отменить партию',cancel));root.replaceChildren(header,score,board,status,detail,controls);root.hidden=false;
 }
 function update(){const m=match;if(!m)return;const key=m.sequence*4+Number(mine())+Number(m.finished)*2;
 score.textContent=m.game==='darts'?'Влад '+m.score.vlad+' : '+m.score.alina+' Алина':'Ходов: '+m.sequence;
 status.textContent=m.finished?'Сохраняем результат…':waiting?'Ход отправлен…':mine()?'Твой ход · '+m.last:'Ходит '+names[m.turn]+' · '+m.last;
 if(m.game==='darts'){detail.textContent='Влад: '+m.throws.vlad.length+'/15 · Алина: '+m.throws.alina.length+'/15. Прицелься и поймай момент.';if(rendered!==key)paintDarts();}
 else{const risk=chosen?jengaRisk(m,chosen.row,chosen.slot):undefined;detail.textContent='Нагрузка башни: '+Math.round(m.strain*100)+'% · '+(risk===undefined?'Выбери доступный брусок':'Нагрузка бруска '+Math.round(risk*100)+'% · держи индикатор ближе к центру');if(rendered!==key)tower();}
 action.disabled=!mine()||(m.game==='jenga'&&!chosen);rendered=key;if(!frame)frame=requestAnimationFrame(draw);
 }
 return {show(next:TableMatch){if(match?.id!==next.id){close();aim={x:0,y:0};force=.45;rendered=-1;mount(next);}else if(next.tick<match.tick)return;if(!match||next.sequence!==match.sequence){waiting=false;chosen=undefined;rendered=-1;}match=next;arrived=performance.now();update();},retry(){if(waiting){waiting=false;rendered=-1;update();}},complete(success:boolean){if(!match)return;if(!success||!match.finished){close();return;}if(settled)return;settled=true;const m=match,{vlad,alina}=m.score;status.textContent=(m.game==='jenga'&&m.collapsed?'Башня упала! · ':'')+(vlad===alina?'Ничья!':names[vlad>alina?'vlad':'alina']+' победил(а)!');controls.replaceChildren(btn('Реванш',()=>{if(rematch(m))close();}),btn('Закрыть',close));},close};
}
