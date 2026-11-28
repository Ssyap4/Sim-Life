import {NoticeQueue,noticeDuration,type Notice,type NoticeInput,type NoticeTarget} from './shared/notices';
const icons={info:'ℹ',success:'✓',warning:'!',urgent:'!'};
export function createNotifications(root:HTMLElement,history:HTMLElement,bell:HTMLButtonElement,navigate:(target:NoticeTarget)=>void){
 const queue=new NoticeQueue();
 let current:Notice|undefined,timer:number|undefined,suspended=false;
 const cancelTimer=()=>{window.clearTimeout(timer);timer=undefined;};
 const refreshBell=()=>{bell.querySelector('small')!.textContent=queue.unread>9?'9+':String(queue.unread);bell.querySelector('small')!.hidden=!queue.unread;};
 const button=(label:string,action:()=>void)=>{const b=document.createElement('button');b.type='button';b.textContent=label;b.onclick=action;return b;};
 const go=(target:NoticeTarget,live:boolean)=>{close();if(live)dismiss();navigate(target);};
 function card(n:Notice,live:boolean){
  const el=document.createElement('article');el.className='notice-card';el.dataset.kind=n.kind;
  const symbol=document.createElement('span');symbol.className='notice-symbol';symbol.textContent=icons[n.kind];
  const body=document.createElement('div');body.className='notice-body';
  const title=document.createElement('strong');title.textContent=n.title;
  const detail=document.createElement('p');detail.textContent=n.message;detail.title=n.message;
  body.append(title,detail);
  if(!live){const time=document.createElement('small');time.textContent=new Date(n.time).toLocaleTimeString('ru-RU',{hour:'2-digit',minute:'2-digit'});body.append(time);}
  if(n.target){el.dataset.action='true';const target=n.target;const b=button(({finance:'К платежам',health:'Здоровье',pets:'К питомцам',needs:'Потребности',events:'К событиям',holidays:'К праздникам',delivery:'К доставке',autonomy:'К желаниям',messages:'К переписке'})[target],()=>go(target,live));b.className='notice-link';body.append(b);}
  el.append(symbol,body);
  if(live){const x=button('×',dismiss);x.className='notice-close';x.setAttribute('aria-label','Закрыть уведомление');el.append(x);}
  return el;
 }
 function renderHistory(){
  const list=history.querySelector('.notice-history-list')!;list.replaceChildren();
  if(!queue.history.length){const p=document.createElement('p');p.textContent='Здесь будут важные события вашей игры.';list.append(p);}
  for(const n of queue.history)list.append(card(n,false));
 }
 function schedule(){cancelTimer();if(current&&!suspended&&!document.hidden&&history.hidden)timer=window.setTimeout(dismiss,noticeDuration(current));}
 function pump(){if(current||suspended||document.hidden||!history.hidden)return;current=queue.take();root.replaceChildren();if(!current)return;root.append(card(current,true));schedule();}
 function dismiss(){cancelTimer();current=undefined;root.replaceChildren();pump();}
 function close(){history.hidden=true;root.hidden=false;bell.setAttribute('aria-expanded','false');schedule();pump();}
 function open(){history.hidden=false;root.hidden=true;bell.setAttribute('aria-expanded','true');queue.read();refreshBell();cancelTimer();renderHistory();}
 bell.onclick=()=>history.hidden?open():close();
 history.querySelector('[data-notice-close]')!.addEventListener('click',close);
 history.addEventListener('click',e=>{if(e.target===history)close();});
 document.addEventListener('visibilitychange',()=>{if(document.hidden)cancelTimer();else{schedule();pump();}});
 return {push(input:NoticeInput){
  const n=queue.add(input,Date.now());if(!n)return;
  if(!history.hidden&&!suspended){queue.read();renderHistory();}
  refreshBell();
  if(current&&queue.outranks(n,current)){queue.requeue(current);cancelTimer();current=undefined;root.replaceChildren();}
  pump();
  },setSuspended(value:boolean){
  if(suspended===value)return;
  suspended=value;
  if(value){
   cancelTimer();
   if(current){queue.requeue(current);current=undefined;root.replaceChildren();}
   if(!history.hidden)close();
  }else pump();
 },resolve(key:string){queue.resolve(key);if(current?.key===key)dismiss();else pump();},close,reset(){cancelTimer();current=undefined;suspended=false;queue.clear();root.replaceChildren();close();refreshBell();},get visible(){return !history.hidden;}};
}
