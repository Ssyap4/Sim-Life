import assert from 'node:assert/strict';
import test from 'node:test';
import {Box3,Vector3,Mesh,PlaneGeometry} from 'three';
import WebSocket from 'ws';
import {initialState,type ServerPacket} from '../../src/shared/protocol';
import {POOL_SIZE,floatX,poolSwimFrame,floatBob} from '../../src/shared/oasisPool';
import {checkFurniturePlacement} from '../../src/shared/furnishingPlacement';
import {furnitureUseLocation,furnitureActionList} from '../../src/shared/furnitureUse';
import {buildFurnishingModel} from '../../src/game/FurnishingArt';
import {HOME_FLOOR} from '../../src/shared/home';
import {pointIsClear,segmentIsClear} from '../../src/game/navigation';
import {placeObstacles} from '../../src/shared/locations';
import {pairScenes,completeTogether} from '../society';
import {createHomeSessions} from '../homeSessions';
import {planTask} from '../tasks';
import {gameMinutes} from '../../src/shared/life';

const pool={id:2,sku:'oasis-pool',finish:'oak' as const,x:-9.95,z:8.1,rotation:0 as const};
const roles=['vlad','alina'] as const;
function fixture(){
 const s=initialState();
 s.furnishing.placed=[{id:1,sku:'oasis-terrace',finish:'sage',x:9.5,z:10.2,rotation:2}];s.furnishing.nextId=3;
 return s;
}
test('large pool fits with terrace and direct internal path, not over the fence or parking',()=>{
 const s=fixture();assert.ok(checkFurniturePlacement(s,pool).valid);
 assert.equal(checkFurniturePlacement(s,{...pool,x:14.2,z:8.63}).valid,false);
 assert.equal(checkFurniturePlacement(s,{...pool,x:0,z:-4}).valid,false);
 s.furnishing.placed.push(pool);
 assert.deepEqual(furnitureActionList(pool),['poolFloat','poolSwim']);
 const obs=placeObstacles('home',s.furnishing);
 for(const role of roles)for(const action of ['poolFloat','poolSwim'] as const){
  const l=furnitureUseLocation(s,role,pool.id,action);assert.ok(l);
  let prev=l.route.from,total=0;
  for(const p of l.route.path){assert.ok(pointIsClear(p,obs,HOME_FLOOR));assert.ok(segmentIsClear(prev,p,obs,HOME_FLOOR));total+=Math.hypot(p.x-prev.x,p.z-prev.z);prev=p;}
  assert.ok(total<22,'short courtyard route '+total);
 }
});
test('pool has actual 6 by 3.5 water plane, independent floats and bounded swim frames',()=>{
 const root=buildFurnishingModel(pool.sku,'oak');root.updateMatrixWorld(true);
 const water=root.getObjectByName('Oasis water surface') as Mesh<PlaneGeometry>;
 assert.ok(water);assert.equal(water.geometry.parameters.width,6);assert.equal(water.geometry.parameters.height,3.5);
 assert.ok(new Box3().setFromObject(root).getSize(new Vector3()).x<=POOL_SIZE.width+.001);
 const v=root.getObjectByName('Oasis float vlad')!,a=root.getObjectByName('Oasis float alina')!;
 assert.ok(v&&a&&v!==a);assert.ok(floatX('alina')-floatX('vlad')<2.6);
 assert.ok(new Box3().setFromObject(v).max.x<new Box3().setFromObject(a).min.x);
 for(let t=0;t<120;t+=.1)for(const role of roles){
  const f=poolSwimFrame(t,role);assert.ok(Math.abs(f.x)<3&&Math.abs(f.z-POOL_SIZE.waterZ)<1.75);assert.ok(Math.abs(floatBob(t,role))<=.025);
 }
});
test('paired float and paired swimming use distinct valid poses and actual rewards',()=>{
 const s=fixture();s.furnishing.placed.push(pool);
 for(const r of roles)Object.assign(s.characters[r],{fun:20,mood:20,energy:90,comfort:20});
 for(const [action,mode] of [['leisureTogether','poolFloat'],['poolSwimTogether','poolSwim']] as const){
  const cmd={type:'together' as const,action,item:'2'};const homes=pairScenes(s,'vlad',cmd);assert.ok(homes);
  for(const r of roles)assert.equal(homes[r].pair?.item,mode);
  const result=completeTogether(s,'vlad',cmd,[...roles],0,homes);assert.ok(result.ok);assert.equal(result.state.money,s.money);
 }
});
function rig(){
 let s=fixture(),clock=1000,id=0; s.furnishing.placed.push(pool);
 for(const r of roles){const l=furnitureUseLocation(s,r,2,'poolFloat')!;Object.assign(s.characters[r],l.route.path.at(-1)??l.route.from,{fun:20,comfort:20,energy:80,mood:20});}
 const packets:ServerPacket[]=[];const timers=new Map<ReturnType<typeof setTimeout>,{at:number;cb:()=>void}>();
 const sockets={vlad:{readyState:WebSocket.OPEN} as WebSocket,alina:{readyState:WebSocket.OPEN} as WebSocket};
 const h=createHomeSessions({state:()=>s,save:n=>{s=n;},all:p=>packets.push(p),send:(_,p)=>packets.push(p),socket:r=>sockets[r],busy:()=>false,prepare:()=>{},nextId:()=>++id,timeScale:1,gameTime:()=>gameMinutes(s.clock),now:()=>clock,resourceBusy:()=>false,schedule:(cb,ms)=>{const k=++id as unknown as ReturnType<typeof setTimeout>;timers.set(k,{at:clock+ms,cb});return k;},clearTimer:k=>{timers.delete(k);}});
 const advance=(ms:number)=>{const end=clock+ms;while(true){const n=[...timers].filter(([,v])=>v.at<=end).sort((a,b)=>a[1].at-b[1].at)[0];if(!n)break;timers.delete(n[0]);clock=n[1].at;n[1].cb();}clock=end;};
 const start=(r:typeof roles[number],action:'poolFloat'|'poolSwim')=>h.start([r],planTask({type:'furniture_use',furnitureId:2,action})!,sockets[r]);
 const finish=(r:typeof roles[number])=>{const p=[...packets].reverse().find(p=>p.type==='task_started'&&p.role===r);assert.ok(p?.type==='task_started');h.social(r,sockets[r],{type:'social_finish',taskId:p.taskId});};
 return {h,sockets,packets,advance,start,finish,state:()=>s};
}
test('independent float ownership, indefinite rest and talking; swimming cannot overlap occupied floats',()=>{
 const r=rig();try{
  assert.ok(r.start('vlad','poolFloat'));r.advance(3000);
  assert.ok(!r.start('alina','poolSwim'));assert.ok(r.start('alina','poolFloat'));r.advance(3000);
  r.h.social('vlad',r.sockets.vlad,{type:'social_propose',action:'nearTalk:day'});
  const p=[...r.packets].reverse().find(p=>p.type==='social_pending');assert.ok(p?.type==='social_pending');
  r.h.social('alina',r.sockets.alina,{type:'social_reply',inviteId:p.offer.id,choice:0});
  r.advance(600000);
  assert.ok(r.state().relationship.recent.some(e=>e.action==='nearTalk:day'));
  assert.ok(r.h.busy('vlad')&&r.h.busy('alina'));r.finish('vlad');assert.ok(!r.h.busy('vlad')&&r.h.busy('alina'));
  assert.ok(!r.start('vlad','poolSwim'));r.finish('alina');assert.ok(r.start('vlad','poolSwim'));
  assert.ok(!r.start('alina','poolFloat'));r.advance(65000);assert.ok(!r.h.busy('vlad'));
 }finally{r.h.dispose();}
});
test('expanded front lawn accepts pool without a new purchaseable terrace or obstructing the gate',()=>{
 const s=initialState(),front={...pool,z:13.0};
 assert.ok(checkFurniturePlacement(s,front).valid);
 assert.equal(checkFurniturePlacement(s,{...front,x:.48}).valid,false);
 s.furnishing.placed=[front];
 for(const role of roles)assert.ok(furnitureUseLocation(s,role,front.id,'poolFloat'));
});
