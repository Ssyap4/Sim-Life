import { test } from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import WebSocket from 'ws';
import { initialState, type CharacterId, type GameState, type ServerPacket } from '../../src/shared/protocol';
import { activityItems, contextAvailable, SOCIAL_ACTIVITIES, SOCIAL_BY_ID, type SocialIntent } from '../../src/shared/socialLife';
import { ingredientList } from '../../src/shared/food';
import { levelXP } from '../../src/shared/education';
import { clockAt, gameMinutes } from '../../src/shared/life';
import { addReadyFood, moveReadyFoodToFridge } from '../../src/shared/readyFood';
import { initialServices } from '../../src/shared/services';
import { newCareerProgress } from '../../src/shared/careers';
import { pointIsClear } from '../../src/game/navigation';
import { RESIDENT_CLEARANCE } from '../../src/game/residentCollision';
import { floorFor, placeObstacles, spawn } from '../../src/shared/locations';
import { addRelationship, completeTogether, pairScenes, validRelationship } from '../society';
import { startServer } from '../server';
import { createHomeSessions } from '../homeSessions';
import { openServerFiles } from '../storage';

const residents=['vlad','alina'] as const;
function sample(){
  const state=initialState();
  for (const role of residents) state.education.characters[role].xp.cooking=levelXP(2);
  state.pantry.eggs=7;state.pantry.milk=7;
  state.meals.omelette=2;
  addReadyFood(state,'meal','omelette',2,'table');
  state.characters.vlad.hunger=25;state.characters.alina.hunger=30;
  state.characters.vlad.mood=45;state.characters.alina.mood=45;
  return state;
}
async function joinAs(port:number,role:CharacterId,code:string){
  const ws=new WebSocket('ws://127.0.0.1:'+port+'/sync');
  const queue:ServerPacket[]=[];
  ws.on('message',raw=>queue.push(JSON.parse(raw.toString())));
  await once(ws,'open');
  const send=(data:object)=>ws.send(JSON.stringify(data));
  async function take<T extends ServerPacket['type']>(type:T,condition:(p:Extract<ServerPacket,{type:T}>)=>boolean=()=>true){
    for(let i=0;i<360;i++){
      const index=queue.findIndex(p=>p.type===type&&condition(p as Extract<ServerPacket,{type:T}>));
      if(index>=0)return queue.splice(index,1)[0] as Extract<ServerPacket,{type:T}>;
      await new Promise(r=>setTimeout(r,10));
    }
    throw new Error('Missing '+type+' for '+role+'. Pending '+queue.map(p=>p.type).join(', '));
  }
  send({type:'auth',role,code});
  const ready=await take('ready');
  return {ws,send,take,ready,role};
}
type Client=Awaited<ReturnType<typeof joinAs>>;
async function meet(options:{state?:GameState;ttl?:number;scale?:number}={}){
  const dir=mkdtempSync(join(tmpdir(),'sim-life-social-'));
  const files=openServerFiles(dir);
  files.save(options.state??sample());
  const server=await startServer({port:0,dataDir:dir,taskTimeScale:options.scale??.022,socialTtlMs:options.ttl});
  return {files,server,connect:(role:CharacterId)=>joinAs(server.port,role,files.access[role]),
    async close(){await server.close();rmSync(dir,{recursive:true,force:true});}};
}
async function propose(from:Client,to:Client,action:string,item?:string){
  from.send({type:'social_propose',action,item});
  const first=await from.take('social_pending');
  assert.deepEqual(await to.take('social_pending'),first);
  return first.offer;
}
async function accept(from:Client,to:Client,inviteId:number,choice=0){
  to.send({type:'social_reply',inviteId,choice});
  const result=await from.take('social_closed',p=>p.inviteId===inviteId);
  assert.equal(result.phase,'accepted',result.message);
  return result;
}
const started=(p:Client,role:CharacterId)=>p.take('task_started',e=>e.role===role&&e.command.type==='together');
const ended=(p:Client,role:CharacterId,taskId?:number)=>p.take('task_ended',e=>e.role===role&&(taskId===undefined||e.taskId===taskId));

test('Legacy hug requests now require the other player’s consent, then synchronize paths, effects and the saved memory',async()=>{
  const f=await meet();
  try{
    const v=await f.connect('vlad');
    v.send({type:'social_offer',kind:'hug'});
    await v.take('error');
    const a=await f.connect('alina');
    v.send({type:'social_offer',kind:'hug'});
    const {offer}=await v.take('social_pending');
    assert.equal((await a.take('social_pending')).offer.id,offer.id);
    assert.equal(f.files.load().relationship.memories.length,0);
    v.send({type:'social_reply',inviteId:offer.id,choice:0});
    await v.take('error');
    const consent=await accept(v,a,offer.id,1);
    assert.equal(consent.reply,offer.replies[1]);
    const vlad=await started(v,'vlad'),alina=await started(v,'alina');
    assert.equal(vlad.home?.pair?.motion,'hug');
    assert.notDeepEqual(vlad.home?.route.path.at(-1),alina.home?.route.path.at(-1));
    assert.deepEqual(await started(a,'vlad'),vlad);
    a.send({type:'social_reply',inviteId:offer.id,choice:1});
    await a.take('error');
    assert.equal((await ended(v,'vlad',vlad.taskId)).outcome,'completed');
    assert.equal((await ended(a,'alina',alina.taskId)).outcome,'completed');
    const saved=f.files.load();
    assert.equal(saved.relationship.memories[0].action,'softHug');
    assert.equal(saved.relationship.memories[0].description,consent.reply);
    for(const id of residents)assert.ok(saved.characters[id].social>sample().characters[id].social);
  }finally{await f.close();}
});

test('Mutual proposals compete for one slot, and refusal is penalty-free',async()=>{
  const f=await meet();
  try{
    const v=await f.connect('vlad'),a=await f.connect('alina');
    const offer=await propose(v,a,'hands');
    a.send({type:'social_propose',action:'kiss'});
    await a.take('error');
    a.send({type:'social_reply',inviteId:offer.id,choice:null});
    assert.equal((await v.take('social_closed')).phase,'declined');
    assert.deepEqual(f.files.load().relationship,sample().relationship);
  }finally{await f.close();}
});

test('An expired offer and a forged action packet cannot change the household',async()=>{
  const f=await meet({ttl:175});
  try{
    const v=await f.connect('vlad'),a=await f.connect('alina');
    const offer=await propose(v,a,'day');
    assert.equal((await a.take('social_closed')).phase,'expired');
    a.send({type:'social_reply',inviteId:offer.id,choice:0});
    await a.take('error');
    v.send({type:'together',action:'cook',item:'omelette',claimedResult:{money:6000}});
    await v.take('error');
    assert.deepEqual(f.files.load().relationship,sample().relationship);
  }finally{await f.close();}
});

test('An invitation is revalidated after sleep, work or a transition',async()=>{
  const f=await meet();
  try{
    const v=await f.connect('vlad'),a=await f.connect('alina');
    const offer=await propose(v,a,'day');
    a.send({type:'travel',place:'market'});
    await a.take('snapshot',p=>p.state.world.places.alina==='market');
    a.send({type:'social_reply',inviteId:offer.id,choice:0});
    assert.equal((await v.take('social_closed')).phase,'interrupted');
    assert.deepEqual(f.files.load().relationship,sample().relationship);
  }finally{await f.close();}
});

test('Cooperative cooking spends exactly one set of ingredients and gives unique joint experience',async()=>{
  const state=sample();
  state.meals.omelette=0;state.readyFood=[];
  const f=await meet({state});
  try{
    const v=await f.connect('vlad'),a=await f.connect('alina');
    const offer=await propose(v,a,'cook','omelette');
    await accept(v,a,offer.id);
    const first=await started(v,'vlad'),second=await started(a,'alina');
    assert.equal(first.home?.pair?.motion,'cook');
    assert.equal(second.home?.pair?.motion,'prep');
    assert.notDeepEqual(first.home?.route.path.at(-1),second.home?.route.path.at(-1));
    assert.equal((await ended(v,'vlad',first.taskId)).outcome,'completed');
    const saved=f.files.load();
    assert.equal(saved.meals.omelette,2);
    for(const [id,amount] of ingredientList('omelette'))assert.equal(saved.pantry[id],state.pantry[id]-amount);
    for(const id of residents)assert.ok(saved.education.characters[id].xp.cooking>state.education.characters[id].xp.cooking);
    assert.equal(saved.relationship.memories.length,1);
  }finally{await f.close();}
});

test('A cook can accept a helper after starting; the former solo task cannot also deliver a meal',async()=>{
  const state=sample();
  state.meals.omelette=0;state.readyFood=[];
  const f=await meet({state,scale:.065});
  try{
    const v=await f.connect('vlad'),a=await f.connect('alina');
    v.send({type:'cook',recipe:'omelette'});
    const solo=await v.take('task_started',p=>p.role==='vlad'&&p.command.type==='cook');
    const offer=await propose(a,v,'joinCook');
    assert.match(offer.title,/помочь/i);
    await accept(a,v,offer.id);
    assert.equal((await ended(v,'vlad',solo.taskId)).outcome,'cancelled');
    const co=await started(v,'vlad');
    assert.equal(co.home?.pair?.motion,'cook');
    assert.equal((await ended(a,'vlad',co.taskId)).outcome,'completed');
    assert.equal(f.files.load().meals.omelette,2);
    assert.equal(f.files.load().pantry.eggs,state.pantry.eggs-2);
  }finally{await f.close();}
});

test('An independent early meal finish consumes one portion and the partner can continue',async()=>{
  const f=await meet({scale:.09});
  try{
    const v=await f.connect('vlad'),a=await f.connect('alina');
    const offer=await propose(v,a,'eat','omelette');
    await accept(v,a,offer.id);
    const meal=await started(v,'vlad'),peer=await started(a,'alina');
    assert.equal(meal.home?.pair?.seat,'table');
    assert.equal(peer.home?.pair?.seat,'table');
    assert.notDeepEqual(meal.home?.route.path.at(-1),peer.home?.route.path.at(-1));
    await v.take('task_active',e=>e.taskId===meal.taskId);
    await new Promise(r=>setTimeout(r,Math.round(meal.durationMs*.77)));
    v.send({type:'social_finish',taskId:meal.taskId});
    assert.equal((await ended(v,'vlad',meal.taskId)).outcome,'completed');
    assert.equal(f.files.load().meals.omelette,1);
    assert.equal((await ended(a,'alina',peer.taskId)).outcome,'completed');
    const saved=f.files.load();
    assert.equal(saved.meals.omelette,0);
    assert.equal(saved.dirtyDishes.table,2);
    assert.equal(saved.relationship.memories[0].action,'eat');
  }finally{await f.close();}
});

test('A partner can leave the TV independently, with no reward for their cancelled participation',async()=>{
  const f=await meet({scale:.022});
  try{
    const v=await f.connect('vlad'),a=await f.connect('alina');
    const offer=await propose(v,a,'tv');
    await accept(v,a,offer.id);
    const first=await started(v,'vlad'),peer=await started(a,'alina');
    assert.equal(first.home?.pair?.seat,'sofa');
    assert.equal(peer.home?.program,'broadcast');
    await v.take('task_active',e=>e.taskId===first.taskId);
    v.send({type:'cancel_task',taskId:first.taskId});
    assert.equal((await ended(v,'vlad',first.taskId)).outcome,'cancelled');
    assert.equal((await ended(a,'alina',peer.taskId)).outcome,'completed');
    const saved=f.files.load();
    assert.equal(saved.characters.vlad.fun,sample().characters.vlad.fun);
    assert.equal(saved.characters.alina.fun,sample().characters.alina.fun+5);
    assert.equal(saved.relationship.memories.length,0);
  }finally{await f.close();}
});

test('Netflix and YouTube joint playback still require the existing services',async()=>{
  const state=sample();
  state.billing=initialServices(gameMinutes(state.clock));
  state.billing.services.netflix = {...state.billing.services.netflix,enabled:false,paidUntil:0};
  const f=await meet({state});
  try{
    const v=await f.connect('vlad');await f.connect('alina');
    v.send({type:'social_propose',action:'film',item:'comedy'});
    assert.match((await v.take('error')).reason,/Netflix|интернет/);
    v.send({type:'social_propose',action:'youtube'});
    assert.match((await v.take('error')).reason,/YouTube|интернет/);
  }finally{await f.close();}
});

test('Pet bowl, food service and dish cleaning perform single operations against real family inventory',()=>{
  let state=sample();
  const together=(action:string,item?:string)=>{
    const intent:SocialIntent={type:'together',action,item};
    const homes=pairScenes(state,'vlad',intent);
    assert.ok(homes,action);
    const reply=completeTogether(state,'vlad',intent,[...residents],0,homes);
    if(!reply.ok)assert.fail(reply.reason);
    state=reply.state;
  };
  const original=state.petFood.simba;
  together('petFeed','simba');
  assert.equal(state.petFood.simba,original-1);
  assert.equal(state.petBowls.simba,3);
  assert.equal(moveReadyFoodToFridge(state,'meal','omelette'),true);
  assert.equal(moveReadyFoodToFridge(state,'meal','omelette'),true);
  const expiry=state.readyFood[0].expiresAt;
  together('serve','omelette');
  assert.ok(state.readyFood.some(b=>b.storage==='table'&&b.expiresAt<expiry),
    'serving the portion accelerates spoilage without refreshing the food');
  assert.equal(state.meals.omelette,2);
  state.dirtyDishes={table:2,yardTable:1};
  together('dishes');
  assert.deepEqual(state.dirtyDishes,{table:0,yardTable:0});
  assert.equal(state.money,sample().money);
});

test('Repeated short exchanges have a bounded response without decaying a relationship on idle days',()=>{
  const state=sample();
  const hug=SOCIAL_BY_ID.get('softHug')!;
  for(let i=0;i<85;i++){
    const result=addRelationship(state,hug,0);
    if(i>=2)assert.equal(result.strength,0);
  }
  assert.equal(state.relationship.memories.length,1);
  assert.equal(state.relationship.recent.length,48);
  const last=state.relationship.lastTogether;
  state.clock=clockAt(gameMinutes(state.clock)+1440*9);
  assert.equal(state.relationship.lastTogether,last);
  assert.equal(addRelationship(state,hug,1).strength,1);
});

test('Context prompts use actual milestones and have enough independently authored dialogue',()=>{
  const state=sample();
  const a=SOCIAL_BY_ID.get('promotion')!;
  assert.equal(contextAvailable(a,state,'vlad'),false);
  const progress=newCareerProgress();
  progress.history.push({id:1,at:gameMinutes(state.clock),title:'Повышение',text:'Новая должность'});
  state.careers.residents.alina.progress.marketing=progress;
  assert.equal(contextAvailable(a,state,'vlad'), true);
  assert.equal(new Set(SOCIAL_ACTIVITIES.map(a=>a.id)).size,SOCIAL_ACTIVITIES.length);
  const lines=SOCIAL_ACTIVITIES.flatMap(a=>[...a.lines,...a.replies]);
  assert.ok(new Set(lines).size>=230);
});

test('Routes stay walkable for both partners in the home, cafe and park',()=>{
  const state=sample();state.dirtyDishes.table=2;state.world.tableBags=1;
  for(const a of SOCIAL_ACTIVITIES.filter(a=>a.object)){
    const candidates=a.object==='parkRest'?['park'] as const:a.object==='cafeMeal'?['cafe'] as const:a.object==='walk'?['park','home'] as const:['home'] as const;
    for(const place of candidates){
      for(const role of residents){state.world.places[role]=place;Object.assign(state.characters[role],spawn(place,role));}
      const item=activityItems(a,state,'vlad')[0]?.id??(a.object==='takeout'?'pizza':a.object==='grill'?'grillSausage':undefined);
      const result=pairScenes(state,'vlad',{type:'together',action:a.id,item});
      assert.ok(result,a.id+' '+place);
      const endpoints=residents.map(role=>result[role].pair?.stroll?.at(-1)??result[role].route.path.at(-1)??result[role].route.from);
      assert.notDeepEqual(endpoints[0],endpoints[1]);
      for(const endpoint of endpoints)assert.ok(pointIsClear(endpoint,placeObstacles(place),floorFor(place)),a.id);
    }
  }
});

test('Physical contact ends its walking phase outside the ordinary body collision threshold',()=>{
  for(const place of ['home','park'] as const){
    const state=sample();
    for(const role of residents){state.world.places[role]=place;Object.assign(state.characters[role],spawn(place,role));}
    for(const action of ['softHug','closeHug','kiss','cheek','hands','shoulder','hair','highFive','slowDance']){
      const result=pairScenes(state,'alina',{type:'together',action});
      assert.ok(result,place+' '+action);
      const points=residents.map(role=>result[role].route.path.at(-1)??result[role].route.from);
      assert.ok(Math.hypot(points[0].x-points[1].x,points[0].z-points[1].z)>RESIDENT_CLEARANCE,action);
    }
  }
});

test('A live disconnect leaves active gifts unspent, and restart migrates old data without stale invitations',async()=>{
  const state=sample();
  const f=await meet({state,scale:.1});
  try{
    const v=await f.connect('vlad'),a=await f.connect('alina');
    const offer=await propose(v,a,'bring','omelette');
    await accept(v,a,offer.id);
    const first=await started(v,'vlad');
    a.ws.close();
    assert.equal((await ended(v,'vlad',first.taskId)).outcome,'cancelled');
    const again=await f.connect('alina');
    assert.equal(again.ready.state.meals.omelette,state.meals.omelette);
    await f.server.close();
    const {relationship:_,...legacy}=f.files.load();
    writeFileSync(join(f.files.dataDir,'household.json'),JSON.stringify(legacy));
    const server=await startServer({port:0,dataDir:f.files.dataDir});
    try{
      const back=await joinAs(server.port,'vlad',f.files.access.vlad);
      assert.deepEqual(back.ready.state.pantry,state.pantry);
      assert.deepEqual(back.ready.state.relationship.memories,[]);
      back.send({type:'social_reply',inviteId:offer.id,choice:0});
      await back.take('error');
    }finally{await server.close();}
  }finally{await f.close();}
});


test('A legacy version-2 household persists the new relationship field on its first load',()=>{
  const dir=mkdtempSync(join(tmpdir(),'sim-life-relationship-migration-'));
  try{
    const files=openServerFiles(dir);
    const before=sample();
    const {relationship: _oldRelationship,...legacy}=before;
    writeFileSync(join(dir,'household.json'),JSON.stringify(legacy));
    const loaded=files.load();
    const persisted=JSON.parse(readFileSync(join(dir,'household.json'),'utf8')) as GameState;
    assert.deepEqual(persisted.relationship,{memories:[],recent:[]});
    assert.deepEqual(loaded.relationship,persisted.relationship);
    assert.deepEqual(persisted.pantry,before.pantry);
    assert.equal(persisted.money,before.money);
    assert.deepEqual(files.load().relationship,loaded.relationship);
  }finally{rmSync(dir,{recursive:true,force:true});}
});


test('An unreachable pair scene never interrupts leisure or pauses a pet before its route is validated',()=>{
  const state=sample();
  state.pets.simba.position={x:9000,z:9000};
  const sockets={
    vlad:{readyState:WebSocket.OPEN} as WebSocket,
    alina:{readyState:WebSocket.OPEN} as WebSocket,
  };
  const packets:ServerPacket[]=[];
  let preparations=0,petPauses=0,taskIds=0;
  const sessions=createHomeSessions({
    state:()=>state,
    save:()=>{throw new Error('Unreachable action must not save')},
    all:event=>packets.push(event),
    send:(_socket,event)=>packets.push(event),
    socket:role=>sockets[role],
    busy:()=>false,
    prepare:()=>{preparations++},
    nextId:()=>++taskIds,
    timeScale:1,
    gameTime:()=>gameMinutes(state.clock),
    resourceBusy:()=>false,
    pausePet:()=>{petPauses++},
  });
  try{
    sessions.social('vlad',sockets.vlad,{type:'social_propose',action:'petPet',item:'simba'});
    const invitation=packets.find((packet):packet is Extract<ServerPacket,{type:'social_pending'}>=>packet.type==='social_pending');
    assert.ok(invitation,'The invitation is allowed before attempting a route');
    sessions.social('alina',sockets.alina,{type:'social_reply',inviteId:invitation.offer.id,choice:0});
    assert.ok(packets.some(packet=>packet.type==='social_closed'&&packet.phase==='interrupted'));
    assert.equal(preparations,0,'No resident activity should be stopped');
    assert.equal(petPauses,0,'No pet routine should be interrupted');
    assert.equal(sessions.busy('vlad'),false);
    assert.equal(sessions.busy('alina'),false);
  }finally{sessions.dispose();}
});


test('Accepting a joint invitation while walking uses the freshly stopped resident position',()=>{
  const state=sample();
  const command:SocialIntent={type:'together',action:'softHug'};
  const original={x:state.characters.vlad.x,z:state.characters.vlad.z};
  let stopped:{x:number;z:number}|undefined;
  for(const [dx,dz] of [[.32,0],[-.32,0],[0,.32],[0,-.32],[.20,.20],[-.20,-.20]]){
    const candidate={x:original.x+dx,z:original.z+dz};
    Object.assign(state.characters.vlad,candidate);
    if(pointIsClear(candidate,placeObstacles('home'),floorFor('home')) && pairScenes(state,'vlad',command)){
      stopped=candidate;break;
    }
  }
  assert.ok(stopped,'A nearby safe stopping point must exist for the test');
  Object.assign(state.characters.vlad,original);
  const sockets={vlad:{readyState:WebSocket.OPEN} as WebSocket,alina:{readyState:WebSocket.OPEN} as WebSocket};
  const packets:ServerPacket[]=[];
  let next=0;
  const sessions=createHomeSessions({
    state:()=>state,
    save:()=>{},
    all:p=>packets.push(p),send:(_socket,p)=>packets.push(p),
    socket:role=>sockets[role],busy:()=>false,
    prepare:role=>{if(role==='vlad')Object.assign(state.characters.vlad,stopped);},
    nextId:()=>++next,timeScale:1,gameTime:()=>gameMinutes(state.clock),resourceBusy:()=>false,
  });
  try{
    sessions.social('vlad',sockets.vlad,{type:'social_propose',action:'softHug'});
    const invite=packets.find((p):p is Extract<ServerPacket,{type:'social_pending'}>=>p.type==='social_pending');
    assert.ok(invite);
    sessions.social('alina',sockets.alina,{type:'social_reply',inviteId:invite.offer.id,choice:0});
    assert.ok(packets.some(p=>p.type==='social_closed'&&p.phase==='accepted'));
    const began=packets.find((p):p is Extract<ServerPacket,{type:'task_started'}>=>p.type==='task_started'&&p.role==='vlad');
    assert.ok(began?.home);
    assert.deepEqual({x:began.home.route.from.x,z:began.home.route.from.z},stopped,
      'The synchronized path must start where movement actually stopped');
  }finally{sessions.dispose();}
});

test('A home evening progresses only after both complete cooking, dinner and a shared rest',()=>{
  let state=sample();
  const together=(action:string,item?:string)=>{
    const command:SocialIntent={type:'together',action,item};
    const homes=pairScenes(state,'vlad',command);
    assert.ok(homes,'a real route is required for '+action);
    const result=completeTogether(state,'vlad',command,[...residents],0,homes);
    assert.ok(result.ok,action+': '+(result.ok?'':result.reason));
    state=result.state;
  };
  together('eveningPlan','omelette');
  assert.deepEqual(state.relationship.evening,{
    recipe:'omelette',phase:'prepare',startedAt:gameMinutes(state.clock),
  });
  assert.equal(state.relationship.memories.filter(m=>m.action==='homeEvening').length,0);
  together('tv');
  assert.equal(state.relationship.evening?.phase,'prepare','relaxing before dinner cannot finish the story');
  together('cook','omelette');
  assert.equal(state.relationship.evening?.phase,'dine');
  together('tv');
  assert.equal(state.relationship.evening?.phase,'dine');
  const meals=state.meals.omelette;
  together('eat','omelette');
  assert.equal(state.meals.omelette,meals-2);
  assert.equal(state.relationship.evening?.phase,'unwind');
  together('tv');
  assert.equal(state.relationship.evening?.phase,'complete');
  assert.equal(state.relationship.evening?.completedAt,gameMinutes(state.clock));
  const memories=state.relationship.memories.filter(m=>m.action==='homeEvening');
  assert.equal(memories.length,1);
  assert.match(memories[0].description,/приготовили|поужинали/i);
  const mood=state.characters.vlad.mood;
  together('tv');
  assert.equal(state.relationship.memories.filter(m=>m.action==='homeEvening').length,1,
    'finishing a second TV action must not mint a second evening memory');
  assert.ok(state.characters.vlad.mood>=mood);
  together('eveningPlan','omelette');
  assert.equal(state.relationship.evening?.phase,'prepare','both players may choose a new evening');
  assert.equal(state.relationship.memories.filter(m=>m.action==='homeEvening').length,1);
});

test('A declined evening invitation cannot reserve food or create a shared evening',async()=>{
  const f=await meet();
  try{
    const v=await f.connect('vlad'),a=await f.connect('alina');
    const original=f.files.load();
    const offer=await propose(v,a,'eveningPlan','omelette');
    assert.equal(offer.action,'eveningPlan');
    assert.equal(f.files.load().relationship.evening,undefined);
    a.send({type:'social_reply',inviteId:offer.id,choice:null});
    assert.equal((await v.take('social_closed')).phase,'declined');
    assert.equal(f.files.load().relationship.evening,undefined);
    assert.deepEqual(f.files.load().pantry,original.pantry);
  }finally{await f.close();}
});

test('A two-phone home evening stays synchronized through every real server action',async()=>{
  const f=await meet({scale:.018});
  try{
    const v=await f.connect('vlad'),a=await f.connect('alina');
    const stages=[
      {action:'eveningPlan',item:'omelette',phase:'prepare'},
      {action:'cook',item:'omelette',phase:'dine'},
      {action:'eat',item:'omelette',phase:'unwind'},
      {action:'tv',phase:'complete'},
    ] as const;
    for(const step of stages){
      if(step.action!=='eveningPlan')await new Promise(resolve=>setTimeout(resolve,1000));
      const offer=await propose(v,a,step.action,'item' in step?step.item:undefined).catch(async error=>{
        const rejection=await v.take('error').catch(()=>undefined);
        throw new Error(step.action+': '+(rejection?.reason??String(error)));
      });
      await accept(v,a,offer.id);
      const first=await started(v,'vlad'),second=await started(v,'alina');
      assert.equal(first.command.type,'together');
      assert.equal((await ended(v,'vlad',first.taskId)).outcome,'completed');
      assert.equal((await ended(a,'alina',second.taskId)).outcome,'completed');
      assert.equal(f.files.load().relationship.evening?.phase,step.phase,step.action);
      await a.take('snapshot',packet=>packet.state.relationship.evening?.phase===step.phase);
    }
    const saved=f.files.load();
    assert.equal(saved.relationship.memories.filter(memory=>memory.action==='homeEvening').length,1);
    assert.equal(saved.meals.omelette,2,'new cooking should make two portions, then joint dining consumes two');
    assert.equal(saved.pantry.eggs,7-2,'only one ingredient set is charged for cooking');
    a.ws.close();
    await once(a.ws,'close');
    const rejoined=await f.connect('alina');
    assert.equal(rejoined.ready.state.relationship.evening?.phase,'complete');
    assert.equal(rejoined.ready.state.relationship.memories.filter(m=>m.action==='homeEvening').length,1);
  }finally{await f.close();}
});

test('An evening with fresh leftovers consumes actual portions without cooking or hidden pantry costs',()=>{
  let state=sample();
  const pantry=structuredClone(state.pantry),originalCount=state.meals.omelette;
  const together=(action:string,item?:string)=>{
    const command:SocialIntent={type:'together',action,item};
    const homes=pairScenes(state,'vlad',command);
    assert.ok(homes,action+' must have a physical route');
    const result=completeTogether(state,'vlad',command,[...residents],0,homes);
    if(!result.ok)assert.fail(action+': '+result.reason);
    state=result.state;
  };
  assert.ok(activityItems(SOCIAL_BY_ID.get('eveningPlan')!,state,'vlad')
    .some(item=>item.id==='leftovers:omelette'));
  together('eveningPlan','leftovers:omelette');
  assert.equal(state.relationship.evening?.kind,'leftovers');
  assert.equal(state.relationship.evening?.phase,'dine');
  assert.deepEqual(state.pantry,pantry,'planning leftovers does not buy or cook food');
  assert.equal(state.meals.omelette,originalCount);
  together('eat','omelette');
  assert.equal(state.meals.omelette,originalCount-2);
  assert.equal(state.relationship.evening?.phase,'unwind');
  const satiety=state.pets.simba.satiety;
  together('petPlay','simba');
  assert.equal(state.relationship.evening?.phase,'complete');
  assert.equal(state.relationship.memories.filter(m=>m.action==='homeEvening').length,1);
  assert.match(state.relationship.memories.find(m=>m.action==='homeEvening')!.description,/готовым блюдом/);
  assert.deepEqual(state.pantry,pantry);
  assert.ok(state.pets.simba.satiety<=satiety,'pet care still uses the genuine pet state');
});

test('A takeout evening uses real delivered servings and heartfelt talk, not extra money or food',()=>{
  let state=sample();
  state.readyFood=[];state.meals.omelette=0;state.takeout.pizzaCheese=2;
  addReadyFood(state,'takeout','pizzaCheese',2,'table');
  state.characters.alina.mood=25;
  const money=state.money,pantry=structuredClone(state.pantry);
  const together=(action:string,item?:string)=>{
    const command:SocialIntent={type:'together',action,item};
    const homes=pairScenes(state,'vlad',command);
    assert.ok(homes,action);
    const result=completeTogether(state,'vlad',command,[...residents],0,homes);
    if(!result.ok)assert.fail(action+': '+result.reason);
    state=result.state;
  };
  const options=activityItems(SOCIAL_BY_ID.get('eveningPlan')!,state,'vlad');
  assert.ok(options.some(item=>item.id==='takeout:pizzaCheese'));
  together('eveningPlan','takeout:pizzaCheese');
  assert.equal(state.relationship.evening?.kind,'takeout');
  assert.equal(state.relationship.evening?.phase,'dine');
  assert.equal(state.relationship.evening?.attentionTo,'alina');
  assert.equal(state.relationship.evening?.occasion,'comfort');
  assert.equal(state.takeout.pizzaCheese,2);
  together('takeout','pizzaCheese');
  assert.equal(state.takeout.pizzaCheese,0);
  assert.equal(state.relationship.evening?.phase,'unwind');
  together('eveningHeartTalk');
  assert.equal(state.relationship.evening?.phase,'complete');
  assert.equal(state.relationship.memories.filter(m=>m.action==='homeEvening').length,1);
  const memory=state.relationship.memories.find(m=>m.action==='homeEvening')!;
  assert.match(memory.description,/доставку/);
  assert.match(memory.description,/поддержать Алину/);
  assert.equal(state.money,money,'no additional delivery purchase is silently charged');
  assert.deepEqual(state.pantry,pantry);
  assert.equal(state.dirtyDishes.table,2);
});

test('Fake evening selections, expired food and malformed saved plans cannot mint dinner rewards',()=>{
  const state=sample();
  const relationships=structuredClone(state.relationship);
  const fake:SocialIntent={type:'together',action:'eveningPlan',item:'takeout:nonexistent'};
  const homes=pairScenes(state,'vlad',fake);
  assert.ok(homes);
  const rejected=completeTogether(state,'vlad',fake,[...residents],0,homes);
  assert.equal(rejected.ok,false);
  assert.deepEqual(state.relationship,relationships);
  const old={...relationships,evening:{recipe:'omelette',phase:'prepare',startedAt:0}};
  assert.equal(validRelationship(old),true,'the first 0.26 evening save remains compatible');
  assert.equal(validRelationship({...relationships,evening:{kind:'takeout',recipe:'omelette',phase:'dine',startedAt:0}}),false);
  assert.equal(validRelationship({...relationships,evening:{kind:'leftovers',recipe:'nope',phase:'dine',startedAt:0}}),false);
  assert.equal(validRelationship({...relationships,evening:{kind:'takeout',takeoutItem:'pizzaCheese',phase:'prepare',startedAt:0}}),false);
  state.relationship.evening={kind:'leftovers',recipe:'omelette',phase:'dine',startedAt:gameMinutes(state.clock)};
  state.readyFood[0].expiresAt=gameMinutes(state.clock);
  assert.equal(activityItems(SOCIAL_BY_ID.get('eveningPlan')!,state,'vlad')
    .some(item=>item.id==='leftovers:omelette'),false);
  const eat:SocialIntent={type:'together',action:'eat',item:'omelette'};
  const mealHomes=pairScenes(state,'vlad',eat)!;
  const badMeal=completeTogether(state,'vlad',eat,[...residents],0,mealHomes);
  assert.equal(badMeal.ok,false);
  assert.equal(state.relationship.evening.phase,'dine');
  assert.equal(state.meals.omelette,2);
  assert.equal(state.relationship.memories.length,0);
});

test('The ending bonus and special memory cannot be farmed by repeating evenings immediately',()=>{
  let state=sample();
  const together=(action:string,item?:string)=>{
    const intent:SocialIntent={type:'together',action,item};
    const homes=pairScenes(state,'vlad',intent)!;
    const result=completeTogether(state,'vlad',intent,[...residents],0,homes);
    if(!result.ok)assert.fail(result.reason);
    state=result.state;
  };
  for(let i=0;i<2;i++){
    if(i===1){
      state.meals.omelette=2;state.readyFood=[];
      addReadyFood(state,'meal','omelette',2,'table');
    }
    together('eveningPlan','leftovers:omelette');
    together('eat','omelette');
    together('tv');
  }
  assert.equal(state.relationship.evening?.phase,'complete');
  assert.equal(state.relationship.memories.filter(m=>m.action==='homeEvening').length,1);
});
