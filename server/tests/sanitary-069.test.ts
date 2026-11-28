import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {SANITARY,FIXTURE_ROOMS,renovationQuote,validRenovation,installedRenovation,initialRenovation} from '../../src/shared/renovation';
import {BATH_FIXTURES,type BathFixture} from '../../src/shared/home';
import {buildBathFixture,batchBathFixture,disposeBathMaterials} from '../../src/game/BathroomArt';
import {disposeFurnitureModel} from '../../src/game/FurnitureModels';
import {initialState,points,type ActionId} from '../../src/shared/protocol';
import {applyWorld,validWorld} from '../locations';
import {planTask,evaluateTask} from '../tasks';
import {stationById,approachFor,placeObstacles,floorFor} from '../../src/shared/locations';
import {findRoute} from '../../src/game/navigation';
import {dogBathPlan,DOG_BATH_APPROACH,DOG_BATH_OWNER} from '../../src/shared/dogBath';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {openServerFiles} from '../storage';
import {startServer} from '../server';
import WebSocket from 'ws';
import {once} from 'node:events';
import type {ServerPacket,CharacterId} from '../../src/shared/protocol';
const slots=Object.keys(BATH_FIXTURES) as BathFixture[];
const actions:Record<BathFixture,ActionId[]>={toilet:['toiletUse'],shower:['bathShower'],bathtub:['bathSoak','bathFoam'],basin:['bathWash','bathTeeth'],wcBasin:['wcWash']};
const fingerprint=(m:THREE.Object3D)=>{const a:string[]=[];m.traverse(o=>{if(o instanceof THREE.Mesh)a.push(JSON.stringify([o.geometry.type,o.geometry.attributes.position.count,Array.from(o.geometry.attributes.position.array as ArrayLike<number>).reduce((sum,v,i)=>sum+v*(i%13+1),0).toFixed(4),o.position.toArray(),o.scale.toArray(),o.rotation.toArray().slice(0,3)]));});return a.sort();};
function contactSignature(g:THREE.Group,predicate:(m:THREE.Mesh)=>boolean){return g.children.filter((m):m is THREE.Mesh=>m instanceof THREE.Mesh&&predicate(m)).map(m=>JSON.stringify([m.position.toArray(),m.scale.toArray(),m.rotation.toArray().slice(0,3),m.geometry.type])).sort();}
const contact:Record<BathFixture,(m:THREE.Mesh)=>boolean>={
 toilet:m=>m.position.y>=.45&&m.position.y<=.54&&m.position.z>0,
 shower:m=>m.position.y<=.09||m.position.x>=.49&&m.position.y>=.95&&m.position.y<=1.2,
 bathtub:m=>m.position.y===.41||m.position.y>=.75&&m.position.x<0,
 basin:m=>m.position.y>=.78&&m.position.y<=1.12&&Math.abs(m.position.x)<.15,
 wcBasin:m=>m.position.y>=.83&&m.position.y<=1.12&&Math.abs(m.position.x)<.15
};
test('20 distinct sanitary meshes preserve the stock contact surfaces and physical footprint',()=>{
 assert.equal(SANITARY.length,20);
 for(const slot of slots){
  const stock=buildBathFixture(slot);stock.updateMatrixWorld(true);
  const a=new THREE.Box3().setFromObject(stock),expected=contactSignature(stock,contact[slot]);assert.ok(expected.length>=2,slot);
  const shapes=new Set([JSON.stringify(fingerprint(stock))]);
  const {center}=BATH_FIXTURES[slot];
  for(const p of SANITARY.filter(p=>p.fixture===slot)){
   const g=buildBathFixture(slot,p.id);g.updateMatrixWorld(true);const b=new THREE.Box3().setFromObject(g);
   assert.deepEqual(g.position.toArray(),stock.position.toArray(),p.id);assert.equal(g.rotation.y,stock.rotation.y,p.id);
   assert.deepEqual(contactSignature(g,contact[slot]),expected,p.id+' contact geometry');
   assert.ok(b.min.x>=a.min.x-.035&&b.max.x<=a.max.x+.035&&b.min.z>=a.min.z-.035&&b.max.z<=a.max.z+.035,p.id+' footprint');
   assert.ok(b.min.y>=-.025&&b.max.y<=a.max.y+.035,p.id+' height');
   assert.ok(!shapes.has(JSON.stringify(fingerprint(g))),p.id+' duplicate geometry');shapes.add(JSON.stringify(fingerprint(g)));
   if(slot==='bathtub'){
    for(const x of [-.32,0,.32])for(const z of [-.60,0,.60]){
     const ray=new THREE.Raycaster(new THREE.Vector3(center.x+x,1.3,center.z+z),new THREE.Vector3(0,-1,0));
     const hit=ray.intersectObject(g,true)[0];assert.ok(hit&&Math.abs(hit.point.y-.41)<.003,p.id+' unobstructed water '+x+','+z);
    }
   }
   batchBathFixture(g);disposeFurnitureModel(g);disposeBathMaterials(g);
  }
  assert.equal(shapes.size,5,slot);
 }
});
test('oak apron remains visible outside porcelain; retro feet clear the raised skirt',()=>{
 const oak=buildBathFixture('bathtub','bath-oak'),retro=buildBathFixture('bathtub','bath-classic');
 const sideRay=(root:THREE.Group,y:number,z:number)=>{root.updateMatrixWorld(true);const origin=root.localToWorld(new THREE.Vector3(-1.5,y,z));const dir=new THREE.Vector3(1,0,0).transformDirection(root.matrixWorld);return new THREE.Raycaster(origin,dir).intersectObject(root,true)[0];};
 const hit=sideRay(oak,.32,0);assert.ok(hit);assert.ok(Math.abs(oak.worldToLocal(hit.point.clone()).x)>.67,'oak must cover the outer wall');
 assert.equal(sideRay(retro,.12,0),undefined,'retro apron must leave underbody clearance');
 assert.ok(sideRay(retro,.13,.72),'visible retro foot');
 assert.ok(sideRay(retro,.30,0),'upper porcelain skirt remains');
});
test('all twenty models install in exactly their own slot and preserve tasks, routes, dog bath and persistence',()=>{
 let s=initialState();s.money=1000000;s.world.places.vlad='buildshop';Object.assign(s.characters.vlad,approachFor(stationById('buildshop','build-sanitary')!,'vlad'));
 for(const p of SANITARY){const r=applyWorld(s,'vlad',{type:'renovation_sample',sku:p.id});assert.ok(r.ok,p.id);s=r.state;}
 s.world.places.vlad='home';Object.assign(s.characters.vlad,DOG_BATH_OWNER);s.pets.verdell.position={...DOG_BATH_APPROACH};
 const before=placeObstacles('home',s.furnishing);
 for(const p of SANITARY){const slot=p.fixture!,room=FIXTURE_ROOMS[slot],expected=installedRenovation(s.world.renovation,room,p);const sequence=s.world.sequence.vlad;
  assert.equal(applyWorld(s,'vlad',{type:'renovation_install',sku:p.id,room:'living',expected,sequence}).ok,false);
  const r=applyWorld(s,'vlad',{type:'renovation_install',sku:p.id,room,expected,sequence});assert.ok(r.ok,p.id);
  assert.equal(r.state.money,s.money-renovationQuote(room,p).total);assert.equal(r.state.world.renovation?.fixtures?.[slot],p.id);assert.equal(Object.keys(r.state.world.renovation?.surfaces??{}).length,0);
  assert.deepEqual(placeObstacles('home',r.state.furnishing),before);assert.ok(validWorld(r.state.world));
  assert.equal(applyWorld(r.state,'vlad',{type:'renovation_install',sku:p.id,room,expected,sequence}).ok,false);
  for(const role of ['vlad','alina'] as const){
   assert.ok(findRoute(r.state.characters[role],points[slot],before,floorFor('home')),p.id+' '+role);
   for(const actionId of actions[slot]){
    const cmd={type:'act' as const,actionId};assert.ok(planTask(cmd));const q=evaluateTask(r.state,role,cmd);assert.ok(q.ok,p.id+' '+role+' '+actionId);
   }
   if(slot==='bathtub'){assert.ok(dogBathPlan(r.state,role));assert.ok(evaluateTask(r.state,role,{type:'pet_action',pet:'verdell',action:'bathe'}).ok);}
  }
  s=r.state;
 }
 assert.equal(Object.keys(s.world.renovation!.fixtures!).length,5);
 assert.equal(validRenovation({...initialRenovation(),fixtures:{toilet:'bath-oval'}}),false);
 const dir=mkdtempSync(join(tmpdir(),'bath-renovation-'));try{const files=openServerFiles(dir);files.save(s);assert.deepEqual(files.load().world.renovation?.fixtures,s.world.renovation?.fixtures);}finally{rmSync(dir,{recursive:true,force:true});}
});
function waitPacket(ws:WebSocket,check:(p:ServerPacket)=>boolean):Promise<ServerPacket>{return new Promise((resolve,reject)=>{const timer=setTimeout(()=>{ws.off('message',on);reject(Error('packet timeout'))},6000);function on(raw:WebSocket.RawData){const p=JSON.parse(raw.toString()) as ServerPacket;if(!check(p))return;clearTimeout(timer);ws.off('message',on);resolve(p);}ws.on('message',on);});}
async function connect(port:number,role:CharacterId,code:string){const ws=new WebSocket('ws://127.0.0.1:'+port+'/sync');await once(ws,'open');const ready=waitPacket(ws,p=>p.type==='ready');ws.send(JSON.stringify({type:'auth',role,code}));await ready;return ws;}
test('a live dog bath reserves the installed tub; replacement is rejected before money can change',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'sanitary-live-'));const files=openServerFiles(dir),s=initialState();s.money=100000;s.autonomy={vlad:'off',alina:'off'};s.world.renovation={surfaces:{},samples:['bath-oval','bath-stone'],fixtures:{bathtub:'bath-oval'}};s.pets.verdell.cleanliness=27;s.pets.verdell.position={...DOG_BATH_APPROACH};Object.assign(s.characters.vlad,DOG_BATH_OWNER);files.save(s);
 const server=await startServer({port:0,dataDir:dir,taskTimeScale:.2});const sockets:WebSocket[]=[];
 try{const v=await connect(server.port,'vlad',files.access.vlad),a=await connect(server.port,'alina',files.access.alina);sockets.push(v,a);
 const begun=waitPacket(v,p=>p.type==='task_started'&&p.command.type==='pet_action');v.send(JSON.stringify({type:'pet_action',pet:'verdell',action:'bathe'}));const b=await begun;assert.equal(b.type,'task_started');
 const command={type:'renovation_install',sku:'bath-stone',room:'bathroom',expected:'bath-oval',sequence:0};
 const blocked=waitPacket(a,p=>p.type==='error');a.send(JSON.stringify(command));await blocked;assert.equal(files.load().money,100000);assert.equal(files.load().world.renovation?.fixtures?.bathtub,'bath-oval');
 const ended=waitPacket(v,p=>p.type==='task_ended'&&p.outcome==='cancelled');v.send(JSON.stringify({type:'cancel_task',taskId:b.type==='task_started'?b.taskId:0}));await ended;
 const changed=waitPacket(v,p=>p.type==='snapshot'&&p.state.world.renovation?.fixtures?.bathtub==='bath-stone');a.send(JSON.stringify(command));await changed;
 assert.equal(files.load().world.renovation?.fixtures?.bathtub,'bath-stone');
 }finally{sockets.forEach(w=>w.terminate());await server.close();rmSync(dir,{recursive:true,force:true});}
});


test('slow visual task timing is restricted to an isolated loopback test server',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'sanitary-scale-069-'));
 try{
  await assert.rejects(startServer({port:0,host:'127.0.0.1',dataDir:dir,taskTimeScale:3}),/Invalid task time scale/);
  await assert.rejects(startServer({port:3169,host:'0.0.0.0',dataDir:dir,testNoCodes:true,taskTimeScale:3}),/Invalid task time scale/);
  await assert.rejects(startServer({port:0,host:'127.0.0.1',dataDir:dir,testNoCodes:true,taskTimeScale:4}),/Invalid task time scale/);
  const server=await startServer({port:0,host:'127.0.0.1',dataDir:dir,testNoCodes:true,taskTimeScale:3});
  await server.close();
 }finally{rmSync(dir,{recursive:true,force:true});}
});
