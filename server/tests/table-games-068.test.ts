import test from 'node:test';
import assert from 'node:assert/strict';
import {initialState,type ServerPacket} from '../../src/shared/protocol';
import {newDarts,newJenga,dartPoints,dartWobble,jengaRisk,jengaMeter,tableAction,validTableHistory} from '../../src/shared/manualTableGames';
import {venueTogetherTrip} from '../locations';
import {cooperationDenial,pairScenes,completeTogether} from '../society';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {once} from 'node:events';
import WebSocket from 'ws';
import {openServerFiles} from '../storage';
import {startServer} from '../server';
test('standard dartboard sectors and rings; server computes aim, turn and full match',()=>{
 assert.equal(dartPoints(0,0),50);assert.equal(dartPoints(.05,0),25);assert.equal(dartPoints(0,-.57),60);assert.equal(dartPoints(0,-.97),40);assert.equal(dartPoints(0,-1.01),0);assert.equal(dartPoints(0,.3),3);
 const m=newDarts(1,'vlad','1');const c={type:'table_throw',id:1,sequence:0,x:0,y:0};
 assert.equal(tableAction(m,'alina',c),false);assert.equal(tableAction(m,'vlad',{...c,x:NaN}),false);assert.equal(tableAction(m,'vlad',{...c,id:2}),false);
 while(!m.finished){m.tick=m.readyAt;const w=dartWobble(m.tick,m.sequence),r=m.turn;
 assert.ok(tableAction(m,r,{type:'table_throw',id:m.id,sequence:m.sequence,x:r==='vlad'?-w.x:1,y:r==='vlad'?-w.y:1}));assert.equal(tableAction(m,r,c),false);}
 assert.deepEqual(m.score,{vlad:750,alina:0});assert.equal(m.hits.length,30);assert.equal(m.throws.vlad.length,15);assert.equal(m.throws.alina.length,15);
});
test('home darts needs installed accessible target, completes free, no early rewards',()=>{
 const s=initialState(),cmd={type:'together' as const,action:'leisureTogether',item:'1',manual:true};
 assert.ok(cooperationDenial(s,'vlad',cmd));s.furnishing.placed.push({id:1,sku:'leisure-darts',finish:'oak',x:10,z:8.6,rotation:0});
 assert.equal(cooperationDenial(s,'vlad',cmd),undefined);const homes=pairScenes(s,'vlad',cmd);assert.ok(homes);
 const m=newDarts(1,'vlad','1');assert.equal(completeTogether(s,'vlad',cmd,['vlad','alina'],0,homes,true,undefined,undefined,undefined,m).ok,false);
 while(!m.finished){m.tick=m.readyAt;const w=dartWobble(m.tick,m.sequence);assert.ok(tableAction(m,m.turn,{type:'table_throw',id:m.id,sequence:m.sequence,x:-w.x,y:-w.y}));}
 const r=completeTogether(s,'vlad',cmd,['vlad','alina'],0,homes,true,undefined,undefined,undefined,m);assert.ok(r.ok,r.ok?'':r.reason);assert.equal(r.state.money,s.money);assert.ok(validTableHistory(r.state.dartsHistory,'darts'));assert.equal(r.state.dartsHistory?.length,1);
});
test('Jenga legal block choices, safe pull changes tower and turn; reckless pull collapses and settles once',()=>{
 const m=newJenga(1,'vlad');
 assert.equal(jengaRisk(m,11,0),undefined);assert.equal(jengaRisk(m,-1,0),undefined);
 const risk=jengaRisk(m,10,1)!;assert.ok(tableAction(m,'vlad',{type:'table_pull',id:1,sequence:0,row:10,slot:1,force:.37+risk*.22}));
 assert.equal(m.rows[10],5);assert.equal(m.rows[12],1);assert.equal(m.turn,'alina');assert.equal(jengaRisk(m,10,1),undefined);
 assert.equal(tableAction(m,'alina',{type:'table_pull',id:1,sequence:1,row:0,slot:0,force:1}),false);
 m.strain=.9;m.tick=m.readyAt;while(jengaMeter(m.tick,m.sequence)<.97)m.tick++;
 assert.ok(tableAction(m,'alina',{type:'table_pull',id:1,sequence:1,row:0,slot:1,force:1}));
 assert.ok(m.finished);assert.equal(m.collapsed,'alina');assert.deepEqual(m.score,{vlad:1,alina:0});
 const trip=venueTogetherTrip(initialState(),'vlad');assert.ok(trip.ok);const s=trip.state,cmd={type:'together' as const,action:'venueJenga',manual:true},homes=pairScenes(s,'vlad',cmd)!;
 assert.equal(completeTogether(s,'vlad',cmd,['vlad','alina'],0,homes,true,undefined,undefined,undefined,newJenga(2,'vlad')).ok,false);
 const r=completeTogether(s,'vlad',cmd,['vlad','alina'],0,homes,true,undefined,undefined,undefined,m);assert.ok(r.ok);assert.equal(r.state.money,s.money-450);assert.ok(validTableHistory(r.state.jengaHistory,'jenga'));
});
test('two actual clients synchronize Jenga, reject opponent turn, cancel without charge',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'table068-')),files=openServerFiles(dir),trip=venueTogetherTrip(initialState(),'vlad');assert.ok(trip.ok);
 const s=trip.state;s.autonomy={vlad:'off',alina:'off'};files.save(s);
 const server=await startServer({port:0,dataDir:dir,testNoCodes:true,taskTimeScale:.1,lifeClock:{now:()=>0,tickMs:600000}});const sockets:WebSocket[]=[];
 async function connect(role:'vlad'|'alina'){
  const ws=new WebSocket('ws://127.0.0.1:'+server.port+'/sync');sockets.push(ws);const inbox:ServerPacket[]=[];ws.on('message',m=>inbox.push(JSON.parse(m.toString())));
  const send=(o:object)=>ws.send(JSON.stringify(o));
  async function take<K extends ServerPacket['type']>(kind:K,predicate:(p:Extract<ServerPacket,{type:K}>)=>boolean=()=>true){
   const end=Date.now()+7000;while(Date.now()<end){const i=inbox.findIndex(p=>p.type===kind&&predicate(p as Extract<ServerPacket,{type:K}>));if(i>=0)return inbox.splice(i,1)[0] as Extract<ServerPacket,{type:K}>;await new Promise(r=>setTimeout(r,5));}throw Error('Missing '+kind);
  }
  await once(ws,'open');send({type:'auth',role,code:'TEST-LOCAL-NO-CODES'});await take('ready');return {send,take};
 }
 try{
 const v=await connect('vlad'),a=await connect('alina');v.send({type:'social_propose',action:'venueJenga',manual:true});
 const offer=await a.take('social_pending');a.send({type:'social_reply',inviteId:offer.offer.id,choice:0});
 const started=await v.take('task_started',p=>p.role==='vlad'),m=(await v.take('table_state')).match;
 assert.deepEqual((await a.take('table_state')).match,m);assert.equal(m.game,'jenga');
 const pull={type:'table_pull',id:m.id,sequence:0,row:10,slot:1,force:.4};a.send(pull);await a.take('error');v.send(pull);
 const live=await v.take('table_state',p=>p.match.sequence===1);assert.deepEqual((await a.take('table_state',p=>p.match.sequence===1)).match,live.match);
 assert.equal(live.match.turn,'alina');v.send(pull);await v.take('error');
 v.send({type:'cancel_task',taskId:started.taskId});await a.take('task_ended',p=>p.role==='alina'&&p.outcome==='cancelled');
 assert.equal(files.load().money,s.money);assert.equal(files.load().jengaHistory?.length??0,0);
 }finally{sockets.forEach(ws=>ws.terminate());await server.close();rmSync(dir,{recursive:true,force:true});}
});

test('two actual clients play home darts on real placed furniture; round and duplicate rejection',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'darts068-')),files=openServerFiles(dir),s=initialState();
 s.autonomy={vlad:'off',alina:'off'};s.furnishing.placed.push({id:1,sku:'leisure-darts',finish:'oak',x:10,z:8.6,rotation:0});s.furnishing.nextId=2;files.save(s);
 const server=await startServer({port:0,dataDir:dir,testNoCodes:true,taskTimeScale:.04,lifeClock:{now:()=>0,tickMs:600000}});const sockets:WebSocket[]=[];
 async function connect(role:'vlad'|'alina'){
  const ws=new WebSocket('ws://127.0.0.1:'+server.port+'/sync');sockets.push(ws);const inbox:ServerPacket[]=[];ws.on('message',m=>inbox.push(JSON.parse(m.toString())));
  const send=(o:object)=>ws.send(JSON.stringify(o));
  async function take<K extends ServerPacket['type']>(kind:K,predicate:(p:Extract<ServerPacket,{type:K}>)=>boolean=()=>true){
   const end=Date.now()+7000;while(Date.now()<end){const i=inbox.findIndex(p=>p.type===kind&&predicate(p as Extract<ServerPacket,{type:K}>));if(i>=0)return inbox.splice(i,1)[0] as Extract<ServerPacket,{type:K}>;await new Promise(r=>setTimeout(r,5));}throw Error('Missing '+kind);
  }
  await once(ws,'open');send({type:'auth',role,code:'TEST-LOCAL-NO-CODES'});await take('ready');return {send,take};
 }
 try{
 const v=await connect('vlad'),a=await connect('alina');v.send({type:'social_propose',action:'leisureTogether',item:'1',manual:true});
 const offer=await a.take('social_pending');a.send({type:'social_reply',inviteId:offer.offer.id,choice:0});
 const started=await v.take('task_started',p=>p.role==='vlad');let m=(await v.take('table_state')).match;
 assert.deepEqual((await a.take('table_state')).match,m);assert.equal(m.game,'darts');
 for(let i=0;i<3;i++){const c={type:'table_throw',id:m.id,sequence:m.sequence,x:0,y:0};v.send(c);const p=await v.take('table_state',p=>p.match.sequence===i+1);m=p.match;assert.deepEqual((await a.take('table_state',p=>p.match.sequence===i+1)).match,m);v.send(c);await v.take('error');if(i<2)m=(await v.take('table_state',p=>p.match.sequence===i+1&&p.match.tick>=p.match.readyAt)).match;}
 assert.equal(m.turn,'alina');v.send({type:'cancel_task',taskId:started.taskId});await a.take('task_ended',p=>p.role==='alina'&&p.outcome==='cancelled');
 assert.equal(files.load().money,s.money);assert.equal(files.load().dartsHistory?.length??0,0);
 }finally{sockets.forEach(ws=>ws.terminate());await server.close();rmSync(dir,{recursive:true,force:true});}
});
test('successful Jenga pulls conserve all 36 blocks and never empty supporting rows',()=>{
 const m=newJenga(5,'vlad');
 for(let i=0;i<30&&!m.finished;i++){
  const options=m.rows.flatMap((_,row)=>[0,1,2].flatMap(slot=>{const risk=jengaRisk(m,row,slot);return risk===undefined?[]:[{row,slot,risk}];})).sort((a,b)=>a.risk-b.risk);
  assert.ok(options.length);const {row,slot,risk}=options[0];m.tick=m.readyAt;while(Math.abs(jengaMeter(m.tick,m.sequence)-.5)>.035)m.tick++;
  assert.ok(tableAction(m,m.turn,{type:'table_pull',id:m.id,sequence:m.sequence,row,slot,force:.37+risk*.22}));
  assert.equal(m.rows.reduce((n,mask)=>n+Number(!!(mask&1))+Number(!!(mask&2))+Number(!!(mask&4)),0),36);
  assert.ok(m.rows.every(mask=>mask>0&&mask<=7));
 }
 assert.ok(m.finished);
});
