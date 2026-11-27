import test from 'node:test';
import assert from 'node:assert/strict';
import WebSocket from 'ws';
import {initialState,type ServerPacket} from '../../src/shared/protocol';
import {newHockey,hockeyControls,hockeyMove,stepHockey,HOCKEY_LIMIT,HOCKEY_STEP,validHockeyHistory} from '../../src/shared/manualHockey';
import {venueTogetherTrip} from '../locations';
import {pairScenes,completeTogether} from '../society';
import {createHomeSessions} from '../homeSessions';
import {SOCIAL_BY_ID} from '../../src/shared/socialLife';
test('hockey input validates role half, id, finite bounds and sequence; paddle speed capped',()=>{
 const m=newHockey(7),c=hockeyControls();
 const cmd={id:7,sequence:1,x:.4,y:.12};
 assert.equal(hockeyMove(m,c,'alina',cmd),false);assert.equal(hockeyMove(m,c,'vlad',{...cmd,id:9}),false);
 assert.equal(hockeyMove(m,c,'vlad',{...cmd,x:NaN}),false);assert.equal(hockeyMove(m,c,'vlad',{...cmd,y:2}),false);
 assert.equal(hockeyMove(m,c,'vlad',cmd),true);assert.equal(hockeyMove(m,c,'vlad',cmd),false);
 const p={...m.pads.vlad};stepHockey(m,c);assert.ok(Math.hypot(m.pads.vlad.x-p.x,m.pads.vlad.y-p.y)<=2.7*HOCKEY_STEP+1e-8);
});
test('puck rebounds at walls, collides with paddle, scores in goal and ends at seven',()=>{
 const m=newHockey(1),c=hockeyControls();m.serve=0;m.puck={x:.45,y:0};m.velocity={x:2,y:0};stepHockey(m,c);assert.ok(m.velocity.x<0);
 m.puck={x:0,y:.59};m.velocity={x:0,y:2};stepHockey(m,c);assert.ok(m.velocity.y<0);
 m.puck={x:0,y:-.95};m.velocity={x:0,y:-2};m.score.vlad=6;stepHockey(m,c);
 assert.equal(m.score.vlad,7);assert.equal(m.score.alina,0);assert.ok(m.finished);
 const tick=m.tick;stepHockey(m,c);assert.equal(m.tick,tick);
});
test('90 second timeout and persistent score; no rewards for incomplete match',()=>{
 const m=newHockey(3),c=hockeyControls();m.tick=HOCKEY_LIMIT/HOCKEY_STEP-1;stepHockey(m,c);assert.ok(m.finished);
 const trip=venueTogetherTrip(initialState(),'vlad');assert.ok(trip.ok);const s=trip.state;
 const cmd={type:'together' as const,action:'venueHockey',manual:true},homes=pairScenes(s,'vlad',cmd)!;
 assert.equal(completeTogether(s,'vlad',cmd,['vlad','alina'],0,homes,true,undefined,newHockey(4)).ok,false);
 m.score={vlad:4,alina:2};const r=completeTogether(s,'vlad',cmd,['vlad','alina'],0,homes,true,undefined,m);assert.ok(r.ok);
 assert.equal(r.state.money,s.money-650);assert.match(r.message,/4:2/);assert.ok(validHockeyHistory(r.state.hockeyHistory));assert.equal(r.state.hockeyHistory?.length,1);
});
test('authoritative paired session broadcasts live movement, completes once; cancellation releases without payment',()=>{
 const trip=venueTogetherTrip(initialState(),'vlad');assert.ok(trip.ok);let s=trip.state,t=1000,id=0;
 const sockets={vlad:{readyState:WebSocket.OPEN} as WebSocket,alina:{readyState:WebSocket.OPEN} as WebSocket};
 const packets:ServerPacket[]=[];const timers=new Map<ReturnType<typeof setTimeout>,{at:number;cb:()=>void}>();
 const session=createHomeSessions({state:()=>s,save:n=>{s=n;},all:p=>packets.push(structuredClone(p)),send:(_,p)=>packets.push(structuredClone(p)),socket:r=>sockets[r],busy:()=>false,prepare:()=>{},nextId:()=>++id,timeScale:1,gameTime:()=>480,now:()=>t,resourceBusy:()=>false,schedule:(cb,ms)=>{const h=++id as unknown as ReturnType<typeof setTimeout>;timers.set(h,{at:t+ms,cb});return h;},clearTimer:h=>{timers.delete(h);}});
 const advance=(ms:number)=>{const end=t+ms;for(;;){const first=[...timers].filter(([,v])=>v.at<=end).sort((a,b)=>a[1].at-b[1].at)[0];if(!first)break;timers.delete(first[0]);t=first[1].at;first[1].cb();}t=end;};
 const start=()=>{const a=SOCIAL_BY_ID.get('venueHockey')!;assert.ok(session.start(['vlad','alina'],{command:{type:'together',action:a.id,manual:true},label:a.title,durationMs:90000,resource:'venue:venueHockey'},sockets.vlad,false,{from:'vlad',choice:0}));const first=[...timers.values()].sort((a,b)=>a.at-b.at)[0];advance(first.at-t);const p=[...packets].reverse().find(p=>p.type==='hockey_state');assert.ok(p?.type==='hockey_state');return p.match;};
 const m=start();session.hockeyInput('vlad',sockets.vlad,{id:m.id,sequence:1,x:.4,y:.12});advance(200);
 const live=[...packets].reverse().find(p=>p.type==='hockey_state');assert.ok(live?.type==='hockey_state');assert.ok(live.match.pads.vlad.x>0);
 const money=s.money;session.cancel('alina','cancel');advance(100000);assert.equal(s.money,money);assert.equal(s.hockeyHistory?.length??0,0);
 start();advance(91000);assert.equal(s.money,money-650);assert.equal(s.hockeyHistory?.length,1);assert.equal(packets.filter(p=>p.type==='task_ended'&&p.outcome==='completed').length,2);advance(100000);assert.equal(s.money,money-650);
 session.dispose();
});

import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {once} from 'node:events';
import {openServerFiles} from '../storage';
import {startServer} from '../server';
test('two actual clients receive identical puck and paddles, cancellation costs nothing',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'hockey068-')),files=openServerFiles(dir),trip=venueTogetherTrip(initialState(),'vlad');assert.ok(trip.ok);
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
 const v=await connect('vlad'),a=await connect('alina');v.send({type:'social_propose',action:'venueHockey',manual:true});
 const offer=await a.take('social_pending');a.send({type:'social_reply',inviteId:offer.offer.id,choice:0});
 const started=await v.take('task_started',p=>p.role==='vlad'),m=(await v.take('hockey_state')).match;
 assert.deepEqual((await a.take('hockey_state')).match,m);
 v.send({type:'hockey_move',id:m.id,sequence:1,x:.35,y:.3});a.send({type:'hockey_move',id:m.id,sequence:1,x:-.35,y:-.3});
 const live=await v.take('hockey_state',p=>p.match.pads.vlad.x>.15&&p.match.pads.alina.x<-.15);
 assert.deepEqual((await a.take('hockey_state',p=>p.match.tick===live.match.tick)).match,live.match);
 v.send({type:'cancel_task',taskId:started.taskId});await a.take('task_ended',p=>p.role==='alina'&&p.outcome==='cancelled');
 assert.equal(files.load().money,s.money);assert.equal(files.load().hockeyHistory?.length??0,0);
 }finally{sockets.forEach(ws=>ws.terminate());await server.close();rmSync(dir,{recursive:true,force:true});}
});
