
import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {once} from 'node:events';
import WebSocket from 'ws';
import {initialState,type CharacterId,type GameState,type ServerPacket} from '../../src/shared/protocol';
import {changeFoodFavorite,favoriteFood,validFoodTastes} from '../../src/shared/foodTastes';
import {applyFoodAction,applyTakeoutMeal,applyTvFood} from '../food';
import {addReadyFood} from '../../src/shared/readyFood';
import {clockAt,gameMinutes} from '../../src/shared/life';
import {autonomyCandidates} from '../../src/shared/autonomy';
import {activityItems,SOCIAL_BY_ID} from '../../src/shared/socialLife';
import {openServerFiles} from '../storage';
import {startServer} from '../server';
function mark(s:GameState,role:CharacterId,kind:import('../../src/shared/foodTastes').TasteKind,id:string,on=true){const r=changeFoodFavorite(s,role,kind,id,on);assert.ok(r.ok);return r.state;}
function stock(s:GameState,kind:'meal'|'takeout',id:string,n=1,quality:'good'|'bad'|'average'|'perfect'='good'){
 if(kind==='meal')s.meals[id as keyof typeof s.meals]+=n;else s.takeout[id as keyof typeof s.takeout]+=n;
 addReadyFood(s,kind,id,n,'table',undefined,quality);
}
test('favorites are independent, idempotent and strictly validated',()=>{
 const s=initialState(),a=mark(s,'alina','meal','omelette'),b=mark(a,'vlad','takeout','milkChocolate');
 assert.equal(favoriteFood(s,'alina','meal','omelette'),false);
 assert.equal(favoriteFood(b,'vlad','meal','omelette'),false);assert.equal(favoriteFood(b,'alina','takeout','milkChocolate'),false);
 assert.equal(mark(b,'alina','meal','omelette'),b);assert.equal(b.money,s.money);
 assert.equal(changeFoodFavorite(b,'alina','meal','__proto__',true).ok,false);
 assert.equal(changeFoodFavorite(b,'alina','takeout','omelette',true).ok,false);
 assert.equal(changeFoodFavorite(b,'alina','meal','omelette','true').ok,false);
 assert.equal(validFoodTastes({vlad:{favorites:['meal:omelette','meal:omelette']}}),false);
 assert.equal(validFoodTastes({alina:{favorites:['takeout:nope']}}),false);assert.ok(validFoodTastes(b.foodTastes));
});
test('fresh quality meal gets one bounded bonus; toggle and alternate dish cannot reset cooldown',()=>{
 let s=mark(initialState(),'alina','meal','omelette');s=mark(s,'alina','meal','blackTeaCup');
 s.characters.alina.mood=30;stock(s,'meal','omelette',2);stock(s,'meal','blackTeaCup',2);
 const r=applyFoodAction(s,'alina',{type:'eat',recipe:'omelette'});assert.ok(r.ok);
 assert.equal(r.state.characters.alina.mood,41);assert.equal(r.state.meals.omelette,1);
 assert.equal(r.state.foodTastes?.alina?.lastBonusAt,gameMinutes(s.clock));
 s=mark(mark(r.state,'alina','meal','omelette',false),'alina','meal','omelette');
 const next=applyFoodAction(s,'alina',{type:'eat',recipe:'blackTeaCup'});assert.ok(next.ok);assert.equal(next.state.characters.alina.mood,48);
 s=next.state;s.clock=clockAt(gameMinutes(s.clock)+180);stock(s,'meal','omelette',1);
 const late=applyFoodAction(s,'alina',{type:'eat',recipe:'omelette'});assert.ok(late.ok);assert.equal(late.state.characters.alina.mood,59);
});
test('bad and average portions do not gain preference reward; missing servings never earn it',()=>{
 for(const quality of ['bad','average'] as const){const s=mark(initialState(),'vlad','meal','omelette');s.characters.vlad.mood=50;stock(s,'meal','omelette',1,quality);
 const r=applyFoodAction(s,'vlad',{type:'eat',recipe:'omelette'},()=>1);assert.ok(r.ok);assert.equal(r.state.characters.vlad.mood,quality==='bad'?20:35);assert.equal(r.state.foodTastes?.vlad?.lastBonusAt,undefined);
 assert.equal(applyFoodAction(r.state,'vlad',{type:'eat',recipe:'omelette'}).ok,false);}
});
test('takeout and TV consumption share cooldown with home food',()=>{
 let s=mark(initialState(),'vlad','takeout','pizzaCheese');s.characters.vlad.mood=20;stock(s,'takeout','pizzaCheese',2);
 const r=applyTakeoutMeal(s,'vlad','pizzaCheese');assert.ok(r.ok);assert.equal(r.state.characters.vlad.mood,35);
 const tv=applyTvFood(r.state,'vlad','pizzaCheese');assert.ok(tv.ok);assert.equal(tv.state.characters.vlad.mood,44);assert.equal(tv.state.takeout.pizzaCheese,0);
});
test('autonomy prefers favorite real meals but never puts a favorite tea before a full meal',()=>{
 let s=mark(initialState(),'vlad','meal','pastaCheese');s=mark(s,'vlad','meal','blackTeaCup');s.autonomy.vlad='needs';s.characters.vlad.hunger=20;
 for(const id of ['omelette','pastaCheese','blackTeaCup'])stock(s,'meal',id);
 assert.deepEqual(autonomyCandidates(s,'vlad').find(c=>c.need==='hunger')?.command,{type:'eat',recipe:'pastaCheese'});
});
test('partner favorite is highlighted and ordered only among actual fresh servings',()=>{
 const s=mark(initialState(),'alina','meal','pastaCheese');stock(s,'meal','omelette');stock(s,'meal','pastaCheese');
 const items=activityItems(SOCIAL_BY_ID.get('bring')!,s,'vlad');assert.equal(items[0].id,'pastaCheese');assert.match(items[0].label,/Любимое/);
 assert.equal(items.some(i=>i.id==='blackTeaCup'),false);
});
test('food tastes survive storage and older households load without preferences',()=>{
 const dir=mkdtempSync(join(tmpdir(),'taste066-'));try{const f=openServerFiles(dir),s=mark(initialState(),'alina','meal','omelette');
 f.save(s);assert.deepEqual(f.load().foodTastes,s.foodTastes);
 delete s.foodTastes;f.save(s);assert.deepEqual(f.load().foodTastes,{});
 }finally{rmSync(dir,{recursive:true,force:true});}
});
function watch(ws:WebSocket,predicate:(p:ServerPacket)=>boolean){return new Promise<ServerPacket>((resolve,reject)=>{
 const timer=setTimeout(()=>{ws.off('message',on);reject(Error('Packet timeout'));},5000);
 function on(raw:WebSocket.RawData){const p=JSON.parse(raw.toString()) as ServerPacket;if(predicate(p)){clearTimeout(timer);ws.off('message',on);resolve(p);}}ws.on('message',on);
});}
test('two actual sockets cannot write preferences on behalf of the other player',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'taste066-live-')),server=await startServer({port:0,dataDir:dir,testNoCodes:true});const sockets:WebSocket[]=[];
 async function connect(role:CharacterId){const ws=new WebSocket('ws://127.0.0.1:'+server.port+'/sync');sockets.push(ws);await once(ws,'open');const ready=watch(ws,p=>p.type==='ready');ws.send(JSON.stringify({type:'auth',role,code:'TEST-LOCAL-NO-CODES'}));await ready;return ws;}
 try{const v=await connect('vlad'),a=await connect('alina');const snapshot=watch(a,p=>p.type==='snapshot'&&favoriteFood(p.state,'vlad','meal','omelette'));v.send(JSON.stringify({type:'food_favorite',kind:'meal',item:'omelette',enabled:true,role:'alina'}));const p=await snapshot;assert.equal(p.type,'snapshot');if(p.type==='snapshot')assert.equal(favoriteFood(p.state,'alina','meal','omelette'),false);
 const error=watch(v,p=>p.type==='error');v.send(JSON.stringify({type:'food_favorite',kind:'meal',item:'invalid',enabled:true}));await error;
 const second=watch(v,p=>p.type==='snapshot'&&favoriteFood(p.state,'alina','takeout','milkChocolate'));a.send(JSON.stringify({type:'food_favorite',kind:'takeout',item:'milkChocolate',enabled:true}));await second;
 assert.equal(favoriteFood(openServerFiles(dir).load(),'alina','takeout','milkChocolate'),true);
 }finally{for(const ws of sockets)ws.terminate();await server.close();rmSync(dir,{recursive:true,force:true});}
});

import {brewCoffee} from '../coffee';
import {localActivity} from '../locations';
import {stationById,approachFor,CAFE_MENU} from '../../src/shared/locations';
import {wishesFor} from '../../src/shared/wishes';
import {wishAtStart,fulfillWish} from '../happiness';
import {CAMP_RECIPES} from '../../src/shared/park';
test('coffee, cafe and picnic share one resident cooldown and consume only real stock',()=>{
 let s=mark(initialState(),'vlad','coffee','coffeeNescafeGold');s=mark(s,'vlad','cafe','cappuccino');s=mark(s,'vlad','campfire','campPotato');
 s.pantry.coffeeNescafeGold=2;s.characters.vlad.mood=10;
 const coffee=brewCoffee(s,'vlad','coffeeNescafeGold');assert.ok(coffee.ok);assert.equal(coffee.state.characters.vlad.mood,16);assert.equal(coffee.state.pantry.coffeeNescafeGold,1);
 s=coffee.state;s.world.places.vlad='cafe';const table=stationById('cafe','cafe-center')!;
 Object.assign(s.characters.vlad,approachFor(table,'vlad'),{pose:'sit',mood:10});
 s.world.cafe.vlad={item:'cappuccino',readyAt:gameMinutes(s.clock),pickedUp:false,table:'cafe-center'};
 const cafe=localActivity(s,'vlad','dine','cafe-center');assert.ok(cafe.ok);assert.equal(cafe.state.characters.vlad.mood,10+CAFE_MENU.cappuccino.mood);assert.equal(cafe.state.world.cafe.vlad,undefined);
 s=cafe.state;s.clock=clockAt(gameMinutes(s.clock)+180);s.world.places.vlad='park';Object.assign(s.characters.vlad,approachFor(stationById('park','park-picnic')!,'vlad'),{mood:10});
 s.world.picnic={portions:{vlad:[{kind:'campfire',item:'campPotato',expiresAt:gameMinutes(s.clock)+60,quality:'good'}],alina:[]}};
 const picnic=localActivity(s,'vlad','picnic','park-picnic');assert.ok(picnic.ok);assert.equal(picnic.state.characters.vlad.mood,10+CAMP_RECIPES.campPotato.mood+8+6);assert.equal(picnic.state.world.picnic!.portions.vlad.length,0);
 assert.equal(localActivity(picnic.state,'vlad','picnic','park-picnic').ok,false);
});
test('favorite wish appears only for genuine available good food and pays once daily after actual eating',()=>{
 let s=mark(initialState(),'alina','meal','omelette');s.characters.alina.hunger=70;stock(s,'meal','omelette',2);
 const cmd={type:'eat' as const,recipe:'omelette' as const};
 const wish=wishAtStart(s,'alina',cmd);assert.equal(wish?.id,'favorite-meal');
 assert.equal(fulfillWish(structuredClone(s),'alina',wish,s),'');
 const r=applyFoodAction(s,'alina',cmd);assert.ok(r.ok);assert.match(fulfillWish(r.state,'alina',wish,s),/15/);
 assert.equal(fulfillWish(r.state,'alina',wish,s),'');assert.equal(r.state.happiness.alina.points,15);
 assert.ok(!wishesFor(r.state,'alina').some(w=>w.id==='favorite-meal'));
 s=mark(initialState(),'vlad','takeout','milkChocolate');s.characters.vlad.hunger=70;stock(s,'takeout','milkChocolate');
 assert.equal(wishAtStart(s,'vlad',{type:'eat_takeout',item:'milkChocolate'})?.id,'favorite-meal');
 const eaten=applyTakeoutMeal(s,'vlad','milkChocolate');assert.ok(eaten.ok);
 assert.ok(fulfillWish(eaten.state,'vlad',wishAtStart(s,'vlad',{type:'eat_takeout',item:'milkChocolate'}),s));
});
test('expired, bad or missing servings and full hunger do not create favorite food wishes',()=>{
 let s=mark(initialState(),'vlad','meal','omelette');s.characters.vlad.hunger=70;stock(s,'meal','omelette',1,'bad');stock(s,'meal','omelette',1,'good');
 assert.ok(!wishesFor(s,'vlad').some(w=>w.id==='favorite-meal'));
 s.readyFood=[];s.meals.omelette=0;assert.ok(!wishesFor(s,'vlad').some(w=>w.id==='favorite-meal'));
 stock(s,'meal','omelette');s.characters.vlad.hunger=100;assert.ok(!wishesFor(s,'vlad').some(w=>w.id==='favorite-meal'));
});
