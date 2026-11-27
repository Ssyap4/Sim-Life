import assert from 'node:assert/strict';
import test from 'node:test';
import WebSocket from 'ws';
import {initialState,type ServerPacket,type CharacterId} from '../../src/shared/protocol';
import {homeSeat} from '../../src/shared/home';
import {gameMinutes} from '../../src/shared/life';
import {TAKEOUT,type TakeoutId} from '../../src/shared/food';
import {addReadyFood,consumeReadyFood} from '../../src/shared/readyFood';
import {applyServiceCommand} from '../services';
import {createHomeSessions} from '../homeSessions';
import {planTask} from '../tasks';
import {applyTvFood} from '../food';

function rig(portions=2,connected=true){
  let state=initialState(),now=0,id=0;
  if(connected)for(const service of ['netflix','youtube'] as const){
    const r=applyServiceCommand(state,'vlad',{type:'service_connect',service});
    assert.ok(r.ok);state=r.state;
  }
  state.takeout.pizzaCheese=portions;
  if(portions)addReadyFood(state,'takeout','pizzaCheese',portions,'fridge');
  for(const role of ['vlad','alina'] as const)
    Object.assign(state.characters[role],homeSeat('sofa',role).approach,{hunger:10,fun:5,comfort:10,mood:10});
  const sockets={vlad:{readyState:WebSocket.OPEN} as WebSocket,alina:{readyState:WebSocket.OPEN} as WebSocket};
  const packets:ServerPacket[]=[];
  const timers=new Map<ReturnType<typeof setTimeout>,{at:number;cb:()=>void}>();
  const s=createHomeSessions({state:()=>state,save:next=>{state=next;},all:p=>packets.push(p),send:(_,p)=>packets.push(p),socket:r=>sockets[r],busy:()=>false,prepare:()=>{},nextId:()=>++id,timeScale:1,gameTime:()=>gameMinutes(state.clock),now:()=>now,resourceBusy:()=>false,
    schedule:(cb,ms)=>{const h=++id as unknown as ReturnType<typeof setTimeout>;timers.set(h,{at:now+ms,cb});return h;},clearTimer:h=>{timers.delete(h);}});
  const advance=(ms:number)=>{const end=now+ms;while(true){const next=[...timers.entries()].filter(([,v])=>v.at<=end).sort((a,b)=>a[1].at-b[1].at)[0];if(!next)break;timers.delete(next[0]);now=next[1].at;next[1].cb();}now=end;};
  const arrive=()=>{const next=[...timers.values()].sort((a,b)=>a.at-b.at)[0];assert.ok(next);advance(next.at-now);assert.ok(packets.some(p=>p.type==='task_active'));};
  const invite=(genre:'comedy'|'youtube')=>{s.invitation('vlad',sockets.vlad,{type:'movie_invite',genre,food:'pizzaCheese'});const p=[...packets].reverse().find(p=>p.type==='movie_offer');assert.ok(p?.type==='movie_offer');s.invitation('alina',sockets.alina,{type:'movie_reply',inviteId:p.inviteId,accept:true});};
  return {s,sockets,packets,advance,arrive,invite,state:()=>state};
}
test('Every delivery dish is accepted for film and YouTube, with no change to ordinary viewing',()=>{
  for(const food of Object.keys(TAKEOUT) as TakeoutId[]){
    assert.equal(planTask({type:'movie',genre:'comedy',food})?.durationMs,120000);
    assert.equal(planTask({type:'youtube',food})?.durationMs,90000);
  }
  assert.equal(planTask({type:'youtube'})?.durationMs,40000);
  assert.equal(planTask({type:'movie',genre:'comedy',food:'__proto__'}),null);
  assert.equal(planTask({type:'youtube',food:123}),null);
});
test('Solo film eats one fresh delivery portion at 90s, then finishes film without duplicate reward',()=>{
  const r=rig(2);
  try{
    assert.ok(r.s.start(['vlad'],planTask({type:'movie',genre:'comedy',food:'pizzaCheese'})!,r.sockets.vlad));
    const started=r.packets.find(p=>p.type==='task_started');
    assert.ok(started?.type==='task_started');assert.equal(started.home?.food,'pizzaCheese');assert.equal(started.home?.foodMs,90000);
    r.arrive();r.advance(89999);
    assert.equal(r.state().takeout.pizzaCheese,2);assert.equal(r.state().characters.vlad.hunger,10);
    r.advance(1);
    assert.equal(r.packets.filter(p=>p.type==='tv_food_done').length,1);
    assert.equal(r.state().takeout.pizzaCheese,1);assert.equal(r.state().characters.vlad.hunger,75);assert.ok(r.s.busy('vlad'));
    r.advance(30000);assert.ok(!r.s.busy('vlad'));assert.equal(r.state().characters.vlad.fun,85);assert.equal(r.state().takeout.pizzaCheese,1);
    r.advance(120000);assert.equal(r.state().takeout.pizzaCheese,1);
  }finally{r.s.dispose();}
});
test('Paired YouTube requires consent and two fresh portions and settles each resident only once',()=>{
  const r=rig(2);
  try{
    r.invite('youtube');r.arrive();
    assert.equal(r.packets.filter(p=>p.type==='task_started').length,2);
    r.advance(90000);
    assert.equal(r.state().takeout.pizzaCheese,0);
    assert.equal(r.packets.filter(p=>p.type==='tv_food_done').length,2);
    for(const role of ['vlad','alina'] as CharacterId[]){
      assert.equal(r.state().characters[role].hunger,75);
      assert.equal(r.state().characters[role].fun,40);
      assert.ok(!r.s.busy(role));
    }
  }finally{r.s.dispose();}
});
test('Insufficient stock or service cannot start; cancellation before bite completion spends nothing',()=>{
  const one=rig(1),off=rig(1,false);
  try{
    one.s.invitation('vlad',one.sockets.vlad,{type:'movie_invite',genre:'comedy',food:'pizzaCheese'});
    assert.ok(!one.packets.some(p=>p.type==='movie_offer'));
    assert.ok(!off.s.start(['vlad'],planTask({type:'movie',genre:'comedy',food:'pizzaCheese'})!,off.sockets.vlad));
    assert.ok(one.s.start(['vlad'],planTask({type:'movie',genre:'comedy',food:'pizzaCheese'})!,one.sockets.vlad));
    one.arrive();one.advance(30000);one.s.cancel('vlad','cancel');one.advance(180000);
    assert.equal(one.state().takeout.pizzaCheese,1);assert.equal(one.state().characters.vlad.hunger,10);
  }finally{one.s.dispose();off.s.dispose();}
});
test('No phantom hunger if the other player eats the last portion; playback can finish normally',()=>{
  const r=rig(1);
  try{
    assert.ok(r.s.start(['vlad'],planTask({type:'movie',genre:'comedy',food:'pizzaCheese'})!,r.sockets.vlad));r.arrive();
    assert.ok(consumeReadyFood(r.state(),'takeout','pizzaCheese'));r.advance(90000);
    assert.equal(r.state().characters.vlad.hunger,10);assert.ok(r.s.busy('vlad'));
    r.advance(30000);assert.equal(r.state().characters.vlad.fun,85);
  }finally{r.s.dispose();}
});
test('Sofa meal preserves position and never deducts money twice',()=>{
  const r=rig(1);
  try{
    const before=r.state(),p=before.characters.vlad;
    const result=applyTvFood(before,'vlad','pizzaCheese');assert.ok(result.ok);
    assert.deepEqual([result.state.characters.vlad.x,result.state.characters.vlad.z,result.state.characters.vlad.pose],[p.x,p.z,p.pose]);
    assert.equal(result.state.money,before.money);assert.equal(result.state.takeout.pizzaCheese,0);
    assert.equal(applyTvFood(result.state,'vlad','pizzaCheese').ok,false);
  }finally{r.s.dispose();}
});
test('One viewer can leave before eating; the partner keeps watching and consumes only their own portion',()=>{
  const r=rig(2);
  try{
    r.invite('comedy');r.arrive();r.advance(30000);
    assert.ok(r.s.cancel('vlad','cancel'));
    assert.ok(!r.s.busy('vlad'));assert.ok(r.s.busy('alina'));
    r.advance(60000);
    assert.equal(r.state().takeout.pizzaCheese,1);
    assert.equal(r.state().characters.vlad.hunger,10);
    assert.equal(r.state().characters.alina.hunger,75);
    assert.equal(r.packets.filter(p=>p.type==='tv_food_done').length,1);
    r.advance(30000);assert.equal(r.state().characters.vlad.fun,5);
    assert.equal(r.state().characters.alina.fun,85);
    assert.equal(r.state().relationship.memories.length,0);
  }finally{r.s.dispose();}
});

test('Completing a shared film with food records one joint memory; replay never pays the meal again',()=>{
  const r=rig(2);
  try{
    r.invite('comedy');r.arrive();r.advance(90000);
    const mark=r.packets.length;
    r.s.replay(r.sockets.vlad);
    const replay=r.packets.slice(mark).filter(p=>p.type==='task_started');
    assert.equal(replay.length,2);
    for(const p of replay){assert.equal(p.home?.food,undefined);assert.equal(p.home?.foodMs,undefined);}
    r.advance(30000);assert.equal(r.state().takeout.pizzaCheese,0);
    assert.equal(r.state().relationship.memories.filter(m=>m.action==='film').length,1);
  }finally{r.s.dispose();}
});
test('A food invitation is not accepted when the second portion disappears while awaiting consent',()=>{
 const r=rig(2);
 try{
  r.s.invitation('vlad',r.sockets.vlad,{type:'movie_invite',genre:'comedy',food:'pizzaCheese'});
  const offer=r.packets.find(p=>p.type==='movie_offer');assert.ok(offer?.type==='movie_offer');
  assert.ok(consumeReadyFood(r.state(),'takeout','pizzaCheese'));
  r.s.invitation('alina',r.sockets.alina,{type:'movie_reply',inviteId:offer.inviteId,accept:true});
  const closed=r.packets.find(p=>p.type==='movie_offer_closed');
  assert.ok(closed?.type==='movie_offer_closed');assert.match(closed.message,/порций/);
  assert.ok(!r.s.busy('vlad')&&!r.s.busy('alina'));
  assert.equal(r.state().takeout.pizzaCheese,1);
  assert.ok(!r.packets.some(p=>p.type==='task_started'));
  r.s.invitation('alina',r.sockets.alina,{type:'movie_reply',inviteId:offer.inviteId,accept:true});
  assert.ok(!r.packets.some(p=>p.type==='task_started'));
 }finally{r.s.dispose();}
});
test('Internet loss cancels both viewers immediately, releases television and prevents all delayed rewards',()=>{
 const r=rig(2);
 try{
  r.invite('comedy');r.arrive();assert.equal(r.s.diners().size,2);r.advance(30000);
  r.state().billing.services.internet.paidUntil=gameMinutes(r.state().clock);
  r.s.recheckAccess();
  assert.ok(!r.s.busy('vlad')&&!r.s.busy('alina'));assert.ok(!r.s.reserved('tv'));
  assert.equal(r.packets.filter(p=>p.type==='task_ended'&&p.outcome==='cancelled').length,2);
  assert.equal(r.s.diners().size,0);
  r.advance(180000);assert.equal(r.state().takeout.pizzaCheese,2);
  for(const role of ['vlad','alina'] as const){assert.equal(r.state().characters[role].hunger,10);assert.equal(r.state().characters[role].fun,5);}
 }finally{r.s.dispose();}
});
test('A viewer leaving home while an invitation is pending cannot start a phantom session',()=>{
 const r=rig(2);
 try{
  r.s.invitation('vlad',r.sockets.vlad,{type:'movie_invite',genre:'comedy',food:'pizzaCheese'});
  const offer=r.packets.find(p=>p.type==='movie_offer');assert.ok(offer?.type==='movie_offer');
  r.state().world.places.vlad='market';
  r.s.invitation('alina',r.sockets.alina,{type:'movie_reply',inviteId:offer.inviteId,accept:true});
  assert.ok(!r.s.busy('vlad')&&!r.s.busy('alina'));
  assert.ok(!r.packets.some(p=>p.type==='task_started'));
  assert.equal(r.state().takeout.pizzaCheese,2);
  const closed=r.packets.find(p=>p.type==='movie_offer_closed');assert.ok(closed?.type==='movie_offer_closed');assert.notEqual(closed.message,'Приглашение принято');
 }finally{r.s.dispose();}
});
test('Sofa dining is visible to the pets only while actual food presentation is active',()=>{
 const r=rig(2);
 try{
  r.invite('comedy');assert.equal(r.s.diners().size,0);
  r.arrive();assert.equal(r.s.diners().size,2);
  r.advance(90000);assert.equal(r.s.diners().size,0);assert.ok(r.s.busy('vlad')&&r.s.busy('alina'));
 }finally{r.s.dispose();}
});
test('062 paired film with food completes agreed cinema and the existing shared evening only when both finish',()=>{
 const r=rig(2),s=r.state();
 s.weekends={version:1,plan:{version:1,author:'vlad',preset:'custom',items:['film','evening'],done:[],approved:['vlad','alina'],finishVotes:[],createdAt:0}};
 s.relationship.evening={kind:'leftovers',recipe:'omelette',phase:'unwind',startedAt:0,occasion:'ordinary'};
 try{
  r.invite('comedy');r.arrive();r.advance(90000);
  assert.deepEqual(r.state().weekends!.plan!.done,[]);
  assert.equal(r.state().relationship.evening!.phase,'unwind');
  assert.ok(r.state().dailyHistory?.vlad?.keys.includes('breakfast'));
  assert.ok(r.state().dailyHistory?.alina?.keys.includes('breakfast'));
  r.advance(30000);
  assert.deepEqual(r.state().weekends!.plan!.done,['film']);
  assert.equal(r.state().relationship.evening!.phase,'complete');
  assert.equal(r.state().relationship.memories.filter(m=>m.action==='homeEvening').length,1);
 }finally{r.s.dispose();}
});
test('062 cancelled paired film never completes the shared plan or evening for solo remaining viewer',()=>{
 const r=rig(2),s=r.state();
 s.weekends={version:1,plan:{version:1,author:'vlad',preset:'custom',items:['film'],done:[],approved:['vlad','alina'],finishVotes:[],createdAt:0}};
 s.relationship.evening={kind:'leftovers',recipe:'omelette',phase:'unwind',startedAt:0,occasion:'ordinary'};
 try{r.invite('comedy');r.arrive();r.advance(30000);r.s.cancel('vlad','cancel');r.advance(90000);
  assert.deepEqual(r.state().weekends!.plan!.done,[]);
  assert.equal(r.state().relationship.evening!.phase,'unwind');
 }finally{r.s.dispose();}
});

test('prepared drinks and homemade desserts work in solo and invited TV sessions without extra portions',()=>{
 const r=rig(0);try{
 const s=r.state();s.meals.blackTeaCup=2;addReadyFood(s,'meal','blackTeaCup',2,'table');s.meals.brownie=1;addReadyFood(s,'meal','brownie',1,'table');
 assert.equal(planTask({type:'movie',genre:'comedy',food:'omelette'}),null);
 assert.ok(r.s.start(['vlad'],planTask({type:'movie',genre:'comedy',food:'brownie'})!,r.sockets.vlad));const started=r.packets.find(p=>p.type==='task_started');assert.ok(started?.type==='task_started'&&started.home?.pickup!==undefined);assert.equal(started.home.pickupMs,650);r.arrive();r.advance(90000);assert.equal(r.state().meals.brownie,0);assert.equal(r.state().dirtyDishes.table,1);assert.ok(r.s.busy('vlad'));r.advance(30000);
 r.s.invitation('vlad',r.sockets.vlad,{type:'movie_invite',genre:'youtube',food:'blackTeaCup'});const p=[...r.packets].reverse().find(p=>p.type==='movie_offer');assert.ok(p?.type==='movie_offer');r.s.invitation('alina',r.sockets.alina,{type:'movie_reply',inviteId:p.inviteId,accept:true});r.arrive();r.advance(89999);assert.equal(r.state().meals.blackTeaCup,2);r.advance(1);assert.equal(r.state().meals.blackTeaCup,0);assert.equal(r.state().dirtyDishes.table,3);r.advance(120000);assert.equal(r.state().meals.blackTeaCup,0);
 }finally{r.s.dispose();}
});

test('068 named series invitation and food preserve identical selection and advance both histories exactly once',()=>{
 const r=rig();const selection={id:'dark',season:1,episode:10};
 r.s.invitation('vlad',r.sockets.vlad,{type:'movie_invite',genre:'thriller',selection,food:'pizzaCheese'});
 const offer=[...r.packets].reverse().find(p=>p.type==='movie_offer');assert.ok(offer?.type==='movie_offer');assert.deepEqual(offer.selection,selection);
 r.s.invitation('alina',r.sockets.alina,{type:'movie_reply',inviteId:offer.inviteId,accept:true});
 r.arrive();assert.equal(r.state().mediaLibrary?.history.vlad.length??0,0);
 r.advance(90000);assert.equal(r.state().takeout.pizzaCheese,0);assert.equal(r.state().mediaLibrary?.history.vlad.length??0,0);
 r.advance(30000);for(const role of ['vlad','alina'] as const){const h=r.state().mediaLibrary!.history[role];assert.equal(h.length,1);assert.equal(h[0].id,'dark');assert.equal(h[0].episode,10);assert.equal(h[0].together,true);}
 assert.equal(r.state().relationship.memories.filter(m=>m.action==='film').length,1);
});
test('068 cancelling a named movie before finish never adds a completed viewing',()=>{
 const r=rig();const plan=planTask({type:'movie',genre:'action',selection:{id:'odyssey'}})!;
 assert.ok(r.s.start(['vlad'],plan,r.sockets.vlad));r.arrive();r.advance(30000);r.s.cancel('vlad','cancel');
 r.advance(150000);assert.equal(r.state().mediaLibrary?.history.vlad.length??0,0);
});

test('068 interrupted named film resumes from actual seated time, reward only once',()=>{
 const r=rig();const selection={id:'odyssey'},plan=planTask({type:'movie',genre:'action',selection})!;
 try{
  assert.ok(r.s.start(['vlad'],plan,r.sockets.vlad));r.arrive();r.advance(41000);r.s.cancel('vlad','break');
  assert.equal(r.state().mediaLibrary?.unfinished?.vlad[0].seconds,41);assert.equal(r.state().mediaLibrary?.history.vlad.length,0);assert.equal(r.state().characters.vlad.fun,5);
  assert.ok(r.s.start(['vlad'],plan,r.sockets.vlad));const p=[...r.packets].reverse().find(p=>p.type==='task_started');assert.ok(p?.type==='task_started');assert.equal(p.durationMs,79000);assert.equal(p.home?.mediaOffset,41);assert.deepEqual(p.home?.mediaSelection,selection);
  r.arrive();r.advance(78999);assert.equal(r.state().mediaLibrary?.history.vlad.length,0);
  r.advance(1);assert.equal(r.state().mediaLibrary?.history.vlad.length,1);assert.equal(r.state().mediaLibrary?.unfinished?.vlad.length,0);assert.equal(r.state().characters.vlad.fun,85);
  r.advance(120000);assert.equal(r.state().mediaLibrary?.history.vlad.length,1);
 }finally{r.s.dispose();}
});
test('068 paired resumes from lesser shared bookmark; food remains a new full session',()=>{
 const r=rig();const selection={id:'dark',season:1,episode:1},plan=planTask({type:'movie',genre:'thriller',selection})!;
 try{
  assert.ok(r.s.start(['vlad'],plan,r.sockets.vlad));r.arrive();r.advance(52000);r.s.cancel('vlad','break');
  assert.ok(r.s.start(['alina'],plan,r.sockets.alina));r.arrive();r.advance(32000);r.s.cancel('alina','break');
  r.s.invitation('vlad',r.sockets.vlad,{type:'movie_invite',genre:'thriller',selection});const offer=[...r.packets].reverse().find(p=>p.type==='movie_offer');assert.ok(offer?.type==='movie_offer');
  r.s.invitation('alina',r.sockets.alina,{type:'movie_reply',inviteId:offer.inviteId,accept:true});
  const p=[...r.packets].reverse().find(p=>p.type==='task_started');assert.ok(p?.type==='task_started');assert.equal(p.durationMs,88000);assert.equal(p.home?.mediaOffset,32);
  r.arrive();r.advance(10000);r.s.cancel('vlad','break');
  assert.equal(r.state().mediaLibrary?.unfinished?.vlad[0].seconds,52);assert.equal(r.state().mediaLibrary?.unfinished?.alina[0].seconds,42);
  const withFood=planTask({type:'movie',genre:'thriller',selection,food:'pizzaCheese'})!;
  assert.ok(r.s.start(['vlad'],withFood,r.sockets.vlad));const f=[...r.packets].reverse().find(p=>p.type==='task_started');assert.ok(f?.type==='task_started');assert.equal(f.durationMs,120000);assert.equal(f.home?.foodMs,90000);
  r.arrive();r.advance(90000);assert.equal(r.state().takeout.pizzaCheese,1);r.s.cancel('vlad','break');assert.equal(r.state().mediaLibrary?.unfinished?.vlad[0].seconds,90);
  assert.ok(r.s.start(['vlad'],plan,r.sockets.vlad));r.arrive();r.advance(30000);assert.equal(r.state().takeout.pizzaCheese,1);assert.equal(r.state().mediaLibrary?.history.vlad.length,1);
 }finally{r.s.dispose();}
});
