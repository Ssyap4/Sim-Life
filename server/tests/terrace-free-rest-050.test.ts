import assert from 'node:assert/strict';
import test from 'node:test';
import WebSocket from 'ws';
import {initialState,type ServerPacket} from '../../src/shared/protocol';
import {homeSeat,HOME_FLOOR,HOME_YARD} from '../../src/shared/home';
import {gameMinutes} from '../../src/shared/life';
import {furnitureUseLocation} from '../../src/shared/furnitureUse';
import {createHomeSessions} from '../homeSessions';
import {planTask} from '../tasks';

function rig(fixed=false){
 let state=initialState(),now=1000,id=0;
 const packets:ServerPacket[]=[];
 const timers=new Map<ReturnType<typeof setTimeout>,{at:number;cb:()=>void}>();
 const sockets={vlad:{readyState:WebSocket.OPEN} as WebSocket,alina:{readyState:WebSocket.OPEN} as WebSocket};
 if(!fixed)state.furnishing.placed=[{id:1,sku:'oasis-terrace',finish:'sage',x:9.5,z:10.2,rotation:2}];state.furnishing.nextId=2;
 for(const role of ['vlad','alina'] as const){
  const route=fixed?null:furnitureUseLocation(state,role,1,'terraceRest')!.route;
  Object.assign(state.characters[role],route?(route.path.at(-1)??route.from):homeSeat('yardTable',role).approach,{energy:40,fun:20,mood:20,comfort:20,social:20});
 }
 const s=createHomeSessions({state:()=>state,save:next=>{state=next;},all:p=>packets.push(p),send:(_,p)=>packets.push(p),socket:r=>sockets[r],busy:()=>false,prepare:()=>{},nextId:()=>++id,timeScale:1,gameTime:()=>gameMinutes(state.clock),now:()=>now,resourceBusy:()=>false,conversationPosition:r=>state.characters[r],
 schedule:(cb,ms)=>{const h=++id as unknown as ReturnType<typeof setTimeout>;timers.set(h,{at:now+ms,cb});return h;},clearTimer:h=>{timers.delete(h);}});
 const advance=(ms:number)=>{const end=now+ms;while(true){const next=[...timers.entries()].filter(([,v])=>v.at<=end).sort((a,b)=>a[1].at-b[1].at)[0];if(!next)break;timers.delete(next[0]);now=next[1].at;next[1].cb();}now=end;};
 const invite=(action:string,item?:string)=>{s.social('vlad',sockets.vlad,{type:'social_propose',action,item});const p=[...packets].reverse().find(p=>p.type==='social_pending');assert.ok(p?.type==='social_pending');s.social('alina',sockets.alina,{type:'social_reply',inviteId:p.offer.id,choice:0});};
 const started=(r:'vlad'|'alina')=>{const p=[...packets].reverse().find(p=>p.type==='task_started'&&p.role===r);assert.ok(p?.type==='task_started');return p.taskId;};
 const finish=(r:'vlad'|'alina')=>s.social(r,sockets[r],{type:'social_finish',taskId:started(r)});
 return {s,sockets,packets,advance,invite,finish,started,state:()=>state};
}
test('solo terrace never times out, early voluntary exit earns proportional reward',()=>{
 const r=rig();try{
  const cmd={type:'furniture_use' as const,furnitureId:1,action:'terraceRest' as const};
  assert.ok(r.s.start(['vlad'],planTask(cmd)!,r.sockets.vlad));r.advance(15_000);
  r.finish('vlad');assert.equal(r.s.busy('vlad'),false);
  assert.ok(r.state().characters.vlad.comfort>20&&r.state().characters.vlad.comfort<50);
  assert.equal(r.state().characters.vlad.pose,'idle');
  assert.ok(r.s.start(['vlad'],planTask(cmd)!,r.sockets.vlad));r.advance(600_000);
  assert.ok(r.s.busy('vlad'));
  const before=r.state().characters.vlad.comfort;r.finish('vlad');
  assert.equal(r.state().characters.vlad.comfort,before+30);
  r.finish('vlad');assert.equal(r.state().characters.vlad.comfort,before+30);
 }finally{r.s.dispose();}
});
test('paired terrace stays seated through multiple conversations, permits independent departure',()=>{
 const r=rig();try{
  r.invite('leisureTogether','1');r.advance(2000);assert.ok(r.s.busy('vlad')&&r.s.busy('alina'));
  for(const action of ['nearTalk:day','nearTalk:plans']){
   r.invite(action);assert.ok(r.packets.some(p=>p.type==='conversation'&&p.remainingMs>0));
   r.advance(45_000);assert.ok(r.s.busy('vlad')&&r.s.busy('alina'));
  }
  r.advance(600_000);assert.ok(r.s.busy('vlad')&&r.s.busy('alina'));
  assert.ok(r.state().relationship.recent.some(e=>e.action==='nearTalk:day'));
  assert.ok(r.state().relationship.recent.some(e=>e.action==='nearTalk:plans'));
  const money=r.state().money;r.finish('vlad');assert.ok(!r.s.busy('vlad')&&r.s.busy('alina'));
  r.state().world.places.vlad='park';r.s.recheckAccess();assert.ok(r.s.busy('alina'));
  r.finish('alina');assert.ok(!r.s.busy('alina'));assert.equal(r.state().money,money);
  assert.equal(r.state().characters.alina.pose,'idle');
 }finally{r.s.dispose();}
});
test('moving an occupied terrace releases both participants without granting rewards',()=>{
 const r=rig();try{
  r.invite('leisureTogether','1');r.advance(60_000);assert.ok(r.s.busy('vlad'));
  const before=r.state().characters.vlad.comfort;
  r.s.interruptLayout(undefined,1,undefined);
  assert.ok(!r.s.busy('vlad')&&!r.s.busy('alina'));
  assert.equal(r.state().characters.vlad.comfort,before);
 }finally{r.s.dispose();}
});
test('built-in lounge is free and permits independent solo or shared unlimited rest',()=>{
 const r=rig(true);try{
  assert.equal(r.state().furnishing.placed.length,0);
  assert.equal(HOME_FLOOR.maxZ,16.7);assert.equal(HOME_YARD.gate.z,17.06);
  const money=r.state().money;
  assert.ok(r.s.start(['vlad'],planTask({type:'act',actionId:'yardLounge'})!,r.sockets.vlad));
  r.advance(600000);assert.ok(r.s.busy('vlad'));r.finish('vlad');assert.ok(!r.s.busy('vlad'));assert.equal(r.state().characters.vlad.pose,'idle');
  r.invite('yardRest');r.advance(600000);assert.ok(r.s.busy('vlad')&&r.s.busy('alina'));
  r.invite('nearTalk:day');r.advance(45000);assert.ok(r.state().relationship.recent.some(e=>e.action==='nearTalk:day'));
  r.finish('vlad');assert.ok(!r.s.busy('vlad')&&r.s.busy('alina'));
  r.s.recheckAccess();assert.ok(r.s.busy('alina'));
  r.finish('alina');assert.ok(!r.s.busy('alina'));assert.equal(r.state().money,money);
 }finally{r.s.dispose();}
});

test('optional hookah uses the fixed lounge, has no need reward, and permits conversation and independent exit',()=>{
 const r=rig(true);try{
  const before=structuredClone(r.state().characters),money=r.state().money;
  assert.ok(r.s.start(['vlad'],planTask({type:'act',actionId:'yardHookahSolo'})!,r.sockets.vlad));
  r.advance(600000);assert.ok(r.s.busy('vlad'));r.finish('vlad');
  for(const key of ['fun','energy','comfort','mood'] as const)assert.equal(r.state().characters.vlad[key],before.vlad[key]);
  r.invite('yardHookah');r.advance(3000);assert.ok(r.s.busy('vlad')&&r.s.busy('alina'));
  r.invite('nearTalk:day');r.advance(600000);assert.ok(r.state().relationship.recent.some(e=>e.action==='nearTalk:day'));
  const afterTalk=structuredClone(r.state().characters);r.finish('vlad');assert.ok(!r.s.busy('vlad')&&r.s.busy('alina'));
  r.finish('alina');for(const role of ['vlad','alina'] as const)for(const key of ['fun','energy','comfort','mood'] as const)assert.equal(r.state().characters[role][key],afterTalk[role][key]);
  assert.equal(r.state().money,money);
 }finally{r.s.dispose();}
});
