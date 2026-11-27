import test from 'node:test';
import assert from 'node:assert/strict';
import {initialState,points,type GameState,type ServerPacket} from '../../src/shared/protocol';
import {beginShift} from '../jobs';
import {planTask,evaluateTask} from '../tasks';
import {activeHomeWork,workCoffeeChoices,workCoffeeRoute,WORK_COFFEE_APPROACH,workCompanionChoices} from '../../src/shared/workCoffee';
import {coffeeCupsToday} from '../../src/shared/coffee';
import {createHomeSessions} from '../homeSessions';
import {gameMinutes} from '../../src/shared/life';
import {openServerFiles} from '../storage';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import WebSocket from 'ws';
function seed(){
 const s=initialState();s.clock.minute=780;s.autonomy.alina='full';
 for(const role of ['vlad','alina'] as const)Object.assign(s.characters[role],{hunger:90,energy:75,hygiene:90,bladder:90,fun:90,comfort:90,social:90,pose:'idle'});
 s.pantry.coffeeNescafeGold=2;const result=beginShift(s,'vlad','vibeSite','desktop');assert.ok(result.ok);
 Object.assign(result.state.characters.vlad,points.desk,{pose:'work'});
 return result.state;
}
test('real paid shift is eligible only after arrival; independent activity never uses worker computer',()=>{
 const s=seed();assert.ok(activeHomeWork(s,'vlad'));
 const choices=workCompanionChoices(s,'alina');assert.ok(choices.length);assert.ok(choices.every(c=>planTask(c)?.resource!=='desk'));
 s.characters.vlad.pose='idle';assert.equal(activeHomeWork(s,'vlad'),undefined);assert.deepEqual(workCompanionChoices(s,'alina'),[]);
 s.characters.vlad.pose='work';s.clock.minute=s.activeShifts.vlad!.endsAt;assert.deepEqual(workCompanionChoices(s,'alina'),[]);
});
test('coffee route visits kitchen then desk; delivery consumes one cup and preserves exact worker task, pose, and pay',()=>{
 const s=seed(),before=structuredClone(s),c=workCoffeeChoices(s,'alina')[0];assert.ok(c);
 const route=workCoffeeRoute(s,'alina');assert.ok(route);assert.ok(route.pickup>0);assert.ok(route.pickup<route.route.path.length);
 const end=route.route.path.at(-1)!;assert.ok(Math.hypot(end.x-WORK_COFFEE_APPROACH.x,end.z-WORK_COFFEE_APPROACH.z)<.05,JSON.stringify(end));
 const r=evaluateTask(s,'alina',c);assert.ok(r.ok);
 assert.deepEqual(s,before);assert.equal(r.state.money,s.money);assert.equal(r.state.pantry.coffeeNescafeGold,1);
 assert.equal(coffeeCupsToday(r.state,'vlad'),1);assert.equal(coffeeCupsToday(r.state,'alina'),0);
 assert.equal(r.state.characters.vlad.energy,85);assert.equal(r.state.characters.vlad.pose,'work');
 for(const k of ['x','z'] as const)assert.equal(r.state.characters.vlad[k],s.characters.vlad[k]);
 assert.deepEqual(r.state.activeShifts.vlad,{...s.activeShifts.vlad,coffeeServed:true});
 assert.equal(evaluateTask(r.state,'alina',c).ok,false);
 const dir=mkdtempSync(join(tmpdir(),'work-coffee-053-'));try{const file=openServerFiles(dir);file.save(r.state);assert.equal(file.load().activeShifts.vlad?.coffeeServed,true);}finally{rmSync(dir,{recursive:true,force:true});}
});
test('stale shifts, depleted supplies, cup limit, non-home jobs and sold desk deny delivery',()=>{
 const s=seed(),c=workCoffeeChoices(s,'alina')[0];assert.ok(c);
 const rejects=(edit:(state:GameState)=>void)=>{const copy=structuredClone(s);edit(copy);assert.equal(evaluateTask(copy,'alina',c).ok,false);};
 rejects(x=>{delete x.activeShifts.vlad;});rejects(x=>{x.activeShifts.vlad!.startedAt++;});rejects(x=>{x.pantry.coffeeNescafeGold=0;});
 rejects(x=>{x.coffeeDaily.vlad={day:x.clock.day,cups:3};});rejects(x=>{x.furnishing.soldFixtures=['desk'];});rejects(x=>{x.characters.vlad.pose='idle';});
 s.autonomy.alina='needs';assert.deepEqual(workCoffeeChoices(s,'alina'),[]);
});
function rig(){
 let s=seed(),now=1000,id=0;const packets:ServerPacket[]=[];
 const timers=new Map<ReturnType<typeof setTimeout>,{at:number;cb:()=>void}>();
 const sockets={vlad:{readyState:WebSocket.OPEN} as WebSocket,alina:{readyState:WebSocket.OPEN} as WebSocket};
 const h=createHomeSessions({state:()=>s,save:x=>{s=x;},all:p=>packets.push(p),send:(_,p)=>packets.push(p),socket:r=>sockets[r],busy:r=>!!s.activeShifts[r],prepare:()=>{},nextId:()=>++id,timeScale:1,gameTime:()=>gameMinutes(s.clock),now:()=>now,resourceBusy:()=>false,schedule:(cb,ms)=>{const key=++id as unknown as ReturnType<typeof setTimeout>;timers.set(key,{at:now+ms,cb});return key;},clearTimer:key=>{timers.delete(key);}});
 const advance=(ms:number)=>{const end=now+ms;while(true){const n=[...timers.entries()].filter(([,v])=>v.at<=end).sort((a,b)=>a[1].at-b[1].at)[0];if(!n)break;timers.delete(n[0]);now=n[1].at;n[1].cb();}now=end;};
 const start=()=>{const c=workCoffeeChoices(s,'alina')[0];assert.ok(c);assert.ok(h.start(['alina'],planTask(c)!,sockets.alina,true));};
 return {h,packets,advance,start,sockets,state:()=>s};
}
test('real timed coffee session routes only giver and does not change recipient task; cancellation pays nothing',()=>{
 const r=rig();try{const before=structuredClone(r.state());r.start();
 const event=r.packets.find(p=>p.type==='task_started');assert.ok(event&&event.type==='task_started');assert.equal(event.role,'alina');assert.equal(event.home?.station,'workCoffee');assert.ok(event.home?.pickupMs);
 assert.equal(r.h.busy('vlad'),false);r.h.cancel('alina','manual');r.advance(120000);
 assert.equal(r.state().pantry.coffeeNescafeGold,before.pantry.coffeeNescafeGold);assert.deepEqual(r.state().activeShifts.vlad,before.activeShifts.vlad);
 r.start();r.advance(120000);assert.equal(r.state().pantry.coffeeNescafeGold,1);assert.equal(r.state().activeShifts.vlad?.coffeeServed,true);
 assert.ok(r.packets.some(p=>p.type==='task_ended'&&p.role==='alina'&&p.outcome==='completed'));
 assert.deepEqual(r.state().activeShifts.vlad,{...before.activeShifts.vlad,coffeeServed:true});
 }finally{r.h.dispose();}
});

import {addReadyFood} from '../../src/shared/readyFood';
test('partner brings a prepared drink to an active desktop order without interrupting or paying it early',()=>{
 const r=rig();try{const state=r.state();state.meals.berrySmoothie=2;addReadyFood(state,'meal','berrySmoothie',2,'table');const before=structuredClone(state),cmd={type:'serve_work_drink' as const,shiftStart:state.activeShifts.vlad!.startedAt,recipe:'berrySmoothie' as const};const plan=planTask(cmd)!;assert.ok(plan);
 assert.ok(r.h.start(['alina'],plan,r.sockets.alina));const p=r.packets.find(x=>x.type==='task_started');assert.ok(p?.type==='task_started');assert.equal(p.home?.station,'workCoffee');assert.equal(p.home?.pickupMs,650);r.h.cancel('alina','manual');r.advance(120000);assert.equal(r.state().meals.berrySmoothie,2);
 assert.ok(r.h.start(['alina'],plan,r.sockets.alina));r.advance(120000);assert.equal(r.state().meals.berrySmoothie,1);assert.deepEqual(r.state().activeShifts.vlad,{...before.activeShifts.vlad,coffeeServed:true,servedDrink:'berrySmoothie'});assert.equal(r.state().characters.vlad.pose,'work');assert.equal(r.state().characters.vlad.x,before.characters.vlad.x);assert.equal(r.state().money,before.money);assert.equal(evaluateTask(r.state(),'alina',cmd).ok,false);
 const dir=mkdtempSync(join(tmpdir(),'work-drink-065-'));try{const files=openServerFiles(dir);files.save(r.state());assert.equal(files.load().activeShifts.vlad?.servedDrink,'berrySmoothie');}finally{rmSync(dir,{recursive:true,force:true});}
 }finally{r.h.dispose();}
});
