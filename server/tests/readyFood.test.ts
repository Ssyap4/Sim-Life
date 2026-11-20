import assert from 'node:assert/strict';
import { test } from 'node:test';
import { once } from 'node:events';
import { mkdtempSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import WebSocket, { type RawData } from 'ws';
import { RECIPES, TAKEOUT } from '../../src/shared/food';
import { clockAt, gameMinutes, MINUTES_PER_DAY } from '../../src/shared/life';
import { approachFor, stationById } from '../../src/shared/locations';
import { initialState, type CharacterId, type GameState, type ServerPacket } from '../../src/shared/protocol';
import { READY_FOOD_SLOTS, TABLE_READY_CAPACITY, addReadyFood, expireReadyFood,
  readyFoodRemaining, readyFoodShelfDays, readyFoodTableUsage } from '../../src/shared/readyFood';
import { FRIDGE_CAPACITY, storageUsage } from '../../src/shared/storageSpace';
import { applyFoodAction, applyTakeoutMeal } from '../food';
import { applyWorld } from '../locations';
import { checkout } from '../market';
import { advanceLife } from '../life';
import { openServerFiles } from '../storage';
import { startServer } from '../server';

function successful(result: ReturnType<typeof applyWorld>): GameState {
  assert.ok(result.ok, !result.ok ? result.reason : '');
  return result.state;
}
function at(state: GameState, role: CharacterId, station: string): GameState {
  const next = structuredClone(state);
  Object.assign(next.characters[role], approachFor(stationById('home',station)!,role));
  return next;
}
function moveClock(state: GameState, minutes: number): GameState {
  const next=structuredClone(state);
  next.clock=clockAt(gameMinutes(next.clock)+minutes);
  return next;
}

test('Prepared food uses 2 fridge cells per portion; raw ingredients are preserved indefinitely', () => {
  assert.equal(READY_FOOD_SLOTS,2);
  assert.equal(FRIDGE_CAPACITY,36);
  assert.equal(readyFoodShelfDays('meal','omelette','fridge'),3);
  assert.equal(readyFoodShelfDays('meal','salad','fridge'),2);
  assert.equal(readyFoodShelfDays('takeout','rollsSet','fridge'),2);
  assert.equal(readyFoodShelfDays('takeout','pizzaCheese','fridge'),3);
  assert.equal(readyFoodShelfDays('takeout','pizzaCheese','table'),2);
  const base=initialState();
  base.pantry.milk=2;
  const one=applyFoodAction(base,'vlad',{type:'cook',recipe:'omelette'});
  assert.ok(one.ok);
  assert.equal(one.state.meals.omelette,RECIPES.omelette.servings);
  assert.equal(storageUsage(one.state).fridge,2+READY_FOOD_SLOTS*2,'the remaining eggs and milk also need two cells');
  assert.equal(one.state.readyFood.length,1);
  const expires=one.state.readyFood[0].expiresAt;
  const nextDay=moveClock(one.state,MINUTES_PER_DAY);
  const two=applyFoodAction(nextDay,'alina',{type:'cook',recipe:'omelette'});
  assert.ok(two.ok);
  assert.equal(two.state.readyFood.length,2,'different batches track different expiries');
  assert.equal(two.state.readyFood[0].expiresAt,expires);
  assert.equal(two.state.readyFood[1].expiresAt,expires+MINUTES_PER_DAY);
  const pastFirst=moveClock(two.state,2*MINUTES_PER_DAY);
  const gone=expireReadyFood(pastFirst);
  assert.equal(gone.length,1);
  assert.equal(gone[0].portions,2);
  assert.equal(pastFirst.meals.omelette,2,'only the older batch expired');
  assert.equal(storageUsage(pastFirst).fridge,4);
  assert.equal(expireReadyFood(pastFirst).length,0,'no double spoilage');
  assert.equal(pastFirst.pantry.eggs,0,'ordinary ingredients are not affected');
  assert.ok(readyFoodRemaining(pastFirst.readyFood[0].expiresAt,pastFirst.clock).includes('1 д'));
  const entirelyOld=moveClock(pastFirst,MINUTES_PER_DAY);
  assert.equal(expireReadyFood(entirelyOld)[0].portions,2);
  assert.equal(entirelyOld.meals.omelette,0);
  assert.equal(storageUsage(entirelyOld).fridge,0);
});

test('Delivery is collected at the door with fridge or table choice, transferable without renewed expiry', () => {
  const start=initialState();
  const order=successful(applyWorld(start,'vlad',{
    type:'delivery_order',sequence:0,lines:[
      {id:'takeout:pizzaCheese',quantity:1},{id:'grocery:milk',quantity:1},
    ],
  }));
  assert.equal(order.takeout.pizzaCheese,0,'order is still at doorstep');
  assert.equal(order.world.deliveries.length,1);
  const paid=order.money;
  const arrived=advanceLife(order,18,['vlad']);
  const claim=at(arrived,'alina','parcel');
  const delivered=successful(applyWorld(claim,'alina',{
    type:'delivery_claim',id:claim.world.deliveries[0].id,storage:'table',
  }));
  assert.equal(delivered.money,paid,'collection does not charge twice');
  assert.equal(delivered.takeout.pizzaCheese,2);
  assert.equal(delivered.pantry.milk,1);
  assert.equal(readyFoodTableUsage(delivered),2);
  assert.equal(storageUsage(delivered).fridge,2,'the milk and initial eggs occupy fridge cells');
  const originalExpiry=delivered.readyFood[0].expiresAt;
  assert.equal(originalExpiry,order.world.deliveries[0].readyAt+2*MINUTES_PER_DAY);
  const nearFridge=at(delivered,'vlad','fridge');
  const moved=successful(applyWorld(nearFridge,'vlad',{
    type:'ready_food_move',kind:'takeout',item:'pizzaCheese',
  }));
  assert.equal(moved.takeout.pizzaCheese,2);
  assert.equal(readyFoodTableUsage(moved),1);
  assert.equal(storageUsage(moved).fridge,2+READY_FOOD_SLOTS);
  assert.ok(moved.readyFood.every(batch=>batch.expiresAt===originalExpiry));
  const discard=successful(applyWorld(moved,'vlad',{
    type:'ready_food_discard',kind:'takeout',item:'pizzaCheese',storage:'fridge',
  }));
  assert.equal(discard.takeout.pizzaCheese,1);
  assert.equal(storageUsage(discard).fridge,2);
  const lastMeal=applyTakeoutMeal(discard,'alina','pizzaCheese');
  assert.ok(lastMeal.ok);
  assert.equal(lastMeal.state.takeout.pizzaCheese,0);
  assert.equal(readyFoodTableUsage(lastMeal.state),0);
  assert.equal(applyWorld(delivered,'alina',{
    type:'delivery_claim',id:order.world.deliveries[0].id,storage:'table',
  }).ok,false,'same parcel cannot be collected again');
});

test('Cold takeaway lives 3 days; rolls live 2; old portion expires even after new purchase', () => {
  const original=initialState();
  const first=checkout(original,'alina',[{id:'takeout:pizzaCheese',quantity:1}]);
  assert.ok(first.ok);
  assert.equal(storageUsage(first.state).fridge,1+2*READY_FOOD_SLOTS);
  const nearDay=moveClock(first.state,MINUTES_PER_DAY);
  const newest=checkout(nearDay,'vlad',[{id:'takeout:pizzaCheese',quantity:1}]);
  assert.ok(newest.ok);
  const expiredOld=moveClock(newest.state,2*MINUTES_PER_DAY);
  const removed=expireReadyFood(expiredOld);
  assert.equal(removed.length,1);
  assert.equal(removed[0].portions,2);
  assert.equal(expiredOld.takeout.pizzaCheese,2);
  const eaten=applyTakeoutMeal(expiredOld,'vlad','pizzaCheese');
  assert.ok(eaten.ok);
  assert.equal(eaten.state.takeout.pizzaCheese,1);
  const oneRoll=checkout(initialState(),'alina',[{id:'takeout:rollsSmall',quantity:1}]);
  assert.ok(oneRoll.ok);
  assert.equal(oneRoll.state.readyFood[0].expiresAt,
    gameMinutes(oneRoll.state.clock)+2*MINUTES_PER_DAY);
  assert.equal(TAKEOUT.rollsSmall.quantity,1);
});

test('Delivered ready food spoils at the doorstep after 2 game days, without losing mixed groceries',()=>{
  const base=initialState();
  const queued=successful(applyWorld(base,'alina',{type:'delivery_order',sequence:0,
    lines:[{id:'takeout:pizzaCheese',quantity:1},{id:'grocery:milk',quantity:1}]}));
  const parcel=queued.world.deliveries[0];
  const overdue=at(moveClock(queued,2*MINUTES_PER_DAY+25),'vlad','parcel');
  assert.ok(gameMinutes(overdue.clock)>=parcel.readyAt+2*MINUTES_PER_DAY);
  const collected=successful(applyWorld(overdue,'vlad',{
    type:'delivery_claim',id:parcel.id,storage:'fridge',
  }));
  assert.equal(collected.takeout.pizzaCheese,0,'food is not revived by late refrigeration');
  assert.equal(collected.pantry.milk,1);
  assert.equal(collected.readyFood.length,0);
  assert.equal(collected.world.deliveries.length,0);
  assert.equal(collected.money,queued.money);
});

test('Table has limited portions, fridge overflow rejects without consuming the paid parcel',()=>{
  const start=initialState();
  start.money=100000;
  start.pantry.eggs=0;
  // Eighteen prepared servings occupy the whole empty fridge.
  start.meals.omelette=18;
  const queued=successful(applyWorld(start,'vlad',{type:'delivery_order',sequence:0,
    lines:[{id:'takeout:pizzaCheese',quantity:1}]}));
  const ready=at(moveClock(queued,20),'alina','parcel');
  const fridge=applyWorld(ready,'alina',{type:'delivery_claim',
    id:queued.world.deliveries[0].id,storage:'fridge'});
  assert.equal(fridge.ok,false);
  assert.equal(ready.world.deliveries.length,1,'failed collection leaves the order safe');
  const table=successful(applyWorld(ready,'alina',{type:'delivery_claim',
    id:queued.world.deliveries[0].id,storage:'table'}));
  assert.equal(readyFoodTableUsage(table),2);
  assert.equal(TABLE_READY_CAPACITY,12);
  const transfer=applyWorld(at(table,'vlad','fridge'),'vlad',
    {type:'ready_food_move',kind:'takeout',item:'pizzaCheese'});
  assert.equal(transfer.ok,false,'the move must not overfill a fridge');
});

test('Old saves receive one fixed expiry with no freshening on second load; codes and money survive',()=>{
  const dir=mkdtempSync(join(tmpdir(),'sim-life-ready-food-'));
  try {
    const files=openServerFiles(dir);
    const legacy=initialState();
    legacy.money=34789;
    legacy.meals.omelette=2;
    legacy.takeout.pizzaCheese=1;
    delete (legacy as unknown as Record<string,unknown>).readyFood;
    files.save(legacy);
    const migrated=files.load();
    assert.equal(migrated.money,34789);
    assert.equal(migrated.meals.omelette,2);
    assert.equal(migrated.takeout.pizzaCheese,1);
    assert.equal(migrated.readyFood.length,2);
    assert.equal(storageUsage(migrated).fridge,1+3*READY_FOOD_SLOTS);
    assert.ok(migrated.readyFood.every(b=>b.expiresAt===gameMinutes(migrated.clock)+2*MINUTES_PER_DAY));
    const loadedAgain=files.load();
    assert.deepEqual(loadedAgain.readyFood,migrated.readyFood);
    assert.deepEqual(JSON.parse(readFileSync(join(dir,'access.json'),'utf8')),files.access);
    const expired=moveClock(loadedAgain,3*MINUTES_PER_DAY);
    assert.equal(expireReadyFood(expired).length,2);
    files.save(expired);
    const reloaded=files.load();
    assert.equal(reloaded.meals.omelette,0);
    assert.equal(reloaded.takeout.pizzaCheese,0);
    assert.equal(reloaded.readyFood.length,0);
  } finally {rmSync(dir,{recursive:true,force:true});}
});

function waitFor(ws:WebSocket, match:(p:ServerPacket)=>boolean):Promise<ServerPacket> {
  return new Promise((resolve,reject)=>{
    const timer=setTimeout(()=>{ws.off('message',accept);reject(new Error('No fresh-food message'));},4000);
    function accept(raw:RawData){
      const packet=JSON.parse(raw.toString()) as ServerPacket;
      if(!match(packet))return;
      clearTimeout(timer);ws.off('message',accept);resolve(packet);
    }
    ws.on('message',accept);
  });
}
async function enter(port:number,role:CharacterId,code:string):Promise<WebSocket>{
  const ws=new WebSocket('ws://127.0.0.1:'+port+'/sync');
  await once(ws,'open');
  const ready=waitFor(ws,p=>p.type==='ready'||p.type==='error');
  ws.send(JSON.stringify({type:'auth',role,code}));
  assert.equal((await ready).type,'ready');
  return ws;
}

test('The server clock makes food spoil once and broadcasts the same warning to both players',async()=>{
  const dir=mkdtempSync(join(tmpdir(),'sim-life-ready-clock-'));
  const files=openServerFiles(dir);
  const initial=initialState();
  initial.pantry.eggs=5;
  initial.meals.omelette=2;
  addReadyFood(initial,'meal','omelette',2,'fridge');
  initial.readyFood[0].expiresAt=gameMinutes(initial.clock)+4;
  files.save(initial);
  let fakeNow=0;
  const server=await startServer({port:0,dataDir:dir,lifeClock:{now:()=>fakeNow,tickMs:15}});
  let vlad:WebSocket|undefined;
  let alina:WebSocket|undefined;
  try {
    vlad=await enter(server.port,'vlad',files.access.vlad);
    alina=await enter(server.port,'alina',files.access.alina);
    const a=waitFor(vlad,p=>p.type==='ready_food_spoiled');
    const b=waitFor(alina,p=>p.type==='ready_food_spoiled');
    fakeNow+=30_000; // One simulated clock step advances 15 game minutes.
    const [noticeA,noticeB]=await Promise.all([a,b]);
    assert.deepEqual(noticeA,noticeB,'warnings to Vlad and Alina match');
    assert.ok(noticeA.type==='ready_food_spoiled' && /омлет/.test(noticeA.message));
    const stored=files.load();
    assert.equal(stored.meals.omelette,0);
    assert.equal(stored.pantry.eggs,5,'raw ingredients do not spoil');
    assert.equal(stored.readyFood.length,0);
  } finally {
    vlad?.terminate();alina?.terminate();
    await server.close();
    rmSync(dir,{recursive:true,force:true});
  }
});
