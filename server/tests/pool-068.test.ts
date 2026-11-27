import test from 'node:test';
import assert from 'node:assert/strict';
import {initialState,type ServerPacket} from '../../src/shared/protocol';
import {newPool,poolShot,stepPool,validPoolHistory,POOL_RADIUS} from '../../src/shared/manualPool';
import {venueTogetherTrip} from '../locations';
import {pairScenes,completeTogether} from '../society';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {once} from 'node:events';
import WebSocket from 'ws';
import {openServerFiles} from '../storage';
import {startServer} from '../server';
function settle(m:ReturnType<typeof newPool>){for(let i=0;i<400&&m.moving;i++)stepPool(m);assert.equal(m.moving,false);}
test('pool rack and authoritative shot validation, collision, cushions, no duplicate shot',()=>{
 const m=newPool(5,'vlad');assert.equal(m.balls.length,10);
 for(let i=0;i<m.balls.length;i++)for(let j=i+1;j<m.balls.length;j++)assert.ok(Math.hypot(m.balls[i].x-m.balls[j].x,m.balls[i].y-m.balls[j].y)>=2*POOL_RADIUS);
 const cmd={id:5,sequence:0,angle:0,power:1};
 assert.equal(poolShot(m,'alina',cmd),false);assert.equal(poolShot(m,'vlad',{...cmd,id:9}),false);
 assert.equal(poolShot(m,'vlad',{...cmd,angle:Infinity}),false);assert.equal(poolShot(m,'vlad',{...cmd,power:2}),false);
 assert.ok(poolShot(m,'vlad',cmd));assert.equal(poolShot(m,'vlad',cmd),false);
 for(let i=0;i<20;i++)stepPool(m);assert.ok(m.balls.slice(1).some(b=>Math.hypot(b.vx,b.vy)>.02||b.out));
 settle(m);assert.equal(m.score.vlad+m.score.alina,m.balls.slice(1).filter(b=>b.out).length);
 const w=newPool(6,'vlad');Object.assign(w.balls[0],{x:.46,y:.4,vx:2,vy:0});w.moving=true;stepPool(w);assert.ok(w.balls[0].vx<0);
});
test('pocket, extra shot, scratch respot, turn switch, final score',()=>{
 const m=newPool(8,'alina');
 m.moving=true;Object.assign(m.balls[1],{x:.45,y:0,vx:1,vy:0});settle(m);
 assert.equal(m.balls[1].out,true);assert.equal(m.score.alina,1);assert.equal(m.turn,'alina');
 m.moving=true;m.potted=0;m.scratch=false;m.shotTicks=0;Object.assign(m.balls[0],{x:-.46,y:0,vx:-1,vy:0});settle(m);
 assert.equal(m.turn,'vlad');assert.equal(m.balls[0].out,false);
 for(const b of m.balls.slice(1))if(!b.out){m.moving=true;m.potted=0;m.scratch=false;m.shotTicks=0;Object.assign(b,{x:.46,y:0,vx:1,vy:0});settle(m);}
 assert.ok(m.finished);assert.deepEqual(m.score,{vlad:8,alina:1});
 assert.equal(poolShot(m,'vlad',{id:8,sequence:0,angle:0,power:1}),false);
 const trip=venueTogetherTrip(initialState(),'vlad');assert.ok(trip.ok);const s=trip.state;
 const cmd={type:'together' as const,action:'venueBilliards',manual:true},homes=pairScenes(s,'vlad',cmd)!;
 assert.equal(completeTogether(s,'vlad',cmd,['vlad','alina'],0,homes,true,undefined,undefined,newPool(1,'vlad')).ok,false);
 const r=completeTogether(s,'vlad',cmd,['vlad','alina'],0,homes,true,undefined,undefined,m);assert.ok(r.ok);
 assert.equal(r.state.money,s.money-850);assert.ok(validPoolHistory(r.state.poolHistory));assert.match(r.message,/8:1/);
});
test('paired websocket clients receive same shot and cannot play out of turn; cancel is free',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'pool068-')),files=openServerFiles(dir),trip=venueTogetherTrip(initialState(),'vlad');assert.ok(trip.ok);
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
 const v=await connect('vlad'),a=await connect('alina');v.send({type:'social_propose',action:'venueBilliards',manual:true});
 const offer=await a.take('social_pending');a.send({type:'social_reply',inviteId:offer.offer.id,choice:0});
 const started=await v.take('task_started',p=>p.role==='vlad'),m=(await v.take('pool_state')).match;
 assert.deepEqual((await a.take('pool_state')).match,m);
 const shot={type:'pool_shot',id:m.id,sequence:0,angle:0,power:1};a.send(shot);await a.take('error');v.send(shot);
 const live=await v.take('pool_state',p=>p.match.sequence===1&&p.match.tick>0&&p.match.moving);
 assert.deepEqual((await a.take('pool_state',p=>p.match.sequence===1&&p.match.tick===live.match.tick)).match,live.match);
 v.send(shot);await v.take('error');v.send({type:'cancel_task',taskId:started.taskId});await a.take('task_ended',p=>p.role==='alina'&&p.outcome==='cancelled');
 assert.equal(files.load().money,s.money);assert.equal(files.load().poolHistory?.length??0,0);
 }finally{sockets.forEach(ws=>ws.terminate());await server.close();rmSync(dir,{recursive:true,force:true});}
});
