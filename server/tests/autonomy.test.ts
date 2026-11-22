import { test } from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import WebSocket, { type RawData } from 'ws';
import { INITIAL_AUTONOMY, autonomyCandidates, thoughtFor, validAutonomy } from '../../src/shared/autonomy';
import { furnitureUseLocation } from '../../src/shared/furnitureUse';
import { leisureDurationMs, planLeisure } from '../home';
import { initialState, type CharacterId, type GameState, type ServerPacket } from '../../src/shared/protocol';
import { openServerFiles } from '../storage';
import { startServer } from '../server';

function waitFor(ws:WebSocket,accepted:(packet:ServerPacket)=>boolean,timeoutMs=4000):Promise<ServerPacket>{
  return new Promise((resolve,reject)=>{
    const timer=setTimeout(()=>{ws.off('message',received);reject(new Error('Timed out waiting for expected autonomy packet'));},timeoutMs);
    function received(raw:RawData){
      const packet=JSON.parse(raw.toString()) as ServerPacket;
      if(!accepted(packet))return;
      clearTimeout(timer);ws.off('message',received);resolve(packet);
    }
    ws.on('message',received);
  });
}
async function enter(port:number,role:CharacterId,code:string):Promise<WebSocket>{
  const ws=new WebSocket('ws://127.0.0.1:'+port+'/sync');
  await once(ws,'open');
  const promise=waitFor(ws,p=>p.type==='ready'||p.type==='error');
  ws.send(JSON.stringify({type:'auth',role,code}));
  assert.equal((await promise).type,'ready');
  return ws;
}
async function setup(seed?:GameState,fast=false,idleMs=60){
  const dir=mkdtempSync(join(tmpdir(),'sim-life-017-autonomy-'));
  if(seed)openServerFiles(dir).save(seed);
  const clock={now:0};
  const ticking=fast?setInterval(()=>{clock.now+=2400;},20):undefined;
  const server=await startServer({port:0,dataDir:dir,taskTimeScale:.08,
    ...(fast?{lifeClock:{now:()=>clock.now,tickMs:20},
      autonomyTiming:{idleMs,careCooldownMs:120,leisureCooldownMs:200}}:{})});
  const keys=JSON.parse(readFileSync(join(dir,'access.json'),'utf-8')) as Record<CharacterId,string>;
  const sockets:WebSocket[]=[];
  return {
    dir,server,keys,sockets,
    async join(role:CharacterId){const ws=await enter(server.port,role,keys[role]);sockets.push(ws);return ws;},
    async close(){if(ticking)clearInterval(ticking);for(const ws of sockets)ws.terminate();await server.close();
      rmSync(dir,{recursive:true,force:true});},
  };
}
function send(ws:WebSocket,packet:object){ws.send(JSON.stringify(packet));}

test('Old 0.16 households migrate to autonomy off for BOTH residents without changing family',()=>{
  const state=initialState();
  assert.deepEqual(state.autonomy,INITIAL_AUTONOMY);
  assert.equal(validAutonomy({vlad:'full',alina:'needs'}),true);
  assert.equal(validAutonomy({vlad:'all',alina:'needs'}),false);
  assert.equal(validAutonomy({vlad:'full',alina:'needs',guest:'full'}),false);
  const legacy=structuredClone(state) as Partial<GameState>;
  delete legacy.autonomy;
  const dir=mkdtempSync(join(tmpdir(),'sim-life-017-save-'));
  try{
    openServerFiles(dir);
    writeFileSync(join(dir,'household.json'),JSON.stringify(legacy));
    const loaded=openServerFiles(dir).load();
    assert.deepEqual(loaded.autonomy,INITIAL_AUTONOMY);
    assert.equal(loaded.money,legacy.money);
    assert.deepEqual(loaded.pantry,legacy.pantry);
    assert.deepEqual(loaded.characters,legacy.characters);
  }finally{rmSync(dir,{recursive:true,force:true});}
});

test('Three modes: off does nothing; care uses existing real tasks; full adds preferences, never shopping',()=>{
  const state=initialState();
  state.characters.vlad.hunger=18;
  state.characters.vlad.energy=70;
  state.meals.omelette=2;
  assert.deepEqual(autonomyCandidates(state,'vlad'),[]);
  state.autonomy.vlad='needs';
  const eat=autonomyCandidates(state,'vlad');
  assert.equal(eat[0].command.type,'eat');
  assert.equal(eat[0].need,'hunger');
  assert.equal(autonomyCandidates(state,'alina').length,0);
  state.meals.omelette=0;
  state.pantry.eggs=0;
  state.pantry.bread=0;
  assert.equal(autonomyCandidates(state,'vlad').some(x=>['buy','checkout','travel'].includes(x.command.type)),false);
  state.characters.vlad.hunger=80;
  state.characters.vlad.fun=22;
  assert.equal(autonomyCandidates(state,'vlad').some(x=>x.command.type==='pet_action'),false);
  state.autonomy.vlad='full';
  assert.ok(autonomyCandidates(state,'vlad').some(x=>x.command.type==='pet_action'));
});

test('Personal wishes vary by resident and reflect real physical needs',()=>{
  const state=initialState();
  Object.assign(state.characters.vlad,{bladder:11,hunger:92,energy:95});
  Object.assign(state.characters.alina,{bladder:95,hunger:15,energy:99});
  assert.equal(thoughtFor(state,'vlad').need,'bladder');
  assert.equal(thoughtFor(state,'alina').need,'hunger');
  assert.notEqual(thoughtFor(state,'vlad').text,thoughtFor(state,'alina').text);
});

test('Only the authenticated resident can set their mode; mode persists after restart',async()=>{
  const ctx=await setup();
  try{
    const vlad=await ctx.join('vlad');
    const alina=await ctx.join('alina');
    const both=[waitFor(vlad,p=>p.type==='snapshot'&&p.state.autonomy.vlad==='full'),
      waitFor(alina,p=>p.type==='snapshot'&&p.state.autonomy.vlad==='full')];
    send(vlad,{type:'autonomy_mode',role:'alina',mode:'full'});
    const results=await Promise.all(both);
    for(const event of results)if(event.type==='snapshot')assert.deepEqual(event.state.autonomy,{vlad:'full',alina:'off'});
    const invalid=waitFor(vlad,p=>p.type==='error');
    send(vlad,{type:'autonomy_mode',mode:'magic'});
    assert.match((await invalid as Extract<ServerPacket,{type:'error'}>).reason,/Неизвестный режим/);
    const next=waitFor(alina,p=>p.type==='snapshot'&&p.state.autonomy.alina==='needs');
    send(alina,{type:'autonomy_mode',mode:'needs'});await next;
    const saved=openServerFiles(ctx.dir).load();
    assert.deepEqual(saved.autonomy,{vlad:'full',alina:'needs'});
  }finally{await ctx.close();}
});

test('Default off prevents legacy unsolicited chores; turning on care triggers an actual task',async()=>{
  const seed=initialState();
  seed.characters.vlad.bladder=12;
  const ctx=await setup(seed,true);
  try{
    const ws=await ctx.join('vlad');
    const messages:ServerPacket[]=[];
    ws.on('message',raw=>messages.push(JSON.parse(raw.toString()) as ServerPacket));
    await new Promise(resolve=>setTimeout(resolve,300));
    assert.equal(messages.some(p=>p.type==='task_started'),false,'Off means no automatic chores');
    const start=waitFor(ws,p=>p.type==='task_started'&&p.role==='vlad'&&p.automatic===true,4500);
    send(ws,{type:'autonomy_mode',mode:'needs'});
    const task=await start;
    if(task.type!=='task_started')return;
    assert.equal(task.command.type,'act');
    if(task.command.type==='act')assert.equal(task.command.actionId,'toiletUse');
    const finish=waitFor(ws,p=>p.type==='task_ended'&&p.taskId===task.taskId);
    const outcome=await finish;
    if(outcome.type==='task_ended')assert.equal(outcome.outcome,'completed');
    assert.ok(openServerFiles(ctx.dir).load().characters.vlad.bladder>=99,
      'Normal passage of time may drain a fraction immediately after toilet use');
  }finally{await ctx.close();}
});

test('Manual instruction preempts an automatic chore; switching off cancels autonomy immediately',async()=>{
  const seed=initialState();
  seed.characters.vlad.bladder=12;
  const ctx=await setup(seed,true);
  try{
    const ws=await ctx.join('vlad');
    const first=waitFor(ws,p=>p.type==='task_started'&&p.automatic===true,4500);
    send(ws,{type:'autonomy_mode',mode:'needs'});
    const task=await first;
    if(task.type!=='task_started')return;
    const cancelled=waitFor(ws,p=>p.type==='task_ended'&&p.taskId===task.taskId);
    const manual=waitFor(ws,p=>p.type==='task_started'&&p.automatic!==true&&p.role==='vlad');
    send(ws,{type:'act',actionId:'kitchenWash'});
    const [end,start]=await Promise.all([cancelled,manual]);
    if(end.type==='task_ended')assert.equal(end.outcome,'cancelled');
    if(start.type==='task_started')assert.equal(start.command.type,'act');
    const off=waitFor(ws,p=>p.type==='snapshot'&&p.state.autonomy.vlad==='off');
    send(ws,{type:'autonomy_mode',mode:'off'});await off;
    assert.equal(openServerFiles(ctx.dir).load().autonomy.vlad,'off');
  }finally{await ctx.close();}
});

test('Full autonomy performs harmless leisure without spending money and yields to manual play',async()=>{
  const seed=initialState();
  seed.autonomy.vlad='full';
  const ctx=await setup(seed,true);
  try{
    const ws=await ctx.join('vlad');
    const leisure=await waitFor(ws,p=>p.type==='home_leisure'&&p.activity!==null,4200);
    assert.equal(leisure.type,'home_leisure');
    if(leisure.type!=='home_leisure')return;
    assert.deepEqual(leisure.roles,['vlad']);
    assert.ok(['tv','computer','simba','verdell'].includes(leisure.activity??''));
    assert.equal(openServerFiles(ctx.dir).load().money,seed.money);
    const stopped=waitFor(ws,p=>p.type==='home_leisure'&&p.activity===null);
    const started=waitFor(ws,p=>p.type==='task_started'&&p.role==='vlad');
    send(ws,{type:'act',actionId:'kitchenWash'});
    await Promise.all([stopped,started]);
    assert.equal(openServerFiles(ctx.dir).load().money,seed.money);
    const disabled=waitFor(ws,p=>p.type==='snapshot'&&p.state.autonomy.vlad==='off');
    send(ws,{type:'autonomy_mode',mode:'off'});
    await disabled;
  }finally{await ctx.close();}
});

test('Shared spontaneous conversation requires both residents in full mode and stops when either takes control',async()=>{
  const seed=initialState();
  seed.autonomy={vlad:'full',alina:'full'};
  // Give both browser clients time to connect before the first idle decision.
  const ctx=await setup(seed,true,200);
  try{
    const vlad=await ctx.join('vlad');
    const alina=await ctx.join('alina');
    const started=waitFor(vlad,p=>p.type==='home_leisure'&&p.activity==='chat',4200);
    const event=await started;
    if(event.type!=='home_leisure')return;
    assert.deepEqual(event.roles,['vlad','alina']);
    assert.ok(event.routes.vlad&&event.routes.alina);
    const stopped=waitFor(alina,p=>p.type==='home_leisure'&&p.activity===null);
    send(alina,{type:'act',actionId:'kitchenWash'});
    const cancellation=await stopped;
    if(cancellation.type==='home_leisure')assert.deepEqual(cancellation.roles,['alina','vlad']);
    assert.equal(openServerFiles(ctx.dir).load().money,seed.money);
  }finally{await ctx.close();}
});

test('Autonomous sleep uses a purchased real bed and disabling autonomy wakes the resident',async()=>{
  const seed=initialState();
  seed.autonomy.vlad='needs';
  seed.furnishing.soldFixtures=['bed'];
  seed.furnishing.placed=[{id:1,sku:'bed-aurora',finish:'sage',x:-6.97,z:-5.88,rotation:0}];
  seed.furnishing.nextId=2;
  seed.characters.vlad.energy=15;
  const ctx=await setup(seed,true);
  try{
    const ws=await ctx.join('vlad');
    const asleep=waitFor(ws,p=>p.type==='snapshot'&&p.state.characters.vlad.pose==='sleep',4300);
    const event=await asleep;
    if(event.type!=='snapshot')return;
    assert.equal(event.state.characters.vlad.sleepingOn,1);
    assert.equal(event.state.characters.vlad.sleepMode,'half');
    const awake=waitFor(ws,p=>p.type==='snapshot'&&p.state.autonomy.vlad==='off'&&
      p.state.characters.vlad.pose==='idle',4300);
    send(ws,{type:'autonomy_mode',mode:'off'});
    await awake;
    assert.equal(openServerFiles(ctx.dir).load().characters.vlad.pose,'idle');
  }finally{await ctx.close();}
});

test('When old sofa and desktop are sold, autonomy selects an actual installed replacement',()=>{
  const state=initialState();
  state.autonomy.vlad='full';
  state.furnishing.soldFixtures=['sofa','desk'];
  state.furnishing.placed=[
    {id:1,sku:'sofa-luna',finish:'sage',x:-2.35,z:2.02,rotation:0},
    {id:2,sku:'desk-large',finish:'sage',x:7.2,z:-6.7,rotation:0},
  ];
  state.characters.vlad.fun=22;
  const actions=autonomyCandidates(state,'vlad');
  assert.ok(actions.every(x=>x.command.type!=='act'||x.command.actionId!=='deskGames'),
    'Never use an invisible old desk');
  assert.ok(actions.some(x=>x.command.type==='furniture_use'), 'Prefer a real replacement station');
});

test('A sold original bookshelf does not prevent using a purchased shelf for autonomous reading',()=>{
  const state=initialState();
  state.autonomy.alina='full';
  state.characters.alina.fun=20;
  state.furnishing.soldFixtures=['bookcase'];
  state.furnishing.placed=[{id:19,sku:'shelf-open',finish:'sage',x:8.97,z:-4.49,rotation:0}];
  const choices=autonomyCandidates(state,'alina');
  assert.ok(choices.some(({command})=>command.type==='furniture_use'&&
    command.furnitureId===19&&command.action==='read_book'));
  assert.ok(choices.every(({command})=>command.type!=='read_book'),
    'Never select an invisible sold bookshelf');
});

test('Off keeps the 0.16 occasional autonomous leisure instead of freezing the house',async()=>{
  const ctx=await setup(undefined,true);
  try{
    const ws=await ctx.join('vlad');
    const event=await waitFor(ws,p=>p.type==='home_leisure'&&p.activity!==null,4300);
    if(event.type!=='home_leisure')return;
    assert.deepEqual(event.roles,['vlad']);
    assert.ok(['tv','computer','simba','verdell'].includes(event.activity??''));
    assert.equal(openServerFiles(ctx.dir).load().autonomy.vlad,'off');
    assert.equal(openServerFiles(ctx.dir).load().money,10000);
  }finally{await ctx.close();}
});

test('Off still rescues a genuinely critical need using the old 8% rule',async()=>{
  const seed=initialState();
  seed.characters.vlad.bladder=7;
  const ctx=await setup(seed,true);
  try{
    const ws=await ctx.join('vlad');
    const task=await waitFor(ws,p=>p.type==='task_started'&&p.automatic===true,4300);
    if(task.type!=='task_started')return;
    assert.equal(task.command.type,'act');
    if(task.command.type==='act')assert.equal(task.command.actionId,'toiletUse');
    const finished=await waitFor(ws,p=>p.type==='task_ended'&&p.taskId===task.taskId,4300);
    if(finished.type==='task_ended')assert.equal(finished.outcome,'completed');
    assert.equal(openServerFiles(ctx.dir).load().autonomy.vlad,'off');
    assert.equal(openServerFiles(ctx.dir).load().money,seed.money);
  }finally{await ctx.close();}
});

test('Explicit passwordless previews use isolated saves, while the production port stays protected',async()=>{
  const dir=mkdtempSync(join(tmpdir(),'sim-life-017-no-code-'));
  try{
    await assert.rejects(startServer({port:3111,host:'0.0.0.0',dataDir:dir,testNoCodes:true}),
      /Passwordless test mode/);
    const preview=await startServer({port:0,host:'127.0.0.1',dataDir:dir,testNoCodes:true});
    let ws:WebSocket|undefined;
    try{
      const health=await fetch('http://127.0.0.1:'+preview.port+'/health');
      assert.equal(health.ok,true);
      assert.equal((await health.json() as {testNoCodes:boolean}).testNoCodes,true);
      ws=await enter(preview.port,'vlad','TEST-LOCAL-NO-CODES');
      assert.equal(ws.readyState,WebSocket.OPEN);
    }finally{
      ws?.terminate();
      await preview.close();
    }
  }finally{rmSync(dir,{recursive:true,force:true});}
});

test('Autonomous leisure approaches real installed replacement furniture',()=>{
  const state=initialState();
  state.furnishing.soldFixtures=['sofa','desk'];
  state.furnishing.placed=[
    {id:1,sku:'sofa-luna',finish:'sage',x:-2.35,z:2.02,rotation:0},
    {id:2,sku:'desk-large',finish:'sage',x:7.2,z:-6.7,rotation:0},
  ];
  state.furnishing.nextId=3;
  for(const [activity,id,action] of [
    ['tv',1,'free_tv'],['computer',2,'deskGames'],
  ] as const){
    const expected=furnitureUseLocation(state,'vlad',id,action);
    const leisure=planLeisure(state,'vlad',activity);
    assert.ok(expected,'Purchased furniture must be reachable for '+activity);
    assert.deepEqual(leisure,expected.route,'Leisure must use real furniture coordinates');
  }
  assert.ok(planLeisure(state,'vlad','computer'),'A real purchased desk remains usable');
});

test('Downgrading full autonomy stops spontaneous leisure without disabling basic care',async()=>{
  const seed=initialState();
  seed.autonomy.vlad='full';
  const ctx=await setup(seed,true);
  try{
    const ws=await ctx.join('vlad');
    await waitFor(ws,p=>p.type==='home_leisure'&&p.roles.includes('vlad')&&p.activity!==null,4500);
    const stopped=waitFor(ws,p=>p.type==='home_leisure'&&p.activity===null);
    const changed=waitFor(ws,p=>p.type==='snapshot'&&p.state.autonomy.vlad==='needs');
    send(ws,{type:'autonomy_mode',mode:'needs'});
    await Promise.all([stopped,changed]);
    assert.equal(openServerFiles(ctx.dir).load().autonomy.vlad,'needs');
  }finally{await ctx.close();}
});

test('Long-distance autonomous leisure lasts long enough to walk and perform the activity',()=>{
  assert.equal(leisureDurationMs({from:{x:0,z:0},path:[]}),16000);
  const route={from:{x:0,z:0},path:[{x:0,z:15},{x:15,z:15}]};
  const duration=leisureDurationMs(route);
  assert.ok(duration>26000,'A long trip needs walking time plus leisure time');
  assert.ok(duration>=30000/1.8+10000);
});
