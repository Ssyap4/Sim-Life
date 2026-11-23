import { test } from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import WebSocket from 'ws';
import { initialState, type ActionId, type ServerPacket } from '../../src/shared/protocol';
import { homeHabitCommands } from '../../src/shared/personalityHabits';
import { planTask, evaluateTask } from '../tasks';
import { openServerFiles } from '../storage';
import { startServer } from '../server';

test('0.27 v3: hundreds of normal household decisions stay varied, valid and do not spend money',()=>{
  const state=initialState();
  state.clock.minute=15*60;
  Object.assign(state.characters.vlad,{energy:91,hunger:90,mood:85});
  Object.assign(state.characters.alina,{energy:92,hunger:88,mood:85});
  const original=structuredClone(state);
  const signatures:Record<'vlad'|'alina',Set<ActionId>>={vlad:new Set(),alina:new Set()};
  for(const role of ['vlad','alina'] as const){
    let recent:ActionId[]=[];
    for(let i=0;i<240;i++){
      const options=homeHabitCommands(state,role,i,recent);
      const suitable=options.find(({command})=>{
        const plan=planTask(command);
        return !!plan && evaluateTask(state,role,plan.command).ok;
      });
      assert.ok(suitable,'At least one reachable real habit for '+role+' decision '+i);
      signatures[role].add(suitable.habit);
      recent=[...recent.filter(id=>id!==suitable.habit),suitable.habit].slice(-3);
      assert.ok(['act','furniture_use'].includes(suitable.command.type));
    }
    assert.ok(signatures[role].size>=4,role+' should not stick to one or two chores');
  }
  assert.notDeepEqual([...signatures.vlad].sort(),[...signatures.alina].sort());
  assert.deepEqual(state,original,'Planning cannot change family saves or resources');
});

test('0.27 v3: live full autonomy actually starts and finishes a real home habit after leisure', {timeout:45000}, async()=>{
  const dir=mkdtempSync(join(tmpdir(),'sim-life-027-v3-autonomy-'));
  const seed=initialState();
  seed.clock.minute=15*60;
  seed.autonomy={vlad:'full',alina:'off'};
  Object.assign(seed.characters.vlad,{
    hunger:94,energy:92,bladder:95,hygiene:93,social:90,fun:91,comfort:89,mood:85,
  });
  openServerFiles(dir).save(seed);
  let server:Awaited<ReturnType<typeof startServer>>|undefined,ws:WebSocket|undefined;
  try{
    server=await startServer({
      port:0,host:'127.0.0.1',dataDir:dir,taskTimeScale:.045,
      lifeClock:{now:()=>Date.now(),tickMs:50},
      autonomyTiming:{idleMs:80,careCooldownMs:170,leisureCooldownMs:180},
    });
    const keys=JSON.parse(readFileSync(join(dir,'access.json'),'utf8')) as Record<string,string>;
    ws=new WebSocket('ws://127.0.0.1:'+server.port+'/sync');
    await once(ws,'open');
    const events:ServerPacket[]=[];
    const complete=new Promise<void>((resolve,reject)=>{
      const timer=setTimeout(()=>reject(new Error('No finished household habit: '+JSON.stringify(events.slice(-18).map(p=>p.type)))),39000);
      let started:number|null=null;
      ws!.on('message',raw=>{
        const packet=JSON.parse(raw.toString()) as ServerPacket;
        if(events.length<240)events.push(packet);
        if(packet.type==='task_started'&&packet.role==='vlad'&&packet.automatic){
          if(packet.command.type==='act'||packet.command.type==='furniture_use')started=packet.taskId;
        }
        if(packet.type==='task_ended'&&packet.role==='vlad'&&packet.taskId===started){
          clearTimeout(timer);
          if(packet.outcome==='completed')resolve();
          else reject(new Error('Home habit failed: '+packet.message));
        }
      });
    });
    ws.send(JSON.stringify({type:'auth',role:'vlad',code:keys.vlad}));
    await complete;
    assert.ok(events.some(p=>p.type==='ready'));
    assert.ok(events.some(p=>p.type==='home_leisure'&&p.activity!==null),
      'A genuine leisure cycle should occur before the first full-mode home habit');
    assert.ok(events.some(p=>p.type==='task_started'&&p.automatic&&
      (p.command.type==='act'||p.command.type==='furniture_use')),
      'Expected an actual, server-owned timed home task');
    const persisted=openServerFiles(dir).load();
    assert.equal(persisted.money,seed.money,'Idle routine cannot spend household money');
    assert.deepEqual(persisted.pantry,seed.pantry,'Idle routine cannot invent or consume groceries');
    assert.deepEqual(persisted.autonomy,seed.autonomy);
  }finally{
    ws?.terminate();
    await server?.close();
    rmSync(dir,{recursive:true,force:true});
  }
});
