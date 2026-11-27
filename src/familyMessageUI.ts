import {MESSAGE_LIMIT,messagesFor,unreadMessages,type MessageCommand} from './shared/familyMessages';
import {names,type CharacterId,type GameState} from './shared/protocol';
import {clockAt,clockLabel} from './shared/life';

export function createFamilyMessageUI(root:HTMLElement,send:(command:MessageCommand)=>boolean){
 const panel=document.createElement('section');panel.className='family-chat';
 const header=document.createElement('header'),heading=document.createElement('strong'),status=document.createElement('small');header.append(heading,status);
 const history=document.createElement('div');history.className='family-chat-history';history.setAttribute('role','log');history.setAttribute('aria-label','Переписка');
 const older=document.createElement('button');older.type='button';older.textContent='Показать более ранние';older.className='chat-older';
 const form=document.createElement('form');form.className='family-chat-compose';
 const input=document.createElement('textarea');input.maxLength=MESSAGE_LIMIT;input.rows=2;input.placeholder='Написать сообщение…';input.setAttribute('aria-label','Сообщение');
 const footer=document.createElement('div'),count=document.createElement('small'),submit=document.createElement('button');submit.type='submit';submit.textContent='Отправить';footer.append(count,submit);form.append(input,footer);panel.append(header,older,history,form);
 const drafts:Record<CharacterId,string>={vlad:'',alina:''};
 let role:CharacterId='vlad',state:GameState|undefined,key='',limit=40,readPending=0,sendPending:{text:string;id:number}|undefined;
 const update=()=>{count.textContent=input.value.length+'/'+MESSAGE_LIMIT;submit.disabled=!input.value.trim()||!!sendPending;drafts[role]=input.value;};
 input.oninput=update;update();
 form.onsubmit=e=>{e.preventDefault();const text=input.value.trim();if(!state||!text||sendPending)return;if(send({type:'family_message_send',text})){sendPending={text,id:messagesFor(state).nextId};update();}};
 older.onclick=()=>{limit+=40;key='';if(state)renderRows(state,false);};
 function renderRows(s:GameState,bottom:boolean){
  const m=messagesFor(s),rows=m.items.slice(-limit),oldHeight=history.scrollHeight,oldTop=history.scrollTop;
  history.replaceChildren();older.hidden=m.items.length<=limit;
  if(!rows.length){const empty=document.createElement('p');empty.className='chat-empty';empty.textContent='Здесь будет ваша личная переписка.';history.append(empty);}
  for(const item of rows){const row=document.createElement('div');row.className='chat-bubble '+(item.from===role?'mine':'theirs');
   const body=document.createElement('div');body.textContent=item.text;
   const meta=document.createElement('small');const partner=role==='vlad'?'alina':'vlad';meta.textContent=clockLabel(clockAt(item.at))+(item.from===role?(m.read[partner]>=item.id?' · Прочитано':' · Отправлено'):'');row.append(body,meta);history.append(row);
  }
  history.scrollTop=bottom?history.scrollHeight:oldTop+Math.max(0,history.scrollHeight-oldHeight);
 }
 return {
  reset(){key='';limit=40;readPending=0;},
  render(s:GameState,r:CharacterId,online:CharacterId[]){
   if(role!==r){role=r;input.value=drafts[r];key='';readPending=0;sendPending=undefined;}
   state=s;const partner=r==='vlad'?'alina':'vlad',m=messagesFor(s);
   heading.textContent=names[partner];status.textContent=online.includes(partner)?'В игре':'Не в игре · сообщение сохранится';
   if(sendPending&&m.items.some(x=>x.from===r&&x.id>=sendPending!.id&&x.text===sendPending!.text)){if(input.value.trim()===sendPending.text){input.value='';drafts[r]='';}sendPending=undefined;}
   const detached=panel.parentElement!==root;if(detached){root.replaceChildren(panel);input.value=drafts[r];}
   const next=JSON.stringify([r,m]);if(next!==key||detached){const nearBottom=history.scrollHeight-history.scrollTop-history.clientHeight<60;key=next;renderRows(s,detached||nearBottom);}
   update();
   const unread=unreadMessages(s,r).at(-1);if(unread&&unread.id>readPending&&send({type:'family_message_read',through:unread.id}))readPending=unread.id;
  },
  reject(){sendPending=undefined;readPending=0;update();},
 };
}
