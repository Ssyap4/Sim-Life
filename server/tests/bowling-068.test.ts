import test from 'node:test';
import assert from 'node:assert/strict';
import {initialState,type CharacterId,type ServerPacket} from '../../src/shared/protocol';
import {newBowling,rollBowling,bowlingScore,bowlingResults,validBowlingHistory} from '../../src/shared/manualBowling';
import {venueTogetherTrip} from '../locations';
import {cooperationDenial,pairScenes,completeTogether} from '../society';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {once} from 'node:events';
import WebSocket from 'ws';
import {openServerFiles} from '../storage';
import {startServer} from '../server';
const perfect=(sequence:number)=>sequence%2===0?.12:-.12;
test('server rolls enforce role, sequence, match id, input range and perfect frame scoring',()=>{
 let m=newBowling(1,'vlad');
 const c={id:1,sequence:0,aim:.12,power:.78};
 assert.equal(rollBowling(m,'alina',c),null);assert.equal(rollBowling(m,'vlad',{...c,id:2}),null);
 assert.equal(rollBowling(m,'vlad',{...c,aim:NaN}),null);assert.equal(rollBowling(m,'vlad',{...c,power:2}),null);
 m=rollBowling(m,'vlad',c)!;assert.equal(m.turn,'alina');assert.equal(rollBowling(m,'vlad',c),null);
 while(!m.finished)m=rollBowling(m,m.turn,{id:m.id,sequence:m.sequence,aim:perfect(m.sequence),power:.78})!;
 assert.equal(m.sequence,14);assert.equal(bowlingScore(m.frames.vlad),150);assert.equal(bowlingScore(m.frames.alina),150);
 assert.equal(rollBowling(m,m.turn,{id:m.id,sequence:m.sequence,aim:0,power:1}),null);
});
test('manual outcome is skill-based, no automatic settlement; score history and charge only after finish',()=>{
 const trip=venueTogetherTrip(initialState(),'vlad');assert.ok(trip.ok);const s=trip.state;
 const cmd={type:'together' as const,action:'venueBowling',manual:true};
 assert.equal(cooperationDenial(s,'vlad',cmd),undefined);
 const homes=pairScenes(s,'vlad',cmd)!;assert.equal(homes.vlad.consoleMatch,undefined);
 let m=newBowling(8,'alina');assert.equal(completeTogether(s,'vlad',cmd,['vlad','alina'],0,homes,true,m).ok,false);
 while(!m.finished)m=rollBowling(m,m.turn,{id:m.id,sequence:m.sequence,aim:m.turn==='vlad'?perfect(m.sequence):1,power:m.turn==='vlad'?.78:0})!;
 assert.equal(bowlingScore(m.frames.vlad),150);assert.equal(bowlingScore(m.frames.alina),0);
 const r=completeTogether(s,'vlad',cmd,['vlad','alina'],0,homes,true,m);assert.ok(r.ok);
 assert.equal(r.state.money,s.money-1200);assert.equal(bowlingResults(r.state).length,1);assert.ok(validBowlingHistory(r.state.bowlingHistory));assert.match(r.message,/150:0/);
 assert.equal(bowlingResults(s).length,0);
});
test('two actual websocket clients receive same manual match and settle once',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'bowling068-')),files=openServerFiles(dir),trip=venueTogetherTrip(initialState(),'vlad');assert.ok(trip.ok);
 const s=trip.state;s.autonomy={vlad:'off',alina:'off'};files.save(s);
 const server=await startServer({port:0,dataDir:dir,testNoCodes:true,taskTimeScale:.1,lifeClock:{now:()=>0,tickMs:600000}});const sockets:WebSocket[]=[];
 async function connect(role:CharacterId){
  const ws=new WebSocket('ws://127.0.0.1:'+server.port+'/sync');sockets.push(ws);const inbox:ServerPacket[]=[];ws.on('message',m=>inbox.push(JSON.parse(m.toString())));
  const send=(o:object)=>ws.send(JSON.stringify(o));
  async function take<K extends ServerPacket['type']>(kind:K,predicate:(p:Extract<ServerPacket,{type:K}>)=>boolean=()=>true){
   const end=Date.now()+7000;while(Date.now()<end){const i=inbox.findIndex(p=>p.type===kind&&predicate(p as Extract<ServerPacket,{type:K}>));if(i>=0)return inbox.splice(i,1)[0] as Extract<ServerPacket,{type:K}>;await new Promise(r=>setTimeout(r,5));}throw Error('Missing '+kind+' '+JSON.stringify(inbox.filter(p=>p.type==='error')));
  }
  await once(ws,'open');send({type:'auth',role,code:'TEST-LOCAL-NO-CODES'});await take('ready');return {send,take};
 }
 try{
 const clients={vlad:await connect('vlad'),alina:await connect('alina')};
 clients.vlad.send({type:'social_propose',action:'venueBowling',manual:true});const offer=await clients.alina.take('social_pending');clients.alina.send({type:'social_reply',inviteId:offer.offer.id,choice:0});
 let m=(await clients.vlad.take('bowling_state')).match;assert.deepEqual((await clients.alina.take('bowling_state')).match,m);
 const bad={type:'bowling_roll',id:m.id,sequence:m.sequence,aim:0,power:1};clients.alina.send(bad);await clients.alina.take('error');assert.equal(files.load().money,s.money);
 while(!m.finished){
  const who=m.turn;clients[who].send({type:'bowling_roll',id:m.id,sequence:m.sequence,aim:perfect(m.sequence),power:who==='vlad'?.78:0});
  const seq=m.sequence+1;m=(await clients.vlad.take('bowling_state',p=>p.match.sequence===seq)).match;
  assert.deepEqual((await clients.alina.take('bowling_state',p=>p.match.sequence===seq)).match,m);
 }
 await clients.vlad.take('task_ended',p=>p.role==='vlad'&&p.outcome==='completed');await clients.alina.take('task_ended',p=>p.role==='alina'&&p.outcome==='completed');
 assert.equal(files.load().money,s.money-1200);assert.equal(bowlingResults(files.load()).length,1);
 clients.vlad.send(bad);await clients.vlad.take('error');assert.equal(files.load().money,s.money-1200);
 }finally{sockets.forEach(ws=>ws.terminate());await server.close();rmSync(dir,{recursive:true,force:true});}
});
