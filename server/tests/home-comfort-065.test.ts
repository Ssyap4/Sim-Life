import test from 'node:test';
import assert from 'node:assert/strict';
import {initialState} from '../../src/shared/protocol';
import {RECIPES,TAKEOUT,HOME_DRINK_COLORS,HOME_DESSERTS,isShopSnack,ingredientList,type RecipeId} from '../../src/shared/food';
import {maximumXP} from '../../src/shared/education';
import {applyFoodAction,applyTvFood} from '../food';
import {checkout} from '../market';
import {MARKET_BY_ID} from '../../src/shared/market';
import {addReadyFood,tableShelfMinutes} from '../../src/shared/readyFood';
import {autonomyCandidates} from '../../src/shared/autonomy';
import {CARE,careStation,careEffects,careScore,finishCare,validVanity} from '../../src/shared/vanity';
import {planTask,evaluateTask} from '../tasks';
import {careFrame} from '../../src/game/CareMotion';
test('every new recipe consumes actual ingredients, creates servings and uses normal stock',()=>{
 for(const id of [...Object.keys(HOME_DRINK_COLORS),...HOME_DESSERTS] as RecipeId[]){
  const s=initialState();s.education.characters.alina.xp.cooking=maximumXP;
  for(const [item,count] of ingredientList(id))s.pantry[item]=count;
  const r=applyFoodAction(s,'alina',{type:'cook',recipe:id},()=>0);
  assert.ok(r.ok,id);assert.equal(r.state.meals[id],RECIPES[id].servings);
  for(const [item] of ingredientList(id))assert.equal(r.state.pantry[item],0,id);
  const ate=applyFoodAction(r.state,'alina',{type:'eat',recipe:id});assert.ok(ate.ok,id);assert.equal(ate.state.meals[id],RECIPES[id].servings-1);
  assert.equal(applyFoodAction(r.state,'alina',{type:'cook',recipe:id}).ok,false);
  if(Object.hasOwn(HOME_DRINK_COLORS,id)){assert.equal(r.state.readyFood[0].quality,'perfect');assert.equal(tableShelfMinutes(id),120);}
 }
});
test('snacks use a real paid basket and exact portions on the sofa',()=>{
 for(const item of Object.keys(TAKEOUT).filter(isShopSnack) as (keyof typeof TAKEOUT)[]){
  const s=initialState(),p=MARKET_BY_ID.get('takeout:'+item)!;assert.equal(p.category,'sweets');
  const r=checkout(s,'vlad',[{id:p.id,quantity:1}]);assert.ok(r.ok);assert.equal(r.state.money,s.money-p.price);
  assert.equal(r.state.takeout[item],p.quantity);
  const ate=applyTvFood(r.state,'vlad',item);assert.ok(ate.ok);assert.equal(ate.state.takeout[item],p.quantity-1);
  assert.equal(planTask({type:'movie',genre:'comedy',food:item})?.durationMs,120000);
 }
});
test('hunger AI chooses real meal before tea and sweet snacks',()=>{
 const s=initialState();s.autonomy.vlad='needs';s.characters.vlad.hunger=30;
 s.meals.blackTeaCup=1;addReadyFood(s,'meal','blackTeaCup',1,'table');
 s.takeout.pizzaCheese=1;addReadyFood(s,'takeout','pizzaCheese',1,'table');
 assert.deepEqual(autonomyCandidates(s,'vlad').find(c=>c.need==='hunger')?.command,{type:'eat_takeout',item:'pizzaCheese'});
});
test('all hair care uses correct room, independent effect, bounded mood and deliberate style switch',()=>{
 const s=initialState();
 for(const id of ['bathHairWash','bathHairMask','bathHairRitual','hairDry','hairStraight','hairCurl'] as const){
  const cmd={type:'vanity_care' as const,care:id},plan=planTask(cmd)!;assert.equal(plan.resource,careStation(id));assert.equal(plan.durationMs,CARE[id].seconds*1000);
  assert.equal(evaluateTask(s,'vlad',cmd).ok,false);const r=evaluateTask(s,'alina',cmd);assert.ok(r.ok);assert.ok(validVanity(r.state.vanity));
 }
 finishCare(s,'bathHairRitual');finishCare(s,'hairCurl');const before=careScore(s),mood=s.characters.alina.mood;finishCare(s,'hairStraight');assert.equal(s.vanity?.hair?.appearance,'hairStraight');assert.equal(careScore(s),before);assert.equal(s.characters.alina.mood,mood);
 assert.equal(careEffects(s).length,2);assert.equal(careFrame('bathHairRitual',12).phase,'shampoo');assert.equal(careFrame('bathHairRitual',30).phase,'hairMask');assert.equal(careFrame('bathHairRitual',80).phase,'relax');assert.equal(careFrame('bathHairRitual',172).phase,'rinse');
});

import WebSocket from 'ws';
import {createHomeSessions,usesHomeSession} from '../homeSessions';
import {gameMinutes} from '../../src/shared/life';
import {homeSeat} from '../../src/shared/home';
import type {ServerPacket} from '../../src/shared/protocol';
test('portable drinks have a real pickup and seat route; cancel, stale stock and double use are safe',()=>{
 let state=initialState(),now=0,seq=0;state.meals.berrySmoothie=1;addReadyFood(state,'meal','berrySmoothie',1,'table');
 const sockets={vlad:{readyState:WebSocket.OPEN} as WebSocket,alina:{readyState:WebSocket.OPEN} as WebSocket};
 const packets:ServerPacket[]=[],timers=new Map<ReturnType<typeof setTimeout>,{at:number;cb:()=>void}>();
 const sessions=createHomeSessions({state:()=>state,save:s=>{state=s;},all:p=>packets.push(p),send:(_,p)=>packets.push(p),socket:r=>sockets[r],busy:()=>false,prepare:()=>{},nextId:()=>++seq,timeScale:1,gameTime:()=>gameMinutes(state.clock),now:()=>now,resourceBusy:()=>false,schedule:(cb,ms)=>{const h=++seq as unknown as ReturnType<typeof setTimeout>;timers.set(h,{at:now+ms,cb});return h;},clearTimer:h=>{timers.delete(h);}});
 const advance=(ms:number)=>{const end=now+ms;while(true){const next=[...timers.entries()].filter(([,v])=>v.at<=end).sort((a,b)=>a[1].at-b[1].at)[0];if(!next)break;timers.delete(next[0]);now=next[1].at;next[1].cb();}now=end;};
 try{
  for(const seat of ['sofa','yardTable','officeChair'] as const){
   const cmd={type:'eat' as const,recipe:'berrySmoothie' as const,drinkSeat:seat},plan=planTask(cmd)!;assert.ok(usesHomeSession(plan.command));assert.equal(plan.command.type,'eat');
   assert.ok(sessions.start(['alina'],plan,sockets.alina),seat);
   const p=[...packets].reverse().find(p=>p.type==='task_started'&&p.role==='alina');assert.ok(p?.type==='task_started');assert.equal(p.home?.station,seat);assert.ok(p.home?.pickup!==undefined);assert.equal(p.home?.pickupMs,650);
   const dest=p.home.route.path.at(-1)??p.home.route.from;const target=homeSeat(seat,'alina').approach;assert.ok(Math.hypot(dest.x-target.x,dest.z-target.z)<.06);
   assert.equal(state.meals.berrySmoothie,1);sessions.cancel('alina','cancel');assert.equal(state.meals.berrySmoothie,1);
  }
  assert.equal(planTask({type:'eat',recipe:'omelette',drinkSeat:'sofa'}),null);assert.equal(planTask({type:'eat',recipe:'berrySmoothie',drinkSeat:'bed'}),null);
  const plan=planTask({type:'eat',recipe:'berrySmoothie',drinkSeat:'yardTable'})!;
  assert.ok(sessions.start(['alina'],plan,sockets.alina));assert.ok(sessions.start(['vlad'],plan,sockets.vlad));
  advance(120000);assert.equal(state.meals.berrySmoothie,0);assert.equal(state.dirtyDishes.yardTable,1);assert.equal(packets.filter(p=>p.type==='task_ended'&&p.outcome==='failed').length,1);
 }finally{sessions.dispose();}
});
