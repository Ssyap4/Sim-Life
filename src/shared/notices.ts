export type NoticeKind='info'|'success'|'warning'|'urgent';
export type NoticeTarget='finance'|'health'|'pets'|'needs'|'events'|'holidays'|'delivery'|'autonomy';
export type NoticeInput={message:string;title?:string;kind?:NoticeKind;target?:NoticeTarget;key?:string};
export type Notice=Required<Pick<NoticeInput,'message'|'title'|'kind'|'key'>>&{id:number;time:number;target?:NoticeTarget};
const priority:Record<NoticeKind,number>={info:0,success:1,warning:2,urgent:3};
export const noticeDuration=(n:Notice)=>Math.max(n.kind==='urgent'?12000:n.kind==='warning'?8500:5500,Math.min(16000,n.message.length*52));
export function classifyNotice(message:string):Pick<Notice,'title'|'kind'|'target'>{
 if(/плохо себя чувствует|недомогание|заболел|критическ/i.test(message))return {title:'Требуется внимание',kind:'urgent',target:/Верделл|Симба/.test(message)?'pets':'health'};
 if(/долг|задолженность|не хватило|не оплачен|отключ[её]н/i.test(message))return {title:'Семейный бюджет',kind:'warning',target:'finance'};
 if(/🎉 Сегодня:/.test(message))return {title:'Праздник',kind:'success',target:'holidays'};
 if(/Телефон → События/.test(message))return {title:'Новое семейное событие',kind:'success',target:'events'};
 if(/испортилась|испортились|просрочен/i.test(message))return {title:'Запасы еды',kind:'warning'};
 if(/желание исполнено|награда|повышение|выздоровел/i.test(message))return {title:'Достижение',kind:'success'};
 return {title:'Событие',kind:'info'};
}
export class NoticeQueue{
 private serial=0;
 private recent=new Map<string,number>();
 readonly history:Notice[]=[];
 readonly pending:Notice[]=[];
 unread=0;
 add(input:NoticeInput,now:number):Notice|undefined{
  const message=input.message.trim();if(!message)return;
  const key=input.key??message;
  const last=this.recent.get(key);if(last!==undefined&&now-last<4000)return;
  for(const [k,t] of this.recent)if(now-t>=4000)this.recent.delete(k);
  this.recent.set(key,now);
  const preset=classifyNotice(message);
  const item:Notice={...preset,...input,message,key,id:++this.serial,time:now};
  this.history.unshift(item);if(this.history.length>80)this.history.pop();
  this.unread=Math.min(80,this.unread+1);
  this.requeue(item);
  return item;
 }
 requeue(item:Notice){this.pending.push(item);this.pending.sort((a,b)=>priority[b.kind]-priority[a.kind]||a.id-b.id);if(this.pending.length>80)this.pending.pop();}
 take(){return this.pending.shift();}
 outranks(a:Notice,b:Notice){return priority[a.kind]>priority[b.kind];}
 read(){this.unread=0;}
 clear(){this.pending.length=0;this.history.length=0;this.recent.clear();this.unread=0;}
}
