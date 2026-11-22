import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import WebSocket from 'ws';
import { initialState, type ServerPacket } from '../../src/shared/protocol';
import { startServer } from '../server';
import { openServerFiles } from '../storage';

async function client(port:number, code:string) {
  const socket=new WebSocket('ws://127.0.0.1:'+port+'/sync');
  const received:ServerPacket[]=[];
  socket.on('message',raw=>received.push(JSON.parse(raw.toString()) as ServerPacket));
  await new Promise<void>((resolve,reject)=>{socket.once('open',resolve);socket.once('error',reject);});
  const send=(message:object)=>socket.send(JSON.stringify(message));
  async function take<T extends ServerPacket['type']>(type:T,
    where:(event:Extract<ServerPacket,{type:T}>)=>boolean=()=>true,
    timeout=10000):Promise<Extract<ServerPacket,{type:T}>>{
    const end=Date.now()+timeout;
    while(Date.now()<end){
      const index=received.findIndex(msg=>msg.type===type&&where(msg as Extract<ServerPacket,{type:T}>));
      if(index!==-1)return received.splice(index,1)[0] as Extract<ServerPacket,{type:T}>;
      await new Promise(r=>setTimeout(r,10));
    }
    throw Error('No '+type+' matching predicate; seen '+received.map(v=>v.type).join(','));
  }
  send({type:'auth',role:'vlad',code});
  await take('ready');
  return {send,take,socket,received};
}
async function fixture(fn:(ctx:Awaited<ReturnType<typeof client>>)=>Promise<void>,state=initialState()){
  const dir=mkdtempSync(join(tmpdir(),'simlife-queue-'));
  const files=openServerFiles(dir);
  files.save(state);
  const server=await startServer({port:0,dataDir:dir,taskTimeScale:.015,
    autonomyTiming:{idleMs:99999999,careCooldownMs:99999999,leisureCooldownMs:99999999}});
  let c:Awaited<ReturnType<typeof client>>|undefined;
  try{c=await client(server.port,files.access.vlad);await fn(c);}
  finally{c?.socket.terminate();await server.close();rmSync(dir,{recursive:true,force:true});}
}

test('up to three serial tasks: queued actions start after predecessor finishes, never overlap',async()=>{
  await fixture(async c=>{
    c.send({type:'act',actionId:'vladOrder'});
    const first=await c.take('task_started',p=>p.role==='vlad'&&p.command.type==='act');
    c.send({type:'act',actionId:'vladOrder'});
    await c.take('task_queue',p=>p.role==='vlad'&&p.tasks.length===1);
    c.send({type:'act',actionId:'vladOrder'});
    const queued=await c.take('task_queue',p=>p.role==='vlad'&&p.tasks.length===2);
    assert.equal(queued.tasks.length,2);
    assert.notEqual(queued.tasks[0].id,queued.tasks[1].id);
    c.send({type:'act',actionId:'vladOrder'});
    const blocked=await c.take('error',p=>p.reason.includes('максимум 3'));
    assert.match(blocked.reason,/максимум 3/);
    const completed=[first.taskId];
    await c.take('task_ended',p=>p.taskId===first.taskId&&p.outcome==='completed');
    const second=await c.take('task_started',p=>p.role==='vlad'&&p.taskId!==first.taskId);
    assert.notEqual(second.taskId,first.taskId);
    await c.take('task_ended',p=>p.taskId===second.taskId&&p.outcome==='completed');
    const third=await c.take('task_started',p=>p.role==='vlad'&&p.taskId!==second.taskId&&p.taskId!==first.taskId);
    await c.take('task_ended',p=>p.taskId===third.taskId&&p.outcome==='completed');
    completed.push(second.taskId,third.taskId);
    assert.equal(new Set(completed).size,3);
  });
});

test('delete a waiting action and clear remaining queue without cancelling the active task',async()=>{
  await fixture(async c=>{
    c.send({type:'act',actionId:'vladOrder'});
    const first=await c.take('task_started',p=>p.role==='vlad'&&p.command.type==='act');
    c.send({type:'act',actionId:'vladOrder'});
    await c.take('task_queue',p=>p.tasks.length===1);
    c.send({type:'act',actionId:'vladOrder'});
    const pending=await c.take('task_queue',p=>p.tasks.length===2);
    c.send({type:'cancel_queued_task',queueId:pending.tasks[0].id});
    const one=await c.take('task_queue',p=>p.tasks.length===1);
    assert.equal(one.tasks[0].id,pending.tasks[1].id);
    c.send({type:'clear_task_queue'});
    await c.take('task_queue',p=>p.tasks.length===0);
    await c.take('task_ended',p=>p.taskId===first.taskId&&p.outcome==='completed');
    await new Promise(r=>setTimeout(r,200));
    assert.equal(c.received.filter(p=>p.type==='task_started'&&p.role==='vlad'&&p.taskId!==first.taskId).length,0);
  });
});

test('queue crosses the home cooking and generic task engines; food is committed once per recipe',async()=>{
  const state=initialState();
  state.pantry.bread=5;
  state.pantry.cheese=2;
  await fixture(async c=>{
    c.send({type:'cook',recipe:'toast'});
    const cook=await c.take('task_started',p=>p.command.type==='cook');
    c.send({type:'act',actionId:'vladOrder'});
    await c.take('task_queue',p=>p.tasks.length===1);
    c.send({type:'cook',recipe:'toast'});
    await c.take('task_queue',p=>p.tasks.length===2);
    await c.take('task_ended',p=>p.taskId===cook.taskId&&p.outcome==='completed');
    const second=await c.take('task_started',p=>p.command.type==='act');
    await c.take('task_ended',p=>p.taskId===second.taskId&&p.outcome==='completed');
    const third=await c.take('task_started',p=>p.command.type==='cook'&&p.taskId!==cook.taskId);
    await c.take('task_ended',p=>p.taskId===third.taskId&&p.outcome==='completed');
    const latest=await c.take('snapshot',p=>p.state.meals.toast===4);
    assert.equal(latest.state.readyFood.filter(b=>b.item==='toast').reduce((s,b)=>s+b.portions,0),4);
  },state);
});

test('a queued sleep runs after a timed task and releases the next task on waking',async()=>{
  const state=initialState();
  state.characters.vlad.energy=24;
  await fixture(async c=>{
    c.send({type:'act',actionId:'vladOrder'});
    const first=await c.take('task_started',p=>p.command.type==='act'&&p.role==='vlad');
    c.send({type:'sleep_start',mode:'half'});
    const one=await c.take('task_queue',p=>p.tasks.length===1);
    assert.match(one.tasks[0].label,/Вздремнуть/);
    c.send({type:'act',actionId:'tablePlan'});
    await c.take('task_queue',p=>p.tasks.length===2);
    await c.take('task_ended',p=>p.taskId===first.taskId&&p.outcome==='completed');
    await c.take('snapshot',p=>p.state.characters.vlad.pose==='sleep');
    const activeDuringSleep=c.received.some(p=>p.type==='task_started'&&p.taskId!==first.taskId);
    assert.equal(activeDuringSleep,false,'sleep prevents later tasks from launching early');
    c.send({type:'sleep_stop'});
    const next=await c.take('task_started',p=>p.command.type==='act'&&p.command.actionId==='tablePlan');
    await c.take('task_ended',p=>p.taskId===next.taskId&&p.outcome==='completed');
    assert.equal(c.received.filter(p=>p.type==='error').length,0);
  },state);
});

test('a sleeping resident can line up two tasks without waking prematurely',async()=>{
  const state=initialState();
  state.characters.vlad.energy=19;
  await fixture(async c=>{
    c.send({type:'sleep_start',mode:'half'});
    await c.take('snapshot',p=>p.state.characters.vlad.pose==='sleep');
    c.send({type:'act',actionId:'vladOrder'});
    await c.take('task_queue',p=>p.tasks.length===1);
    c.send({type:'act',actionId:'vladOrder'});
    await c.take('task_queue',p=>p.tasks.length===2);
    c.send({type:'act',actionId:'vladOrder'});
    await c.take('error',p=>p.reason.includes('максимум 3'));
    assert.equal(c.received.some(p=>p.type==='task_started'),false);
    c.send({type:'sleep_stop'});
    const first=await c.take('task_started',p=>p.command.type==='act');
    await c.take('task_ended',p=>p.taskId===first.taskId&&p.outcome==='completed');
    const second=await c.take('task_started',p=>p.command.type==='act'&&p.taskId!==first.taskId);
    await c.take('task_ended',p=>p.taskId===second.taskId&&p.outcome==='completed');
  },state);
});
