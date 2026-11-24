import test from 'node:test';
import assert from 'node:assert/strict';
import WebSocket from 'ws';
import { initialState,type ServerPacket } from '../../src/shared/protocol';
import { nearbyTalkDenial } from '../../src/shared/nearbyTalk';
import { NEARBY_TALK_TOPICS } from '../../src/shared/socialLife';
import { gameMinutes } from '../../src/shared/life';
import { homeSeat } from '../../src/shared/home';
import { createHomeSessions } from '../homeSessions';
import { planTask } from '../tasks';

const residents=['vlad','alina'] as const;
function fixture(){
 const s=initialState();
 for(const r of residents){Object.assign(s.characters[r],{x:r==='vlad'?0:1,z:0,pose:'sit',social:40,mood:50,energy:90,bladder:90});}
 return s;
}
test('nearby dialogue excludes separation, solid walls and sleeping residents',()=>{
 const s=fixture();
 assert.equal(nearbyTalkDenial(s,'vlad',s.characters),undefined);
 s.characters.alina.x=6;assert.ok(nearbyTalkDenial(s,'vlad',s.characters));
 Object.assign(s.characters.vlad,{x:-5,z:1.6});Object.assign(s.characters.alina,{x:-4,z:1.6});
 assert.ok(nearbyTalkDenial(s,'vlad',s.characters));
 s.world.places.alina='park';assert.ok(nearbyTalkDenial(s,'vlad',s.characters));
 s.world.places.alina='home';Object.assign(s.characters.vlad,{x:0,z:0});Object.assign(s.characters.alina,{x:1,z:0,pose:'sleep'});
 assert.ok(nearbyTalkDenial(s,'vlad',s.characters));
 assert.ok(NEARBY_TALK_TOPICS.length>=15);
 assert.ok(NEARBY_TALK_TOPICS.some(t=>t.group==='romance'));
 assert.ok(NEARBY_TALK_TOPICS.every(t=>t.seconds>=20&&t.seconds<=60));
});
function rig(){
 let state=fixture(),clock=1000,id=0,prepares=0;
 const packets:ServerPacket[]=[];
 const timers=new Map<ReturnType<typeof setTimeout>,{at:number;cb:()=>void}>();
 const sockets={vlad:{readyState:WebSocket.OPEN} as WebSocket,alina:{readyState:WebSocket.OPEN} as WebSocket};
 const s=createHomeSessions({state:()=>state,save:next=>{state=next;},all:p=>packets.push(p),send:(_,p)=>packets.push(p),
  socket:r=>sockets[r],busy:()=>false,prepare:()=>{prepares++;},nextId:()=>++id,timeScale:1,
  gameTime:()=>gameMinutes(state.clock),now:()=>clock,resourceBusy:()=>false,
  conversationPosition:r=>state.characters[r],
  schedule:(cb,ms)=>{const handle=++id as unknown as ReturnType<typeof setTimeout>;timers.set(handle,{at:clock+ms,cb});return handle;},
  clearTimer:h=>{timers.delete(h);}
 });
 function advance(ms:number){const end=clock+ms;while(true){const next=[...timers.entries()].filter(([,v])=>v.at<=end).sort((a,b)=>a[1].at-b[1].at)[0];if(!next)break;timers.delete(next[0]);clock=next[1].at;next[1].cb();}clock=end;}
 function propose(){s.social('vlad',sockets.vlad,{type:'social_propose',action:'nearTalk:day'});const p=packets.filter((p):p is Extract<ServerPacket,{type:'social_pending'}>=>p.type==='social_pending').at(-1);assert.ok(p);return p.offer.id;}
 function reply(inviteId:number,choice:number|null){s.social('alina',sockets.alina,{type:'social_reply',inviteId,choice});}
 return {s,sockets,packets,advance,propose,reply,state:()=>state,prepares:()=>prepares};
}
test('accepted talk starts independently, awards only on completion, and never changes poses or inventory',()=>{
 const r=rig();try{
  const before=structuredClone(r.state());r.reply(r.propose(),0);
  assert.equal(r.prepares(),0);
  assert.ok(r.packets.some(p=>p.type==='conversation'&&p.remainingMs>0));
  assert.ok(!r.packets.some(p=>p.type==='task_started'));
  assert.deepEqual(r.state(),before);
  r.advance(31_000);
  assert.equal(r.state().relationship.recent.at(-1)?.action,'nearTalk:day');
  assert.ok(r.state().characters.vlad.social>before.characters.vlad.social);
  assert.equal(r.state().money,before.money);assert.deepEqual(r.state().pantry,before.pantry);
  for(const id of residents)for(const key of ['x','z','pose'] as const)assert.equal(r.state().characters[id][key],before.characters[id][key]);
  assert.ok(r.packets.some(p=>p.type==='conversation'&&p.remainingMs===0));
 }finally{r.s.dispose();}
});
test('declined or interrupted conversation never earns relationship effects',()=>{
 const r=rig();try{
  const before=structuredClone(r.state());r.reply(r.propose(),null);r.advance(1000);
  assert.deepEqual(r.state(),before);r.reply(r.propose(),0);
  r.state().characters.alina.x=8;r.s.recheckAccess();r.advance(50_000);
  assert.equal(r.state().relationship.recent.length,0);assert.equal(r.state().characters.vlad.social,before.characters.vlad.social);
  assert.ok(r.packets.some(p=>p.type==='conversation'&&p.remainingMs===0));
 }finally{r.s.dispose();}
});
test('a real seated home session stays running when a nearby conversation is accepted',()=>{
 const r=rig();try{
  const seat=homeSeat('sofa','vlad').approach;
  Object.assign(r.state().characters.vlad,seat,{pose:'idle'});
  Object.assign(r.state().characters.alina,{x:seat.x+.5,z:seat.z,pose:'idle'});
  const plan=planTask({type:'act',actionId:'sofaRest'});assert.ok(plan);
  const task=r.s.start(['vlad'],{...plan,durationMs:80_000},r.sockets.vlad);
  assert.ok(task);r.advance(5000);assert.ok(r.s.busy('vlad'));
  const invite=r.propose();r.reply(invite,0);
  assert.ok(r.packets.some(p=>p.type==='conversation'&&p.remainingMs>0));
  assert.ok(r.s.busy('vlad'));assert.equal(r.prepares(),1);
  r.advance(31_000);assert.ok(r.s.busy('vlad'));
  assert.ok(!r.packets.some(p=>p.type==='task_ended'));
  assert.equal(r.state().relationship.recent.at(-1)?.action,'nearTalk:day');
 }finally{r.s.dispose();}
});