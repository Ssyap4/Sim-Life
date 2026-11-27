import test from 'node:test';
import assert from 'node:assert/strict';
import {initialState} from '../../src/shared/protocol';
import {CARE,careScore,careEffects,validVanity,finishCare,bathCare,careStation} from '../../src/shared/vanity';
import {planTask,evaluateTask} from '../tasks';
import {advanceLife} from '../life';

test('new care is Alina-only, at home, uses the correct reserved fixture and actual duration',()=>{
 const s=initialState();
 for(const id of ['hydrate','serum','faceMask','lipCare','handCream','bathLavender','bathRose','bathMilk','bathShave','bathRitual'] as const){
  const cmd={type:'vanity_care' as const,care:id}, plan=planTask(cmd)!;
  assert.equal(plan.resource,bathCare(id)?'bathtub':'vanity');
  assert.equal(plan.durationMs,CARE[id].seconds*1000);
  assert.equal(evaluateTask(s,'vlad',cmd).ok,false);
  const r=evaluateTask(s,'alina',cmd);assert.ok(r.ok);
  assert.equal(careScore(r.state),40+CARE[id].points);
  assert.ok(validVanity(r.state.vanity));
  if(bathCare(id)){assert.ok(plan.durationMs>planTask({type:'act',actionId:'bathFoam'})!.durationMs);assert.equal(r.state.characters.alina.hygiene,100);}
  assert.equal(careScore(s),40);
 }
 assert.equal(planTask({type:'act',actionId:'bathSoak'})!.durationMs,55000);
 assert.equal(planTask({type:'pet_action',pet:'verdell',action:'bathe'})!.resource,careStation('bathRitual'));
});
test('body care replaces instead of stacking, preserves stronger effects, expires and never farms care mood',()=>{
 const s=initialState();s.characters.alina.mood=10;
 finishCare(s,'bathLavender');assert.equal(careScore(s),55);
 finishCare(s,'bathRose');assert.equal(careScore(s),55);assert.equal(s.characters.alina.mood,22);
 finishCare(s,'bathRitual');assert.equal(careScore(s),68);
 const mood=s.characters.alina.mood;
 finishCare(s,'bathRitual');finishCare(s,'bathMilk');
 assert.equal(s.characters.alina.mood,mood);assert.equal(careEffects(s)[0].id,'bathRitual');
 finishCare(s,'hydrate');finishCare(s,'faceMask');assert.equal(careScore(s),93);
 finishCare(s,'handCream');finishCare(s,'lipCare');assert.equal(careScore(s),100);
 assert.equal(careScore(advanceLife(s,1440,[])),40);
});

import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {once} from 'node:events';
import WebSocket from 'ws';
import type {ServerPacket,CharacterId} from '../../src/shared/protocol';
import {BATH_FIXTURES} from '../../src/shared/home';
import {openServerFiles} from '../storage';
import {startServer} from '../server';
function packet(ws:WebSocket,check:(p:ServerPacket)=>boolean):Promise<ServerPacket>{
 return new Promise((resolve,reject)=>{const timer=setTimeout(()=>{ws.off('message',on);reject(Error('packet timeout'))},12000);function on(raw:WebSocket.RawData){const p=JSON.parse(raw.toString()) as ServerPacket;if(!check(p))return;clearTimeout(timer);ws.off('message',on);resolve(p);}ws.on('message',on);});
}
async function connect(port:number,role:CharacterId,code:string){const ws=new WebSocket('ws://127.0.0.1:'+port+'/sync');await once(ws,'open');const ready=packet(ws,p=>p.type==='ready');ws.send(JSON.stringify({type:'auth',role,code}));await ready;return ws;}
test('live Alina bath routes to real tub, blocks concurrent use, cancellation gives no care and completion persists',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'care-065-')),files=openServerFiles(dir),s=initialState();
 s.autonomy={vlad:'off',alina:'off'};s.characters.alina.hygiene=30;Object.assign(s.characters.alina,BATH_FIXTURES.bathtub.approach);files.save(s);
 const server=await startServer({port:0,dataDir:dir,taskTimeScale:.025});const sockets:WebSocket[]=[];
 try{
  const a=await connect(server.port,'alina',files.access.alina),v=await connect(server.port,'vlad',files.access.vlad);sockets.push(a,v);
  const send=(w:WebSocket,c:object)=>w.send(JSON.stringify(c));
  const cmd={type:'vanity_care',care:'bathRitual'};
  let wait=packet(a,p=>p.type==='task_started'&&p.role==='alina');send(a,cmd);let begun=await wait;
  assert.equal(begun.type,'task_started');assert.equal(begun.home?.station,'bathtub');
  const denied=packet(v,p=>p.type==='error');send(v,{type:'act',actionId:'bathSoak'});assert.equal((await denied).type,'error');
  const dogDenied=packet(v,p=>p.type==='error');send(v,{type:'pet_action',pet:'verdell',action:'bathe'});assert.equal((await dogDenied).type,'error');
  const cancelled=packet(a,p=>p.type==='task_ended'&&p.role==='alina'&&p.outcome==='cancelled');send(a,{type:'cancel_task',taskId:begun.taskId});await cancelled;
  assert.equal(careScore(files.load()),40);
  wait=packet(a,p=>p.type==='task_started'&&p.role==='alina');send(a,cmd);begun=await wait;assert.equal(begun.type,'task_started');
  await packet(a,p=>p.type==='task_ended'&&p.role==='alina'&&p.outcome==='completed');
  assert.equal(careScore(files.load()),68);assert.equal(files.load().characters.alina.hygiene,100);
 }finally{sockets.forEach(w=>w.terminate());await server.close();rmSync(dir,{recursive:true,force:true});}
});
