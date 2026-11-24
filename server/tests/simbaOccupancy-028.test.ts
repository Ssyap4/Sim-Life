import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {once} from 'node:events';
import WebSocket from 'ws';
import {initialState,type CharacterId,type GameState,type ServerPacket} from '../../src/shared/protocol';
import {catPerchCandidates} from '../../src/shared/CatPerches';
import {CAT_BLOCKED,CAT_DESCENDING,catSeatError,catBlockingPerch,catSeatOverlap} from '../../src/shared/catOccupancy';
import {selectSleepBed} from '../../src/shared/bedSleep';
import {gameMinutes} from '../../src/shared/life';
import {yieldSimbaFurniture,applyPetAction} from '../pets';
import {evaluateTask} from '../tasks';
import {planLeisure} from '../home';
import {startServer} from '../server';
import {openServerFiles} from '../storage';

function perch(state:GameState,key:string){
  const site=catPerchCandidates(state.furnishing).find(p=>p.key===key)!;
  assert.ok(site);
  const now=gameMinutes(state.clock);
  Object.assign(state.pets.simba,{satiety:95,energy:95,bladder:95,position:site.approach,
    routine:{kind:'perch',target:0,startedAt:now,until:now+40,route:{from:site.approach,path:[]},perch:site}});
  return site;
}
test('sleep conflicts with a real cat; dismount is idempotent and eventually releases the bed',()=>{
  const state=initialState(),site=perch(state,'starter:bed'),now=gameMinutes(state.clock);
  for(const role of ['vlad','alina'] as const){
    assert.deepEqual(selectSleepBed(state,role),{ok:false,reason:CAT_BLOCKED});
    assert.deepEqual(evaluateTask(state,role,{type:'act',actionId:'bedNap'}),{ok:false,reason:CAT_BLOCKED});
  }
  const moved=yieldSimbaFurniture(state,'vlad',site.key,now);
  assert.ok(moved.ok);
  assert.deepEqual(moved.state.pets.simba.position,site.approach);
  assert.equal(moved.state.pets.simba.routine?.kind,'come');
  assert.deepEqual(selectSleepBed(moved.state,'alina'),{ok:false,reason:CAT_DESCENDING});
  const repeat=yieldSimbaFurniture(moved.state,'alina',site.key,now);
  assert.ok(repeat.ok);
  assert.equal(repeat.state,moved.state);
  moved.state.clock.minute+=5;
  assert.equal(selectSleepBed(moved.state,'alina').ok,true);
  assert.ok(moved.state.pets.simba.furnitureYield!.cooldownUntil>gameMinutes(moved.state.clock));
  const command=applyPetAction(moved.state,'vlad','simba','perch');
  if(command.ok)assert.notEqual(command.state.pets.simba.routine?.perch?.key,site.key);
});
test('rotated purchased chair is blocked; unrelated items, sold/moved fixtures and independent seats are not',()=>{
  const state=initialState();
  state.furnishing.placed=[{id:41,sku:'chair-cloud',finish:'sage',x:2.45,z:2.1,rotation:1}];
  const site=perch(state,'placed:41');
  assert.equal(catSeatError(state,site.key,site.surface),CAT_BLOCKED);
  assert.equal(catSeatOverlap(site,site.key,{x:site.surface.x+1.1,z:site.surface.z}),false);
  assert.equal(catSeatError(state,'starter:sofa'),undefined);
  assert.equal(selectSleepBed(state,'vlad').ok,true);
  state.furnishing.placed[0].x+=.5;
  assert.equal(catBlockingPerch(state),null);
  perch(state,'starter:sofa');
  assert.equal(planLeisure(state,'vlad','tv'),null);
  state.furnishing.soldFixtures=['sofa'];
  assert.equal(catBlockingPerch(state),null);
});
async function client(port:number,role:CharacterId,code:string){
  const ws=new WebSocket('ws://127.0.0.1:'+port+'/sync');
  const received:ServerPacket[]=[];
  ws.on('message',r=>received.push(JSON.parse(r.toString())));
  await once(ws,'open');
  const send=(p:object)=>ws.send(JSON.stringify(p));
  async function take<T extends ServerPacket['type']>(type:T,where:(p:Extract<ServerPacket,{type:T}>)=>boolean=()=>true){
    const end=Date.now()+8000;
    while(Date.now()<end){
      const i=received.findIndex(p=>p.type===type&&where(p as Extract<ServerPacket,{type:T}>));
      if(i>=0)return received.splice(i,1)[0] as Extract<ServerPacket,{type:T}>;
      await new Promise(r=>setTimeout(r,15));
    }
    throw Error('Missing '+type+'; received '+JSON.stringify(received.map(p=>p.type==='error'?p:p.type)));
  }
  send({type:'auth',role,code});await take('ready');
  return {ws,send,take,received};
}
test('two real websocket clients cannot start occupied-bed sleep; release and duplicate request synchronize',async()=>{
  const dir=mkdtempSync(join(tmpdir(),'simba-occupancy-')),files=openServerFiles(dir),state=files.load();
  const site=perch(state,'starter:bed');
  state.characters.vlad.energy=20;state.characters.alina.energy=20;
  files.save(state);
  const server=await startServer({port:0,dataDir:dir,taskTimeScale:.05,lifeClock:{now:Date.now,tickMs:600000},
    autonomyTiming:{idleMs:99999999,careCooldownMs:99999999,leisureCooldownMs:99999999}});
  const sockets:WebSocket[]=[];
  try{
    const v=await client(server.port,'vlad',files.access.vlad);sockets.push(v.ws);
    const a=await client(server.port,'alina',files.access.alina);sockets.push(a.ws);
    v.send({type:'sleep_start',mode:'full'});a.send({type:'sleep_start',mode:'half'});
    assert.equal((await v.take('error')).reason,CAT_BLOCKED);
    assert.equal((await a.take('error')).reason,CAT_BLOCKED);
    v.send({type:'simba_yield',key:site.key});a.send({type:'simba_yield',key:site.key});
    const [sv,sa]=await Promise.all([v.take('snapshot',p=>!!p.state.pets.simba.furnitureYield),a.take('snapshot',p=>!!p.state.pets.simba.furnitureYield)]);
    assert.deepEqual(sv,sa);
    a.send({type:'sleep_start',mode:'half'});
    assert.equal((await a.take('error')).reason,CAT_DESCENDING);
    await Promise.all([v.take('snapshot',p=>!!p.state.pets.simba.furnitureYield&&!catBlockingPerch(p.state)),a.take('snapshot',p=>!!p.state.pets.simba.furnitureYield&&!catBlockingPerch(p.state))]);
    a.send({type:'sleep_start',mode:'half'});
    await v.take('snapshot',p=>p.state.characters.alina.pose==='sleep');
    await a.take('snapshot',p=>p.state.characters.alina.pose==='sleep');
  }finally{for(const ws of sockets)ws.terminate();await server.close();rmSync(dir,{recursive:true,force:true});}
});
test('sofa session and delayed queued sofa action cannot bypass the same server guard',async()=>{
  const dir=mkdtempSync(join(tmpdir(),'simba-sofa-')),files=openServerFiles(dir),state=files.load();
  perch(state,'starter:sofa');files.save(state);
  const server=await startServer({port:0,dataDir:dir,taskTimeScale:.015,lifeClock:{now:Date.now,tickMs:600000},autonomyTiming:{idleMs:99999999,careCooldownMs:99999999,leisureCooldownMs:99999999}});
  let ws:WebSocket|undefined;
  try{
    const c=await client(server.port,'vlad',files.access.vlad);ws=c.ws;
    c.send({type:'free_tv'});assert.equal((await c.take('error')).reason,CAT_BLOCKED);
    c.send({type:'act',actionId:'vladOrder'});const first=await c.take('task_started');
    c.send({type:'act',actionId:'sofaRest'});await c.take('task_queue',p=>p.tasks.length===1);
    await c.take('task_ended',p=>p.taskId===first.taskId);
    assert.equal((await c.take('error')).reason,CAT_BLOCKED);
    assert.equal(c.received.some(p=>p.type==='task_started'),false);
  }finally{ws?.terminate();await server.close();rmSync(dir,{recursive:true,force:true});}
});
