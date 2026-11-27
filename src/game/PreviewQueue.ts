/** Coalesce identical preview requests and discard work with no live consumer. */
export class PreviewQueue<T>{
 private pending=new Map<string,{key:string,subscribers:{live:()=>boolean,resolve:(value:T|null)=>void}[]}>();
 request(key:string,live:()=>boolean):Promise<T|null>{
  if(!live())return Promise.resolve(null);
  return new Promise(resolve=>{
   let job=this.pending.get(key);
   if(!job){job={key,subscribers:[]};this.pending.set(key,job);}
   job.subscribers.push({live,resolve});
  });
 }
 get size(){return this.pending.size;}
 prune(){
  for(const [key,job] of this.pending){
   job.subscribers=job.subscribers.filter(s=>{if(s.live())return true;s.resolve(null);return false;});
   if(!job.subscribers.length)this.pending.delete(key);
  }
  return this.pending.size;
 }
 take(){
  for(const [key,job] of this.pending){
   this.pending.delete(key);
   const active=job.subscribers.filter(s=>{if(s.live())return true;s.resolve(null);return false;});
   if(active.length)return {key,finish:(value:T|null)=>{for(const s of active)s.resolve(s.live()?value:null);}};
  }
  return null;
 }
 cancelAll(){for(const job of this.pending.values())for(const s of job.subscribers)s.resolve(null);this.pending.clear();}
}
